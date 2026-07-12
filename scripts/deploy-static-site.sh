#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${ROOT_DIR}/infra/aws-static-site"

BUCKET_NAME="$(terraform -chdir="${TERRAFORM_DIR}" output -raw s3_bucket_name)"
DISTRIBUTION_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw cloudfront_distribution_id)"

aws s3 sync "${ROOT_DIR}" "s3://${BUCKET_NAME}" \
  --delete \
  --exclude "*" \
  --include "index.html" \
  --include "styles.css" \
  --cache-control "public, max-age=300"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"
