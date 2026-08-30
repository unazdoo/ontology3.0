# Lens 定义与深链合同草案

> 状态：研究建议；不是已生效导航、URL 或平台资源合同
> 研究原型端口：`4356`
> 研究命名空间：`ofw.m07.research.v1`

## 1. 边界事实

当前组合入口主要使用模块 hash 路由，部分返回位置保存在浏览器 `localStorage`；尚无能稳定表达对象、时间、地图范围、筛选和返回位置的公共深链合同。C033 要求稳定深链携带场景上下文并在返回后重读 Owner 权威状态，但 URL 不得携带成功状态。C034 拥有快照稳定入口，但当前只登记 M01—M06，不能直接宣称已覆盖 M07。

因此，下文是一个待 CR 的兼容目标。研究原型可实现相同字段和拒绝规则，但不得覆盖当前组合导航或写入其存储键。

## 2. 五类 Lens（建议）

| `lensType` | 核心任务 | 必须复用的对象上下文 | 一期不做 |
|---|---|---|---|
| `objectSearch` | 按 Published 类型、标题、获准属性和筛选发现对象 | Object Type、Published/C008/C017/C033 | 通用数据目录、源字段查询、任意 SQL |
| `object360` | 查看单对象属性、关系、质量、版本和证据 | 单一 ObjectRef | 编辑对象真值、M01 定义治理 |
| `relationshipGraph` | 以知识图谱式对象网络呈现选中对象的一至两跳获准 Link，显示方向、中文关系类型、对象类型和状态 | ObjectRef 集合、LinkRef、稳定布局 seed | 无界图遍历、空间几何、业务流程建模、未发布关系推断 |
| `timeSeries` | 系列叠加、滚动聚合、差分、阈值和事件定位 | ObjectRef、TimeSeriesRef、时间范围 | 新 Metric/Rule 公式、日频推断、任意脚本 |
| `spatial` | 图层、范围筛选、对象定位、geometry/CRS/有效时间查看 | ObjectRef、GeoRef、viewport/time range | GIS 编辑、地理编码真值、3D 地球、离线地图；关系只通过“打开关系图”回链，不在地图内重复呈现 |

Lens 切换只改变读取和呈现方式，不改变 ObjectRef、固定版本、权限用途、质量状态或证据来源。若目标 Lens 不适用，保留对象与返回上下文并显示原因，不创建空的假系列或假几何。

### 2.1 关系图与空间 Lens 的职责分离

关系图采用“知识图谱式呈现”，但它不是 M07 新建的知识图谱真源：节点必须是 M01 Published ObjectRef，边必须是获准 Published LinkRef；可显示方向、关系类型、有效时间、质量和授权状态，不得推断未发布关系。默认排除研究技术夹具，超出节点/边预算时显示截断原因。

空间 Lens 只负责 GeoRef、geometry、CRS、图层、有效时间、viewport/bbox、框选和定位。地图可以提供“打开关系图”回链，把当前对象和场景上下文带入关系图；不得在空间 Lens 内嵌通用关系图、用关系线替代 GeoRef，也不得将“未加载关系”显示为“无关系”。

## 3. LensDefinition（建议）

### 3.1 可持久化与不可持久化内容

| 可持久化 | 不得持久化 |
|---|---|
| `lensId/revision/type/name/purpose/status` | Object/Property/Link 完整定义或业务值 |
| Published 稳定资源引用和支持范围 | Draft 引用、显示名称唯一引用、“当前最新版” |
| 默认列、系列、图层、颜色 swatch、稳定布局策略 | 正式仪表盘/报告布局、Metric 公式、Rule 阈值 |
| 受控默认筛选和参数槽位 | 用户私有筛选值进入公共 Lens、SQL/脚本表达式 |
| 角色绑定引用和进一步收窄规则 | 角色成员、授权清单、身份 token |
| 证据/质量/版本显示策略 | C017/T019 的本地副本或“已通过”常量 |

### 3.2 版本规则

- 影响查询语义、资源引用、参数、角色适用范围或深链解释的修改必须形成新 revision。
- 只改变瞬态面板开合、缩放、hover 或当前选择不修改 Definition。
- 旧 revision 被正式深链或历史查询引用后保持只读；退休不删除历史。
- Published 语义版本改变时，Lens 进入 `needs_review` 或形成新 revision；不得按同名资源自动改绑。
- `active` 只说明 Lens 配置可选，不代表底层资源可访问、质量通过或正式验收。

## 4. ExplorationSession（建议）

