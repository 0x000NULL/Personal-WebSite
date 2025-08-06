# Optional monitoring stack using Helm
# Uncomment this file content to enable Prometheus, Grafana, and Loki

# Install Prometheus Operator and Grafana
resource "helm_release" "kube_prometheus_stack" {
  count = var.enable_monitoring ? 1 : 0

  name       = "kube-prometheus-stack"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "56.6.2"

  values = [
    <<-EOT
    prometheus:
      prometheusSpec:
        storageSpec:
          volumeClaimTemplate:
            spec:
              storageClassName: do-block-storage
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 10Gi
        resources:
          requests:
            memory: 400Mi
            cpu: 100m
          limits:
            memory: 2Gi
            cpu: 500m
        retention: 7d
        
    grafana:
      adminPassword: ${random_password.grafana_password[0].result}
      ingress:
        enabled: false
      persistence:
        enabled: true
        storageClassName: do-block-storage
        size: 1Gi
      resources:
        requests:
          memory: 100Mi
          cpu: 100m
        limits:
          memory: 256Mi
          cpu: 200m
          
    alertmanager:
      alertmanagerSpec:
        storage:
          volumeClaimTemplate:
            spec:
              storageClassName: do-block-storage
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 1Gi
        resources:
          requests:
            memory: 100Mi
            cpu: 10m
          limits:
            memory: 256Mi
            cpu: 100m
            
    nodeExporter:
      resources:
        requests:
          memory: 30Mi
          cpu: 10m
        limits:
          memory: 64Mi
          cpu: 100m
          
    kubeStateMetrics:
      resources:
        requests:
          memory: 50Mi
          cpu: 10m
        limits:
          memory: 128Mi
          cpu: 100m
    EOT
  ]

  depends_on = [
    digitalocean_kubernetes_cluster.portfolio_cluster,
    kubernetes_namespace.monitoring
  ]
}

# Generate random password for Grafana
resource "random_password" "grafana_password" {
  count   = var.enable_monitoring ? 1 : 0
  length  = 16
  special = true
}

# Store Grafana credentials in Kubernetes secret
resource "kubernetes_secret" "grafana_credentials" {
  count = var.enable_monitoring ? 1 : 0

  metadata {
    name      = "grafana-admin-credentials"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    username = "admin"
    password = random_password.grafana_password[0].result
  }
}

# Install Loki for log aggregation
resource "helm_release" "loki_stack" {
  count = var.enable_monitoring ? 1 : 0

  name       = "loki-stack"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "2.10.1"

  values = [
    <<-EOT
    loki:
      persistence:
        enabled: true
        storageClassName: do-block-storage
        size: 10Gi
      resources:
        requests:
          memory: 128Mi
          cpu: 100m
        limits:
          memory: 256Mi
          cpu: 200m
      config:
        limits_config:
          retention_period: 168h
          
    promtail:
      resources:
        requests:
          memory: 50Mi
          cpu: 50m
        limits:
          memory: 128Mi
          cpu: 200m
    EOT
  ]

  depends_on = [
    digitalocean_kubernetes_cluster.portfolio_cluster,
    kubernetes_namespace.monitoring
  ]
}

# Output monitoring access information
output "monitoring_info" {
  value = var.enable_monitoring ? {
    grafana_url      = "http://${digitalocean_loadbalancer.portfolio_lb.ip}/grafana"
    grafana_user     = "admin"
    grafana_password = nonsensitive(random_password.grafana_password[0].result)
    prometheus_url   = "http://${digitalocean_loadbalancer.portfolio_lb.ip}/prometheus"
    alertmanager_url = "http://${digitalocean_loadbalancer.portfolio_lb.ip}/alertmanager"
    note             = "Configure ingress rules to expose these services"
  } : {
    status = "Monitoring disabled. Set enable_monitoring = true to enable."
  }
  
  description = "Monitoring stack access information"
  sensitive   = true
}