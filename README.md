# MBTA Savant

Baseball-Savant-style stats for MBTA vehicles, served at savant.labs.transitmatters.org.

- `pipeline/` - Python data pipeline (`savant` package, managed with `uv`).
- `web/` - Vite + React + TypeScript site.
- `docs/` - design doc and implementation plan.

## Development

```sh
cd pipeline && uv sync && uv run pytest -q   # always use `uv run` (botocore[crt] is in the env)
cd web && npm install && npm run build       # Node >= 22.12
```

## Operations

One-time bootstrap:

1. Deploy the stack with `./deploy.sh` using the `transitmatters` AWS profile (after approval).
2. Set GitHub repo secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `TM_LABS_WILDCARD_CERT_ARN`.
3. IAM for the nightly user: `s3:GetObject` + `s3:ListBucket` on `tm-mbta-performance`;
   Get/Put/List/Delete on the site bucket; `cloudfront:ListDistributions` + `cloudfront:CreateInvalidation`.
4. Run the full backfill locally:
   `cd pipeline && uv run savant backfill --start 2025-01-01 --end <yesterday> --workers 5 --root ../work`
5. Upload segments: `aws s3 sync work/segments s3://savant.labs.transitmatters.org/segments`
6. Trigger the nightly workflow once via `workflow_dispatch`.

The nightly job re-ingests a rolling 3-day window (D-2..D) and rebuilds all stats.

After any re-backfill or segment-logic change, re-upload segments and bump the cache key
`segments-vN-` in `.github/workflows/nightly.yml`.

Bus segments built before 2026-11-18 (bus number normalization, routes 34E/708) must be
re-backfilled with `--groups bus --force`.
