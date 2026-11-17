# MBTA Savant

Baseball-Savant-style stats for MBTA vehicles.

- `pipeline/` - Python data pipeline (`savant` package, managed with `uv`).
- `web/` - Vite + React + TypeScript site.
- `docs/` - design doc and implementation plan.

## Development

```sh
cd pipeline && uv sync && uv run pytest -q
cd web && npm install && npm run build
```
