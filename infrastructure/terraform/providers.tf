terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

provider "kubernetes" {
  host  = digitalocean_kubernetes_cluster.portfolio_cluster.endpoint
  token = digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].token
  cluster_ca_certificate = base64decode(
    digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].cluster_ca_certificate
  )
}

provider "helm" {
  kubernetes {
    host  = digitalocean_kubernetes_cluster.portfolio_cluster.endpoint
    token = digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].token
    cluster_ca_certificate = base64decode(
      digitalocean_kubernetes_cluster.portfolio_cluster.kube_config[0].cluster_ca_certificate
    )
  }
}