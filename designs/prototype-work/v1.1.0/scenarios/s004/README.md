# S004 财务公司贷款贷前调查独立场景包

> 当前状态：S004 独立场景实现、合成演示材料、六模块 Owner 投影、报告产物、受控发布指针和分步 Checkpoint 已完成独立验收，可按 D093 进入统一 `v1.1.0` 集成回归。本目录中的完成演示不代表 M01—M06 模块评审通过、S001 正式验收通过或一期验收通过。

## 1. 启动方式

从 S004 独立 worktree 根目录启动：

```bash
python3 -m http.server 4334 --directory designs/prototype-work/v1.1.0
```

打开：

```text
http://127.0.0.1:4334/scenarios/s004/index.html#home
```

主要场景路由：

```text
#home
#flow
#module/data
#module/ontology
#module/query
#module/decision
#module/agent
#module/report
#checkpoints
#evidence
```

## 2. 固定基线与场景身份

| 项目 | 固定值 |
|---|---|
| 父基线 | `v1.0.3` |
| 基线快照 | `BSL-S001-V103-DE0119608E26` |
| 原型工作版本 | `v1.1.0` |
| 场景 | `scenarioId=S004` |
| 场景版本 | `scenarioVersion=S004-v1` |
| 完成演示轮次 | `S004-RUN-20260815124059209-4d35e1ed1b61` |
| 轮次形成时间 | `2026-08-15T12:40:59.208Z` |
| 分支 | `codex/s004-v1.1.0` |
| 独立端口 | `4334` |

完成演示入口、M01—M06 导出、报告证据和 CP00—CP60 均绑定上述固定轮次。用户执行“重置当前场景”时由 C033 Foundation 创建新的 `scenarioRunId` 和隔离命名空间，不覆盖完成演示轮次。

## 3. 已完成范围

### 3.1 场景壳

- 复用 `v1.0.3` 的导航、顶部状态、模块卡片、流程、弹窗和响应式视觉语言。
- 使用 `OFWScenarioFoundation.createNamespacedStorage()` 保存可丢弃的浏览器工作投影。
- 支持场景首页、15 步完整流程、六模块投影、Checkpoint 目录和证据索引。
- 支持上游门禁、处理中状态、失败提示、人工复核表单和定向重置。
- 场景壳只汇总和定位 Owner 状态，不成为第二套数据、本体、Agent、报告或快照真值。

### 3.2 六模块投影

| 模块 | S004 实现范围 | 明确边界 |
|---|---|---|
| M01 本体管理 | 贷前对象、关系、Metric、Rule、Action Type、Published/T019/C008 投影 | 场景壳不切换 Published，不生成自动授信结论 |
| M02 数据工程 | 公开年报、合成缺口、质量、C017、数据资产和 C003 交付投影 | 年报已有事实不重复造数，Agent 不直接读取工作簿 |
| M03 智能问数 | CP30 明确 `NOT_APPLICABLE`，问数 Run 和 Result 均为 0 | 不为凑齐模块预置问数结果 |
| M04 决策中心 | CP40 明确无用户标准 Action Request，提醒、审批、通知和待办均为 0 | 人工报告复核不等同于 Action Request |
| M05 Agent 应用 | 固定证据包、结构化草稿、工具白名单和只读报告伴读 | 不选“最新数据”、不重算 Metric、不发布报告、不创建行动或待办 |
| M06 报告中心 | 正式报告定义、证据包、稳定锚点、确定性核验、人工确认和同源 HTML/PDF | Agent 草稿不是正式报告，已发布版本不原地更新 |

### 3.3 已形成的场景制品

- 权威制品目录：`artifacts/index.json`。
- 六模块导出目录：`module-exports/index.json`。
- Checkpoint 目录：`checkpoints/index.json`。
- 证据目录：`evidence/index.json`。
- 固定演示夹具：`fixtures/s004-demo.json`。
- 合成上传资料包：`artifacts/data/S004_贷前调查合成演示资料包.xlsx`。
- 受控 HTML 与同源 PDF：`artifacts/report/`。

