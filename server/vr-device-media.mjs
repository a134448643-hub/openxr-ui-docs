import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {deflateRawSync} from 'node:zlib';
import crypto from 'node:crypto';
const q=v=>"'"+String(v).replaceAll("'","'\"'\"'")+"'";
export function adbBinary(adb,args,limit=32*1024*1024){return new Promise((resolve,reject)=>{
 const child=spawn(adb,args,{shell:false,windowsHide:true});let length=0,parts=[],error='',settled=false;
 const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(value);};
 const timer=setTimeout(()=>{child.kill();finish(Error('缩略图读取超时'));},30000);
 child.stdout.on('data',b=>{length+=b.length;if(length>limit){child.kill();finish(Error('文件超过缩略图读取上限'));}else parts.push(b);});
 child.stderr.on('data',b=>error=(error+b).slice(-2000));child.on('error',e=>finish(e));child.on('close',code=>finish(code?Error(error||'无法读取设备缩略图'):null,Buffer.concat(parts)));
});}
function crc32(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function zip(files){const chunks=[],entries=[];let offset=0;for(const [name,data] of files){const n=Buffer.from(name),b=deflateRawSync(data),h=Buffer.alloc(30),d=Buffer.alloc(46),crc=crc32(data);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(8,10);d.writeUInt32LE(crc,16);d.writeUInt32LE(b.length,20);d.writeUInt32LE(data.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);chunks.push(h,n,b);entries.push(d,n);offset+=h.length+n.length+b.length;}const central=Buffer.concat(entries),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,central,end]);}
export {zip as createMetadataArchive};
export function createDeviceMedia({root,runner,binary=adbBinary,imageProcessor}){
 const cache=new Map(),pending=new Map(),epochs=new Map();let queue=Promise.resolve();
 async function image(buffer){const {nativeImage}=await import('electron');const img=nativeImage.createFromBuffer(buffer);if(img.isEmpty())throw Error('此图像格式无法预览');return img.resize({width:80,height:80,quality:'good'}).toDataURL();}
 async function exec(c,cmd,limit){return binary(c.adb,['-s',c.serial,'exec-out',cmd],limit);}
 const cachedFile=(serial,pkg)=>path.join(root,'.local/vr-device-cache',crypto.createHash('sha256').update(serial).digest('hex'),crypto.createHash('sha256').update(pkg).digest('hex')+'.json');
 async function cachedApp(serial,pkg){try{const record=JSON.parse(await fs.readFile(cachedFile(serial,pkg),'utf8'));return record.schema===1&&typeof record.fingerprint==='string'&&typeof record.preview==='string'&&record.preview.startsWith('data:image/png;base64,')&&record.preview.length<1024*1024&&typeof record.name==='string'?record:null;}catch{return null;}}
 async function saveApp(serial,pkg,fingerprint,result){const file=cachedFile(serial,pkg);await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify({schema:1,fingerprint,...result}));await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}}
 async function work(c,{package:pkg,path:file,bytes,modified}){
  let apk,fingerprint;
  if(pkg){try{const found=await runner(c.adb,['-s',c.serial,'shell',`pm path ${q(pkg)}`],{timeout:10000});apk=found.stdout.split(/\r?\n/).find(l=>l.endsWith('/base.apk'))?.slice(8)||found.stdout.split(/\r?\n/).find(l=>l.startsWith('package:'))?.slice(8);if(found.code||!apk||!/^\/(data|system|product|vendor)\//.test(apk))throw Error('应用安装包不可读');const stat=await runner(c.adb,['-s',c.serial,'shell',`stat -c '%s:%Y' ${q(apk)}`],{timeout:10000});if(stat.code||!/^\d+:\d+$/.test(stat.stdout.trim()))throw Error('无法核对应用更新时间');fingerprint=crypto.createHash('sha256').update(apk+'\n'+stat.stdout.trim()).digest('hex');}catch(e){return {preview:null,reason:e.message};}}
  const key=JSON.stringify([c.serial,pkg,file,bytes,modified,epochs.get(c.serial)||0,fingerprint]);const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.value;if(pending.has(key))return pending.get(key);
  const task=queue.catch(()=>{}).then(async()=>{
   let folder;try{
    let result;
    if(pkg){
     const disk=await cachedApp(c.serial,pkg);if(disk?.fingerprint===fingerprint){const value={preview:disk.preview,name:disk.name,cached:true};cache.set(key,{value,expires:Date.now()+300000});return value;}
     // Read only metadata and the selected icon, never copy the full installed APK.
     const manifest=await exec(c,`unzip -p ${q(apk)} AndroidManifest.xml`,2*1024*1024),resources=await exec(c,`unzip -p ${q(apk)} resources.arsc`,24*1024*1024);
     const sdk=path.dirname(path.dirname(c.adb)),builds=(await fs.readdir(path.join(sdk,'build-tools'))).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));let aapt;
     for(const version of builds){const candidate=path.join(sdk,'build-tools',version,'aapt.exe');try{await fs.access(candidate);aapt=candidate;break;}catch{}}
     if(!aapt)throw Error('SDK 中没有 aapt，无法读取应用图标');
     folder=path.join(root,'.local/vr-preview-tmp',crypto.randomUUID());await fs.mkdir(folder,{recursive:true});const mini=path.join(folder,'metadata.apk');await fs.writeFile(mini,zip([['AndroidManifest.xml',manifest],['resources.arsc',resources]]));
     const dump=await runner(aapt,['dump','badging','metadata.apk'],{cwd:folder,timeout:15000,maxOutput:128000});if(dump.code)throw Error('SDK 无法解析应用图标元数据');const icons=[...dump.stdout.matchAll(/application-icon-(\d+):'([^']+)'/g)].sort((a,b)=>Number(b[1])-Number(a[1]));let entry=icons.find(m=>/\.(png|webp|jpe?g)$/i.test(m[2]))?.[2]||dump.stdout.match(/application:.*icon='([^']+\.(?:png|webp|jpe?g))'/)?.[1];
     if(!entry){
      // aapt omits icon lines when referenced image entries are absent in the metadata archive.
      // Resolve the declared manifest icon resource through the resource table instead of guessing filenames.
      const tree=await runner(aapt,['dump','xmltree','metadata.apk','AndroidManifest.xml'],{cwd:folder,timeout:15000,maxOutput:128000});const iconId=tree.stdout.match(/A: android:icon\([^)]*\)=@(0x[\da-f]+)/i)?.[1];
      if(iconId){const table=await runner(aapt,['dump','--values','resources','metadata.apk'],{cwd:folder,timeout:15000,maxOutput:4*1024*1024});const lines=table.stdout.split(/\r?\n/);const paths=[];for(let i=0;i<lines.length;i++){if(!new RegExp('resource '+iconId+'\\b','i').test(lines[i]))continue;for(let j=i+1;j<Math.min(i+8,lines.length)&&!/^\s*resource 0x/.test(lines[j]);j++){const match=lines[j].match(/"(res\/[^"\r\n]+\.(?:png|webp|jpe?g))"/i);if(match)paths.push(match[1]);}}entry=paths.at(-1);}
     }
     if(!entry||!entry.startsWith('res/'))throw Error('应用使用自适应或不支持的图标格式');
     result={preview:await (imageProcessor||image)(await exec(c,`unzip -p ${q(apk)} ${q(entry)}`,4*1024*1024)),name:dump.stdout.match(/application-label:'([^']+)'/)?.[1]||pkg};
     await saveApp(c.serial,pkg,fingerprint,result).catch(()=>{});
    }else{
     if(bytes>128*1024*1024)throw Error('视频超过 128 MB，暂不读取缩略图');
     if(/\.(png|jpe?g|webp|gif|bmp)$/i.test(file)){result={preview:await image(await exec(c,`cat ${q(file)}`,32*1024*1024))};}
     else if(/\.(mp4|mkv|webm|mov|m4v|avi)$/i.test(file)){
      folder=path.join(root,'.local/vr-preview-tmp',crypto.randomUUID());await fs.mkdir(folder,{recursive:true});const local=path.join(folder,'video'+path.extname(file));await fs.writeFile(local,await exec(c,`cat ${q(file)}`,128*1024*1024));
      const {nativeImage}=await import('electron');const thumb=await nativeImage.createThumbnailFromPath(local,{width:80,height:80});if(thumb.isEmpty())throw Error('系统无法解码该视频缩略图');result={preview:thumb.toDataURL()};
     }else throw Error('此文件类型没有缩略图');
    }
    cache.set(key,{value:result,expires:Date.now()+300000});while(cache.size>120)cache.delete(cache.keys().next().value);return result;
   }catch(e){const result={preview:null,reason:e.message};cache.set(key,{value:result,expires:Date.now()+30000});while(cache.size>120)cache.delete(cache.keys().next().value);return result;}
   finally{if(folder)await fs.rm(folder,{recursive:true,force:true});pending.delete(key);}
  });pending.set(key,task);queue=task;return task;
 }
 return {work,cachedApp,invalidateDevice(serial){epochs.set(serial,(epochs.get(serial)||0)+1);for(const key of cache.keys())if(JSON.parse(key)[0]===serial)cache.delete(key);}};
}
