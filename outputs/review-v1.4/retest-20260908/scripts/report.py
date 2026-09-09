import collections
import datetime
import json
from pathlib import Path

out = Path(__file__).resolve().parents[1]
root = out.parents[2]
old = json.loads((out.parent / 'FINDINGS.json').read_text())
snapshot = json.loads((out / 'logs/snapshot-check.json').read_text())
actual = {x['id']: x for x in json.loads((out / 'logs/results.json').read_text())['checks']}
cases = {
    'R14-002': ('03-unknown-enterprise', ['从 Shell 进入经营驾驶舱的融资与风险态势。', '问“华南环保集团融资余额多少”，等待答案完成。'], '未登记主体被解析为环保产业，返回4家企业、450.30亿元，显示成功并提供报告/事项操作。'),
    'R14-003': ('09-ontology-click', ['从 Shell 进入本体管理语义资产目录。', '点击融资本体的“规则与指标修订”。'], '页面未进入修订草稿，报错 global.OFW_V14_JOINT.openOntology is not a function。本轮未继续验证 applyOwnedRule 路径。'),
    'R14-006': ('04-decimal-parameters', ['问“未来90天如果降息12.5bp，授信收缩12.5%，展期30天”。', '等待成功答案，点击比较方案。'], '保存的解析参数和实际表单均为0bp、0%、30天；前两项小数被静默忽略。'),
    'R14-010': ('05-empty-scope', ['在态势企业搜索框输入“不存在的Review企业”。', '查看加权融资成本。'], '空企业范围下显示“暂无%”。'),
}
findings = []
for oid, (name, steps, observed) in cases.items():
    f = next(x for x in old['findings'] if x['id'] == oid).copy()
    f.update(status='当前旧快照仍可复现；修复版本未取得', reproductionSteps=steps,
             actual=observed, currentRetest=actual[oid],
             evidence=[f'screenshots/{name}.png', f'logs/{name}.json'])
    findings.append(f)
findings[1]['title'] = '本体“规则与指标修订”入口仍报缺失函数'
findings[1]['impact'] = '所属本体修订入口不能进入；应用交接和独立规则并行问题本轮未重新验证。'
counts = {p: sum(f['severity'] == p for f in findings) for p in ['P0', 'P1', 'P2', 'P3']}
remaining = [f['id'] for f in old['findings'] if f['id'] not in cases]
result = {'reviewedAt': datetime.datetime.now().astimezone().isoformat(),
          'repairReviewStatus': '修复快照未出现在当前工作区，无法验收修复版本',
          'snapshot': snapshot, 'reproducedExistingCounts': counts,
          'findings': findings, 'notRetested': remaining,
          'normalPath': actual['control'], 'sourceModified': False}
(out / 'FINDINGS.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))

report = ['# v1.4 修复复审：当前快照核对与有限复测', '',
          '## 当前工作区仍可复现的问题', '',
          '|编号|严重度|本轮实际结果|', '|---|---|---|']
for f in findings:
    report.append(f"|{f['id']}|{f['severity']}|{f['actual']}|")
report += ['', '本轮复现旧问题4项：P0 0、P1 2、P2 1、P3 1。未新增问题，未关闭上一轮问题；统计仅覆盖本轮抽查。', '',
           '## 修复快照尚未取得', '',
           f"当前分支 `{snapshot['branch']}`，HEAD仍为 `{snapshot['currentCommit']}`，与上一轮相同。直接计算87个受Git跟踪的v1.4源码、配置及文档指纹，与HEAD均相同；相关继承运行时和冻结模块的Git差异也为空。当前没有修复差异可审查。", '',
           '这只能证明当前review快照尚未更新，不能判断其他目录的修复是否有效。REVIEW-PROMPT.md说明该worktree“不自动包含主窗口后续修改”，并要求“不操作其他worktree”。本轮未访问其他worktree或主窗口服务。需要明确修复代码所在目录或提交，才能继续修复验收。', '',
           '快照证据：[snapshot-check.json](logs/snapshot-check.json)。', '',
           '## 复测详情', '']
for f in findings:
    report += [f"### {f['id']} · {f['severity']} · {f['title']}", '',
               f"类别：{f['category']}。模块：{f['module']}。", '',
               f"页面：`{f['route']}`。对象：{'；'.join(f['objects']) or '空企业范围'}。", '',
               '前置：独立Chrome会话，4404入口及4402/4403配套服务，从Shell进入；旧本地记录未复用。', '', '复现步骤：', '']
    report += [f'{i}. {s}' for i, s in enumerate(f['reproductionSteps'], 1)]
    report += ['', '预期：' + f['expected'], '', '实际：' + f['actual'], '',
               '影响：' + f['impact'], '',
               '本轮证据：' + '；'.join(f'[{Path(e).name}]({e})' for e in f['evidence']) + '。', '',
               '源码依据：' + '；'.join(f"[{s['path']}:{s['line']}]({root / s['path']}:{s['line']})" for s in f['sourceReferences']) + '。', '',
               '最小修正建议：' + f['recommendation'], '', '验收标准：', '']
    report += ['- ' + s for s in f['acceptanceCriteria']]
    report += ['']
report += ['## 覆盖边界', '',
           '本轮正常对照“Shell→态势→未来90天到期问数”实际可用，返回21家、到期847.26亿元。没有把旧测试记录当作本轮结论。1440×900完成交互；1280×720、390×844、320×844对空范围/方案页留存视口证据，未重做全平台布局验证。', '',
           '其余R14-001/004/005/007/008/009本轮未复测。完整事项/报告/审批/模型闭环、下载校验等未重复运行；没有给这些范围新的通过结论。因为源码未变，本轮未重跑整套npm test。', '',
           '当前旧快照仍存在演示阻断；修复版本的演示可用性未验证。请明确修复所在目录或提交。', '',
           '原报告和证据没有覆盖，业务源码未修改。新证据仅在本次子目录。只关闭本轮自建服务及浏览器会话，清理证据见[cleanup.json](logs/cleanup.json)。', '']
(out / 'REVIEW-REPORT.md').write_text('\n'.join(report))
plan = out / 'logs/COVERAGE-plan.md'
if not plan.exists():
    plan.write_text((out / 'COVERAGE.md').read_text())
coverage = ['# 修复复审覆盖矩阵', '', '当前快照未更新，仅作有限浏览器复测。初始计划见[检查计划](logs/COVERAGE-plan.md)。', '',
            '|检查|入口与操作|预期|实际|证据|', '|---|---|---|---|---|',
            '|快照|HEAD及87文件指纹比对|取得修复差异|与上一轮相同|logs/snapshot-check.json|',
            '|正常对照|Shell→态势→90天到期问数|正常作答|21家/847.26亿元|logs/02-normal-query.json|']
for f in findings:
    coverage.append('|'+ '|'.join([f['id'], '；'.join(f['reproductionSteps']), f['expected'], f['actual'], ', '.join(f['evidence'])])+'|')
for oid in remaining:
    coverage.append(f'|{oid}|对应模块，取得修复后逐项复测|原验收标准|本轮未验证|无新通过结论|')
coverage += ['', '1440×900实际交互；1280×720、390×844、320×844留存取样截图。未访问4382/4383/4392/4393/4394主窗口服务。', '']
(out / 'COVERAGE.md').write_text('\n'.join(coverage))
print(json.dumps({'counts': counts, 'repairSnapshotMissing': True}, ensure_ascii=False))
