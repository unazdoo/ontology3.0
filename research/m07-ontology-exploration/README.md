# M07 Ontology 多视图探索研究工作区

## 工作树身份

- 工作树：当前 `codex/m07-ontology-exploration-research` 工作树
- 分支：`codex/m07-ontology-exploration-research`
- 创建基线提交：`f3c80ba5e5e70929fd0628c798c4878048924bbd`
- 治理参考基线：`v1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 预期产品来源：当前四场景组合版本正式冻结后的产品基线
- `baselineStatus = 待正式冻结`
- `rebaseRequired = true`
- `acceptanceReady = false`
- 建议隔离端口：`4356`
- 建议研究命名空间：`ofw.m07.research.v1`

> 治理观察：总控拟将 `v1.1.0` 设为后续实施和新增研究的统一活动基线，`v1.0.3` 保留为只读历史父版本、迁移来源和回退基线。本工作区记录该拟议方向，但在用户裁决/CR/正式冻结前仍保持 `rebaseRequired = true` 与 `acceptanceReady = false`。

M07 是平台公共能力研究，不是 S005 私有页面，也不直接复制 Palantir 产品。

## 模块定位

M07 研究同一 Published Ontology 的多种只读用户 Lens：

1. 对象搜索与对象 360；
2. 关系图探索；
3. 时序探索；
4. 空间探索；
5. 按角色、用途和对象类型配置的视图定义；
6. 从任一 Lens 回到相同对象、属性、版本、质量、权限和证据。

对象、属性、链接、Metric、Rule、Action Type 和 Published 生命周期仍归本体管理。M07 只发现、查询、可视化和保存视图定义，不维护第二套对象或业务事实。

## 参考资料

### Palantir 本地资料

根目录：`<PALANTIR_REFERENCE_ROOT>/`

优先读取：

- `Palantir Foundry 2022 操作系统演示说明.docx`
- `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4`
- `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4`
- `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4`
- `Palantir_Speedrun_E2E_Workflow_Course_Content.docx`
- `palantir系统截图.docx`

重点参考 Object Explorer、对象 360/Lens、Quiver、Map、Ontology 权限和血缘。资料反映不同时间的产品状态，必须与当前 Palantir 官方文档核对，不能把旧演示自动视为当前能力。

### 首个验证场景

- S005 工作树：只读 `s005-research` 工作树
- 投资资料：`<S005_INVESTMENT_SOURCE_ROOT>/`

S005 可验证产品、管理人、发行人、持仓和风险事件的对象 360，以及净值/收益/风险时序和地域暴露；M07 的资源模型必须保持跨场景通用。

## 一期最小化原则

一期只验证：

- 相同对象在搜索、360、关系、时序和空间视图间保持同一稳定身份；
- 视图只读消费 Published Ontology 和权威数据组合；
- 权限、质量、版本和证据随对象与属性进入视图；
- 时序支持叠加、滚动聚合、差分、阈值和事件定位的最小集合；
- 空间支持图层、范围筛选、对象选择和关系展开的最小集合；
- 深链和返回保持对象、时间范围、空间范围和筛选上下文；
- 无时序或空间属性的对象诚实显示不适用。

一期默认后置：通用无代码应用搭建器、复杂 GIS 编辑、3D 地球、任意 Python 导出执行、协同批注、离线地图、实时流式大屏和跨租户共享。

## Owner 边界

- M01：Ontology 对象、属性、链接、动作、Published 版本和可见性定义；
- M02：时序、空间和对象属性的权威数据版本、质量与可复现摘要；
- M07：Lens 定义、探索会话、只读查询、图形布局、用户筛选和深链；
- M04：需要改变业务状态的动作与人工确认；
- M06/仪表盘：正式业务报告和管理驾驶舱，不由 M07 重复建设；
- 平台公共层：场景身份、Checkpoint、权限上下文和导航。

当前 Owner 和合同均为研究建议，未经总控裁决不得写成生效合同。

## 预期研究制品

1. `Palantir多视图能力对照.md`
2. `当前平台能力与缺口矩阵.md`
3. `M07资源模型草案.md`
4. `对象时序空间最小查询合同.md`
5. `Lens定义与深链合同草案.md`
6. `权限质量版本证据传播规则.md`
7. `S005验证数据映射.md`
8. `性能与规模技术验证计划.md`
9. `一期范围与后置能力.md`
10. `待用户裁决与CR建议.md`
11. `S001集成变体与浏览器验证.md`
12. `M07-S001全链路验证.md`

独立研究原型入口为 `../../designs/m07-ontology-exploration-research/index.html`，与 S001/S005 脱敏验证资源、合同测试和性能证据一并保留。可合并交付以 `../../integration-exports/v1.2.0-rc.1/m07/` 为唯一集成包；`v1.1.0-s001-full-chain` 组合副本、早期 `v1.1.0-s001` 变体和浏览器截图不属于研究源归档。

## 允许与禁止

允许在本工作区创建研究文档、隔离原型、查询适配器、性能夹具和测试。禁止修改 M01—M06、平台总控、当前组合、S005/M08 工作树或原始资料；禁止复制对象真值、绕过权限读取数据、在 Lens 中维护 Action 状态或把研究推荐升级为用户裁决。

启动时使用同目录的 [START-PROMPT.md](./START-PROMPT.md)。
