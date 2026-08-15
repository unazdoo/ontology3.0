# S001 v1.0.4 补丁工作区

## 工作区身份

- 产品父版本：`v1.0.3`
- Git 源标签：`prototype-v1.0.3-frozen`
- Git 源提交：`ea69e9ad3bceef93b000e6f3ddc639ab093e2515`
- 冻结 manifest SHA-256：`de0119608e26b09cfbdcf86143db95ca9446c25030453086b4f8c1e840af8ba1`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 冻结历史轮次：`S001-RUN-20260814062516042-e1fd5e6ab3f4`，仅作外部只读引用
- 分支：`codex/s001-v1.0.4`
- Git worktree：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/s001-v1.0.4`
- 唯一可编辑路径：`designs/prototype-work/v1.0.4/`
- 唯一工作入口：`s001-e2e-integration/index.html`
- 唯一用户走查入口：`completed-run.html`
- 建议端口：`4326`

## 允许范围

本工作区只修复 S001 用户评审范围内的原型缺陷、既有合同实现缺口、状态一致性、页面交互与回归问题。执行顺序固定为 `M02 → M01 → M03 → M04 → M06 → M05 → M06`，任一交接失败时停在准确阻断点。

## 禁止范围

- 不修改 `designs/prototype-releases/v1.0.3/` 或任何更早冻结目录。
- 不修改 `designs/prototype-work/v1.1.0/`、S002、S003、S004 或统一集成工作区。
- 不新增场景，不扩大跨模块合同，不修改六模块主文档或平台总控台账。
- 初始化时不包含或导入冻结历史 runtime、`completed-run.html`、`open-completed-run.html`、发布 manifest 或预置成功状态；当前候选制品均由本轮真实运行后重新生成。
- 不使用模块夹具、冻结 `15/15` 或旧浏览器存储替代本轮真实交换。

## 启动方式

```bash
python3 -m http.server 4326 --directory designs/prototype-work/v1.0.4
```

从工作入口开始新的运行时，必须使用独立 Origin 并从未开始状态生成新的 `scenarioRunId`。Action Request、提醒、待办、报告、Agent 结果和当前比较记录均由本轮真实操作形成。

当前候选走查入口：

```text
http://127.0.0.1:4326/completed-run.html
```

该入口先校验本轮运行快照，再恢复 `S001-RUN-20260815205357297-5625500f9a07`；不会把冻结 v1.0.3 的历史状态写入本工作区。

## 候选与冻结门

全部 P0/P1、控制台与 1440×900、1280×720、390×844 页面回归已绑定本轮新 `scenarioRunId` 关闭，现已生成 v1.0.4 候选 manifest、运行快照和用户走查入口。当前 `reviewEntry=true`、`acceptanceReady=false`；即使用户走查通过，也不自动表示模块设计评审、生产技术联调、S001 正式验收或一期验收通过。用户确认前不得将本目录复制为冻结发布。
