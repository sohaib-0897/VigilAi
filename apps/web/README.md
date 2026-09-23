# VigilAI frontend

Run `npm run dev` for development, or `npm run build` and `npm start` for a production build. The API proxy defaults to `http://localhost:8000`; set `API_INTERNAL_URL` when needed.

`/` is the public product landing page. It uses the existing design tokens, fonts, buttons, badges, and cards, with page-specific styles in `src/components/landing/landing.module.css`. The existing auth provider supplies session-aware console links. Both frontend authentication redirect checks allow `/`; private routes retain their existing protection.

## Measured claims

`public/engineering/` contains exact copies of these repository artifacts:

- `benchmarks/ppe_dataset_report.json`: dataset and annotation counts.
- `benchmarks/ppe_test_results.json`: held-out evaluation, including overall and per-class scores.
- `benchmarks/ppe_inference_benchmarks.json`: PyTorch and ONNX CPU inference measurements.

Landing components import these JSON files directly. Update the copies when publishing a new measured run; do not edit displayed numbers independently. CPU model context is recorded in `PORTFOLIO.md`. Inference benchmarks are distinct from full pipeline throughput. Both tracking and PPE diagrams are labeled illustrations, not live camera data.

## Verification

Run `npm run lint` and `npm run build` here. `tests/landing.smoke.cjs` uses Playwright against a running production server (default `http://localhost:3001`). It checks public/private routing, session-aware CTAs, artifact parity, responsive overflow, navigation, keyboard behavior, metadata, reduced motion, and browser errors. If Playwright is installed separately, point `NODE_PATH` at its `node_modules` directory.

Optional environment variables:

- `LANDING_QA_URL`: frontend URL.
- `LANDING_QA_OUTPUT`: local screenshot directory; keep generated images out of Git.
- `LANDING_QA_EMAIL` and `LANDING_QA_PASSWORD`: an existing local account for real sign-in and console checks. Without these, session branching uses an isolated test fixture and the public page is also checked against the real backend.

Run `node tests/landing.smoke.cjs`. No test fixtures are used by the production page.

The existing authenticated console uses a fixed-width sidebar and clips content on narrow phones. This landing-page change leaves that layout unchanged; the public page has its own responsive navigation and grids.
