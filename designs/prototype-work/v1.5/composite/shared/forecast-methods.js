const parameter=(key,label,value,min,max,unit,help)=>({key,label,value,min,max,unit,help});
export const FORECAST_COMMON_PARAMETERS=[parameter('extensionDays','展期天数',0,0,365,'天','作为未来安排假设，原合同到期日保留')];
export const FORECAST_METHODS=Object.freeze({
  cashflow:{name:'合同现金流预测',description:'按借款到期、浮息变化及续作安排逐日计算，再形成月末成本曲线。',boundary:'固定利率在原合同到期前保持不变；续作和浮息变化是情景假设。',parameters:[]},
  reversion:{name:'均值回归情景',description:'浮息与续作利率逐步向企业所属板块的参考利率收敛，保留固定利率合同。',boundary:'收敛速度由用户设定，未用真实历史数据估计市场利率。',parameters:[parameter('reversionSpeed','每月收敛速度',0.15,0.01,1.5,'','越大越快靠近板块参考利率')]},
  damped:{name:'Holt 阻尼趋势',description:'对绑定的月度历史做水平和趋势平滑，以衰减趋势形成浮息及续作情景。',boundary:'至少3个非空月度点；当前绑定模拟历史，无历史绑定时使用合同回溯，均不代表已验证的市场预测。',parameters:[parameter('levelAlpha','水平平滑系数',0.5,0.05,1,'','较大时更关注近期月度值'),parameter('trendBeta','趋势平滑系数',0.2,0.01,1,'','控制趋势更新速度'),parameter('trendDamping','趋势阻尼',0.85,0.1,0.99,'','远期趋势逐月减弱')]}
});

