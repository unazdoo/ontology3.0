# v1.5 prototype workspace

This worktree is the active implementation environment for the v1.5 design iteration.

- Active source: `designs/prototype-work/v1.5/`.
- Branch: `codex/prototype-v1.5.0`.
- Parent baseline: `b990d448` from `codex/prototype-v1.3.1-composite`.
- Keep `designs/prototype-work/v1.4/` and frozen `designs/prototype-releases/` as reference baselines. Do not modify them as part of v1.5 work.
- Keep existing business data/ontology identities and source fingerprints unless the user authorizes a data or ontology version change. Product version and business data version are separate.
- Preview: `http://127.0.0.1:4594/`, static/model ports `4592/4593`.
- Run `npm ci`, `npm test`, `npm run build`, or `npm run dev` inside the active source directory.
- The current browser business regression is `npm run verify:current`. Use a separate browser session and CDP4596; keep the user's preview tab and v1.4 port4494 untouched.
- Put new evidence in `outputs/v1.5-verification/`. Historical screenshots are not current verification.
- Avoid persistent animation and polling. Close temporary test browsers and servers when done; preserve the requested preview.
- Do not push new work unless the user has requested pushing in the active task. Never force push or modify unrelated branches.
