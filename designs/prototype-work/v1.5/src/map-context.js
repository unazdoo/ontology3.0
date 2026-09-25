export function mapContext(data,rows,{selectedId=null,selectedBankId=null,relationships=false,relationTypes=['financing']}={}) {
  const loans=data.loans.filter(l=>l.startDate<=data.asOf&&l.maturityDate>data.asOf),facilities=data.facilities.filter(f=>f.validUntil>=data.asOf),guarantees=data.guarantees.filter(g=>g.validUntil>=data.asOf);
  const financing=relationTypes.includes('financing'),creditEnabled=relationTypes.includes('credit'),guaranteeEnabled=relationTypes.includes('guarantee');
  const roots=new Set(selectedBankId?[...(financing?loans:[]).filter(l=>l.bankId===selectedBankId).map(l=>l.enterpriseId),...(creditEnabled?facilities:[]).filter(f=>f.bankId===selectedBankId).map(f=>f.enterpriseId)]:selectedId?[selectedId]:[]);
  const focus=new Set(roots),edges=[],bankIds=new Set();
  const scope=relationships?new Set(data.enterprises.map(e=>e.id)):roots;
  if(relationships)for(const id of scope)focus.add(id);
  const relatedGuarantees=guarantees.filter(g=>relationships||scope.has(g.guarantorId)||scope.has(g.beneficiaryId));
  if(guaranteeEnabled&&(scope.size||relationships))for(const g of relatedGuarantees){focus.add(g.guarantorId);focus.add(g.beneficiaryId);edges.push({id:g.id,from:g.guarantorId,to:g.beneficiaryId,kind:'担保',amount:g.amount,evidenceRefs:g.evidenceRefs});}
  for(const company of data.enterprises.filter(c=>scope.has(c.id))) {
    const banks=new Set([...(financing?loans:[]).filter(l=>l.enterpriseId===company.id).map(l=>l.bankId),...(creditEnabled?facilities:[]).filter(f=>f.enterpriseId===company.id).map(f=>f.bankId)]);
    for(const bankId of banks){const own=(financing?loans:[]).filter(l=>l.enterpriseId===company.id&&l.bankId===bankId),credit=(creditEnabled?facilities:[]).filter(f=>f.enterpriseId===company.id&&f.bankId===bankId);bankIds.add(bankId);edges.push({id:company.id+':'+bankId,from:company.id,to:bankId,kind:own.length&&credit.length?'借款与授信':own.length?'借款':'授信',amount:own.reduce((s,l)=>s+l.principal,0),credit:credit.reduce((s,f)=>s+f.undrawn,0),evidenceRefs:[...own.map(l=>l.id),...credit.map(f=>f.id)]});}
  }
  if(relationships&&(financing||creditEnabled))for(const b of data.banks)bankIds.add(b.id);
  if(selectedBankId)bankIds.add(selectedBankId);
  const byId=new Map([...data.enterprises,...data.banks].map(e=>[e.id,e]));
  return {focusIds:[...focus],rootIds:[...roots],focused:!relationships&&Boolean(selectedId||selectedBankId),enterprises:data.enterprises.filter(e=>focus.has(e.id)).map(e=>({...e,contextOnly:!rows.some(r=>r.id===e.id)})),banks:data.banks.filter(b=>bankIds.has(b.id)),edges:edges.filter(e=>byId.has(e.from)&&byId.has(e.to)).map(e=>({...e,fromCoordinates:byId.get(e.from).coordinates,toCoordinates:byId.get(e.to).coordinates}))};
}
