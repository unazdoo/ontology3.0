# M08 隔离技术验证

本目录只验证 `ofw.m08.research.v1` 研究合同，不注册 Published 模型，不写 T019，不接入组合工作树存储，也不创建 Action Request、通知、审批、待办或交易。

## 运行

```bash
npm test
npm run evidence
npm start
```

服务默认监听 `127.0.0.1:4357`，可通过 `M08_PORT` 覆盖。主要只读入口：

- `GET /health`
- `GET /v1/demo`
- `POST /v1/simulations/run`，请求体为 `{"caseId":"SC-S005-COMPOSITE-v1"}`

所有夹具均为合成研究数据。服务不接受模型端点、凭据、Webhook、Action 或外部连接配置。
