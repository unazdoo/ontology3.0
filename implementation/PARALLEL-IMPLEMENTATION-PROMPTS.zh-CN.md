# 并行实施派发提示词（中文版）

## 统一前提

每条任务都必须使用：

```text
sourceTag = prototype-v1.1.0-frozen
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
```

不得修改 `designs/prototype-releases/v1.1.0/`、六模块主文档或 S005/M07/M08 研究工作区。不得用原型静态成功状态代替生产证据。

## 0. Foundation 公共底座

**分支：** `codex/implementation-foundation`

> 从 `prototype-v1.1.0-frozen` 创建 Foundation 实施分支。只负责 `packages/contracts`、`packages/identity`、`packages/checkpoint`、审计基础能力和 ADR 索引。
>
> 实现版本化 API/事件 Schema、C033 场景上下文中间件、资源稳定引用、幂等键、Trace 传播、C034 Provider SPI、Feature Flag、RBAC 接口和追加式审计接口。补齐缺失、未知、错配、重复、回放无副作用的负向测试。不得接管任何模块业务真值。
>
> 交付 ADR、Schema、接口、契约测试和恢复 Runbook；完成后提交 PR，等待公共 Schema 合并门。

## 1. M02 数据脊柱

**分支：** `codex/implementation-m02-data`

> 只负责 T001—T008、C001—C003、C017 元数据投影以及 C032/C028/C029 客户端。实现真实来源登记、不可变 T002 快照、管道运行、质量检查、精确 T007、T008 和交付回执。
>
> 正式运行开始时锁定精确输入版本，拒绝循环和硬质量失败，重试不得漂移。S003 当前兼容性 T007 永久不可消费。不得计算 Metric、Rule、风险评分或业务结论。
>
> 提交黄金数据、Provider/Consumer 契约测试、迁移和回滚说明；没有真实来源和 T008 证据只能标记为实施待验。

## 2. M01 本体管理

**分支：** `codex/implementation-m01-ontology`

> 只负责 C004—C008、T017、T019 和 Published 生命周期。只接受同一 C033 上下文中的合法 C003 交付；实现 Draft、不可变 Published、T054/C032 发现和 T019 原子切换/回退。
>
> 提供 C008 empty/ready/failed/previous-trusted 投影和候选验证门。消费者只读，不维护 T019 副本，不复制 Metric/Rule 定义。
>
> 补齐 C003/C032/C028/C029/T019 的正向、错配、重复、失败和恢复测试，并返回设计文档需要由 M01 Owner 回写的 v1.1.0 对账项。

## 3. M03 智能问数

**分支：** `codex/implementation-m03-query`

> 只负责 C009/C010/C018 和问数/Rule 运行事实。每次运行必须绑定 Agent 配置、Prompt/Skill 版本、Published 语义版本、精确数据版本、T008、结构化结果和证据。
>
> 对未知、硬质量失败、版本错配和权限不足 fail-closed；只提交标准 C011，不切换 T019，不绕过 C008 读取业务明细。
>
> 补齐问数结果、Rule 命中、证据、CSV、幂等和权限负向测试，并回写 M03 设计文档的 v1.1.0 对账段落。

## 4. M04 决策中心

**分支：** `codex/implementation-m04-decision`

> 只负责 C011—C013、C019 和三道 C017 安全门。接收、人工确认、负责人待办必须是独立状态；在接收、确认、待办形成前分别重新读取 C017。
>
> 实现同标识幂等、场景/版本错配拒绝、拒绝和重试历史、C019 稳定回链。不得维护 C017 副本，不得自动确认、自动创建待办或形成第二套任务真源。
>
> 清理所有生产预置状态，补齐正向、重复、错配、硬质量失败和恢复测试，并回写 M04 文档对账。

## 5. M06 报告中心

**分支：** `codex/implementation-m06-report`

> 只负责 C018、C022/C023、T044/T049、C027 和报告/仪表盘持久化。生成前固定精确报告上下文和证据，生成同源 HTML/PDF，执行确定性四态核验，并把当前比较记录为独立运行。
>
> 事后质量失败只给旧报告增加警告并阻断新生成；重新生成必须形成新运行和新内容版本。不得用静态 C008/T019 状态放行报告。
>
> 补齐模板、渲染、存储、发布、核验、比较、C024 交接和恢复测试，并回写 M06 文档对账。

## 6. M05 Agent 应用

**分支：** `codex/implementation-m05-agent`

> 只负责 C014/C020/C024/C025、模型/工具网关和 Agent 评测。只接受 M06 提供的固定报告上下文、C017 摘要和确定性核验结果；固定 Prompt、Skill、工具、本体、场景和模型版本。
>
> 只输出可追溯解释和证据引用；不得读取业务明细、计算正式结果、切换 T019、发布报告、执行 Action 或创建待办。
>
> 补齐错配拒绝、工具白名单、提示注入、成本、权限、评测和恢复测试，并回写 M05 文档对账。

## 7. Quality / Release

**分支：** `codex/implementation-quality-release`

> 负责黄金数据、契约兼容、E2E、权限负向、并发/幂等、性能、可访问性、安全、SBOM、观测、C034 恢复、迁移、回滚和 CI/CD。
>
> 每个 PR 使用独立数据库 Schema、对象存储前缀、队列命名空间和凭据。建立短生命周期 PR 环境；集成环境只加载脱敏黄金数据。
>
> 只有首条 S001 垂直链路和恢复/安全门全部通过后，才允许形成 implementation candidate；不得修改 v1.1.0 原型发布。

## 派发方式

1. 把统一前提和对应模块提示词一起发送给 Owner/编码窗口。
2. 明确工作树、分支、允许修改路径和禁止修改范围。
3. 要求返回：提交、变更摘要、合同影响、Schema 版本、测试、迁移、回滚、证据和剩余阻断。
4. Foundation PR 合并后，才锁定公共 Schema；其余线可以先在自己的分支使用 mock，但不能自行修改 Schema。
5. 按 `M02 → M01 → M03 → M04 → M06 → M05 → M06` 接入真实运行。

“原型回归通过”只能关闭原型层 P0/P1；真实数据、C034、权限、安全、性能和生产联调 P0/P1 必须等待对应证据。
