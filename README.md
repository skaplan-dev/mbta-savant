# MBTA Savant

Baseball-Savant-style stats for MBTA vehicles, served from S3 + CloudFront.

- `pipeline/` - Python data pipeline (`savant` package, managed with `uv`).
- `web/` - Vite + React + TypeScript site.

## Development

```sh
cd pipeline && uv sync && uv run pytest -q   # always use `uv run`
cd web && npm install && npm run build       # Node >= 22.12
```

## Operations

Raw data is the MBTA's public LAMP files (performancedata.mbta.com), read over HTTPS with no credentials.
Subway has one file per service date; bus is one history file starting 2025-12-25.

One-time bootstrap, in the AWS account that will host the site:

1. `AWS_PROFILE=<profile> ./deploy.sh` creates the stack (private S3 bucket, CloudFront with Origin
   Access Control) and publishes the site at the `*.cloudfront.net` address it prints. For a custom
   domain, also set `SITE_HOSTNAME`, `HOSTED_ZONE` (a Route 53 zone in the account) and `CERTIFICATE_ARN`
   (an ACM certificate in us-east-1 covering the hostname).
2. Backfill locally (about 2 s per day for rail and bus together):
   `cd pipeline && uv run savant backfill --start 2025-01-01 --end <yesterday> --workers 5 --root ../work`
   (bus has no data before 2025-12-25; those days simply produce no bus segments).
3. Upload segments and data:
   `aws s3 sync work/segments s3://<bucket>/segments`, then
   `uv run savant build --root ../work --out ../out && aws s3 sync out/data s3://<bucket>/data`.
4. GitHub repo secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` for an IAM user that can use
   CloudFormation, the site bucket and CloudFront (nightly itself only needs the bucket and
   `cloudfront:CreateInvalidation`). Repo variables `SAVANT_BUCKET` and `SAVANT_DISTRIBUTION_ID` come
   from the stack's `S3BucketName` and `CloudFrontDistributionId` outputs; set `SITE_HOSTNAME`,
   `HOSTED_ZONE` and `CERTIFICATE_ARN` only for a custom domain.
5. Trigger the nightly workflow once via `workflow_dispatch`.

The nightly job re-ingests a rolling 3-day window (D-2..D) and rebuilds all stats.

After any re-backfill or segment-logic change, re-upload segments and bump the cache key
`segments-vN-` in `.github/workflows/nightly.yml`. Segments built before this switch to the public LAMP
files came from TransitMatters' raw events, so a new account should backfill from scratch rather than
mix the two.
