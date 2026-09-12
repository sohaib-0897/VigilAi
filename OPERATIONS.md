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
| `MAX_CAMERAS_PER_WORKER`, `FRAME_QUEUE_SIZE` | Worker capacity and bounded queue size |
| `CORS_ORIGINS` | Local application's permitted browser origins; Compose currently sets localhost:3000 |

The Compose file passes an explicit subset of settings into containers. Editing an unused variable in `.env` does not automatically pass it through; inspect `docker-compose.yml` when changing deployment settings.

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 api worker
```

The API Docker entrypoint runs `alembic upgrade head`. Register an account through `/register`; the optional `scripts/seed.py` creates a publicly documented development account and must not be used for a public deployment.

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

The supplied Compose configuration is for local development. Public deployment requires intentional network exposure, TLS termination, persistent secrets, origin/cookie configuration, backups, and environment-specific verification. GPU device forwarding is an optional Compose configuration; GPU and TensorRT execution were not verified during publication.
