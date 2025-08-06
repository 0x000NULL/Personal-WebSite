# GitHub Actions CI/CD Workflows

This directory contains the complete CI/CD pipeline for the Portfolio Monorepo project, designed for automated deployment to DigitalOcean Kubernetes.

## 📋 Overview

The pipeline consists of four main workflows that provide comprehensive automation from code quality checks to production deployment:

1. **[ci.yml](./ci.yml)** - Continuous Integration for Pull Requests
2. **[deploy.yml](./deploy.yml)** - Automated Deployment for main/develop branches
3. **[docker-build.yml](./docker-build.yml)** - Reusable Docker Build & Push workflow
4. **[manual-deploy.yml](./manual-deploy.yml)** - Manual Deployment with full control

## 🚀 Workflows Details

### 1. CI Workflow (`ci.yml`)

**Triggers:** Pull requests and pushes to `main`/`develop` branches

**Purpose:** Ensures code quality, runs tests, and validates builds before merging

**Jobs:**
- **Code Quality**: ESLint, Prettier formatting, TypeScript checking
- **Tests**: Unit and integration tests in parallel
- **Build Validation**: Builds all services to ensure they compile
- **Docker Build Test**: Tests Docker image building without pushing
- **CI Summary**: Provides comprehensive status reporting

**Key Features:**
- ✅ Parallel execution for faster feedback
- ✅ Turbo caching for improved performance
- ✅ Matrix strategy for service-specific builds
- ✅ Comprehensive status reporting
- ✅ Build artifact preservation

### 2. Deploy Workflow (`deploy.yml`)

**Triggers:** Pushes to `main` (production) or `develop` (staging) branches

**Purpose:** Automated deployment with full testing and validation

**Jobs:**
- **Setup**: Determines environment and services to deploy
- **Build & Test**: Runs tests and builds applications
- **Docker Build & Push**: Creates and pushes Docker images
- **Deploy**: Deploys to Kubernetes using Helm
- **Post-deploy Validation**: Health checks and verification
- **Deployment Summary**: Complete deployment report

**Key Features:**
- ✅ Environment-specific configuration (production vs staging)
- ✅ Service-specific deployment control
- ✅ Helm-based Kubernetes deployment
- ✅ Automatic health checking
- ✅ Rollback-ready with atomic deployments

### 3. Docker Build Workflow (`docker-build.yml`)

**Triggers:** Called by other workflows or manual dispatch

**Purpose:** Reusable workflow for building and pushing Docker images

**Jobs:**
- **Setup**: Configures build parameters
- **Build Code**: Compiles applications with Turbo
- **Docker Build**: Builds and pushes images with caching
- **Docker Test**: Validates images can run successfully
- **Build Summary**: Reports on build status

**Key Features:**
- ✅ Reusable across multiple workflows
- ✅ Multi-platform support (configurable)
- ✅ Advanced Docker caching
- ✅ Security scanning with Trivy
- ✅ Fallback Dockerfile generation

### 4. Manual Deploy Workflow (`manual-deploy.yml`)

**Triggers:** Manual workflow dispatch only

**Purpose:** Controlled deployment with extensive validation and options

**Jobs:**
- **Validate & Setup**: Input validation and configuration
- **Run Tests**: Optional test execution
- **Build Images**: Conditional image building
- **Verify Images**: Ensures images exist in registry
- **Pre-deployment Validation**: Comprehensive checks
- **Deploy**: Kubernetes deployment with Helm
- **Post-deployment Validation**: Health checks and verification
- **Deployment Summary**: Complete status report

**Key Features:**
- ✅ Extensive input validation
- ✅ Dry-run capability
- ✅ Production safety checks
- ✅ Selective service deployment
- ✅ Custom image tag support

## 🔧 Configuration

### Required Secrets

Configure these secrets in your GitHub repository settings:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `DO_REGISTRY_TOKEN` | DigitalOcean Container Registry token | All Docker operations |
| `KUBECONFIG` | Base64-encoded Kubernetes config | All deployment operations |
| `TURBO_TOKEN` | Turbo Remote Cache token (optional) | Build performance |

