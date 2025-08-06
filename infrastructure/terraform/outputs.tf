output "cluster_id" {
  description = "ID of the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.portfolio_cluster.id
}

output "cluster_endpoint" {
  description = "Endpoint for the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.portfolio_cluster.endpoint
  sensitive   = true
}

output "cluster_token" {
  description = "Token for the Kubernetes cluster"
  value       = digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].token
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "CA certificate for the Kubernetes cluster"
  value       = base64decode(digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].cluster_ca_certificate)
  sensitive   = true
}

output "registry_endpoint" {
  description = "Endpoint for the container registry"
  value       = digitalocean_container_registry.portfolio.endpoint
}

output "registry_server_url" {
  description = "Server URL for the container registry"
  value       = digitalocean_container_registry.portfolio.server_url
}

output "load_balancer_ip" {
  description = "IP address of the load balancer"
  value       = digitalocean_loadbalancer.portfolio_lb.ip
}

output "load_balancer_urn" {
  description = "URN of the load balancer"
  value       = digitalocean_loadbalancer.portfolio_lb.urn
}

output "postgres_host" {
  description = "Private hostname for PostgreSQL cluster"
  value       = digitalocean_database_cluster.postgres.private_host
  sensitive   = true
}

output "postgres_port" {
  description = "Port for PostgreSQL cluster"
  value       = digitalocean_database_cluster.postgres.port
}

output "postgres_database" {
  description = "Database name"
  value       = digitalocean_database_db.portfolio_db.name
}

output "postgres_user" {
  description = "Database username"
  value       = digitalocean_database_user.portfolio_user.name
}

output "postgres_password" {
  description = "Database password"
  value       = digitalocean_database_user.portfolio_user.password
  sensitive   = true
}

output "postgres_connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${digitalocean_database_user.portfolio_user.name}:${digitalocean_database_user.portfolio_user.password}@${digitalocean_database_cluster.postgres.private_host}:${digitalocean_database_cluster.postgres.port}/${digitalocean_database_db.portfolio_db.name}?sslmode=require"
  sensitive   = true
}

output "redis_host" {
  description = "Private hostname for Redis cluster"
  value       = digitalocean_database_cluster.redis.private_host
  sensitive   = true
}

output "redis_port" {
  description = "Port for Redis cluster"
  value       = digitalocean_database_cluster.redis.port
}

output "redis_password" {
  description = "Redis password"
  value       = digitalocean_database_cluster.redis.password
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string"
  value       = "redis://default:${digitalocean_database_cluster.redis.password}@${digitalocean_database_cluster.redis.private_host}:${digitalocean_database_cluster.redis.port}"
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = digitalocean_vpc.portfolio_vpc.id
}

output "vpc_ip_range" {
  description = "IP range of the VPC"
  value       = digitalocean_vpc.portfolio_vpc.ip_range
}

output "project_id" {
  description = "ID of the DigitalOcean project"
  value       = digitalocean_project.portfolio.id
}

output "namespaces" {
  description = "Created Kubernetes namespaces"
  value = {
    production = kubernetes_namespace.production.metadata[0].name
    staging    = kubernetes_namespace.staging.metadata[0].name
    monitoring = kubernetes_namespace.monitoring.metadata[0].name
  }
}

output "estimated_monthly_cost" {
  description = "Estimated monthly cost for the infrastructure"
  value = {
    kubernetes_cluster = "$144/month (3 nodes x $48)"
    load_balancer      = "$12/month"
    container_registry = "$5/month"
    postgres_database  = "$15/month"
    redis_database     = "$15/month"
    total              = "$191/month"
    note               = "Actual costs may vary based on usage, data transfer, and storage"
  }
}