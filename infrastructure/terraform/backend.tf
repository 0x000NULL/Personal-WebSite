# Terraform backend configuration
# For production use, consider using DigitalOcean Spaces for remote state storage

# Example remote backend configuration (uncomment and configure):
# terraform {
#   backend "s3" {
#     endpoint                    = "https://nyc3.digitaloceanspaces.com"
#     region                      = "us-east-1" # Required but unused for DO Spaces
#     key                         = "terraform/portfolio/terraform.tfstate"
#     bucket                      = "your-spaces-bucket-name"
#     skip_credentials_validation = true
#     skip_metadata_api_check     = true
#   }
# }

# For now, using local backend (default)
# State file will be stored locally in terraform.tfstate