# M07 来源登记

## 本地参考资料

| 来源 | 重点研究 | 限制 |
|---|---|---|
| `Palantir Foundry 2022 操作系统演示说明.docx` | Object Explorer、对象 360、Quiver、Map 与统一 Ontology Lens | 2022 演示，不代表当前产品状态 |
| `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4` | 页面流程和多视图交互证据 | 画面只作为参考，不复制品牌和产品结构 |
| `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4` | Ontology 作为对象、链接和动作复用边界 | 必须对齐本项目 M01 Owner |
| `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4` | 可见性、治理和变更边界 | 不自动形成平台合同 |
| `palantir系统截图.docx` | 视觉与交互模式对照 | 不作为功能存在性证明 |

根目录：`<PALANTIR_REFERENCE_ROOT>/`

## 官方研究要求

必须优先检索 Palantir 当前官方文档，重点核对：

- Ontology、Object Types、Properties、Links 和 Actions；
- Object Explorer / Object Views / Applications；
- Time Series、Quiver 或当前对应能力；
- Geospatial、Map 或当前对应能力；
- 权限、Branch、版本、血缘、查询 API 和 SDK；
- 当前产品名称、可用性、限制和许可边界。

每项外部能力必须登记官方 URL、文档更新时间、检索日期以及“可借鉴机制/不复制内容”。第三方文章只能作为线索，不能替代官方依据。

## 当前项目依据

- 平台总控与阶段1—6主文档；
- 当前组合工作树 VERSION、Foundation、资源注册和导航；
- S005 的对象、周快照与未来日频数据需求；
- 现有本体画布、智能问数 BI、报告阅读和仪表盘能力，避免重复建设。

## 证据分类

研究记录必须区分：官方当前能力、本地历史演示、当前项目已确认能力、技术试验结果、设计建议、待裁决事项。

## 本轮读取核对（2026-08-24）

| 来源 | 读取/核对结果 | 证据边界 |
|---|---|---|
| `Palantir Foundry 2022 操作系统演示说明.docx` | 存在；SHA-256 `0559970f34cc8564473392ef82af1cd93be305d9c98b882a169a5603d89f2c96`；mtime `2026-08-24T00:19:57+0800`；实际渲染 26 页 | 二手整理说明；低于原视频，不能证明当前能力 |
| `Foundry_2022_Operating_System_Demo_1080p_bilingual_hardsub.mp4` | 存在；SHA-256 `90be32d50960fb3be2d6d70166620deb9425484c2588f931d89d622fbdb8b61c`；48:58.368；1920×1080 | 历史页面流程和交互参考 |
| `Ontology_Your_Business_As_Code_1080p_bilingual_hardsub.mp4` | 存在；SHA-256 `d07e174270634acd9410af77a2d8ce4748a21a10805918d5fa702ab242eff4bb`；18:32.630 | 对象身份复用和 Action 边界历史参考 |
| `Ontology_Governance_Building_a_Robust_Ontology_1080p_bilingual_hardsub.mp4` | 存在；SHA-256 `94c0da9798122c4e7d1fafe266fd504c1aa62fd77ec2545b6120efba95708aec`；30:39.298 | DRY、扩展优于修改、组合优于深层继承的历史原则 |
| `palantir系统截图.docx` | 存在；SHA-256 `aea1d7417ff5fea74544f31500c62471b0ef842f3f1231f38ee3234973e345ab`；23 张图片；实际渲染 13 页 | 视觉参考，无图注/时间点/来源链 |
| `Palantir_Speedrun_E2E_Workflow_Course_Content.docx` | README 已列出但原表未登记；存在；SHA-256 `005b28b4f467f02a06e3c5b9c04881149d094dfa561e21a45db18374c8760c3` | 本轮只登记存在性；未作为 M07 结论主证据 |

## 当前官方文档登记

统一检索日期：`2026-08-24`。以下页面均未标示更新时间：

- Object Explorer：`https://www.palantir.com/docs/foundry/object-explorer/overview/`
- Object Explorer 保存/URL：`https://www.palantir.com/docs/foundry/object-explorer/save-explorations/`、`https://www.palantir.com/docs/foundry/object-explorer/generate-urls/`
- Object Views/URL/Profile：`https://www.palantir.com/docs/foundry/object-views/overview/`、`https://www.palantir.com/docs/foundry/object-views/generate-urls/`、`https://www.palantir.com/docs/foundry/object-views/config-profiles/`
- Vertex：`https://www.palantir.com/docs/foundry/vertex/explore-object-relationships/`、`https://www.palantir.com/docs/foundry/vertex/graphs-display-options/`
- Time Series/TSP API：`https://www.palantir.com/docs/foundry/time-series/time-series-properties/`、`https://www.palantir.com/docs/foundry/time-series/time-series-syncs/`、`https://www.palantir.com/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/stream-points/`
- Quiver 时序变换：`https://www.palantir.com/docs/foundry/quiver/timeseries-transform/`、`https://www.palantir.com/docs/foundry/quiver/timeseries-aggregations/`
- Geospatial/Map：`https://www.palantir.com/docs/foundry/geospatial/ontology/`、`https://www.palantir.com/docs/foundry/map/map-overview/`、`https://www.palantir.com/docs/foundry/map/selection/`
- 权限/Markings/质量：`https://www.palantir.com/docs/foundry/object-permissioning/ontology-permissions/`、`https://www.palantir.com/docs/foundry/object-permissioning/object-security-policies/`、`https://www.palantir.com/docs/foundry/security/markings/`、`https://www.palantir.com/docs/foundry/health-checks/overview/`
- API/规模：`https://www.palantir.com/docs/foundry/api/v2/ontologies-v2-resources/object-types/list-object-types/`、`https://www.palantir.com/docs/foundry/api/v2/ontologies-v2-resources/ontology-objects/search-objects/`、`https://www.palantir.com/docs/foundry/ontologies/oss-limitations/`

官方能力与本地历史资料的逐项结论见 [Palantir多视图能力对照.md](./Palantir多视图能力对照.md)。
