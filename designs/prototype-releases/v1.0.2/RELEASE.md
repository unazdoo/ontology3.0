# 智财问策原型 v1.0.2 冻结基线

本目录保存 S001 用户走查 P1/P2 修订完成后的不可变原型代码。它继承 v1.0.1 已发生的 `15/15` 历史运行，场景轮次为：

`S001-RUN-20260814062516042-e1fd5e6ab3f4`

## 运行

从仓库根目录启动独立静态服务：

```bash
python3 -m http.server 4323 --directory designs/prototype-releases/v1.0.2
```

打开：

```text
http://127.0.0.1:4323/completed-run.html
```

运行记录页只恢复上述精确历史轮次，不创建新的成功状态。恢复前会核对场景轮次及快照 SHA-256。

## 本版收口

- 修复报告空值乱码并清零文本资源中的 U+FFFD。
- 清理统一入口的重复账号、重复标题及内部术语。
- 统一本体管理语义图标，补齐外壳重新读取入口。
- 去重报告正文，重组报告详情操作区并保留危险操作确认。
- 将内部编号降级到次级信息或追溯层，统一“行动申请”“已处理”等产品文案。
- 保留同一 S001 运行快照、合同边界和正式业务标识。

完整变更记录保存在来源工作区 `designs/prototype-work/v1.0.2/CHANGELOG.md`。

## 冻结规则

本目录不得原地修改。后续问题只在 `designs/prototype-work/v1.0.3/` 修订。完整性检查：

```bash
node designs/prototype-releases/verify-release.mjs 1.0.2
```

本版本 `acceptanceReady: false`；冻结仅表示版本留档，不表示模块评审、S001 正式验收或一期验收通过。
