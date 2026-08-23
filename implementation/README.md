# v1.1.x 项目实施工作区

本工作区用于正式项目实施编码的集成，不是原型工作区，也不是冻结发布目录。

## 基线

```text
sourceTag = prototype-v1.1.0-frozen
sourceVersion = v1.1.0
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
acceptanceReady = false
```

`v1.1.0` 只作为产品功能、交互和验收参考。生产状态必须由正式服务、持久化存储、API、事件、身份、权限、审计、可观测性和恢复机制实现。静态 HTML/JS、localStorage、临时 JSON 和浏览器状态不能作为生产真源。

## 推荐架构起点

先采用“模块化单体 + 异步 Worker”，不要一开始拆成六套微服务：

- `services/data`：T001—T008、C001—C003、C017 投影；
- `services/ontology`：T009—T019、C004—C008、C028/C029；
- `services/query`：C009/C010/C018 和问数/Rule 运行事实；
- `services/decision`：C011—C013、C019 和决策/待办事实；
- `services/report`：C018、C022/C023、T044/T049、C027；
- `services/agent`：C014/C020/C024/C025 和 Agent 运行事实；
- `packages/contracts`：版本化 API/事件 Schema；
- `packages/identity`：C033 场景上下文和幂等基础能力；
- `packages/checkpoint`：C034 导出、校验、恢复接口；
- `infra`：数据库迁移、对象存储、队列、IAM 和可观测性。

数据管道、报告渲染和 Agent 运行可以作为可水平扩展 Worker；业务状态仍归各模块 Owner，跨模块读模型只能是只读投影。

## 第一条真实垂直切片

先只实施 S001，真实交接顺序固定为：

```text
M02 → M01 → M03 → M04 → M06 → M05 → M06
```

各条线可以并行开发 Schema、适配器、服务骨架和契约测试；只有上游形成精确版本和证据后，才能进行真实交接。

## 受保护范围

- `designs/prototype-releases/v1.1.0/` 不得修改；
- S001—S004 组合原型只作为来源证据；
- S005、M07、M08 研究工作区保持独立，进入实施前须另行登记从 `v1.0.3` 到 `v1.1.0` 的迁移；
- 六模块主文档仍由各自 Owner 回写，不由实施集成窗口代改。

并行任务提示词见 [`PARALLEL-IMPLEMENTATION-PROMPTS.zh-CN.md`](./PARALLEL-IMPLEMENTATION-PROMPTS.zh-CN.md)。

## 执行入口

在开始编码前先完成：

1. 合并平台 PR #1，确认冻结标签和 T056 校验通过；
2. 进入本工作区并验证基线；
3. 创建 Foundation 和各模块独立 worktree；
4. 先合并公共 Schema，再派发模块适配器任务；
5. 每个 PR 按契约门提交测试、迁移、回滚和证据。

```bash
cd /Users/domi/Public/Vibecoding/ontology3.0-worktrees/implementation-v1.1.x
node designs/prototype-releases/verify-release.mjs 1.1.0
node designs/scenario-checkpoints/baselines/v1.1.0/verify-baseline.mjs
```
