import {semanticContext} from './semantic-translation.mjs';
// A Blueprint save can change its bytes without changing any text or translation context.
export function refreshedTranslationRows({rows,previous,oldScan={},newScan={},direction}){
 const cached=new Map((previous?.entries||[]).map(r=>[r.entryKey,r]));
 const signature=(r,scan,allRows)=>JSON.stringify([r.original,r.group,r.kind,r.field,r.owner,r.valueType,r.container,r.typeObject,r.assetClass,r.assetRole,r.parentClass,r.requiredPrefix,r.graphName,r.elementName,semanticContext(r,scan.assets||[],allRows)]);
 return rows.map(row=>{const prior=cached.get(row.entryKey),reuse=prior&&signature(prior,oldScan,previous.entries)===signature(row,newScan,rows);return {...row,translated:reuse?prior.translated:direction==='zh-en'&&!/[\u3400-\u9fff]/u.test(row.original)?row.original:'',namingReason:reuse?prior.namingReason:undefined,needsSemanticReview:reuse?prior.needsSemanticReview:false,approved:false};});
}
