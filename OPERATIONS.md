# Operations

## Configuration and startup

Copy `.env.example` to `.env`. The example database credentials are local-development defaults. Set a unique `SECRET_KEY` and valid persistent `ENCRYPTION_KEY`. With project Python dependencies installed, generate values locally:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Place the first value in `SECRET_KEY` and the second in `ENCRYPTION_KEY`. Keep both private and use the same values for API and worker. Changing the encryption key without migrating stored credentials makes existing RTSP sources unreadable.

For Docker-only setup, these commands can run using `docker compose run --rm --no-deps api python -c ...` after `docker compose build api`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_SYNC_URL` | Async API/migration and synchronous worker database connections for local execution |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Compose database configuration; Compose constructs container database URLs from these |
| `REDIS_URL` | Local Redis connection; Compose supplies its internal service URL |
| `SECRET_KEY`, `ENCRYPTION_KEY` | Signing and RTSP encryption keys |
| `YOLO_MODEL_PATH`, `YOLO_DEVICE` | Model path and inference device; CPU is the default |
| `EVIDENCE_DIR`, `UPLOAD_DIR` | Local storage paths; Compose mounts shared named volumes |
| `DEMO_VIDEO_PATH` | Server-controlled bundled demo path; Compose mounts `assets/demo` read-only at `/app/data/demo` for API and worker |
| `MAX_CAMERAS_PER_WORKER`, `FRAME_QUEUE_SIZE` | Worker capacity and bounded queue size |
| `CORS_ORIGINS` | Local application's permitted browser origins; Compose currently sets localhost:3000 |

The Compose file passes an explicit subset of settings into containers. Editing an unused variable in `.env` does not automatically pass it through; inspect `docker-compose.yml` when changing deployment settings.

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 api worker
```

The API Docker entrypoint runs `alembic upgrade head`. Register an account through `/register`; the bundled demo video is tracked directly in Git at `assets/demo/demo_feed.mp4` (about 203 KB), so no Git LFS or deployment-time download is required. The API and worker both see it at `/app/data/demo/demo_feed.mp4` through a shared read-only bind mount.

## Bundled Demo

After deployment:

1. Register an account and sign in.
2. Select **USE DEMO VIDEO** in Cameras (or **TRY THE DEMO** on the public landing page).
3. Start analytics for the created camera.
4. Open the live monitor.

The authenticated `POST /api/v1/cameras/demo` endpoint creates or returns the signed-in user's normal local-video camera. It selects the bundled file server-side and requires no uploaded path. Processing runs through the standard worker and camera model. No detections, events, analytics, or evidence are pre-seeded. Local video sources currently replay on EOF; the worker resets tracking, temporal analytics, PPE, and active event state at each replay boundary and resolves active events before starting the next pass.

**Model provisioning.** Compose runs the one-shot `model-init` service before starting the worker. It provisions the registry default `coco-yolov8n-onnx` artifact at `/app/models/yolov8n.onnx` in the persistent `model_data` named volume. The service uses the existing `scripts/export_onnx.py` path to export the official Ultralytics `yolov8n.pt` checkpoint with the registry's 640-pixel input, FP32, static shape, and ONNX opset 17. It validates ONNX structure, CPU load/inference, tensor shapes, and COCO class metadata before atomically publishing the file. A valid existing artifact is reused; an invalid one is regenerated without replacing it until the replacement validates. The API and worker continue to share the same volume, so existing valid manually provisioned volumes remain usable.

Internet access is required on the first boot of a fresh `model_data` volume (or when regeneration is needed), so Ultralytics can fetch its canonical `yolov8n.pt` asset. A volume that already contains a valid ONNX artifact needs no model download. No custom URL or user-provided remote artifact is used. If provisioning fails, the initializer exits nonzero with the model ID and cause, and Compose will not start the worker; restore connectivity or fix the artifact/source, then retry `docker compose up -d`.

To force regeneration while preserving the named volume, run from the repository root:

```bash
docker compose run --rm model-init python scripts/export_onnx.py \
  --model yolov8n.pt --output /app/models/yolov8n.onnx \
  --imgsz 640 --opset 17 --skip-if-valid --force --download-official-yolov8n
```

