# PR evidence

The canonical `pr-quality.json` manifest is intentionally created per pull
request and is not seeded with a passing fixture. Copy the contract from
[`../../quality-gates/pr-evidence.schema.json`](../../quality-gates/pr-evidence.schema.json)
and attach only real, durable receipts from the isolated PR environment.

The quality workflow fails closed when this file is absent. Never commit
credentials, prototype snapshots, screenshots, or placeholder run IDs here.
`provision-pr-environment.mjs` only derives and validates names; it does not
pretend to create cloud resources. A real provider must replace
`prEnvironment.provisioningReceipt` with a durable receipt proving the isolated
database schema, object prefix, queue namespace and short-lived credential
were created before the evidence manifest can pass.
The local fingerprint helper can only fingerprint a supplied export directory;
its fixture output is marked `productionEvidence=false` and cannot be used as a
real object-store receipt.
