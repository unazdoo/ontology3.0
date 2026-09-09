import collections
import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'outputs/review-v1.4'
V14 = 'designs/prototype-work/v1.4/'
LEGACY = 'designs/prototype-releases/v1.1.0/'
SHELL = 'http://127.0.0.1:4404/designs/prototype-work/v1.4/composite/s001-e2e-integration/index.html'
findings = []


def add(id, severity, category, title, module, route, objects, preconditions, steps,
        expected, actual, impact, evidence, source, recommendation, acceptance, origin):
    findings.append(dict(id=id, severity=severity, classification='已验证缺陷', category=category,
        title=title, module=module, route=route, objects=objects, preconditions=preconditions,
        reproductionSteps=steps, expected=expected, actual=actual, impact=impact,
        evidence=evidence, sourceReferences=[{'path': p, 'line': n} for p, n in source],
        recommendation=recommendation, acceptanceCriteria=acceptance, origin=origin))


add('R14-001','P1','业务严谨性 / 结果身份','合成模型评分被展示为“正式事实”',
    'M08 / 投后驾驶舱结果视图',SHELL+'#dashboard → #/view/post-investment/overview → 结果视图',
    ['S005','InvestmentProduct-001 至 004','FACT-S005-BASELINE-READONLY'],
    '使用本轮独立服务；通过 M08 的投后目标进入驾驶舱。完整模型流程已另行实际运行至候选消费绑定。',
    ['经营驾驶舱选择“投后评价”，点击“结果视图”。',
     '选择“正式结果”，查看基金A、基金B、基金C及产品池组合的分数、状态和结果ID。',
     '与主页面当前轮次的覆盖率、缺失说明和源码结果构造方式对照。'],
    '模拟构造评分必须明确标为演示/合成基准；正式事实须可追溯到确有数据和口径支持的结果。',
    '抽屉显示“4个业务对象 · 正式事实”，分数为62、68、74、80，前三项“已评价”。这些值由 resultSubjects 的 62 + index * 6 生成，置信度也按序号生成，再包装成 resultKind=FACT。主页面同期显示仅5.9%覆盖、很低置信度及大量无法评价。',
    '可能把无实际计算依据的评分当成投资评价结论，并通过“加入报告”继续传播。未发生真实交易或正式模型指针修改。',
    ['screenshots/111-post-result-view.png','screenshots/110-post-cockpit-after-binding.png','screenshots/112-post-candidate-results.png'],
    [('designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs',113),
     ('designs/prototype-work/v1.3.0/composite/runtime/scenario-model-registrations.mjs',190),
     (V14+'composite/integrations/native-module-integrations.js',1700)],
    '将合成基线明确区分为演示身份；正式视图只消费有实际依据的当前结果，缺失时保持无法评价。报告沿用同一身份。',
    ['没有真实证据的基金评分不出现在“正式事实”中。','主页面、抽屉、问数和导出对同一对象的结果属性及缺失状态一致。','候选、模拟的示例分数始终带有醒目的合成标记和来源。'],
    '继承的 v1.3.0 运行时问题，在 v1.4 实际消费路径中复现。')

add('R14-002','P1','问数 / 范围识别','未登记企业被当作全部企业或整个产业作答',
    '驾驶舱同屏问数',SHELL+'#dashboard → 融资与风险态势',
    ['不存在的Review企业','华南环保集团','ENT-017/018/019/020'],
    '基准快照、清除筛选，21家企业。',
    ['输入“不存在的Review企业融资余额多少”并发送。','清除筛选，再输入“华南环保集团融资余额多少”。','检查答案的对象集及可用的报告/事项操作。'],
    '无法识别的主体应拒绝作答或要求选择已登记主体，不得自动扩大范围。',
    '第一问返回21家企业、融资余额1,411.24亿元；第二问把名称中的“环保”解释为产业，返回4家、450.30亿元。均标为“分析结果”，可加入报告和发起事项。未知企业保护只匹配“公司/单位数字/ENT-数字”。',
    '错误对象范围生成看似可信的融资总额，可能导致错误报告和错误复核事项。',
    ['screenshots/36-unknown-entity.png','logs/query-boundaries-verified.json','logs/36-unknown-entity.json'],
    [(V14+'src/domain.js',344),(V14+'src/domain.js',366),(V14+'src/domain.js',434)],
    '先完成主体和范围解析；拒绝未被完整解释的专名，不把主体名中的行业词直接当作筛选条件。',
    ['上述两个输入均明确提示主体未登记，并保持原分析范围。','标准企业名称、ENT-ID、已登记别名仍可命中。','失败答案没有加入报告/发起事项入口。'],
    'v1.4 同屏问数新增解析。')

