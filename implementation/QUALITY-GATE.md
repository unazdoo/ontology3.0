# 实施质量门政策

本政策适用于 `codex/implementation-quality-release` 及其合并到实施集成分支的每个 PR。它把“原型回归通过”和“可形成实施候选”分开：原型目录只读，生产实施必须有真实服务、持久化、身份/权限、审计、观测和恢复证据。

## 不可变基线

当前实施基线为：

```text
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
sourceTag = prototype-v1.1.0-frozen
sourceVersion = v1.1.0
implementationVersion = implementation-0.1.0
firstVerticalSlice = S001 (M02 → M01 → M03 → M04 → M06 → M05 → M06)
```

PR 不得修改 `designs/prototype-releases/v1.1.0/`。若 PR 依赖新的基线，必须先登记基线变更并由平台 Owner 审批；仅更新文档中的 ID 不构成基线切换。

## 每个 PR 的强制记录

PR 描述必须包含真实值（不能写 `TBD`、示例值或只存在于本地的路径）：

| 类别 | 必填内容 | 通过条件 |
| --- | --- | --- |
| 身份 | `baselineSnapshotId`、source/implementation 版本、PR environment ID | 与仓库基线和 CI 运行一致 |
| 契约 | API/event/DB Schema 版本、兼容性结论、Contract Owner、Provider/Consumer | 变更有兼容测试；不兼容变更有迁移与批准 |
| 存储 | DB schema、up/down 迁移、对象存储 prefix 与 fingerprint/manifest | 每个 PR 唯一；可验证、可回滚；环境 Provider 必须返回 provisioning receipt |
| 消息 | queue namespace、重试/DLQ 和重复投递策略 | 不与其他 PR、集成或生产命名空间重叠 |
| 运行 | 真实 `scenarioRunId`/run ID、输入黄金数据版本、时间和证据索引 | 可从日志、trace 和审计回读；不得使用 fixture/historical run 代替 |
| 审计 | actor、correlation/trace、C033 context、idempotency key、结果和形成时间 | 追加式、可检索、与副作用一一对应 |
| 变更控制 | 数据迁移、对象/队列变更、代码/Schema 回滚步骤和演练结果 | 回滚后读写、权限、审计和观测仍通过 |
| 恢复 | C034 export、validate、cloneRestore/隔离回放及恢复回执 | 新 `scenarioRunId`；不重放 Action、通知、审批、待办或迁移 |

所有证据应作为仓库相对路径或 CI artifact URL 写入 PR；“本地已验证”、截图或冻结原型记录不能单独关闭实施门。

## 门分类与判定

质量门脚本和 CI 可以按实现拆分，但以下分类均为阻断性要求：

1. **黄金数据与基线**：脱敏、可复现、带 manifest/hash；快照 ID、Schema 版本和对象指纹可核验。
2. **契约兼容**：Provider/Consumer 正向与错版、缺失、未知字段和回读测试；Envelope、C033、审计和幂等字段不被私自扩展。
3. **S001 E2E**：按固定顺序完成首条真实垂直切片；每一步使用同一轮次的真实运行 ID 和可回读证据。
4. **权限负向**：未授权、职责越界、跨场景/跨 Owner、失效凭据和敏感字段外泄均拒绝并留审计。
5. **并发与幂等**：重复、乱序、重试、超时和冲突不产生重复副作用；同键异场景/异版本 fail closed。
6. **性能**：关键读写、队列、导出/恢复的基线、容量、SLO 和超时证据；性能回归不得静默降级。
7. **可访问性**：键盘路径、语义结构、焦点、对比度和错误提示符合项目目标；仅有截图不算证据。
8. **安全与 SBOM**：依赖/容器扫描、SBOM、密钥/凭据检查、注入/越权/供应链检查和风险处置记录。
9. **观测**：结构化日志、指标、trace、审计关联、告警阈值、脱敏和 Runbook 能定位一次真实运行。
10. **C034 恢复**：导出哈希、校验、克隆恢复、隔离回放、故障注入和恢复回执；历史状态只读。
11. **迁移与回滚**：迁移前后兼容窗口、up/down 或等价回滚、对象/队列清理和发布暂停步骤均可复现。
12. **CI/CD 与隔离**：门禁默认 fail closed；测试 artifact、证据和短生命周期环境按 PR 隔离并在结束后清理。

