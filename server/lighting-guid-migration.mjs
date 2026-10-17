import crypto from 'node:crypto';
export const lightingHash=b=>crypto.createHash('sha256').update(b).digest('hex');
const guidBytes=id=>{if(!/^[A-F0-9]{32}$/.test(id)||/^0+$/.test(id))throw Error('光照关联标识无效');const b=Buffer.alloc(16);for(let i=0;i<4;i++)b.writeUInt32LE(parseInt(id.slice(i*8,i*8+8),16),i*4);return b;};

// Only patch identifiers proven by the running target engine, within the exact
// native registry export. Texture exports and all other package bytes stay intact.
export function planLightingGuidMigration(report,registry,source){
 if(report.commandlet!==false||!Number.isInteger(report.unbuiltInteractions))throw Error('需要真实编辑器的光照诊断结果');
 const span=report.registryExports?.find(e=>e.path===registry);
 if(!span||!Number.isSafeInteger(span.offset)||!Number.isSafeInteger(span.size)||span.offset<1||span.size<1||span.offset+span.size>source.length)throw Error('无法确认光照注册表的完整序列化范围');
 const pairs=new Map();
 function add(item,owner,kind){
  if(!item.oldHasBuildData||item.old===item.current||item.currentHasBuildData)return;
  guidBytes(item.old);guidBytes(item.current);
  if(pairs.has(item.old)&&(pairs.get(item.old).current!==item.current||pairs.get(item.old).kind!==kind))throw Error('旧光照标识存在多个目标，不能自动迁移');
  pairs.set(item.old,{old:item.old,current:item.current,owner,kind});
 }
 for(const light of report.lights||[])if(light.registry===registry)add(light,light.path,'light');
 for(const mesh of report.meshes||[])if(mesh.registry===registry)for(const lod of mesh.lods||[])add(lod,mesh.path,'mesh');
 if(new Set([...pairs.values()].map(p=>p.current)).size!==pairs.size)throw Error('目标光照标识冲突');
 const output=Buffer.from(source),ranges=[],changes=[];
 for(const pair of pairs.values()){
  const old=guidBytes(pair.old),current=guidBytes(pair.current),offsets=[];
  if(source.indexOf(current)!==-1)throw Error('目标光照标识已存在，保留当前数据');
  for(let at=source.indexOf(old);at!==-1;at=source.indexOf(old,at+1)){
   if(at<span.offset||at+16>span.offset+span.size)throw Error('关联标识出现在注册表之外，拒绝修改贴图或其他资源');
   if(ranges.some(([a,z])=>at<z&&at+16>a))throw Error('光照标识替换范围重叠');
   offsets.push(at);ranges.push([at,at+16]);current.copy(output,at);
  }
  if(!offsets.length||(pair.kind==='mesh'&&offsets.length!==1))throw Error('光照标识出现次数异常');
  changes.push({...pair,offsets});
 }
 const sorted=ranges.sort((a,b)=>a[0]-b[0]);let end=0;
 for(const [a,z]of sorted){if(!source.subarray(end,a).equals(output.subarray(end,a)))throw Error('检测到额外资源修改');end=z;}
 if(!source.subarray(end).equals(output.subarray(end)))throw Error('检测到额外资源修改');
 return {output,plan:{registry,registryExport:span,changes,oldSha256:lightingHash(source),newSha256:lightingHash(output),bytes:source.length,changedGuidOccurrences:ranges.length,textureExportsByteIdentical:true,rebaked:false}};
}

export function verifyLightingMigration(report,plan){
 if(report.commandlet!==false||report.unbuiltInteractions!==0)throw Error('候选关卡仍有未构建光照，未通过验证');
 for(const change of plan.changes){
  const items=change.kind==='light'?(report.lights||[]).filter(l=>l.registry===plan.registry&&l.path===change.owner):(report.meshes||[]).filter(m=>m.registry===plan.registry&&m.path===change.owner).flatMap(m=>m.lods||[]);
  if(!items.some(i=>i.current===change.current&&i.currentHasBuildData))throw Error('目标引擎未识别迁移后的光照数据');
 }
}
