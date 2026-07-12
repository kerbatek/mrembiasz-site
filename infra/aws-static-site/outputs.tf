output "s3_bucket_name" {
  description = "S3 bucket that stores the static site assets."
  value       = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID used for cache invalidations."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "site_urls" {
  description = "HTTPS URLs served by CloudFront."
  value       = [for name in local.all_domain_names : "https://${name}"]
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN for the CloudFront distribution."
  value       = aws_acm_certificate.site.arn
}

output "acm_validation_records" {
  description = "DNS CNAME records to create manually before CloudFront can use the ACM certificate."
  value = {
    for option in aws_acm_certificate.site.domain_validation_options :
    option.domain_name => {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  }
}
