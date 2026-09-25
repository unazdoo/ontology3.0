const number=(key,label,value,min,max,unit,help)=>({key,label,value,min,max,unit,help});
const months=number('months','预测期',12,1,36,'月','从数据观察日开始');
export const FINANCING_MODELS=Object.freeze({
  'stock-rate':{name:'存量融资成本预测',description:'沿用原借据余额与合同重定价安排，测算指定时点的基准利率变化如何传导到加权融资成本。',boundary:'重定价首次生效日、周期和计息天数均取原台账；未来利率变化属于所选情景。到期段按等额续作测算，续作价格不构成已签合同。',parameters:[months,{key:'rateChangeDate',label:'利率变动生效日',type:'date',value:'2026-03-01',help:'利率情景的生效日；各借据仍按台账重定价日传导'},number('rateChangeBps','基准利率变动',-25,-300,500,'bp','正数上浮，负数下浮；100bp = 1个百分点'),{key:'rateIndex',label:'变动的基准利率',type:'index',value:'ALL',help:'可只调整台账中的某一基准，避免混用不同币种利率'}]},
  'refinance-ai':{name:'AI 推荐融资置换',description:'先找同评级企业在各银行的相近期限融资利率；无可比样本时，采用同币种板块加权利率，生成逐笔降本与询价建议。',boundary:'评级、期限和利率只读资产。参考利率不是银行承诺报价；费用和提前还款条件未取得时，结果为利息节省测算，行动先进入决策研判。',parameters:[months,number('tenorToleranceDays','相近期限容差',90,0,365,'天','以拟置换借据剩余期限对照可比融资原始期限'),number('minimumSavingBps','最低降息空间',5,0,500,'bp','达到此阈值才形成主动询价建议')]},
  'history-continuation':{name:'存量合同延续',description:'仅根据历史融资成本序列的水平和趋势，推演未来成本可能如何延续。',boundary:'Holt 阻尼趋势外推；不读取合同到期、续作或人为利率情景。图表汇总采用观察日余额作为固定权重，不预测融资规模。',parameters:[months,number('levelAlpha','水平平滑系数',0.5,.05,1,'','近期月度值的权重'),number('trendBeta','趋势平滑系数',.2,.01,1,'','趋势更新速度'),number('trendDamping','趋势阻尼',.85,.1,.99,'','远期趋势逐月减弱')]}
});

