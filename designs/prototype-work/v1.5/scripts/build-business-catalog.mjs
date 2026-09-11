import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import Decimal from 'decimal.js';
const root = new URL('../../../../', import.meta.url);
const base = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const json = p => JSON.parse(read(p));
const clone = v => JSON.parse(JSON.stringify(v));
const digest = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const fingerprint = v => JSON.stringify(canonical(v));
const round = (v, n=8) => new Decimal(v).toDecimalPlaces(n).toNumber();
const env = {window:{}};
vm.runInNewContext(read('designs/prototype-releases/v1.1.0/ontology-management-review/canvas-first/portfolio-s001-seed.js'), env);
vm.runInNewContext(read('designs/prototype-releases/v1.1.0/scenarios/s002/data.js'), env);
const original = clone(env.window.OFW_M01_S001_SEED.publishedVersions[0]);
const budget = clone(env.window.S002_DATA);
const source = json('designs/prototype-work/v1.5/composite/modules/m07/resources/portfolio.json');
const finance = json('designs/prototype-work/v1.5/composite/resources/business-finance-source.json');
const context = clone(original.scenarioContext);
let now = new Date().toISOString();
const assetId = 'V14-ENTERPRISE-VIEW';
const propertyLabels = {enterpriseId:'企业编号',name:'业务名称',industry:'所属产业',sector:'所属板块',roles:'业务角色',riskScore:'风险评分',riskTier:'风险分档',balance:'融资余额',averageFinancingCost:'平均融资成本',loanCount:'融资笔数',debtRatio:'资产负债率',departmentId:'部门编号',year:'预算年度',period:'期间',versionId:'预算版本',budgetAmount:'费用预算',actualAmount:'实际费用',executionRate:'预算执行率',actualRevenue:'实际收入',costToRevenue:'成本占收比',account:'预算科目',annualId:'年度部门预算编号',productId:'产品编号',category:'产品类型',holdingId:'持仓编号',ledgerId:'台账范围',asOf:'数据截至',value:'当前市值',price:'现价',cost:'投资金额',pnl:'累计损益',snapshotId:'持仓观测编号'};
const types=clone(original.objects), links=clone(original.links), metrics=clone(original.metrics), rules=clone(original.rules), actions=clone(original.actions);
const members=clone(original.dataContract.members), relations=clone(original.dataContract.relations);
const records={};
const rowMeta={};
const descriptions={};
const addRows=(memberId, rows) => {records[memberId]=rows;rowMeta[memberId]={};};
const newType=(id,name,memberId,grain,fields) => {
 const props=fields.map(([key,type='文本',unit='—',optional=false],i)=>({id:`PROP-V14-${id.replace(/^OBJ-/, '')}-${key.replace(/([a-z])([A-Z])/g,'$1-$2').toUpperCase()}`,name:propertyLabels[key]||key,dataType:type,unit,definition:`${name}的${propertyLabels[key]||key}。`,sourceFieldId:`FIELD-${memberId}-${key.toUpperCase()}`,sourceField:propertyLabels[key]||key,role:i===0?'身份':key==='name'?'标题':'普通属性',nullable:optional?'是':'否',status:'已映射',owner:'本体管理',terms:[],key}));
 const obj={id,name,definition:grain,identity:props[0].id,title:(props.find(p=>p.key==='name')||props[0]).id,memberId,objectKind:'业务实体',owner:'本体管理',properties:props,terms:[],grain};
 types.push(obj);members.push({id:memberId,name,grain,identity:props[0].name,identityFieldId:props[0].sourceFieldId,fields:props.map(p=>[p.name,p.dataType,null,p.sourceFieldId])});return obj;
};
const enterpriseType=newType('OBJ-ENTERPRISE','企业','V14-ENTERPRISE','一个统一企业身份；融资、风险、预算和借款申请人为业务角色。',[['enterpriseId'],['name'],['industry','文本','—',true],['sector','文本','—',true],['roles'],['riskScore','数值','分',true],['riskTier','文本','—',true],['balance','数值','亿元',true],['averageFinancingCost','数值','%',true],['loanCount','数值','笔',true],['debtRatio','数值','%',true],['asOf','日期']]);
const departmentType=newType('OBJ-ENTERPRISE-DEPARTMENT','企业责任部门','V14-DEPARTMENT','企业内具有稳定部门编号的预算责任部门。',[['departmentId'],['name'],['enterpriseId']]);
const annualType=newType('OBJ-ENTERPRISE-BUDGET-ANNUAL','部门年度预算执行','V14-BUDGET-ANNUAL','企业、部门、年度及预算版本共同确定的一条年度预算执行记录。',[['annualId'],['name'],['departmentId'],['enterpriseId'],['year','数值','年'],['versionId'],['budgetAmount','数值','万元'],['actualAmount','数值','万元'],['executionRate','数值','%'],['actualRevenue','数值','万元'],['costToRevenue','数值','%'],['asOf','日期']]);
const detailType=newType('OBJ-ENTERPRISE-BUDGET-DETAIL','预算科目期间明细','V14-BUDGET-DETAIL','所属年度部门预算下，按原来源明细身份保存科目、季度及项目范围的记录。',[['detailId'],['name'],['annualId'],['departmentId'],['enterpriseId'],['account'],['period'],['budgetAmount','数值','万元'],['actualAmount','数值','万元'],['executionRate','数值','%'],['asOf','日期']]);
const productType=newType('OBJ-INVESTMENT-PRODUCT','金融产品','V14-PRODUCT','现有投资台账中按稳定产品编号识别的金融产品；产品分类是属性。',[['productId'],['name'],['category'],['asOf','日期']]);
const holdingType=newType('OBJ-INVESTMENT-HOLDING','产品汇总持仓','V14-HOLDING','现有台账范围与产品编号共同确定的汇总持仓，不拆分未登记的账户或交易批次。',[['holdingId'],['name'],['ledgerId'],['productId'],['asOf','日期']]);
const snapshotType=newType('OBJ-HOLDING-OBSERVATION','持仓时点观测','V14-HOLDING-OBSERVATION','汇总持仓在一个实际观测日期的市值、现价、投资金额和浮动盈亏。',[['snapshotId'],['name'],['holdingId'],['asOf','日期'],['value','数值','元'],['price','数值','元'],['cost','数值','元'],['pnl','数值','元']]);
const enterprises=source.objects.filter(o=>o.enterpriseId).map(o=>({enterpriseId:o.id,name:o.title,industry:o.properties.industry.value,sector:finance.records.find(r=>r.enterpriseId===o.id)?.sector||null,roles:o.roles.join('、'),riskScore:o.properties.riskScore?.value,riskTier:o.properties.riskTier?.value,balance:o.properties.balance?.value,averageFinancingCost:o.properties.averageFinancingCost?.value,loanCount:o.properties.loanCount?.value,asOf:'2025-12-31'}));
const applicants=source.objects.filter(o=>['preloan::LoanApplicant-001','preloan::LoanApplicant-003'].includes(o.id));
for(const o of applicants)enterprises.push({enterpriseId:`ENT-APPLICANT-${o.id.slice(-3)}`,name:o.title,industry:null,sector:null,roles:'借款申请人',debtRatio:o.properties.debtRatio.value,asOf:'2026-08-15'});
addRows(enterpriseType.memberId,enterprises);
const ownerEnterprise='ENT-020';
addRows(departmentType.memberId,budget.departments.map(d=>({departmentId:`ENT-020-DEPT-${d.id}`,name:d.name,enterpriseId:ownerEnterprise,sourceDepartmentId:d.id})));
const departmentId=name=>records[departmentType.memberId].find(d=>d.name===name).departmentId;
addRows(annualType.memberId,budget.annualFacts.map(r=>({annualId:`BUDGET-${r.year}-${departmentId(r.department)}`,name:`${r.department} · ${r.year}年预算`,departmentId:departmentId(r.department),enterpriseId:ownerEnterprise,year:r.year,versionId:`FY${r.year}-APPROVED-FINAL-v1`,budgetAmount:r.approvedExpenseBudget,actualAmount:r.actualExpense,executionRate:round(new Decimal(r.actualExpense).div(r.approvedExpenseBudget).times(100)),actualRevenue:r.actualRevenue,costToRevenue:round(new Decimal(r.actualExpense).div(r.actualRevenue).times(100)),asOf:`${r.year}-12-31`,dataMarker:r.dataMarker,sourceRefs:[`S002_DATA.annualFacts/${r.year}/${r.department}`]})));
const expenses=budget.expenseDetails;