// This function is serialized into the editable, frozen model code. No chart-side forecast formula exists.
export function financingForecast(input,p,method) {
  const DAY=86400000,start=new Date(input.asOf+'T00:00:00Z'),end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+p.months+1,0)),days=Math.round((end-start)/DAY),date=d=>d.toISOString().slice(0,10);
  const dates=Array.from({length:12},(_,i)=>i===11?input.asOf:date(new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()-10+i,0))));
  const future=Array.from({length:p.months},(_,i)=>date(new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i+2,0))));
  const rows=input.companies.map(company=>{
    const loans=input.loans.filter(l=>l.enterpriseId===company.id),balance=loans.reduce((a,l)=>a+l.principalYuan,0),baselineRate=balance?loans.reduce((a,l)=>a+l.principalYuan*l.rate,0)/balance:0;
    const boundHistory=(input.costHistory||[]).filter(r=>r.enterpriseId===company.id).sort((a,b)=>a.asOf.localeCompare(b.asOf));
    const history=boundHistory.length?boundHistory.map(r=>({t:r.asOf,v:r.rate,balanceYuan:r.balanceYuan,identity:r.identity})):dates.map(t=>{const active=loans.filter(l=>l.startDate<=t&&l.maturityDate>t),amount=active.reduce((s,l)=>s+l.principalYuan,0);return {t,v:amount?active.reduce((s,l)=>s+l.principalYuan*l.rate,0)/amount:null,balanceYuan:amount,identity:t===input.asOf?'SNAPSHOT':'CONTRACT_BACKCAST'};});
    const samples=history.filter(x=>x.v!==null);let trend=0;
    if(method==='damped') {
      if(samples.length<3)throw Error(company.name+'：历史序列不足3个非空月，不能使用阻尼趋势；可改用合同现金流预测');
      let level=samples[0].v;trend=samples[1].v-samples[0].v;
      for(const point of samples.slice(1)){const old=level;level=p.levelAlpha*point.v+(1-p.levelAlpha)*(level+trend);trend=p.trendBeta*(level-old)+(1-p.trendBeta)*trend;}
    }
    const loanState=(loan,t)=>{
      const maturity=new Date(Date.parse(loan.maturityDate+'T00:00:00Z')+(p.extensionDays||0)*DAY).toISOString().slice(0,10),renewed=t>=maturity,principal=loan.principalYuan*(renewed?p.rolloverPct/100:1),months=Math.max(0,(Date.parse(t)-start)/DAY/30.4375);
      let curve=baselineRate;
      if(method==='reversion')curve+=(company.benchmarkRate-baselineRate)*(1-Math.exp(-p.reversionSpeed*months));
      if(method==='damped')curve+=trend*p.trendDamping*(1-Math.pow(p.trendDamping,months))/(1-p.trendDamping);
      const floating=loan.rateType==='FLOATING',rate=Math.max(0,Math.min(100,loan.rate+((floating||renewed)?curve-baselineRate:0)+(floating?p.rateShockBps/100:0)+(renewed?p.refinanceSpreadBps/100:0)));
      return {principal,rate};
    };
    const forecast=future.map(t=>{const states=loans.map(l=>loanState(l,t)),amount=states.reduce((s,l)=>s+l.principal,0);return {t,v:amount?states.reduce((s,l)=>s+l.principal*l.rate,0)/amount:null,balanceYuan:amount,identity:'FORECAST'};});
    let exposure=0,predictedInterest=0;
    const details=loans.map(loan=>{let interest=0,ownExposure=0;for(let day=0;day<days;day++){const state=loanState(loan,date(new Date(start.valueOf()+day*DAY)));ownExposure+=state.principal/365;interest+=state.principal*state.rate/100/365;}exposure+=ownExposure;predictedInterest+=interest;return {loanId:loan.id,principalYuan:loan.principalYuan,currentRate:loan.rate,forecastRate:ownExposure?interest/ownExposure*100:0,interestYuan:interest};});
    const baselineInterest=balance*baselineRate/100*days/365;
    return {enterpriseId:company.id,name:company.name,balanceYuan:balance,baselineRate,predictedRate:exposure?predictedInterest/exposure*100:0,baselineInterest,predictedInterest,deltaInterest:predictedInterest-baselineInterest,averageBalance:exposure*365/days,details,history,forecast,conclusion:'历史沿用绑定资产的数据身份；未来为'+method+'情景。模拟历史、既有快照与未来预测分开记录。'};
  });
  return {kind:'COST_FORECAST',asOf:input.asOf,horizonEnd:date(end),methodId:method,seriesIdentity:input.historyAssetRef?'SIMULATED_HISTORY_AND_FORECAST':'CONTRACT_BACKCAST_AND_FORECAST',rows};
}
export function forecastCode(methodId) {
  if(!FORECAST_METHODS[methodId])throw Error('未知融资成本预测方法');
  return `// ${FORECAST_METHODS[methodId].name}\n// ${FORECAST_METHODS[methodId].boundary}\n// SIMULATED_HISTORY、CONTRACT_BACKCAST、SNAPSHOT 与 FORECAST 分别标识。\nreturn (${financingForecast.toString()})(input, parameters, ${JSON.stringify(methodId)});`;
}
export function forecastParameterDefaults(methodId) {return Object.fromEntries([...FORECAST_COMMON_PARAMETERS,...(FORECAST_METHODS[methodId]?.parameters||[])].map(p=>[p.key,p.value]));}
export function validateForecastOutput(output,input,p) {
  const start=new Date(input.asOf+'T00:00:00Z'),historyDates=Array.from({length:12},(_,i)=>i===11?input.asOf:new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()-10+i,0)).toISOString().slice(0,10));
  const expected=Array.from({length:p.months},(_,i)=>{const d=new Date(input.asOf+'T00:00:00Z');return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+i+2,0)).toISOString().slice(0,10);});
  for(const row of output.rows) {
    if(!Array.isArray(row.forecast)||JSON.stringify(row.forecast.map(x=>x.t))!==JSON.stringify(expected))throw Error('预测曲线的月份与窗口不一致');
    const supplied=(input.costHistory||[]).filter(p=>p.enterpriseId===row.enterpriseId).sort((a,b)=>a.asOf.localeCompare(b.asOf));
    if(!Array.isArray(row.history)||JSON.stringify(row.history.map(p=>p.t))!==JSON.stringify(supplied.length?supplied.map(p=>p.asOf):historyDates))throw Error('合同回溯与观察时点不一致');
    for(const point of [...row.history,...row.forecast])if(!Number.isFinite(point.balanceYuan)||point.balanceYuan<0||(point.identity==='FORECAST'&&point.balanceYuan>row.balanceYuan+.01)||(point.balanceYuan===0?point.v!==null:!Number.isFinite(point.v)||point.v<0||point.v>100))throw Error('时序成本值与本金口径无效');
    if(row.history.some(x=>x.identity!==(x.t===input.asOf?'SNAPSHOT':supplied.length?'SIMULATED_HISTORY':'CONTRACT_BACKCAST'))||row.forecast.some(x=>x.identity!=='FORECAST'))throw Error('实际观测、回溯估算与预测身份不可混淆');
    if(supplied.length&&row.history.some((point,index)=>point.v!==supplied[index].rate||point.balanceYuan!==supplied[index].balanceYuan))throw Error('模型不能改写绑定的历史输入');
    if(Math.abs(row.history.at(-1).v-row.baselineRate)>1e-8)throw Error('预测不能修改快照基准成本');
  }
}

export function aggregateCostSeries(rows,ids) {
  const selected=rows.filter(row=>ids.includes(row.enterpriseId));
  const aggregate=key=>{
    const dates=[...new Set(selected.flatMap(r=>(r[key]||[]).map(x=>x.t)))].sort();
    return dates.map(t=>{const points=selected.map(r=>(r[key]||[]).find(x=>x.t===t)).filter(Boolean),balance=points.reduce((s,x)=>s+x.balanceYuan,0);return {t,v:balance?points.reduce((s,x)=>s+(x.v??0)*x.balanceYuan,0)/balance:null,balanceYuan:balance,identity:points[0]?.identity,coverage:points.length,total:selected.length};});
  };
  return {history:aggregate('history'),forecast:aggregate('forecast')};
}