门通过不仅要求命令返回成功，还要求对应证据中有环境 ID、真实运行 ID、版本/指纹和审计关联。没有证据等同于未通过。

## PR 环境隔离

每个 PR 必须创建短生命周期环境，推荐命名：`pr-<number>-<sha12>`（`sha12` 为提交 SHA 的前 12 位）。以下四类资源必须从该 ID 派生并全局唯一：

```text
database schema      = pr_<number>_<sha12>
object-store prefix  = pr/<number>/<sha12>/
queue namespace      = pr-<number>-<sha12>
credential reference = pr/<number>/<sha12> (short-lived, least privilege)
```

禁止使用共享开发/集成/生产 Schema、对象前缀、队列或长期凭据。集成环境只加载脱敏黄金数据；凭据值不能写入仓库、日志、artifact 或 PR 评论。清理失败必须报警并阻断候选形成，避免残留数据被下一个 PR 复用。

## 候选形成规则

`implementation candidate` 是受控状态，不是标签或人工口头结论。CI 只有在下列条件同时满足时才可生成候选 manifest/标签：

- 所有上述阻断门和必填 PR 记录通过；
- S001 首条真实垂直切片按固定顺序完成，真实运行 ID、契约回执和审计链完整；
- 安全门和 C034 恢复门在同一实施轮次通过，恢复回执确认新运行 ID且无历史副作用；
- 迁移/回滚演练通过，PR 环境资源已隔离且无清理告警；
- 候选 manifest 记录基线 ID、Schema 版本、Owner、提交 SHA、运行/证据索引和生成时间。

任何一项缺失、过期、使用历史/夹具替代或无法回读，候选状态必须保持 `implementation-open`，不得以原型“全绿”替代。

## 失败、重试与豁免

- 门脚本、依赖扫描、迁移验证和环境清理默认 fail closed；网络抖动可由 CI 在同一提交上有限重试，但必须保留每次尝试和最终结果。
- 基线、契约/Schema/Owner、环境隔离、权限/安全、C034 恢复、审计和回滚门不可豁免。
- 其他门若确有临时风险，可申请有期限的豁免：PR 中写明风险、补偿措施、批准 Owner、追踪 Issue 和到期日；到期自动失效，不能用来生成候选。
- 豁免不得跳过真实运行、恢复回执或安全扫描，也不得通过 `continue-on-error` 隐藏失败。

## 分支保护与证据留存

仓库管理员应将实施质量 workflow 的所有必需 job 配置为 `codex/implementation-quality-release` 的 required checks，并禁止绕过分支保护。每次运行至少保留：提交 SHA、PR/environment ID、基线和 Schema 版本、黄金数据与对象指纹、真实运行 ID、测试报告、SBOM/扫描结果、审计查询和 C034 恢复回执。证据保留期、敏感字段脱敏和清理策略由 Security/Reliability Owner 在 Runbook 中维护。

相关入口：

- [`CONTRACT-GATE.md`](./CONTRACT-GATE.md)：公共契约字段和模块边界；
- [`RECONCILIATION-STATUS.json`](./RECONCILIATION-STATUS.json)：当前实施开放项；
- [`../.github/pull_request_template.md`](../.github/pull_request_template.md)：PR 必填字段与检查清单；
- [`../quality-gates/pr-evidence.schema.json`](../quality-gates/pr-evidence.schema.json)：机器可读证据合同；
- [`../scripts/quality-gate/verify-pr-evidence.mjs`](../scripts/quality-gate/verify-pr-evidence.mjs)：fail-closed 校验入口。

本分支的最小本地门禁为：

```bash
npm run check
npm test
npm run test:quality
node scripts/quality-gate/verify-golden-data.mjs
node scripts/quality-gate/generate-sbom.mjs --output artifacts/sbom.spdx.json
node scripts/quality-gate/verify-sbom.mjs --sbom artifacts/sbom.spdx.json
node scripts/quality-gate/scan-security.mjs
```

没有 `implementation/evidence/pr-quality.json` 时，CI 的 PR 证据 job 必须失败；
不得用一个仓库内的“全绿示例”替代真实 PR 环境、真实运行、审计或恢复回执。
