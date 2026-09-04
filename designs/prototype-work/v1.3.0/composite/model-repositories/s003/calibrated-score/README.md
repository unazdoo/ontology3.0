# 概率校准评分模型

## 业务问题

企业当前正式债务风险评分与分档是什么？

## 模型身份

- Model ID: `MODEL-S003-CALIBRATED-SCORE`
- Model Version: `MODEL-S003-CALIBRATED-SCORE@0.1.0`
- 角色: 核心挑战者
- Objective: `MO-S003-FORMAL-DEBT-RISK-SCORE-v1`
- 运行策略: `calibrated_score`

## 输入与输出

输入字段：`liquidityCoverage`、`debtDue180Ratio`、`refinancePressure`、`relationExposure`、`anomalyZ`。

输出字段：`calibratedProbability`、`candidateRiskScore`、`candidateRiskTier`。

所有输入必须来自 M02 已冻结的脱敏 synthetic DataVersion，并通过 M01 周期语义合同核对单位、时间粒度、空值和结果身份。缺失值不会补零；结果会保留置信度与缺失原因。

## 本地运行

```bash
python3 model.py --input input.json --output result.json
python3 -m unittest discover -s tests -v
```

## 版本与发布边界

代码提交、分支、标签和发布候选由 M08 模型代码仓管理。提交形成不可变快照；标签不可移动；Release Candidate 不等于正式发布。AI 不得修改正式模型、生成标签、选择冠军或自动发布。

该仓库默认用于候选或补充模型研发，只有完成统一评测、影子观察和人工应用确认后，才可能进入消费绑定。