add('R14-003','P1','功能闭环 / 本体归属','本体内规则入口与验证结果回到态势均报错',
    'M01 本体管理',SHELL+'#module/ontology → 语义资产 / 本体建模',
    ['DRAFT-V14-OPERATIONS-S001','RULE-OPS-FINANCING-PREMIUM','DRAFT-V14-OPERATIONS-S003'],
    '语义资产目录可见融资及债务风险本体的“规则与指标修订”。',
    ['分别点击两类本体的“规则与指标修订”。','绕行“本体建模→经营态势规则修订→融资成本偏离预警”。','运行25bp验证，得到7/21命中，再点“在经营态势查看”。','编辑为50bp重新验证；另进入仍存在的“融资规则验证”独立页。'],
    '规则应从所属本体修订，验证后携带本体/草稿/规则/版本和对象集进入态势；消费入口使用同一规则。',
    '两个目录按钮均抛 openOntology is not a function；验证结果应用抛 applyOwnedRule is not a function，页面未给失败提示。独立页仍可使用另一套100bp规则生成独立UUID并筛选地图，未关联本体中的50bp修订。',
    '规则治理主链无法完成；用户绕行后会维护两套不同规则，难以确认地图和报告究竟使用哪个本体版本。草稿编辑未覆盖已发布定义，这一隔离检查通过。',
    ['screenshots/50-owned-rule-noop.png','screenshots/54-owned-validation-result.png','screenshots/55-owned-rule-apply-noop.png','screenshots/56-rule-edited-50bp.png','screenshots/58-sandbox-independent.png','logs/browser-errors.jsonl'],
    [(V14+'composite/integrations/ontology-owned-rules.js',36),(V14+'composite/integrations/joint-workbench.js',391),(V14+'composite/integrations/joint-workbench.js',15)],
    '补齐本体修订与应用交接函数，以本体规则版本作为唯一消费身份；整合或迁移独立规则页，并显示交接错误。',
    ['融资和风险本体修订入口均可到达正确草稿。','25bp和50bp验证后能回到相同对象集，问数/报告保留同一规则依据。','已发布规则不被草稿覆盖；独立UUID规则不再与本体规则并行生效。'],
    '本快照新增本体接入尚未完成。')

add('R14-004','P1','原审批链 / 数据版本','黄灯事项确认交办使用错误版本，反复重试不能生成待办',
    'M04 原决策工作台',SHELL+'#module/decision → 决策工作台',
    ['S003-ENT-018','AR-S003-CAND-S003-RUN-20260817163000000-c02200000001-S003-ENT-018-S003_RISK_FOLLOW_UP-2025-12-31-1.1.0'],
    '原有环保测试公司2黄灯事项处于待人工判断；未注入服务故障。',
    ['打开环保测试公司2事项，点击“确认并交办”。','填写理由、知情确认、负责人、截止日，核对提交内容并确认。','等待质量读取结束，再点击“重试提交”。','打开“查看追溯”，对比接收前和确认前的精确数据版本。'],
    '在相同固定数据版本上重新核验；通过后生成独立待办。若确需修复数据，应提供可到达的具体恢复入口。',
    '接收门引用 S003-T007-FORMAL-CANDIDATE-20251231-v1，确认门却查询“1.0.0”，返回“C017无法定位请求引用的精确数据版本”，人工确认不保存。累计3次回执均阻断。seed同时保存 dataVersion=1.0.0 和 dataAssetId=完整T007。',
    '原有债务风险审批行动链不能完成；本地分析复核事项的成功不能替代该链。阻断本身保护了错误执行，但恢复建议无法消除版本传递错误。',
    ['screenshots/126-original-assignment-settled.png','screenshots/127-original-assignment-retry-failed.png','screenshots/128-original-audit.png','logs/128-original-audit.json'],
    [(LEGACY+'scenarios/s003/resources/m04/decision-inbox.v3.json',409)],
    '确认门使用申请固定的完整数据资产版本ID，区分版本号与数据身份；保留现有质量阻断及幂等机制。',
    ['环保测试公司2接收门与确认门读取同一完整T007身份。','数据质量合格时产生且只产生一条待办，刷新可追溯。','真实质量故障仍阻断，恢复后重试不会重复交办。'],
    '继承的冻结审批资源/消费链；本轮在 v1.4 Shell 复现。')

