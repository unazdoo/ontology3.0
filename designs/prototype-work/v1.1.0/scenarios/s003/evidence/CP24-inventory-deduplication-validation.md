# CP24 · 派生集成清单去重修正验证

## 节点身份

- Checkpoint：`CP-S003-20260817230000000-c02424000024`
- 父基线：`v1.0.3 / BSL-S001-V103-DE0119608E26`
- 场景：`S003 / S003-v1`
- 正式来源运行：`S003-RUN-20260817163000000-c02200000001`
- `acceptanceReady=false`

## 修正范围

CP23 保持不可变。本轮只修正派生模块集成清单的重复文件登记：将
`scenarios/s003/tests/state-persistence.test.js` 从 CP22 历史追加段的重复登记中移除，
并形成新的 v18 清单。没有改写 CP23 的 v17 清单、manifest、模块导出、Published 资源、
报告、行动申请、待办或浏览器历史状态。

## 清单结果

- v18 inventory：`resources/integration/v103-baseline-extension-inventory.v18.json`
- `inventoryId=S003-V103-BASELINE-MODULE-INTEGRATION-20260817-CP24-INVENTORY-DEDUPED-FINAL`
- `fileCount=186`
- 唯一路径数：`186`
- 重复路径：`0`
- v18 tree SHA-256：由清单自身 `treeSha256` 锁定。
- `--check --v18`：通过。

## 业务与运行不变性

- M01 模型配置仍为配置总览、调节因子配置、评分权重、风险分档配置四个页签；无企业因子配置。
- 黄灯、红灯、黑灯仍按亮灯形成一企一条预警；正式分布仍为绿 16、黄 4、红 1、黑 0。
- 驾驶舱提交后仍直达对应成员单位债务风险接口人；接口人确认并选择负责人后才形成待办。
- 正式来源运行、Published 模型、T053 输入快照和既有 Action Request 均保持原身份。

## 浏览器复测

- 使用保留的 S003 浏览器状态重新加载公共壳，未清空 localStorage，未创建新正式运行。
- CP23 清单已能正常读取，不再显示 `404 File not found`。
- 公共仪表盘、模型配置入口和统一场景入口均可加载；之前 CP23 的 console/page/request/HTTP 错误预算继续为 0。
- 本轮只读复测没有提交行动申请、确认接口人、形成待办或修改 Published 事实。

## 回归边界

- Foundation + M01—M06：`133/133` 通过。
- S003 现行测试：`198/198` 通过。
- 合计：`331/331` 通过。
- v1.0.3 冻结目录差异：`0`。
- CP01—CP23 不可变；CP24 仅追加清单去重修正及其证据。

