#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${ROOT_DIR}/infra/aws-static-site"
TODO_TERRAFORM_DIR="${ROOT_DIR}/infra/aws-personal-todo"
DIST_DIR="${ROOT_DIR}/dist"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-https://mrembiasz.pl}"

BUCKET_NAME="$(terraform -chdir="${TERRAFORM_DIR}" output -raw s3_bucket_name)"
DISTRIBUTION_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw cloudfront_distribution_id)"

export PUBLIC_TODO_API_BASE_URL="${PUBLIC_TODO_API_BASE_URL:-$(terraform -chdir="${TODO_TERRAFORM_DIR}" output -raw api_endpoint)}"
export PUBLIC_TODO_COGNITO_DOMAIN="${PUBLIC_TODO_COGNITO_DOMAIN:-$(terraform -chdir="${TODO_TERRAFORM_DIR}" output -raw cognito_hosted_ui_base_url)}"
export PUBLIC_TODO_COGNITO_CLIENT_ID="${PUBLIC_TODO_COGNITO_CLIENT_ID:-$(terraform -chdir="${TODO_TERRAFORM_DIR}" output -raw cognito_user_pool_client_id)}"
export PUBLIC_TODO_COGNITO_REDIRECT_URI="${PUBLIC_TODO_COGNITO_REDIRECT_URI:-${PUBLIC_SITE_URL%/}/todo/}"
export PUBLIC_TODO_COGNITO_LOGOUT_URI="${PUBLIC_TODO_COGNITO_LOGOUT_URI:-${PUBLIC_SITE_URL%/}/todo/}"

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
