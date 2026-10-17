// Run only with explicit authorization for these four text-only sample entries.
import {translateWithCodex,codexStatus} from '../server/codex-translation.mjs';
import {defaultTranslationSettings} from '../server/translation-settings.mjs';
const config=defaultTranslationSettings(),profile=config.profiles[0];
const entries=[{id:'pad',original:'PAD_手势配置',group:'assets',kind:'资产',field:'Name',assetClass:'Blueprint',assetRole:'primaryDataAssetClass',requiredPrefix:'PAD_',context:{parentClass:'/Script/Engine.PrimaryDataAsset',owner:'GestureSystem',purpose:'Configuration of hand gesture recognition'}},{id:'interface',original:'BPI_通用按钮',group:'assets',kind:'接口',field:'Name',assetClass:'Blueprint',assetRole:'blueprintInterface',requiredPrefix:'BPI_',context:{parentClass:'/Script/CoreUObject.Interface',graphs:[{name:'点击按压按钮'},{name:'取消点击按压按钮'}]}},{id:'ray',original:'BPC_控件交互组件_射线',group:'assets',kind:'组件资产',field:'Name',assetRole:'actorComponentClass',requiredPrefix:'AC_',context:{parentClass:'/Script/Engine.ActorComponent',graphs:[{name:'射线交互',calls:['LineTraceSingle','PressPointerKey','ReleasePointerKey']}]}},{id:'bool',original:'是否开启追踪',group:'members',kind:'变量',field:'Name',valueType:'bool',container:'scalar',context:{owner:'HandTracking',related:[{text:'启用手部追踪'}]}}];
if(!process.argv.includes('--authorized-four-samples'))throw Error('This smoke test needs explicit authorization for four samples.');
console.log(JSON.stringify(await codexStatus(profile)));
const result=await translateWithCodex({entries,direction:'zh-en',terms:[['手势','Gesture'],['追踪','Tracking']],naming:config.naming,profile,directory:'.local/checks/luna-semantic-smoke-'+Date.now()});
console.log(JSON.stringify({model:profile.model,results:result}));
