# Firewall for Kubernetes cluster
resource "digitalocean_firewall" "k8s_firewall" {
  name = "${var.project_name}-k8s-firewall-${var.environment}"

  tags = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]

  # Allow inbound traffic from Load Balancer
  inbound_rule {
    protocol         = "tcp"
    port_range       = "30000-32767"
    source_tags      = ["loadbalancer"]
  }

  # Allow internal cluster communication
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_tags      = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "1-65535"
    source_tags      = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]
  }

  inbound_rule {
    protocol         = "icmp"
    source_tags      = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]
  }

  # Allow all outbound traffic
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Firewall for databases (PostgreSQL and Redis)
resource "digitalocean_firewall" "database_firewall" {
  name = "${var.project_name}-db-firewall-${var.environment}"

  tags = concat(
    values(var.common_tags),
    ["database-firewall"]
  )

  # Only allow connections from Kubernetes cluster nodes
  inbound_rule {
    protocol         = "tcp"
    port_range       = "5432"
    source_tags      = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "6379"
    source_tags      = ["k8s:${digitalocean_kubernetes_cluster.portfolio_cluster.id}"]
  }

  # Allow health checks from DO
  inbound_rule {
    protocol         = "tcp"
    port_range       = "5432"
    source_addresses = ["192.168.0.0/16"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "6379"
    source_addresses = ["192.168.0.0/16"]
  }

  # Allow all outbound traffic
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}