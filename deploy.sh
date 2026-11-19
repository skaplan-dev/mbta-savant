#!/bin/bash
# Deploys the site to whichever AWS account the active profile points at.
#
#   AWS_PROFILE=seth ./deploy.sh                      # CloudFront's own *.cloudfront.net address
#   AWS_PROFILE=seth SITE_HOSTNAME=savant.example.com HOSTED_ZONE=example.com \
#       CERTIFICATE_ARN=arn:aws:acm:us-east-1:... ./deploy.sh   # custom domain
#   EXTRA_HOSTNAME=www.example.com                     # optional second name on the same cert
set -euo pipefail

export AWS_REGION=${AWS_REGION:-us-east-1}
export AWS_DEFAULT_REGION=$AWS_REGION
export AWS_PAGER=""

STACK_NAME=${STACK_NAME:-mbta-savant}

if [[ -n "${SITE_HOSTNAME:-}" ]]; then
    : "${HOSTED_ZONE:?HOSTED_ZONE is required with SITE_HOSTNAME}"
    : "${CERTIFICATE_ARN:?CERTIFICATE_ARN is required with SITE_HOSTNAME}"
    DOMAIN_PARAMS="Hostname=$SITE_HOSTNAME HostedZoneName=$HOSTED_ZONE CertificateArn=$CERTIFICATE_ARN ExtraHostname=${EXTRA_HOSTNAME:-}"
else
    DOMAIN_PARAMS="Hostname= HostedZoneName= CertificateArn= ExtraHostname="
fi

echo "Deploying to account $(aws sts get-caller-identity --query Account --output text) as stack $STACK_NAME"

(cd web && npm ci && npm run build)

echo "Deploying infrastructure..."
# shellcheck disable=SC2086
aws cloudformation deploy --template-file cloudformation.json --stack-name "$STACK_NAME" \
    --no-fail-on-empty-changeset --tags service=mbta-savant env=prod \
    --parameter-overrides $DOMAIN_PARAMS

output() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
        --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" --output text
}
BUCKET=$(output S3BucketName)
DISTRIBUTION_ID=$(output CloudFrontDistributionId)

# data/ and segments/ are owned by the nightly pipeline, and pages/ is regenerated below; never delete them here.
echo "Syncing built files to s3://$BUCKET"
aws s3 sync web/dist/ "s3://$BUCKET" --delete \
    --exclude "data/*" --exclude "segments/*" --exclude "pages/*" \
    --cache-control "public, max-age=31536000, immutable"
aws s3 cp web/dist/index.html "s3://$BUCKET/index.html" \
    --cache-control "no-cache, must-revalidate"

# Per-page HTML for crawlers and link previews (see pipeline/savant/pages.py): rebuilt from the new
# index.html, since the old copies point at asset files the sync above just deleted.
if [[ -n "${SITE_HOSTNAME:-}" ]]; then
    echo "Writing per-page HTML"
    PAGES_TMP=$(mktemp -d)
    aws s3 sync "s3://$BUCKET/data" "$PAGES_TMP/data" --exclude "*" \
        --include "meta.json" --include "*/index.json" --only-show-errors
    (cd pipeline && uv run --frozen savant pages --template ../web/dist/index.html \
        --data "$PAGES_TMP/data" --out "$PAGES_TMP/pages" --host "$SITE_HOSTNAME")
    aws s3 sync "$PAGES_TMP/pages" "s3://$BUCKET/pages" --delete --only-show-errors \
        --cache-control "no-cache, must-revalidate"
    rm -rf "$PAGES_TMP"
fi

echo "Invalidating CloudFront cache"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"

echo "Deployment completed: $(output WebsiteURL)"
