# M07 Palantir 多视图能力对照

> 证据类型：官方当前文档 / 本地历史资料 / M07 设计建议。官方页面统一检索日期：`2026-08-24`；页面未标示更新时间时明确写“未标示”，不推断 CMS 时间。

## 结论摘要

当前官方文档可以确认 Object Explorer、Object Views、Vertex、Time Series、Map、OSDK 与 Ontology API 分别提供对象发现、对象视图、关系图、时序和空间能力；没有发现一个跨五类 Lens 的统一 `LensDefinition`、短生命周期 `LensSession`、跨 Lens snapshot token 或统一稳定深链合同。M07 因此应在平台合同层自定义资源与深链包络，但只保存定义/会话/查询上下文，不复制 M01 对象真值、M02 数据版本或 M03/M06 正式结果。

## 能力矩阵

| 研究能力 | 当前官方确认 | 官方来源（检索 2026-08-24，更新时间未标示） | M07 借鉴 | M07 不复制/限制 |
|---|---|---|---|---|
| 对象搜索/筛选 | Object Explorer 支持关键词、属性过滤、对象集探索、表格、Object View、跨应用打开 | [Object Explorer 总览](https://www.palantir.com/docs/foundry/object-explorer/overview/)；[搜索对象](https://www.palantir.com/docs/foundry/object-explorer/search-objects/) | 对象目录、类型筛选、游标上下文、结果视图 | 不复制私有 URL 过滤 JSON；不在 M07 创建 Object Type |
| Object 360 | Standard/Configured Object Views，Full/Panel 两种形态，集中展示属性、Links、相关应用 | [Object Views](https://www.palantir.com/docs/foundry/object-views/overview/) | `ObjectRef` 驱动属性、关系、质量、版本、证据页签 | Profile 只是呈现配置，不能当权限；不维护第二套属性 |
| 关系图 | Vertex 支持 Search Around、属性过滤、保存资源、布局选项和模板 | [探索对象关系](https://www.palantir.com/docs/foundry/vertex/explore-object-relationships/)；[图显示选项](https://www.palantir.com/docs/foundry/vertex/graphs-display-options/) | 一至两跳、质量筛选、确定性环布局、关系状态 | 官方未承诺跨客户端布局稳定；M07 固定自己的布局算法和预算，不复制图资源真值 |
| 时序 | TSP 由 `seriesId`、timestamp、value 构成；支持 qualified ID、unit/interpolation、range/aggregate、Arrow；Quiver 支持 rolling、difference、derivative 等 | [Time Series Properties](https://www.palantir.com/docs/foundry/time-series/time-series-properties/)；[Time Series Syncs](https://www.palantir.com/docs/foundry/time-series/time-series-syncs/)；[TSP API](https://www.palantir.com/docs/foundry/api/v2/ontologies-v2-resources/time-series-properties/stream-points/)；[时序变换](https://www.palantir.com/docs/foundry/quiver/timeseries-transform/) | `TimeSeriesRef`、粒度、缺失策略、滚动/差分/阈值事件 | 官方未给出统一点级质量/修订/业务粒度语义；M07 不把空点当 0、不临时重算 Metric |
| 空间/地图 | geopoint/geoshape、WGS84/RFC7946、空间索引；Map 支持图层、对象选择、框选/相交、Search Around、时间 | [Ontology geospatial](https://www.palantir.com/docs/foundry/geospatial/ontology/)；[Map 总览](https://www.palantir.com/docs/foundry/map/map-overview/)；[Map selection](https://www.palantir.com/docs/foundry/map/selection/) | WGS84 存储规范、`GeoRef`、图层、bbox、有效时间、关系展开 | 不把 S005 缺失 geometry 伪装成位置；Map tile 功能降级需显式显示 |
| 角色视图/权限 | Object type 与实例权限分开；属性策略可返回 null；markings 传播；Profile 控制 tab 可见性但不授权数据 | [Ontology permissions](https://www.palantir.com/docs/foundry/object-permissioning/ontology-permissions/)；[Object security policies](https://www.palantir.com/docs/foundry/object-permissioning/object-security-policies/)；[Markings](https://www.palantir.com/docs/foundry/security/markings/)；[Profiles](https://www.palantir.com/docs/foundry/object-views/config-profiles/) | 每次查询按调用人重授权，`REDACTED` 与 `MISSING` 分列 | 研究原型只能模拟角色，不宣称已接通平台授权；不复制数据作角色缓存 |
| 保存/分享 | Saved Exploration 保存搜索参数、过滤器、布局；分享不会授予底层对象访问权 | [保存探索](https://www.palantir.com/docs/foundry/object-explorer/save-explorations/) | Lens Definition 保存可复用视图定义，Lens Session 保存短期上下文 | M07 深链不采用官方私有 JSON 格式；分享不扩大权限 |
| 深链 | Object View 支持 Object RID/PK；Object Explorer 支持 object type/object set/filter；Graph/Map template 可预载对象 RID | [Object View URLs](https://www.palantir.com/docs/foundry/object-views/generate-urls/)；[Object Explorer URLs](https://www.palantir.com/docs/foundry/object-explorer/generate-urls/)；[Map templates](https://www.palantir.com/docs/foundry/map/templates/) | 版本化 `DeepLinkEnvelope`，带对象、时间、bbox、筛选、Lens、返回位置和 C008/C017 引用 | 官方未确认统一 filter DSL、bbox、时间范围、滚动位置跨 Lens 往返；打开必须重读权威状态 |
| 规模/性能 | OSv2 默认 100k 对象、Search Around leaf 10m/总加载 30m；TSP 以 points scanned 计费；地图 tile 只加载视口简化 geometry | [Ontology Search/Object Set limitations](https://www.palantir.com/docs/foundry/ontologies/oss-limitations/)；[Time Series compute usage](https://www.palantir.com/docs/foundry/time-series/compute-usage/)；[Map object loading](https://www.palantir.com/docs/foundry/map/objects-loading-methods/) | 本地硬门、分页/采样/聚合和超门限失败关闭 | 官方没有统一 UX SLA；本地合成 benchmark 不构成生产容量承诺 |

## 本地历史资料对照

本地《Palantir Foundry 2022 操作系统演示说明.docx》及三部视频记录了对象详情、权限覆盖、Data Health、时序叠加、地图图层和对象选择；`palantir系统截图.docx` 展示了对象 ID、Links、Time Series、Vertex、Map 的历史界面。它们是历史设计参考，不是当前产品证明；原始视频没有独立字幕轨，截图集缺少图注与来源链。具体时间点和哈希见本工作区 `SOURCE-REGISTER.md` 对账记录及本地资料审计输出。

## 对 M07 的直接取舍

1. 采用“一个对象上下文，多个 Lens”作为产品结构，但把跨 Lens 共用身份、权限、质量、版本和证据写成自己的平台合同。
2. 采用 Palantir 公开机制中的可复用视图、对象/关系/时序/空间分层，不使用 Palantir 产品名称、品牌、私有 URL 或页面复制。
3. 把 `Published semantic version`、`authoritative data binding`、`data snapshot`、`SDK package version`、`graph/map template version` 分列，禁止聚合成一个 `version` 字符串。
4. 对没有官方统一定义的部分（Lens Session、稳定深链、点级质量、空间有效时间、百万级 UX 门）只登记为 M07 建议或待裁决，不伪装成官方事实。
