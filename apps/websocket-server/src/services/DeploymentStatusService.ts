import { v4 as uuidv4 } from 'uuid';
import { ConnectionManager } from './ConnectionManager';
import { DeploymentStatus } from '../types/WebSocket';
import { logger } from '../utils/logger';

interface DeploymentEvent {
  id: string;
  deploymentId: string;
  type: 'status_change' | 'progress_update' | 'log' | 'service_update';
  data: any;
  timestamp: Date;
}

export class DeploymentStatusService {
  private connectionManager: ConnectionManager;
  private deployments: Map<string, DeploymentStatus> = new Map();
  private deploymentEvents: Map<string, DeploymentEvent[]> = new Map(); // deploymentId -> events

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.startDeploymentCleanup();
  }

  async handleDeploymentWebhook(payload: any): Promise<void> {
    try {
      // Handle different webhook sources (GitHub Actions, GitLab CI, Jenkins, etc.)
      let deploymentUpdate: Partial<DeploymentStatus> & { id: string };

      if (this.isGitHubActionsWebhook(payload)) {
        deploymentUpdate = this.parseGitHubActionsWebhook(payload);
      } else if (this.isGitLabWebhook(payload)) {
        deploymentUpdate = this.parseGitLabWebhook(payload);
      } else if (this.isJenkinsWebhook(payload)) {
        deploymentUpdate = this.parseJenkinsWebhook(payload);
      } else {
        // Generic webhook format
        deploymentUpdate = this.parseGenericWebhook(payload);
      }

      await this.updateDeployment(deploymentUpdate);

    } catch (error) {
      logger.error('Error handling deployment webhook:', error);
    }
  }

  async updateDeployment(update: Partial<DeploymentStatus> & { id: string }): Promise<void> {
    try {
      let deployment = this.deployments.get(update.id);
      
      if (!deployment) {
        // Create new deployment
        deployment = {
          id: update.id,
          environment: update.environment || 'production',
          status: update.status || 'pending',
          progress: update.progress || 0,
          startedAt: update.startedAt || new Date(),
          logs: update.logs || [],
          services: update.services || []
        };
      } else {
        // Update existing deployment
        Object.assign(deployment, update);
      }

      this.deployments.set(deployment.id, deployment);

      // Create event
      const event: DeploymentEvent = {
        id: uuidv4(),
        deploymentId: deployment.id,
        type: 'status_change',
        data: deployment,
        timestamp: new Date()
      };

      this.addDeploymentEvent(deployment.id, event);

      // Broadcast to all connected clients
      this.connectionManager.broadcastToAll({
        type: 'deployment:status_update',
        data: deployment
      });

      logger.info(`Deployment ${deployment.id} updated: ${deployment.status} (${deployment.progress}%)`);

    } catch (error) {
      logger.error('Error updating deployment:', error);
    }
  }

  async addDeploymentLog(deploymentId: string, level: 'info' | 'warn' | 'error', message: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return;
    }

    const logEntry = {
      timestamp: new Date(),
      level,
      message
    };

    deployment.logs.push(logEntry);

    // Keep only last 200 log entries
    if (deployment.logs.length > 200) {
      deployment.logs = deployment.logs.slice(-200);
    }

    // Create event
    const event: DeploymentEvent = {
      id: uuidv4(),
      deploymentId,
      type: 'log',
      data: logEntry,
      timestamp: new Date()
    };

    this.addDeploymentEvent(deploymentId, event);

    // Broadcast log update
    this.connectionManager.broadcastToAll({
      type: 'deployment:log_update',
      data: {
        deploymentId,
        log: logEntry
      }
    });
  }

  async updateServiceStatus(deploymentId: string, serviceName: string, status: string, url?: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      return;
    }

    let service = deployment.services.find(s => s.name === serviceName);
    if (!service) {
      service = {
        name: serviceName,
        status: status as any,
        url
      };
      deployment.services.push(service);
    } else {
      service.status = status as any;
      if (url) service.url = url;
    }

    // Create event
    const event: DeploymentEvent = {
      id: uuidv4(),
      deploymentId,
      type: 'service_update',
      data: { serviceName, status, url },
      timestamp: new Date()
    };

    this.addDeploymentEvent(deploymentId, event);

    // Broadcast service update
    this.connectionManager.broadcastToAll({
      type: 'deployment:service_update',
      data: {
        deploymentId,
        service: { name: serviceName, status, url }
      }
    });
  }

  getDeployment(id: string): DeploymentStatus | undefined {
    return this.deployments.get(id);
  }

  getActiveDeployments(): DeploymentStatus[] {
    return Array.from(this.deployments.values())
      .filter(d => ['pending', 'building', 'testing', 'deploying'].includes(d.status))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  getRecentDeployments(limit: number = 10): DeploymentStatus[] {
    return Array.from(this.deployments.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  getDeploymentEvents(deploymentId: string, limit: number = 50): DeploymentEvent[] {
    const events = this.deploymentEvents.get(deploymentId) || [];
    return events.slice(-limit);
  }

  private addDeploymentEvent(deploymentId: string, event: DeploymentEvent): void {
    let events = this.deploymentEvents.get(deploymentId) || [];
    events.push(event);

    // Keep only last 100 events per deployment
    if (events.length > 100) {
      events = events.slice(-100);
    }

    this.deploymentEvents.set(deploymentId, events);
  }

  private isGitHubActionsWebhook(payload: any): boolean {
    return payload.action && payload.workflow_run;
  }

  private parseGitHubActionsWebhook(payload: any): Partial<DeploymentStatus> & { id: string } {
    const workflowRun = payload.workflow_run;
    const environment = this.extractEnvironmentFromWorkflow(workflowRun.name);

    let status: DeploymentStatus['status'] = 'pending';
    let progress = 0;

    switch (workflowRun.status) {
      case 'queued':
        status = 'pending';
        progress = 0;
        break;
      case 'in_progress':
        status = 'building';
        progress = 50;
        break;
      case 'completed':
        status = workflowRun.conclusion === 'success' ? 'success' : 'failed';
        progress = 100;
        break;
    }

    return {
      id: `github-${workflowRun.id}`,
      environment,
      status,
      progress,
      startedAt: new Date(workflowRun.created_at),
      completedAt: workflowRun.updated_at ? new Date(workflowRun.updated_at) : undefined
    };
  }

  private isGitLabWebhook(payload: any): boolean {
    return payload.object_kind === 'pipeline' || payload.object_kind === 'deployment';
  }

  private parseGitLabWebhook(payload: any): Partial<DeploymentStatus> & { id: string } {
    const environment = payload.environment?.name || 'production';
    let status: DeploymentStatus['status'] = 'pending';
    let progress = 0;

    if (payload.object_kind === 'pipeline') {
      switch (payload.object_attributes.status) {
        case 'pending':
          status = 'pending';
          progress = 0;
          break;
        case 'running':
          status = 'building';
          progress = 50;
          break;
        case 'success':
          status = 'success';
          progress = 100;
          break;
        case 'failed':
          status = 'failed';
          progress = 100;
          break;
      }
    }

    return {
      id: `gitlab-${payload.object_attributes.id}`,
      environment,
      status,
      progress,
      startedAt: new Date(payload.object_attributes.created_at)
    };
  }

  private isJenkinsWebhook(payload: any): boolean {
    return payload.build && payload.build.number;
  }

  private parseJenkinsWebhook(payload: any): Partial<DeploymentStatus> & { id: string } {
    const build = payload.build;
    const environment = this.extractEnvironmentFromJob(build.jobName);

    let status: DeploymentStatus['status'] = 'pending';
    let progress = 0;

    switch (build.phase) {
      case 'STARTED':
        status = 'building';
        progress = 10;
        break;
      case 'COMPLETED':
        status = build.status === 'SUCCESS' ? 'success' : 'failed';
        progress = 100;
        break;
      case 'FINALIZED':
        status = build.status === 'SUCCESS' ? 'success' : 'failed';
        progress = 100;
        break;
    }

    return {
      id: `jenkins-${build.number}`,
      environment,
      status,
      progress,
      startedAt: new Date(build.timestamp)
    };
  }

  private parseGenericWebhook(payload: any): Partial<DeploymentStatus> & { id: string } {
    return {
      id: payload.id || payload.deploymentId || uuidv4(),
      environment: payload.environment || 'production',
      status: payload.status || 'pending',
      progress: payload.progress || 0,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : new Date(),
      completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
      logs: payload.logs || [],
      services: payload.services || []
    };
  }

  private extractEnvironmentFromWorkflow(workflowName: string): DeploymentStatus['environment'] {
    const name = workflowName.toLowerCase();
    if (name.includes('prod')) return 'production';
    if (name.includes('stag')) return 'staging';
    if (name.includes('dev')) return 'development';
    return 'production';
  }

  private extractEnvironmentFromJob(jobName: string): DeploymentStatus['environment'] {
    const name = jobName.toLowerCase();
    if (name.includes('prod')) return 'production';
    if (name.includes('stag')) return 'staging';
    if (name.includes('dev')) return 'development';
    return 'production';
  }

  private startDeploymentCleanup(): void {
    // Clean up old completed deployments every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      let cleaned = 0;

      for (const [id, deployment] of this.deployments.entries()) {
        const isCompleted = ['success', 'failed'].includes(deployment.status);
        const isOld = deployment.completedAt && deployment.completedAt < cutoff;

        if (isCompleted && isOld) {
          this.deployments.delete(id);
          this.deploymentEvents.delete(id);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} old deployments`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  // Admin/monitoring methods
  getDeploymentStats(): {
    active: number;
    completed: number;
    failed: number;
    averageDuration: number;
  } {
    const deployments = Array.from(this.deployments.values());
    
    const active = deployments.filter(d => 
      ['pending', 'building', 'testing', 'deploying'].includes(d.status)
    ).length;
    
    const completed = deployments.filter(d => d.status === 'success').length;
    const failed = deployments.filter(d => d.status === 'failed').length;
    
    const completedDeployments = deployments.filter(d => d.completedAt);
    const totalDuration = completedDeployments.reduce((acc, d) => {
      const duration = d.completedAt!.getTime() - d.startedAt.getTime();
      return acc + duration;
    }, 0);
    
    const averageDuration = completedDeployments.length > 0 
      ? totalDuration / completedDeployments.length / 1000 / 60 // minutes
      : 0;

    return {
      active,
      completed,
      failed,
      averageDuration: Math.round(averageDuration)
    };
  }
}