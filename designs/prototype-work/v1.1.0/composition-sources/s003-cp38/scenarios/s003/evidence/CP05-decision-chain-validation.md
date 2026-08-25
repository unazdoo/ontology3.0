# CP05 通用决策链验证

- 形成时间：2026-08-15T14:30:00.000Z
- 场景运行：`S003-RUN-20260815133000000-c03503000001`
- 候选总数：9
- 人工确认：1 条红灯处置候选
- Action Request：1
- 负责人待办：1
- 通知：0；审批流程：0；多用户权限：关闭

## 边界

- 候选不会自动创建 Action Request。
- 只有人工确认并指定负责人后，才通过通用决策中心入口生成 Action Request 和负责人待办。
- 一期不设置复核人、不建设多级审批和多用户经办权限。
- 隔离回归使用 regression 模式，历史处置不重放。

## 资源哈希

- `0bee1570bb2c64367a1d996e478af979164c6ba50c64327e8669a49c120e55a2  resources/m04/decision-runtime.v1.json`
- `b21dcb8aa0092df23e6ed3b802602775ac3c1a396fb9f6b5fffceb69ad0dd43b  resources/m04/decision-results.v1.json`
