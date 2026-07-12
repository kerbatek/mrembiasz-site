variable "domain_name" {
  description = "Primary domain served by CloudFront."
  type        = string
}

variable "alternate_domain_names" {
  description = "Additional DNS names served by the same CloudFront distribution."
  type        = list(string)
  default     = []
}

variable "aws_region" {
  description = "AWS region for the private S3 origin bucket."
  type        = string
  default     = "eu-central-1"
}

variable "bucket_name" {
  description = "Optional globally unique S3 bucket name. Defaults to a normalized domain-based name."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront edge price class."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Tags applied to AWS resources that support tags."
  type        = map(string)
  default = {
    Project = "mrembiasz-site"
  }
}
