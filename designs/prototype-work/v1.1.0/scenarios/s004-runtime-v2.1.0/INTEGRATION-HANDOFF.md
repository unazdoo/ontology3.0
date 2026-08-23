# S004 v1.1.0 总装交接

## 固定基线

```text
baselineVersion = v1.0.3
baselineSnapshotId = BSL-S001-V103-DE0119608E26
scenarioId = S004
scenarioVersion = S004-v2.1.0
```

总装只能把该运行时作为上述父基线的场景适配接入，不得原地迁移父版本或复用其他场景的 `scenarioRunId`。

## 运行入口

```text
http://<same-origin>/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/index.html#home
```

运行服务必须以 `designs` 作为 HTTP 根目录，使 S004 运行层和只读 `prototype-releases/v1.0.3` 处于同一 Origin。

## 公共适配层

- `foundation/ofw-scenario-foundation.js`
  - 提供 C033/C034 身份、命名空间、定向重置和恢复语义。
  - 新增 `normalizeBaselineVersion()` / `formatBaselineVersion()`，不改变 C034 v1 的内部格式。
- `foundation/ofw-baseline-module-adapter.js`
  - 提供场景 registry、运行时模块入口、场景上下文、storage namespace 和兼容别名。
  - 对外场景配置使用 `v1.0.3`；Foundation 校验使用 `1.0.3`。
- 当前窗口只安装一个激活场景；后续总装可将多个 adapter 注册到 `window.OFW_SCENARIOS`，由公共 Shell 选择激活项。

## 模块入口合同

- M01、M03、M04、M05、M06 必须继续解析到 `prototype-releases/v1.0.3/` 下的冻结入口。
- M04 的入口固定为 `prototype-releases/v1.0.3/decision-center-prototype/review-v2/action-portfolio.html`；旧的决策中心根入口不是本场景的总装入口。
- M02 只能使用已登记的 v1.1.0 参数化入口 `prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-modules/m02-data-engineering.html`，并保留其 v1.0.3 原件路径、SHA-256 和 `PATCH-REGISTRY.md`。总装不得将该例外扩展为私有 module view 或另一套数据工程页面。
- 入口、来源摘要、内部路由和场景 query 由 `scenario.manifest.json` 与 loader 清单共同校验；任一不一致都应暂停合并。

## 场景隔离

S004 使用：

```text
ofw:v1.1.0:scenario-registry:S004:active-context
ofw:v1.1.0:S004:S004-v2.1.0:<scenarioRunId>:shell:...
ofw:v1.1.0:S004:S004-v2.1.0:<scenarioRunId>:module-data:...
ofw:v1.1.0:S004:S004-v2.1.0:<scenarioRunId>:module-ontology:...
...
```

不得复用当前 S004 v2.0.1 的状态前缀、报告指针或 Checkpoint 目录。

运行层对同 Origin 浏览器配额采用受限回退：冻结模块的场景逻辑键在 `localStorage` 配额不足时，只能溢出到同一 `scenarioRunId` 的 `sessionStorage` 隔离区；不得清理其他场景、扩大到未登记键，且不得把该运行状态当作 Checkpoint 或正式证据真源。

## 总装要求

1. S001、S002、S003、S004 不得在同一 document 中顺序覆盖 `window.S001_DATA` / `window.S001_STORE`。
2. 总装层应将各场景 adapter 汇总至 `window.OFW_SCENARIOS`，公共 Shell 读取当前激活 adapter。
3. 兼容别名只属于当前 Shell window，不是跨场景真源。
4. 场景事件至少携带 `scenarioId`、`scenarioVersion` 和 `scenarioRunId`。
5. 总装若选择新的 Checkpoint schema、baselineVersion 字段格式或事件合同，必须先形成公共 CR/Q 并暂停场景合并。
6. S004 不修改 M01—M06 Owner、C 合同、Foundation、T019 或 v1.0.3 发布文件。

## 已验证模块入口

M01—M06 均通过同 Origin iframe 加载，初始内部路由分别为：

