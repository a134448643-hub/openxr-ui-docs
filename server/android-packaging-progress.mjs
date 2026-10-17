const stages={prepare:[2,'准备工程'],build:[8,'编译项目'],cook:[30,'处理项目资源'],stage:[68,'整理打包文件'],package:[76,'生成 APK'],archive:[90,'输出安装包'],verify:[94,'核验名称、图标与签名'],install:[97,'安装到 USB 设备'],complete:[100,'打包完成']};
export function packagingProgress(stage,previous={},detail=''){
 const [percent,label]=stages[stage]||stages.prepare;
 return {stage,label,percent:Math.max(previous.percent||0,percent),detail,updatedAt:new Date().toISOString()};
}
export function progressFromBuildLog(line,previous={}){
 const text=String(line);let stage;
 if(/\*+\s*ARCHIVE COMMAND STARTED|Copying.*\.apk|Archive\s+Project/i.test(text))stage='archive';
 else if(/\*+\s*PACKAGE COMMAND STARTED|:app:(?:assemble|package)|Making \.apk|Preparing to make APK|rungradle\.bat/i.test(text))stage='package';
 else if(/\*+\s*STAGE COMMAND STARTED|Creating Staging Manifest|Copying NonUFSFiles/i.test(text))stage='stage';
 else if(/\*+\s*COOK COMMAND STARTED|LogCook:|Cooked packages/i.test(text))stage='cook';
 else if(/\*+\s*BUILD COMMAND STARTED|Building .*Android|Running UnrealBuildTool/i.test(text))stage='build';
 if(stage&&stages[stage][0]<(stages[previous.stage]?.[0]||0))stage=null;
 let next=stage?packagingProgress(stage,previous):{...previous};
 const counts=text.match(/Cooked packages\s+(\d+)\s+Packages Remain\s+(\d+)/i);
 if(counts&&next.stage==='cook'){
  const done=Number(counts[1]),remaining=Number(counts[2]),total=done+remaining;
  next={...next,percent:Math.max(next.percent||30,total?Math.min(65,30+Math.floor(done/total*35)):30),detail:`已处理 ${done} 个资源包，剩余 ${remaining} 个`,updatedAt:new Date().toISOString()};
 }
 if(/Downloading https?:.*gradle/i.test(text))next={...next,detail:'正在下载 Gradle，等待下载完成',updatedAt:new Date().toISOString()};
 return next;
}
