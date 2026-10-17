const labels={Assets:'资产',Blueprints:'蓝图',Components:'组件',Interfaces:'接口',Widgets:'用户控件',Meshes:'模型',Skeletal:'骨骼网格体',Static:'静态网格体',Skeletons:'骨架',Materials:'材质',Textures:'纹理',Animations:'动画',Physics:'物理资产',DataAssets:'数据资产',DataTables:'数据表',Input:'输入',Effects:'特效',Enums:'枚举',Structs:'结构体',Fonts:'字体',Maps:'关卡',Audio:'音频',Curves:'曲线',Other:'其他',Shared:'共用',Demo:'演示'};
const inverse=Object.fromEntries(Object.entries(labels).map(([a,b])=>[b,a]));
const standardNames=new Map(Object.keys(labels).map(name=>[name.toLowerCase(),name]));
export const hasChinese=s=>/[\u3400-\u9fff]/u.test(s||'');
export const standardFabFolderName=name=>inverse[name]||standardNames.get(String(name).toLowerCase())||null;
export const canonicalFabFolder=s=>String(s).split('/').map(p=>standardFabFolderName(p)||p).join('/');
// Classification generates fixed English type names even for Chinese projects.
// Chinese aliases remain readable for projects organized by earlier versions.
export const localizeFabFolder=s=>canonicalFabFolder(s);
export function fixedFabDirectoryName(row){if(row.group!=='assets'||row.kind!=='目录'||!row.owner?.startsWith('/Game/'))return null;const parts=row.owner.slice(6).split('/');if(parts.length<2||parts.at(-1)!==row.original)return null;return standardFabFolderName(row.original);}
export const isDemoFolder=s=>canonicalFabFolder(s).toLowerCase()==='demo';
export function fabLayoutLanguage(assets,root,requested='auto'){if(!['auto','en','zh'].includes(requested))throw Error('分类目录语言无效');return 'en';}
export const validProjectFolder=s=>typeof s==='string'&&/^[\p{L}][\p{L}\p{N}_]{0,95}$/u.test(s)&&! /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(s);
