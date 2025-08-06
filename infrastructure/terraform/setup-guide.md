# DigitalOcean Kubernetes Infrastructure Setup Guide

This guide provides comprehensive instructions for setting up the DigitalOcean Kubernetes infrastructure for your portfolio website using Terraform.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Infrastructure Overview](#infrastructure-overview)
- [Cost Estimation](#cost-estimation)
- [Initial Setup](#initial-setup)
- [Deploying the Infrastructure](#deploying-the-infrastructure)
- [Accessing Resources](#accessing-resources)
- [Security Considerations](#security-considerations)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Scaling Guidelines](#scaling-guidelines)
- [Troubleshooting](#troubleshooting)
- [Cleanup Instructions](#cleanup-instructions)

## Prerequisites

### Required Accounts
1. **DigitalOcean Account**
   - Sign up at [https://www.digitalocean.com](https://www.digitalocean.com)
   - Add a valid payment method
   - Generate an API token with read/write permissions

### Required Tools
1. **Terraform** (v1.5.0 or later)
   ```bash
   # macOS
   brew install terraform
   
   # Windows (using Chocolatey)
   choco install terraform
   
   # Linux
   wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform
   ```

2. **kubectl** (Kubernetes CLI)
   ```bash
   # macOS
   brew install kubectl
   
   # Windows
   choco install kubernetes-cli
   
   # Linux
   curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
   sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
   ```

3. **doctl** (DigitalOcean CLI)
   ```bash
   # macOS
   brew install doctl
   
   # Windows
   choco install doctl
   
   # Linux
   cd ~
   wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
   tar xf ~/doctl-1.104.0-linux-amd64.tar.gz
   sudo mv ~/doctl /usr/local/bin
   ```

4. **Helm** (Optional, for package management)
   ```bash
   # macOS
   brew install helm
   
   # Windows
   choco install kubernetes-helm
   
   # Linux
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
   ```

### DigitalOcean API Token
1. Log in to your DigitalOcean account
2. Navigate to API → Tokens/Keys
3. Click "Generate New Token"
4. Give it a name (e.g., "terraform-portfolio")
5. Select "Read" and "Write" scopes
6. Copy the token immediately (it won't be shown again)

## Infrastructure Overview

### Components
- **Kubernetes Cluster (DOKS)**
  - 3 nodes (s-2vcpu-4gb droplets)
  - Auto-scaling enabled (3-5 nodes)
  - High availability control plane
  - Automatic patch upgrades

- **Load Balancer**
  - Small tier (handles up to 10,000 simultaneous connections)
  - SSL/TLS termination support
  - Health checks configured

- **Container Registry**
  - Basic tier (5 repositories, 5GB storage)
  - Integrated with Kubernetes for seamless deployments

- **PostgreSQL Database**
  - Version 15
  - 1 node (db-s-1vcpu-1gb)
  - Private networking
  - Automated backups

- **Redis Cache**
  - Version 7
  - 1 node (db-s-1vcpu-1gb)
  - Private networking
  - Persistence enabled

- **Networking**
  - Private VPC for all resources
  - Firewall rules for security
  - Network policies for pod isolation

### Architecture Diagram
```
                    Internet
                       |
                 Load Balancer
                       |
                    Ingress
                       |
              Kubernetes Cluster
                 (3-5 nodes)
                /     |     \
          Production Staging Monitoring
               |       |        |
               |       |        |
          +----+-------+--------+
          |                     |
     PostgreSQL              Redis
     (Private VPC)       (Private VPC)
```

## Cost Estimation

### Monthly Costs (Estimated)
| Component | Specification | Cost/Month |
|-----------|---------------|------------|
| Kubernetes Cluster | 3 × s-2vcpu-4gb | $144 |
| Load Balancer | Small tier | $12 |
| Container Registry | Basic tier | $5 |
| PostgreSQL | db-s-1vcpu-1gb | $15 |
| Redis | db-s-1vcpu-1gb | $15 |
| **Total Base Cost** | | **$191** |

### Additional Costs
- **Data Transfer**: $0.01/GB after 1TB (included)
- **Snapshots/Backups**: $0.05/GB/month
- **Additional Storage**: $0.10/GB/month
- **Auto-scaling**: $48/month per additional node

### Cost Optimization Tips
1. Use reserved instances for long-term savings (up to 20% discount)
2. Implement proper resource limits in Kubernetes
3. Use horizontal pod autoscaling instead of node autoscaling when possible
4. Regularly review and clean up unused resources
5. Monitor data transfer costs

## Initial Setup

### 1. Clone and Navigate to Project
```bash
cd ~/Personal-WebSite/infrastructure/terraform
```

### 2. Create terraform.tfvars
```bash
cp terraform.tfvars.example terraform.tfvars
```

### 3. Edit terraform.tfvars
```hcl
# Required: Add your DigitalOcean API token
do_token = "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Optional: Customize other values
region = "nyc3"  # Choose closest region
environment = "production"
project_name = "portfolio"

# Adjust node sizes for budget
node_pool_droplet_size = "s-2vcpu-4gb"  # or "s-2vcpu-2gb" for $24/month per node
```

### 4. Configure doctl
```bash
doctl auth init --access-token <your-token>
doctl account get  # Verify authentication
```

## Deploying the Infrastructure

### 1. Initialize Terraform
```bash
terraform init
```

### 2. Validate Configuration
```bash
terraform validate
```

### 3. Plan Deployment
```bash
terraform plan -out=tfplan
```
Review the plan carefully. It should show:
- Resources to be created: ~25
- No resources to be destroyed (on first run)

### 4. Apply Configuration
```bash
terraform apply tfplan
```
This process takes 15-20 minutes. You'll see:
- VPC creation (instant)
- Kubernetes cluster provisioning (10-15 minutes)
- Database clusters creation (5-10 minutes each)
- Load balancer and registry setup (1-2 minutes)

### 5. Save Outputs
```bash
terraform output -json > outputs.json
```

## Accessing Resources

### 1. Configure kubectl
```bash
# Automatic configuration using doctl
doctl kubernetes cluster kubeconfig save portfolio-k8s-production

# Verify connection
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
```

### 2. Access Container Registry
```bash
# Login to registry
doctl registry login

# Get registry endpoint
terraform output registry_endpoint

# Tag and push images
docker tag myapp:latest registry.digitalocean.com/portfolioregistryproduction/myapp:latest
docker push registry.digitalocean.com/portfolioregistryproduction/myapp:latest
```

### 3. Database Connections
```bash
# Get connection details (keep secure!)
terraform output -raw postgres_connection_string
terraform output -raw redis_connection_string

# Connect to PostgreSQL (requires psql client)
PGPASSWORD=$(terraform output -raw postgres_password) \
  psql -h $(terraform output -raw postgres_host) \
  -U $(terraform output -raw postgres_user) \
  -d $(terraform output -raw postgres_database) \
  -p $(terraform output -raw postgres_port)
```

### 4. Load Balancer Access
```bash
# Get Load Balancer IP
terraform output load_balancer_ip

# Configure DNS
# Add A record pointing to this IP
```

## Security Considerations

### 1. API Token Security
- Never commit terraform.tfvars to version control
- Use environment variables for CI/CD:
  ```bash
  export TF_VAR_do_token="your-token"
  ```
- Consider using a secrets management tool

### 2. Network Security
- All databases use private networking (not accessible from internet)
- Kubernetes nodes are in a private VPC
- Firewall rules restrict access between components
- Network policies enforce namespace isolation

### 3. Kubernetes Security
- RBAC is enabled by default
- Network policies isolate namespaces
- Resource quotas prevent resource exhaustion
- Use pod security policies for additional hardening

### 4. Database Security
- Connections require SSL/TLS
- Passwords are auto-generated and stored in Kubernetes secrets
- Regular automated backups
- Private networking prevents external access

### 5. Best Practices
- Rotate API tokens regularly
- Use least-privilege IAM policies
- Enable audit logging
- Implement pod security standards
- Regular security updates

## Monitoring and Maintenance

### 1. Built-in Monitoring
DigitalOcean provides basic monitoring for:
- CPU, memory, disk usage
- Network traffic
- Database performance
- Kubernetes metrics

### 2. Installing Prometheus/Grafana (Optional)
```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName="do-block-storage" \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.accessModes[0]="ReadWriteOnce" \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage="10Gi"
```

### 3. Maintenance Windows
- Configured for Sunday 4:00 AM (local cluster time)
- Automatic patch updates enabled
- Zero-downtime updates with surge upgrades

### 4. Backup Strategy
- PostgreSQL: Daily automated backups (7-day retention)
- Redis: Persistence enabled
- Kubernetes: Regular etcd backups
- Application data: Implement volume snapshots

## Scaling Guidelines

### 1. Horizontal Scaling
```hcl
# Increase minimum nodes
node_pool_min_nodes = 5
node_pool_max_nodes = 10

# Apply changes
terraform apply
```

### 2. Vertical Scaling
```hcl
# Upgrade node size
node_pool_droplet_size = "s-4vcpu-8gb"  # $96/month per node

# Upgrade database
db_size = "db-s-2vcpu-4gb"  # $60/month
```

### 3. Application Scaling
```yaml
# Horizontal Pod Autoscaler example
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Troubleshooting

### Common Issues

#### 1. Terraform Apply Fails
```bash
# Check for API token issues
doctl account get

# Validate configuration
terraform validate

# Check for resource limits
doctl account rate-limit
```

#### 2. Cannot Connect to Cluster
```bash
# Re-save kubeconfig
doctl kubernetes cluster kubeconfig save portfolio-k8s-production --set-current-context

# Check cluster status
doctl kubernetes cluster get portfolio-k8s-production

# Verify nodes are ready
kubectl get nodes
```

#### 3. Database Connection Issues
```bash
# Check firewall rules
doctl firewall list

# Verify VPC connectivity
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
# Inside pod: apk add postgresql-client
# psql -h <postgres-private-host> -U <user> -d <database>
```

#### 4. Registry Push Failures
```bash
# Re-authenticate
doctl registry login

# Check quota
doctl registry get

# Verify repository exists
doctl registry repository list
```

### Debug Commands
```bash
# Terraform debugging
export TF_LOG=DEBUG
terraform apply

# Kubernetes debugging
kubectl describe node <node-name>
kubectl logs -n kube-system <pod-name>
kubectl get events --all-namespaces

# DigitalOcean resources
doctl kubernetes cluster list
doctl database list
doctl compute load-balancer list
```

## Cleanup Instructions

### Complete Teardown
```bash
# Remove all resources
terraform destroy

# Confirm by typing 'yes'
```

### Partial Cleanup
```bash
# Remove specific resources
terraform destroy -target=digitalocean_database_cluster.redis

# Or modify terraform.tfvars and apply
node_pool_size = 1  # Reduce to minimum
terraform apply
```

### Post-Cleanup
1. Remove local kubeconfig entries
   ```bash
   kubectl config delete-context do-nyc3-portfolio-k8s-production
   ```

2. Clean local files
   ```bash
   rm -f terraform.tfstate* outputs.json kubeconfig
   ```

3. Revoke API token (if no longer needed)
   - Go to DigitalOcean dashboard → API → Tokens
   - Delete the terraform token

## Next Steps

1. **Deploy Applications**
   - Use Helm charts in `/infrastructure/helm-charts/`
   - Configure CI/CD pipelines
   - Set up GitOps with ArgoCD

2. **Configure DNS**
   - Point domain to load balancer IP
   - Set up SSL certificates with cert-manager

3. **Implement Monitoring**
   - Deploy Prometheus and Grafana
   - Set up alerts for critical metrics
   - Configure log aggregation

4. **Security Hardening**
   - Implement network policies
   - Set up pod security policies
   - Configure RBAC for team members
   - Enable audit logging

## Support Resources

- [DigitalOcean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [Terraform DigitalOcean Provider](https://registry.terraform.io/providers/digitalocean/digitalocean/latest/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [DigitalOcean Community](https://www.digitalocean.com/community)

For infrastructure-specific questions, refer to the Terraform configuration files in this directory.