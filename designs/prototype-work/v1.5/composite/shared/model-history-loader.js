let pending;
export async function loadFinanceHistory(studio){
  pending ||= fetch('/data/finance-history-demo.json').then(response=>{if(!response.ok)throw Error('演示历史资产读取失败');return response.json();}).catch(error=>{pending=null;throw error;});
  const asset=await pending;await studio.registerBindingAsset(asset);return asset;
}
