#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${ROOT_DIR}/infra/aws-static-site"
DIST_DIR="${ROOT_DIR}/dist"

BUCKET_NAME="$(terraform -chdir="${TERRAFORM_DIR}" output -raw s3_bucket_name)"
DISTRIBUTION_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw cloudfront_distribution_id)"

npm run build

aws s3 sync "${DIST_DIR}" "s3://${BUCKET_NAME}" \
  --delete \
  --exclude "*.html" \
  --cache-control "public, max-age=31536000, immutable"

aws s3 sync "${DIST_DIR}" "s3://${BUCKET_NAME}" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "public, max-age=60" \
  --content-type "text/html; charset=utf-8"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*"
