const terminal=new Set(['completed','failed','partial','paused','interrupted','obsolete']);
export function recordTaskStage(task,now=Date.now()){
 now=Math.max(now,Date.parse(task.monitor?.updatedAt)||0);
 const phase=task.phase||'准备处理',status=task.status||'running';
 if(!task.monitor){task.monitor={schemaVersion:1,startedAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),activeMs:0,stages:[]};}
 const monitor=task.monitor,last=monitor.stages.at(-1),previousTime=Date.parse(monitor.updatedAt);
 if(last&&!last.endedAt&&Number.isFinite(previousTime)){const delta=Math.max(0,now-previousTime);last.durationMs+=delta;monitor.activeMs+=delta;}
 if(!last||last.phase!==phase||last.status!==status){if(last&&!last.endedAt)last.endedAt=new Date(now).toISOString();monitor.stages.push({phase,status,startedAt:new Date(now).toISOString(),durationMs:0,...(terminal.has(status)?{endedAt:new Date(now).toISOString()}: {})});}
 else if(terminal.has(status)&&!last.endedAt)last.endedAt=new Date(now).toISOString();
 monitor.updatedAt=new Date(now).toISOString();return monitor;
}
