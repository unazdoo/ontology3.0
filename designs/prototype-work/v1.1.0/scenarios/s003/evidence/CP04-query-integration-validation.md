# CP04 只读问数联调验证

- 形成时间：2026-08-15T14:00:00.000Z
- 场景运行：`S003-RUN-20260815133000000-c03503000001`
- 问数运行：`S003-M03-QUERY-RUNTIME@1.0.0`
- 结果集：`S003-M03-QUERY-RESULTS-20260815-001@1.0.0`

## 联调结论

- 六个固定问题均从同一轮次 C035 与 Published Fact 读取。
- 企业详情和最低三项使用 `S003-ENT-001` 作为稳定穿透夹具。
- 查询结果全部为只读，未修改 Published 事实。
- Action Request、负责人待办和通知创建数均为 0。
- Draft、错误场景身份、错误 scenarioRunId 和事实不一致均由 M03 服务阻断。

## 资源哈希

- `4680d2f78295d12a76acde3bc7ddcd66338aa51e727beb1bd98bb8be0294e6e6  resources/m03/query-runtime.v1.json`
- `0a8f5b66d4b268060d4871d558d4b9c51c11afa9b5fe87e742fdf07ca2a30ee3  resources/m03/query-results.v1.json`

## 恢复边界

- 历史查看只读展示既有查询结果，不重新计算或触发副作用。
- 恢复和隔离回归必须克隆为新的 scenarioRunId。
