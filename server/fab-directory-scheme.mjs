import {canonicalFabFolder} from './fab-layout-language.mjs';
// Learned from the user's directory-only edits. Keep named models and functional
// groups; discard storage wrappers rather than translating or renaming assets.
const wrappers=new Set(['Assets','资产']);
// Preserve the complete user-owned Blueprint subtree, including support assets.
export function sourceBlueprintDirectory(asset,root,origin=asset.path){
 const parts=origin.slice(6).split('/').slice(0,-1),index=parts.findIndex(p=>canonicalFabFolder(p)==='Blueprints');
 if(index<0||parts.some(p=>canonicalFabFolder(p)==='Demo'))return null;
 const outer=parts.slice(0,index).map(canonicalFabFolder),assetsIndex=outer.indexOf('Assets');if(outer.includes('Meshes')||assetsIndex>=0&&index>assetsIndex+1)return null;
 return ['/Game',root,'Blueprints',...parts.slice(index+1)].join('/');
}
export function compactFabDirectory(folder,{root,language='en',preserveBlueprint=true}={}){
 const prefix='/Game/'+root+'/',relative=folder.startsWith(prefix)?folder.slice(prefix.length):null;if(relative===null)return folder;
 const sourceParts=relative.split('/').filter(Boolean);if(preserveBlueprint&&canonicalFabFolder(sourceParts[0])==='Blueprints')return prefix+['Blueprints',...sourceParts.slice(1)].join('/');
 let parts=sourceParts.filter(p=>!wrappers.has(p)),canon=()=>parts.map(canonicalFabFolder);
 if(canon()[0]==='Widgets')parts=parts.filter((p,i)=>i===0||!['Widgets','UI','UMG'].includes(canonicalFabFolder(p)));
 let c=canon();
 c=canon();if(c[0]==='Blueprints'&&c[1]==='Interfaces'&&c[2]==='UI'&&['BPI接口','BPIInterfaces','Interfaces','接口'].includes(parts[3]))parts.splice(2,2);
 // The project uses component blueprints directly within named functional groups.
 c=canon();if(c[0]==='Blueprints'&&parts.length>2&&c[1]!=='Components'&&c.at(-1)==='Components')parts.pop();
 parts=parts.filter((p,i)=>!(['材质纹理','样条线素材'].includes(p)&&i>0&&['Materials','Textures','Widgets'].includes(canonicalFabFolder(parts[i-1]))));
 c=canon();const modelIndex=c.indexOf('Meshes');if(modelIndex>0&&c[0]==='Blueprints'&&['Skeletal','Static'].includes(c[modelIndex+1]))parts.splice(modelIndex+1,1);
 // A mixed support folder needs one type directory, not a second wrapper below it.
 parts=parts.filter((p,i)=>p!=='样条线素材'||i===0||canonicalFabFolder(parts[i-1])!=='Meshes');
 parts=parts.filter((p,i)=>i===0||canonicalFabFolder(p)!=='Skeletons'||canonicalFabFolder(parts[i-1])!=='Skeletons');
 return prefix+parts.map(canonicalFabFolder).join('/');
}
export function existingFabGroupFolder(asset,root){
 const prefix='/Game/'+root+'/';if(!asset.path.startsWith(prefix))return null;const parts=asset.path.slice(prefix.length).split('/').slice(0,-1),c=parts.map(canonicalFabFolder),category=asset.category,cls=asset.class?.split('.').pop();
 if(c[0]==='Blueprints')return '/Game/'+root+'/'+parts.join('/');
 if(c[0]==='Widgets'&&['Widgets','Materials','Textures','Fonts'].includes(category))return '/Game/'+root+'/'+parts.join('/');
 if(c[0]==='Meshes'&&['Skeletal','Static'].includes(c[1])){if(cls==='Skeleton'&&c[1]==='Static')return null;if(category.startsWith('Meshes')||['Materials','Textures','Physics','Curves','Animations'].includes(category))return '/Game/'+root+'/'+parts.join('/');}
 return null;
}
