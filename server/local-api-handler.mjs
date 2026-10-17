import fs from 'node:fs/promises';
import path from 'node:path';
import { loadDocument, resolveAssetPath, saveDocument } from './project-document-store.mjs';
import { getGitHubAuthStatus, startGitHubLogin } from './github-auth.mjs';
import { publishDocumentation } from './publisher.mjs';
import {createUEProjectTools} from './ue-project-tools.mjs';
import {
  createProject,
  listProjects,
  openProject,
  readDevelopmentRecord,
  writeDevelopmentRecord,
} from './project-store.mjs';
import {
  archiveCurrentHandoff,
  createKnowledgeEntry,
  getKnowledgeWorkspace,
  saveKnowledgeItem,
} from './knowledge-store.mjs';

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readRequestBody(request, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export function createLocalApiHandler({ tools = createUEProjectTools() } = {}) {
  const ueTools = tools;
  // These operate on the headset or a user-picked local file, not UE project contents.
  const independentActions=new Set(['devices','apk-info','install-apk','pick']);
  return async (request, response, next = () => {}) => {
        const requestUrl = new URL(request.url, 'http://127.0.0.1');
        const projectId = requestUrl.searchParams.get('project') || undefined;
        // The standalone project manager only needs the registry and project creation.
        const managerOrigins = new Set(['http://127.0.0.1:8771', 'http://localhost:8771']);
        if (managerOrigins.has(request.headers.origin) && (['/api/workspace', '/api/projects'].includes(requestUrl.pathname) || requestUrl.pathname.startsWith('/api/ue/'))) {
          response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
          response.setHeader('Vary', 'Origin');
          response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          if (request.method === 'OPTIONS') { response.statusCode = 204; response.end(); return; }
        }
        try {
          if(requestUrl.pathname.startsWith('/api/ue/')) {
            const origin=request.headers.origin;
            if(request.method==='POST' && origin && !managerOrigins.has(origin) && origin!==`http://${request.headers.host}`) return sendJson(response,403,{error:'不允许从其他页面操作本机工程'});
            const action=requestUrl.pathname.slice('/api/ue/'.length);
            const body=request.method==='POST'?JSON.parse(await readRequestBody(request)):{};
            const id=body.id||requestUrl.searchParams.get('id');
            if(request.method==='POST'&&!action.startsWith('vr/')&&!independentActions.has(action)&&ueTools.packageIdentity?.busy())throw Error('正在保存应用资料或签名，请稍后再操作工程');
            if(request.method==='POST'&&!action.startsWith('vr/')&&!independentActions.has(action)&&ueTools.workflow?.runningJobs().length&&!['delivery/one-click-pause','delivery/pause-translation','refresh-projects','register'].includes(action))throw Error('一键处理正在运行，请先暂停或等待完成再操作工程');
            if(action==='thumbnail'&&request.method==='GET'){const result=await ueTools.thumbnail(id);response.statusCode=200;response.setHeader('Content-Type',CONTENT_TYPES[path.extname(result.file).toLowerCase()]||'image/png');response.setHeader('Cache-Control','no-store');response.end(result.buffer);return;}
            if(action==='plugin-thumbnail'&&request.method==='GET'){const result=await ueTools.pluginThumbnail(id);response.statusCode=200;response.setHeader('Content-Type',CONTENT_TYPES[path.extname(result.file).toLowerCase()]||'image/png');response.setHeader('Cache-Control','no-store');response.end(result.buffer);return;}
            let result;
            if(request.method==='GET'&&action==='delivery/one-click-status')result=await ueTools.workflow.latest();
            else if(request.method==='GET'&&action==='delivery/one-click-job')result=await ueTools.workflow.job(requestUrl.searchParams.get('jobId'));
            else if(request.method==='POST'&&action==='delivery/one-click')result=await ueTools.workflow.start(body);
            else if(request.method==='POST'&&action==='delivery/one-click-resume')result=await ueTools.workflow.resume(body.jobId);
            else if(request.method==='POST'&&action==='delivery/one-click-pause')result=await ueTools.workflow.pause(body.jobId);
            else if(request.method==='POST'&&action==='refresh-projects')result=await ueTools.refreshProjects(body);
            else if(request.method==='GET'&&action==='delivery/cache-records')result=await ueTools.delivery.cacheRecords();
            else if(request.method==='GET'&&action==='delivery/generated-projects')result=await ueTools.delivery.generatedProjects();
            else if(request.method==='GET'&&action==='delivery/status')result=await ueTools.delivery.status();
            else if(request.method==='GET'&&action==='delivery/translation-settings')result=await ueTools.delivery.settings();
            else if(request.method==='POST'&&action==='delivery/translation-settings')result=await ueTools.delivery.settings(body);
            else if(request.method==='POST'&&action==='delivery/external-task')result=await ueTools.delivery.externalTask(body);
            else if(request.method==='POST'&&action==='delivery/import-external')result=await ueTools.delivery.importExternal(body);
            else if(request.method==='GET'&&action==='delivery/glossary')result=await ueTools.delivery.glossary();
            else if(request.method==='POST'&&action==='delivery/glossary')result=await ueTools.delivery.glossary(body.naming?body:body.terms);
            else if(request.method==='GET'&&action==='delivery/project-open-targets')result=await ueTools.delivery.projectOpenTargets(requestUrl.searchParams.get('descriptorPath'));
            else if(request.method==='POST'&&action==='delivery/bind-language-project')result=await ueTools.delivery.bindLanguageProject(body);
            else if(request.method==='POST'&&action==='delivery/open-language-project')result=await ueTools.delivery.openLanguageProject(body);
            else if(request.method==='GET'&&action==='delivery/translation-status')result=await ueTools.delivery.translationStatus();
            else if(request.method==='POST'&&action==='delivery/clear-translation-cache'){if((ueTools.projectRunningJobs?ueTools.projectRunningJobs():ueTools.runningJobs()).length)throw Error('有工程任务正在运行，请结束或暂停后清理缓存');result=await ueTools.delivery.clearTranslationCache();}
            else if(request.method==='POST'&&action==='delivery/pause-translation')result=await ueTools.delivery.pauseTranslation(body.jobId);
            else if(request.method==='POST'&&action==='delivery/resume-translation')result=await ueTools.delivery.resumeTranslation(body.jobId,body);
            else if(request.method==='POST'&&action==='delivery/processing-preflight'){const checked=await ueTools.delivery.processingPreflight(body);result=checked.confirmationRequired?checked:{ready:true,sourceAuthorization:checked.sourceAuthorization,resume:checked.resume?{applicationId:checked.resume.applicationId,jobId:checked.resume.jobId}:null};}
            else if(request.method==='POST'&&action==='delivery/apply-translation')result=await ueTools.delivery.applyTranslation(body);
            else if(request.method==='POST'&&action==='delivery/translate')result=await ueTools.delivery.startTranslation(body);
            else if(request.method==='POST'&&action==='delivery/preview-version-projects')result=await ueTools.delivery.previewVersionProjects(body);
            else if(request.method==='POST'&&action==='delivery/create-version-projects')result=await ueTools.delivery.createVersionProjects(body.planId);
            else if(request.method==='POST'&&action==='delivery/preview-export')result=await ueTools.delivery.previewExport(body);
            else if(request.method==='POST'&&action==='delivery/export')result=await ueTools.delivery.createExport(body.planId);
            else if(request.method==='GET'&&action==='delivery/engines')result=await ueTools.delivery.engines();
            else if(request.method==='GET'&&action==='delivery/job')result=await ueTools.delivery.job(requestUrl.searchParams.get('jobId'));
            else if(request.method==='POST'&&action==='delivery/configure')result=await ueTools.delivery.configure(body.path);
            else if(request.method==='POST'&&action==='delivery/inspect')result=await ueTools.delivery.inspect();
            else if(request.method==='POST'&&action==='delivery/preview-copy')result=await ueTools.delivery.previewCopy(body);
            else if(request.method==='POST'&&action==='delivery/create-copy')result=await ueTools.delivery.createCopy(body.planId);
            else if(request.method==='POST'&&action==='delivery/refresh-copy')result=await ueTools.delivery.refreshCopy();
            else if(request.method==='POST'&&action==='delivery/scan-members')result=await ueTools.delivery.scanMembers(body.jobId,{auditOnly:body.auditOnly===true});
            else if(request.method==='GET'&&action==='fab/job')result=await ueTools.fab.job(requestUrl.searchParams.get('jobId'));
            else if(request.method==='POST'&&action==='fab/preview')result=await ueTools.fab.beginPreview(body);
            else if(request.method==='POST'&&action==='fab/apply')result=await ueTools.fab.apply(body);
            else if(request.method==='POST'&&action==='fab/open')result=await ueTools.fab.open(body.jobId);
            else if(request.method==='POST'&&action==='fab/inspect')result=await ueTools.fabInspect(body.path);
            else if(request.method==='POST'&&action==='delivery/fab-checks')result=await ueTools.delivery.fabChecks(body.jobId);
            else if(request.method==='GET'&&action==='status')result={connected:true,nativeProjects:true,configuration:true};
            else if(request.method==='GET'&&action==='disk-usage')result=await ueTools.diskUsage(id);
            else if(request.method==='GET'&&action==='presets')result={items:await ueTools.presets()};
            else if(request.method==='GET'&&action==='settings')result=await ueTools.settings(id,requestUrl.searchParams.get('platform')||'android');
            else if(request.method==='POST'&&action==='android/start')result=await ueTools.androidPackaging.start(body);
            else if(request.method==='POST'&&action==='android/identity')result=await ueTools.packageIdentity.save(id,body);
            else if(request.method==='POST'&&action==='android/generate-signing')result=await ueTools.packageIdentity.generate(id,body);
            else if(request.method==='GET'&&action==='android/job')result=await ueTools.androidPackaging.job(requestUrl.searchParams.get('jobId'));
            else if(request.method==='POST'&&action==='android/open')result=await ueTools.androidPackaging.open(body.jobId);
            else if(request.method==='GET'&&action==='inspect')result=await ueTools.inspect(id);
            else if(request.method==='GET'&&action==='job')result=ueTools.job(requestUrl.searchParams.get('jobId'));
            else if(request.method==='POST'&&action==='pick')result={path:await ueTools.pick(body.kind)};
            else if(request.method==='POST'&&action==='register')result=await ueTools.register(body.path);
            else if(request.method==='POST'&&action==='scan')result=await ueTools.scan(body.path);
            else if(request.method==='POST'&&action==='classify')result=await ueTools.classify(body.path);
            else if(request.method==='POST'&&action==='scan-plugins')result=await ueTools.scanPlugins(body.path);
            else if(request.method==='POST'&&action==='inspect-plugin')result=await ueTools.inspectPlugin(body.path);
            else if(request.method==='POST'&&action==='open-plugin-folder')result=await ueTools.openPluginFolder(body.id);
            else if(request.method==='POST'&&action==='launch')result=await ueTools.launch(id,body.entry);
            else if(request.method==='POST'&&action==='generate-solution')result=await ueTools.generateSolution(id);
            else if(request.method==='POST'&&action==='preview')result=await ueTools.preview(id,body.operation);
            else if(request.method==='POST'&&action==='apply')result=await ueTools.apply(id,body.planId);
            else if(request.method==='POST'&&action==='preset/save')result=await ueTools.savePreset(body);
            else if(request.method==='POST'&&action==='preset/import')result=await ueTools.importPreset(body.path,body.group);
            else if(request.method==='POST'&&action==='preset/delete')result=await ueTools.deletePreset(body.presetId);
            else if(request.method==='POST'&&action==='preset/order')result=await ueTools.reorderPresets(body);
            else if(request.method==='POST'&&action==='detect-sdk')result=await ueTools.detectSdk(id);
            else if(request.method==='POST'&&action==='mcp-status')result=await ueTools.mcpStatus(id);
            else if(request.method==='POST'&&action.startsWith('vr/'))result=await ueTools.vr.handle(action.slice(3),id,body);
            else if(request.method==='POST'&&action==='devices')result={items:await ueTools.devices(id)};
            else if(request.method==='POST'&&action==='apk-info')result=await ueTools.apkInfo(body.file);
            else if(request.method==='POST'&&action==='install-apk')result=await ueTools.installApk(id,body);
            else if(request.method==='POST'&&action==='generate-keystore')result=await ueTools.generateKeystore(id,body.values);
            else return sendJson(response,404,{error:'未知工程操作'});
            return sendJson(response,200,result);
          }
          if (requestUrl.pathname === '/api/workspace' && request.method === 'GET') {
            const workspace = await listProjects();
            return sendJson(response, 200, workspace);
          }

          if (requestUrl.pathname === '/api/projects' && request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request));
            const workspace = await createProject(body);
            return sendJson(response, 201, workspace);
          }

          if (requestUrl.pathname === '/api/projects/open' && request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request));
            const workspace = await openProject(body.id);
            return sendJson(response, 200, workspace);
          }

          if (requestUrl.pathname === '/api/development' && request.method === 'GET') {
            const record = await readDevelopmentRecord(projectId);
            return sendJson(response, 200, record);
          }

          if (requestUrl.pathname === '/api/development' && request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request));
            const record = await writeDevelopmentRecord(body.content, projectId);
            return sendJson(response, 200, record);
          }

          if (requestUrl.pathname === '/api/knowledge' && request.method === 'GET') {
            const workspace = await getKnowledgeWorkspace(projectId);
            return sendJson(response, 200, workspace);
          }

          if (requestUrl.pathname === '/api/knowledge/item' && request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request));
            const item = await saveKnowledgeItem(body, projectId);
            return sendJson(response, 200, item);
          }

          if (requestUrl.pathname === '/api/knowledge/entries' && request.method === 'POST') {
            const body = JSON.parse(await readRequestBody(request));
            const result = await createKnowledgeEntry(body, projectId);
            return sendJson(response, 201, result);
          }

          if (requestUrl.pathname === '/api/knowledge/handoff/archive' && request.method === 'POST') {
            const result = await archiveCurrentHandoff(projectId);
            return sendJson(response, 200, result);
          }

          if (requestUrl.pathname === '/api/document' && request.method === 'GET') {
            const document = await loadDocument(projectId);
            if (!document) return sendJson(response, 404, { error: 'Document project is not initialized.' });
            return sendJson(response, 200, document);
          }

          if (requestUrl.pathname === '/api/document' && request.method === 'POST') {
            const body = await readRequestBody(request);
            const saved = await saveDocument(JSON.parse(body), projectId);
            return sendJson(response, 200, { document: saved, savedAt: new Date().toISOString() });
          }

          if (requestUrl.pathname === '/api/publish' && request.method === 'POST') {
            const result = await publishDocumentation({ push: true, projectId });
            return sendJson(response, 200, result);
          }

          if (requestUrl.pathname === '/api/github/status' && request.method === 'GET') {
            const status = await getGitHubAuthStatus();
            return sendJson(response, 200, status);
          }

          if (requestUrl.pathname === '/api/github/login' && request.method === 'POST') {
            const result = startGitHubLogin();
            return sendJson(response, 202, result);
          }

          if (requestUrl.pathname.startsWith('/docs-assets/') && request.method === 'GET') {
            const fileName = requestUrl.pathname.slice('/docs-assets/'.length);
            const assetPath = await resolveAssetPath(fileName, projectId);
            const contents = await fs.readFile(assetPath);
            response.statusCode = 200;
            response.setHeader('Content-Type', CONTENT_TYPES[path.extname(assetPath).toLowerCase()] || 'application/octet-stream');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(contents);
            return;
          }
        } catch (error) {
          return sendJson(response, 500, { error: error.message || String(error), code:error.code });
        }
        next();

  };
}