### Required Variables

Configure these variables in your GitHub repository settings:

| Variable | Description | Example |
|----------|-------------|---------|
| `DO_REGISTRY_NAMESPACE` | Registry namespace | `portfolio-prod` |
| `DOMAIN_NAME` | Base domain for services | `example.com` |
| `TURBO_TEAM` | Turbo team name (optional) | `portfolio-team` |

### Optional Resource Variables

For fine-tuned resource allocation, configure these variables:

| Variable Pattern | Description | Example |
|------------------|-------------|---------|
| `CPU_LIMIT_<SERVICE>_<ENV>` | CPU limit for service | `CPU_LIMIT_frontend_production=1000m` |
| `MEMORY_LIMIT_<SERVICE>_<ENV>` | Memory limit for service | `MEMORY_LIMIT_frontend_production=1Gi` |
| `CPU_REQUEST_<SERVICE>_<ENV>` | CPU request for service | `CPU_REQUEST_frontend_production=100m` |
| `MEMORY_REQUEST_<SERVICE>_<ENV>` | Memory request for service | `MEMORY_REQUEST_frontend_production=256Mi` |

## 🛠 Setup Instructions

### 1. Initial Setup

1. **Clone the repository** and ensure you have the required project structure:
   ```
   apps/
   ├── frontend/
   ├── backend-api/
   ├── websocket-server/
   └── ml-service/
   packages/
   ├── shared-types/
   ├── ui-components/
   └── utils/
   infrastructure/
   └── helm-charts/
       ├── frontend/
       ├── backend-api/
       ├── websocket-server/
       └── ml-service/
   ```

2. **Configure DigitalOcean Container Registry:**
   ```bash
   # Create a registry
   doctl registry create portfolio-registry
   
   # Generate access token
   doctl registry kubernetes-manifest | kubectl apply -f -
   ```

3. **Set up Kubernetes cluster:**
   ```bash
   # Create cluster
   doctl kubernetes cluster create portfolio-cluster --region nyc1 --size s-2vcpu-2gb --count 3
   
   # Get kubeconfig
   doctl kubernetes cluster kubeconfig save portfolio-cluster
   
   # Base64 encode for GitHub secret
   cat ~/.kube/config | base64 -w 0
   ```

### 2. GitHub Repository Configuration

1. **Navigate to Settings > Secrets and variables > Actions**

2. **Add Repository Secrets:**
   ```
   DO_REGISTRY_TOKEN: [Your DigitalOcean registry token]
   KUBECONFIG: [Base64-encoded kubeconfig]
   TURBO_TOKEN: [Optional: Turbo remote cache token]
   ```

3. **Add Repository Variables:**
   ```
   DO_REGISTRY_NAMESPACE: portfolio-prod
   DOMAIN_NAME: yourdomain.com
   TURBO_TEAM: your-team-name
   ```

### 3. Environment Setup

1. **Create GitHub Environments:**
   - Go to Settings > Environments
   - Create environments: `staging`, `production`, `monitoring`
   - Configure protection rules as needed

2. **Set up DNS:**
   ```
   frontend.staging.yourdomain.com    -> Load Balancer IP
   backend-api.staging.yourdomain.com -> Load Balancer IP
   frontend.production.yourdomain.com -> Load Balancer IP
   backend-api.production.yourdomain.com -> Load Balancer IP
   ```

## 📚 Usage Guide

### Automated Deployments

**Staging Deployment:**
1. Push code to `develop` branch
2. CI workflow runs automatically
3. If CI passes, deploy workflow runs automatically
4. Services are deployed to staging environment

**Production Deployment:**
1. Merge code to `main` branch
2. CI workflow runs automatically
3. If CI passes, deploy workflow runs automatically
4. Services are deployed to production environment

### Manual Deployments

**Standard Manual Deployment:**
1. Go to Actions > Manual Deploy
2. Click "Run workflow"
3. Select environment (`staging`/`production`/`monitoring`)
4. Choose services to deploy (`all` or specific services)
5. Click "Run workflow"