// Serialized into the model package. Calculations and explanations share this output.
export function financingBusinessModel(input,p,method){
  const DAY=86400000,asOf=input.asOf,start=Date.parse(asOf+'T00:00:00Z'),at=new Date(start),end=new Date(Date.UTC(at.getUTCFullYear(),at.getUTCMonth()+p.months+1,0)).toISOString().slice(0,10),days=(Date.parse(end)-start)/DAY;
  const date=n=>new Date(n).toISOString().slice(0,10),monthEnds=Array.from({length:p.months},(_,i)=>new Date(Date.UTC(at.getUTCFullYear(),at.getUTCMonth()+i+2,0)).toISOString().slice(0,10));
  const clamp=n=>Math.max(0,Math.min(100,n));
  const addMonths=(first,n)=>{const d=new Date(first+'T00:00:00Z'),y=d.getUTCFullYear(),m=d.getUTCMonth()+n;return new Date(Date.UTC(y,m,Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()))).toISOString().slice(0,10);};
  const latestReset=(loan,t)=>{if(loan.resetCycleMonths===0)return t>=loan.firstResetDate?t:null;if(!loan.firstResetDate||!Number.isInteger(loan.resetCycleMonths)||loan.resetCycleMonths<1)throw Error(loan.id+'：原台账缺少有效重定价日期或周期');if(loan.firstResetDate>t)return null;const a=new Date(loan.firstResetDate),b=new Date(t),diff=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();let i=Math.floor(diff/loan.resetCycleMonths);if(addMonths(loan.firstResetDate,i*loan.resetCycleMonths)>t)i--;return i<0?null:addMonths(loan.firstResetDate,i*loan.resetCycleMonths);};
  const contractRate=(loan,t)=>{
    const renewed=t>=loan.maturityDate,floating=loan.rateType==='FLOATING';
    let effective=floating?latestReset(loan,t):null;
    if(renewed)effective=effective&&effective>loan.maturityDate?effective:loan.maturityDate;
    const applies=(p.rateIndex==='ALL'||p.rateIndex===loan.rateIndex)&&effective&&effective>=p.rateChangeDate;
    let rate=clamp(loan.rate+(applies?p.rateChangeBps/100:0));
    if(loan.capRate>0)rate=Math.min(rate,loan.capRate);
    return {rate,pricingDate:effective,phase:renewed?'ROLLOVER_SCENARIO':floating?'CONTRACT_REPRICING':'FIXED_CONTRACT'};
  };
  if(method==='stock-rate'&&p.rateChangeDate<=asOf)throw Error('利率变动生效日须晚于输入观察日');
  const peerRate=loan=>{
    const targetTenor=(Date.parse(loan.maturityDate)-start)/DAY;
    const eligible=(input.peerRates||[]).filter(r=>r.borrower!==loan.borrower&&r.bankType==='银行'&&r.currency===loan.currency&&r.ratePeriod==='年'&&r.startDate<=asOf&&r.maturityDate>asOf&&Number.isFinite(r.rate)&&r.rate>=0&&r.rate<=100&&r.balanceYuan>0);
    const rated=loan.creditRating&&loan.ratingAgency&&loan.ratingDate&&loan.ratingDate<=asOf?eligible.filter(r=>r.creditRating===loan.creditRating&&r.ratingAgency===loan.ratingAgency&&r.ratingDate&&r.ratingDate<=asOf&&Math.abs((Date.parse(r.maturityDate)-Date.parse(r.startDate))/DAY-targetTenor)<=p.tenorToleranceDays):[];
    const weighted=rows=>rows.reduce((s,r)=>s+r.rate*r.balanceYuan,0)/rows.reduce((s,r)=>s+r.balanceYuan,0);
    let chosen,level,bankName,reason;
    if(rated.length){const banks=[...new Set(rated.map(r=>r.bankName))].map(bank=>({bank,rows:rated.filter(r=>r.bankName===bank)})).map(b=>({...b,rate:weighted(b.rows)})).sort((a,b)=>a.rate-b.rate||a.bank.localeCompare(b.bank));chosen=banks[0].rows;bankName=banks[0].bank;level='RATING_BANK_TENOR';reason='同评级、同评级机构、同币种、相近期限；按银行计算余额加权利率后选择较低者';}
    else{chosen=eligible.filter(r=>r.sector===loan.sector);level='SECTOR_FALLBACK';bankName=null;reason=loan.creditRating&&loan.ratingAgency&&loan.ratingDate?'未取得同评级相近期限样本，使用同币种板块余额加权均值':'原台账未提供完整信用评级，使用同币种板块余额加权均值';}
    if(!chosen.length)return {status:'UNAVAILABLE',reason:reason+'；板块样本也不足',sampleCount:0};
    const key=chosen.map(r=>r.id).join('|');let sampleSetId=referenceKeys.get(key);if(!sampleSetId){sampleSetId='peer-set-'+(referenceKeys.size+1);referenceKeys.set(key,sampleSetId);referenceSets[sampleSetId]={sampleIds:chosen.map(r=>r.id),sourceRows:chosen.map(r=>r.sourceRow)};}
    return {status:'AVAILABLE',sampleSetId,level,bankName,rate:weighted(chosen),reason,sampleCount:chosen.length,borrowerCount:new Set(chosen.map(r=>r.borrower)).size,currency:loan.currency,sector:loan.sector,creditRating:loan.creditRating,ratingAgency:loan.ratingAgency,targetTenorDays:targetTenor,tenorToleranceDays:p.tenorToleranceDays,sampleIds:chosen.slice(0,5).map(r=>r.id),sourceRows:chosen.slice(0,5).map(r=>r.sourceRow),dataAsOf:asOf,assetRef:input.peerAssetRef};
  };
  const referenceSets={},referenceKeys=new Map();
  const rows=input.companies.map(company=>{
    if(method==='history-continuation'){
      const history=(input.costHistory||[]).filter(r=>r.enterpriseId===company.id).sort((a,b)=>a.asOf.localeCompare(b.asOf));
      if(history.length<3||history.at(-1).asOf!==asOf)throw Error(company.name+'：至少需要3个同口径月度点，并包含观察日');
      for(let i=1;i<history.length;i++)if(addMonths(history[i-1].asOf,1).slice(0,7)!==history[i].asOf.slice(0,7))throw Error(company.name+'：历史月份有缺口，不能以补零代替');
      let level=history[0].rate,trend=history[1].rate-level;
      for(const point of history.slice(1)){const old=level;level=p.levelAlpha*point.rate+(1-p.levelAlpha)*(level+p.trendDamping*trend);trend=p.trendBeta*(level-old)+(1-p.trendBeta)*p.trendDamping*trend;}
      const last=history.at(-1),forecast=monthEnds.map((t,i)=>({t,v:clamp(level+trend*p.trendDamping*(1-Math.pow(p.trendDamping,i+1))/(1-p.trendDamping)),balanceYuan:last.balanceYuan,identity:'FORECAST'}));
      return {enterpriseId:company.id,name:company.name,balanceYuan:last.balanceYuan,baselineRate:last.rate,predictedRate:forecast.at(-1).v,history:history.map(r=>({t:r.asOf,v:r.rate,balanceYuan:r.balanceYuan,identity:r.identity})),forecast,details:[],proposals:[],conclusion:'仅历史序列外推；没有加入合同到期、续作、利率变动或融资规模预测。'};
    }
    const loans=(input.ledgerContracts||[]).filter(l=>l.enterpriseId===company.id&&l.startDate<=asOf&&l.maturityDate>asOf);
    if(!loans.length)throw Error(company.name+'：没有已绑定的原台账借据，不能用模拟借款代替重定价条款');
    for(const l of loans)if(l.ratePeriod!=='年'||!['FIXED','FLOATING'].includes(l.rateType)||![360,365].includes(l.dayCount)||l.spreadMode!=='点数')throw Error(l.id+'：当前模型未支持此利率或计息口径，请检查原台账');
    const balance=loans.reduce((s,l)=>s+l.balanceYuan,0),baselineRate=loans.reduce((s,l)=>s+l.rate*l.balanceYuan,0)/balance;
    const proposals=[],unavailable=[];
    if(method==='refinance-ai')for(const loan of loans){const basis=peerRate(loan);if(basis.status!=='AVAILABLE'){unavailable.push({loanId:loan.id,...basis});continue;}const savingBps=(loan.rate-basis.rate)*100;if(savingBps+1e-9<p.minimumSavingBps||savingBps<=0)continue;
      const dailySavingYuan=loan.balanceYuan*(loan.rate-basis.rate)/100/loan.dayCount,annualSavingYuan=dailySavingYuan*365,interestSavingYuan=dailySavingYuan*days;
      proposals.push({id:'refinance:'+loan.id,enterpriseId:company.id,companyName:company.name,loanId:loan.id,currentBank:loan.bankName,targetBank:basis.bankName,amountYuan:loan.balanceYuan,currency:loan.currency,currentRate:loan.rate,proposedRate:basis.rate,savingBps,annualSavingYuan,interestSavingYuan,feeYuan:null,netSavingYuan:null,action:'BANK_RATE_INQUIRY',actionLabel:basis.bankName?'向'+basis.bankName+'询价并核实置换条件':'取得板块内银行报价并核实置换条件',basis,contractSource:{...input.contractAssetRef,row:loan.sourceRow},status:'AI_RECOMMENDED_PENDING_REVIEW',timing:'截至日后首日起实施的比较情景；实际实施日期待审批办理确认',prerequisites:['取得有效银行报价','核实授信及可用额度','确认提前还款或到期置换条件','取得费用后复核净节省额']});
    }
    const picked=new Map(proposals.map(p=>[p.loanId,p]));
    const loanRate=(loan,t)=>method==='stock-rate'?contractRate(loan,t):{rate:picked.get(loan.id)?.proposedRate??loan.rate,pricingDate:null,phase:picked.has(loan.id)?'AI_REPLACEMENT_SCENARIO':'UNCHANGED_REFERENCE'};
    const forecast=monthEnds.map(t=>({t,v:loans.reduce((s,l)=>s+l.balanceYuan*loanRate(l,t).rate,0)/balance,balanceYuan:balance,identity:'FORECAST'}));
    const details=loans.map(loan=>{let interestYuan=0;for(let i=1;i<=days;i++)interestYuan+=loan.balanceYuan*loanRate(loan,date(start+i*DAY)).rate/100/loan.dayCount;const last=loanRate(loan,end);return {loanId:loan.id,principalYuan:loan.balanceYuan,currentRate:loan.rate,forecastRate:last.rate,interestYuan,dayCount:loan.dayCount,firstResetDate:loan.firstResetDate,resetCycle:loan.resetCycle,nextResetDate:loan.nextResetDate,pricingDate:last.pricingDate,phase:last.phase,sourceRow:loan.sourceRow};});
    const predictedInterest=details.reduce((s,l)=>s+l.interestYuan,0),baselineInterest=loans.reduce((s,l)=>s+l.balanceYuan*l.rate/100*days/l.dayCount,0);
    return {enterpriseId:company.id,name:company.name,balanceYuan:balance,baselineRate,predictedRate:forecast.at(-1).v,predictedInterest,baselineInterest,deltaInterest:predictedInterest-baselineInterest,averageBalance:balance,history:[{t:asOf,v:baselineRate,balanceYuan:balance,identity:'SNAPSHOT'}],forecast,details,proposals,proposalIds:proposals.map(p=>p.id),unavailable,conclusion:method==='stock-rate'?'重定价字段取原借据；利率变动和到期等额续作属于情景测算。':'AI按输入台账生成询价建议；展示利息空间，费用未知，净收益尚不能确定。'};
  });
  return {kind:'COST_FORECAST',asOf,horizonEnd:end,methodId:method,nature:method==='history-continuation'?'HISTORY_ONLY':method==='refinance-ai'?'AI_RECOMMENDATION_SCENARIO':'CONTRACT_RATE_SCENARIO',rows,referenceSets,contractAssetRef:input.contractAssetRef||null,peerAssetRef:input.peerAssetRef||null,historyAssetRef:input.historyAssetRef||null};
}

