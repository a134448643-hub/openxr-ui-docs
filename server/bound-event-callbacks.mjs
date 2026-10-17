// Generated implementation names have no linguistic content to send to a model.
// The node GUID is stable across translation, asset moves and editor reloads.
export function boundEventCallbackName(row){
 if(row.kind!=='组件绑定回调'||row.field!=='Name')return null;
 const guid=String(row.nodeGuid||'').replaceAll('-','').toUpperCase();
 if(!/^[0-9A-F]{32}$/.test(guid)||/^0+$/.test(guid))throw Error('组件绑定回调缺少有效的事件 GUID');
 return 'BndEvt__Delivery_'+guid;
}
