variable "do_token" {
  description = "DigitalOcean API Token"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "environment" {
  description = "Environment name (production, staging, etc)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "portfolio"
}

# Kubernetes Cluster Variables
variable "k8s_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.29.1-do.0"
}

variable "node_pool_size" {
  description = "Number of nodes in the cluster"
  type        = number
  default     = 3
}

variable "node_pool_droplet_size" {
  description = "Droplet size for Kubernetes nodes"
  type        = string
  default     = "s-2vcpu-4gb" # $48/month per node
}

variable "node_pool_min_nodes" {
  description = "Minimum number of nodes for autoscaling"
  type        = number
  default     = 3
}

variable "node_pool_max_nodes" {
  description = "Maximum number of nodes for autoscaling"
  type        = number
  default     = 5
}

# Database Variables
variable "db_size" {
  description = "Database droplet size"
  type        = string
  default     = "db-s-1vcpu-1gb" # $15/month
}

variable "db_node_count" {
  description = "Number of database nodes"
  type        = number
  default     = 1
}

variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

# Redis Variables
variable "redis_size" {
  description = "Redis node size"
  type        = string
  default     = "db-s-1vcpu-1gb" # $15/month
}

variable "redis_node_count" {
  description = "Number of Redis nodes"
  type        = number
  default     = 1
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"
}

# Container Registry Variables
variable "registry_subscription_tier" {
  description = "Container registry subscription tier"
  type        = string
  default     = "basic" # $5/month
}

# Monitoring Variables
variable "enable_monitoring" {
  description = "Enable monitoring stack"
  type        = bool
  default     = true
}

# Common Tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "portfolio"
    ManagedBy   = "terraform"
    Environment = "production"
  }
}