Session 是一次探索运行资源，不是浏览器页面状态的别名。

| 字段组 | 必须内容 |
|---|---|
| 身份 | `sessionId`、namespace、创建/最近访问/到期时间、状态 |
| 使用者 | 不透明 `subjectContextRef`、purpose；不保存 token 或组列表 |
| 场景 | 完整 C033 五字段 |
| Lens | `lensId + revision + lensType` |
| 固定读取 | C007 Published、C008 投影、T007/T008、C017 两摘要引用 |
| 对象上下文 | 当前和已选 ObjectRef；不得只存显示名称 |
| 视窗 | 时间范围、地图 viewport、对象/属性/Link 筛选、排序 |
| 运行 | QueryRun 引用、状态、失败/废弃原因 |
| 导航 | 来源位置和允许的返回位置引用 |

建议状态：`active -> expired/closed/superseded`。版本或授权变化后旧 Session 不原地改绑；保留原运行证据并要求显式创建新 Session。会话到期不删除 Owner 资源，也不使旧结果继续可用。

## 5. 深链规范（建议）

### 5.1 路由形态

正式路由待平台裁决。研究原型仅在 4356 使用：

```text
http://127.0.0.1:4356/#/explore/{lensType}?ctx={opaqueContextToken}
```

推荐正式环境仍使用短的不透明 `ctx`，由服务端/受控状态库解析 `DeepLinkContext`；原因是对象和筛选可能敏感，完整筛选不应直接进入 URL、浏览器历史、日志或 Referer。`ctx` 不是授权凭据，打开时必须重新鉴权。

### 5.2 DeepLinkContext 最小字段

```json
{
  "schemaVersion": "ofw.m07.deep-link.v1",
  "contextId": "M07DL-OPAQUE-ID",
  "revision": 1,
  "scenarioContext": {
    "scenarioId": "S005",
    "scenarioVersion": "S005-v1",
    "scenarioRunId": "S005-RUN-...",
    "formedAt": "2026-08-24T00:00:00.000Z",
    "status": "active"
  },
  "lensRef": { "lensId": "LENS-ID", "revision": 1, "lensType": "timeSeries" },
  "publishedVersionId": "SEMANTIC-VERSION-ID",
  "authoritativeBindingRef": { "projectionId": "C008-PROJECTION-ID", "projectionVersion": "1", "dataVersionId": "T007-ID" },
  "trustContextRef": { "bindingSummaryId": "C017-BINDING-ID", "currentSummaryId": "C017-CURRENT-ID" },
  "objectRefs": [],
  "timeRange": { "start": "2025-02-21T00:00:00Z", "end": "2026-07-17T23:59:59Z", "zone": "Asia/Shanghai" },
  "mapViewport": null,
  "filters": [],
  "selection": null,
  "returnLocation": {
    "routeId": "platform-resource-id",
    "contextRef": "RETURN-CONTEXT-OPAQUE",
    "label": "返回来源"
  },
  "createdAt": "2026-08-24T00:00:00.000Z",
  "expiresAt": "2026-09-23T00:00:00.000Z"
}
```

### 5.3 稳定字段规则

| 上下文 | 规范 |
|---|---|
| 对象 | 使用完整 ObjectRef；标题只作展示 |
| 时间 | ISO 8601 起止、时区、边界包含规则；不使用“最近一年”作为持久化唯一值 |
| 地图 | `bbox + crs + zoom`；数值按固定精度规范化；选择对象与 viewport 分开 |
| 筛选 | 按稳定 Property/Link ID、typed operator/value 排序后规范化；不使用源字段名 |
| 系列/图层 | 使用 TimeSeriesRef/GeoRef 和 Lens 中的呈现 ID；不将颜色当系列身份 |
| 返回 | 使用平台已登记 `routeId + contextRef`；禁止任意外部 URL 和可执行 URI |
| 版本 | 固定 Lens revision 和精确 Published 版本；C008/C017 打开时重新读取 |
| 权威/可信度 | 只保存 C008/C017 稳定引用和版本，不保存摘要内容；打开时必须重读并核对 |

不得进入深链：授权 token、角色/组声明、隐藏属性值、完整业务结果、C017“通过”常量、T019 切换成功、Action 确认/待办状态、任意脚本、localStorage 键或跨租户目标。

## 6. 打开深链的门禁顺序（建议）

