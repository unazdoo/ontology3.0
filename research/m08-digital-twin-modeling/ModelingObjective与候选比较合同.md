# Modeling Objective 与候选比较合同

> 状态：研究合同草案；S005 验证只证明工程可行性

## 1. Objective 最小合同

```json
{
  "objectiveId": "稳定标识",
  "revisionId": "不可变修订",
  "businessProblem": "待解决问题",
  "inputContract": "模型端口与语义要求",
  "outputContract": "输出及 resultKind",
  "trainingDataVersionId": "精确版本",
  "evaluationDataVersionId": "精确版本",
  "evaluationTransactionId": "精确 transaction",
  "featureSchemaVersion": "精确版本",
  "evaluatorVersion": "精确版本",
  "metricSchemaVersion": "精确版本",
  "missingDimensionPolicy": "策略版本",
  "reviewPolicy": "人工硬门",
  "businessTargetStatus": "APPROVED 或 PENDING_USER_DECISION"
}
```

S005 当前没有获批 target、label 和 ground truth，因此 Objective 必须声明 `comparisonPurpose=ENGINEERING_FITNESS_ONLY` 和 `businessTargetStatus=PENDING_USER_DECISION`；不得输出“预测准确率最高”或“业务最佳模型”。

## 2. 候选准入

每个 Candidate 必须：

- 归属同一 Objective Revision；
- 引用不可变 Model Version 和 content hash；
- 固定 author、code/artifact、environment、training data、feature schema；
- 公开输入/输出类型、单位、时间粒度、适用域和缺失策略；
- 不含 endpoint、credential、外部副作用或未登记依赖；
- 能在隔离环境重复运行；
- 未登记为 Published Metric/Rule/Model 或写入 T019。

候选变化必须形成新 Model Version；不能在比较完成后原地替换模型内容。

## 3. 公平比较指纹

同一比较组的固定键为：

```text
(objectiveRevisionId,
 trainingDataVersionId,
 evaluationDataVersionId,
 exactEvaluationTransactionId,
 featureSchemaVersion,
 evaluatorVersion,
 metricSchemaVersion,
 subsetDefinitionVersion,
 missingDimensionPolicyVersion,
 runtimeEnvironmentClass)
```

上述任一字段不同，必须拆为另一 Comparison。默认禁止跨 transaction 排名；若为了 schema 迁移做跨 transaction 对照，只能标为诊断，不能进入候选排名。

## 4. Experiment 与 Evaluation Run

Experiment 记录训练/参数试验；Evaluation Run 记录固定评估。两者都必须关联 Model Version，但不能互相替代。

Evaluation Run 最低输出：

- exact input transaction 和样本/subset hash；
- evaluator/metric schema/environment；
- 每样本状态、coverage、reason code；
- 指标及单位；
- deterministic rerun hash；
- constraint violations；
- failure/timeout/partial 状态；
- 完整证据位置和权限。

## 5. 一期比较指标

S005 缺少正式标签，本轮只比较：

| 指标 | 定义 | 使用边界 |
|---|---|---|
| coverage rate | 能在固定评估集上诚实形成结果的比例 | 缺失不得通过重分权伪造覆盖 |
| repeatability rate | 同输入/版本两次输出完全一致的比例 | 确定性模型必须为 1 |
| boundedness rate | 输出落在合同范围内的比例 | 越界为硬违规 |
| monotonicity rate | 预定义更差 probe 不应得到更好分数 | 只证明约束，不证明预测准确 |
| constraint violation count | 缺失策略、类型、范围和禁止行为违规数 | 排名首先按违规数 |
| score distribution | 均值/标准差等诊断 | 不用于宣称业务优劣 |

待 S005 Owner 提供 target/label/ground truth 后，才可另建预测或排序指标合同；新指标必须形成新 Objective Revision/Metric Schema 和历史回放。

## 6. 排名和人工硬门

一期确定性排序顺序：

1. `constraintViolationCount` 升序；
2. repeatability 降序；
3. monotonicity 降序；
4. coverage 降序；
5. 稳定 Candidate ID 仅作最终平局裁决。

排名只产生 `topCandidateId`，不自动产生 Release Candidate。流程为：

```text
Comparison complete
-> requestHumanReview(exact candidate + exact model version)
-> APPROVED | REJECTED | CHANGES_REQUIRED
-> only APPROVED may create RESEARCH_RELEASE_CANDIDATE
```

Release Candidate 固定：`published=false`、`productionEligible=false`、`t019WriteAllowed=false`。评审修改只能新建 Review/Submission，不能改写历史决定。

## 7. 发布绑定与回退

Binding 指向 Release Selector，而不是 endpoint。候选切换形成新 Binding Revision，保留旧新关系；回退只能指向此前已经人工批准且仍兼容的 Release Candidate，并形成新变更记录，不能把旧 Binding 原地改名为当前。

正式 Production/Staging 环境、自动升级、在线端点和回滚编排均后置，且须先裁决正式 Model Version/Release Pointer Owner。

## 8. S003 兼容边界

S003 Published Metric+Rule+Action Type 原子包及 C035 是 D094/C035 的特例。M08 不能把其 Draft/Published 状态机改造成 Candidate/Submission，也不能用 S003 执行器比较实验模型。可复用的只有：精确版本、稳定主键、非法值阻断、权重/阈值校验、结果证据、前序和重评关系。

## 9. 隔离验证证据

`validation/evidence/technical-validation-summary.json` 已证明：3 个候选使用同一 fingerprint；Legacy reweight 候选被约束违规降级；人工批准后才形成 research release candidate；未注册 Published，未写 T019。该证据不代表 S005 评价方法有效或模型可用于生产。
