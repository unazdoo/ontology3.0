# CP06 M06 企业报告验证

- 形成时间：2026-08-15T15:10:00.000Z
- 场景运行：S003-RUN-20260815133000000-c03503000001
- 场景版本：S003-v1
- 原型版本：1.1.0
- 报告数量：21
- 风险分布：绿 16、黄 4、红 1、黑 0

## 验证结论

- 21 家企业均由同一轮次 Published C035 与风险事实生成正式报告内容和 HTML/打印制品。
- 每份报告均包含评分、风险档位、15 项指标、6 项调节因子、默认语义、规则说明和证据引用。
- 报告深链精确绑定 scenarioId、scenarioVersion、scenarioRunId、prototypeVersion、enterpriseId 与 reportId。
- scenarioVersion 保持权威运行身份 S003-v1；原型交付版本独立记录为 1.1.0。
- 在建企业固定 60 分、盈利历史不足按 A=100、适用因子缺失套零、不适用单独标记等规则均写入报告解释。
- 报告生成不重算风险分，不创建 Action Request、负责人待办、审批或通知。
- M06 沿用报告中心和场景工作台，不创建新一级模块或 S003 专属 Agent。

## 资源哈希

- 9e358adb6d1d308a04169d679bd94f848a8256ac782890eda572dd31d377f457  resources/m06/report-contract.v1.json
- ffa14290df718b0283df9714a7d519d1a74f75c1ee6d506ea60a7dca75835df6  resources/m06/report-contents.v1.json
- 25d4d254055bcd598de62c9a2c2dd789430ac5918fdc48adfc5500dcd4808a8b  resources/m06/report-artifacts.v1.json
- 0993bb872a2b6d7cec47744c65851cb815d5d552ab60d254edf38f764e96db9d  resources/m06/report-manifest.v1.json

## 不可变与恢复语义

- 本脚本只创建缺失资源；任何既有资源或 sidecar 内容不一致时均拒绝覆盖。
- 历史报告使用原 scenarioRunId 只读查看；从快照恢复或回归时必须创建新的 scenarioRunId。
- HTML 与 print-to-pdf 共享同一 reportId、内容版本和场景身份。
