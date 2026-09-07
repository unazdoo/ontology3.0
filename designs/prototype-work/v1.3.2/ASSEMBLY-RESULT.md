# v1.3.2-rc.1 总装结果

日期：2026-09-06。唯一入口为 composite/s001-e2e-integration/index.html。

当前本机走查服务：静态端口 4382，模型端口 4383。原有 4362/4363 服务未停止。

启动方式：

```sh
OFW_STATIC_PORT=4382 M08_PORT=4383 node designs/prototype-work/v1.3.2/composite/start-candidate.mjs
```

## 验证

- 本版及复用运行时 Node 测试：91 项。
- 原有完整浏览器回归：50 个业务域/模块组合，另含三档视口、原有业务链路和 Python 实际执行。
- 新增 UX 回归：36 项，覆盖 1440×900、1280×720、390×844、五域对象到报告往返、图谱操作、分享链接、错误恢复及编辑导出。
- v1.1 继承能力回归：15 项，覆盖三档视口的配置、会话、决策深链及正式报告伴读/核验。
- 滚动与可读性回归：90 项，检查首页及 29 个模块/任务在三档视口中是否能滚动到底、字体是否过小、是否出现裁切或横向溢出。
- 企业身份与地图专项：8 项浏览器检查；21 家企业统一身份、30 个新增演示坐标，融资与风险模型返回同一企业。
- 五个业务域均完成候选、三段 Shadow、复评、Release Candidate、Binding 和压力模拟。
- 投后实际模块链路 7/7；正式模型和事实指针不变，外部副作用为 0。

最终状态以 composite/evidence/browser-regression.json、composite/evidence/ux/regression.json 和 composite/evidence/node-regression.json 为准。

## 交付

对照报告：V12-PARITY-AUDIT.md、V11-PARITY-AUDIT.md。变更清单：ACTUAL-CHANGES.md。剩余边界：OPEN-ISSUES.md。

不改写 v1.1.0、v1.2.0、v1.3.0 和 v1.3.1。没有生产部署、真实金融执行或外部数据上传。acceptanceReady=false。
