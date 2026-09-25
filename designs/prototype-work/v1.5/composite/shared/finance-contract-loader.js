let pending;
export async function loadFinanceContracts(studio){
  pending ||= fetch('/data/finance-contract-assets.json').then(r=>{if(!r.ok)throw Error('融资台账资产读取失败');return r.json();}).catch(e=>{pending=null;throw e;});
  const {assets}=await pending;
  for(const asset of assets)await studio.registerBindingAsset(asset);
  return assets;
}
