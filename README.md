# mrembiasz-site

Very simple personal landing page for Mateusz Rembiasz.

## Files

- `src/pages/index.astro` contains the page content.
- `src/styles/global.css` contains the page styling.
- `astro.config.mjs` contains the Astro build configuration.
- `infra/aws-static-site` contains the AWS static hosting Terraform.

## Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Build the static production files:

```bash
npm run build
```

## AWS static hosting

This site can be hosted as static HTML with:

```text
Cloudflare DNS that you configure manually
        -> CloudFront
        -> private S3 bucket
```

Terraform for the AWS side lives in `infra/aws-static-site`.

Required local tools:

- Terraform
- AWS CLI
- AWS credentials with permissions for S3, CloudFront, ACM, and IAM policy documents

Create your variables file:

```bash
cp infra/aws-static-site/terraform.tfvars.example infra/aws-static-site/terraform.tfvars
```

Edit `infra/aws-static-site/terraform.tfvars` if you need a different domain,
alternate names, AWS region, bucket name, or tags.

Initialize Terraform:

```bash
terraform -chdir=infra/aws-static-site init
```

Create the ACM certificate first:

```bash
terraform -chdir=infra/aws-static-site apply -target=aws_acm_certificate.site
```

Print the ACM validation records:

```bash
terraform -chdir=infra/aws-static-site output acm_validation_records
```

Add those CNAME records in Cloudflare yourself. After ACM shows the certificate
as issued, create the rest of the AWS infrastructure:

```bash
terraform -chdir=infra/aws-static-site apply
```

Print the CloudFront hostname:

```bash
terraform -chdir=infra/aws-static-site output cloudfront_domain_name
```

Point your Cloudflare DNS record at that CloudFront hostname.

Deploy the current static files:

```bash
scripts/deploy-static-site.sh
```

The deploy script builds the Astro site and syncs `dist/` to S3.
HTML is uploaded with `Cache-Control: public, max-age=60`; non-HTML build
assets are uploaded with `Cache-Control: public, max-age=31536000, immutable`.

## Container

Build the static Nginx image:

```bash
docker build -t mrembiasz-site .
```

Run it locally:

```bash
docker run --rm -p 8080:80 mrembiasz-site
```

Then open `http://localhost:8080`.

## CI

The GitLab container build job is currently disabled while production deploys
are handled manually through `scripts/deploy-static-site.sh`.
