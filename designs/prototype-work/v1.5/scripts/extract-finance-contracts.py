"""Extract contractual repricing terms and peer rates without supplying missing facts."""
from pathlib import Path
from hashlib import sha256
from datetime import datetime, date
from calendar import monthrange
from collections import Counter
import json
import subprocess
from shutil import which
from openpyxl import load_workbook

root = Path(__file__).resolve().parents[4]
active = Path(__file__).resolve().parents[1]
source = root / 'designs/prototype-releases/v1.1.0/data-engineering-prototype-review/review-v3/source-snapshots/融资一览表_一期演示数据.xlsx'
base = json.loads((active / 'public/data/portfolio.json').read_text())
mapped = {'演示单位553':'ENT-020', '演示单位465':'ENT-007', '演示单位561':'ENT-017'}
cycles = {'按月':1, '按季度':3, '按半年':6, '按年':12, '即时浮动':0}
def iso(value):
    if not value:
        return None
    return str(value)[:10]
def next_reset(first, months):
    if first is None or months is None or months == 0:
        return None
    anchor = date.fromisoformat(first)
    step = 0
    while True:
        absolute = anchor.year * 12 + anchor.month - 1 + step * months
        year, month = absolute // 12, absolute % 12 + 1
        result = date(year, month, min(anchor.day, monthrange(year, month)[1])).isoformat()
        if result > base['asOf']:
            return result
        step += 1

workbook = load_workbook(source, read_only=True, data_only=True)
sheet = workbook.worksheets[0]
iterator = iter(sheet.values)
headers = next(iterator)
contracts, peers = [], []
for row_number, values in enumerate(iterator, 2):
    row = dict(zip(headers, values))
    if not row.get('借据编号'):
        continue
    common = dict(id=row['借据编号'], borrower=row['借款人'], bankName=row['融资机构'],
                  bankType=row['融资机构类别'], sector=row['所属板块'], currency=row['借据币种'],
                  rate=row['当前利率'], ratePeriod=row['年月日利率'],
                  balanceYuan=row['借据余额（折合人民币）'], startDate=iso(row['提款日期']),
                  maturityDate=iso(row['提款到期日期']), creditRating=row.get('信用评级'),
                  ratingAgency=row.get('评级机构'), ratingDate=iso(row.get('评级日期')),
                  sourceRow=row_number)
    peers.append(common)
    if row['借款人'] not in mapped:
        continue
    first, cycle = iso(row['利率调整首次生效日']), cycles.get(row['利率调整周期'])
    contracts.append(dict(common, enterpriseId=mapped[row['借款人']],
        principal=row['借据余额（折合人民币）'] / 1000000,
        rateType={'浮动利率':'FLOATING','固定利率':'FIXED'}.get(row['利率形式']),
        rateIndex=row['利率类型名称'], benchmarkRate=row['基准利率值'],
        spreadMode=row['浮动方式'], spreadValue=row['浮动值'],
        resetCycle=row['利率调整周期'], resetCycleMonths=cycle, firstResetDate=first,
        nextResetDate=next_reset(first, cycle) if row['利率形式']=='浮动利率' else None,
        dayCount=int(row['计息天数']) if row['计息天数'] else None,
        capRate=float(row['封顶利率']) if row['封顶利率'] not in [None,''] else None))
workbook.close()
assert len(contracts) == 301 and len(peers) == 5218
metadata = dict(asOf=base['asOf'], sourceDigest=base['digest'], source=str(source.relative_to(root)),
    sourceSheet=sheet.title, sourceSha256=sha256(source.read_bytes()).hexdigest(),
    classification='EXTRACTED_EXISTING_DEMO_LEDGER',
    ratingCoverage=sum(bool(r['creditRating']) for r in peers),
    sourceColumns=list(headers), currencyBasis='借据余额（折合人民币）；利率匹配保持原币种一致')
assets = [dict(metadata, id='asset-finance-contracts-v15-1', version='FINANCE-CONTRACT-TERMS-20251231-V1',
    name='原融资台账 · 合同与重定价明细', kind='ledger-contracts', rows=contracts),
    dict(metadata, id='asset-finance-peer-rates-v15-1', version='FINANCE-PEER-RATES-20251231-V1',
    name='原融资台账 · 银行可比利率', kind='peer-rates', rows=peers)]
target = active / 'public/data/finance-contract-assets.json'
# JSON normalization and the runtime fingerprint use the same JavaScript serialization.
node = which('node')
if not node:
    raise RuntimeError('Node.js is required to compute runtime-compatible asset fingerprints')
script = "const fs=require('fs'),c=require('crypto'),a=JSON.parse(fs.readFileSync(0,'utf8'));for(const x of a)x.digest=c.createHash('sha256').update(JSON.stringify(x)).digest('hex');fs.writeFileSync(process.argv[1],JSON.stringify({assets:a})+'\\n');"
subprocess.run([node,'-e',script,str(target)], input=json.dumps(assets,ensure_ascii=False), text=True,check=True)
print(json.dumps(dict(contracts=len(contracts),peers=len(peers),mappedEnterprises=sorted(mapped.values()),
    floatingContracts=sum(r['rateType']=='FLOATING' for r in contracts),
    missingFloatingTerms=sum(r['rateType']=='FLOATING' and (r['firstResetDate'] is None or r['resetCycleMonths'] is None) for r in contracts),
    ratingCoverage=metadata['ratingCoverage'],sourceSha256=metadata['sourceSha256']),ensure_ascii=False))
