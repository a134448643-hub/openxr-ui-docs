// Editor names/metadata can change; Map keys and values are never translated.
const memberKey=row=>JSON.stringify([row.owner,row.kind,row.elementName||row.original,row.graphName||'']);
export function protectFunctionalMaps(rows,scanned=[]){
 const members=new Set([...scanned,...rows].filter(r=>r.group!=='assets'&&r.container==='map').map(memberKey));
 return rows.map(row=>{
  if(row.group==='assets'||!(row.container==='map'||members.has(memberKey(row))))return row;
  const metadata=!row.native&&['变量','局部变量','输入参数','输出参数','事件分发器'].includes(row.kind)&&['Name','Category','Tooltip','DisplayName'].includes(row.field);
  if(!metadata)return {...row,translated:row.original,preserveFunctionalMap:true,translationSkipped:'functional-map',namingReason:'映射表内部数据保持原样',needsSemanticReview:false,namingWarnings:[],approved:false};
  const legacy=row.preserveFunctionalMap||row.translationSkipped==='functional-map'||row.namingReason==='映射表按原样保留';
  return {...row,container:'map',preserveFunctionalMap:false,preserveMapContents:true,translationSkipped:row.preserveOriginalEnglish?'already-english':undefined,...(legacy?{translated:row.preserveOriginalEnglish?row.original:'',needsSemanticReview:false,namingReason:undefined}:{})};
 });
}
