import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createReadStream} from 'node:fs';
const exists=async file=>{try{await fs.lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
// Only reuse the exact bridge shipped by this platform. A same-named user
// plugin, changed file, or extra plugin must never be overwritten or deleted.
export async function inspectDeliveryPlugins(projectRoot,{resourceRoot,bridgeOnly=false}={}){
 const plugins=path.join(projectRoot,'Plugins');if(!await exists(plugins))return {reuseBridge:false};
 const actual=await fs.realpath(plugins);if(actual.toLowerCase()!==path.resolve(plugins).toLowerCase())throw Error('Plugins目录路径校验失败');
 const entries=await fs.readdir(plugins,{withFileTypes:true});if(!entries.length)return {reuseBridge:false};
 const other=entries.filter(e=>e.name!=='DeliveryTranslationBridge'||!e.isDirectory()||e.isSymbolicLink());
 if(!bridgeOnly&&other.length)throw Error('副本含项目插件：'+other.map(e=>e.name).join('、')+'；不能自动删除项目依赖，未请求模型或写入工程');
 const candidate=entries.find(e=>e.name==='DeliveryTranslationBridge');if(!candidate)return {reuseBridge:false};if(!candidate.isDirectory()||candidate.isSymbolicLink())throw Error('临时翻译插件路径无效，未覆盖或删除');
 if(!resourceRoot)throw Error('缺少临时翻译插件校验资源，未清理工程');
 const fingerprint=async root=>{const files=[];async function walk(dir,prefix=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name),relative=prefix+e.name;if(e.isSymbolicLink())throw Error('临时翻译插件含链接，未覆盖或删除：'+relative);if(e.isDirectory())await walk(file,relative+'/');else if(e.isFile()&&!/\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(e.name)){const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);files.push([relative,hash.digest('hex')]);}else if(!e.isFile())throw Error('临时翻译插件含异常文件：'+relative);}}await walk(root);return JSON.stringify(files.sort((a,b)=>a[0].localeCompare(b[0])));};
 const reference=path.join(resourceRoot,'DeliveryTranslationBridge'),bridge=path.join(plugins,'DeliveryTranslationBridge');
 const actualFingerprint=await fingerprint(bridge);
 if(actualFingerprint!==await fingerprint(reference)){
  const legacy=JSON.parse(await fs.readFile(path.join(resourceRoot,'bridge-legacy-fingerprints.json'),'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
  if(legacy.fingerprints?.includes(actualFingerprint))return {reuseBridge:false,upgradeBridge:true};
  throw Error('副本中的 DeliveryTranslationBridge 与平台组件不一致，未覆盖或删除；请检查该插件的来源');
 }
 return {reuseBridge:true};
}
export async function installDeliveryBridge(projectRoot,{resourceRoot,bridgeOnly=false}={}){
 const checked=await inspectDeliveryPlugins(projectRoot,{resourceRoot,bridgeOnly});
 if(checked.reuseBridge)return {installed:false,reused:true};
 const target=path.join(projectRoot,'Plugins/DeliveryTranslationBridge');
 await fs.mkdir(path.dirname(target),{recursive:true});
 // Only an exact, bundled historical fingerprint authorizes replacing an old
 // platform helper. Same-named user plugins and extra files still fail above.
 await fs.cp(path.join(resourceRoot,'DeliveryTranslationBridge'),target,{recursive:true,errorOnExist:!checked.upgradeBridge,force:Boolean(checked.upgradeBridge)});
 if(!(await inspectDeliveryPlugins(projectRoot,{resourceRoot,bridgeOnly})).reuseBridge)throw Error('临时翻译插件更新未完成');
 return {installed:true,reused:false,upgraded:Boolean(checked.upgradeBridge)};
}
export async function removeTemporaryDeliveryPlugin(projectRoot,{installed=false}={}){
 const root=await fs.realpath(projectRoot),plugins=path.join(root,'Plugins'),bridge=path.join(plugins,'DeliveryTranslationBridge');
 if(installed&&await exists(bridge)){const actual=await fs.realpath(bridge);if(!inside(root,actual)||actual.toLowerCase()!==bridge.toLowerCase())throw Error('临时插件路径校验失败');await fs.rm(actual,{recursive:true});}
 if(await exists(plugins)){const actual=await fs.realpath(plugins);if(!inside(root,actual)||actual.toLowerCase()!==plugins.toLowerCase())throw Error('Plugins目录路径校验失败');if((await fs.readdir(actual)).length===0)await fs.rmdir(actual);}
 return {temporaryPluginRemoved:!await exists(bridge),emptyPluginsDirectoryRemoved:!await exists(plugins)};
}