## 4. 数据分类

| 分类 | 数量/范围 | 使用规则 |
|---|---|---|
| `official-public` | 2023、2024、2025 三份正式年报 | 复用主体、股权、经营、财务、公开融资担保和受限资产事实，不重复制造上传数据 |
| `synthetic-demo` | 9 个缺口来源节点 | 仅覆盖成员资格、贷款申请、内部授信、现有用信、征信、评级、用途合同、还款计划和现场调查 |
| `human-confirmed` | 数据口径、调查意见、风险判断、授信决定、额度、利率、条件及发布授权 | 必须由对应人工责任标签确认，Agent 和 Rule 不得代写决定 |
| `derived-deterministic` | 正式 Metric、资金需求、Rule 运行和核验结果 | 由 Published 定义和确定性程序形成，不由 LLM 重算 |

质量策略明确区分缺失、冲突、过期、不可核验、默认和不适用；不存在用零值掩盖缺失的逻辑。2023 原始口径与 2024/2025 重述可比口径分开保存。

## 5. 稳定身份与正式报告

| 资源 | 稳定标识 |
|---|---|
| 财务公司 | `FC-DEMO-001` |
| 借款人 | `BORR-CN-USCC-91440300093677087R` |
| 集团成员 | `MEM-CGN-003816` |
| 贷款申请 | `APP-S004-20260815-0001` |
| 报告资源 | `RPT-S004-20260815-0001` |
| 报告编号 | `S004-PLR-2026-0001` |
| 报告定义 | `RDEF-S004-LOAN-PREFLIGHT-001` |
| 证据包 | `EVP-S004-20260815-0001` |
| 人工确认 | `HCONF-S004-20260815-0001` |
| 确定性核验 | `VERIFY-S004-20260815-0001` |
| Published 指针 | `T019-S004-PUBLISHED-001` |

正式报告定义采用六部分结构：借款人评价、借款人经营情况、借款人财务情况、借款风险分析、授信结论、数据来源。

当前最新演示发布为内容版本 `1.0.1`：

```text
artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.html
artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf
```

`1.0.1` 仅修正 PDF 封面打印页眉裁切，业务事实、人工授信结论、证据包和六个稳定锚点未变化。原 `1.0` HTML/PDF 继续只读保留，未被覆盖。

## 6. 最小完整闭环

```text
场景配置与稳定身份
→ official-public / synthetic-demo 数据接入
→ 数据质量与 C017
→ 数据资产发布和 C003 交付
→ Published 本体、Metric、Rule、T019/C008
→ M03 不适用边界
→ M04 无 Action Request 条件门
→ M06 固定证据包
→ M05 结构化草稿
→ M06 事实及稳定锚点绑定
→ 确定性核验
→ 人工调查、风险复核和授信决定
→ 同源 HTML/PDF 发布
→ M05 只读报告伴读
```

演示人工决定为 `APPROVE_WITH_CONDITIONS`：人民币 50,000 万元、一年期流动资金信用贷款、固定年利率 2.35%，四项执行条件全部来自人工输入。该演示决定不代表真实生产授信批复。

## 7. Checkpoint 与恢复

| 阶段 | 节点 | 主要锁定内容 |
|---|---|---|
| CP-S004-00 | `initial-configured` | 基线、场景身份、配置、模块版本与功能开关 |
| CP-S004-10 | `data-connected` | 数据来源、人工输入、质量和 C017 |
| CP-S004-20 | `published-switched` | Published 资源、T019/C008 与模块回执 |
| CP-S004-30 | `query-integrated` | M03 `NOT_APPLICABLE` 和零问数结果 |
| CP-S004-40 | `decision-chain-completed` | M04 无 Action Request、通知、审批和待办 |
| CP-S004-50 | `agent-report-dashboard-completed` | 固定证据、Agent 草稿、人工确认、核验和报告发布 |
| CP-S004-60 | `e2e-integrated` | 六模块导出、正式产物和端到端证据 |
| CP-S004-PRE-* | `pre-risk-change` | 升版或高风险修改前的不可变保护点和回退目标 |

