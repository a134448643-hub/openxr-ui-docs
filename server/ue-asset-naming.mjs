import {preserveEnglishOriginal} from './translation-eligibility.mjs';
import {fixedFabDirectoryName} from './fab-layout-language.mjs';
import {originalNameSuffix,preserveNameSuffix} from './translation-name-qualifiers.mjs';
// UE 5.3 NameTypes.h: combine invalid object-name and long-package characters.
// Existing assets can contain hyphens or start with digits; generated names follow our stricter style.
export const validExistingUEAssetName=name=>typeof name==='string'&&name.length>0&&!/["' ,/.:|&!~\n\r\t@#(){}\[\]=;^%$`\\*?<>\x00-\x1f]/u.test(name);
// Epic asset recommendations, with conventional prefixes for common UE types.
const prefixes={Texture2D:'T_',TextureCube:'T_',Texture2DArray:'T_',TextureRenderTarget2D:'RT_',StaticMesh:'SM_',SkeletalMesh:'SK_',Material:'M_',MaterialInstanceConstant:'MI_',MaterialFunction:'MF_',PhysicsAsset:'PHYS_',PhysicalMaterial:'PM_',Skeleton:'SKEL_',AnimSequence:'AS_',AnimMontage:'AM_',BlendSpace:'BS_',BlendSpace1D:'BS_',AnimBlueprint:'ABP_',WidgetBlueprint:'WBP_',UserDefinedEnum:'E_',UserDefinedStruct:'F_',NiagaraSystem:'FXS_',NiagaraEmitter:'FXE_',LevelSequence:'LS_',DataTable:'DT_',CurveTable:'CT_',InputAction:'IA_',InputMappingContext:'IMC_',SoundWave:'A_',SoundCue:'SC_'};
const oldPrefixes=/^(?:(?:SKEL|PHYS|PAD|PDA|BPC|BPA|BPI|WBP|ABP|SKM|IMC|FXS|FXE|FXF|DT|CT|BP|AC|BI|SM|SK|MI|MF|PM|RT|DA|IA|AS|AM|BS|LS|SC|NS|NE|NPC|UMG|M|T|E|F|A)_)+/;
export function assetNameStem(name){return String(name||'').replace(oldPrefixes,'');}
export function prefixForAsset(asset,policy={}){if(['WidgetBlueprint','AnimBlueprint'].includes(asset?.assetClass))return prefixes[asset.assetClass];const rolePrefixes={blueprintInterface:policy.interfacePrefix||'BPI_',primaryDataAssetClass:policy.primaryDataAssetPrefix||'PAD_',dataAssetClass:policy.dataAssetPrefix||'DA_',primaryDataAssetInstance:policy.dataAssetPrefix||'DA_',dataAssetInstance:policy.dataAssetPrefix||'DA_',actorComponentClass:policy.componentPrefix||'AC_',blueprintClass:'BP_'};return rolePrefixes[asset?.assetRole]||asset?.recommendedPrefix||prefixes[asset?.assetClass]||'';}
export function normalizeAssetName(name,asset,policy={}){
 const prefix=prefixForAsset(asset,policy),cleaned=preserveNameSuffix(String(name||'').replace(/[^\p{L}\p{N}_]+/gu,'_').replace(/_+/g,'_').replace(/^_|_$/g,''),asset?.originalName);
 if(!prefix)return cleaned;
 let stem=assetNameStem(cleaned);const suffix=originalNameSuffix(asset?.originalName),retainSuffix=suffix&&stem.endsWith(suffix);
 if(retainSuffix)stem=stem.slice(0,-suffix.length);
 if(policy.nameStyle!=='descriptive'){stem=stem.replace(/Configuration/g,'Config');if(asset?.assetRole==='actorComponentClass')stem=stem.replace(/Component(?=_|$)/g,'').replace(/_+/g,'_').replace(/^_|_$/g,'');}
 if(retainSuffix)stem+=suffix;
 const originalSuffix=['PhysicsAsset','Physics','Skeleton'].find(suffix=>['PhysicsAsset','Skeleton'].includes(asset?.assetClass)&&String(asset?.originalName||'').endsWith('_'+suffix));
 if(originalSuffix){stem=stem.replace(/_(?:PhysicsAsset|Physics|Skeleton)$/,'');stem+='_'+originalSuffix;}
 return prefix+stem;
}
const labels={Texture2D:'纹理',StaticMesh:'静态网格体',SkeletalMesh:'骨骼网格体',Material:'材质',MaterialInstanceConstant:'材质实例',WidgetBlueprint:'控件蓝图',AnimBlueprint:'动画蓝图',World:'地图',ObjectRedirector:'重定向器'};
export function enrichAssetRows(rows,assets=[],policy={}){const byPath=new Map(assets.map(a=>[a.packageName,a]));return rows.map(row=>{const meta=byPath.get(row.owner);if(row.group!=='assets'||row.kind==='目录'||!meta)return {...row};const prefix=prefixForAsset(meta,policy);return {...row,assetClass:meta.assetClass,assetRole:meta.assetRole,parentClass:meta.parentClass,requiredPrefix:prefix,kind:meta.label||labels[meta.assetClass]||row.kind,translated:row.preserveOriginalEnglish?row.original:row.translated?normalizeAssetName(row.translated,{...meta,originalName:row.original},policy):'',prefixVerified:true};});}

export function makeAssetExportPlan(rows,assets,packName,{direction='zh-en',policy={},inPlace=false,classification}={}){
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(packName))throw Error('产品目录名需要英文字母、数字和下划线');
  const valid=direction==='en-zh'?/^[\p{L}_][\p{L}\p{N}_]*$/u:/^[A-Za-z_][A-Za-z0-9_]*$/;
  const dirMap=new Map(rows.filter(r=>r.kind==='目录').map(r=>[r.owner,fixedFabDirectoryName(r)||r.translated||r.original]));const moves=[];
  for(const asset of assets){if(asset.assetClass==='ObjectRedirector')continue;const row=rows.find(r=>r.group==='assets'&&r.kind!=='目录'&&r.owner===asset.packageName);if(!row)throw Error('资产缺少命名对照：'+asset.packageName);const preserved=preserveEnglishOriginal(row,direction),name=preserved?row.original:normalizeAssetName(row.translated||row.original,{...asset,originalName:row.original},policy);if(!(preserved?validExistingUEAssetName(name):valid.test(name)))throw Error('资产命名无效：'+name);
    const classified=classification?.mapping[asset.packageName];if(classification&&!classified)throw Error('资产缺少联合分类路径：'+asset.packageName);
    const collision=classification?.moves.find(m=>m.oldPath===asset.packageName&&m.collisionResolved);
    const parts=(classified||asset.packageName).slice('/Game/'.length).split('/');parts.pop();const translated=[];for(let i=0;i<parts.length;i++){const original='/Game/'+parts.slice(0,i+1).join('/'),part=fixedFabDirectoryName({group:'assets',kind:'目录',owner:original,original:parts[i]})||dirMap.get(original)||parts[i],preserved=part===parts[i]&&preserveEnglishOriginal({original:part},direction);if(!(preserved?validExistingUEAssetName(part):valid.test(part)))throw Error('目录尚未翻译：'+original);translated.push(part);}
    const suffix=collision?collision.newName.slice(row.original.length):'',finalName=name+suffix,folder=(inPlace?translated:[packName,...translated]).join('/'),newPackagePath='/Game'+(folder?'/'+folder:'');moves.push({oldPath:asset.packageName,newPath:newPackagePath+'/'+finalName,newPackagePath,newName:finalName,assetClass:asset.assetClass,requiredPrefix:prefixForAsset(asset,policy)});
  }
  // UE renames a world's lighting data together with its map. Keep the pair aligned.
  for(const move of moves.filter(m=>m.assetClass==='MapBuildDataRegistry')){const world=moves.find(m=>m.assetClass==='World'&&move.oldPath===m.oldPath+'_BuiltData');if(world){move.newName=world.newName+'_BuiltData';move.newPackagePath=world.newPackagePath;move.newPath=world.newPath+'_BuiltData';}}
  moves.sort((a,b)=>Number(b.assetClass==='World')-Number(a.assetClass==='World'));
  const seen=new Set();for(const move of moves){const key=move.newPath.toLowerCase();if(seen.has(key))throw Error('导出资产重名：'+move.newPath);seen.add(key);}return moves;
}
