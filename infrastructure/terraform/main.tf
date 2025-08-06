# DigitalOcean Project
resource "digitalocean_project" "portfolio" {
  name        = "${var.project_name}-${var.environment}"
  description = "Portfolio website infrastructure"
  purpose     = "Web Application"
  environment = var.environment
  resources = concat(
    [digitalocean_kubernetes_cluster.portfolio_cluster.urn],
    [digitalocean_database_cluster.postgres.urn],
    [digitalocean_database_cluster.redis.urn],
    [digitalocean_container_registry.portfolio.urn],
    [digitalocean_loadbalancer.portfolio_lb.urn]
  )
}

# VPC for network isolation
resource "digitalocean_vpc" "portfolio_vpc" {
  name     = "${var.project_name}-vpc-${var.environment}"
  region   = var.region
  ip_range = "10.10.0.0/16"
}

# Kubernetes Cluster
resource "digitalocean_kubernetes_cluster" "portfolio_cluster" {
  name    = "${var.project_name}-k8s-${var.environment}"
  region  = var.region
  version = var.k8s_version
  vpc_uuid = digitalocean_vpc.portfolio_vpc.id

  # Enable high availability control plane for production
  ha = var.environment == "production" ? true : false

  # Auto-upgrade for patch versions only
  auto_upgrade = true
  surge_upgrade = true

  maintenance_policy {
    start_time = "04:00"
    day        = "sunday"
  }

  node_pool {
    name       = "${var.project_name}-pool-${var.environment}"
    size       = var.node_pool_droplet_size
    node_count = var.node_pool_size
    auto_scale = true
    min_nodes  = var.node_pool_min_nodes
    max_nodes  = var.node_pool_max_nodes

    labels = {
      environment = var.environment
      project     = var.project_name
    }

    tags = concat(
      values(var.common_tags),
      ["k8s-node", var.environment]
    )
  }

  tags = concat(
    values(var.common_tags),
    ["k8s-cluster", var.environment]
  )
}

# Container Registry
resource "digitalocean_container_registry" "portfolio" {
  name                   = "${var.project_name}registry${var.environment}"
  subscription_tier_slug = var.registry_subscription_tier
  region                 = var.region
}

resource "digitalocean_container_registry_docker_credentials" "portfolio" {
  registry_name = digitalocean_container_registry.portfolio.name
}

# PostgreSQL Database Cluster
resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.project_name}-postgres-${var.environment}"
  engine     = "pg"
  version    = var.postgres_version
  size       = var.db_size
  region     = var.region
  node_count = var.db_node_count
  
  private_network_uuid = digitalocean_vpc.portfolio_vpc.id

  maintenance_window {
    day  = "sunday"
    hour = "04:00:00"
  }

  tags = concat(
    values(var.common_tags),
    ["postgres", var.environment]
  )
}

# Create database
resource "digitalocean_database_db" "portfolio_db" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${var.project_name}_${var.environment}"
}

# Create database user
resource "digitalocean_database_user" "portfolio_user" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${var.project_name}_user"
}

# Redis Cluster
resource "digitalocean_database_cluster" "redis" {
  name       = "${var.project_name}-redis-${var.environment}"
  engine     = "redis"
  version    = var.redis_version
  size       = var.redis_size
  region     = var.region
  node_count = var.redis_node_count
  
  private_network_uuid = digitalocean_vpc.portfolio_vpc.id

  maintenance_window {
    day  = "sunday"
    hour = "04:00:00"
  }

  tags = concat(
    values(var.common_tags),
    ["redis", var.environment]
  )
}

# Load Balancer
resource "digitalocean_loadbalancer" "portfolio_lb" {
  name   = "${var.project_name}-lb-${var.environment}"
  region = var.region
  size   = "lb-small" # $12/month

  algorithm = "round_robin"
  
  vpc_uuid = digitalocean_vpc.portfolio_vpc.id

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 30080
    target_protocol = "http"
  }

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"

    target_port     = 30443
    target_protocol = "https"

    tls_passthrough = true
  }

  healthcheck {
    port     = 30080
    protocol = "http"
    path     = "/health"
  }

  droplet_tag = "k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"

  tags = concat(
    values(var.common_tags),
    ["loadbalancer", var.environment]
  )
}