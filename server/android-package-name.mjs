import path from 'node:path';

// Use the descriptor name, not the editable display name or its library suffix.
// Encode non-ASCII characters deterministically so Chinese-only names never
// collapse to the same fallback identifier.
export function automaticAndroidPackageName(descriptorPath){
  const stem=path.basename(descriptorPath,'.uproject').normalize('NFKC');
  let segment=Array.from(stem,c=>/[A-Za-z0-9_]/.test(c)?c.toLowerCase():c.codePointAt(0)>127?'_u'+c.codePointAt(0).toString(16):'_').join('').replace(/_+/g,'_');
  if(!/^[a-z]/.test(segment))segment='project_'+segment;
  if(segment.length>145)throw Error('工程名称过长，请在打包签名中关闭自动包名并填写较短包名');
  return 'com.xiaomeng.'+segment;
}
