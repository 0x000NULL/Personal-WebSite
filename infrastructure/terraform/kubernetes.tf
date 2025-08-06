# Kubernetes Namespaces
resource "kubernetes_namespace" "production" {
  metadata {
    name = "production"
    labels = {
      environment = "production"
      project     = var.project_name
    }
  }

  depends_on = [digitalocean_kubernetes_cluster.portfolio_cluster]
}

resource "kubernetes_namespace" "staging" {
  metadata {
    name = "staging"
    labels = {
      environment = "staging"
      project     = var.project_name
    }
  }

  depends_on = [digitalocean_kubernetes_cluster.portfolio_cluster]
}

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
    labels = {
      environment = "monitoring"
      project     = var.project_name
    }
  }

  depends_on = [digitalocean_kubernetes_cluster.portfolio_cluster]
}

# Container Registry Secret for Production
resource "kubernetes_secret" "registry_production" {
  metadata {
    name      = "registry-credentials"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = digitalocean_container_registry_docker_credentials.portfolio.docker_credentials
  }

  depends_on = [
    digitalocean_container_registry.portfolio,
    kubernetes_namespace.production
  ]
}

# Container Registry Secret for Staging
resource "kubernetes_secret" "registry_staging" {
  metadata {
    name      = "registry-credentials"
    namespace = kubernetes_namespace.staging.metadata[0].name
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = digitalocean_container_registry_docker_credentials.portfolio.docker_credentials
  }

  depends_on = [
    digitalocean_container_registry.portfolio,
    kubernetes_namespace.staging
  ]
}

# Database Connection Secret for Production
resource "kubernetes_secret" "db_production" {
  metadata {
    name      = "database-credentials"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    POSTGRES_HOST     = digitalocean_database_cluster.postgres.private_host
    POSTGRES_PORT     = digitalocean_database_cluster.postgres.port
    POSTGRES_DATABASE = digitalocean_database_db.portfolio_db.name
    POSTGRES_USER     = digitalocean_database_user.portfolio_user.name
    POSTGRES_PASSWORD = digitalocean_database_user.portfolio_user.password
    DATABASE_URL      = "postgresql://${digitalocean_database_user.portfolio_user.name}:${digitalocean_database_user.portfolio_user.password}@${digitalocean_database_cluster.postgres.private_host}:${digitalocean_database_cluster.postgres.port}/${digitalocean_database_db.portfolio_db.name}?sslmode=require"
  }

  depends_on = [
    digitalocean_database_cluster.postgres,
    kubernetes_namespace.production
  ]
}

# Database Connection Secret for Staging
resource "kubernetes_secret" "db_staging" {
  metadata {
    name      = "database-credentials"
    namespace = kubernetes_namespace.staging.metadata[0].name
  }

  data = {
    POSTGRES_HOST     = digitalocean_database_cluster.postgres.private_host
    POSTGRES_PORT     = digitalocean_database_cluster.postgres.port
    POSTGRES_DATABASE = digitalocean_database_db.portfolio_db.name
    POSTGRES_USER     = digitalocean_database_user.portfolio_user.name
    POSTGRES_PASSWORD = digitalocean_database_user.portfolio_user.password
    DATABASE_URL      = "postgresql://${digitalocean_database_user.portfolio_user.name}:${digitalocean_database_user.portfolio_user.password}@${digitalocean_database_cluster.postgres.private_host}:${digitalocean_database_cluster.postgres.port}/${digitalocean_database_db.portfolio_db.name}?sslmode=require"
  }

  depends_on = [
    digitalocean_database_cluster.postgres,
    kubernetes_namespace.staging
  ]
}

# Redis Connection Secret for Production
resource "kubernetes_secret" "redis_production" {
  metadata {
    name      = "redis-credentials"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  data = {
    REDIS_HOST     = digitalocean_database_cluster.redis.private_host
    REDIS_PORT     = digitalocean_database_cluster.redis.port
    REDIS_PASSWORD = digitalocean_database_cluster.redis.password
    REDIS_URL      = "redis://default:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.private_host}:${digitalocean_database_cluster.redis.port}"
  }

  depends_on = [
    digitalocean_database_cluster.redis,
    kubernetes_namespace.production
  ]
}

# Redis Connection Secret for Staging
resource "kubernetes_secret" "redis_staging" {
  metadata {
    name      = "redis-credentials"
    namespace = kubernetes_namespace.staging.metadata[0].name
  }

  data = {
    REDIS_HOST     = digitalocean_database_cluster.redis.private_host
    REDIS_PORT     = digitalocean_database_cluster.redis.port
    REDIS_PASSWORD = digitalocean_database_cluster.redis.password
    REDIS_URL      = "redis://default:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.private_host}:${digitalocean_database_cluster.redis.port}"
  }

  depends_on = [
    digitalocean_database_cluster.redis,
    kubernetes_namespace.staging
  ]
}

# Network Policy for Production namespace
resource "kubernetes_network_policy" "production" {
  metadata {
    name      = "production-network-policy"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  spec {
    pod_selector {}

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = "ingress-nginx"
          }
        }
      }
    }

    egress {
      # Allow DNS
      to {
        namespace_selector {
          match_labels = {
            name = "kube-system"
          }
        }
      }
      ports {
        port     = "53"
        protocol = "UDP"
      }
      ports {
        port     = "53"
        protocol = "TCP"
      }
    }

    egress {
      # Allow all outbound traffic
      to {}
    }
  }
}

# Resource Quotas for namespaces
resource "kubernetes_resource_quota" "production" {
  metadata {
    name      = "production-quota"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "4"
      "requests.memory" = "8Gi"
      "limits.cpu"      = "8"
      "limits.memory"   = "16Gi"
      "persistentvolumeclaims" = "10"
    }
  }
}

resource "kubernetes_resource_quota" "staging" {
  metadata {
    name      = "staging-quota"
    namespace = kubernetes_namespace.staging.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "2"
      "requests.memory" = "4Gi"
      "limits.cpu"      = "4"
      "limits.memory"   = "8Gi"
      "persistentvolumeclaims" = "5"
    }
  }
}