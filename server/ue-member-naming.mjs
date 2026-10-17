import {originalNameSuffix,preserveNameSuffix} from './translation-name-qualifiers.mjs';
export function normalizeMemberName(name,row,{direction='zh-en'}={}){
  if(row.preserveGeneratedCallback)return name;
  if(row.preserveOriginalEnglish)return row.original;
  if(row.field!=='Name'||row.native||direction!=='zh-en'||row.group==='assets')return name;
  let value=String(name||'').trim();if(!value||/[\u3400-\u9fff]/.test(value))return value;
  const suffix=originalNameSuffix(row.original),preserved=preserveNameSuffix(value,row.original),retainSuffix=suffix&&preserved.endsWith(suffix);
  if(retainSuffix)value=preserved.slice(0,-suffix.length);
  const boolean=row.valueType==='bool'&&(!row.container||row.container==='scalar');
  if(boolean)value=value.replace(/^(?:B_|Bool_|Boolean_|b(?=[A-Z]))/,'');
  value=value.replace(/^(?:Var_|Func_)/,'').split(/[^A-Za-z0-9]+/).filter(Boolean).map(word=>word[0].toUpperCase()+word.slice(1)).join('');
  if(boolean)value='b'+value;
  if(['事件','自定义事件','事件分发器'].includes(row.kind)&&!value.startsWith('On'))value='On'+value;
  return value+(retainSuffix?suffix:'');
}
export function enrichMemberRows(rows,scanned=[],options={}){const metadata=new Map(scanned.filter(r=>r.valueType).map(r=>[r.entryKey,r]));return rows.map(r=>{const meta=metadata.get(r.entryKey),row=meta?{...r,valueType:meta.valueType,subType:meta.subType,typeObject:meta.typeObject,container:meta.container}:({...r});return {...row,translated:row.translated?normalizeMemberName(row.translated,row,options):''};});}
