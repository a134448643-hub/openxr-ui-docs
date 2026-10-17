const identity=assets=>JSON.stringify(assets.map(a=>[a.path,a.class]).sort((a,b)=>a[0].localeCompare(b[0])));
function validAssets(assets){return Array.isArray(assets)&&new Set(assets.map(a=>a.path)).size===assets.length&&assets.every(a=>typeof a.path==='string'&&a.path.startsWith('/Game/')&&typeof a.class==='string'&&Array.isArray(a.dependencies)&&a.dependencies.every(d=>typeof d==='string'&&d.startsWith('/Game/')));}
export function assertClassificationBaseline(scan){
 const b=scan?.dependencyBaseline;
 if(!validAssets(scan?.assets)||b?.schemaVersion!==1||b.method!=='saved-and-reopened-preview'||b.assetCount!==scan.assets.length||b.savedAssets!==scan.assets.length)throw Error('分类引用基线缺少预览副本保存及重新加载验证，未执行分类；请重新预览');
}
export function classificationDependencyBaseline(prepared,reopened){
 if(!validAssets(prepared?.assets)||!validAssets(reopened?.assets)||prepared.normalization?.schemaVersion!==1||prepared.normalization.completed!==true||prepared.normalization.savedAssets!==prepared.assets.length)throw Error('临时预览副本未完整保存，未生成分类引用基线');
 if(identity(prepared.assets)!==identity(reopened.assets))throw Error('预览副本保存前后资源清单或真实类型发生变化，未生成分类方案');
 const current=new Map(reopened.assets.map(a=>[a.path,new Set(a.dependencies)])),pruned=[];
 for(const asset of prepared.assets)for(const dependency of asset.dependencies)if(!current.get(asset.path).has(dependency))pruned.push({asset:asset.path,dependency});
 const scan={...reopened,dependencyBaseline:{schemaVersion:1,method:'saved-and-reopened-preview',assetCount:reopened.assets.length,savedAssets:prepared.normalization.savedAssets,prunedCachedEdges:pruned.length},dependencyNormalization:{prunedCachedEdges:pruned}};
 assertClassificationBaseline(scan);return scan;
}
