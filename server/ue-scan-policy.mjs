// Keep this function self-contained: desktop and compatibility import reuse it.
export function excludedUEDirectoryReason(name){
  const lower=String(name).toLowerCase();
  if(['build','binaries','intermediate','saved','deriveddatacache','.git','.vs','.idea','.local','.ue-manager','.ue-translation-cache','node_modules'].includes(lower))return '构建、缓存或工具数据目录';
  if(['packaged','packagedbuilds','stagedbuilds','windowsnoeditor','windowsclient','linuxnoeditor'].includes(lower))return '打包输出目录';
  if(['test-fixtures','test_fixtures','__fixtures__'].includes(lower))return '测试样例目录';
  if(/备份|归档/.test(name)||/(?:^|[-_\s.()\[\]])(?:backups?|archives?)(?=$|[-_\s.()\[\]\d])/i.test(name))return '备份或归档目录';
  return '';
}