**Advanced Manual Deployment Options:**
- **Custom Image Tag**: Deploy a specific version
- **Force Rebuild**: Rebuild images even if they exist
- **Skip Tests**: Skip test execution (not recommended for production)
- **Dry Run**: Validate deployment without executing

### Service-Specific Deployments

**Deploy Only Frontend:**
```
Services: frontend
Environment: staging
```

**Deploy Backend Services:**
```
Services: backend-api,websocket-server,ml-service
Environment: production
```

### Rollback Procedures

**Using Manual Deploy:**
1. Find the previous successful image tag in deployment history
2. Run Manual Deploy workflow
3. Set "Custom Image Tag" to the previous version
4. Deploy to affected environment

**Using kubectl (Emergency):**
```bash
# Rollback to previous version
kubectl rollout undo deployment/frontend-production -n production

# Rollback to specific revision
kubectl rollout undo deployment/frontend-production --to-revision=2 -n production
```

## 🔍 Monitoring and Debugging

### Workflow Status

Each workflow provides comprehensive status reporting through:
- ✅ Job-level success/failure indicators
- 📊 GitHub Step Summary with detailed information
- 🔗 Direct links to deployed services
- 📝 Complete deployment logs

### Common Issues and Solutions

#### 1. Docker Build Failures

**Problem:** Docker build fails with "Dockerfile not found"
```
Solution: Ensure each service has a Dockerfile in apps/<service>/Dockerfile
Alternative: The workflow will generate a fallback Dockerfile automatically
```

**Problem:** Out of memory during build
```
Solution: Adjust GitHub runner or use multi-stage builds to reduce memory usage
Check: apps/<service>/Dockerfile for optimization opportunities
```

#### 2. Deployment Failures

**Problem:** Helm deployment fails with "release already exists"
```bash
# Check current releases
helm list -n <environment>

# Force upgrade
helm upgrade --install <release-name> <chart-path> --force
```

**Problem:** Pod stuck in Pending state
```bash
# Check pod status
kubectl describe pod <pod-name> -n <environment>

# Common causes:
# - Insufficient cluster resources
# - Image pull failures
# - Missing secrets or config maps
```

#### 3. Health Check Failures

**Problem:** Health checks fail after deployment
```
Check: Service implements /health endpoint
Check: Service is properly exposed through ingress
Check: DNS configuration is correct
Debug: kubectl logs <pod-name> -n <environment>
```

#### 4. Registry Issues

**Problem:** Cannot push to DigitalOcean registry
```bash
# Verify registry token
doctl registry login

# Check registry exists
doctl registry get

# Verify namespace
doctl registry repository list
```

### Debugging Commands

**Check Workflow Logs:**
- Go to Actions tab in GitHub
- Click on the failed workflow run
- Expand failed job steps for detailed logs

**Kubernetes Debugging:**
```bash
# Check cluster status
kubectl cluster-info

# Check deployments
kubectl get deployments -n <environment>

# Check pods
kubectl get pods -n <environment>

# Check services
kubectl get services -n <environment>

# Check ingress
kubectl get ingress -n <environment>

# View logs
kubectl logs -f deployment/<service>-<environment> -n <environment>
```

**Helm Debugging:**
```bash
# Check releases
helm list -n <environment>

# Get release status
helm status <release-name> -n <environment>

# Get release values
helm get values <release-name> -n <environment>

# Dry run deployment
helm upgrade --install <release-name> <chart-path> --dry-run --debug
```

## 🚨 Emergency Procedures

### Complete Rollback

If a deployment causes critical issues:

1. **Immediate Response:**
   ```bash
   # Rollback all services to previous version
   for service in frontend backend-api websocket-server ml-service; do
     kubectl rollout undo deployment/${service}-production -n production
   done
   ```

2. **Verify Rollback:**
   ```bash
   # Check rollout status
   kubectl get deployments -n production
   
   # Verify health
   curl -f https://frontend.production.yourdomain.com/health
   ```

