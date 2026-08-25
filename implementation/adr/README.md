# Foundation ADR Index

This index covers only the v1.1.x Foundation lane. It is not a product
governance register and does not replace M01-M06 decisions or contract-change
records.

| ADR | Decision | Status | Owner |
| --- | --- | --- | --- |
| [0001 Foundation scope](./0001-foundation-scope.md) | Keep the first implementation to pure public contracts, C033/C034 boundaries, idempotency/trace primitives and minimum audit metadata. Defer full identity, authorization and governance platforms. | Accepted for `implementation-0.1.0`; revisit after M01-M06 reconciliation | Foundation |
| [0002 Schema compatibility](./0002-schema-compatibility.md) | Keep draft schemas side-by-side and fail closed for malformed, downgraded or breaking versions. | Accepted for `implementation-0.1.0`; revisit on contract promotion | Foundation + contract consumers |

All schemas shipped by this lane carry `x-contract-status: draft`. Promotion to
a final platform contract requires an explicit reconciliation and compatibility
decision.
