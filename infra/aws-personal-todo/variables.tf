variable "aws_region" {
  description = "AWS region for the todo API resources."
  type        = string
  default     = "eu-central-1"
}

variable "name_prefix" {
  description = "Prefix used for todo API resource names."
  type        = string
  default     = "mrembiasz-todo"
}

variable "lambda_runtime" {
  description = "Python runtime used by the todo Lambda."
  type        = string
  default     = "python3.12"
}

variable "allowed_origins" {
  description = "Browser origins allowed to call the todo API."
  type        = list(string)
  default     = ["http://localhost:4321", "http://127.0.0.1:4321"]
}

variable "cognito_callback_urls" {
  description = "Allowed callback URLs for the Cognito app client."
  type        = list(string)
  default     = ["http://localhost:4321/todo/", "http://127.0.0.1:4321/todo/"]
}

variable "cognito_logout_urls" {
  description = "Allowed logout URLs for the Cognito app client."
  type        = list(string)
  default     = ["http://localhost:4321/todo/", "http://127.0.0.1:4321/todo/"]
}

variable "cognito_domain_prefix" {
  description = "Optional Cognito hosted UI domain prefix. Must be globally unique in the AWS region."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags applied to AWS resources that support tags."
  type        = map(string)
  default = {
    Project = "mrembiasz-site"
    App     = "personal-todo"
  }
}