export function validateFinancingForecast(output,input,p,method=output.methodId){
  if(!FINANCING_MODELS[method]||output.methodId!==method||output.kind!=='COST_FORECAST'||output.asOf!==input.asOf)throw Error('融资模型与输入身份不一致');
  const d=new Date(input.asOf+'T00:00:00Z'),dates=Array.from({length:p.months},(_,i)=>new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+i+2,0)).toISOString().slice(0,10));
  if(output.horizonEnd!==dates.at(-1)||JSON.stringify(output.rows.map(r=>r.enterpriseId).sort())!==JSON.stringify(input.companies.map(c=>c.id).sort()))throw Error('融资模型的企业范围或窗口不一致');
  const peersById=new Map((input.peerRates||[]).map(row=>[row.id,row]));
  for(const row of output.rows){
    if(!Number.isFinite(row.balanceYuan)||row.balanceYuan<=0||!Number.isFinite(row.baselineRate)||!Number.isFinite(row.predictedRate))throw Error('融资结果缺少有效本金与成本基准');
    if(JSON.stringify(row.forecast.map(p=>p.t))!==JSON.stringify(dates)||row.forecast.some(p=>!Number.isFinite(p.v)||p.v<0||p.v>100||p.identity!=='FORECAST'||p.balanceYuan!==row.balanceYuan))throw Error('月度预测值、日期或本金权重无效');
    if(method==='history-continuation'){
      const history=input.costHistory.filter(r=>r.enterpriseId===row.enterpriseId).sort((a,b)=>a.asOf.localeCompare(b.asOf));
      if(JSON.stringify(row.history)!==JSON.stringify(history.map(r=>({t:r.asOf,v:r.rate,balanceYuan:r.balanceYuan,identity:r.identity})))||row.balanceYuan!==history.at(-1).balanceYuan||row.baselineRate!==history.at(-1).rate)throw Error('历史趋势不能改写输入历史或基准');
    }else{
      const loans=input.ledgerContracts.filter(l=>l.enterpriseId===row.enterpriseId&&l.startDate<=input.asOf&&l.maturityDate>input.asOf),total=loans.reduce((s,l)=>s+l.balanceYuan,0),rate=loans.reduce((s,l)=>s+l.balanceYuan*l.rate,0)/total;
      if(Math.abs(total-row.balanceYuan)>.01||Math.abs(rate-row.baselineRate)>1e-8||row.history.length!==1||row.history[0].identity!=='SNAPSHOT'||row.history[0].t!==input.asOf)throw Error('原融资台账基准不能改写');
      const days=(Date.parse(output.horizonEnd)-Date.parse(input.asOf))/86400000,baseline=loans.reduce((s,l)=>s+l.balanceYuan*l.rate/100*days/l.dayCount,0);
      if(!Number.isFinite(row.predictedInterest)||row.predictedInterest<0||Math.abs(row.baselineInterest-baseline)>.01||Math.abs(row.predictedInterest-row.baselineInterest-row.deltaInterest)>.01||Math.abs(row.details.reduce((s,l)=>s+l.interestYuan,0)-row.predictedInterest)>.01||JSON.stringify(row.details.map(l=>l.loanId).sort())!==JSON.stringify(loans.map(l=>l.id).sort()))throw Error('预测利息与原借据计息口径不一致');
      if(row.proposals.some(proposal=>!loans.some(l=>l.id===proposal.loanId)||!proposal.basis.sampleIds.length||proposal.savingBps<=0||proposal.feeYuan!==null||proposal.netSavingYuan!==null))throw Error('置换建议缺少原借据或利率依据，或混入未取得的费用');
      if(method==='refinance-ai'){
        if(new Set(row.proposals.map(p=>p.loanId)).size!==row.proposals.length)throw Error('同一借据不能在同一方案重复置换');
        for(const proposal of row.proposals){
          const loan=loans.find(l=>l.id===proposal.loanId),basis=proposal.basis,set=output.referenceSets?.[basis.sampleSetId];
          const samples=set?.sampleIds.map(id=>peersById.get(id));
          if(!samples?.length||samples.some(r=>!r||r.borrower===loan.borrower||r.bankType!=='银行'||r.currency!==loan.currency||r.ratePeriod!=='年'||r.startDate>input.asOf||r.maturityDate<=input.asOf||!(r.balanceYuan>0)||!Number.isFinite(r.rate))||new Set(set.sampleIds).size!==samples.length)throw Error('置换参考样本不满足来源、币种或存续口径');
          if(basis.level==='RATING_BANK_TENOR'&&samples.some(r=>!loan.creditRating||!loan.ratingAgency||!loan.ratingDate||r.creditRating!==loan.creditRating||r.ratingAgency!==loan.ratingAgency||!r.ratingDate||r.ratingDate>input.asOf||loan.ratingDate>input.asOf||r.bankName!==proposal.targetBank||Math.abs((Date.parse(r.maturityDate)-Date.parse(r.startDate)-Date.parse(loan.maturityDate)+Date.parse(input.asOf))/86400000)>p.tenorToleranceDays))throw Error('同评级银行相近期限的证据不成立');
          if(basis.level==='SECTOR_FALLBACK'&&(proposal.targetBank!==null||samples.some(r=>r.sector!==loan.sector)))throw Error('板块兜底样本口径不一致');
          if(!['SECTOR_FALLBACK','RATING_BANK_TENOR'].includes(basis.level))throw Error('置换匹配层级无效');
          const rate=samples.reduce((s,r)=>s+r.rate*r.balanceYuan,0)/samples.reduce((s,r)=>s+r.balanceYuan,0),saving=loan.balanceYuan*(loan.rate-rate)/100*days/loan.dayCount;
          if(proposal.amountYuan!==loan.balanceYuan||proposal.currentRate!==loan.rate||Math.abs(proposal.proposedRate-rate)>1e-8||Math.abs(proposal.interestSavingYuan-saving)>.01||basis.sampleCount!==samples.length||proposal.enterpriseId!==row.enterpriseId||proposal.action!=='BANK_RATE_INQUIRY')throw Error('置换方案金额、利率或行动与样本证据不一致');
        }
      }
    }
  }
  return [{label:'固定对象、观察日及预测窗口',passed:true},{label:method==='history-continuation'?'仅历史输入与固定汇总权重':'原台账重定价、计息口径及逐笔来源',passed:true},{label:'月度输出及结果身份',passed:true}];
}
