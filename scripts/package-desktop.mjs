import {planGeneratedCleanup,applyGeneratedCleanup} from '../server/platform-generated-cleanup.mjs';
import {activeGeneratedPaths} from './cleanup-platform-generated.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {packager} from '@electron/packager';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),staging=path.join(root,'.local','desktop-build','app');await fs.mkdir(staging,{recursive:true});
for(const folder of ['server','desktop'])await fs.cp(path.join(root,folder),path.join(staging,folder),{recursive:true,filter:source=>!source.endsWith('README.md')&&!/\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(source)});
await fs.mkdir(path.join(staging,'node_modules'),{recursive:true});await fs.cp(path.join(root,'node_modules/yaml'),path.join(staging,'node_modules/yaml'),{recursive:true});
const productVersion=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
await fs.writeFile(path.join(staging,'package.json'),JSON.stringify({name:'personal-dev-platform',version:productVersion,type:'module',main:'desktop/main.mjs',dependencies:{yaml:'2.9.0'}},null,2));
await fs.writeFile(path.join(staging,'desktop/build-config.json'),JSON.stringify({workspace:root},null,2));
const version=JSON.parse(await fs.readFile(path.join(root,'node_modules/electron/package.json'),'utf8')).version;
const result=await packager({dir:staging,name:'PersonalDevPlatform',platform:'win32',arch:'x64',electronVersion:version,icon:path.join(root,'desktop/assets/app-icon.ico'),electronZipDir:path.join(root,'.local/electron-runtime'),out:path.join(root,'.local','desktop-build','release',productVersion),overwrite:true,asar:true,prune:false,win32metadata:{ProductName:'晓梦个人项目平台',FileDescription:'UE 工程与文档管理桌面开发版'},ignore:[/\.bak$/,/\.(?:pdb|obj|pch|lib|exp|ilk)$/i]});
// UE scripts and native plugin files must be real files outside Electron's ASAR.
for(const release of result){const output=path.join(release,'resources','delivery');await fs.cp(path.join(root,'desktop/resources/delivery'),output,{recursive:true,filter:source=>!/\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(source)});for(const relative of ['scan-blueprints.py','translation-coverage.py','verify-rename-bindings.py','verify-chinese-residue.py','export-translated-project.py','DeliveryTranslationBridge/DeliveryTranslationBridge.uplugin','DeliveryTranslationBridge/Binaries/Win64/UnrealEditor-DeliveryTranslationBridge.dll'])await fs.access(path.join(output,relative));}
console.log('Desktop release: '+result.join('\n'));
// Preserve the launcher's original encoding while updating only the ASCII version path.
const launcherFile=path.join(root,'启动个人开发平台.vbs');try{const launcher=await fs.readFile(launcherFile);const text=launcher.toString('latin1').replace(/(release\\)\d+\.\d+\.\d+(\\PersonalDevPlatform)/,(_match,before,after)=>before+productVersion+after);await fs.writeFile(launcherFile,Buffer.from(text,'latin1'));}catch(error){if(error.code!=='ENOENT')throw error;}
if(process.platform==='win32')await new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/create-desktop-shortcut.ps1')],{cwd:root,stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Desktop shortcuts could not be updated')));});

// Automatic pruning starts only after the user has approved the relevant cleanup scope.
let cleanupPolicy;try{cleanupPolicy=JSON.parse(await fs.readFile(path.join(root,'.local/generated-cleanup-policy.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(cleanupPolicy?.releases){try{const activePaths=await activeGeneratedPaths(root),plan=await planGeneratedCleanup({root,currentVersion:productVersion,activePaths,checks:false,previews:false,packagingWork:false}),result=await applyGeneratedCleanup(plan,{activePaths:await activeGeneratedPaths(root)});console.log('Old desktop release cleanup: '+result.freedBytes+' bytes; '+result.skipped.length+' paths retained.');}catch(e){console.warn('Generated cleanup deferred: '+e.message);}}
// Publishing an app must not also delete arbitrary test/preview folders. Keep a
// separate concrete plan for review; only explicitly reviewed plans are applied.
if(cleanupPolicy?.checks||cleanupPolicy?.previews||cleanupPolicy?.packagingWork){try{const plan=await planGeneratedCleanup({root,currentVersion:productVersion,activePaths:await activeGeneratedPaths(root),checks:Boolean(cleanupPolicy.checks),previews:Boolean(cleanupPolicy.previews),allTestFolders:Boolean(cleanupPolicy.allTestFolders),packagingWork:Boolean(cleanupPolicy.packagingWork)});await fs.writeFile(path.join(root,'.local/pending-cache-cleanup.json'),JSON.stringify(plan,null,2));console.log('Cache cleanup plan saved; test/preview files were not deleted during packaging.');}catch(error){console.warn('Cache cleanup planning deferred: '+error.message);}}
