import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {automaticAndroidPackageName} from '../server/android-package-name.mjs';
import {activityPackagingSettings,picoLauncherSettings} from '../server/ue-android-packaging.mjs';
import {createAndroidPackageIdentity} from '../server/android-package-identity.mjs';
import {iniValue,androidSection} from '../server/ue-ini.mjs';

const root=path.resolve('.local/checks/packaging-options-'+Date.now()),projectRoot=path.join(root,'Derived');
await fs.mkdir(path.join(projectRoot,'Config/Android'),{recursive:true});
let descriptorPath=path.join(projectRoot,'OpenXR_UI.uproject');await fs.writeFile(descriptorPath,'{}');
const defaultConfig=path.join(projectRoot,'Config/DefaultEngine.ini'),androidConfig=path.join(projectRoot,'Config/Android/AndroidEngine.ini');
await fs.writeFile(defaultConfig,'['+androidSection+']\nPackageName=com.PICO.demo\n');await fs.writeFile(androidConfig,'['+androidSection+']\nPackageName=com.old.override\n');
const project=async()=>({id:'fixture',projectRoot,descriptorPath}),api=createAndroidPackageIdentity({root,project,isDerivedProject:async()=>true});
assert.equal(automaticAndroidPackageName(descriptorPath),'com.xiaomeng.openxr_ui');
assert.notEqual(automaticAndroidPackageName('蓝图.uproject'),automaticAndroidPackageName('项目.uproject'));
assert.match(automaticAndroidPackageName('53 demo.uproject'),/^com\.xiaomeng\.[a-z][a-z0-9_]*$/);
assert.equal((await api.get('fixture')).packageName,'com.xiaomeng.openxr_ui');
await api.prepare(await project());
for(const file of [defaultConfig,androidConfig])assert.equal(iniValue(await fs.readFile(file,'utf8'),androidSection,'PackageName'),'com.xiaomeng.openxr_ui');
descriptorPath=path.join(projectRoot,'Renamed.uproject');await fs.writeFile(descriptorPath,'{}');
await api.save('fixture',{name:'新显示名称'});await api.prepare(await project());assert.equal((await api.get('fixture')).packageName,'com.xiaomeng.openxr_ui');
await api.save('fixture',{packageName:'com.custom.manual',autoPackageName:false});await api.prepare(await project());assert.equal((await api.get('fixture')).packageName,'com.custom.manual');
await api.save('fixture',{autoPackageName:true});assert.equal((await api.get('fixture')).packageName,'com.xiaomeng.openxr_ui');
await assert.rejects(api.save('fixture',{autoPackageName:'True'}),/自动包名/);
for(const target of ['pico','universal','quest'])for(const activity of ['auto','game','splash']){
 if(target==='quest'&&activity==='splash'){assert.throws(()=>activityPackagingSettings(target,activity),/Quest/);continue;}
 const values=Object.fromEntries(activityPackagingSettings(target,activity).map(e=>[e.key,e.value]));
 assert.equal(values.bShowLaunchImage,activity==='splash'?'True':'False');
 assert.equal(values.bPackageForMetaQuest,target==='pico'||activity==='splash'?'False':'True');
}
const legacy='['+androidSection+']\nExtraActivitySettings=<meta-data android:name="custom" android:value="yes" /><!-- PersonalDevPlatform:PICO --><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter><!-- /PersonalDevPlatform:PICO -->\n';
const settings=picoLauncherSettings(legacy);assert.match(settings.value,/name="custom"/);assert.match(settings.value,/pvr.app.type/);assert.doesNotMatch(settings.value,/intent-filter|LAUNCHER/);
const report={passed:true,checks:['Automatic package name replaces prior demo and Android layer overrides on prepare','Generated name persists across display/descriptor rename; manual override and re-enable work','Chinese and digit-leading names produce valid distinct identifiers','Splash enables launch image and disables forced Quest mode; game/auto reversible; Quest splash rejected','Legacy managed GameActivity launcher removed to leave one engine-generated launcher'],actualUEPackaging:false,actualDeviceWrites:false};
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({root,...report}));
