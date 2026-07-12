locals {
  all_domain_names = concat([var.domain_name], var.alternate_domain_names)
  bucket_name      = coalesce(var.bucket_name, "${replace(var.domain_name, ".", "-")}-static-site")
  s3_origin_id     = "s3-${local.bucket_name}"
}