add('R14-005','P1','跨模块交接 / 对象范围','切换业务域后保留不兼容对象，空结果仍显示成功',
    'M03 → M07 / M08 / Agent',SHELL+'#module/query → 带入探索 → 其他业务域问题/模型目标',
    ['dept-equipment','dept-technology','dept-safety','S004','S005','InvestmentProduct-001 至 004'],
    '从投后驾驶舱切入智能问数；也在新的浏览器上下文、同一独立服务上进行了对照。',
    ['问“2025年三个部门的费用预算执行率和剩余空间分别是多少”，答案包含3个部门。','点击“带入探索”，检查对象范围。','回问数点新会话，选“哪些借款主体需要优先人工复核”。','进入投后模型目标，再切债务风险模型目标，检查当前对象与时间。'],
    '跨域应验证对象身份兼容性并明确重置或提示；带入探索要保留可映射的原对象，不可默默扩大为全目录。',
    '预算结果跳到M07显示全部71对象。Shell仍保存S005 + dept-equipment等预算对象；M08投后/债务目标显示“设备管理部”，贷前问题显示“成功、0条正式结果”。新的浏览器上下文中也复现0条：其回答固定的scenarioId为S004，对象集却来自当前S005模型产品。说明该问题还会由服务当前业务域的默认范围触发，不能仅归因于预算操作。',
    '用户可能把错误范围造成的空结果理解为无风险；模型目标、Agent与查询对象跨域错配，跨模块分析连续性中断。',
    ['screenshots/71-budget-to-explorer.png','screenshots/75-preloan-empty-detail.png','screenshots/90-post-models.png','screenshots/114-risk-model-code-entry.png','screenshots/156-clean-preloan-control.png','logs/clean-preloan-context.json'],
    [(V14+'composite/integrations/native-module-integrations.js',1102),(V14+'composite/integrations/native-module-integrations.js',930),(V14+'composite/integrations/native-module-integrations.js',838),(V14+'composite/shared/workflow.js',29)],
    '交接时携带来源业务域及规范对象ID，按目标域校验范围；无兼容对象时显示范围不兼容及恢复入口。新业务问题不得默认套用另一域的对象集。',
    ['预算答案带入M07后要么显示对应3部门，要么明确说明当前目录无映射，不能自动显示71对象当作交接成功。','贷前查询不使用预算部门或投资产品ID作为范围。','投后和债务风险目标不显示设备管理部；空结果区分无命中、未运行和范围错误。'],
    '继承集成的交接和范围选择逻辑；v1.4客户路径实际暴露。')

add('R14-006','P2','方案输入 / 语义解析','小数降息和授信收缩参数被静默改为0',
    '同屏问数 → 融资方案',SHELL+'#dashboard → 融资与风险态势 → 问数/比较方案',
    ['8c7c78b4-eb5f-4ab2-9516-4c2b76f1403f'],
    '任意有效企业范围，本轮为4家环保企业。',
    ['输入“未来90天如果降息12.5bp，授信收缩12.5%，展期30天”。','等答案完成后点“比较方案”。'],
    '正确读取12.5bp和12.5%，或明确拒绝不支持的小数，不得显示成功后替换成零。',
    '成功答案保存 parameters={rateBps:0,creditHaircut:0,extensionDays:30}；表单显示0bp、0%，预览不体现用户的利率和授信变化。解析正则只接受整数，未匹配时回填0。',
    '方案假设与原问题不一致；用户可能保存和比较未按要求测算的方案。参数表可以人工发现，但没有任何忽略提示。',
    ['screenshots/140-decimal-scenario.png','screenshots/141-decimal-parameters-zero.png','logs/query-boundaries-verified.json'],
    [(V14+'src/domain.js',410),(V14+'src/domain.js',428)],
    '支持业务允许的小数精度；未支持表达应阻断并标出无法识别的参数，禁止静默默认。',
    ['12.5bp及12.5%被准确填入和计算，或两项都有明确拒绝理由。','整数50bp/30%仍正常；非法负数和超限值仍阻断。'],
    'v1.4新增语义参数解析。')

add('R14-007','P2','功能完整性 / 推荐问题','集团余额推荐问题只回答板块成本，关键请求指标缺失',
    'M03 原问数工作台',SHELL+'#module/query → 问数工作台',
    ['s001-group-cost','group-overview'],
    '新会话，点击平台提供的第1个融资推荐问题。',
    ['点击“集团当前融资余额和平均融资成本分别是多少？”','查看回答详情和导出的CSV。'],
    '同时返回集团融资余额及平均融资成本，注明同一数据截至日、单位与依据。',
    '实际回答“集团融资成本与产业板块对比”，只有成本和板块差异，没有集团余额。详情及导出仍缺余额；推荐项映射到通用group-overview模板。',
    '用户需要另找驾驶舱获取余额；推荐问题本身不兑现承诺，现场演示容易出现答非所问。',
    ['screenshots/68b-query-finance-answer.png','screenshots/69-original-query-detail.png','downloads/original-finance-query.csv'],
    [(LEGACY+'intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js',139),(LEGACY+'intelligent-query-prototype/review-next/conversation-workspace/data.jsx',404)],
    '让该推荐意图返回已请求的两项指标，或将推荐文案收窄为现有能力；不必重写整个问数模块。',
    ['答案、详情和CSV均含余额与成本，数值与同口径驾驶舱一致。','结构占比等其他推荐问题逐项对应实际输出指标。'],
    '继承的推荐问题/模板映射。')

