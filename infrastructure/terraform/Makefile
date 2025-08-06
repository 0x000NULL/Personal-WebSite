# Makefile for Terraform Infrastructure Management

.PHONY: help init validate plan apply destroy output kubeconfig login-registry cost clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make init          - Initialize Terraform"
	@echo "  make validate      - Validate Terraform configuration"
	@echo "  make plan          - Create Terraform plan"
	@echo "  make apply         - Apply Terraform configuration"
	@echo "  make destroy       - Destroy all infrastructure"
	@echo "  make output        - Show Terraform outputs"
	@echo "  make kubeconfig    - Configure kubectl access"
	@echo "  make login-registry - Login to container registry"
	@echo "  make cost          - Show estimated costs"
	@echo "  make clean         - Clean local files"

# Initialize Terraform
init:
	@echo "Initializing Terraform..."
	terraform init

# Validate configuration
validate: init
	@echo "Validating Terraform configuration..."
	terraform validate

# Create plan
plan: validate
	@echo "Creating Terraform plan..."
	terraform plan -out=tfplan

# Apply configuration
apply:
	@echo "Applying Terraform configuration..."
	@if [ -f tfplan ]; then \
		terraform apply tfplan; \
		rm -f tfplan; \
	else \
		terraform apply; \
	fi

# Destroy infrastructure
destroy:
	@echo "WARNING: This will destroy all infrastructure!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	terraform destroy

# Show outputs
output:
	@terraform output

# Configure kubectl
kubeconfig:
	@echo "Configuring kubectl..."
	@CLUSTER_NAME=$$(terraform output -raw cluster_id 2>/dev/null); \
	if [ -z "$$CLUSTER_NAME" ]; then \
		echo "Error: Cluster not found. Run 'make apply' first."; \
		exit 1; \
	fi; \
	doctl kubernetes cluster kubeconfig save $$CLUSTER_NAME --set-current-context
	@echo "Kubectl configured. Testing connection..."
	@kubectl cluster-info

# Login to container registry
login-registry:
	@echo "Logging into DigitalOcean Container Registry..."
	@doctl registry login
	@echo "Registry URL: $$(terraform output -raw registry_server_url 2>/dev/null || echo 'Not available')"

# Show cost estimation
cost:
	@echo "Estimated Monthly Costs:"
	@echo "========================"
	@terraform output -json estimated_monthly_cost 2>/dev/null | jq -r 'to_entries | .[] | "\(.key): \(.value)"' || echo "Run 'make apply' first to see costs"

# Clean local files
clean:
	@echo "Cleaning local files..."
	rm -rf .terraform/
	rm -f .terraform.lock.hcl
	rm -f terraform.tfstate*
	rm -f tfplan
	rm -f outputs.json
	rm -f kubeconfig
	@echo "Clean complete. Run 'make init' to reinitialize."

# Advanced targets
.PHONY: fmt lint graph state-list import

# Format Terraform files
fmt:
	@echo "Formatting Terraform files..."
	terraform fmt -recursive

# Lint configuration (requires tflint)
lint: validate
	@if command -v tflint >/dev/null 2>&1; then \
		echo "Running tflint..."; \
		tflint; \
	else \
		echo "tflint not installed. Install from: https://github.com/terraform-linters/tflint"; \
	fi

# Generate resource graph
graph:
	@echo "Generating infrastructure graph..."
	terraform graph | dot -Tpng > infrastructure-graph.png
	@echo "Graph saved to infrastructure-graph.png"

# List resources in state
state-list:
	@terraform state list

# Import existing resource (usage: make import RESOURCE=digitalocean_droplet.example ID=12345)
import:
	@if [ -z "$(RESOURCE)" ] || [ -z "$(ID)" ]; then \
		echo "Usage: make import RESOURCE=<resource_type.name> ID=<resource_id>"; \
		exit 1; \
	fi
	terraform import $(RESOURCE) $(ID)