正式快照真值是 C034 manifest、六模块 Owner 导出和 detached SHA-256。浏览器存储、DOM、临时 JSON 和目录复制均不是正式快照。

- 历史查看保持原 `scenarioRunId`，只读且不重跑业务。
- 克隆恢复创建新 `scenarioRunId` 和空隔离命名空间，不覆盖历史。
- 隔离回归关闭 Action Request、通知、审批、待办和外部派发。
- 基线迁移必须创建新 `scenarioVersion`、新运行轮次和迁移对照。

## 8. 测试与当前交付门

### 8.1 前端静态检查

```bash
for f in designs/prototype-work/v1.1.0/scenarios/s004/*.js \
  designs/prototype-work/v1.1.0/scenarios/s004/contracts/*.js \
  designs/prototype-work/v1.1.0/scenarios/s004/module-views/*.js; do
  node --check "$f"
done
```

本轮结果：通过。场景声明和 `_d_meta.json` 也已完成 JSON 解析校验。

### 8.2 浏览器回归

动态检查已覆盖：

- 10 个场景路由；
- 固定 C033 运行身份；
- 六模块 Owner 导出和四类资源索引读取；
- 从初始状态推进至 `15/15`；
- 人工确认前发布门关闭，确认后 HTML/PDF 入口形成；
- 桌面页面无横向溢出；
- 控制台 `0 error / 0 warning`。

完整自动浏览器命令：

```bash
node designs/prototype-work/v1.1.0/scenarios/s004/tools/verify-browser.mjs
```

### 8.3 Checkpoint 合同测试

```bash
node --test designs/prototype-work/v1.1.0/scenarios/s004/tests/checkpoint-contract.test.mjs
```

2026-08-15 22:17（UTC+08:00）完成受控发布指针提升和追加式快照后，最新结果为 `27/27` 通过。新增且不可变的保护点/完成点包括：

- `CP-S004-PRE-20260815140408000`：锁定指针提升前的 `data.js`、资源索引和旧 M06 Owner 导出；
- `CP-S004-50-POSTFIX-20260815141021000`：锁定内容版本 `1.0.1` 的报告完成状态；
- `CP-S004-60-POSTFIX-20260815141021100`：锁定内容版本 `1.0.1` 的端到端完成状态。
- `CP-S004-DELIVERY-20260815145500000`：锁定独立验收、集成交接说明与最终代码树，作为 integration 汇入来源快照。

原 CP00—CP60、PDF 修复 PRE、旧 `1.0` HTML/PDF、旧发布清单和旧 M06 导出均保持原哈希不变。当前消费指针统一指向 `1.0.1`，历史查看和恢复仍可引用旧版本，不存在原地覆盖。

## 9. Integration 汇入

详细交接见 [INTEGRATION-HANDOFF.md](./INTEGRATION-HANDOFF.md)。核心规则：

1. 按 D093 在 S002、S003 之后汇入 S004。
2. 原样汇入整个 `scenarios/s004/`，不得拆散场景身份、制品、Owner 导出和 Checkpoint 证据。
3. 只有 integration 分支可修改统一场景注册、公共导航、共享壳、`VERSION.json`、`WORKSPACE.md`、根 `CHANGELOG.md` 和候选 manifest。
4. S004 分支不得修改 Foundation、S001、六模块共享目录或其他场景。
5. 汇入后必须在同一 Origin 回归 S001、S002、S003、S004，重点验证存储隔离、场景切换、刷新、重置、恢复和正式报告入口。

## 10. 明确不在范围内

本场景一期明确不包含：

- DOCX 正式产物；
- 电子签章；
- 外部报送；
- 复杂审批流或生产级多角色权限矩阵；
- 自动授信、自动“风险可控”判断；
- Agent 自动发布报告；
- Agent 自动创建 Action Request、审批、通知或待办；
- 独立智能问数运行；
- 新增驾驶舱或其他一级模块功能。

需要上述能力时必须有新的资料证据、Owner 设计、公共合同复核和独立授权，不得由场景窗口自动扩展。
