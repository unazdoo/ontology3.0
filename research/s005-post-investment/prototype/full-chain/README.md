# S005 v1.1.0 基线注入全链路

此入口不是独立 S005 驾驶舱套在平台壳中，而是从 v1.1.0 `s001-e2e-integration` 运行结构派生的场景注入版本。

## 源归档边界

本目录只保存 S005 特有的注入、适配、视图、路由和研究数据源。完整 v1.1.0 冻结底座、`BASELINE-*` 副本和本机绝对符号链接不进入研究源归档。

物化走查入口时，由总装工作树将这些增量源与 `prototype-v1.1.0-frozen` / `BSL-OFW-V110-94ABD0E991B7` 只读绑定。`baseline-v110` 只允许是本地临时绑定，不得提交。

## 物化后入口

```text
http://127.0.0.1:4355/full-chain/index.html
```

启动顺序：

```text
Foundation
  -> S005 baseline module adapter
  -> S005 scenario config
  -> S005 boot / native seed / research runner
  -> v1.1.0 shared Shell app.js
  -> module-frame
  -> S005 module loader
  -> loader document replacement
  -> native S005 module content
```

父页面使用基线的 `platform-shell`、`renderShell`、`navigation`、`route-stage`、`module-frame`、场景上下文和运行档案。M01—M06 的 `moduleSources` 在物化时指向真实 v1.1.0 发布入口；loader 只负责登记校验、场景上下文注入和隔离存储桥接，然后用文档替换加载原生模块页面，因此不会形成二层平台 Shell。

## 全链路走查

1. 首页点击“运行 S005 研究链路”，或进入对应模块后按阶段确认。
2. 链路按 M02 → M01 → M03（合规 / 市场横评）→ M04（池内选择）→ M05（交易与风险）→ M06（研究草稿）推进。
3. 每个阶段同时写入 v1.1.0 Foundation 的当前 `scenarioRunId`、Shell projection、模块 namespace 和事件账本。
4. 点击“新建 S005 研究轮次”调用 `directionalReset`，保留旧轮次上下文并重建六个模块 namespace。
5. M04/M05 只读展示研究结果，不创建 Action Request、提醒、审批、待办或交易指令。

## 基线证据

实现基线、治理父版本、注入顺序和模块路由合同由 `s005-config.js`、本文档和总装 manifest 共同记录。冻结源文件的完整性由 v1.1.0 发布基线自身校验，不在 S005 分支重复保存。

每个原生基线模块顶部只增加一条窄的 S005 注入带，显示当前场景上下文、阶段事实和证据状态；模块主体、原生路由和基线交互保持 v1.1.0 实现。页面中的研究数据仍是研究夹具：79 份快照、Wind `fund_type`、官方合规源、同类中位数 / 前三分之一、选择窗口、夏普和固定收益归因均明确标记为待正式数据接入或研究状态。
