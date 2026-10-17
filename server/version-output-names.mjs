import fs from 'node:fs/promises';import path from 'node:path';
export function versionOutputStem(name,version){
 if(!/^5\.[1-8]$/.test(String(version)))throw Error('目标引擎版本无效');
 // Older outputs used both _UE5.3 and OpenXR_UI5.3_EN. Replace the
 // existing version token even when a language/custom suffix follows it.
 const tokens=[...name.matchAll(/(?<!\d)(?:_?UE)?5([._])\d+(?:\.\d+)?(?=$|_)/gi)],token=tokens.at(-1);
 if(!token)return name+'_UE'+version;
 const prefix=token[0].match(/^_?UE/i)?.[0]||'',tail=name.slice(token.index+token[0].length);
 return name.slice(0,token.index)+prefix+version.replaceAll('.',token[1])+(/^_\d+$/.test(tail)?'':tail);
}
export async function unusedVersionTarget({source,outputRoot,name,version,destination,reserved=new Set()}){
 if(!path.isAbsolute(outputRoot||'')||typeof name!=='string'||!name||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[. ]$/.test(name)||name==='.'||name==='..')throw Error('请选择完整输出路径，并使用有效项目名称');
 // Keep the source naming style while replacing an existing trailing UE version.
 const stem=versionOutputStem(name,version);
 for(let i=1;i<=10000;i++){const candidate=stem+(i===1?'':'_'+i),target=path.resolve(outputRoot,candidate);if(reserved.has(target.toLowerCase()))continue;try{await fs.lstat(target);continue;}catch(e){if(e.code!=='ENOENT')throw e;}try{const checked=await destination(source,outputRoot,candidate,{nativeFolder:true});reserved.add(checked.toLowerCase());return checked;}catch(e){try{await fs.lstat(target);continue;}catch(check){if(check.code!=='ENOENT')throw check;}throw e;}}
 throw Error('该位置的版本副本过多，请选择其他目录');
}
