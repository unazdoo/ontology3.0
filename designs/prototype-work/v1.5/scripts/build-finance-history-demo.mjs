import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const data=JSON.parse(await readFile(new URL('../public/data/portfolio.json',import.meta.url),'utf8'));
const asOf=new Date(data.asOf+'T00:00:00Z'),rows=[];
for(const [index,company] of data.enterprises.entries()){
  const loans=data.loans.filter(l=>l.enterpriseId===company.id&&l.startDate<=data.asOf&&l.maturityDate>data.asOf),balance=loans.reduce((sum,l)=>sum+l.principal*1e6,0),rate=loans.reduce((sum,l)=>sum+l.principal*1e6*l.rate,0)/balance;
  const wave=i=>.065*Math.sin(i*Math.PI/3+index*.37)+.027*Math.cos(i*Math.PI/2.5+index*.21);
  for(let i=0;i<24;i++){
    const date=i===23?data.asOf:new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth()-22+i,0)).toISOString().slice(0,10),distance=23-i;
    const value=i===23?rate:Number(Math.max(.1,rate+distance*(.014+index%5*.0018)+wave(i)-wave(23)).toFixed(6));
    const principal=i===23?balance:Math.round(balance*(1-distance*.006+.026*(Math.sin(i*.55+index)-Math.sin(23*.55+index)))*100)/100;
    rows.push({enterpriseId:company.id,asOf:date,rate:value,balanceYuan:principal,identity:i===23?'SNAPSHOT':'SIMULATED_HISTORY'});
  }
}
const asset={schemaVersion:'ofw.asset.finance-history.v1',id:'asset-finance-history-demo-v1',version:'DATA-FINANCE-HISTORY-DEMO-2025-V1',name:'企业月度融资成本 · 演示历史',kind:'finance-history',classification:'SIMULATED_HISTORY_CALIBRATED_TO_EXISTING_SNAPSHOT',asOf:data.asOf,sourceDataVersion:data.dataVersion,sourceDigest:data.digest,method:'deterministic-calibrated-seasonality-v1',note:'按用户要求虚构补充历史月份，仅用于连续时序及模型构建演示。最后一期与既有快照一致，不冒充原始台账历史。',fields:[{key:'enterpriseId',label:'企业ID',type:'string',unit:''},{key:'asOf',label:'月份',type:'date',unit:''},{key:'rate',label:'融资成本率',type:'number',unit:'%'},{key:'balanceYuan',label:'月末融资本金',type:'number',unit:'元'},{key:'identity',label:'数据身份',type:'string',unit:''}],rows};
asset.digest=createHash('sha256').update(JSON.stringify(asset)).digest('hex');
await writeFile(new URL('../public/data/finance-history-demo.json',import.meta.url),JSON.stringify(asset,null,2)+'\n');
console.log(`${rows.length} records; 24 months; snapshot anchor ${data.asOf}; ${asset.digest}`);