add('R14-008','P2','报告 / 结果身份','报告交接把基准标成压力模拟，目录又回退为候选结果',
    'M06 联合报告 → 原内容块编辑器',SHELL+'#module/report → 联合分析报告 / 报告目录',
    ['f319a40a-3215-4395-a40d-6807a4b32ba8','DEMO_BASELINE','planId=null'],
    '由基准答案生成报告；本轮用“有哪些担保关系”的21家基准答案。',
    ['在基准答案点“加入报告”，核对固定依据没有模拟方案。','点“在报告中心整理”，查看目录卡片并打开内容块编辑器。','检查内容块和原始快照的结果属性。'],
    '保持“演示基准”与“方案模拟”区别，目录正确显示对象数、方案身份和对应结果类型。',
    '源快照为DEMO_BASELINE、planId=null，4个内容块一律resultMode=simulation，显示“压力模拟”。目录将同一联合报告写成“模型监测草稿/当前业务范围/未聚焦单个对象/候选结果”。原因包括硬编码simulation及目录只读objectSet/object/resultMode旧字段。',
    '基准与模拟的口径被混淆，用户难以确认报告采用哪组假设。数值快照和手工文字本轮未被重同步覆盖。',
    ['screenshots/171-baseline-report-identity.png','screenshots/172-baseline-in-pressure-editor.png','screenshots/149-native-report-resync-catalog.png','logs/baseline-report-mislabeled.json'],
    [(V14+'composite/integrations/joint-workbench.js',173),(V14+'composite/integrations/joint-workbench.js',225),(V14+'composite/integrations/native-module-integrations.js',1656)],
    '按快照实际结果类型映射报告身份，补齐目录对规范上下文字段的读取；继续保留人工修改保护。',
    ['无方案的基准报告显示“演示基准”，有方案显示具体模拟方案。','目录显示固定21家或9家范围，结果属性与编辑器/导出一致。','重复同步仍保留人工文字、排序和删除决策。'],
    'v1.4联合报告与继承编辑器的接口适配。')

add('R14-009','P2','历史恢复 / 交互完整性','问数超过8条后旧答案无入口可回看或继续处理',
    '驾驶舱同屏问数',SHELL+'#dashboard → 融资与风险态势 → 问数',
    ['4053c894-f5b3-401f-808f-d4e4a8dea985','本轮共13条同屏查询'],
    '连续完成至少9次查询，成功、失败和取消均计入显示数量。',
    ['先问“找出高成本且有资金缺口的企业”。','继续提交至少8次其他问题或取消。','向上/下滚动问数列表，寻找最早答案及历史入口；刷新复查。'],
    '保留可访问的历史列表或加载更多，让用户恢复旧答案范围、生成报告和复核来源。',
    '存储保留13条查询，但UI只渲染最近8条，最早的9家企业答案已无法通过界面找到；没有历史/更多入口。源码保存上限30条，渲染却固定slice(0,8)。',
    '一段较长演示或分析后无法回看最初依据，也无法对原答案继续发起事项或生成报告。数据尚在本机，但用户访问路径丢失。',
    ['screenshots/164-query-history-limited.png','logs/164-query-history-limited.json','logs/browser-results.jsonl'],
    [(V14+'src/app.js',349),(V14+'src/app.js',1061)],
    '为同屏问数增加历史入口或分页/加载更多，显示保存范围及上限。',
    ['第9至30条历史均可访问；成功/失败/取消状态可区分。','旧答案恢复其固定对象、窗口和方案，不套用当前方案。','刷新后可继续访问同样历史。'],
    'v1.4同屏问数显示与存储上限不一致。')

add('R14-010','P3','空状态 / 文案','无匹配企业时融资成本显示“暂无%”',
    '驾驶舱指标栏',SHELL+'#dashboard → 融资与风险态势',[],
    '基准快照，企业检索可用。',
    ['在企业检索中输入不存在的名称。','观察上方加权融资成本，再点“显示全部企业”恢复。'],
    '缺失值使用完整业务文案，如“暂无数据”；无数值时不拼接百分号。',
    '0家范围下显示“暂无%”。显示全部后正常恢复2.46%。',
    '空状态不够清晰，影响界面可信度；未发现把缺失成本保存为0的情况。',
    ['screenshots/34-empty-search.png','logs/34-empty-search.json'],
    [(V14+'src/app.js',248)],
    '只对有效数字附加单位，缺失值显示统一空状态。',
    ['无企业和零余额均显示清晰缺失文案，不出现“暂无%”或NaN。','恢复范围后正常显示有效百分比。'],
    'v1.4指标格式化。')


