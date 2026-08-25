# CP12 预备浏览器证据：M01 Published / C008-T019 / 配置扩展

- 时间：2026-08-16T09:25:00+08:00
- 地址：`http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home`
- 浏览器：Chromium 149.0.7827.55（Playwright，headless）
- 来源运行：`S003-RUN-20260815133000000-c03503000001`
- 基线：`v1.0.3 / BSL-S001-V103-DE0119608E26`

## 实际操作

1. 从统一公共壳进入 M01，默认落在原生 `#modeling` 建模入口。
2. 进入原生“已发布”目录，看到 `企业债务风险评估模型`，版本 `V1.0.1`。
3. 打开本体详情与精确版本详情，保留版本概览、资源构成、映射、数据与消费、更新与回退、记录与证据等基线页签。
4. 在同一精确版本上打开条件式 `模型配置` 页签，确认显示“债务风险模型配置”“评分权重”“调节因子系数”“风险分档阈值”。
5. M02 工作投影损坏后，M01 Published 目录、版本详情和配置页签仍可只读加载。

## 结果

- iframe 路径仍为 `ontology-management-review/canvas-first/index.html`，未跳转 `scenarios/s003` 独立原型。
- 配置页签 URL：`#published/version?id=S003-M01-DEBT-RISK-V1&tab=s003-model-config`。
- 页面错误：`console error = 0`，`page error = 0`，请求失败 `= 0`，HTTP 错误 `= 0`。
- 浏览器扩展警告（iframe sandbox）不属于应用错误，未计入应用错误预算。

本文件是追加的验证证据，不是 Published 事实、T019 记录或正式 Checkpoint；待 CP12 统一封存时引用。