For production, use `docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm model-init ...` with the same arguments. The running worker keeps its already-loaded session; restart/recreate the worker after forced regeneration if it must load the newly generated file.

## Migrations

```bash
# Local environment
python -m alembic upgrade head
python -m alembic current

# Docker environment
docker compose exec api python -m alembic current
```

Review migrations and back up the database before applying changes to retained data. Do not use schema rollback as a substitute for a backup.

## Health and telemetry

- `GET /api/v1/system/health` reports database and Redis state. Inspect its JSON `status`: a degraded response can still have HTTP 200.
- Authenticated `GET /api/v1/system/metrics` returns JSON worker/CPU/memory/active-stream observations, not Prometheus text.
- API `/metrics` serves Prometheus process metrics when available.
- The worker starts a Prometheus listener on port `8001`; Compose does not publish this port to the host by default.

Missing worker observations should be treated as unavailable, not zero load. Healthcheck process success alone does not prove a video is being processed.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| Services fail to start | Inspect Compose logs, database connectivity, available ports, and model downloads |
| RTSP fails | Validate source reachability from the worker network and configure a valid encryption key |
| No preview or events | Confirm a video is uploaded, analytics are running, the worker is healthy, and the rule matches observed classes/geometry |
| Old frames or missed transitions | Review dropped-frame counts, queue capacity, resolution, and detector runtime |
| Webcam unavailable in Docker | Verify host device access; local worker execution may be needed, especially on Docker Desktop |
| Evidence missing | Inspect storage permissions, disk space, and shared API/worker volume configuration |

## Storage, backups, and shutdown

Back up PostgreSQL together with evidence files and the persistent encryption key using secure storage. A database-only backup cannot restore snapshot content. Uploaded videos, evidence, and weights are excluded from Git.

No automated evidence-retention policy is implemented. Do not blindly delete snapshots that retained event metadata still references.

```bash
docker compose down
```

This stops services while preserving named volumes. Removing volumes also removes retained database/media state. The worker handles shutdown by stopping camera pipelines and releasing resources.

## Deployment boundaries

The base `docker-compose.yml` is for local development and demos: it publishes Postgres, Redis, the API, and the web app directly on the host for convenience. It is unchanged by the production path below.

# Production VPS Deployment

This adds a second, opt-in deployment path for a single Ubuntu VPS with a real domain:

```text
INTERNET
   |
   v
CADDY (ports 80/443 only)
   |
   +-- Next.js web
   +-- FastAPI API / WebSocket / MJPEG stream
```

`postgres`, `redis`, `api`, and `web` no longer publish any host ports in this mode — Caddy is the only container reachable from outside the host, and everything else talks over the internal Docker network. This is implemented as an overlay file, `docker-compose.prod.yml`, applied on top of the existing `docker-compose.yml` — nothing about the local/demo workflow changes.

### 1. Provision the VPS

Ubuntu 22.04 or 24.04, recommended 4 vCPU / 8 GB RAM minimum (CPU-only YOLO inference is the heaviest workload). SSH in as a non-root sudo user.

### 2. Install Docker Engine + Compose plugin

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in for the group change to take effect
docker compose version   # must be v2.24 or newer (uses the `!reset` merge key)
```

### 3. Configure the firewall

Allow SSH **before** enabling the firewall, or you will lock yourself out:

```bash
sudo ufw allow OpenSSH        # or: sudo ufw allow 22/tcp  — do this first
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

If SSH runs on a non-default port, replace `OpenSSH`/`22/tcp` with that port before enabling ufw. Note that Docker manages its own iptables rules for published ports — since only Caddy publishes ports in this configuration, Postgres/Redis/API/web are not reachable from outside the host regardless of ufw, but ufw is still the correct place to restrict SSH access.

### 4. Clone the repository

```bash
git clone <your-repo-url> vigilai
cd vigilai
```

### 5. Create `.env`

```bash
cp .env.example .env
```

Fill in the values under `# LOCAL / DEVELOPMENT` (they double as the values used inside the containers) and then the `# PRODUCTION REQUIRED` section below.

### 6. Generate `SECRET_KEY`

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Put the result in `SECRET_KEY` in `.env`.

