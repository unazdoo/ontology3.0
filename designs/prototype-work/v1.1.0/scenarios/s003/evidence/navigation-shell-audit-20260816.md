# S003 公共壳导航与路由装配审计

- 审计日期：2026-08-16
- 工作树：`codex/s003-v1.1.0`
- 基线：`v1.0.3 / BSL-S001-V103-DE0119608E26`
- 范围：公共壳、S003/S001 入口、M01—M06 iframe 导航与事件桥接
- 明确未修改：`designs/prototype-releases/v1.0.3/`、M06 报告中心文件、CP01—CP13

## 问题矩阵

| 范围 | 当前装配 | 偏差 / 风险 | 根因 | 处理 |
| --- | --- | --- | --- | --- |
| S003 公共侧栏 | 侧栏和顶栏同时显示“当前场景” | 同一场景标签重复，占用一层导航空间 | v1.0.3 公共壳的静态场景说明与 v1.1.0 场景选择器并存 | 仅 S003 隐藏侧栏静态场景标签，顶栏保留唯一可切换上下文 |
| M02/M03/M04/M05/M06 | 外壳已显示当前一级模块，iframe 二级栏再次显示模块标题 | 看起来像额外一层重复菜单 | iframe 适配保留了完整 `product-nav-head` | 仅 S003 隐藏 `product-nav-head`；二级菜单项、数量、状态、页脚均保留 |
| M01 | iframe 二级栏只有“产品 / 语义资产”与场景脚注 | 无重复模块标题；属于真实二级导航 | M01 本身没有 `product-nav-head` | 不改，保留基线资源入口 |
| M01—M06 平台栏 | iframe 自带 `platform-rail/app-rail` | 若可见会造成两套一级导航 | 公共壳已有 v1.0.3 适配规则 | 浏览器确认均不可见，无需新增处理 |
| 模块顶栏 | iframe 顶栏与公共顶栏可能重复 | 双顶栏风险 | v1.0.3 iframe 适配语义 | M01/M02/M04/M05/M06 原顶栏隐藏；M03 仅保留数据上下文卡，无重复导航 |
| S003 入口 | `scenarios/s003/` | 独立产品壳风险 | 历史 S003 文件仍保留 | 当前入口立即 `location.replace` 到公共壳，未加载独立 S003 app/style/state |
| 模块默认路由 | M02 `#/resources`、M01 `#modeling` 等 | 专用页面劫持风险 | 旧保存位置可能引用废弃私有 hash | 公共壳继续迁移废弃 hash 到基线入口；浏览器确认六模块均进入基线页面 |
| 事件桥接 | 捕获 iframe 内跨模块链接 | 可能误伤模块内交互 | 公共壳需要维持统一场景身份 | 未发现 `stopImmediatePropagation`；模块内 hash 正常，跨模块映射仅 `preventDefault` 后交由公共壳导航 |

## 修改

1. `s001-e2e-integration/app.js`
   - S003 条件隐藏侧栏重复场景标签。
   - S003 条件隐藏 iframe 的 `.product-nav > .product-nav-head`。
   - 不隐藏 `.product-nav`、`.product-nav-item` 或模块工作区。
2. `scenarios/s003/tests/navigation-assembly.test.js`
   - 固定 S003 条件去重、S001 原导航不变、六模块二级菜单和公共入口仍存在、无 `stopImmediatePropagation`。

## 浏览器验证

- 入口：`scenarios/s003/` 正确进入 `s001-e2e-integration/index.html?scenarioId=S003#home`。
- S003：一级路由 8 个且无重复；侧栏 `nav-context` 可见数为 0，顶栏场景选择器可见数为 1。
- S001：侧栏 `nav-context` 可见数为 1，顶栏场景选择器可见数为 1；保持原基线表现。
- M01—M06：真实 `product-nav` 全部可见且至少有一个交互入口。
- S003 中存在 `product-nav-head` 的 M02/M03/M04/M05/M06 均不可见；S001 中对应标题仍可见。
- M02 模块内从 `#/resources` 切换到 `#/pipelines?tab=definitions` 时，外壳保持 `#module/data`；切到 M01 后使用返回按钮可恢复 M02 及其内部 hash。
- S003、S001 全模块 console error、page error、request error、HTTP error 均为 0。
- `node --check`、2 项定向 Node 测试、`git diff --check` 均通过。
- `designs/prototype-releases/v1.0.3/` 差异为 0。

## 截图

- `browser-nav-audit-20260816/s003-data-navigation.png`  
  SHA-256：`fb68d72312d3c6fbb52815b1bc2ed226942d9346c711615b35923608e58d22b7`
- `browser-nav-audit-20260816/s001-data-navigation.png`  
  SHA-256：`2221df00ca9a64c9ed6b3d9a6feab7b2cda1cd703d1cdfead9658b2294a29557`

## 边界说明

- 基线模块中显式使用 `window.open(..., "_blank")` 的辅助深链仍按 v1.0.3 行为保留；它不是模块默认入口，也不替换统一场景主路径。直接拦截会破坏部分跨模块合同窗口与回执语义，因此本轮未改写。
- 当前修正不创建新模块、不接管模块根节点、不整页重绘，也不修改 M06。
