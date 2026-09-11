export const EXPLORATION_MODES = [
  ['risk', '历史债务风险'], ['cost', '融资成本'], ['maturity', '到期与资金压力'], ['exposure', '银行借款敞口']
];
export function viewSignal(row, mode, data) {
  if (mode === 'cost') return { tone: row.premium > 25 ? 'red' : row.premium > 0 ? 'amber' : 'green', rank: row.premium > 25 ? 3 : row.premium > 0 ? 2 : 1, label: row.premium > 25 ? '高于基准25bp' : row.premium > 0 ? '高于产业基准' : '不高于产业基准', value: row.cost, unit: '%', metric: '融资成本', secondary: row.premium, secondaryUnit: 'bp', secondaryLabel: '基准偏离', sortValue: row.premium };
  if (mode === 'maturity') return { tone: row.gap > 0 ? 'red' : row.due > 0 ? 'amber' : 'green', rank: row.gap > 0 ? 3 : row.due > 0 ? 2 : 1, label: row.gap > 0 ? '测算存在缺口' : row.due > 0 ? '到期资金可覆盖' : '窗口内无到期', value: row.due / 100, unit: '亿元', metric: '窗口到期', secondary: row.gap / 100, secondaryUnit: '亿元', secondaryLabel: '测算缺口', sortValue: row.gap * 1e5 + row.due };
  if (mode === 'exposure') {
    const amounts = new Map();
    for (const loan of data.loans.filter(loan => row.loanIds.includes(loan.id))) amounts.set(loan.bankId, (amounts.get(loan.bankId) || 0) + loan.principal);
    const first = [...amounts].sort((a,b)=>b[1]-a[1])[0];
    return { tone: 'blue', rank: 1, label: first ? data.banks.find(bank=>bank.id===first[0])?.name || first[0] : '银行敞口', value: (first?.[1] || 0) / 100, unit: '亿元', metric: '最大银行敞口', secondary: row.balance ? (first?.[1] || 0) / row.balance * 100 : 0, secondaryUnit: '%', secondaryLabel: '本金占比', sortValue: first?.[1] || 0 };
  }
  const tone = ({ 绿灯:'green', 黄灯:'amber', 红灯:'red', 黑灯:'black' })[row.riskTier];
  return { tone, rank: ({green:1,amber:2,red:3,black:4})[tone], label: row.riskTier, value: row.riskScore, unit: '分', metric: '历史评分', secondary: row.balance / 100, secondaryUnit: '亿元', secondaryLabel: '融资余额', sortValue: -row.riskScore };
}
export function orderForView(rows, mode, data, level = '') {
  return rows.map(row=>({...row,viewSignal:viewSignal(row,mode,data)})).filter(row=>!level||row.viewSignal.tone===level).sort((a,b)=>b.viewSignal.rank-a.viewSignal.rank||b.viewSignal.sortValue-a.viewSignal.sortValue||a.name.localeCompare(b.name,'zh-CN'));
}
export const signalColor = tone => ({green:'#338575',amber:'#cf9c35',red:'#ce6153',black:'#3c4147',blue:'#477eae'})[tone] || '#74899b';

export function greatCirclePoint(start, end, t) {
  const radians = value=>value*Math.PI/180;
  const cartesian = ([lon,lat])=>[Math.cos(radians(lat))*Math.cos(radians(lon)),Math.cos(radians(lat))*Math.sin(radians(lon)),Math.sin(radians(lat))];
  const a=cartesian(start),b=cartesian(end),dot=Math.max(-1,Math.min(1,a.reduce((sum,value,i)=>sum+value*b[i],0))),angle=Math.acos(dot);
  if(angle<1e-8)return [...start];
  let vector;
  if(Math.PI-angle<1e-6){const axis=Math.abs(a[2])<.9?[0,0,1]:[0,1,0],projection=a.reduce((sum,value,i)=>sum+value*axis[i],0),normal=axis.map((value,i)=>value-projection*a[i]),length=Math.hypot(...normal);vector=a.map((value,i)=>value*Math.cos(Math.PI*t)+normal[i]/length*Math.sin(Math.PI*t));}
  else vector=a.map((value,i)=>(Math.sin((1-t)*angle)*value+Math.sin(t*angle)*b[i])/Math.sin(angle));
  return [Math.atan2(vector[1],vector[0])*180/Math.PI,Math.atan2(vector[2],Math.hypot(vector[0],vector[1]))*180/Math.PI];
}
export function greatCircleGeometry(start,end,steps=64) {
  const points=Array.from({length:steps+1},(_,index)=>greatCirclePoint(start,end,index/steps));
  const segments=[[]];
  for(const point of points){const segment=segments.at(-1),previous=segment.at(-1);if(previous&&Math.abs(point[0]-previous[0])>180){const side=previous[0]>0?180:-180,unwrapped=point[0]+(side>0?360:-360),ratio=(side-previous[0])/(unwrapped-previous[0]),latitude=previous[1]+ratio*(point[1]-previous[1]);segment.push([side,latitude]);segments.push([[-side,latitude]]);}segments.at(-1).push(point);}
  return segments.length===1?{type:'LineString',coordinates:segments[0]}:{type:'MultiLineString',coordinates:segments};
}
