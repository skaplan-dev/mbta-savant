#!/bin/bash -x

set -e

export AWS_PROFILE=${AWS_PROFILE:-transitmatters}
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1
export AWS_PAGER=""

if [[ -z "$TM_LABS_WILDCARD_CERT_ARN" ]]; then
    echo "Must provide TM_LABS_WILDCARD_CERT_ARN in environment" 1>&2
    exit 1
fi

STACK_NAME=savant-labs

FRONTEND_HOSTNAME="savant.labs.transitmatters.org"
FRONTEND_ZONE="labs.transitmatters.org"
FRONTEND_BUCKET="$FRONTEND_HOSTNAME"
FRONTEND_CERT_ARN="$TM_LABS_WILDCARD_CERT_ARN"

GIT_VERSION=`git describe --tags --always`
echo "Deploying version $GIT_VERSION"

(cd web && npm ci && npm run build)

echo "Deploying CloudFront infrastructure..."
aws cloudformation deploy --template-file cloudformation.json --stack-name $STACK_NAME --no-fail-on-empty-changeset \
    --tags service=mbta-savant env=prod team=tm-labs \
    --parameter-overrides \
    TMFrontendHostname=$FRONTEND_HOSTNAME \
    TMFrontendZone=$FRONTEND_ZONE \
    TMFrontendCertArn=$FRONTEND_CERT_ARN

# data/ and segments/ are owned by the nightly pipeline; never delete them here.
echo "Syncing built files to S3 bucket: $FRONTEND_BUCKET"
aws s3 sync web/dist/ s3://$FRONTEND_BUCKET --delete \
    --exclude "data/*" --exclude "segments/*" \
    --cache-control "public, max-age=31536000, immutable"
aws s3 cp web/dist/index.html s3://$FRONTEND_BUCKET/index.html \
    --cache-control "no-cache, must-revalidate"

echo "Invalidating CloudFront cache for: $FRONTEND_HOSTNAME"
CLOUDFRONT_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items!=null] | [?contains(Aliases.Items, '$FRONTEND_HOSTNAME')].Id | [0]" --output text)
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"

echo "Deployment completed successfully!"
