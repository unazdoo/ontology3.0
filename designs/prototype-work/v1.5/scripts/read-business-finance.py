"""Read the immutable financing snapshot; emit only the three mapped subjects."""
from pathlib import Path
from hashlib import sha256
from decimal import Decimal
import json
from openpyxl import load_workbook

root = Path(__file__).resolve().parents[4]
source = root / 'designs/prototype-releases/v1.1.0/data-engineering-prototype-review/review-v3/source-snapshots/融资一览表_一期演示数据.xlsx'
wb = load_workbook(source, read_only=True, data_only=True)
rows = iter(wb.worksheets[0].values)
headers = next(rows)
subjects = {'演示单位553': ('UNIT-553', 'ENT-020'), '演示单位465': ('UNIT-465', 'ENT-007'), '演示单位561': ('UNIT-561', 'ENT-017')}
records = []
all_count = 0
all_total = Decimal(0)
all_weighted = Decimal(0)
all_subjects = set()
for line, values in enumerate(rows, 2):
    r = dict(zip(headers, values))
    if not r.get('借据编号'):
        continue
    all_count += 1
    all_subjects.add(r['借款人'])
    amount = Decimal(str(r['借据余额（折合人民币）']))
    rate = Decimal(str(r['当前利率']))
    all_total += amount
    all_weighted += amount * rate
    if r['借款人'] not in subjects:
        continue
    unit, enterprise = subjects[r['借款人']]
    records.append({'id': r['借据编号'], 'enterpriseId': enterprise, 'unitCode': unit,
        'sector': r['所属板块'], 'sourceBorrower': r['借款人'], 'institution': r['融资机构'],
        'balanceYuan': float(amount), 'rate': float(rate), 'currency': r['借据币种'],
        'rateType': r['利率形式'], 'termType': r['期限种类'], 'guaranteeType': r['担保方式'],
        'startDate': str(r['提款日期'])[:10], 'maturityDate': str(r['提款到期日期'])[:10],
        'sourceRow': line})
assert len(records) == 301
assert len({r['id'] for r in records}) == len(records)
for name, (_, eid) in subjects.items():
    selected = [r for r in records if r['enterpriseId'] == eid]
    expected = {'ENT-020': (75, Decimal('393.134')), 'ENT-007': (176, Decimal('770')), 'ENT-017': (50, Decimal('20.016'))}[eid]
    assert len(selected) == expected[0]
    assert sum(Decimal(str(r['balanceYuan'])) for r in selected) / Decimal(100000000) == expected[1]
payload = {'source': str(source.relative_to(root)), 'sha256': sha256(source.read_bytes()).hexdigest(),
    'asOf': '2025-12-31', 'classification': 'EXISTING_FINANCING_DEMO_SNAPSHOT',
    'summary': {'loanCount': all_count, 'subjectCount': len(all_subjects), 'balanceYuan': float(all_total), 'weightedCost': float(all_weighted / all_total)},
    'records': records}
target = Path(__file__).resolve().parents[1] / 'composite/resources/business-finance-source.json'
target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'records':len(records),'sourceSha256':payload['sha256'],'summary':payload['summary']},ensure_ascii=False))