3. **Communication:**
   - Update incident status
   - Notify stakeholders
   - Document the issue

### Traffic Switching

For gradual rollouts or A/B testing:

```bash
# Scale down new version
kubectl scale deployment frontend-production --replicas=1 -n production

# Scale up old version
kubectl scale deployment frontend-production-old --replicas=2 -n production

# Update ingress weights (if using traffic splitting)
kubectl patch ingress frontend-ingress -n production --patch='...'
```

## 📈 Performance Optimization

### Build Performance

1. **Turbo Caching:**
   - Enable Turbo Remote Cache with `TURBO_TOKEN`
   - Use Turbo team configuration with `TURBO_TEAM`

2. **Docker Caching:**
   - Workflows use GitHub Actions Cache for Docker layers
   - Multi-stage builds reduce final image size

3. **Parallel Execution:**
   - Services build in parallel using matrix strategy
   - Tests run concurrently for faster feedback

### Deployment Performance

1. **Resource Allocation:**
   - Configure appropriate CPU/memory limits
   - Use horizontal pod autoscaling for production

2. **Health Checks:**
   - Implement efficient `/health` endpoints
   - Configure appropriate readiness/liveness probes

3. **Image Optimization:**
   - Use alpine-based images when possible
   - Minimize layer count in Dockerfiles
   - Use `.dockerignore` to exclude unnecessary files

## 🔐 Security Best Practices

### Secrets Management

- ✅ All secrets stored in GitHub repository secrets
- ✅ No secrets in code or configuration files
- ✅ Base64 encoding for binary secrets (kubeconfig)
- ✅ Least-privilege access tokens

### Container Security

- ✅ Trivy security scanning for images
- ✅ Non-root user in containers
- ✅ Minimal base images (alpine)
- ✅ No unnecessary packages in production images

### Kubernetes Security

- ✅ Namespace isolation
- ✅ Resource limits and requests
- ✅ Network policies (recommended)
- ✅ Pod security standards (recommended)

### Access Control

- ✅ GitHub environment protection rules
- ✅ Required reviewers for production deployments
- ✅ Audit logging for all deployments
- ✅ Time-based access controls

## 📊 Metrics and Monitoring

### Deployment Metrics

Each workflow provides metrics on:
- Build times per service
- Test execution duration
- Docker image sizes
- Deployment success rates
- Health check response times

### Recommended Monitoring

1. **Application Monitoring:**
   - Set up Prometheus/Grafana
   - Monitor service health endpoints
   - Track response times and error rates

2. **Infrastructure Monitoring:**
   - Monitor Kubernetes cluster health
   - Track resource utilization
   - Set up alerting for failures

3. **Deployment Monitoring:**
   - Track deployment frequency
   - Monitor rollback rates
   - Measure deployment duration

## 🤝 Contributing

### Adding New Services

1. **Create Service Structure:**
   ```
   apps/new-service/
   ├── Dockerfile
   ├── package.json
   └── src/
   ```

2. **Update Workflows:**
   - Add service to matrix strategies in all workflow files
   - Update service lists in deployment logic

3. **Create Helm Chart:**
   ```
   infrastructure/helm-charts/new-service/
   ├── Chart.yaml
   ├── values.yaml
   └── templates/
   ```

### Workflow Modifications

1. **Test Changes:**
   - Use manual deployment with dry-run
   - Test in staging environment first
   - Validate with different service combinations

2. **Documentation:**
   - Update this README
   - Add inline comments for complex logic
   - Update troubleshooting sections

3. **Review Process:**
   - Get reviews from team members
   - Test thoroughly before merging
   - Monitor first few deployments closely

## 📞 Support

For issues with the CI/CD pipeline:

1. **Check this documentation** for common solutions
2. **Review workflow logs** in the Actions tab  
3. **Test with dry-run** to validate configurations
4. **Check Kubernetes logs** for deployment issues
5. **Contact the DevOps team** for urgent issues

---

**Last Updated:** $(date -u +%Y-%m-%d)
**Version:** 1.0.0
**Maintainer:** Portfolio DevOps Team