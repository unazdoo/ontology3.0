# Implementation quality-gate tools

These dependency-free Node.js tools are the CI adapter for the implementation
quality policy. They validate receipts; they never turn a prototype fixture or
an absent runtime into a passing implementation result.

```bash
# Aggregate one CI run into the canonical manifest. All paths in index.json are
# relative to --receipt-root.
node scripts/quality-gate/generate-pr-evidence.mjs \
  --metadata artifacts/receipts/metadata.json \
  --index artifacts/receipts/index.json \
  --receipt-root "$GITHUB_WORKSPACE" \
  --pr-number "$PR_NUMBER" --head-sha "$HEAD_SHA" \
  --round-id "$IMPLEMENTATION_ROUND_ID" \
  --output implementation/evidence/pr-quality.json

# Validate a PR evidence manifest (missing fields fail closed)
node scripts/quality-gate/verify-pr-evidence.mjs \
  --manifest implementation/evidence/pr-quality.json \
  --receipt-root "$GITHUB_WORKSPACE" \
  --pr-number 123 --head-sha "$GIT_COMMIT" \
  --report artifacts/quality-gate-report.json

# Derive isolated resources for a PR. The output contains references only,
# never credential values.
node scripts/quality-gate/provision-pr-environment.mjs \
  --pr-number 123 --head-sha "$GIT_COMMIT" \
  --output artifacts/pr-environment.json

# Produce and verify an SPDX 2.3 SBOM.
node scripts/quality-gate/generate-sbom.mjs --output artifacts/sbom.spdx.json
node scripts/quality-gate/verify-sbom.mjs --sbom artifacts/sbom.spdx.json

# Scan tracked source files for high-confidence credential patterns.
node scripts/quality-gate/scan-security.mjs --output artifacts/security-scan.json

# Validate a service-owned NFR receipt (the runner is intentionally strict).
node scripts/quality-gate/verify-nfr-receipt.mjs \
  --kind observability --receipt artifacts/observability.json
```

`run-quality-check.mjs` is a small command/evidence runner for service-owned
E2E, performance, accessibility and observability suites. Supply `--command`
with a real runner or `--evidence` with a durable receipt; omitting both is an
error. The GitHub workflow keeps all these checks required and retains their
artifacts for 90 days.

The active baseline is `BSL-OFW-V110-94ABD0E991B7`. A valid manifest can still
be `candidateEligible: false`: candidate formation additionally requires the
same-round S001 first vertical slice, security and C034 recovery gates.

The generator accepts only a complete index: eight primary receipts plus one
receipt for every required check. Each file is parsed and bound by `receiptId`,
pull request, exact head SHA, PR environment and implementation round, then
indexed by its raw-file SHA-256. Verification performs the same reads again.
Descriptor-only provisioning, path traversal, missing/tampered receipt files,
mixed CI rounds, fixture markers and `productionEvidence=false` all fail closed.

## Actual quality probes

The accessibility gate requires `playwright` and `axe-core`, a running product
URL, and an explicit JSON keyboard focus path. Install the selected browser in
CI (`npx playwright install --with-deps chromium`) before running it:

```bash
node scripts/quality-gate/run-accessibility-evidence.mjs \
  --url "$IMPLEMENTATION_URL" --runtime artifacts/receipts/runtime.json \
  --focus-path quality-gates/accessibility-focus-path.json \
  --output artifacts/receipts/accessibility.json

node scripts/quality-gate/run-observability-evidence.mjs \
  --runtime artifacts/receipts/runtime.json \
  --logs artifacts/telemetry/logs.ndjson \
  --metrics artifacts/telemetry/metrics.json \
  --traces artifacts/telemetry/spans.json \
  --alerts artifacts/telemetry/alert-probe.json \
  --output artifacts/receipts/observability.json

node scripts/quality-gate/run-security-evidence.mjs \
  --runtime artifacts/receipts/runtime.json \
  --secret-scan artifacts/security-scan.json \
  --npm-audit artifacts/npm-audit.json \
  --permission-negative artifacts/receipts/permission-negative.json \
  --output artifacts/receipts/security.json
```

These commands never turn an absent probe into a pass. Axe violations, a broken
Tab path, browser errors, missing or cross-run telemetry, a non-fail-closed alert
probe, secret findings, high/critical dependency vulnerabilities, or incomplete
permission-negative coverage produce a `blocked` receipt and a non-zero exit.
