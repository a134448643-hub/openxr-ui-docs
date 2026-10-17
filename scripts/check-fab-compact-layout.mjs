import assert from 'node:assert/strict';
import {planFabMoves} from '../server/fab-classification.mjs';
const asset=(folder,name,category,cls,dependencies=[])=>({path:'/Game/VRUI/'+folder+'/'+name,name,category,class:'/Script/Engine.'+cls,dependencies});
const assets=[asset('UI/UIButtons','BP_Button','Blueprints','Blueprint'),asset('UI/UIButtons','M_Button','Materials','Material'),asset('UI/UIButtons','T_Button','Textures','Texture2D'),asset('Assets/Hands/Cartoon','SK_Hand','Meshes/Skeletal','SkeletalMesh'),asset('Assets/Hands/Cartoon','M_Hand','Materials','Material'),asset('Assets/Hands/Cartoon','SKEL_Hand','Animations','Skeleton'),asset('Assets/Hands/Realistic','SK_Hand','Meshes/Skeletal','SkeletalMesh'),asset('Assets/Hands/Shared','SKEL_Shared','Animations','Skeleton'),asset('Demo/VRTemplate','DemoMap','Maps','World',['/Game/VRUI/Demo/VRTemplate/DemoMap_BuiltData']),asset('Demo/VRTemplate','DemoMap_BuiltData','Maps','MapBuildDataRegistry')];
const p=planFabMoves({assets,root:'Pack',modules:{VRUI:'VRUI'}});
assert.equal(p.mapping[assets[0].path],'/Game/Pack/Blueprints/UIButtons/BP_Button');
assert.equal(p.mapping[assets[1].path],'/Game/Pack/Blueprints/UIButtons/Materials/M_Button');
assert.equal(p.mapping[assets[2].path],'/Game/Pack/Blueprints/UIButtons/Textures/T_Button');
assert.equal(p.mapping[assets[3].path],'/Game/Pack/Meshes/Skeletal/Hands/Cartoon/SK_Hand');
assert.equal(p.mapping[assets[4].path],'/Game/Pack/Meshes/Skeletal/Hands/Cartoon/Materials/M_Hand');
assert.equal(p.mapping[assets[5].path],'/Game/Pack/Meshes/Skeletal/Hands/Cartoon/Skeletons/SKEL_Hand');
assert.equal(p.mapping[assets[7].path],'/Game/Pack/Meshes/Skeletal/Skeletons/Hands/Shared/SKEL_Shared');
assert.equal(p.mapping[assets[8].path],'/Game/Pack/Demo/VRTemplate/DemoMap');
assert.equal(p.mapping[assets[9].path],p.mapping[assets[8].path]+'_BuiltData');
assert.ok(Object.values(p.mapping).every(s=>!s.includes('/VRUI/')));
assert.deepEqual(p,planFabMoves({assets:assets.toReversed(),root:'Pack',modules:{VRUI:'VRUI'}}));
// Several independent modules retain their identity. Direct parent assets keep
// their folder; children with self-contained names need no repeated parent.
const diverse=[...assets,asset('UI','BP_Root','Blueprints','Blueprint'),asset('UI/UIPanels','BP_Panel','Blueprints','Blueprint'),{...assets[0],path:'/Game/PhysicsUI/BP_Other',name:'BP_Other'}];
const d=planFabMoves({assets:diverse,root:'Pack',modules:{VRUI:'VRUI',PhysicsUI:'PhysicsUI'}});assert.ok(d.mapping[assets[0].path].includes('/VRUI/UIButtons/'));assert.ok(d.mapping[diverse.at(-3).path].includes('/VRUI/UI/'));
const cachedTypeRoot={...assets[0],path:'/Game/Pack/Blueprints/VRUI/OpenXRGestures/DA_Config',name:'DA_Config',category:'DataAssets',class:'/Script/Engine.DataAsset'};const mixed=planFabMoves({assets:[...assets,cachedTypeRoot],root:'Pack',modules:{VRUI:'VRUI'}});assert.equal(mixed.mapping[cachedTypeRoot.path],'/Game/Pack/Blueprints/VRUI/OpenXRGestures/DA_Config');
const organized=assets.map(a=>({...a,path:p.mapping[a.path],dependencies:a.dependencies.map(x=>p.mapping[x]||x)}));
const origins=Object.fromEntries(assets.map(a=>[p.mapping[a.path],a.path]));
assert.equal(planFabMoves({assets:organized,root:'Pack',origins,modules:{VRUI:'VRUI'}}).moves.length,0);
assert.equal(planFabMoves({assets:organized,root:'Pack'}).moves.length,0,'Already grouped resources stay stable without history');
console.log('Compact paths, typed resource-group children, true Skeleton routing, Demo/map pair relocation and idempotence passed.');
