<!--
Implementation PRs are evaluated by the quality-gate workflow. Keep the
metadata below complete and machine-readable; do not replace a real run ID or
receipt with a prototype fixture, screenshot, or a historical run.
-->

## 变更摘要

<!-- 说明变更目的、影响模块和是否改变 API/event/持久化契约。 -->

## 实施元数据（必填）

| 字段 | 值 |
| --- | --- |
| `baselineSnapshotId` | <!-- 例如 BSL-OFW-V110-94ABD0E991B7 --> |
| `sourceTag` / `sourceVersion` | |
| `implementationVersion` | |
| `schemaVersions`（API/event/DB） | |
| Contract Owner | |
| Provider / Consumer | |
| PR environment ID | <!-- 必须是本 PR 的短生命周期环境 --> |
| Database schema | <!-- 独立于其他 PR 和集成环境 --> |
| Object-storage prefix | <!-- 独立前缀；填写指纹/manifest 路径 --> |
| Queue namespace | <!-- 独立命名空间 --> |
| Credential reference | <!-- 短期、最小权限引用；禁止提交 secret --> |
| Provisioning receipt | <!-- Provider 的真实资源创建回执；命名推导不能代替 --> |

```yaml
# 与上表保持一致，作为 PR 摘要；CI 仍以
# quality-gates/pr-evidence.schema.json 规定的证据 manifest 为准。
implementation:
  baselineSnapshotId: ""
  sourceTag: ""
  sourceVersion: ""
  implementationVersion: ""
  schemaVersions: []
  owner: ""
  providers: []
  consumers: []
  prEnvironment:
    id: ""
    databaseSchema: ""
    objectStoragePrefix: ""
    objectStorageFingerprint: ""
    queueNamespace: ""
    credentialRef: ""
    provisioningReceipt: ""
  realRunIds: []
  runtimeRunId: ""
  auditReceipt: ""
  recoveryReceipt: ""
```

<!-- CI canonical manifest 还必须包含 `manifestVersion`、`gateVersion`、
`databaseMigration`、`objectStorageFingerprint`、`rollback`、`audit`、
`negativeTests`、`checks` 和 `candidateGates`；摘要块不能替代这些证据。 -->

## 契约、数据和运行证据

- [ ] `baselineSnapshotId`、source tag、实现版本与当前工作区基线一致。
- [ ] 已记录变更的 API/event Schema 版本、兼容性结论（兼容/需迁移/阻断）和 Owner；Provider/Consumer 已逐一确认。
- [ ] 黄金数据集为脱敏、可复现版本，包含 manifest/hash；未把原型夹具或历史运行当作生产证据。
- [ ] 已填写真实 `scenarioRunId`/运行 ID、时间、环境 ID 和证据链接；运行可在日志/审计中回读。
- [ ] 每个外部副作用都有 actor、correlation/trace、C033 场景上下文、幂等键和追加式审计回执。
- [ ] 负向测试覆盖缺失、未知、错版、越权、读取失败、重复/冲突和失败恢复；结果与证据链接已附。

## 数据、恢复和发布

- [ ] 数据库迁移包含 up/down（或等价的可逆步骤）、锁/并发说明、数据兼容窗口和验证结果。
- [ ] 对象存储变更包含前缀隔离、不可变产物策略、指纹/manifest 和回滚清理方案。
- [ ] 队列/消费者变更包含独立命名空间、重复投递处理、DLQ/重试和回滚方案。
- [ ] C034 `export`、`validate`、`cloneRestore`/隔离回放已执行；恢复生成新运行 ID，不重放历史副作用，并附恢复回执。
- [ ] 已在 PR 环境演练回滚（代码、Schema、对象和队列）；回滚后读写与审计验证通过。
- [ ] 已明确 CI/CD 发布、暂停、回滚和证据保留步骤；没有 `continue-on-error` 绕过阻断门。

## 质量门证据

- [ ] 黄金数据 / 基线快照
- [ ] 契约兼容（Provider/Consumer）
- [ ] S001 首条真实垂直切片 E2E
- [ ] 权限负向 / 职责分离
- [ ] 并发 / 幂等 / 重试
- [ ] 性能 / 容量 / SLO
- [ ] 可访问性（含键盘、语义和对比度）
- [ ] 安全 / 依赖漏洞 / SBOM
- [ ] 观测（日志、指标、追踪、告警、Runbook）
- [ ] C034 恢复 / 隔离回放
- [ ] 迁移 / 回滚

证据索引（测试输出、报告、运行 ID、审计/恢复回执、SBOM）：

<!-- 填写仓库内相对路径或 CI artifact URL；禁止只写“本地已验证”。 -->

## 候选与豁免声明

- [ ] 仅当全部阻断门通过，且 **S001 首条垂直切片** 与 **安全门、C034 恢复门** 均有同一实施轮次的通过证据时，才声明 `implementation candidate`。
- [ ] 本 PR 不修改 `designs/prototype-releases/v1.1.0/` 或把原型状态写成生产验收事实。
- [ ] 如申请豁免，已填写下方信息；基线、契约/Owner、环境隔离、安全和恢复门不可豁免。

| 豁免项 | 风险与补偿措施 | 批准人 | Issue/到期日 |
| --- | --- | --- | --- |
| <!-- 无则填“无” --> | | | |

## Reviewer sign-off

- [ ] Contract Owner
- [ ] Data/migration Owner
- [ ] Security Owner（涉及安全或凭据时必需）
- [ ] Reliability/Recovery Owner（涉及 C034、迁移或回滚时必需）
