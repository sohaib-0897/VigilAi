# Validation record

Initial publication checks performed on 2026-09-13, Windows, Python 3.12.9:

| Check | Result |
| --- | --- |
| `python -m pytest tests -q -p no:cacheprovider` | 85 passed; 12 dependency/API deprecation warnings |
| `npm run build` in `apps/web` | Passed compilation, lint/type validation, and page generation with Next.js 15.5.25 |
| `docker compose config --quiet` | Passed configuration validation; does not build or start containers |
| Publication file checks | Relative Markdown links resolve; no files over 5 MiB or matches for the checked private-key/API-token patterns |

The test suite includes geometry, analytics, rules, event lifecycle, API authentication boundaries, and runtime regressions. Some tests use controlled detections or isolated dependencies. Passing these tests does not establish real-world detector accuracy, physical-camera recovery, or full deployment reliability.

## Live verification scripts

`scripts/verify_runtime.py` and `scripts/verify_worker_process.py` exercise live infrastructure and inference. Read their prerequisites before running them against a disposable demo database. They use local model/media assets under ignored `.verification/` and create temporary test records.

These live scripts, a fresh database migration, a complete Docker deployment, and a browser demo were **not rerun during this publication task**. Existing local outputs are not presented as newly verified results.

## Measurement boundaries

See [benchmark notes](../benchmarks/README.md) for the retained CPU inference and ONNX artifacts. No new benchmark or model training was performed during publication. Fine-tuned accuracy and TensorRT/GPU gains remain `NOT_MEASURED`.

The GitHub Actions workflow repeats CPU tests and the frontend build on pushes and pull requests. A committed workflow is not evidence of a passing hosted run; inspect the Actions result for the relevant commit.
