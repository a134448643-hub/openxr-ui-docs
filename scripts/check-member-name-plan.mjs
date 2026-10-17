import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeSemanticRows} from '../server/semantic-translation.mjs';
import {memberNameCollisions} from '../server/ue-member-name-plan.mjs';

const root=path.resolve('.local/checks/member-names-0.1.68');await fs.mkdir(root,{recursive:true});
const row=(key,kind,original,translated,extra={})=>({entryKey:key,group:'members',field:'Name',owner:'/Game/Checks/BP_Test',kind,original,elementName:original,translated,...extra});
const naming={softMemberLength:80,softAssetLength:80};
const normalize=(rows,assets=[])=>normalizeSemanticRows(rows,{entries:rows,assets},naming,'zh-en');
const rows=[
 row('variable','变量','按钮名称','ButtonName'),row('widget','UMG控件','UMG按钮名称','ButtonName'),
 row('animation','UMG动画','关闭','ButtonName'),
 row('delegate','事件分发器','更换手势模型时','OnGestureModelChanged'),row('event','事件','更换手势模型事件','OnGestureModelChanged'),
 row('native','变量','NativeName','NativeName',{native:'NativeName'}),row('native-candidate','函数','获取对象','NativeName'),
 row('english','变量','KeepName','KeepName'),row('english-candidate','组件','保留组件','KeepName'),
 row('old-occupied','变量','下一名称','Reserved'),row('swap-a','变量','旧名称','下一名称'),
 row('input','输入参数','输入值','Value',{graphName:'计算'}),row('output','输出参数','输出值','Value',{graphName:'计算'}),row('local','局部变量','局部值','Value',{graphName:'计算'}),
 row('other-graph','局部变量','其他值','Value',{graphName:'另一函数'}),
 row('suffix-a','变量','物体_s','Object_s'),row('suffix-b','UMG控件','界面_s','Object_s'),
 row('alias-a','事件分发器','状态更新','OnStatusChanged'),row('alias-b','变量','状态更新','OnStatusChanged'),
 row('case-a','变量','位置','Position'),row('case-b','UMG控件','控件位置','position'),
 row('untouched-prose','蓝图注释','中文说明','ButtonName',{group:'text',field:'CommentText'}),
];
const result=normalize(rows),byKey=new Map(result.map(r=>[r.entryKey,r]));
assert.equal(byKey.get('variable').translated,'ButtonName');assert.equal(byKey.get('widget').translated,'ButtonNameWidget');
assert.equal(byKey.get('animation').translated,'ButtonNameAnimation');
assert.equal(byKey.get('delegate').translated,'OnGestureModelChanged');assert.equal(byKey.get('event').translated,'OnGestureModelChangedEvent');
assert.equal(byKey.get('native').translated,'NativeName');assert.equal(byKey.get('native-candidate').translated,'NativeNameFunction');
assert.equal(byKey.get('english').translated,'KeepName');assert.equal(byKey.get('english-candidate').translated,'KeepNameComponent');
assert.notEqual(byKey.get('swap-a').translated,'下一名称');
assert.equal(new Set(['input','output','local'].map(k=>byKey.get(k).translated)).size,3);assert.equal(byKey.get('other-graph').translated,'Value');
assert.equal(byKey.get('suffix-b').translated,'ObjectWidget_s');
assert.equal(byKey.get('alias-a').translated,byKey.get('alias-b').translated);
assert.notEqual(byKey.get('case-a').translated.toLowerCase(),byKey.get('case-b').translated.toLowerCase());
assert.equal(byKey.get('untouched-prose').translated,'ButtonName');
assert.equal(memberNameCollisions(result).size,0);assert.deepEqual(normalize(result),result);
const reversed=new Map(normalize([...rows].reverse()).map(r=>[r.entryKey,r.translated]));for(const r of result)assert.equal(reversed.get(r.entryKey),r.translated);
const inherited=normalize([row('parent','变量','父类状态','Status'),row('child','UMG控件','子类状态','Status',{owner:'/Game/Checks/BP_Child'})],[{packageName:'/Game/Checks/BP_Test'},{packageName:'/Game/Checks/BP_Child',parentBlueprint:'/Game/Checks/BP_Test',reservedMemberNames:['GetWorld']}]);
assert.equal(inherited[1].translated,'StatusWidget');
const overrides=normalize([row('parent-method','函数','更新状态','UpdateStatus'),row('override','函数','更新状态','RefreshStatus',{owner:'/Game/Checks/BP_Child'})],[{packageName:'/Game/Checks/BP_Test'},{packageName:'/Game/Checks/BP_Child',parentBlueprint:'/Game/Checks/BP_Test'}]);assert.equal(overrides[1].translated,'UpdateStatus');assert.deepEqual(normalize(overrides,[{packageName:'/Game/Checks/BP_Test'},{packageName:'/Game/Checks/BP_Child',parentBlueprint:'/Game/Checks/BP_Test'}]),overrides);
assert.equal(normalize([row('reserved','变量','对象','GetWorld')],[{packageName:'/Game/Checks/BP_Test',reservedMemberNames:['GetWorld']}])[0].translated,'GetWorldVariable');
const alternatives=normalize([row('a','变量','值','Value'),row('b','UMG控件','文本','Value'),row('c','变量','其他值','ValueWidget')]);assert.equal(alternatives[1].translated,'ValueWidget2');

// Read the failed job only. Never execute this plan or touch its project.
const failed=JSON.parse(await fs.readFile('.local/project-delivery-state/processing/d0d16202-e3fb-4bb5-8d5f-c4792a294056/apply-request.json'));
const replay=normalize(failed.memberEntries);assert.equal(memberNameCollisions(replay).size,0);
for(const r of replay.filter(r=>r.preserveFunctionalMap)){assert.equal(r.translated,r.original);assert.equal(r.needsSemanticReview,false);}
const corrected=replay.filter((r,i)=>!r.preserveFunctionalMap&&r.translated!==failed.memberEntries[i].translated).map(r=>({owner:r.owner,kind:r.kind,original:r.original,translated:r.translated}));
assert.equal(corrected.length,2);assert.deepEqual(normalize(replay),replay);
const report={success:true,mockModel:false,modelRequests:0,userProjectExecution:false,failedPlanRows:replay.length,corrected,checks:['shared class namespace','parameter/local namespace','case insensitive','preserve English/native','reserve original names for sequential rename','alias consistency','suffix spelling/case','stable row order and repeated normalization','ancestor and native names','qualified fallback already occupied','prose unaffected','failed cached plan corrected without model request']};
await fs.writeFile(path.join(root,'plan-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