counts = dict(collections.Counter(f['severity'] for f in findings))
counts = {s: counts.get(s, 0) for s in ['P0','P1','P2','P3']}
environment = json.loads((OUT/'logs/environment.json').read_text())
result = {
    'reviewVersion':'1.0', 'reviewedAt':datetime.datetime.now().astimezone().isoformat(),
    'scope':V14, 'branch':environment['branch'], 'commit':environment['commit'],
    'sourceModified':False, 'counts':counts, 'findings':findings,
    'designSuggestions':[
        {'id':'D01','classification':'设计建议','title':'把演示数据属性放在态势首屏的固定位置',
         'basis':'首屏仅写“基准快照/联合态势”，合成借款说明主要在对象详情和来源面板；证据02-map-1440.png、04-loan-020-1.png。',
         'suggestion':'保留简短“模拟融资数据”标记，并可展开数据截至日与版本，帮助客户区分历史风险评分和合成融资输入。'},
        {'id':'D02','classification':'设计建议','title':'减少模型与窄屏页面中内部身份对主操作的挤占',
         'basis':'118-model-code-390.png、163-asset-320.png中多层上下文与长字段增加滚动。数据表已验证可横向滚动，不据此判为裁切缺陷。',
         'suggestion':'优先显示业务对象、状态和下一步；技术身份折叠保留，避免隐藏追溯能力。'}],
    'businessQuestions':[
        {'id':'B01','classification':'待业务确认','question':'投后客户演示允许的实际数据覆盖范围是什么？',
         'basis':'本轮流程后仅2/34指标可部分评价，覆盖5.9%，且15只候选只列示5只。缺失原因有明确展示，未把覆盖不足本身定为缺陷。'},
        {'id':'B02','classification':'待业务确认','question':'原内容块编辑器是每业务域一个汇总草稿，还是应按报告/修订独立管理？',
         'basis':'v1与v2报告汇入同一S003草稿形成8块，行为可验证，但是否应分拆需要产品决定；本报告只把已确认的结果身份错标列为R14-008。'}]
}
(OUT/'FINDINGS.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))

report = ['# v1.4 原型独立 Review 报告','',
          '本轮结论：存在阻碍无脚本客户演示的核心问题。P0 0项、P1 5项、P2 4项、P3 1项。可演示已限定范围的本地分析闭环，但不能宣称本体治理、原审批链及跨业务域分析已经整体闭环。','',
          f"审查固定快照：`{environment['branch']}` / `{environment['commit']}`。工作目录 `{ROOT}`。从独立服务 `http://127.0.0.1:4404/` 进入平台 Shell；静态/模型端口4402/4403。独立 Chrome 会话，无业务源码修改。",'',
          '## 按严重度排序的已验证缺陷','',
          '|编号|严重度|问题|主要影响|','|---|---|---|---|']
for f in findings:
    report.append(f"|{f['id']}|{f['severity']}|{f['title']}|{f['category']}|")
for f in findings:
    report.extend(['',f"### {f['id']} · {f['severity']} · {f['title']}",'',
                   f"类别：{f['category']}。模块：{f['module']}。",'',
                   f"页面：`{f['route']}`。",'',f"对象/前置：{'；'.join(f['objects']) or '空对象集'}。{f['preconditions']}",'', '复现步骤：',''])
    report.extend(f'{i}. {s}' for i,s in enumerate(f['reproductionSteps'],1))
    report.extend(['',f"**预期：** {f['expected']}",'',f"**实际：** {f['actual']}",'',f"**用户/业务影响：** {f['impact']}",'',
                   '**本轮证据：** '+ '；'.join(f'[{Path(e).name}]({e})' for e in f['evidence'])+'。','',
                   '**源码依据：** '+ '；'.join(f"[{s['path']}:{s['line']}]({ROOT / s['path']}:{s['line']})" for s in f['sourceReferences'])+'。','',
                   f"**最小修正建议：** {f['recommendation']}",'','**验收标准：**',''])
    report.extend(f'- {s}' for s in f['acceptanceCriteria'])
    report.extend(['',f"归属说明：{f['origin']}"])

report.extend(['','## 覆盖与实际通过范围','',
    '详见 [COVERAGE.md](COVERAGE.md)。共20组检查，全部已开展；其中7组的限定检查范围未发现阻断，13组部分实现、存在缺陷或仍有专项未验证。不能将这个统计理解为模块总体通过率。','',
    '本轮已验证的完整本地链路：','',
    '- 9家企业问数范围 → 保存方案A（降息50bp、授信收缩30%、展期180天）→ 发起事项 → 确认 → 分办 → 跟进 → 完成 → 报告 → 人工复核冻结v1 → 独立修订v2 → 原内容块编辑/排序/删除/撤销/预览 → 实际HTML导出 → 返回固定9家/90天/方案A。报告编辑器的结果身份问题见R14-008，因此仅认可状态、数值快照及操作连续性。',
    '- 已保存探索 → 删除方案A → 从探索恢复原方案A及固定对象集；事项完成后重开、取消，均保留审计记录。',
    '- 数据资产检索 → 融资台账详情 → 字段/五页84条记录 → 快照与血缘 → 浏览器实际下载Excel → HTTP503/同长度损坏文件被阻断 → 恢复文件后成功重试。',
    '- 原正式报告ENT-020 → 第4章定位 → 报告伴读新回答 → 重新运行自动核验，形成新M05运行记录（M05-RUN-1TOU6V5）；当前报告固定正文和23.05分保持不变。这里只认可本轮读取和运行路径，13/13的判定未逐条进行人工数学重审。',
    '- M08投后目标 → 构建79条观察/4对象 → 质量校验 → 冻结 → 模型合同 → Benchmark → Challenger → 洞察审查 → 候选 → 3个影子窗口 → 复评 → Release Candidate → 消费绑定校验/确认 → 驾驶舱候选/模拟读取。此为本地流程完成，结果真实性受R14-001约束，不代表模型有效性或正式金融执行。','',
    '以下实际检查范围未发现缺陷：企业/借款/银行/授信/项目/事件/担保/指标输入的代表性下探和返回；地图全球缩放/聚合点击/点选/框选/空框保留/取消/显示全部/刷新；不同范围方案明确提示仅并列比较；非法展期参数被阻断；本体草稿编辑不改变已发布定义；重复报告同步保留手工文字；未知跨期/币种问题拒绝；查询取消不改变范围；数据503重试可恢复。','',
    '## 数据、下载与继承复核','',
    '- Excel为11张工作表、9资产共300记录，40,094字节，SHA-256 `3a126add6af3787c90cac781f6d42186d41dbcd80e5bc29264845994940ac3b8`，与登记一致；逐个资产逐字段核对无差异。84笔借款UI分页为20/20/20/20/4，ID、金额、利率、起息日、到期日与源数据一致，日期及百分比为正确Excel类型。重试下载字节一致。见 [download-validation.json](logs/download-validation.json)。',
    '- 独立Decimal计算：总本金141,124百万元（1,411.24亿元），加权成本2.4566589722%，90天到期84,725.80百万元，逐企业正向缺口合计33,864.784百万元，与态势显示的四舍五入值一致。没有把跨企业盈余抵销缺口。',
    '- 45条继承清单的父版本指纹符合本worktree v1.3.2；五业务域数据相同，M07的71对象/67关系/39时序字节相同。模块配置唯一变动是本体页面入口迁至v1.4本体封装，不据此判定功能丢失。57项统一资源目录包含原45项与新增12项。见 [inheritance-independent.json](logs/inheritance-independent.json)。',
    '- `npm ci`成功；本轮`npm test`为97项、96通过、1失败。失败为`tests/inheritance.test.mjs:64`对模块配置完全相等的断言，因本体入口路径改变，不是环境故障；应更新契约而不是回退本体接入。原有浏览器脚本会写入旧artifacts/evidence，本轮未直接执行这些覆盖旧图的脚本；改用本报告目录内的实际交互证据。M08流动性模型界面实际触发Python测试，3项通过。',
    '- 本轮浏览器产品异常3条，均为本体缺失函数（R14-003）。控制脚本的短暂iframe切换、严格选择器多匹配与截图超时单独记录，未当作产品缺陷；M07空间图截图关闭动画后获取成功。下载/数据HTTP503为本轮故障注入，与自然异常区分。','',
    '## 设计建议与待业务确认',''])
for x in result['designSuggestions']:
    report.extend([f"- **{x['id']} · 设计建议：{x['title']}。** {x['basis']} {x['suggestion']}"])
for x in result['businessQuestions']:
    report.extend([f"- **{x['id']} · 待业务确认：{x['question']}** {x['basis']}"])
report.extend(['','## 风险、未覆盖与演示判断','',
    '建议在修复P1前不要开展自由提问或全平台闭环演示。固定脚本的地图下探、正确整数参数方案、本地事项、快照下载及正式报告阅读可用于受限演示；应明确数据/模型属性。原审批确认与本体规则应用为确定的现场中断点，未登记主体和合成“正式事实”则可能在不报错时误导观众。','',
    '未验证：原审批生成待办之后的执行/完成（被R14-004阻断）；本体内规则应用后的真实下游消费（被R14-003阻断）；Agent生产Release发布及兼容多Agent编排完整运行（仅创建、编辑、验证阻断及正式报告伴读/核验运行）；M08全部10模型的实际数据运算、代码提交/标签/正式发布（本轮只读源码，未执行代码编辑）；所有角色权限、多人持久化、真实银行/外部通知、生产数据接入；完整键盘和读屏器审查；每个模块的每个页面在所有尺寸的穷举。未完成项没有记作通过。','',
    '1440×900、1280×720、390×844均实际检查，拥挤处补查320×844。窄屏数据表采用容器横向滚动，实测页面宽320、表格约999、容器290，没有据此把正常横向滚动误报为页面溢出。移动布局仍有较长滚动成本，列作设计建议。','',
    '所有业务源码保持原样，未提交修复。报告、控制脚本、截图、下载和日志仅写入`outputs/review-v1.4/`；独立浏览器设置与故障模拟未应用到用户主窗口。浏览器及本轮自建服务在证据归档后关闭，保留本地状态证据供复查。',''])
(OUT/'REVIEW-REPORT.md').write_text('\n'.join(report))

if not (OUT/'logs/COVERAGE-plan.md').exists():
    (OUT/'logs/COVERAGE-plan.md').write_text((OUT/'COVERAGE.md').read_text())

coverage = [
('C01','继承与Shell','/ → 首页/全导航/全局资源','原首页、M01-M08、五域和资源保持','45父指纹、71/67/39资源、五域对照相符；本体入口变更合理，接入缺陷另列','已实现（限定检查）','logs/inheritance-independent.json；01-home-1440'),
('C02','五域驾驶舱','经营驾驶舱横向导航→五域→代表下探','每域存在实际内容与下一步','融资/预算/风险/贷前可读；投后完成模型链后有部分评价，但模型正式身份误标R14-001','部分实现','64-cockpit-*；110/111/112/113'),
('C03','地图','全球/聚合点选/缩放/框选/取消/显示全部/刷新','相机与分析范围分离，可退出空操作','空框保持21家；有效框6家刷新一致；聚合点击zoom1.55→2；点选ENT020；滚轮zoom5.95','已实现（限定检查）','29/30/31/32/33；166/167/169/170'),
('C04','对象下探','ENT020→LOAN020-1→BANK02→返回；授信/项目/事件/担保/指标','对象ID及输入可追溯','实际依次打开并返回；移动抽屉可滚动；担保不重复计入余额','已实现（限定检查）','03至09；61至63；153'),
('C05','同屏问数','筛选9企→模拟参数→失败/取消→历史','范围/方案/历史均可理解','正常筛选与取消可用；未知主体误识别R14-002，小数忽略R14-006，历史截断R14-009','部分实现','10至14；35至37；140/141/152/164'),
('C06','数据工程','原资产目录→检索→字段→五页→快照/血缘→Excel','全量快照、可重试、正确类型和版本','9资产300记录逐字段一致；84借款UI五页完整；503及错误SHA阻断，重试一致','已实现（限定检查）','38至47；162/163/165；download-validation.json'),
('C07','本体','所属本体修订→规则编辑→验证→下游','规则单一归属，草稿发布隔离','草稿25→50bp验证可用，已发布定义不变；入口/应用缺失函数，独立沙盒仍并行R14-003','部分实现','48至59'),
('C08','方案','固定9企参数→保存应用→双方案比较→删除恢复','假设可见，范围匹配，快照可恢复','A/B范围不同明确并列；负展期阻断；删A后从保存探索恢复；小数问数参数缺陷R14-006','部分实现','12/13/15；142至145'),
('C09','本地事项','发起→确认→分办/截止日→跟进→完成→重开→取消→报告','形成可回看的实际状态和审计','同一c8c7事项状态与6条历史保存；外部执行0；报告固定方案','已实现（限定检查）','16至23；146；primary-flow-state.json'),
('C10','原审批','环保2黄灯事项→人工确认→交办→重试→追溯','质量合格后产生独立负责人待办','完整数据版本被1.0.0替代，三次确认前质量读取阻断R14-004，后续完成未验证','部分实现','119至128'),
('C11','联合报告','方案事项→冻结v1→修订v2→历史→返回','版本不互相覆盖，保留数值依据','两版本各自保存；v1冻结可回看；基准答案在当前方案下仍用自身快照；超过8条的旧答案访问受R14-009阻碍','部分实现','21至28；147/148；161/171'),
('C12','内容块编辑器','编辑/下移/删除/撤销/预览/HTML导出/重同步','用户编辑保留，身份一致','8→7→8块撤销正确，重复同步保留手工文字；基准统一变压力模拟，目录错标R14-008','部分实现','24至28；149至151；172；baseline-report-mislabeled.json'),
('C13','原智能问数','融资/预算/风险/贷前/投后推荐→详情/CSV/设置','每个问题回答对应业务对象和指标','预算/风险回答正常；融资缺余额R14-007；跨域范围R14-005；设置3域档案/6工具可读','部分实现','67至79；156；clean-preloan-context.json'),
('C14','Agent','目录→配置草稿→验证；编排→草稿→验证；伴读核验运行','配置可保存，阻断明确，结果可追溯','配置与编排草稿可创建；缺合同明确阻断；伴读/核验有新M05结果；正式配置发布/兼容编排未验证','部分实现','80至88；130/132'),
('C15','M07','对象发现→ENT020→关系/时序/地图/比较→保存刷新','原多Lens和连续探索保留','6Lens已进入；23.05分/393.13亿可见；保存探索恢复；预算交接丢范围R14-005','部分实现','71/72；136至139'),
('C16','M08','投后数据/合同/评测/审查/候选/影子/绑定/消费；S003代码测试','流程形成独立运行与版本证据','投后本地周期实际完成；S003 model.py/README/Git身份可读，Python3测试通过；合成FACT及跨域范围有缺陷；模型代码写入未做','部分实现','89至118'),
('C17','正式报告','ENT020报告→章节→伴读→重新核验','固定正文与来源可读，有新记录','报告定位第4章，伴读返回23.05分；本轮新核验M05-RUN-1TOU6V5；非逐条人工审核13核验项','已实现（限定检查）','129至135'),
('C18','响应式/导航','1440/1280/390/320→滚动/抽屉/前进后退','操作可达，不挤出屏幕','地图及关键模块有实测截图；表格容器横向滚动，页面无横向溢出；全键盘/读屏及全页面穷举未做','部分实现','60至63；84；117/118；134/135；151；162/163/165；159/160'),
('C19','故障/持久化','数据503/下载503/同长度错误SHA/取消/刷新/恢复','不伪成功，可明确重试','故障阻断和恢复正常；保存/恢复方案与报告真实落本机；存储配额耗尽、并发多窗口、所有连续点击场景未验证','部分实现','45至47；145/146；152；157/158'),
('C20','现有测试/独立计算','安全审读→npm test；Excel逐字段；Decimal核算','所有结论有本轮证据','97项96通过1路径断言失败；M08 Python3项通过；Excel/金额独立复核无差异','已实现（限定检查）','npm-ci.log；npm-test.log；116；download-validation.json')]
cov=['# v1.4 独立 Review 覆盖矩阵','',
     '检查前的初始计划保留于 [COVERAGE-plan.md](logs/COVERAGE-plan.md)。状态只适用于本表列出的实际操作；“部分实现”同时说明缺陷及未验证余项。截图数字前缀对应screenshots/，完整URL、可见文案、控件和时刻在同名前缀logs/*.json及browser-actions/results.jsonl。','',
     '|ID|模块|入口 / 关键操作|预期|实际结果|快照状态|本轮证据|','|---|---|---|---|---|---|---|']
cov.extend('|'+ '|'.join(row)+'|' for row in coverage)
cov.extend(['','## 五业务域代表路径','',
    '|业务域|实际路径|结果|','|---|---|---|',
    '|融资 S001|驾驶舱正式盘面→集团推荐问数→回答详情/CSV；联合态势9企→方案→事项→报告|问数缺余额；本地状态闭环完成，结果身份问题单列|',
    '|预算 S002|推荐问题→3部门预算执行答案→带入探索|答案正确展示98.86%/77.97%/63.20%；探索扩大为71对象|',
    '|债务 S003|21企风险分布→环保2原决策交办；环保4正式报告→伴读→新核验|风险答案/报告可用；原交办版本错配阻断|',
    '|贷前 S004|驾驶舱4申请主体和缺失状态→推荐人工复核问题→回答详情|范围串用导致0条成功；该路径不记闭环通过|',
    '|投后 S005|数据构建/质量/冻结→合同→模型评测/候选/影子/消费绑定→驾驶舱结果|本地状态链完成；主轮次部分评价；合成正式评分误标|','',
    '## 视口取样','',
    '|视口|实际页面|检查内容|','|---|---|---|',
    '|1440×900|首页、驾驶舱各域、问数、数据、本体、方案事项、Agent、M07、M08、正式/联合报告|首屏层级、点击、下探、滚动、表单、交接、下载|',
    '|1280×720|联合态势、M08代码仓、正式报告|导航密度、主操作和内容滚动|',
    '|390×844|联合态势/企业/借款、Agent配置、M08、正式报告、原编辑器、资产抽屉|移动导航、抽屉、长内容、表格滚动|',
    '|320×844|联合态势、融资资产表格/下载抽屉|拥挤布局及滚动容器，页面宽度320无水平溢出|','',
    '故障注入仅对本轮浏览器上下文中的 /data/portfolio.json 和 /data/snapshots/*.xlsx 路由生效，模拟后均移除。浏览器拦截保护覆盖主窗口4382/4383/4392/4393/4394；未操作这些服务。',''])
(OUT/'COVERAGE.md').write_text('\n'.join(cov))

snips = [('# '+f['id']+' '+f['title'], f['sourceReferences']) for f in findings]
lines=['# 本轮源码证据摘录','', '来自本worktree固定快照；只读提取。较长源码行保留完整内容，精确文件/行号见各条。','']
for title, refs in snips:
    lines.extend([title,''])
    for ref in refs:
        path=ROOT/ref['path']; source=path.read_text().splitlines(); start=max(1,ref['line']-2); end=min(len(source),ref['line']+7)
        lines.extend([f"`{ref['path']}:{ref['line']}`",'', '```text'])
        lines.extend(f'{i}: {source[i-1]}' for i in range(start,end+1))
        lines.extend(['```',''])
(OUT/'logs/source-evidence.md').write_text('\n'.join(lines))
print(json.dumps({'findings':len(findings),'counts':counts,'coverageGroups':len(coverage),'sourceModified':False},ensure_ascii=False))
