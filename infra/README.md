# Near Me Production Deployment (Docker Compose)

This directory contains the production Docker Compose stack for the Near Me backend API and supporting services.

Components:
- Nginx reverse proxy (`infra/nginx/nginx.conf`)
- Backend API container (built from `backend/Dockerfile`)
- PostgreSQL 15
- Redis 7

## Prerequisites
- A Linux server with Docker and Docker Compose v2
- A domain pointing to your server (optional, for TLS)
- GitHub Container Registry (GHCR) access to pull the image

## CI/CD Overview
The GitHub Actions workflow `/.github/workflows/backend-cd.yml`:
- Builds and pushes the backend Docker image to GHCR on pushes to `main`
- Optionally deploys to your server over SSH (if you set required secrets)

### Required GitHub Secrets for deployment
- `SSH_HOST`: Server IP or hostname
- `SSH_USER`: SSH username
- `SSH_KEY`: SSH private key (PEM content)
- `SSH_PORT` (optional): SSH port, defaults to `22`
- `DEPLOY_PATH` (optional): Remote deploy path, defaults to `~/nearme`

## One-time Server Setup
1. Create the deployment directory (if not using the workflow to sync files):
   ```bash
   mkdir -p ~/nearme
   ```
2. Ensure these files are present on the server (the workflow copies them automatically):
   - `infra/docker-compose.prod.yml`
   - `infra/nginx/nginx.conf`
   - `database/init/` (SQL init scripts)
   - `backend/.env.production.example` (reference)

3. Create environment file: `backend.env`
   - On the server at `~/nearme/`, create a file named `backend.env`.
   - Use `backend/.env.production.example` as a template and fill in production values.
   - This env file will be used by `docker compose` via `--env-file backend.env`.

### Minimum variables to set in `backend.env`
- `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- External API keys for POI providers
- APNs and FCM credentials

## Deploy
Using the GitHub Actions workflow (recommended):
- Push to `main`. The workflow builds, pushes `latest`, and deploys using the compose file.
- The deployment step logs into GHCR and runs:
  ```bash
  GHCR_OWNER=<org-or-user> VERSION=latest docker compose -f infra/docker-compose.prod.yml --env-file backend.env up -d
  ```

Manual deploy from the server:
```bash
cd ~/nearme
# Login to GHCR
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
# Pull and start
GHCR_OWNER=<org-or-user> VERSION=latest docker compose -f infra/docker-compose.prod.yml --env-file backend.env pull
GHCR_OWNER=<org-or-user> VERSION=latest docker compose -f infra/docker-compose.prod.yml --env-file backend.env up -d
```

## Access
- Nginx listens on port 80
- API is available at `http://<server>/api/`
- Healthcheck: `http://<server>/healthz` (Nginx) and `http://<server>/api/health` (API)

## Scaling
- For basic scaling on a single host, you can increase replicas of the `api` using Docker Compose profiles or multiple containers behind Nginx upstream. Example:
  ```yaml
  # in docker-compose.prod.yml (advanced):
  # scale api replicas by running multiple containers and updating upstream to point to them.
  ```
- For horizontal scaling, consider migrating to Kubernetes or a managed PaaS.

## Monitoring & Logs
- Nginx logs are in the container at `/var/log/nginx/`
- The API logs to stdout by default (captured by `docker logs`). If you set `LOG_FILE`, ensure the directory exists or bind mount a host directory.
- Suggested next steps:
  - Add a log shipper (e.g., Loki+Promtail, ELK)
  - Add metrics via Prometheus + Grafana

## Backups
- PostgreSQL volume `postgres_data` persists data. Use regular `pg_dump` backups and store offsite.
- Redis `redis_data` persists AOF. For production, consider a managed Redis or configure RDB/AOF backups.

## Rollback
- Tag images with versions and deploy a previous tag by setting `VERSION`:
  ```bash
  GHCR_OWNER=<org-or-user> VERSION=v1.2.3 docker compose -f infra/docker-compose.prod.yml --env-file backend.env up -d
  ```
- The provided workflow deploys `latest` by default; you can also dispatch the workflow with a specific tag if you add inputs.

## Security Notes
- Nginx includes basic security headers and simple rate limiting.
- Terminate TLS at Nginx for production (update ports and add certs via `certbot` or file mounts).
- The API runs as non-root (`USER node`) in the container.
- Restrict database and redis network access to the internal network; expose only Nginx to the public internet.
