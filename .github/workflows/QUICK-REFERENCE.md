# Quick Reference Guide

## 🚀 Quick Actions

### Deploy to Staging
```
1. Push to `develop` branch
2. CI workflow runs automatically
3. Deploy workflow deploys to staging
```

### Deploy to Production
```
1. Merge to `main` branch
2. CI workflow runs automatically  
3. Deploy workflow deploys to production
```

### Manual Deployment
```
1. Go to Actions > Manual Deploy
2. Select environment and services
3. Click "Run workflow"
```

### Emergency Rollback
```bash
kubectl rollout undo deployment/<service>-<env> -n <env>
```

## 🔧 Essential Commands

### Check Deployment Status
```bash
kubectl get deployments -n <environment>
kubectl get pods -n <environment>
kubectl get services -n <environment>
```

### View Logs
```bash
kubectl logs -f deployment/<service>-<environment> -n <environment>
```

### Helm Operations
```bash
# List releases
helm list -n <environment>

# Get release status
helm status <release-name> -n <environment>

# Rollback release
helm rollback <release-name> <revision> -n <environment>
```

### Health Checks
```bash
# Check service health
curl -f https://<service>.<environment>.<domain>/health

# Check all staging services
for service in frontend backend-api websocket-server ml-service; do
  curl -f https://$service.staging.yourdomain.com/health && echo " ✅ $service" || echo " ❌ $service"
done
```

## 🔑 Required Secrets & Variables

### Secrets (Repository Settings > Secrets)
- `DO_REGISTRY_TOKEN` - DigitalOcean registry token
- `KUBECONFIG` - Base64-encoded Kubernetes config  
- `TURBO_TOKEN` - Turbo cache token (optional)

### Variables (Repository Settings > Variables)
- `DO_REGISTRY_NAMESPACE` - Registry namespace (e.g., `portfolio-prod`)
- `DOMAIN_NAME` - Base domain (e.g., `yourdomain.com`)
- `TURBO_TEAM` - Turbo team name (optional)

## 🐛 Common Issues

### Build Fails - "Dockerfile not found"
- Ensure `apps/<service>/Dockerfile` exists
- Workflow will auto-generate fallback Dockerfile

### Deployment Fails - "ImagePullBackOff"
- Check registry token is valid
- Verify image exists in registry
- Check network connectivity

### Health Checks Fail
- Ensure service implements `/health` endpoint  
- Check service is running: `kubectl get pods -n <env>`
- Check ingress: `kubectl get ingress -n <env>`

### "Release already exists" Error
```bash
helm upgrade --install <release> <chart> --force
```

## 📊 Workflow Status

### CI Workflow (Pull Requests)
- ✅ Code Quality (ESLint, Prettier, TypeScript)
- ✅ Tests (Unit & Integration)  
- ✅ Build Validation
- ✅ Docker Build Test

### Deploy Workflow (main/develop)
- ✅ Build & Test
- ✅ Docker Build & Push
- ✅ Kubernetes Deploy
- ✅ Health Checks

### Manual Deploy Workflow
- ✅ Validation & Setup
- ✅ Optional Tests
- ✅ Image Build/Verify
- ✅ Deploy with Helm
- ✅ Post-deploy Validation

## 🎯 Service URLs

### Staging
- Frontend: `https://frontend.staging.yourdomain.com`
- Backend API: `https://backend-api.staging.yourdomain.com`
- WebSocket: `https://websocket-server.staging.yourdomain.com`
- ML Service: `https://ml-service.staging.yourdomain.com`

### Production  
- Frontend: `https://frontend.production.yourdomain.com`
- Backend API: `https://backend-api.production.yourdomain.com`
- WebSocket: `https://websocket-server.production.yourdomain.com`
- ML Service: `https://ml-service.production.yourdomain.com`

## ⚡ Quick Debugging

### Check Everything
```bash
# Cluster info
kubectl cluster-info

# All resources in environment
kubectl get all -n <environment>

# Recent events
kubectl get events -n <environment> --sort-by='.lastTimestamp'

# Pod status with details
kubectl get pods -n <environment> -o wide
```

### Service-Specific Debug
```bash
# Describe problematic pod
kubectl describe pod <pod-name> -n <environment>

# Get pod logs
kubectl logs <pod-name> -n <environment>

# Execute into pod
kubectl exec -it <pod-name> -n <environment> -- /bin/sh
```

### Helm Debug
```bash
# Test template rendering
helm template <release> <chart> --values <values-file> --debug

# Dry run upgrade
helm upgrade <release> <chart> --dry-run --debug
```

## 🚨 Emergency Contacts

For urgent production issues:
1. Check this guide first
2. Review GitHub Actions logs
3. Use kubectl commands above
4. Contact DevOps team if needed

## 📱 Mobile Quick Actions

From GitHub mobile app:
1. Go to Actions tab
2. Find "Manual Deploy" workflow
3. Tap "Run workflow"
4. Select parameters and deploy

---
*For detailed documentation, see [README.md](./README.md)*