1. 校验 token 完整性、schema、到期时间、允许 origin 和 route；失败即拒绝。
2. 重新读取真实身份/授权上下文；深链中的旧权限结果无效。
3. 校验 C033：同场景同版本同轮次进入当前视图；历史只读轮次只允许历史查看；错配不静默迁移。
4. 读取 M01 C007/C004 并确认精确 Published 资源仍可定位；Draft、同名替代和“最新版”均不可接受。
5. 读取 M01 C008 与 M02 C017。若链接固定组合与当前组合不同，默认打开“固定历史上下文”或显示不可用；不得把旧对象和新数据拼接。
6. 按当前授权逐一解析 ObjectRef、PropertyRef、LinkRef、TimeSeriesRef、GeoRef；被撤权内容不返回。
7. 只有门禁完成后执行查询；任一关键门未知即 fail-closed。

### 6.1 版本变化行为

| 情形 | 行为 |
|---|---|
| Lens revision 仍存在，Published/C008 仍精确可用 | 按固定上下文打开 |
| Lens 已退休但 revision 可定位 | 只读打开并提示已退休；可显式复制为新草稿（不改旧引用） |
| Published 被替代但历史仍可访问 | 只读历史；提供“在当前版本重新开始”命令，形成新 Session |
| C008 已变化且旧组合不可消费 | 阻断业务值；显示版本差异和恢复建议 |
| C017 当前硬失败 | 阻断受影响的新查询/派生；历史结果只作带警告追溯 |
| ObjectRef 无权或不可定位 | 不显示旧标题/值；返回最小拒绝状态 |
| 场景轮次已重置 | 原轮次历史只读；不得自动改写成新 `scenarioRunId` |

## 7. 跨 Lens 与返回位置

Lens 切换必须保留一个不可变 `ObjectContext`：

```text
scenarioContext
+ publishedVersionId
+ ObjectRef(s)
+ purpose
+ subjectContextRef (重新鉴权)
+ applicable time/map/filter subset
```

不适用于目标 Lens 的字段被明确标记 `not_applicable`，而不是丢失后用默认值替换。示例：从时序切到空间时保留对象和时间范围；若无 GeoRef，空间页显示不适用并允许返回，不能显示空世界地图暗示无暴露。

“返回来源”恢复路由和用户选择，不恢复授权/质量成功。返回 M03/M04/M06 后，对方按自身合同重新读取 Owner 状态；M07 不携带“回答已成功”“请求已确认”“报告已发布”等状态。

## 8. 关系图稳定布局

关系图可保存 `layoutSeed + algorithmId/version + nodePositionOverrides`，但需满足：

- 节点键使用 ObjectRef 的规范哈希，边键使用 LinkRef + 两端 ObjectRef；
- 相同输入、算法版本和 seed 得到稳定初始布局；
- 用户拖动只更新 LayoutState，不改变关系事实；
- 新增/删除获权节点时尽量保持已有节点位置，并记录布局 revision；
- 被撤权节点连同边从结果移除，不保留可推断其身份的空洞标签；
- 布局版本变化不要求修改 Lens 的查询语义，除非改变默认展开或筛选。

## 9. 角色视图

`RoleViewBinding` 只描述“何种已授权用途可选哪个 Lens，以及在底层授权之上再隐藏什么”。有效权限为：

```text
effectiveAccess = identityAuthorization ∩ purposePolicy ∩ LensNarrowing
```

任何 union、默认放宽或以 Lens Owner 权限执行均禁止。角色视图不复制对象集合，不保存角色专属结果快照，不因分享链接向接收者转移发送者权限。

当前平台只能用模拟角色做交互验证。正式角色视图必须等待真实身份、用途授权、属性/关系/对象负向证据和缓存撤权测试。

## 10. 深链验收用例

1. 搜索选中对象后依次打开 360、关系、时序、空间，再返回搜索，ObjectRef 和 C033 不变。
2. 复制链接给无权用户，重新鉴权后不返回原用户可见值或标题缓存。
3. Published、C008、C017、Lens revision、场景轮次分别变化，均出现不同且可解释的关闭行为。
4. 时间范围跨 S005 缺表周，返回仍保留范围并显示 `source_missing`。
5. 无 GeoRef 的 S005 对象打开空间链接，显示“不适用/缺权威几何”，不生成坐标。
6. 返回 M04/M06 时只传稳定位置和对象上下文，不传确认、待办、发布或成功状态。
7. URL、浏览器历史、访问日志和 Referer 不出现敏感筛选值或授权 token。

上述用例在真实公共导航、身份服务和 Owner 接口完成前只能标记“隔离研究通过”，不能标记平台深链合同通过。
