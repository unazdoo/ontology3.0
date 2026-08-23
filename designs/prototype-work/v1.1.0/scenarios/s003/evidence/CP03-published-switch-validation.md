# CP03 Published 切换与首次正式评估验证

- 形成时间：2026-08-15T13:30:00.000Z
- 新场景运行：`S003-RUN-20260815133000000-c03503000001`
- 来源运行：`S003-RUN-20260815123937016-96a195ed3f4c`
- Published 模型：`S003-M01-DEBT-RISK-PKG@1.0.1`
- 评估时点：`2025-12-31`

## Published 生命周期

- 从既有 Published 1.0.0 创建 Draft，经校验后发布为 1.0.1。
- 本次为正式化切换，不改变15项指标、权重、六项因子、风险阈值和 Action Type 业务参数。
- Published 快照 SHA-256：`26401065109b3e39bfb3d5ac0b3bf106876f3efe89542c128ff40eca6365acec`。

## 首次正式评估

- 评估企业：21 家；C035 结果：21 条；Published 事实：21 条。
- 风险分布：绿 16、黄 4、红 1、黑 0。
- 处置候选：9 条；Action Request：0；负责人待办：0；通知：0。
- 所有处置候选均保持待人工确认状态，未触发外部副作用。
- CP03 尚未生成正式企业报告，报告由后续 M06 节点消费 C035/T019 形成。

## 资源哈希

- `d6f108423e2ae5010dfb1ebb2522fca0aa62f758ba99f31f4bf22b412b66767e  resources/m01/published-pointer.v1.json`
- `c6cd7b3d9495e23ab6128619446afa2e79420d9d5f2ac00e2f3fd204980af010  resources/m01/evaluation-run.v1.json`
- `10e8ca2284abaaf680b549b6da3c5374ac6168a5e9b4bbe6d0abbcdb864b6153  resources/m01/c035-risk-results.v1.json`
- `8d31823a37c2b4949d01b5a2d2744607bddb7f9c2ee54e2e3c8e9acfebe74099  resources/m01/published-risk-facts.v1.json`
- `7d0d3d65fc89688d4b2d839218245251c6b53ca28f5f171273b1e532a8ba4c60  resources/m01/runtime-export.v1.json`

## 恢复与重放边界

- 本轮使用独立 scenarioRunId，未覆盖 CP01/CP02 运行身份。
- 历史查看只读；恢复或回归必须克隆到新的 scenarioRunId。
- 历史处置候选不得自动重放为 Action Request、通知或待办。