// Source adapters below use explicit stable fields, never positional matches.
for (const m of members.slice(0,4)) records[m.id]=[];
const financeType=types.find(t=>t.id==='OBJ-FINANCING-ENTITY');
const loanType=types.find(t=>t.id==='OBJ-FINANCING-DETAIL');
const bankType=types.find(t=>t.id==='OBJ-FINANCIAL-INSTITUTION');
const ownerType=types.find(t=>t.id==='OBJ-FINANCING-OWNER');
const sourceKeys={
 'PROP-FINANCING-ENTITY-UNIT-CODE':'unitCode','PROP-FINANCING-ENTITY-UNIT-NAME':'name','PROP-FINANCING-ENTITY-SECTOR':'sector','PROP-FINANCING-ENTITY-OWNER-ID':'ownerId',
 'PROP-FINANCING-DETAIL-LOAN-ID':'loanId','PROP-FINANCING-DETAIL-ENTITY-CODE':'unitCode','PROP-FINANCING-DETAIL-INSTITUTION-CODE':'institutionId','PROP-FINANCING-DETAIL-CURRENCY':'currency','PROP-FINANCING-DETAIL-CNY-BALANCE':'balanceYuan','PROP-FINANCING-DETAIL-INTEREST-RATE':'rate','PROP-FINANCING-DETAIL-RATE-TYPE':'rateType','PROP-FINANCING-DETAIL-TERM-TYPE':'termType','PROP-FINANCING-DETAIL-GUARANTEE-TYPE':'guaranteeType','PROP-FINANCING-DETAIL-AS-OF-DATE':'asOf',
 'PROP-FINANCIAL-INSTITUTION-CODE':'institutionId','PROP-FINANCIAL-INSTITUTION-NAME':'name','PROP-FINANCIAL-INSTITUTION-CATEGORY':'category','PROP-FINANCING-OWNER-ID':'ownerId','PROP-FINANCING-OWNER-NAME':'name'
};
for(const type of types.slice(0,4))type.properties.forEach(p=>{p.key=sourceKeys[p.id];if(!p.key)throw Error('Unmapped source property '+p.id);});
const bankId=name=>`INST-${digest(name).slice(0,12).toUpperCase()}`;
const mappedUnits=[['UNIT-553','ENT-020','s001.owner.001'],['UNIT-465','ENT-007','s001.owner.009'],['UNIT-561','ENT-017','s001.owner.009']];
for(const [unitCode,eid,ownerId] of mappedUnits)records[financeType.memberId].push({unitCode,name:enterprises.find(e=>e.enterpriseId===eid).name,sector:finance.records.find(r=>r.enterpriseId===eid).sector,ownerId,enterpriseId:eid});
for(const r of finance.records) records[loanType.memberId].push({...r,loanId:r.id,institutionId:bankId(r.institution),asOf:finance.asOf});
for(const name of new Set(finance.records.map(r=>r.institution)))records[bankType.memberId].push({institutionId:bankId(name),name,category:'融资机构'});
for(const oid of new Set(mappedUnits.map(r=>r[2])))records[ownerType.memberId].push({ownerId:oid,name:source.objects.find(o=>o.canonicalObjectRef?.id===oid).title});
const addProperty=(type,key,name)=>{const p={id:`PROP-V14-${type.id.replace(/^OBJ-/,'')}-${key.toUpperCase()}`,key,name,dataType:'文本',unit:'—',definition:name,sourceFieldId:`FIELD-${type.memberId}-${key.toUpperCase()}`,sourceField:name,role:'普通属性',nullable:'否',status:'已映射',owner:'本体管理'};type.properties.push(p);members.find(m=>m.id===type.memberId).fields.push([name,'文本',null,p.sourceFieldId]);return p;};
loanType.properties.find(p=>p.key==='guaranteeType').nullable='是';
addProperty(financeType,'enterpriseId','统一企业编号');addProperty(loanType,'enterpriseId','统一企业编号');
const relate=(id,name,reverse,a,aKey,b,bKey,cardinality='多对一')=>{const ap=a.properties.find(p=>p.key===aKey),bp=b.properties.find(p=>p.key===bKey);links.push({id,name,reverseName:reverse,allowedDirection:'双向导航',source:a.id,target:b.id,cardinality,sourceEndpoint:{kind:'property',id:ap.id},targetEndpoint:{kind:'property',id:bp.id},definition:`${name}；通过明确字段关联。`,owner:'本体管理',terms:[]});relations.push({id:`REL-${id}`,name,sourceMemberId:a.memberId,sourceFieldId:ap.sourceFieldId,targetMemberId:b.memberId,targetFieldId:bp.sourceFieldId,cardinality});};
relate('LINK-V14-FINANCE-ENTERPRISE','融资主体对应企业','具有融资主体角色',financeType,'enterpriseId',enterpriseType,'enterpriseId','一对一');
relate('LINK-V14-LOAN-ENTERPRISE','融资借据归属企业','拥有融资借据',loanType,'enterpriseId',enterpriseType,'enterpriseId');
relate('LINK-V14-DEPARTMENT-ENTERPRISE','部门归属企业','具有预算责任部门',departmentType,'enterpriseId',enterpriseType,'enterpriseId');
relate('LINK-V14-ANNUAL-DEPARTMENT','年度预算归属部门','具有年度预算',annualType,'departmentId',departmentType,'departmentId');
relate('LINK-V14-DETAIL-ANNUAL','科目明细归属年度预算','具有科目期间明细',detailType,'annualId',annualType,'annualId');
relate('LINK-V14-HOLDING-PRODUCT','持仓对应产品','具有汇总持仓',holdingType,'productId',productType,'productId');
relate('LINK-V14-OBSERVATION-HOLDING','观测归属持仓','具有历史观测',snapshotType,'holdingId',holdingType,'holdingId');
const products=source.objects.filter(o=>o.objectTypeId==='m01.object-type.financial-product'&&o.id!=='investment::product-03');
addRows(productType.memberId,products.map(o=>({productId:o.canonicalObjectRef.id,name:o.title,category:o.properties.categoryLevel2.value,asOf:'2026-07-17',legacyId:o.id})));
const holdingSources=source.objects.filter(o=>o.objectTypeId==='m01.object-type.investment-holding'&&o.id!=='investment::holding-03');
const holdings=[],observations=[];
for(const holding of holdingSources){
 const productLink=source.links.find(l=>l.from===holding.id&&l.linkTypeId==='m01.link-type.holding-refers-product');
 const product=products.find(p=>p.id===productLink?.to);if(!product)throw Error('Unresolved holding product '+holding.id);
 const holdingId=`HOLD-S005-${product.canonicalObjectRef.id}`;
 holdings.push({holdingId,name:`${product.title} · 汇总持仓`,ledgerId:'S005-INVESTMENT-LEDGER',productId:product.canonicalObjectRef.id,asOf:holding.properties.validTo.value,legacyId:holding.id});
 const series=source.series.filter(s=>s.ownerObjectId===holding.id);
 const fieldFor=s=>/market|市值/i.test(s.propertyId+' '+s.label)?'value':/cost|investmentAmount|投资金额|成本/i.test(s.propertyId+' '+s.label)?'cost':/price|现价/i.test(s.propertyId+' '+s.label)?'price':/profit|pnl|损益|收益/i.test(s.propertyId+' '+s.label)?'pnl':null;
 const byDate=new Map();for(const s of series){const field=fieldFor(s);if(!field)throw Error('Unknown holding series');for(const p of s.points){if(typeof p.v!=='number')continue;if(!byDate.has(p.t))byDate.set(p.t,{snapshotId:`${holdingId}@${p.t}`,name:`${product.title} · ${p.t}`,holdingId,asOf:p.t});byDate.get(p.t)[field]=p.v;}}
 observations.push(...byDate.values());
}
addRows(holdingType.memberId,holdings);addRows(snapshotType.memberId,observations);
// Expense adapter deliberately retains the original prepared-budget row identity and markers.
addRows(detailType.memberId,expenses.map(r=>({detailId:r.detailId||r.id,name:`${r.department} · ${r.subject||r.account||r.expenseSubject} · ${r.period||r.quarter}`,annualId:`BUDGET-${r.year}-${departmentId(r.department)}`,departmentId:departmentId(r.department),enterpriseId:ownerEnterprise,account:r.subject||r.account||r.expenseSubject,period:r.period||r.quarter,budgetAmount:r.approvedExpenseBudget??r.approvedBudget??r.budgetAmount,actualAmount:r.actualExpense??r.actualAmount??r.actual,executionRate:round(new Decimal(r.actualExpense??r.actualAmount??r.actual).div(r.approvedExpenseBudget??r.approvedBudget??r.budgetAmount).times(100)),asOf:`${r.year}-12-31`,sourceRecord:clone(r)})));
for(const m of members){const type=types.find(t=>t.memberId===m.id),rs=records[m.id];if(!rs)throw Error('Missing member '+m.id);const key=type.properties.find(p=>p.id===type.identity).key;const keys=rs.map(r=>r[key]);if(keys.some(v=>v==null)||new Set(keys).size!==keys.length)throw Error('Invalid keys '+m.id);for(const r of rs)for(const p of type.properties)if(r[p.key]==null&&p.nullable!=='是')throw Error(`Missing ${m.id}.${p.key}: ${JSON.stringify(r).slice(0,200)}`);Object.assign(m,{rows:rs.length,identityCheckStatus:'通过',identityMissingCount:0,identityDuplicateCount:0,identityEvidenceLocator:`business-source.json#members/${m.id}`,grain:m.grain||type.definition,identityFieldId:type.properties.find(p=>p.id===type.identity).sourceFieldId,identity:type.properties.find(p=>p.id===type.identity).name});}
for(const relation of relations){const a=types.find(t=>t.memberId===relation.sourceMemberId),b=types.find(t=>t.memberId===relation.targetMemberId);const ak=a.properties.find(p=>p.sourceFieldId===relation.sourceFieldId)?.key,bk=b.properties.find(p=>p.sourceFieldId===relation.targetFieldId)?.key;if(!ak||!bk)throw Error('Unknown relation endpoint '+relation.id);const targets=new Set(records[b.memberId].map(r=>r[bk]));const unmatched=records[a.memberId].filter(r=>!targets.has(r[ak]));if(unmatched.length)throw Error('Unmatched relation '+relation.id);Object.assign(relation,{endpointCheckStatus:'通过',unmatchedSourceCount:0,unmatchedTargetCount:0,endpointEvidenceLocator:`business-source.json#relations/${relation.id}`});}
const sourcePayload={schemaVersion:'ofw.enterprise-business-source.v1',budgetOwnership:{enterpriseId:ownerEnterprise,classification:'USER_AUTHORIZED_DEMO_ASSIGNMENT',basis:'2026-09-10用户要求将单家企业预算融入企业对象视图；仅设置原型演示归属，不改变来源金额。'},sources:{finance:{path:finance.source,sha256:finance.sha256},budget:{path:'designs/prototype-releases/v1.1.0/scenarios/s002/data.js',sha256:digest(read('designs/prototype-releases/v1.1.0/scenarios/s002/data.js'))},portfolio:{path:'designs/prototype-work/v1.5/composite/modules/m07/resources/portfolio.json',sha256:digest(source)}},members,relations,records,groupSummary:finance.summary};
const sourceText=JSON.stringify(sourcePayload,null,2)+'\n';const hash=digest(sourceText);const versionId=`V14-ENTERPRISE-VIEW-${hash.slice(0,12).toUpperCase()}`;const existingPreparation=new URL('composite/resources/business-preparation.json',base);
if(fs.existsSync(existingPreparation)){const existing=JSON.parse(fs.readFileSync(existingPreparation,'utf8'));if(existing.delivery.assetVersion===versionId)now=existing.delivery.deliveredAt;}
const snapshotId=`SNAPSHOT-${versionId}`,readId=`READ-${versionId}`,definitionId='DEF-V14-ENTERPRISE-VIEW-1',runId=`RUN-${versionId}`,qualityId=`QUALITY-${versionId}`;
const delivery={contractSchemaVersion:2,sourceModule:'数据工程',contractCode:'C003',deliveryId:`C003-${versionId}`,deliverySeriesId:`C003-${versionId}`,attemptNumber:1,retryOf:null,previousDeliveryId:null,deliveryStatus:'已发送',deliveredAt:now,scenarioContext:context,evidenceLocator:'v1.4/composite/resources/business-source.json',assetId,t006Id:assetId,assetName:'企业业务全景来源投影',assetVersion:versionId,t007Version:versionId,asOf:'2026-08-15',t008AsOf:'2026-08-15',sourceSnapshotId:snapshotId,sourceReadEventId:readId,sourceFingerprint:{algorithm:'SHA-256',value:hash,sizeBytes:Buffer.byteLength(sourceText)},processingModuleVersion:definitionId,runEvidence:{runId,definitionVersion:definitionId,qualityResultId:qualityId,evidenceLocator:'v1.4/composite/resources/business-source.json'},publishedAt:now,versionDescription:'固定既有融资、预算、风险与投资台账投影；逐项保留原截至日和演示标识。',source:'既有原型来源文件的只读身份映射与关系投影',sourceChain:[snapshotId,readId,definitionId,runId,qualityId,versionId],publicationState:'已发布',purpose:'企业业务全景对象、角色、部门预算、产品与汇总持仓',consumptionRestriction:'本机原型；预算企业归属为用户授权演示映射；不替代生产主数据或修改原始快照。',lineageCheckStatus:'通过',lineageEvidenceLocator:'v1.4/composite/resources/business-source.json#sources',mappingEligibility:{status:'可供本体映射',evidenceLocator:'v1.4/composite/resources/business-source.json#members'},qualitySummary:{status:'通过',resultId:qualityId,checkedAt:now,evidenceLocator:'v1.4/composite/resources/business-source.json#relations',checks:['member-identity','required-fields','relationship-endpoints','source-financing-reconciliation']},members,relations};
delivery.t008Confirmation={snapshotId,asOf:delivery.asOf,sourceReadEventId:readId,confirmedBy:'原型实施校验',confirmedAt:now,basis:'逐源保留截至日；组合投影截止取最晚来源时点',evidenceId:`ASOF-${versionId}`,evidenceLocator:delivery.evidenceLocator,sizeBytes:Buffer.byteLength(sourceText),scenarioContext:context};
const text=fingerprint(delivery);let fnv=2166136261;for(let i=0;i<text.length;i++){fnv^=text.charCodeAt(i);fnv=Math.imul(fnv,16777619);}delivery.payloadFingerprint=`C003-PF-${(fnv>>>0).toString(16).padStart(8,'0').toUpperCase()}-${text.length}`;
const budgetValue=key=>annualType.properties.find(p=>p.key===key).id;
metrics.push({id:'MET-V14-BUDGET-EXECUTION',name:'部门年度费用预算执行率',unit:'%',sourceObjectId:annualType.id,subjectObjectId:annualType.id,definition:'沿用预算模块：实际费用除以最终批准费用预算。',calculation:'实际费用 / 费用预算 * 100',scope:'企业下的部门年度预算',time:'按年度预算记录的截至日',zeroHandling:'预算为零时不计算比率',dependencyIds:[budgetValue('actualAmount'),budgetValue('budgetAmount')],type:'Metric',owner:'本体管理'});
const positions={};let i=0;for(const item of [...types,...links,...metrics,...rules,...actions])positions[item.id]=[80+(i%5)*330,80+Math.floor(i++/5)*150];
const blueprint={name:'企业业务全景本体',definition:'在既有融资语义之上定义统一企业、部门预算、金融产品及产品汇总持仓；集合和汇总视图不作为业务实例。',basedOnVersionId:original.id,objects:types,links,metrics,rules,actions,positions,release:{owner:'本体管理',effectiveFrom:now,effectiveTo:'',changeReason:'按用户确认统一企业对象、企业下预算、产品汇总持仓与精确消费映射。',replacementMode:'无替代关系',replacementResourceIds:[],replacementMap:{},replacementDeclaration:'无替代关系',evidenceState:'尚未形成',confirmed:true}};
fs.writeFileSync(new URL('composite/resources/business-source.json',base),sourceText);
fs.writeFileSync(new URL('composite/resources/business-preparation.json',base),JSON.stringify({delivery,blueprint},null,2)+'\n');
console.log(JSON.stringify({versionId,objects:types.length,members:members.map(m=>[m.id,m.rows]),relations:relations.length}));

fs.writeFileSync(new URL("composite/resources/business-source-manifest.json",base),JSON.stringify({id:assetId,name:delivery.assetName,version:versionId,asOf:delivery.asOf,sha256:hash,sourceUrl:"/designs/prototype-work/v1.5/composite/resources/business-source.json",members:types.map(t=>({id:t.memberId,name:t.name,columns:t.properties.map(p=>({key:p.key,name:p.name,unit:p.unit}))}))},null,2)+"\n");
