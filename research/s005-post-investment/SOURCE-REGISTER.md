# S005 来源登记

## 业务资料

| 来源 | 路径 | 当前角色 | 使用规则 |
|---|---|---|---|
| 投资策略报告 | `$S005_SOURCE_ROOT/附件2：财务公司2026年度投资策略报告--20251218.docx` | 业务目标、产品范围和风险偏好参考 | 只读；区分策略目标与已发生事实 |
| 投资台账快照 | `$S005_SOURCE_DIR/` | 真实周期间持仓与投资明细来源 | 只读；逐文件登记日期、哈希、表结构和记录数 |
| 后续按日快照 | 用户后续提供 | 日频变化、收益和风险分析候选来源 | 未提供前不得假设存在 |

## 方法研究来源

优先研究并保留引用日期和方法版本：

- Morningstar 风险调整后收益、同类组和多周期稳定性方法；
- Lipper 总回报、持续回报、资本保全等分类；
- Fitch、S&P 等固定收益基金信用、市场、流动性和管理能力方法；
- 晨星中国、银河证券、海通证券、上海证券、Wind 等国内公开评价方法；
- 财务公司监管、投资业务、会计分类和风险管理相关有效规则。

公开方法只能作为研究输入，不能直接复制星级、评级、阈值或权重。

### 本轮已核验公开来源（检索日期 2026-08-24）

| 机构 | 文档/页面 | 日期/版本 | URL | 证据边界 |
|---|---|---|---|---|
| Morningstar | The Morningstar Rating for Funds | 2023-05-11 | `https://www.morningstar.com/business/insights/research/methodology-documents?document=4TUVHVD4HRFL2HWJAS3MWZIZAU` | 历史同类风险调整后收益；不覆盖信用/流动性/实际现金流 |
| Morningstar | Morningstar Medalist Rating 2026 变更说明 | 2026-04-23 | `https://www.morningstar.com/funds/whats-changing-not-changing-with-morningstar-medalist-rating` | 前瞻 People/Process/Parent/Price；不能与星级混用 |
| LSEG | Lipper fund performance | 当前产品页 | `https://www.lseg.com/en/data-analytics/asset-management-solutions/lipper-fund-performance` | 当前产品范围/分类能力；不含完整现行算法 |
| Refinitiv Lipper | Lipper Leaders Introduction，RE1260174/9-20 | 2020-09 | `https://lipperalpha.refinitiv.com/wp-content/uploads/2016/01/RE1260174_IA_factsheet_A4_Lipper-Leaders-Intro.pdf` | 历史可核验详细版，不能表述为 2026 完整现行算法 |
| Fitch | Money Market Fund Rating Criteria | 2024-07-26 | `https://www.fitchratings.com/research/fund-asset-managers/money-market-fund-rating-criteria-26-07-2024` | 本金/流动性信用意见，不是收益评级 |
| Fitch | Bond Fund Rating Criteria | 2025-06-13 | `https://www.fitchratings.com/research/fund-asset-managers/bond-fund-rating-criteria-13-06-2025` | 信用质量和市场风险双轴 |
| S&P Global Ratings | Principal Stability Fund Rating Methodology 更新公告 | 2025-11-20 | `https://www.spglobal.com/ratings/en/regulatory/article/-/view/type/HTML/id/3482811` | 本金稳定基金评级，不是普通债基历史星级 |
| S&P Global Ratings | Fixed-income funds 在用准则目录 | 当前目录 | `https://www.spglobal.com/ratings/en/regulatory/ratings-criteria/-/articles/criteria/financial-institutions/filter/fixed-income-funds` | FCQR/FVR 版本与范围；完整模型参数未公开 |
| 晨星中国 | 晨星星级评价 | 页面无版本日期 | `https://cn.morningstar.com/help/data/fundrating.html` | 不能据此证明 2026 完整现行国内方法 |
| 中国证监会 | 证券投资基金评价业务管理暂行办法 | 2009-11-06；2020-10-30 修订 | `https://www.csrc.gov.cn/csrc/c106256/c1653866/content.shtml` | 国内公开评价监管底线，不提供评分模型 |
| 中国银河证券基金研究中心 | 公募基金分类体系（2024 年 1 月版） | 2024-01 | `https://cdn.chinastock.com.cn/downloadwz/fundfile/ywgz/%E4%B8%AD%E5%9B%BD%E9%93%B6%E6%B2%B3%E8%AF%81%E5%88%B8%E5%85%AC%E5%8B%9F%E5%9F%BA%E9%87%91%E5%88%86%E7%B1%BB%E4%BD%93%E7%B3%BB%EF%BC%882024%E7%89%88%EF%BC%89.pdf` | 国内同类组分类，不是完整评分算法 |

## 平台参考

- 总控与六模块主文档只读；
- 当前四场景组合候选只读；
- 当前观察到的组合发布参考：v1.1.0，`baselineSnapshotId=BSL-OFW-V110-94ABD0E991B7`，`acceptanceReady=false`；后续活动基线是否正式生效以总控裁决为准；
- v1.0.3 继续作为只读历史父版本、迁移来源和回退基线；S005 不原地修改或覆盖；
- M07 提供同一 Ontology 的对象、时序和空间探索能力研究；
- M08 提供模型目标、候选比较、发布绑定和模拟能力研究；
- S005 可作为 M07/M08 的首个验证场景，但不拥有这两个公共模块。

### 新增评价数据源（核验日期 2026-08-24）

- Wind：`https://www.wind.com.cn/`，用户已有账号；作为许可的全市场基金定量主源，定期导出而非公开抓取。
- 中基协机构/产品/人员查询：`https://www.amac.org.cn/fwdt/wyc/jgcprycx/`；公募管理人名录、产品查询、基准要素库和自律管理入口只作为公开身份/事件证据，接口可能变化。
- 证监会行政处罚目录：`https://www.csrc.gov.cn/csrc/c101971/zfxxgk_zdgk.shtml?channelid=17d5ff2fe43e488dba825807ae40d63f`；监管措施目录：`https://www.csrc.gov.cn/csrc/c100044/tz.shtml?channelid=212665889d144f0392445f47661ca98e`。
- 中债/中央结算：`https://www.chinabond.com.cn/`、`https://yield.chinabond.com.cn/`；曲线、估值和指数的免费/许可边界逐项确认。
- 中证指数：`https://www.csindex.com.cn/`；指数规则和部分历史数据公开，下载权限逐指数确认。
- 上海证券交易所基金公告/成交：`https://www.sse.com.cn/disclosure/fund/announcement/`、`https://www.sse.com.cn/market/funddata/overview/day/`；只覆盖上市品种。
- 国家企业信用信息公示系统：`https://www.gsxt.gov.cn/`；只作主体交叉核验，反爬/验证码失败不等于无处罚。

## 证据要求

每个研究结论至少记录：

- 来源文件或网页；
- 来源日期/版本；
- 读取时间；
- 适用产品类型；
- 可由当前资料验证的部分；
- 仍需补充的数据；
- 是否属于事实、推导、假设或建议。
