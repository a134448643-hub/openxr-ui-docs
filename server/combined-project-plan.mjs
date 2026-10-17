import crypto from 'node:crypto';
import path from 'node:path';
import {planFabMoves} from './fab-classification.mjs';
import {fixedFabDirectoryName} from './fab-layout-language.mjs';

// Plan against the original package identities. Classification and translation
// share one destination; neither needs to move an asset before the model runs.
export function combinedClassificationPlan(result,root){
 const assets=result.classification?.assets;
 if(!Array.isArray(assets)||assets.length!==result.assets.filter(a=>a.assetClass!=='ObjectRedirector').length||new Set(assets.map(a=>a.path)).size!==assets.length)throw Error('一键处理缺少完整分类类型清单，请重新提取');
 const actual=new Map(result.assets.map(a=>[a.packageName,a.assetClass]));
 if(assets.some(a=>actual.get(a.path)!==a.class.split('.').pop()))throw Error('分类与翻译的资产类型清单不一致');
 return {schemaVersion:1,...planFabMoves({assets,root,language:'en',mode:'group'})};
}
export function combinedTranslationRows(fileRows,classification){
 if(!classification)return fileRows;
 const directories=new Set();
 for(const target of Object.values(classification.mapping)){let dir=path.posix.dirname(target);while(dir!=='/Game'){directories.add(dir);dir=path.posix.dirname(dir);}}
 return fileRows.filter(r=>r.kind!=='目录').concat([...directories].sort().map(owner=>{
  const original=path.posix.basename(owner),row={group:'assets',kind:'目录',field:'Name',owner,original,relative:'Content/'+owner.slice(6),coverage:'combined-directory-plan'};
  return {...row,entryKey:crypto.createHash('sha256').update('combined-directory:'+owner).digest('hex'),translated:/[\u3400-\u9fff]/u.test(original)?'':original,approved:false,native:'',fixedFabFolderName:fixedFabDirectoryName(row)};
 }));
}
