# 关系传染风险模型

## 业务问题

担保、股权、关联交易和共同债权人会形成哪些风险路径？

## 模型身份

- Model ID: `MODEL-S003-CONTAGION`
- Model Version: `MODEL-S003-CONTAGION@0.1.0`
- 角色: 补充模型
- Objective: `MO-S003-CONTAGION-v1`
- 运行策略: `contagion`

## 输入与输出

输入字段：`relationExposure`、`guaranteeEdges`、`ownershipEdges`、`relatedTradeEdges`、`sharedCreditorEdges`。

输出字段：`relationRiskScore`、`relationRiskPath`。

所有输入必须来自 M02 已冻结的脱敏 synthetic DataVersion，并通过 M01 周期语义合同核对单位、时间粒度、空值和结果身份。缺失值不会补零；结果会保留置信度与缺失原因。

## 本地运行

```bash
python3 model.py --input input.json --output result.json
python3 -m unittest discover -s tests -v
```

## 版本与发布边界

代码提交、分支、标签和发布候选由 M08 模型代码仓管理。提交形成不可变快照；标签不可移动；Release Candidate 不等于正式发布。AI 不得修改正式模型、生成标签、选择冠军或自动发布。

该仓库默认用于候选或补充模型研发，只有完成统一评测、影子观察和人工应用确认后，才可能进入消费绑定。
