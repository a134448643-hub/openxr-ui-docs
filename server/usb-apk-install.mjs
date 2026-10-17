import path from 'node:path';
export function primaryUsbArtifacts(artifacts,verification){
 const unique=[...new Set(artifacts)];
 return unique.filter(file=>{
  const name=path.basename(file);if(!/^AFS_/i.test(name))return true;
  const main=unique.find(other=>path.dirname(other).toLowerCase()===path.dirname(file).toLowerCase()&&path.basename(other).toLowerCase()===name.slice(4).toLowerCase());
  if(!main)return true;
  const a=verification?.items?.find(item=>item.file===file),b=verification?.items?.find(item=>item.file===main);
  // An AFS companion shares the primary package identity; never discard an
  // unrelated application just because its filename happens to start AFS_.
  return !(a?.packageName&&a.packageName===b?.packageName&&a.versionCode===b.versionCode&&a.certificateSha256===b.certificateSha256);
 });
}
export function createUsbApkInstaller({adbPath,runner,devices,installApk,job}){
 return async function install(id,artifacts,verification,{target}={}){
  artifacts=primaryUsbArtifacts(artifacts,verification);
  if(artifacts.length!==1)return {status:'skipped',message:'生成了多个 APK，请在 VR 开发者工具中选择安装'};
  const adb=await adbPath(id),usb=await runner(adb,['-d','get-serialno'],{timeout:15000}),device=usb.stdout.trim();
  if(usb.code!==0||!device||device==='unknown'||/\s/.test(device))return {status:'skipped',message:/more than one/i.test(usb.stderr||usb.stdout)?'检测到多台 USB 设备，请手动选择安装':'USB 设备未连接或未授权，安装包已保留'};
  const info=(await devices(id)).find(item=>item.serial===device&&item.status==='device');if(!info)return {status:'skipped',message:'USB 设备已断开或未授权，安装包已保留'};
  const model=[info.model,info.manufacturer,info.rawModel].filter(Boolean).join(' ');
  if(target==='quest'&&!/quest|oculus|meta/i.test(model)||target==='pico'&&!/pico/i.test(model))return {status:'skipped',message:'已连接设备 '+info.model+' 与打包平台不匹配，安装包已保留'};
  const expected=verification?.items?.find(item=>item.file===artifacts[0]);const started=await installApk(id,{file:artifacts[0],device,...(expected?{expected}:{})});let task;
  do{task=job(started.jobId);if(task?.status==='running')await new Promise(resolve=>setTimeout(resolve,100));}while(task?.status==='running');
  if(task?.status!=='complete')throw Error(task?.message||'USB 安装任务丢失');
  return {status:'complete',device,model:info.model,file:artifacts[0],verification:task.result?.verification,message:'已安装到 '+info.model+(task.result?.verification?.verified?'，名称与版本已核对':'')};
 };
}
