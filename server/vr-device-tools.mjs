import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createDeviceMedia} from './vr-device-media.mjs';

const quote=value=>"'"+String(value).replaceAll("'","'\"'\"'")+"'";
const packageName=value=>{if(typeof value!=='string'||!/^\w+(?:\.\w+)+$/.test(value))throw Error('应用包名无效');return value;};
const remotePath=value=>{if(typeof value!=='string'||/[\x00-\x1f\x7f]/.test(value))throw Error('设备路径无效');const result=path.posix.normalize(value);if(result!=='/sdcard'&&!result.startsWith('/sdcard/'))throw Error('文件操作仅支持共享存储 /sdcard');return result;};
const unique=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID().slice(0,6);
const localName=value=>{let name=String(value).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').replace(/[. ]+$/,'');if(!name||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='file_'+name;return name;};
const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};
export function diagnosticClues(text){
  const groups=[
    {category:'安装与环境',pattern:/INSTALL_FAILED_|UnsatisfiedLinkError|dlopen failed|SecurityException|XR_ERROR_|OpenXR.*(?:failed|error)/i,summary:'可能涉及安装兼容、原生库、权限或 XR 初始化，需要结合上下文确认。'},
    {category:'项目与资源',pattern:/Assertion failed|Fatal error:|Failed to (?:load|find|open).*\/Game\/|LogStreaming: Error|LogBlueprint.*(?:Error|Exception)|Couldn't find file for package/i,summary:'发现断言或项目资源相关线索，需核对实际资源、配置和调用过程。'},
    {category:'原生崩溃',pattern:/Fatal signal|SIGSEGV|SIGABRT|backtrace:|FATAL EXCEPTION|ANR in /i,summary:'发现崩溃或无响应线索。原生调用栈定位源码通常需要对应构建的调试符号。'}
  ];
  return groups.map(group=>({category:group.category,summary:group.summary,evidence:String(text).split(/\r?\n/).filter(line=>group.pattern.test(line)).slice(-8).map(line=>line.slice(0,1000))}));
}
export async function captureAdbPng(adb,args){
  return new Promise((resolve,reject)=>{
    const child=spawn(adb,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});const parts=[];let length=0,error='';
    const timer=setTimeout(()=>{child.kill();reject(Error('截图超时'));},20000);
    child.stdout.on('data',part=>{length+=part.length;if(length>32*1024*1024){child.kill();clearTimeout(timer);reject(Error('截图超过大小限制'));}else parts.push(part);});
    child.stderr.on('data',part=>error=(error+part.toString()).slice(-4000));child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);const png=Buffer.concat(parts);if(code!==0||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))reject(Error(error||'设备没有返回有效截图'));else resolve(png);});
  });
}
export function createVRDeviceTools({root,adbPath,devices,runner,startJob,pngRunner=captureAdbPng}){
  const metadata=new Map();let lastShot=null;
  const media=createDeviceMedia({root,runner});const cleanupPlans=new Map();
  async function enrichDevices(items,id){
    let aliases={};try{aliases=JSON.parse(await fs.readFile(path.join(root,'.local/ue-manager/device-names.json'),'utf8'));}catch{}
    return Promise.all(items.map(async item=>{
      if(item.status!=='device'){metadata.delete(item.serial);return item;}
      let info=metadata.get(item.serial);
      if(!info||Date.now()-info.time>300000){
        try{const adb=await adbPath(id),result=await runner(adb,['-s',item.serial,'shell',"getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.product.marketname; getprop ro.build.version.release"],{timeout:10000});
          const [manufacturer,rawModel,marketingName,androidVersion]=result.stdout.trim().split(/\r?\n/);info={time:Date.now(),manufacturer:manufacturer||'',rawModel:rawModel||item.model,marketingName:marketingName||'',androidVersion:androidVersion||''};
          if(result.code===0)metadata.set(item.serial,info);else info={};
        }catch{info={};}
      }
      const alias=aliases[item.serial];const confirmed=alias&&alias.rawModel===(info.rawModel||item.model)&&typeof alias.name==='string';
      const model=confirmed?alias.name:info.marketingName||(/pico/i.test(info.manufacturer||'')&&!/pico/i.test(item.model)?'PICO '+item.model:item.model);
      return {...item,...info,model,rawModel:info.rawModel||item.model,nameSource:confirmed?'user-confirmed':'device'};
    }));
  }
  async function connection(id,serial){if(typeof serial!=='string'||serial.startsWith('-')||/[\s\0]/.test(serial))throw Error('设备标识无效');if(!(await devices(id)).some(item=>item.serial===serial&&item.status==='device'))throw Error('设备已断开或未授权');return {adb:await adbPath(id),serial};}
  async function shell(c,args,{allowFailure=false,timeout=20000}={}){const result=await runner(c.adb,['-s',c.serial,'shell',Array.isArray(args)?args.map(quote).join(' '):args],{timeout,maxOutput:512000});if(result.code!==0&&!allowFailure)throw Error((result.stderr||result.stdout||'设备操作失败').trim());return result;}
  async function canonical(c,value){const input=remotePath(value);const real=(await shell(c,['readlink','-f',input])).stdout.trim();if(real!=='/storage/emulated/0'&&!real.startsWith('/storage/emulated/0/'))throw Error('该路径不属于设备共享存储，已停止');return {input,real};}
  async function outputFolder(directory,label){if(typeof directory!=='string'||!path.isAbsolute(directory)||(await fs.stat(directory)).isDirectory()!==true)throw Error('请选择导出文件夹');const target=path.join(await fs.realpath(directory),label+'-'+unique());await fs.mkdir(target);return target;}
  async function packages(c,userOnly=true){const result=await shell(c,['pm','list','packages',...(userOnly?['-3']:[])]);return result.stdout.split(/\r?\n/).filter(line=>/^package:\w+(?:\.\w+)+$/.test(line)).map(line=>line.slice(8));}
  async function managedPackage(c,value){const name=packageName(value);if(!(await packages(c)).includes(name))throw Error('此操作仅支持已安装的用户应用');return name;}
  async function apps(c,{scope='user'}={}){const user=await packages(c),list=scope==='all'?await packages(c,false):user;return {items:list.map(name=>({package:name,name,system:!user.includes(name)})),scope};}
  async function appInfo(c,body){const name=packageName(body.package);const text=(await shell(c,['dumpsys','package',name])).stdout;if(!/versionCode=/.test(text))throw Error('应用不存在或无法读取');const user=await packages(c);return {package:name,version:text.match(/versionName=([^\r\n]+)/)?.[1]?.trim()||'',versionCode:text.match(/versionCode=(\d+)/)?.[1]||'',canManage:user.includes(name)};}
  async function storage(c){const text=(await shell(c,['df','-k','/sdcard'])).stdout;const row=text.trim().split(/\r?\n/).at(-1).trim().split(/\s+/);const offset=row.findIndex((value,i)=>i>0&&/^\d+$/.test(value));if(offset<0||!row.slice(offset,offset+3).every(v=>/^\d+$/.test(v)))throw Error('无法解析设备存储容量');return {total:Number(row[offset])*1024,used:Number(row[offset+1])*1024,free:Number(row[offset+2])*1024};}
  async function files(c,body){const category=body.category||'all';if(!['all','apk','images','videos'].includes(category))throw Error('文件分类无效');const location=await canonical(c,category==='all'?(body.path||'/sdcard'):'/sdcard');await shell(c,['test','-d',location.real]);
    const extensions={apk:['apk'],images:['png','jpg','jpeg','webp','gif','bmp','heic'],videos:['mp4','mkv','webm','mov','m4v','avi']};
    const patterns=extensions[category]?.flatMap((ext,i)=>[...(i?['-o']:[]),'-iname','*.'+ext]);
    const args=category==='all'?['find',location.real,'-maxdepth','1','-mindepth','1']:['find',location.real,'-maxdepth','12','(','-path',location.real+'/Android','-o','-name','.*',')','-prune','-o','-type','f','(',...patterns,')'];
    const result=await shell(c,[...args,'-exec','stat','-c','%F\t%s\t%Y\t%n','{}',';'],{allowFailure:category!=='all',timeout:60000});
    const all=result.stdout.split(/\r?\n/).filter(Boolean).map(line=>{const [kind,size,modified,...rest]=line.split('\t');const real=rest.join('\t');return {name:path.posix.basename(real),path:'/sdcard'+real.slice('/storage/emulated/0'.length),directory:kind==='directory',symlink:/symbolic link/.test(kind),bytes:Number(size),modified:Number(modified)*1000};}).filter(item=>item.name&&!Number.isNaN(item.bytes)&&!item.symlink);
    if(result.code!==0&&!all.length&&!/Permission denied/i.test(result.stderr))throw Error(result.stderr||'设备文件扫描失败');
    return {path:location.input,category,items:all.slice(0,1000),truncated:all.length>1000||result.stdout.length>=500000,notice:category==='all'?'':'共享存储分类扫描（最多 12 层），不含 Android 应用目录与隐藏缓存；无权限的目录会跳过。'};
  }
  async function statFile(c,file){const s=(await shell(c,['stat','-c','%F\t%s\t%Y\t%i',file])).stdout.trim().split('\t');if(s[0]!=='regular file'||!s.slice(1).every(v=>/^\d+$/.test(v)))throw Error('文件类型或状态无效');return {bytes:Number(s[1]),modified:Number(s[2])*1000,fingerprint:s.join('\t')};}
  async function thumbnail(c,body){if(body.package)return media.work(c,{package:packageName(body.package)});const item=await canonical(c,body.path);const stat=await statFile(c,item.real);return media.work(c,{path:item.real,...stat});}
  async function cacheRoots(c){const roots=[{path:'/sdcard/DCIM/.thumbnails',reason:'系统图片缩略图缓存'},{path:'/sdcard/Pictures/.thumbnails',reason:'图片缩略图缓存'},{path:'/sdcard/Movies/.thumbnails',reason:'视频缩略图缓存'}];
    for(const pkg of await packages(c)){const running=await shell(c,['pidof',pkg],{allowFailure:true});if(running.code===1&&!running.stdout.trim()&&!running.stderr.trim())roots.push({path:'/sdcard/Android/data/'+pkg+'/cache',package:pkg,reason:'未运行应用的外部缓存'});}
    return roots;
  }
  async function cleanupScan(c){const items=[],unreadable=[];for(const plan of cleanupPlans.values())if(plan.expires<Date.now())cleanupPlans.delete(plan.token);
    for(const entry of await cacheRoots(c)){try{const dir=await canonical(c,entry.path);await shell(c,['test','-d',dir.real]);if(dir.real!=='/storage/emulated/0'+entry.path.slice(7))throw Error('缓存目录存在链接跳转');
      const result=await shell(c,['find',dir.real,'-maxdepth','8','-type','f','-mtime','+7','-exec','stat','-c','%F\t%s\t%Y\t%i\t%n','{}',';'],{allowFailure:true,timeout:30000});
      for(const line of result.stdout.split(/\r?\n/)){const [kind,bytes,mtime,inode,...rest]=line.split('\t'),real=rest.join('\t');if(kind!=='regular file'||!real.startsWith(dir.real+'/')||!/^\d+$/.test(bytes)||!/^\d+$/.test(mtime)||!/^\d+$/.test(inode)||Date.now()-Number(mtime)*1000<8*86400000)continue;
        items.push({id:crypto.randomUUID(),path:'/sdcard'+real.slice('/storage/emulated/0'.length),real,bytes:Number(bytes),modified:Number(mtime)*1000,fingerprint:[kind,bytes,mtime,inode].join('\t'),root:dir.real,package:entry.package,reason:entry.reason});if(items.length>=2000)break;}
      if(result.code)unreadable.push(entry.path);if(items.length>=2000)break;
    }catch{unreadable.push(entry.path);}}
    const token=crypto.randomUUID(),plan={token,device:c.serial,expires:Date.now()+600000,items};cleanupPlans.set(token,plan);while(cleanupPlans.size>8)cleanupPlans.delete(cleanupPlans.keys().next().value);
    return {token,expires:plan.expires,items:items.map(({real,root,fingerprint,...item})=>item),bytes:items.reduce((n,i)=>n+i.bytes,0),unreadable:unreadable.length,truncated:items.length>=2000};
  }
  async function cleanupApply(c,body){const plan=cleanupPlans.get(body.token);if(!plan||plan.device!==c.serial||plan.expires<Date.now())throw Error('扫描结果已失效，请重新扫描');if(body.confirm!==true||!Array.isArray(body.ids)||!body.ids.length||body.ids.length>2000||new Set(body.ids).size!==body.ids.length||body.ids.some(id=>!plan.items.some(item=>item.id===id)))throw Error('请确认扫描列表中的清理项');cleanupPlans.delete(body.token);
    const result={deleted:0,bytes:0,skipped:[],failed:[]};const running=new Set();for(const pkg of new Set(plan.items.map(i=>i.package).filter(Boolean))){const status=await shell(c,['pidof',pkg],{allowFailure:true});if(status.code===0||status.stdout.trim())running.add(pkg);}
    for(const item of plan.items.filter(i=>body.ids.includes(i.id))){try{if(item.package&&!running.has(item.package)){const status=await shell(c,['pidof',item.package],{allowFailure:true});if(status.code!==1||status.stdout.trim()||status.stderr.trim())running.add(item.package);}if(running.has(item.package)){result.skipped.push({path:item.path,reason:'应用已启动或运行状态不可确认'});continue;}const current=await canonical(c,item.path);if(current.real!==item.real||!current.real.startsWith(item.root+'/'))throw Error('路径发生变化');const stat=await statFile(c,current.real);if(stat.fingerprint!==item.fingerprint){result.skipped.push({path:item.path,reason:'文件已变化'});continue;}
      const command=`[ "$(stat -c '%F\t%s\t%Y\t%i' ${quote(current.real)})" = ${quote(item.fingerprint)} ] && rm -- ${quote(current.real)}`;await shell(c,command);result.deleted++;result.bytes+=item.bytes;
    }catch(e){result.failed.push({path:item.path,reason:e.message});}}
    result.message=`已清理 ${result.deleted} 个缓存文件；跳过 ${result.skipped.length} 个，失败 ${result.failed.length} 个`;
    const directory=path.join(root,'.local/vr-cleanup-records');try{await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,unique()+'.json'),JSON.stringify({device:c.serial,time:new Date().toISOString(),...result},null,2));}catch(e){result.auditError=e.message;result.message+='；本机清理记录保存失败';}return result;
  }
  async function logs(c){const text=(await shell(c,['logcat','-d','-t','800','-v','threadtime','-b','main','-b','system','-b','crash'],{timeout:20000})).stdout;return {text,clues:diagnosticClues(text),scope:'设备日志，包含系统与其他应用',capturedAt:new Date().toISOString()};}
  async function memory(c,body){const name=packageName(body.package);const result=await shell(c,['dumpsys','meminfo',name]);const match=result.stdout.match(/TOTAL PSS:\s*([\d,]+)/)||result.stdout.match(/^\s*TOTAL\s+([\d,]+)/m);return {package:name,bytes:match?Number(match[1].replaceAll(',',''))*1024:null};}
  const handlers={
    apps:async(c,body)=>{media.invalidateDevice(c.serial);const result=await apps(c,body);await Promise.all(result.items.map(async item=>{const cached=await media.cachedApp(c.serial,item.package);if(cached)item.cachedMedia={name:cached.name,preview:cached.preview};}));return result;}, 'app-info':appInfo,storage,files,logs,memory,thumbnail,'cleanup-scan':cleanupScan,'cleanup-apply':cleanupApply,
    launch:async(c,body)=>{const name=await managedPackage(c,body.package);const result=await shell(c,['cmd','package','resolve-activity','--brief','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER',name]);const component=result.stdout.trim().split(/\r?\n/).find(line=>/^\w+(?:\.\w+)+\/[\w.$]+$/.test(line));if(!component)throw Error('应用没有可启动入口');const launched=await shell(c,['am','start','-n',component]);if(/Error:|Exception|does not exist/i.test(launched.stdout+launched.stderr))throw Error(launched.stdout+launched.stderr);return {message:'已发送启动指令',package:name};},
    stop:async(c,body)=>{const name=await managedPackage(c,body.package);await shell(c,['am','force-stop',name]);return {message:'应用已停止',package:name};},
    uninstall:async(c,body)=>{const name=await managedPackage(c,body.package);if(body.confirmPackage!==name)throw Error('请确认卸载当前应用');const result=await runner(c.adb,['-s',c.serial,'uninstall',name],{timeout:120000});if(result.code!==0||!/^Success\s*$/m.test(result.stdout.replaceAll('\r','')))throw Error(result.stderr||result.stdout||'卸载失败');return {message:'应用已卸载',package:name};},
    'export-apk':async(c,body)=>{const name=packageName(body.package);const lines=(await shell(c,['pm','path',name])).stdout.trim().split(/\r?\n/).filter(line=>line.startsWith('package:')).map(line=>line.slice(8));if(!lines.length||lines.some(file=>!/^\/(?:data|system|product|vendor)\/[^\r\n\0]+\.apk$/.test(file)))throw Error('无法读取应用安装包路径');const directory=await outputFolder(body.directory,name);for(let i=0;i<lines.length;i++){const target=path.join(directory,String(i).padStart(2,'0')+'-'+localName(path.posix.basename(lines[i])));const result=await runner(c.adb,['-s',c.serial,'pull',lines[i],target],{timeout:600000});if(result.code!==0||!await exists(target))throw Error(result.stderr||result.stdout||'安装包导出失败');}return {message:'安装包已导出'+(lines.length>1?'（含分包）':''),directory,files:lines.length};},
    pull:async(c,body)=>{const item=await canonical(c,body.path);await shell(c,['test','-f',item.real]);const directory=await outputFolder(body.directory,'设备文件');const file=path.join(directory,localName(path.posix.basename(item.input)));const result=await runner(c.adb,['-s',c.serial,'pull',item.real,file],{timeout:600000});if(result.code!==0||!await exists(file))throw Error(result.stderr||result.stdout||'文件导出失败');return {message:'文件已导出',file};},
    push:async(c,body)=>{
      if(typeof body.file!=='string'||!path.isAbsolute(body.file)||!(await fs.stat(body.file)).isFile())throw Error('请选择本地文件');
      const directory=await canonical(c,body.path);await shell(c,['test','-d',directory.real]);const name=path.basename(body.file);if(/[\x00-\x1f\x7f]/.test(name))throw Error('文件名含有不支持的控制字符');
      const target=directory.real+'/'+name;if((await shell(c,['test','-e',target],{allowFailure:true})).code===0)throw Error('设备中已有同名文件，未覆盖');
      const staging=directory.real+'/.ue-platform-upload-'+crypto.randomUUID();
      try{const result=await runner(c.adb,['-s',c.serial,'push',body.file,staging],{timeout:600000});if(result.code!==0)throw Error(result.stderr||result.stdout||'文件导入失败');await shell(c,['mv','-n',staging,target]);if((await shell(c,['test','-e',staging],{allowFailure:true})).code===0)throw Error('目标文件已存在，未覆盖');return {message:'文件已导入',path:directory.input+'/'+name};}
      finally{await shell(c,['rm','--',staging],{allowFailure:true}).catch(()=>{});}
    },
    delete:async(c,body)=>{const item=await canonical(c,body.path);if(item.real==='/storage/emulated/0'||body.confirmPath!==item.input)throw Error('请确认要删除的文件');await shell(c,['test','-f',item.real]);await shell(c,['rm','--',item.real]);return {message:'文件已删除',path:item.input};},
    screenshot:async(c,body)=>{const directory=await outputFolder(body.directory,'头显截图');const png=await pngRunner(c.adb,['-s',c.serial,'exec-out','screencap','-p']);const file=path.join(directory,'screenshot.png');await fs.writeFile(file,png,{flag:'wx'});if(lastShot)delete lastShot.preview;lastShot={message:'截图已保存',file,preview:'data:image/png;base64,'+png.toString('base64')};return lastShot;},
    'export-logs':async(c,body)=>{const directory=await outputFolder(body.directory,'设备诊断');const record=await logs(c);const file=path.join(directory,'logcat.txt');await fs.writeFile(file,record.text,{flag:'wx'});await fs.writeFile(path.join(directory,'clues.json'),JSON.stringify(record.clues,null,2),{flag:'wx'});return {message:'日志与诊断线索已导出',file,directory};}
  };
  const jobs=new Set(['launch','stop','uninstall','export-apk','pull','push','delete','screenshot','export-logs','cleanup-scan','cleanup-apply']);
  async function handle(action,id,body){if(!Object.hasOwn(handlers,action))throw Error('不支持的设备操作');const c=await connection(id,body.device);return jobs.has(action)?startJob(()=>handlers[action](c,body)):handlers[action](c,body);}
  return {handle,enrichDevices,invalidateDevice:media.invalidateDevice};
}
