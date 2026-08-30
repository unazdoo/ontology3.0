# 模型输入输出 Ontology 绑定合同草案

> 状态：研究建议。正式绑定需要 M01/M08 拆责 CR，本文不创建 Published Property 或 T019

## 1. 目标

应用、Agent、Lens 和报告应读取稳定的业务语义与 Release Selector，不应知道模型运行在何处、使用何种 endpoint、容器或供应商。Binding 必须同时满足：

- 可追到 Published Ontology 的精确 Object/Property 版本；
- 可追到人工批准的精确 Model Version；
- I/O 类型、单位、时间粒度、可空性和 resultKind 一致；
- 模型切换不要求消费者改 endpoint；
- 预测输出不会覆盖事实 Property；
- 模型端点、token、credential 和部署拓扑不进入消费者包络。

## 2. Owner 拆分

| 内容 | Owner | 说明 |
|---|---|---|
| Object Type/Property 的业务含义、单位、Published 生命周期 | M01 | M08 不创建或改义 |
| 模型端口/API schema、Model Version | M08 研究；正式 Owner 待裁决 | 只描述模型能力，不接管 Ontology |
| Property↔Port Mapping 草案、兼容校验 | M01+M08 双回执 | 任一方拒绝则 Binding 不可用 |
| Release Selector/Binding Revision | 待 CR | 不能与 T019 混为同一指针 |
| Runtime endpoint 解析 | 后置运行控制面 | 消费者不可见 |
| T019 | M01 唯一 Owner | Binding 无权写 T019 |

## 3. Binding 最小结构

```json
{
  "bindingId": "稳定标识",
  "bindingRevisionId": "不可变修订",
  "objectiveId": "目标",
  "publishedOntologyRef": "精确 Published 语义版本",
  "inputMappings": [
    {
      "modelPort": "returnRatio",
      "objectTypeRef": "InvestmentProduct@version",
      "propertyRef": "ytdReturnRatio@version",
      "type": "double",
      "unit": "ratio",
      "timeGrain": "as_of",
      "nullable": false
    }
  ],
  "outputMappings": [
    {
      "modelPort": "score",
      "objectTypeRef": "InvestmentEvaluation@version",
      "propertyRef": "predictedEvaluationScore@version",
      "type": "double",
      "unit": "score_0_100",
      "resultKind": "PREDICTION"
    }
  ],
  "releaseSelector": {
    "kind": "RELEASE_CANDIDATE_OR_RELEASE",
    "releaseId": "稳定发布标识",
    "modelVersionId": "精确模型版本"
  },
  "compatibility": "VALIDATED",
  "t019WriteAllowed": false
}
```

研究阶段 `publishedOntologyRef` 只能是外部精确引用或 `REQUIRES_M01_CR`，不能伪造 Published 版本。

## 4. 输入校验

每个 Input Mapping 必须检查：

1. Object Type/Property 在精确 Published 版本中存在且当前调用者有权读；
2. Property 类型可无损映射到模型端口；枚举、时区、精度和 null 语义明确；
3. 单位维度和换算版本明确；金额同时固定币种和金额单位；
4. 时间粒度、as-of、有效区间和观察窗口兼容；
5. 对象/对象集合的基数、稳定主键和排序要求明确；
6. 输入对应精确 T007/T008/C017，不能从页面或最新默认值取数；
7. 缺失、NOT_APPLICABLE、UNKNOWN 和非法值分别处理；
8. feature transformation 若存在，必须是版本化资源，不能藏在页面、Prompt 或数据管道临时配置中。

## 5. 输出校验

1. 输出端口必须映射到独立的预测/模拟语义，不能覆盖 observed fact Property。
2. 每个输出携带 `resultId/resultKind/modelVersionId/inputDataVersionId/asOf/coverage/evidence`。
3. `PREDICTION` 可绑定 `predicted*` Property 或独立 Result Object；`SIMULATION` 默认只能进入 Simulation Result，不物化到真实 Object。
4. 数值范围、单位、枚举和不确定性/coverage 必须可验证；越界输出阻断。
5. 批量物化若未来获批，必须使用独立数据/结果版本和原子发布，不得在原事实列混写。

## 6. Endpoint 隐藏

消费者投影允许看到：Binding ID/Revision、Objective、I/O Mapping、Release Selector、Model Version、status、evidence 和权限。

消费者投影禁止出现：

- `endpoint`、URL、Target RID 或容器地址；
- token、credential、secret、egress policy 细节；
- 副本数、GPU/CPU、供应商路由和 failover；
- 可直接绕过 Binding 调用底层模型的工具。

运行控制面内部可把 Release Selector 解析为实现，但每次解析必须留下 Runtime Binding 记录。`validation/src/model-governance.mjs` 对任何 endpoint/token/credential/secret/url 字段执行递归拒绝测试。

## 7. 兼容性和切换

| 变化 | 处理 |
|---|---|
| 仅模型内部权重变化，I/O 不变 | 新 Model Version；重新评估、人工批准和新 Release；Binding selector 新 Revision |
| 输入/输出端口变化 | 新 Binding Revision；全量类型/单位/时间校验；消费者兼容测试 |
| Ontology Property 弃用/改义 | M01 新 Published Revision；旧 Binding 保留历史，只能迁移到新 Revision |
| 数据/Feature schema 变化 | 新 Evaluation Comparison；旧排名不可沿用 |
| 模型失败/不兼容 | 保留上一获批 Release Selector；不自动回退到未评审候选 |
| 研究候选撤销 | Binding 状态 `REVOKED`；历史结果仍可定位 |

切换 Release Selector 不等于切换 T019。T019 仍只由 M01 原子管理 Published 语义与可消费数据组合。

## 8. S005 草案映射

当前合成夹具映射 `returnRatio`、`largestPositionRatio`、`liquidityAssessment`、`creditQualityAssessment` 到研究评分端口。其中后两项在真实 S005 资料中不存在，明确标为 `SYNTHETIC_ONLY_CURRENTLY`；它们只验证类型和失败状态，不能进入正式评价。

输出使用 `predictedEvaluationScore` 和 `predictedEvaluationCoverage`，`resultKind=PREDICTION`。真实评价结果若未来存在，必须使用不同 Property/Result Object 和权限。

## 9. 待裁决

正式 Binding/Release Pointer Owner；预测结果是否允许物化；Property 命名和版本；M07/M06 的 source envelope；在线 Function 是否进入一期；外部托管模型是否允许；Binding 和 T019 的跨合同原子性。
