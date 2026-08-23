# Foundation 公共底座启动说明

## 基线

```text
sourceTag = prototype-v1.1.0-frozen
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
branch = codex/implementation-foundation
```

## 本线唯一职责

1. 版本化 API/事件 Schema 注册；
2. C033 场景上下文传播、校验和错配拒绝；
3. 稳定资源引用、Trace、Correlation 和幂等键；
4. C034 导出、校验、克隆恢复 Provider SPI；
5. 审计、Feature Flag、RBAC 和可观测性接口；
6. 公共 ADR、契约测试和恢复 Runbook。

不得接管 M01—M06 的业务真值，不直接改模块文档，不修改冻结原型。其他模块只能消费已合并的 Schema 版本，不能在自己的分支静默扩展公共 Envelope。

## 第一批交付

- `packages/contracts`：Common Envelope、ScenarioContext、ResourceRef、EvidenceRef、RunRef、QualityGate、ActionRequest、ReportRef；
- `packages/identity`：C033 校验、同场景/同轮次比较、幂等键计算；
- `packages/checkpoint`：C034 Provider 接口和恢复副作用保护；
- `implementation/adr/`：模块化单体、存储、队列、权限、审计和恢复 ADR；
- 正向、缺失、未知、错配、重复、重放无副作用契约测试。

完成前不能放行真实 M02→M01 链路；完成后提交 PR 并附 Schema 版本、测试结果、迁移/回滚和证据位置。
