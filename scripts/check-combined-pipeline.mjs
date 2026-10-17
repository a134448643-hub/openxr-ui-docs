import assert from 'node:assert/strict';
import {combinedClassificationPlan,combinedTranslationRows} from '../server/combined-project-plan.mjs';
import {makeAssetExportPlan} from '../server/ue-asset-naming.mjs';
import {planSemanticBatches,buildSemanticPrompt,compactSemanticInput} from '../server/semantic-translation.mjs';

const data=[
 ['/Game/P/蓝图/手势/组件/BP_角色','Blueprint','Blueprints'],
 ['/Game/P/蓝图/手势/组件/UMG/M_按钮','Material','Materials'],
 ['/Game/P/用户控件/UI/UMG/对话框/WBP_菜单','WidgetBlueprint','Widgets'],
 ['/Game/P/Demo/Maps/L_Test','World','Maps'],
 ['/Game/P/Demo/Maps/L_Test_BuiltData','MapBuildDataRegistry','Maps']
];
const result={assets:data.map(([packageName,assetClass])=>({packageName,assetClass})),classification:{assets:data.map(([p,c,category])=>({path:p,name:p.split('/').at(-1),class:'/Script/Engine.'+c,category,dependencies:c==='World'?[p+'_BuiltData']:[]}))}};
const classification=combinedClassificationPlan(result,'P');
assert.equal(classification.mapping[data[0][0]],'/Game/P/Blueprints/手势/组件/BP_角色');
assert.equal(classification.mapping[data[1][0]],'/Game/P/Blueprints/手势/组件/UMG/M_按钮');
assert.equal(classification.mapping[data[2][0]],'/Game/P/Widgets/对话框/WBP_菜单');
const dictionary={'手势':'Gestures','组件':'Components','对话框':'Dialogs','BP_角色':'BP_Pawn','M_按钮':'M_Button','WBP_菜单':'WBP_Menu'};
const originals=result.assets.map(a=>({group:'assets',kind:'资源名称',field:'Name',owner:a.packageName,original:a.packageName.split('/').at(-1)}));
const rows=combinedTranslationRows([...originals,{group:'assets',kind:'目录',field:'Name',owner:'/Game/P/用户控件/UI',original:'UI'}],classification).map(r=>({...r,translated:dictionary[r.original]||r.original}));
assert.ok(!rows.some(r=>r.kind==='目录'&&r.owner==='/Game/P/用户控件/UI'));
assert.ok(rows.some(r=>r.owner==='/Game/P/Blueprints/手势'));
const moves=makeAssetExportPlan(rows,result.assets,'Unused',{inPlace:true,classification});
assert.equal(moves.find(m=>m.oldPath===data[0][0]).newPath,'/Game/P/Blueprints/Gestures/Components/BP_Pawn');
assert.equal(moves.find(m=>m.oldPath===data[1][0]).newPath,'/Game/P/Blueprints/Gestures/Components/UMG/M_Button');
assert.equal(moves.find(m=>m.oldPath===data[2][0]).newPath,'/Game/P/Widgets/Dialogs/WBP_Menu');
assert.equal(moves.find(m=>m.assetClass==='MapBuildDataRegistry').newPath,moves.find(m=>m.assetClass==='World').newPath+'_BuiltData');
assert.throws(()=>combinedClassificationPlan({...result,classification:{assets:[]}},'P'),/完整分类/);
assert.throws(()=>combinedClassificationPlan({...result,classification:{assets:result.classification.assets.map(a=>({...a,class:'Wrong'}))}},'P'),/类型清单不一致/);
const colliding=['/Game/A/M_Check','/Game/B/M_Check'],collisionPlan={mapping:Object.fromEntries(colliding.map((p,i)=>[p,'/Game/P/Materials/M_Check'+(i?'_12345678':'')])),moves:[{oldPath:colliding[1],newName:'M_Check_12345678',collisionResolved:true}]};
const collisionMoves=makeAssetExportPlan(colliding.map(owner=>({group:'assets',kind:'资源名称',owner,original:'M_Check',translated:'M_Check'})),colliding.map(packageName=>({packageName,assetClass:'Material'})),'Unused',{inPlace:true,classification:collisionPlan});assert.equal(collisionMoves[1].newName,'M_Check_12345678');
const assets=Array.from({length:59},(_,i)=>({id:'a'+i,group:'assets',original:'BP_资产'+i,kind:'蓝图资源',field:'Name',requiredPrefix:'BP_',context:{owner:'/Game/BP'+i,parentClass:'/Script/Engine.Actor'}}));
const members=Array.from({length:379},(_,i)=>({id:'m'+i,group:'members',original:'中文变量'+i,kind:'变量',field:'Name',valueType:'real'}));
const batches=planSemanticBatches([...assets,...members]);assert.equal(batches.length,1);assert.equal(batches[0].length,438);
const input=compactSemanticInput(batches[0]);assert.ok(input.entries.filter(r=>r.valueType).every(r=>!r.asset&&!r.parentClass));
assert.match(buildSemanticPrompt({entries:batches[0],direction:'zh-en'}),/Do not apply an asset definition or asset prefix to a member/);
const limited=planSemanticBatches([...assets,...members],{limits:{maxEntries:100}});assert.deepEqual(limited.map(b=>b.length),[100,100,100,100,38]);assert.equal(new Set(limited.flat().map(e=>e.id)).size,438);
assert.throws(()=>planSemanticBatches([{...members[0],original:'长文本'.repeat(2000)}],{limits:{maxOutputChars:200}}),/单条文本过大/);
console.log(JSON.stringify({actualModelRequests:0,checks:['one final rename plan preserves Blueprint subtree and compacts standalone UI shells','discarded directory shells never enter translation','map/build-data stay paired','missing or inconsistent asset types rejected','59 asset and 379 member entries fit one mixed request with separate semantic rules','large inputs still bounded without missing or duplicate ids']}));