### 7. Generate `ENCRYPTION_KEY`

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Put the result in `ENCRYPTION_KEY` in `.env`. **Back this up together with your database backups.** It encrypts stored RTSP camera credentials; losing it or rotating it without re-encrypting existing rows makes those credentials permanently unreadable.

Also set `POSTGRES_PASSWORD` to a strong value (`openssl rand -hex 24`) and set `ENVIRONMENT=production`.

### 8. Set `DOMAIN`

```bash
# in .env
DOMAIN=example.com
ACME_EMAIL=you@example.com
```

`CORS_ORIGINS` and `FRONTEND_URL` are derived automatically from `DOMAIN` (as `https://DOMAIN`) unless you override them explicitly in `.env`.

### 9. Point DNS at the VPS

Create an `A` record (and `AAAA` if using IPv6) for `DOMAIN` pointing at the VPS's public IP. Verify propagation before starting Caddy, or Let's Encrypt issuance will fail:

```bash
dig +short example.com
```

### 10. Start the production stack

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The API container still runs `alembic upgrade head` automatically on startup.

### 11. Verify HTTPS

```bash
curl -I http://example.com      # expect a redirect to https
curl -I https://example.com     # expect 200 from the web app
```

Caddy obtains and renews the certificate automatically; no manual certbot step is required.

### 12. Register a real account

Open `https://example.com`, register, and log in. Confirm the session cookie in browser devtools carries `Secure`, `HttpOnly`, and `SameSite=Lax`.

### 13. Test the demo video

Cameras -> **USE DEMO VIDEO** -> start analytics -> open the live monitor. The bundled demo asset is committed to Git (`assets/demo/demo_feed.mp4`), so a fresh clone already has it; no manual upload is needed. Confirm the live feed updates continuously (MJPEG is not buffered by Caddy).

### 14. Verify events and evidence

Create a zone or line, add a matching rule, and confirm a triggered event appears in the Events UI with an evidence snapshot.

### 15. Inspect logs

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api worker caddy
```

All services log to stdout/stderr; no need to exec into containers for normal operation.

### 16. Backups

Back up, on a regular schedule:

- **PostgreSQL**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > backup-$(date +%F).dump`
- **Evidence and uploads** (named volumes `vigilai_evidence_data`, `vigilai_upload_data`): `docker run --rm -v vigilai_evidence_data:/data -v "$PWD":/backup alpine tar czf /backup/evidence-$(date +%F).tar.gz -C /data .`
- **`.env`**, especially `ENCRYPTION_KEY`, stored alongside (not inside) the repository, using secure storage. Losing it independently of the database backup makes RTSP credentials in that backup unrecoverable.
- `caddy_data` if you want to avoid re-issuing certificates after a restore (Let's Encrypt rate-limits repeated issuance for the same domain).

### 17. Update / redeploy

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Migrations run automatically as part of API container startup.

### Production environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DOMAIN` | Yes | Public hostname Caddy requests a certificate for and proxies |
| `SECRET_KEY` | Yes | JWT signing key; rejected if short or a known placeholder |
| `ENCRYPTION_KEY` | Yes | Fernet key for RTSP credential encryption; rejected if invalid or a known placeholder |
| `POSTGRES_PASSWORD` | Yes | Database password; no longer defaults to `vigilai_dev` |
| `ACME_EMAIL` | Recommended | Let's Encrypt expiry contact |
| `ENVIRONMENT=production` | Yes | Enables strict secret validation and `Secure` auth cookies |
| `CORS_ORIGINS`, `FRONTEND_URL` | Optional | Derived from `DOMAIN` when left unset |

### What only a real VPS and domain can verify

The following cannot be verified from a local build and are the deployer's responsibility to confirm after a real deployment: actual Let's Encrypt certificate issuance and renewal, public DNS resolution, `ufw`/cloud-provider firewall behavior against real internet traffic, and WebSocket/MJPEG latency over a real network path.

### Explicitly out of scope

This deployment path intentionally does not add Kubernetes, Terraform, cloud-provider-specific infrastructure, Celery/Ray, a managed database, S3-compatible storage, Cloudflare-specific tooling, WebRTC, or GPU/TensorRT configuration. It is a single-host Docker Compose + Caddy deployment only.
