import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
const key=p=>path.resolve(p).toLowerCase();
export function projectCacheLocation(source,host=source){
 const hostCache=path.join(host.projectRoot,'.ue-translation-cache'),derived=key(source.descriptorPath)!==key(host.descriptorPath);
 return {cacheRoot:derived?path.join(hostCache,'p',crypto.createHash('sha256').update(key(source.descriptorPath)+(source.cacheGeneration?'|'+source.cacheGeneration:'')).digest('hex').slice(0,16)):hostCache,hostCache,cacheHostDescriptor:host.descriptorPath,derived};
}
async function ensureOwned(folder,sourceDescriptor,extra={}){
 let existing=folder;for(;;){try{await fs.lstat(existing);break;}catch(e){if(e.code!=='ENOENT')throw e;existing=path.dirname(existing);}}
 if(key(await fs.realpath(existing))!==key(existing))throw Error('项目缓存父目录包含链接');
 await fs.mkdir(folder,{recursive:true});if((await fs.lstat(folder)).isSymbolicLink()||key(await fs.realpath(folder))!==key(folder))throw Error('项目缓存路径包含链接');
 const ownerFile=path.join(folder,'owner.json');let owner;try{owner=JSON.parse(await fs.readFile(ownerFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(owner){if(owner.kind!=='ue-project-translation-cache'||key(owner.sourceDescriptor)!==key(sourceDescriptor))throw Error('项目缓存归属不匹配，未覆盖');}
 else await fs.writeFile(ownerFile,JSON.stringify({kind:'ue-project-translation-cache',schemaVersion:1,sourceDescriptor,...extra},null,2),{flag:'wx'});
}
export async function ensureProjectCacheLocation(source,host=source){
 const location=projectCacheLocation(source,host);await ensureOwned(location.hostCache,host.descriptorPath);if(process.platform==='win32')await new Promise(resolve=>{const child=spawn('attrib.exe',['+H',location.hostCache],{windowsHide:true,stdio:'ignore'});child.on('error',resolve);child.on('close',resolve);});
 if(location.derived)await ensureOwned(location.cacheRoot,source.descriptorPath,{cacheHostDescriptor:host.descriptorPath,cacheGeneration:source.cacheGeneration});
 return location;
}
