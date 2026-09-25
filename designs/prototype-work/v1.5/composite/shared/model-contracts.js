const f=(key,label,type='number',unit='')=>({key,label,type,unit});
export const INPUT_PORTS={
  companies:{name:'企业',member:'enterprises',fields:[f('id','企业主键','string'),f('name','企业名称','string'),f('industry','业务板块','string'),f('cash','可用现金','number','百万元'),f('benchmarkRate','参考利率','number','%')]},
  loans:{name:'融资合同',member:'loans',fields:[f('id','合同主键','string'),f('enterpriseId','企业外键','string'),f('principal','存续本金','number','百万元'),f('rate','合同利率','number','%'),f('rateType','利率类型','string'),f('startDate','起息日期','date'),f('maturityDate','到期日期','date')]},
  facilities:{name:'授信',member:'facilities',fields:[f('id','授信主键','string'),f('enterpriseId','企业外键','string'),f('undrawn','未用授信','number','百万元'),f('validUntil','有效期至','date')]},
  risk:{name:'历史评分',member:'risk',fields:[f('enterpriseId','企业外键','string'),f('score','历史评分'),f('tier','历史分档','string')]},
  history:{name:'月度成本历史',member:'finance-history',fields:[f('enterpriseId','企业外键','string'),f('asOf','观察月份','date'),f('rate','成本率','number','%'),f('balanceYuan','融资本金','number','元'),f('identity','数据身份','string')]}
};
const nullable=(key,label,type='string',unit='')=>({...f(key,label,type,unit),nullable:true});
INPUT_PORTS.ledger={name:'原借据与重定价条款',member:'ledger-contracts',fields:[f('id','原借据主键','string'),f('enterpriseId','企业外键','string'),f('borrower','原借款主体','string'),f('bankName','融资银行','string'),f('bankType','机构类别','string'),f('sector','原台账板块','string'),f('currency','原币种','string'),f('balanceYuan','折人民币余额','number','元'),f('rate','当前利率','number','%'),f('ratePeriod','利率周期口径','string'),f('rateType','利率形式','string'),f('startDate','提款日','date'),f('maturityDate','到期日','date'),nullable('rateIndex','基准利率名称'),nullable('firstResetDate','首次重定价生效日','date'),nullable('resetCycle','台账重定价周期'),nullable('resetCycleMonths','重定价周期月数','number','月'),nullable('nextResetDate','下一重定价日','date'),f('dayCount','年计息天数','number','天'),nullable('spreadMode','浮动方式'),nullable('capRate','封顶利率','number','%'),nullable('creditRating','信用评级'),nullable('ratingAgency','评级机构'),nullable('ratingDate','评级日期','date'),f('sourceRow','原台账行号')]};
INPUT_PORTS.peers={name:'银行可比融资利率',member:'peer-rates',fields:['id','borrower','bankName','bankType','sector','currency','rate','ratePeriod','balanceYuan','startDate','maturityDate','creditRating','ratingAgency','ratingDate','sourceRow'].map(key=>INPUT_PORTS.ledger.fields.find(f=>f.key===key))};
export function inputPorts(type,methodId){if(methodId==='history-continuation')return ['companies','history'];if(['stock-rate','refinance-ai'].includes(methodId))return ['companies','ledger',...(methodId==='refinance-ai'?['peers']:[])];return ['companies','loans',...(type==='risk'?['facilities','risk']:[]),...(type==='cost'&&methodId?['history']:[])];}
const assetNames={enterprises:'企业主数据',loans:'融资合同台账',facilities:'授信台账',risk:'债务风险评估结果'};
export function modelAssetCatalog(state){
  const assets=[];
  for(const [key,data] of Object.entries(state.datasets))for(const member of Object.keys(assetNames)){
    const port=Object.values(INPUT_PORTS).find(p=>p.member===member),rows=member==='risk'?data.enterprises.map(c=>({enterpriseId:c.id,score:c.riskScore,tier:c.riskTier})):data[member];
    assets.push({ref:`${key}:${member}`,id:`asset-v14-${member}`,name:assetNames[member],member,version:data.dataVersion,digest:data.digest,dataKey:key,asOf:data.asOf,classification:data.classification,fields:port.fields,rows});
  }
  for(const asset of Object.values(state.bindingAssets||{}))assets.push({...asset,ref:asset.id,member:asset.kind,fields:asset.fields||Object.values(INPUT_PORTS).find(p=>p.member===asset.kind)?.fields});
  return assets;
}
export function outputFields(type,methodId){
  const common=[f('enterpriseId','企业主键','string'),f('asOf','输出时点','date'),f('runId','运行编号','string')];
  if(methodId==='refinance-ai')return [...common,{...f('forecast.v','预测成本率','number','%'),nullable:true},f('forecast.balanceYuan','预测融资本金','number','元'),f('proposalIds','推荐方案索引','string[]')];
  if(type==='cost'&&methodId)return [...common,{...f('forecast.v','预测成本率','number','%'),nullable:true},f('forecast.balanceYuan','预测融资本金','number','元')];
  if(type==='cost')return [...common,f('baselineRate','基准成本率','number','%'),f('predictedRate','预测成本率','number','%'),f('predictedInterest','预测利息','number','元'),f('deltaInterest','利息变化','number','元')];
  if(type==='structure')return [...common,f('refinanceAmount','建议调整额','number','元'),f('optimizedShortRatio','调整后到期占比','number','%'),f('annualCostDelta','年度成本变化','number','元'),f('achieved','目标是否满足','boolean')];
  return [...common,f('historicalScore','历史评分'),f('level','监控等级','string'),f('gapYuan','测算资金缺口','number','元')];
}
export function defaultIOBindings(state,goal,config=goal.draft,{history=true}={}){
  const catalog=modelAssetCatalog(state),inputs={};
  for(const id of inputPorts(goal.type,config.methodId)){
    const port=INPUT_PORTS[id],asset=id==='history'?history?catalog.find(a=>a.member==='finance-history'&&a.sourceDigest===state.datasets[config.dataKey]?.digest):null:catalog.find(a=>a.member===port.member&&(a.dataKey===config.dataKey||a.sourceDigest===state.datasets[config.dataKey]?.digest));
    if(!asset&&id==='history')continue;
    inputs[id]={assetRef:asset?.ref||'',assetVersion:asset?.version||'',assetDigest:asset?.digest||'',fields:Object.fromEntries(port.fields.map(field=>[field.key,field.key]))};
  }
  return {schemaVersion:1,inputs,output:{datasetId:`model-result:${goal.id}`,name:`${goal.name} · 输出数据集`,grain:goal.type==='cost'&&config.methodId?'enterprise-month-run':'enterprise-run',fields:outputFields(goal.type,config.methodId).map(field=>({...field,name:field.key==='forecast.v'?'costRate':field.key==='forecast.balanceYuan'?'balanceYuan':field.key,source:field.key})),destinations:goal.type==='cost'&&config.methodId?['temporal']:goal.type==='risk'?['objects','events']:['objects']}};
}
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value))&&Number.isFinite(Date.parse(value));
function checkValue(value,field){return field.type==='string[]'?Array.isArray(value)&&value.every(v=>typeof v==='string'):field.type==='number'?typeof value==='number'&&Number.isFinite(value):field.type==='boolean'?typeof value==='boolean':field.type==='date'?validDate(value):typeof value==='string'&&value.length>0;}
export function validateIOBindings(state,goal,config,bindings){
  if(!bindings||bindings.schemaVersion!==1)throw Error('请先绑定输入资产并约定输出');
  const catalog=modelAssetCatalog(state),ports=inputPorts(goal.type,config.methodId),selected=[];
  for(const id of ports){
    const binding=bindings.inputs[id];if(id==='history'&&!binding&&config.methodId!=='history-continuation')continue;
    const port=INPUT_PORTS[id],asset=catalog.find(a=>a.ref===binding?.assetRef);
    if(!asset||asset.member!==port.member)throw Error(`${port.name}输入未绑定兼容的数据资产`);
    if(asset.version!==binding.assetVersion||asset.digest!==binding.assetDigest)throw Error(`${port.name}资产版本或指纹已变化，请重新绑定`);
    if(id!=='history'&&asset.dataKey!==config.dataKey&&asset.sourceDigest!==state.datasets[config.dataKey]?.digest)throw Error(`${port.name}输入不属于当前快照，请统一输入版本`);
    if(id==='history'&&asset.sourceDigest!==state.datasets[config.dataKey]?.digest)throw Error('历史演示资产与模型校准快照不一致');
    for(const field of port.fields){const source=asset.fields.find(f=>f.key===binding.fields[field.key]);if(!source||source.type!==field.type||source.unit!==field.unit)throw Error(`${port.name}.${field.label}的字段类型或单位不匹配`);}
    selected.push({port:id,assetRef:asset.ref,assetId:asset.id,version:asset.version,digest:asset.digest,rowCount:asset.rows.length});
  }
  const output=bindings.output,specs=outputFields(goal.type,config.methodId);
  if(!output?.datasetId?.trim()||!output.name?.trim()||output.grain!==(goal.type==='cost'&&config.methodId?'enterprise-month-run':'enterprise-run'))throw Error('请约定输出数据集名称及正确的主键粒度');
  if(!Array.isArray(output.fields)||output.fields.length!==specs.length||new Set(output.fields.map(f=>f.name)).size!==specs.length||new Set(output.fields.map(f=>f.source)).size!==specs.length)throw Error('输出字段不能缺失、重复或同名');
  for(const field of output.fields){const expected=specs.find(s=>s.key===field.source);if(!expected||field.type!==expected.type||field.unit!==expected.unit||!/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name))throw Error('输出字段名称、类型或单位不符合契约');}
  const allowed=goal.type==='cost'&&config.methodId?['temporal','objects']:goal.type==='risk'?['objects','events']:['objects'];
  if(!Array.isArray(output.destinations)||output.destinations.some(v=>!allowed.includes(v)))throw Error('请选择兼容的输出消费位置');
  return {inputs:selected,output:structuredClone(output)};
}
export function bindModelInput(state,goal,config,objectIds,bindings){
  const lineage=validateIOBindings(state,goal,config,bindings),catalog=modelAssetCatalog(state),data=state.datasets[config.dataKey];
  const readPort=id=>{const b=bindings.inputs[id];if(!b)return[];const asset=catalog.find(a=>a.ref===b.assetRef),port=INPUT_PORTS[id];return asset.rows.map(row=>Object.fromEntries(port.fields.map(field=>[field.key,row[b.fields[field.key]]])));};
  const companyRows=readPort('companies'),ids=[...new Set(objectIds)];
  if(!ids.length||ids.length!==objectIds.length||ids.some(id=>!companyRows.some(row=>row.id===id)))throw Error('模拟范围与企业输入主键不匹配');
  for(const port of ['loans','facilities','risk','history'])if(readPort(port).some(row=>!companyRows.some(c=>c.id===row.enterpriseId)))throw Error(`${INPUT_PORTS[port].name}与企业主键的关联不成立`);
  const validateRows=(rows,id)=>{for(const row of rows)for(const field of INPUT_PORTS[id].fields)if(!(row[field.key]==null&&field.nullable)&&!checkValue(row[field.key],field))throw Error(`${INPUT_PORTS[id].name}.${field.label}存在空值或类型错误`);return rows;};
  const companies=validateRows(companyRows.filter(c=>ids.includes(c.id)),'companies'),loans=validateRows(readPort('loans').filter(l=>ids.includes(l.enterpriseId)),'loans').filter(l=>l.startDate<=data.asOf&&l.maturityDate>data.asOf),facilities=validateRows(readPort('facilities').filter(f=>ids.includes(f.enterpriseId)),'facilities'),risk=validateRows(readPort('risk').filter(r=>ids.includes(r.enterpriseId)),'risk'),history=validateRows(readPort('history').filter(r=>ids.includes(r.enterpriseId)),'history');
  if(new Set(companies.map(c=>c.id)).size!==companies.length||new Set(loans.map(l=>l.id)).size!==loans.length)throw Error('输入资产的主键存在重复');
  if(goal.type==='risk'&&companies.some(c=>!risk.some(r=>r.enterpriseId===c.id)))throw Error('企业与历史评分外键未完整关联');
  if(risk.some(r=>r.score<0||r.score>100||!['绿灯','黄灯','红灯','黑灯'].includes(r.tier)))throw Error('历史评分与分档字段不符合语义约定');
  if(loans.some(l=>l.principal<0||l.rate<0||l.rate>100||!['FLOATING','FIXED'].includes(l.rateType)))throw Error('融资金额、利率或利率类型无效');
  const ledgerContracts=validateRows(readPort('ledger').filter(l=>ids.includes(l.enterpriseId)),'ledger'),peerRates=readPort('peers');
  const reference=id=>{const item=lineage.inputs.find(p=>p.port===id);if(!item)return null;const asset=catalog.find(a=>a.ref===item.assetRef);return {...item,source:asset.source,sourceSheet:asset.sourceSheet,sourceSha256:asset.sourceSha256};};
  return {input:{asOf:data.asOf,dataVersion:data.dataVersion,ontologyVersion:data.ontologyVersion,sourceDigest:data.digest,moneyUnit:'元',companies:companies.map(c=>({...c,cashYuan:c.cash*1e6,riskScore:risk.find(r=>r.enterpriseId===c.id)?.score??data.enterprises.find(e=>e.id===c.id)?.riskScore,riskTier:risk.find(r=>r.enterpriseId===c.id)?.tier??data.enterprises.find(e=>e.id===c.id)?.riskTier})),loans:loans.map(l=>({...l,principalYuan:l.principal*1e6})),facilities:facilities.map(f=>({...f,undrawnYuan:f.undrawn*1e6})),ledgerContracts,peerRates,contractAssetRef:reference('ledger'),peerAssetRef:reference('peers'),costHistory:history,historyAssetRef:reference('history')},lineage};
}
export function emitBoundOutput(output,run,bindings){
  const rows=[];
  for(const source of output.rows){const points=run.methodId?source.forecast:[null];for(const point of points){const record={};for(const field of bindings.output.fields){const key=field.source;const value=key==='runId'?run.id:key==='asOf'?point?.t||output.asOf:key==='forecast.v'?point.v:key==='forecast.balanceYuan'?point.balanceYuan:source[key];if(value===null&&!(key==='forecast.v'&&point?.balanceYuan===0)||value!==null&&!checkValue(value,{...field,key}))throw Error(`输出字段 ${field.name} 未满足声明的类型`);record[field.name]=value;}rows.push(record);}}
  const keyFields=['enterpriseId','asOf','runId'].map(key=>bindings.output.fields.find(f=>f.source===key).name),keys=rows.map(row=>JSON.stringify(keyFields.map(k=>row[k])));if(new Set(keys).size!==keys.length)throw Error('输出数据集出现重复主键');
  return {datasetId:bindings.output.datasetId,name:bindings.output.name,grain:bindings.output.grain,fields:structuredClone(bindings.output.fields),destinations:[...bindings.output.destinations],rowCount:rows.length,rows};
}
export function acceptsConsumer(version,consumer){return !version.ioBindings||version.ioBindings.output.destinations.includes(consumer);}

export function consumerOutputRows(run){
  if(!run.methodId||!run.emittedOutput)return run.output.rows;
  const mapping=Object.fromEntries(run.emittedOutput.fields.map(f=>[f.source,f.name]));
  return run.output.rows.map(row=>({...row,forecast:run.emittedOutput.rows.filter(record=>record[mapping.enterpriseId]===row.enterpriseId).map(record=>({t:record[mapping.asOf],v:record[mapping['forecast.v']],balanceYuan:record[mapping['forecast.balanceYuan']],identity:'FORECAST'}))}));
}