```text
M01 #modeling
M02 #/resources
M03 #/ask
M04 #workbench
M05 #/agents
M06 #/lifecycle
```

M03/M04 的场景边界只影响 S004 运行状态和副作用门，不删除原有页面、入口和操作路径。

## 冻结范围与当前状态

v1.0.3 发布目录的 staged、unstaged 和 untracked 差异检查均为空；上述结论只覆盖该冻结目录，不代表整个工作树无其他历史 S004 改动。当前运行时适配仍不创建新的正式 Checkpoint、正式报告发布结论或对外 Action Request。总装前如需改变基线入口、版本字段格式、共享存储键或事件合同，必须先提交公共 CR/Q 并暂停场景合并。

当前工作树范围审计显示：全仓 tracked/staged diff 为空，`scenarios/s004/checkpoints/checkpoint-lib.mjs` 当前没有已跟踪修改；但 `scenarios/s004/artifacts/`、`scenarios/s004/evidence/`、运行时目录与 `tmp/` 下仍有未跟踪资料。本次运行时总装不得删除或把这些历史资料并入 v2.1.0 的基线兼容性结论；最终提交必须分开审计。另有 20 份旧 V2/V201 Checkpoint 只存在于未跟踪归档，恢复方式须先由总装裁决。

## 最终回归记录

- 自动化测试：129/129 通过；2026-08-17 在 S004 专用 4339 端口完成报告详情、问答、自动核验、M01 基线布局和 M02 文件下载位置回归。
- 同 Origin、同视口：1440×900、1280×720、390×844；M01—M06 共 18/18 通过。
- M01 不再插入私有语义总览卡或运行时横幅，目录与详情布局保持 v1.0.3；M02 下载入口收敛到快照历史；M06 完成 6 问题轮换、清空会话、核验动态和即时差异说明。以上均属于 v1.1.0 S004 运行时，不改变 v1.0.3 冻结入口。
- M06 最新实测问答为 `RUN-S004-COPILOT-20260816-005` / `SESSION-S004-COPILOT-20260816-005` / `RESULT-S004-COPILOT-20260816-005`；最新核验为 `VRF-S004-RERUN-20260816-867324240-pv0c8`，结果 18/18。页面重载后按 Run 序号恢复最新结果，不以可能回退的演示时间戳覆盖排序。
- M06 跨模块切换恢复：通过；恢复投影保留正式 HTML/PDF、报告身份和历史伴读 Run/Result/Session，同时允许当前隔离轮次追加新的 C024 问答和确定性核验 Run。新运行不覆盖历史制品。
- M05→M06 深链：通过；“从报告请求发起”落到 M06 `#/reports/generate`，新建模块 iframe 在 `about:blank` 阶段只更新声明的加载器 URL，真实 M06 就绪后才交付内部路由。
- M06→M02 数据准备深链：通过；未就绪借款人从报告生成页进入 `#module/data` / `#/resources`。总装导航白名单必须同时保留 M02、M05、M06 的已登记路由，不得把场景内跳转写死到某个开发端口。
- 报告定义和生成入口：目录只显示 1 条已启用定义；生成入口按借款人/贷款申请运行，当前借款人可进入 v1.0.3 六步向导，其他成员单位受数据准备门控制。总装不得把借款人选项退化为单一写死公司，也不得为未准备数据的公司伪造可生成状态。
- M05 Agent 详情：保留 v1.0.3 四个页签和原生操作；业务层不暴露 C022、内部绑定 ID 或运行时参数说明，资源与权限仍可查看 Prompt、Skill、工具和 Published 本体绑定。
- M06 新内容版本链：活动 Draft 在证据锁定、Agent 完成、草稿就绪、确定性核验和人工确认阶段保持当前身份；人工确认后只进入待发布，不自动发布，也不回落或覆盖历史正式报告。
- 报告工具栏取消“查看 PDF”按钮，只保留下载；基线“PDF 固定版”和导出完成入口仍采用既有 SAME_SOURCE_PDF 的 11 页兼容预览。总装不得把预览图登记为新的正式产物或证据真源。
