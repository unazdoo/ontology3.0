# M07-M08 S001 v1.1.0 基线增量

这是在 frozen v1.1.0 统一工作台上的 M07 探索分析与 Objective-first M08 模型模拟增量，不是替代版平台壳。

## 基线

- frozen 实现基线来源：`prototype-releases/v1.1.0`
- 活动实现基线：`v1.1.0`
- 活动实现基线快照：`BSL-OFW-V110-94ABD0E991B7`
- 治理父版本：`v1.0.3`
- 治理父版本快照：`BSL-S001-V103-DE0119608E26`
- M08 研究命名空间：`ofw.m08.research.v1`
- M07 研究命名空间：`ofw.m07.research.v1`
- M08 隔离验证服务：`127.0.0.1:4357`
- 基线统一工作台展示服务：`127.0.0.1:4358`

`s001-e2e-integration/index.html/app.js/data.js/state.js/styles.css` 保留 frozen release 的真实壳、导航、状态合同和模块适配器。研究增量新增 `exploration` 与 `modeling` 路由、模块登记和内容页；不改六个既有 canonical 模块的界面或生产 workflow。

## 入口

```text
http://127.0.0.1:4358/s001-e2e-integration/index.html#home
```

进入左侧“探索分析”，按“选择对象 → 观察与定位 → 进入模型与模拟 → 返回并列查看”完成案例。M07/M08 内容页均由基线壳使用同一 `module-view/frame-stage/module-frame` 机制挂载，内容页自身不创建第二套 `platform-shell`。

启动研究验证服务：

```bash
cd research/m08-digital-twin-modeling/validation
npm start
```

## 真实交接

1. M02 数据工程和 M01 本体管理仍使用 v1.1.0 canonical 页面完成上传、正式运行、发布、映射和 Published/T019 交接。
2. 基线父壳向 M07/M08 发送当前 S001 C033、`S001_STORE.getProjection()` 的只读投影、精确 `dataVersionId`、`ontologyVersionId` 和 `bindingId`。
3. M08 在上游投影完整时才允许调用 4357 候选比较；缺失或错配保持阻断。
4. 候选评审、Binding 和 Simulation Run 调用 4357 的研究资源接口，不写基线生产状态、T019、Action Request、待办或交易。
5. M07 以精确 ObjectRef、SeriesRef、时间范围和版本形成研究交接；M08 把它们固定进 Simulation Run，输入变化后旧结果标记过期。
6. M08 结果通过父壳返回 M07，只读并列展示；两模块均不推进 v1.1.0 的 15-step workflow。
7. M08 目录覆盖预测、分类、评分和优化；输入输出、Binding、消费者和结果展示均由 Objective schema 驱动。
8. M07/M03/M05/M06 使用不同只读 Consumer Projection；M04 对非事实结果显示明确拒绝原因。

报告、Agent 和决策中心仍是基线模块。尚未登记跨 Owner 消费 CR 前，M08 只提供只读深链和 consumer contract，不宣称它们已经把模拟结果写入正式报告或行动状态。

## 研究边界

4357 的 S001 夹具是合成工程适配数据，不是 S001 真实融资事实或预测准确率证明。v1.1.0 仍是活动实现基线，M08 仍为研究态，`acceptanceReady=false`、Published 模型登记和 T019 写入均禁止。

验证记录见 [INTEGRATION-VERIFICATION.md](./INTEGRATION-VERIFICATION.md)。
