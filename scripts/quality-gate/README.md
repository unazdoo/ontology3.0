# Implementation quality-gate tools

These dependency-free Node.js tools are the CI adapter for the implementation
quality policy. They validate receipts; they never turn a prototype fixture or
an absent runtime into a passing implementation result.

```bash
# Validate a PR evidence manifest (missing fields fail closed)
node scripts/quality-gate/verify-pr-evidence.mjs \
  --manifest implementation/evidence/pr-quality.json \
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
