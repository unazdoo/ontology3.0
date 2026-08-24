# Golden data

The S001 fixture is a tiny, synthetic and redacted contract test dataset. It
is not a production source and cannot close a real-run gate by itself. The
manifest's SHA-256 must match `data.json`; regenerate it with:

```bash
node scripts/quality-gate/update-golden-manifest.mjs
```
