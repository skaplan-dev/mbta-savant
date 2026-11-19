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

Raw data is the MBTA's public LAMP files (performancedata.mbta.com).
Subway has one file per service date; bus is one history file starting 2025-12-25.

The nightly job re-ingests a rolling 3-day window (D-2..D) and rebuilds all stats.
