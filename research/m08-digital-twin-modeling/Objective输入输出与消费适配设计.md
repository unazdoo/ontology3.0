# Modeling Objective 输入输出与消费适配设计

> 原型版本：`m08-s001-v1.1.0-baseline-additive.5`
> 状态：隔离研究合同与可运行原型；不代表正式平台 API 或 M08 已立项

## 1. 目标

将 M08 从单一利率情景页面改成 Objective-first 公共能力：

```text
Objective Revision
  -> Input / Output Contract
  -> Candidate / Evaluation / Review
  -> Release Selector / Binding Revision
  -> Consumer Projection
  -> Result Envelope / Simulation Use Case
```

Simulation Case 是已绑定 Objective 的使用方式，不属于 Objective 生命周期。

## 2. 通用 Objective Registry

当前研究 Registry 验证四种目标：

| Kind | 样例 | 默认非事实身份 | 典型展示 |
|---|---|---|---|
| `FORECAST` | S001 融资成本预测 | `PREDICTION` | 时序事实与预测区间 |
| `CLASSIFICATION` | S002 预算超支预警 | `PREDICTION` | 等级与概率 |
| `SCORING` | S004 贷前风险评价 | `PREDICTION` | 分数、等级、复核标志 |
| `OPTIMIZATION` | S001 债务结构优化 | 一期仅 `SIMULATION` | 方案集、目标值、约束状态 |

预测和优化拆成两个 Objective，各自拥有 Revision、评估协议、Release 和 Binding。

## 3. Binding Revision

Binding 由 Objective schema 动态形成，不允许场景页面硬编码业务类型。每个端口至少校验：

- `objectTypeRef / propertyRef`；
- `type / shape / cardinality / nullable`；
- `unit / timeGrain`；
- 输入来源 Owner；
- 输出 `resultKind / outputKind`；
- 精确 Published Ontology 和 Release Selector。

输出默认进入 `RESULT_OBJECT_FIELD / RESULT_SERIES / RESULT_SET`，不得覆盖事实 Property。递归拒绝 endpoint、URL、token、credential、secret 和运行拓扑。

Binding schema 校验与人工批准分离：草案可以得到 `compatibility=VALIDATED`，但未批准 Release 时保持 `BLOCKED_RELEASE_NOT_APPROVED`，校验操作不会自动形成 Review 或 Release。

## 4. Consumer Projection

同一个 Binding 和 Result 按消费模块与意图生成安全投影：

| 消费者 | 允许能力 | 研究预览 |
|---|---|---|
| M07 探索分析 | 发现兼容 Objective、读取、比较、返回 M08 | 时序、对象等级、评分或方案比较 |
| M06 报告中心 | 固定结果和证据快照 | 报告结果块和证据表 |
| M03 智能问数 | 引用主输出和区间 | 只读回答证据卡 |
| M05 Agent 应用 | 解释固定结果 | 解释面板，不重算 |
| M04 决策中心 | 默认拒绝非事实来源 | `NON_FACT_SOURCE_REJECTED` |

消费者不可见具体模型 endpoint，也不能改变 Result ID、resultKind、事实写入或行动来源权限。

## 5. 统一 Result Envelope

跨模块结果至少携带：

```text
resultId / resultKind / outputKind
objectiveId / objectiveRevisionId
bindingRevisionId / releaseId / modelVersionId / runId
subjectRefs / inputSnapshot
resultItems[]: label / shape / value / unit / horizon / coverage / displayHint
evidenceRef / permissionScope
factWriteAllowed=false / actionSourceAllowed=false
```

M07 当前已使用通用 `resultItems[]` 渲染返回结果；旧的 score/impact 三字段只保留兼容回退。

## 6. M07 兼容发现

M07 交接 `ObjectRef + Object Type + SeriesRef + timeRange + data/ontology version + intent`。M08 先查询兼容 Objective，再进入目标概览；不直接跳到 `SC-S001-COMPOSITE-v1`。

当前示例：`FinancingEntity@ONT-SYN-S001-FINANCING-v1 + SIMULATION` 解析到 `MO-S001-COST-FORECAST-v1`。`FinancingPortfolio` 才兼容债务结构优化 Objective。

## 7. 验证

- 43/43 研究服务测试通过；
- 5/5 frozen 父壳静态回归通过；
- Objective 类型、Object Type 兼容查询、Binding 单位漂移拒绝、消费者裁剪和 M04 阻断均有自动测试；
- 浏览器验证四类 Objective 切换、动态输入输出、Binding 校验、五类消费者视图、M07 兼容发现、Objective 绑定 Simulation Run 和通用结果返回；
- 390x844 下目标目录、Binding 和消费者页面无内部横向溢出。

上述通过不等于真实数据 API、身份权限、正式 Binding、用户评审或一期验收通过。
