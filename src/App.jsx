import React, { useState, useRef, useEffect } from 'react';
import { readProjectLink, projectApiUrl } from './project-links.js';
import { RichDocumentEditor } from './rich-document-editor.jsx';
import { DocumentSettings } from './document-settings.jsx';
import { 
  BookOpen, Image as ImageIcon, ChevronRight, ChevronLeft, Plus, 
  Trash2, Edit3, GripVertical, Type as TypeIcon, Move, 
  Check, X, Languages, Loader2, Copy, Sticker, MousePointer2, 
  FileText, Pencil, Eye, UploadCloud, Bold, Underline, Heading, 
  Anchor, ClipboardCopy, FileCode, AlertTriangle, Palette,
  Maximize2, Minimize2, MoreHorizontal, Save, LogIn, FolderOpen,
  FolderPlus, LockKeyhole, Printer, Share2, Home, ExternalLink
} from 'lucide-react';

// --- 1. Constants & Dictionaries ---
const UI_TEXT = {
  previewMode: { zh: '预览模式', en: 'Preview' },
  editMode: { zh: '编辑模式', en: 'Edit' },
  aiTranslate: { zh: 'AI 全文翻译', en: 'Translate All' },
  translating: { zh: '翻译中...', en: 'Translating...' },
  exportHtml: { zh: '导出 HTML', en: 'Export HTML' },
  printPdf: { zh: '打印 / PDF', en: 'Print / PDF' },
  copyShare: { zh: '复制分享链接', en: 'Copy Share Link' },
  shareCopied: { zh: '分享链接已复制', en: 'Share link copied' },
  shareUnavailable: { zh: '当前项目还没有分享链接', en: 'This project has no share link yet' },
  projectHome: { zh: '项目主页', en: 'Projects' },
  publicDocs: { zh: '使用文档', en: 'Documentation' },
  development: { zh: '项目资料', en: 'Project Records' },
  commonRules: { zh: '通用规则', en: 'Common Rules' },
  localOnly: { zh: '仅本机可见', en: 'Local only' },
  devSaved: { zh: '项目资料已保存', en: 'Project records saved' },
  devSaving: { zh: '项目资料保存中...', en: 'Saving project records...' },
  createProject: { zh: '新建项目', en: 'New Project' },
  openProject: { zh: '打开项目', en: 'Open Project' },
  publish: { zh: '发布', en: 'Publish' },
  publishing: { zh: '发布中...', en: 'Publishing...' },
  githubLogin: { zh: '登录 GitHub', en: 'Sign in to GitHub' },
  githubConnecting: { zh: '等待 GitHub 登录...', en: 'Waiting for GitHub...' },
  githubLoginStarted: { zh: '已打开 GitHub 登录授权，请在浏览器完成', en: 'GitHub sign-in opened in your browser' },
  githubConnected: { zh: 'GitHub 已连接', en: 'GitHub connected' },
  githubUnavailable: { zh: 'GitHub 登录不可用', en: 'GitHub sign-in unavailable' },
  saved: { zh: '已保存', en: 'Saved' },
  saving: { zh: '保存中...', en: 'Saving...' },
  loading: { zh: '载入中...', en: 'Loading...' },
  saveError: { zh: '保存失败', en: 'Save failed' },
  newPage: { zh: '新建页面', en: 'New Page' },
  langLabel: { zh: '界面语言 / Language', en: 'Interface Language' },
  docTitlePlaceholder: { zh: '输入文档标题...', en: 'Document Title...' },
  pageTitlePlaceholderZh: { zh: '中文标题', en: 'Title (ZH)' },
  pageTitlePlaceholderEn: { zh: '英文标题', en: 'Title (EN)' },
  body: { zh: '正文', en: 'BODY' },
  float: { zh: '悬浮', en: 'FLOAT' },
  inputZh: { zh: '输入中文内容...', en: 'Input Chinese content...' },
  inputEn: { zh: '输入英文翻译...', en: 'Input English translation...' },
  clickToUpload: { zh: '点击上传或拖入图片', en: 'Click or Drop to Upload' },
  copySuccess: { zh: '已复制！', en: 'Copied!' },
  translateSuccess: { zh: '翻译完成', en: 'Translation Completed' },
  importSuccess: { zh: '导入成功', en: 'Import Successful' },
  fileError: { zh: '文件格式错误', en: 'File Format Error' },
  deletePageConfirm: { zh: '确定删除此页面吗？', en: 'Delete this page?' },
  pageDeleted: { zh: '页面已删除', en: 'Page Deleted' },
  keepOnePage: { zh: '至少保留一个页面', en: 'Keep at least one page' },
  generatedHtml: { zh: '已生成只读 HTML 文件！', en: 'Read-only HTML generated!' },
  zhLabel: { zh: '中文', en: 'ZH' },
  enLabel: { zh: '英文', en: 'EN' },
  insertText: { zh: '插入文本', en: 'Insert Text' },
  insertImage: { zh: '插入图片', en: 'Insert Image' },
  anchorHere: { zh: '在此处添加', en: 'Insert here' },
  pasteFloat: { zh: '粘贴悬浮', en: 'Paste Float' },
  addFollowNote: { zh: '添加悬浮框文本', en: 'Add Float Text' },
  addFollowLayer: { zh: '添加悬浮框图片', en: 'Add Float Image' },
  pageTranslateTip: { zh: '翻译标题', en: 'Translate Title' },
};

const IS_PUBLISHED = import.meta.env.MODE === 'published';
const IS_DESKTOP_EMBEDDED = !IS_PUBLISHED && new URLSearchParams(window.location.search).get('embedded') === '1';

const getUi = (key, lang) => {
  const uiLang = lang === 'en' ? 'en' : 'zh';
  return UI_TEXT[key] ? UI_TEXT[key][uiLang] : key;
};

const INITIAL_DATA = {
  sidebarTitle: "UE Docs Pro",
  docTitle: "UE5 Plugin Documentation",
  pages: [
    { id: 'p1', title: { zh: '1. 快速开始', en: '1. Quick Start' } },
  ],
  content: {
    'p1': {
      blocks: [
        { 
          id: 'b1', type: 'text', isFloating: false,
          style: { size: 'text-base', weight: 'font-normal', color: '#374151', decoration: 'none', isSectionHeader: false },
          data: { zh: '欢迎使用文档工具。点击正文可编辑，右侧工具栏可插入内容。', en: 'Welcome. Click to edit, use right toolbar to insert content.' },
          attachments: [] 
        }
      ]
    }
  }
};

// --- 2. Helper Components ---

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 2000); return () => clearTimeout(timer); }, [onClose]);
  const bgClass = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10000] ${bgClass} text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 print:hidden`}>
      {type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200 print:hidden">
    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-medium">取消</button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium">确认</button>
      </div>
    </div>
  </div>
);

const NewRecordModal = ({ onConfirm, onCancel }) => {
  const [collection, setCollection] = useState('decisions');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const labels = { decisions: '决策记录', issues: '异常与解决', changes: '变更记录' };

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await onConfirm({ collection, title: title.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4 print:hidden">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900">新建独立记录</h3>
        <p className="text-sm text-gray-500 mt-1">一个决定、异常或阶段变更对应一个文件。</p>
        <label className="block text-sm font-bold text-gray-700 mt-5">记录类型</label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {Object.entries(labels).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setCollection(value)} className={`px-3 py-2 rounded-lg border text-xs font-bold ${collection === value ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
        <label className="block text-sm font-bold text-gray-700 mt-5">标题</label>
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="例如：旋转插槽磁吸后缩放异常" />
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold">取消</button>
          <button disabled={busy || !title.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-bold">{busy ? '创建中...' : '创建记录'}</button>
        </div>
      </form>
    </div>
  );
};

const ImagePreviewModal = ({ src, onClose }) => {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-8 cursor-zoom-out animate-in fade-in duration-200 print:hidden" onClick={onClose}>
      <div className="relative max-w-full max-h-full">
        <img src={src} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="Preview" />
        <button className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-black/50 rounded-full p-2"><X size={24}/></button>
      </div>
    </div>
  );
};

const ContextMenu = ({ x, y, onClose, onAdd, targetBlockId, clipboard, onPaste, lang }) => {
  const menuRef = useRef(null);
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, innerHeight - rect.height - 8))}px`;
    menu.querySelector('button')?.focus();
  }, [x, y]);
  return (
    <div ref={menuRef} role="menu" aria-label="文档右键菜单" className="doc-context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const items = [...event.currentTarget.querySelectorAll('button')]; const index = items.indexOf(document.activeElement); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    }}>
      {targetBlockId ? (
        <>
          <div className="px-3 py-1 text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1"><Anchor size={12}/> {getUi('anchorHere', lang)}</div>
          {clipboard?.type === 'text' && <button onClick={() => { onPaste(targetBlockId); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-green-700 flex items-center gap-2 border-b border-gray-100 font-bold"><ClipboardCopy size={16}/> {getUi('pasteFloat', lang)}</button>}
          <button onClick={() => { onAdd('text', true, null, targetBlockId); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"><Sticker size={16} className="text-blue-600"/> {getUi('addFollowNote', lang)}</button>
        </>
      ) : (
        <>
          <div className="px-3 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">{getUi('insertText', lang)}</div>
          <button onClick={() => { onAdd('text', false); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"><FileText size={16}/> {getUi('insertText', lang)}</button>
          <button onClick={() => { onAdd('image', false); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"><ImageIcon size={16}/> {getUi('insertImage', lang)}</button>
        </>
      )}
    </div>
  );
};

const ProjectHub = ({ workspace, onOpen, onCreate, loadError }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate({ name, id });
    } catch (createError) {
      setError(createError.message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-300 text-sm font-bold mb-3"><BookOpen size={18}/> Local Documentation Studio</div>
            <h1 className="text-4xl font-black tracking-tight">项目文档工作区</h1>
            <p className="text-slate-400 mt-3 max-w-2xl">公开使用文档可以发布到 GitHub Pages；项目规则、当前快照、独立记录和 AI 交接只保存在本机，并由工具控制分层与归档。</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-900/30"><FolderPlus size={18}/> 新建项目</button>
        </div>

        {loadError && <div role="alert" className="mb-6 rounded-xl border border-red-700 bg-red-950/50 p-4 text-red-200">{loadError}</div>}
        {showCreate && (
          <form onSubmit={submit} className="mb-8 bg-slate-900 border border-slate-700 rounded-2xl p-6 grid md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <label className="text-sm text-slate-300">项目名称<input autoFocus value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 outline-none focus:border-blue-500" placeholder="例如：VR Grab Plugin"/></label>
            <label className="text-sm text-slate-300">项目标识<input value={id} onChange={(event) => setId(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 outline-none focus:border-blue-500" placeholder="vr-grab-plugin"/></label>
            <button disabled={busy || !name.trim()} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 rounded-lg font-bold">{busy ? '创建中...' : '创建并打开'}</button>
            {error && <div className="md:col-span-3 text-red-300 text-sm">{error}</div>}
          </form>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          {(workspace?.projects || []).map((project) => (
            <article key={project.id} className="bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-2xl p-6 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-600/15 text-blue-300 flex items-center justify-center"><FolderOpen size={22}/></div>
                {project.publication?.siteUrl ? <a href={project.publication.siteUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white" title="打开分享页面"><ExternalLink size={18}/></a> : <span className="text-xs px-2 py-1 rounded-full bg-amber-400/10 text-amber-300">未发布</span>}
              </div>
              <h2 className="text-xl font-bold mt-5">{project.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{project.docTitle}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-5"><span>{project.pageCount} 页</span><span>标识：{project.id}</span></div>
              <button onClick={() => onOpen(project.id)} className="mt-6 w-full py-2.5 border border-slate-700 hover:bg-white hover:text-slate-950 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"><FolderOpen size={17}/> 打开项目</button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- 4. Main Application ---

const App = () => {
  const [isEditMode, setIsEditMode] = useState(!IS_PUBLISHED);
  const [isViewOnly] = useState(IS_PUBLISHED);
  const [lang, setLanguageState] = useState(() => { try { return sessionStorage.getItem('doc-studio-language') || 'bilingual'; } catch { return 'bilingual'; } });
  const setLang = (value) => { try { sessionStorage.setItem('doc-studio-language', value); } catch {} setLanguageState(value); };
  const [activePageId, setActivePageId] = useState('p1');
  const [isTranslating, setIsTranslating] = useState(false); 
  const [translatingBlockId, setTranslatingBlockId] = useState(null); 
  const [docData, setDocDataState] = useState(INITIAL_DATA);
  const [activeBlockId, setActiveBlockId] = useState(null); 
  const [activeMenuId, setActiveMenuId] = useState(null); 
  const [contextMenu, setContextMenu] = useState(null); 
  const [showDocumentSettings, setShowDocumentSettings] = useState(false);
  const [editingPageId, setEditingPageId] = useState(null); 
  const [tempPageTitle, setTempPageTitle] = useState("");
  const [tempPageTitleEn, setTempPageTitleEn] = useState(""); 
  const [isTranslatingTitle, setIsTranslatingTitle] = useState(false); // New state for title translation
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [draggedPageId, setDraggedPageId] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [anyFloatHovered, setAnyFloatHovered] = useState(false); // [FIX] Global state for float hovering
  const [workspace, setWorkspace] = useState(null);
  const [projectLoadError, setProjectLoadError] = useState('');
  const projectIdRef = useRef(null);
  const [showProjectHub, setShowProjectHub] = useState(!IS_PUBLISHED);
  const [activeSection, setActiveSection] = useState('docs');
  const [knowledgeWorkspace, setKnowledgeWorkspace] = useState(null);
  const [activeKnowledgeItemId, setActiveKnowledgeItemId] = useState('project:current-state');
  const [knowledgeDraft, setKnowledgeDraft] = useState('');
  const [knowledgeLoaded, setKnowledgeLoaded] = useState(false);
  const [knowledgeSaveState, setKnowledgeSaveState] = useState('saved');
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState(IS_PUBLISHED ? 'saved' : 'loading');
  const [isPublishing, setIsPublishing] = useState(false);
  const [githubStatus, setGithubStatus] = useState(null);
  const [isGithubConnecting, setIsGithubConnecting] = useState(false);
  const saveTimerRef = useRef(null);
  const documentWriteRef = useRef(Promise.resolve());
  const documentPendingRef = useRef(0);
  const knowledgeTimerRef = useRef(null);
  const lastPersistedRef = useRef('');
  const lastKnowledgeRef = useRef('');
  const activeKnowledgeIdRef = useRef('project:current-state');
  const latestDocumentRef = useRef(INITIAL_DATA);
  // Update the flush snapshot synchronously with editor transactions. A quick
  // theme/tab switch can request a flush before React's passive effects run.
  const setDocData = (value) => {
    const next = typeof value === 'function' ? value(latestDocumentRef.current) : value;
    latestDocumentRef.current = next;
    setDocDataState(next);
  };
  const canvasRef = useRef(null); 
  const apiKey = ""; 

  // Serialize snapshots, including explicit flushes. An older response must
  // never mark newer edits saved or write after the close-time snapshot.
  const persistDocument = (serialized, savingProjectId) => {
    documentPendingRef.current += 1;
    const pending = documentWriteRef.current.catch(() => {}).then(async () => {
      if (projectIdRef.current === savingProjectId && serialized === lastPersistedRef.current) return;
      const response = await fetch(projectApiUrl('/api/document', savingProjectId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialized });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `Save failed (${response.status})`);
      }
      if (projectIdRef.current !== savingProjectId) return;
      lastPersistedRef.current = serialized;
      setSaveState(JSON.stringify(latestDocumentRef.current) === serialized ? 'saved' : 'saving');
      setToast((current) => current?.source === 'document-save' ? null : current);
    }).catch((error) => {
      if (projectIdRef.current === savingProjectId) setSaveState('error');
      throw error;
    }).finally(() => { documentPendingRef.current -= 1; });
    documentWriteRef.current = pending;
    return pending;
  };

  const applyLoadedDocument = (document) => {
    const serialized = JSON.stringify(document);
    lastPersistedRef.current = serialized;
    latestDocumentRef.current = document;
    setDocData(document);
    setActivePageId(document.pages?.[0]?.id || '');
    setSaveState('saved');
    setIsLoaded(true);
  };

  const loadLocalProject = async (nextWorkspace, { section = 'docs', record = '' } = {}) => {
    setIsLoaded(false);
    setKnowledgeLoaded(false);
    const projectId = nextWorkspace.activeProjectId;
    if (!nextWorkspace.projects.some((project) => project.id === projectId)) throw new Error(`未找到绑定的文档项目：${projectId}`);
    const [documentResponse, knowledgeResponse] = await Promise.all([
      fetch(projectApiUrl('/api/document', projectId), { cache: 'no-store' }),
      fetch(projectApiUrl('/api/knowledge', projectId), { cache: 'no-store' }),
    ]);
    if (!documentResponse.ok) throw new Error(`Document load failed (${documentResponse.status})`);
    if (!knowledgeResponse.ok) throw new Error(`Project records load failed (${knowledgeResponse.status})`);
    const [document, knowledge] = await Promise.all([documentResponse.json(), knowledgeResponse.json()]);
    projectIdRef.current = projectId;
    setProjectLoadError('');
    setWorkspace(nextWorkspace);
    applyLoadedDocument(document);
    const initialItem = knowledge.items?.find((item) => item.id === record) || knowledge.items?.find((item) => item.id === 'project:current-state') || knowledge.items?.[0];
    setActiveSection(section);
    setKnowledgeWorkspace(knowledge);
    setActiveKnowledgeItemId(initialItem?.id || '');
    activeKnowledgeIdRef.current = initialItem?.id || '';
    setKnowledgeDraft(initialItem?.content || '');
    lastKnowledgeRef.current = initialItem?.content || '';
    setKnowledgeSaveState('saved');
    setKnowledgeLoaded(true);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (IS_PUBLISHED) {
          const response = await fetch('./document-data.json', { cache: 'no-store' });
          if (!response.ok) throw new Error(`Document load failed (${response.status})`);
          const document = await response.json();
          if (!cancelled) applyLoadedDocument(document);
          return;
        }
        const workspaceResponse = await fetch('/api/workspace', { cache: 'no-store' });
        if (!workspaceResponse.ok) throw new Error(`Workspace load failed (${workspaceResponse.status})`);
        const nextWorkspace = await workspaceResponse.json();
        if (!cancelled) {
          setWorkspace(nextWorkspace);
          const link = readProjectLink(window.location.search);
          await loadLocalProject(link.projectId ? { ...nextWorkspace, activeProjectId: link.projectId } : nextWorkspace, link);
          if (link.projectId) setShowProjectHub(false);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSaveState('error');
          setIsLoaded(false);
          setProjectLoadError(error.message);
          setShowProjectHub(true);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const refreshGithubStatus = async () => {
    if (IS_PUBLISHED) return null;
    try {
      const response = await fetch('/api/github/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(`GitHub status failed (${response.status})`);
      const status = await response.json();
      setGithubStatus(status);
      if (status.authenticated) setIsGithubConnecting(false);
      return status;
    } catch (error) {
      console.error(error);
      setGithubStatus({ available: false, authenticated: false, accounts: [] });
      return null;
    }
  };

  useEffect(() => {
    if (IS_PUBLISHED) return undefined;
    refreshGithubStatus();
    return undefined;
  }, []);

  useEffect(() => {
    if (!isGithubConnecting) return undefined;
    const timer = window.setInterval(refreshGithubStatus, 2500);
    return () => window.clearInterval(timer);
  }, [isGithubConnecting]);

  useEffect(() => {
    if (!isLoaded || IS_PUBLISHED) return undefined;
    const serialized = JSON.stringify(docData);
    const savingProjectId = projectIdRef.current;
    if (serialized === lastPersistedRef.current && !documentPendingRef.current) return undefined;
    setSaveState('saving');
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await persistDocument(serialized, savingProjectId);
      } catch (error) {
        console.error(error);
      }
    }, 1100);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [docData, isLoaded]);

  useEffect(() => {
    if (!knowledgeLoaded || IS_PUBLISHED) return undefined;
    const activeItem = knowledgeWorkspace?.items?.find((item) => item.id === activeKnowledgeItemId);
    if (!activeItem || activeItem.readOnly || knowledgeDraft === lastKnowledgeRef.current) return undefined;
    setKnowledgeSaveState('saving');
    window.clearTimeout(knowledgeTimerRef.current);
    const itemId = activeKnowledgeItemId;
    const savingProjectId = projectIdRef.current;
    knowledgeTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(projectApiUrl('/api/knowledge/item', savingProjectId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: itemId, content: knowledgeDraft }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Project record save failed (${response.status})`);
        if (projectIdRef.current !== savingProjectId) return;
        if (activeKnowledgeIdRef.current === itemId) lastKnowledgeRef.current = knowledgeDraft;
        setKnowledgeWorkspace((current) => current ? {
          ...current,
          items: current.items.map((item) => item.id === itemId ? { ...item, content: knowledgeDraft, health: result.health, updatedAt: result.savedAt } : item),
        } : current);
        setKnowledgeSaveState('saved');
      } catch (error) {
        console.error(error);
        setKnowledgeSaveState('error');
      }
    }, 700);
    return () => window.clearTimeout(knowledgeTimerRef.current);
  }, [knowledgeDraft, activeKnowledgeItemId, knowledgeLoaded]);

  const showToast = (message, type = 'info') => setToast({ message, type });
  useEffect(() => {
    if (isLoaded && saveState === 'error') setToast({ message: '文档保存失败，修改仍保留在编辑器中。请重试保存，成功前不要退出。', type: 'error', source: 'document-save' });
  }, [saveState, isLoaded]);

  const saveKnowledgeImmediately = async () => {
    if (IS_PUBLISHED || !knowledgeLoaded) return;
    window.clearTimeout(knowledgeTimerRef.current);
    const itemId = activeKnowledgeIdRef.current;
    const activeItem = knowledgeWorkspace?.items?.find((item) => item.id === itemId);
    if (!activeItem || activeItem.readOnly || knowledgeDraft === lastKnowledgeRef.current) return;
    setKnowledgeSaveState('saving');
    const response = await fetch(projectApiUrl('/api/knowledge/item', projectIdRef.current), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, content: knowledgeDraft }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setKnowledgeSaveState('error');
      throw new Error(result.error || `Project record save failed (${response.status})`);
    }
    lastKnowledgeRef.current = knowledgeDraft;
    setKnowledgeWorkspace((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, content: knowledgeDraft, health: result.health, updatedAt: result.savedAt } : item),
    } : current);
    setKnowledgeSaveState('saved');
  };

  const selectKnowledgeItem = async (itemId) => {
    if (!itemId || itemId === activeKnowledgeIdRef.current) return;
    try {
      await saveKnowledgeImmediately();
      const item = knowledgeWorkspace?.items?.find((entry) => entry.id === itemId);
      if (!item) return;
      setActiveKnowledgeItemId(itemId);
      activeKnowledgeIdRef.current = itemId;
      setKnowledgeDraft(item.content || '');
      lastKnowledgeRef.current = item.content || '';
      setKnowledgeSaveState('saved');
    } catch (error) {
      console.error(error);
      showToast(`切换记录失败：${error.message}`, 'error');
    }
  };

  const openKnowledgeSection = async (section) => {
    setActiveSection(section);
    const preferredId = section === 'common' ? 'common:general-rules' : 'project:current-state';
    const activeItem = knowledgeWorkspace?.items?.find((item) => item.id === activeKnowledgeIdRef.current);
    const belongsToSection = section === 'common' ? activeItem?.group === 'common' : activeItem?.group !== 'common';
    if (!belongsToSection) await selectKnowledgeItem(preferredId);
  };

  const createKnowledgeRecord = async ({ collection, title }) => {
    await saveKnowledgeImmediately();
    const response = await fetch(projectApiUrl('/api/knowledge/entries', projectIdRef.current), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, title }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Create record failed (${response.status})`);
    setKnowledgeWorkspace(result.workspace);
    const item = result.workspace.items.find((entry) => entry.id === result.itemId);
    setActiveKnowledgeItemId(result.itemId);
    activeKnowledgeIdRef.current = result.itemId;
    setKnowledgeDraft(item?.content || '');
    lastKnowledgeRef.current = item?.content || '';
    setKnowledgeSaveState('saved');
    setShowNewRecordModal(false);
    setActiveSection('development');
    showToast('独立记录已创建', 'success');
  };

  const archiveHandoff = async () => {
    if (!window.confirm('将当前交接完整归档，并创建一份干净的新交接模板。是否继续？')) return;
    try {
      await saveKnowledgeImmediately();
      const response = await fetch(projectApiUrl('/api/knowledge/handoff/archive', projectIdRef.current), { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Archive handoff failed (${response.status})`);
      setKnowledgeWorkspace(result.workspace);
      const item = result.workspace.items.find((entry) => entry.id === 'project:handoff');
      setActiveKnowledgeItemId('project:handoff');
      activeKnowledgeIdRef.current = 'project:handoff';
      setKnowledgeDraft(item?.content || '');
      lastKnowledgeRef.current = item?.content || '';
      setKnowledgeSaveState('saved');
      showToast('本轮交接已归档，已创建新模板', 'success');
    } catch (error) {
      console.error(error);
      showToast(`归档失败：${error.message}`, 'error');
    }
  };

  const copyAiInstruction = async (includeCommonRules = false) => {
    const text = includeCommonRules ? knowledgeWorkspace?.aiInstructionWithCommon : knowledgeWorkspace?.aiInstruction;
    if (!text) return showToast('AI 对接入口尚未生成', 'error');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast(includeCommonRules ? '含通用规则的 AI 指令已复制' : '项目 AI 读取指令已复制', 'success');
  };

  const saveImmediately = async () => {
    if (IS_PUBLISHED || !isLoaded) return;
    window.clearTimeout(saveTimerRef.current);
    const savingProjectId = projectIdRef.current;
    setSaveState('saving');
    do {
      await persistDocument(JSON.stringify(latestDocumentRef.current), savingProjectId);
    } while (projectIdRef.current === savingProjectId && JSON.stringify(latestDocumentRef.current) !== lastPersistedRef.current);
    if (projectIdRef.current === savingProjectId) setSaveState('saved');
  };

  const publishDocument = async () => {
    if (!window.confirm('发布将保存当前文档、构建公开网站，并在 GitHub 配置完成后推送更新。是否继续？')) return;
    setIsPublishing(true);
    try {
      await saveImmediately();
      const response = await fetch(projectApiUrl('/api/publish', projectIdRef.current), { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Publish failed (${response.status})`);
      showToast(result.message, result.pushed ? 'success' : 'info');
    } catch (error) {
      console.error(error);
      showToast(`发布失败：${error.message}`, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const connectGitHub = async () => {
    setIsGithubConnecting(true);
    try {
      const response = await fetch('/api/github/login', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `GitHub login failed (${response.status})`);
      showToast(getUi('githubLoginStarted', lang), 'info');
    } catch (error) {
      console.error(error);
      setIsGithubConnecting(false);
      showToast(`${getUi('githubUnavailable', lang)}：${error.message}`, 'error');
    }
  };

  const openWorkspaceProject = async (projectId) => {
    try {
      await saveImmediately();
      await saveKnowledgeImmediately();
      const response = await fetch('/api/workspace', { cache: 'no-store' });
      const nextWorkspace = await response.json();
      if (!response.ok) throw new Error(nextWorkspace.error || `Open project failed (${response.status})`);
      await loadLocalProject({ ...nextWorkspace, activeProjectId: projectId });
      await refreshGithubStatus();
      setActiveSection('docs');
      setShowProjectHub(false);
    } catch (error) {
      console.error(error);
      showToast(`打开项目失败：${error.message}`, 'error');
      throw error;
    }
  };

  const createWorkspaceProject = async ({ name, id }) => {
    await saveImmediately();
    await saveKnowledgeImmediately();
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, id }),
    });
    const nextWorkspace = await response.json();
    if (!response.ok) throw new Error(nextWorkspace.error || `Create project failed (${response.status})`);
    await loadLocalProject(nextWorkspace);
    await refreshGithubStatus();
    setActiveSection('docs');
    setShowProjectHub(false);
  };

  const copyShareLink = async () => {
    const project = workspace?.projects?.find((entry) => entry.id === workspace.activeProjectId);
    const shareUrl = project?.publication?.siteUrl || '';
    if (!shareUrl) {
      showToast(getUi('shareUnavailable', lang), 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showToast(getUi('shareCopied', lang), 'success');
  };

  const printDocument = () => {
    setIsEditMode(false);
    window.setTimeout(() => window.print(), 100);
  };

  const updateContent = (fn) => {
    setDocData(prev => {
        const page = prev.content[activePageId] || { blocks: [] };
        const newBlocks = fn(page.blocks);
        return { ...prev, content: { ...prev.content, [activePageId]: { ...page, blocks: newBlocks } } };
    });
  };

  const updateBlockData = (id, field, val) => updateContent(blocks => blocks.map(b => b.id === id ? { ...b, data: { ...b.data, [field]: val } } : b));
  const updateBlockStyle = (id, style) => updateContent(blocks => blocks.map(b => b.id === id ? { ...b, style } : b));
  const updateBlockLayout = (id, layout) => updateContent(blocks => blocks.map(b => b.id === id ? { ...b, layout: { ...b.layout, ...layout } } : b));
  const deleteBlock = (id) => updateContent(blocks => blocks.filter(b => b.id !== id));
  const updateAttachment = (pId, aId, data) => updateContent(blocks => blocks.map(b => b.id !== pId ? b : { ...b, attachments: b.attachments.map(a => a.id === aId ? (data.layout ? { ...a, ...data, layout: { ...a.layout, ...data.layout } } : { ...a, ...data }) : a) }));
  const deleteAttachment = (pId, aId) => updateContent(blocks => blocks.map(b => b.id !== pId ? b : { ...b, attachments: b.attachments.filter(a => a.id !== aId) }));

  const addBlock = (type, isFloating, index = null, targetBlockId = null) => {
    if (targetBlockId) {
        if (type !== 'text') return;
        const width = contextMenu?.blockWidth || 642;
        const rx = (contextMenu?.relativeX ?? 24) / width;
        const ry = (contextMenu?.relativeY ?? 8) / width;
        const rw = Math.min(0.46, 220 / width);
        const rh = 72 / width;
        const newAtt = { id: `a${Date.now()}`, type: 'text', isFloating: true, layout: { x: rx * 642, y: ry * 642, width: rw * 642, height: rh * 642, rx, ry, rw, rh }, data: { zh: '', en: '' }, style: { size: 'text-sm', weight: 'font-normal', decoration: 'none' } };
        updateContent(blocks => blocks.map(b => b.id === targetBlockId ? { ...b, attachments: [...(b.attachments || []), newAtt] } : b));
        return;
    }
    const layout = undefined;
    const newBlock = { id: `b${Date.now()}`, type, isFloating: false, style: { size: 'text-base', weight: 'font-normal', color: '#374151', decoration: 'none', isSectionHeader: false }, layout, data: type === 'text' ? { zh: '点此输入...', en: '...' } : { src: '' }, attachments: [] };
    updateContent(blocks => { const flow = blocks.filter(b => !b.isFloating); const floating = blocks.filter(b => b.isFloating); if (index !== null) flow.splice(index, 0, newBlock); else flow.push(newBlock); return [...flow, ...floating]; });
  };

  const handleFlowDrop = (e, dropIndex) => { e.preventDefault(); if (draggedIndex === null || draggedIndex === dropIndex) return; updateContent(blocks => { const flow = blocks.filter(b => !b.isFloating); const [moved] = flow.splice(draggedIndex, 1); flow.splice(dropIndex, 0, moved); return flow; }); setDraggedIndex(null); };
  const addPage = () => { const id = `p${Date.now()}`; setDocData(prev => ({ ...prev, pages: [...prev.pages, { id, title: { zh: '新页面', en: 'New Page' } }], content: { ...prev.content, [id]: { blocks: [] } } })); setActivePageId(id); };
  const deletePage = (id, e) => { e.stopPropagation(); if (docData.pages.length <= 1) return showToast(getUi('keepOnePage', lang), "error"); setConfirmModal({ title: getUi('newPage', lang).replace('新建', '删除'), message: getUi('deletePageConfirm', lang), onConfirm: () => { const newPages = docData.pages.filter(p => p.id !== id); setDocData(prev => ({ ...prev, pages: newPages })); if (activePageId === id) setActivePageId(newPages[0].id); setConfirmModal(null); showToast(getUi('pageDeleted', lang), "success"); }, onCancel: () => setConfirmModal(null) }); };
  
  // [修复版] 导出 HTML：彻底重构为固定宽度布局 (642px Content Width)
  const handleExportHtml = () => {
    const safeJson = JSON.stringify(docData).replace(/<\/script>/g, '<\\/script>');
    const EDITOR_WIDTH = 642; 
    const exportLang = lang; 

    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${docData.docTitle}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  /* 全局样式 */
  body { 
    background-color: #f3f4f6; 
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
    margin: 0;
  }
  
  /* 屏幕显示容器 (A4 模拟) */
  .container { 
    position: relative; 
    width: 794px; /* A4 width at 96 DPI */
    margin: 40px auto; 
    background: white; 
    padding: 64px; /* Screen padding */
    border-radius: 8px; 
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
    min-height: 1000px;
    box-sizing: border-box; 
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  /* 打印优化 */
  @media print { 
    @page { margin: 15mm; size: A4; } /* 设置打印机边缘 */
    
    .no-print { display: none !important; } 
    .page-break { break-before: page; margin-top: 0 !important; border: none !important; } 
    
    body { background: white; -webkit-print-color-adjust: exact; } 
    
    .container { 
      width: 100% !important; 
      max-width: 100% !important;
      margin: 0 !important; 
      padding: 0 !important; /* 去除容器内边距，依靠 @page 边距 */
      box-shadow: none !important; 
      border: none !important;
    }

    .content-block { 
      width: 100% !important; /* 允许自适应宽度 */
      max-width: ${EDITOR_WIDTH}px !important; /* 上限维持编辑器宽度 */
      margin: 0 auto !important; 
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  }

  /* 核心内容块 */
  .content-block {
    position: relative;
    width: ${EDITOR_WIDTH}px;
    margin: 0 auto;
    padding: 12px;
    box-sizing: border-box;
  }

  img {
    display: block;
    max-width: 100%;
    height: auto;
  }
  
  .text-content {
    white-space: pre-wrap;
    overflow-wrap: anywhere; /* 强制长单词换行 */
    word-break: break-word; 
  }

  .attached-sticker { 
    position: absolute; 
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
    border-radius: 4px; 
    pointer-events: none; 
    z-index: 20;
    overflow: hidden;
    transform-origin: top left;
  }
</style>
</head>
<body>
<div class="no-print" style="position:fixed;top:0;left:0;width:100%;background:#2563eb;color:white;padding:10px;text-align:center;z-index:1000;box-shadow:0 2px 4px rgba(0,0,0,0.2);">
  只读文档预览 <button onclick="window.print()" style="margin-left:15px;background:white;color:#2563eb;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">🖨️ 打印 / 存为 PDF</button>
</div>

<div class="container" style="margin-top:60px;">
  <h1 class="text-5xl font-black mb-12 text-center border-b-4 border-black pb-8" id="doc-title"></h1>
  <div id="root"></div>
</div>

<script>
const data = ${safeJson};
// JS 变量注入
const EDITOR_WIDTH = ${EDITOR_WIDTH}; 
const EXPORT_LANG = "${exportLang}";

document.getElementById('doc-title').textContent = data.docTitle;
const root = document.getElementById('root');

// Determine visibility based on exported lang
const showZh = EXPORT_LANG === 'zh' || EXPORT_LANG === 'bilingual';
const showEn = EXPORT_LANG === 'en' || EXPORT_LANG === 'bilingual';

function appendLocalizedImages(container, item, contained) {
  const source = item.data || {};
  const fields = (showZh ? ['zh'] : []).concat(showEn ? ['en'] : []);
  fields.forEach(function(field) {
    const src = field === 'zh' || source.shareWithEnglish ? source.src : source.srcEn;
    const width = contained ? '100%' : ((item.style && item.style.imageWidth) || 100) + '%';
    if (src) {
      const image = document.createElement('img'); image.src = src; image.className = 'rounded';
      image.style.width = width; image.style.height = 'auto'; container.appendChild(image);
    } else if (field === 'en') {
      const placeholder = document.createElement('div');
      placeholder.textContent = '待补英文图片';
      Object.assign(placeholder.style, { width: width, aspectRatio: '16 / 9', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: '1px dashed currentColor' });
      container.appendChild(placeholder);
      if (source.src) {
        const measure = new Image(); measure.onload = function() { if (measure.naturalWidth && measure.naturalHeight) placeholder.style.aspectRatio = measure.naturalWidth + ' / ' + measure.naturalHeight; }; measure.src = source.src;
      }
    }
  });
}

data.pages.forEach((p, i) => {
  const pageWrapper = document.createElement('div');
  pageWrapper.style.position = 'relative'; 
  if (i > 0) pageWrapper.className = 'page-break';
  
  const h2 = document.createElement('h2');
  h2.className = 'text-3xl font-bold mb-8 pb-2 border-b-2 border-gray-800 pt-4';
  
  // [FIX: Correctly switch title language]
  let titleHtml = '';
  if (showZh) {
     titleHtml += '<div>' + p.title.zh + '</div>';
  }
  if (showEn && p.title.en) {
     const mt = showZh ? 'mt-2' : '';
     // UPDATED: Removed 'text-lg text-gray-500 font-normal' to enforce consistency with ZH title
     titleHtml += '<div class="' + mt + '">' + p.title.en + '</div>';
  }
  h2.innerHTML = titleHtml;
  
  pageWrapper.appendChild(h2);

  const blocks = data.content[p.id]?.blocks || [];
  
  blocks.forEach(b => {
    // 渲染正文块 (Flow Blocks)
    if (!b.isFloating) {
      const bDiv = document.createElement('div');
      bDiv.className = 'content-block mb-6'; 

      const style = b.style || {};
      const commonStyle = (style.size || 'text-base') + ' ' + (style.weight || 'font-normal') + ' ' + (style.decoration === 'underline' ? 'underline' : '');
      const headerStyle = style.isSectionHeader ? 'border-b-2 border-gray-200 pb-2 mb-4 font-bold text-2xl' : '';

      const applyTypography = (element) => {
        const settings = data.typography;
        if (!settings) return;
        element.style.lineHeight = settings.lineHeight;
        if (!style.customTypography) {
          element.style.fontSize = (style.isSectionHeader ? settings.headingSize : settings.bodySize) + 'px';
          if (style.isSectionHeader) element.style.fontWeight = settings.headingWeight;
        }
        if (style.isSectionHeader && !settings.headingDivider) element.style.borderBottom = 'none';
      };
      if (data.typography) bDiv.style.marginBottom = data.typography.paragraphGap + 'px';

      if (b.type === 'text') {
        if (showZh) {
            const divZh = document.createElement('div');
            divZh.className = 'text-content ' + commonStyle + ' ' + headerStyle;
            divZh.style.color = style.color;
            divZh.textContent = b.data.zh || '';
            applyTypography(divZh);
            bDiv.appendChild(divZh);
        }

        if (showEn && b.data.en) {
          const divEn = document.createElement('div');
          // UPDATED: Added headerStyle to English block as well to ensure consistency
          divEn.className = 'text-content mt-1 ' + commonStyle + ' ' + (style.isSectionHeader ? 'font-bold text-2xl' : '');
          divEn.style.color = style.color;
          divEn.textContent = b.data.en;
          applyTypography(divEn);
          bDiv.appendChild(divEn);
        }
      } else if (b.type === 'image') {
        appendLocalizedImages(bDiv, b, false);
      }

      // 渲染悬浮框 (Attachments)
      if (b.attachments) {
        b.attachments.forEach(a => {
          const ad = document.createElement('div');
          ad.className = 'attached-sticker flex flex-col items-center justify-center'; 
          
          const leftPercent = ((a.layout.x || 0) / EDITOR_WIDTH * 100).toFixed(4) + '%';
          const widthPercent = ((a.layout.width || 100) / EDITOR_WIDTH * 100).toFixed(4) + '%';
          
          ad.style.left = leftPercent;
          ad.style.width = widthPercent;
          ad.style.top = (a.layout.y || 0) + 'px';
          ad.style.height = (a.layout.height || 50) + 'px';

          if (a.type === 'text') {
            ad.className += ' bg-white border border-gray-200 shadow-sm p-1 text-xs text-center';
            ad.style.backgroundColor = a.style?.bgColor || '#fffbeb';
            ad.style.color = a.style?.color || '#374151';
            ad.style.whiteSpace = 'pre-wrap';
            ad.style.overflow = 'hidden';
            
            if (showZh && a.data.zh) {
                const divZh = document.createElement('div');
                divZh.textContent = a.data.zh;
                ad.appendChild(divZh);
            }
            if (showEn && a.data.en) {
                const divEn = document.createElement('div');
                divEn.textContent = a.data.en;
                if (showZh && a.data.zh) divEn.style.marginTop = '4px';
                divEn.style.opacity = '0.8'; 
                ad.appendChild(divEn);
            }
            
          } else {
            appendLocalizedImages(ad, a, true);
          }
          bDiv.appendChild(ad);
        });
      }
      pageWrapper.appendChild(bDiv);
    }
  });

  root.appendChild(pageWrapper);
});
</script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UE_Docs_${docData.docTitle}.html`;
    link.click();
    showToast(getUi('generatedHtml', lang), "success");
  };
  // [NEW] Translate Page Title
  const translatePageTitle = async (text) => {
    if (!text) return;
    setIsTranslatingTitle(true);
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Translate to English (Short Title context), only output text: "${text}"` }] }] }) }); 
        const json = await res.json(); 
        const result = json.candidates?.[0]?.content?.parts?.[0]?.text; 
        if (result) setTempPageTitleEn(result.trim());
    } catch(e) {
        showToast("Translation Error", "error");
    } finally {
        setIsTranslatingTitle(false);
    }
  };

  const translateAllText = async () => { setIsTranslating(true); try { const page = docData.content[activePageId]; if (!page) return; const updated = [...page.blocks]; for (let i = 0; i < updated.length; i++) { const b = updated[i]; if (b.type !== 'text' || !b.data.zh) continue; try { const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Translate to English (Unreal Engine context), only output text: "${b.data.zh}"` }] }] }) }); const json = await res.json(); const text = json.candidates?.[0]?.content?.parts?.[0]?.text; if (text) updated[i] = { ...b, data: { ...b.data, en: text.trim() } }; } catch (e) { console.warn(e); } } setDocData(prev => ({ ...prev, content: { ...prev.content, [activePageId]: { ...page, blocks: updated } } })); } catch (err) { showToast("Error", "error"); } finally { setIsTranslating(false); } };
  const translateBlock = async (id) => { setTranslatingBlockId(id); try { const page = docData.content[activePageId]; let textToTranslate = ""; let found = false; const mainBlock = page.blocks.find(b => b.id === id); if (mainBlock) { textToTranslate = mainBlock.data.zh; found = true; } if (!found) { for (const b of page.blocks) { if (b.attachments) { const att = b.attachments.find(a => a.id === id); if (att) { textToTranslate = att.data.zh; found = true; break; } } } } if (!textToTranslate) return; const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `Translate to English (Unreal Engine context), only output text: "${textToTranslate}"` }] }] }) }); const json = await res.json(); const text = json.candidates?.[0]?.content?.parts?.[0]?.text; if (text) { updateContent(blocks => blocks.map(b => { if (b.id === id) return { ...b, data: { ...b.data, en: text.trim() } }; if (b.attachments) { return { ...b, attachments: b.attachments.map(a => a.id === id ? { ...a, data: { ...a.data, en: text.trim() } } : a) }; } return b; })); showToast(getUi('translateSuccess', lang), "success"); } } catch (e) { console.warn(e); showToast("翻译失败", "error"); } finally { setTranslatingBlockId(null); } };

  useEffect(() => {
    if (IS_PUBLISHED || showProjectHub || !isLoaded || !workspace?.activeProjectId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('project', workspace.activeProjectId);
    url.searchParams.set('section', activeSection === 'docs' ? 'docs' : 'development');
    if (activeSection === 'development') url.searchParams.set('record', activeKnowledgeItemId);
    else url.searchParams.delete('record');
    window.history.replaceState(null, '', url);
  }, [workspace?.activeProjectId, showProjectHub, isLoaded, activeSection, activeKnowledgeItemId]);

  useEffect(() => {
    if (!IS_DESKTOP_EMBEDDED) return undefined;
    const flush = async (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'ue-desktop:flush') return;
      let error = '';
      try { await saveImmediately(); await saveKnowledgeImmediately(); } catch (e) { error = e.message; }
      window.parent.postMessage({ type: 'ue-desktop:flushed', id: event.data.id, error }, window.location.origin);
    };
    window.addEventListener('message', flush);
    return () => window.removeEventListener('message', flush);
  });

  const activeProject = workspace?.projects?.find((project) => project.id === workspace.activeProjectId) || null;
  const activeKnowledgeItem = knowledgeWorkspace?.items?.find((item) => item.id === activeKnowledgeItemId) || null;
  const visibleKnowledgeGroups = (knowledgeWorkspace?.groups || []).filter((group) => activeSection === 'common' ? group.id === 'common' : group.id !== 'common');
  const knowledgeHealthClass = activeKnowledgeItem?.health?.status === 'over'
    ? 'bg-red-100 text-red-700 border-red-200'
    : activeKnowledgeItem?.health?.status === 'warning'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  if (!IS_PUBLISHED && showProjectHub) {
    if (!workspace) {
      return <div className="h-screen bg-slate-950 text-white flex items-center justify-center gap-3"><Loader2 className="animate-spin"/> {projectLoadError || '正在载入项目...'}</div>;
    }
    return (
      <ProjectHub
        workspace={workspace}
        loadError={projectLoadError}
        onOpen={openWorkspaceProject}
        onCreate={createWorkspaceProject}
      />
    );
  }

  const blocks = docData.content[activePageId]?.blocks || [];

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans text-gray-900 overflow-hidden app-root" onClick={() => { setContextMenu(null); setActiveBlockId(null); setActiveMenuId(null); }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      {showNewRecordModal && <NewRecordModal onConfirm={createKnowledgeRecord} onCancel={() => setShowNewRecordModal(false)} />}
      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      <nav className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0 z-40 print:hidden">
         <div className="p-5 flex items-center gap-3 border-b border-gray-100">
             {!isViewOnly && !IS_DESKTOP_EMBEDDED && <button onClick={() => setShowProjectHub(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500" title={getUi('projectHome', lang)}><Home size={17}/></button>}
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0"><BookOpen size={18}/></div>
             {!isViewOnly && isEditMode && activeSection === 'docs' ? <input className="font-bold text-gray-800 bg-transparent outline-none w-full min-w-0" value={docData.sidebarTitle} onChange={(e) => setDocData({...docData, sidebarTitle: e.target.value})}/> : <div className="font-bold truncate">{activeSection === 'docs' ? docData.sidebarTitle : activeSection === 'common' ? '通用规则' : activeProject?.name}</div>}
          </div>
         {!isViewOnly && activeProject && <div className="px-5 py-2 border-b border-gray-100 text-[10px] text-gray-500">所属项目：<strong className="text-gray-700">{activeProject.name}</strong> · {activeProject.id}</div>}
         {!isViewOnly && <div className="p-2 grid grid-cols-3 gap-1 border-b border-gray-100 bg-gray-50">
           <button onClick={() => setActiveSection('docs')} className={`px-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${activeSection === 'docs' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:bg-white'}`}><BookOpen size={13}/> 文档</button>
           <button onClick={() => openKnowledgeSection('development')} className={`px-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${activeSection === 'development' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-gray-500 hover:bg-white'}`}><LockKeyhole size={13}/> 项目资料</button>
           <button onClick={() => openKnowledgeSection('common')} className={`px-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 ${activeSection === 'common' ? 'bg-violet-100 text-violet-800 shadow-sm' : 'text-gray-500 hover:bg-white'}`}><FileText size={13}/> 通用规则</button>
         </div>}
         <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {activeSection === 'docs' ? <>{docData.pages.map(p => (
              <div key={p.id} data-document-page-id={p.id} onClick={() => setActivePageId(p.id)} draggable={!isViewOnly && isEditMode && !editingPageId} onDragStart={(e) => { if (editingPageId || e.target.closest('input, textarea, [contenteditable="true"]')) { e.preventDefault(); return; } setDraggedPageId(p.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setDraggedPageId(null)} onDrop={(e) => { e.preventDefault(); if(editingPageId || !draggedPageId || draggedPageId === p.id) return; const ps = [...docData.pages]; const f = ps.findIndex(x=>x.id===draggedPageId); const t = ps.findIndex(x=>x.id===p.id); if(f < 0 || t < 0) return; const [m] = ps.splice(f,1); ps.splice(t,0,m); setDocData(d=>({...d, pages: ps})); setDraggedPageId(null); }} onDragOver={(e) => e.preventDefault()} className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-lg cursor-pointer transition-all ${activePageId === p.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>
                <div className="flex items-center gap-3 overflow-hidden w-full relative">
                   <div className="flex items-center gap-3 overflow-hidden w-full">
                       {activePageId === p.id ? <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"/> : <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 group-hover:bg-gray-400"/>}
                       
                       {/* [UPDATE] New Sidebar Page Edit Logic: 2 Inputs + Translate */}
                       {!isViewOnly && isEditMode && editingPageId === p.id ? (
                           <div data-page-title-editor className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()} onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                                onBlur={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        if(editingPageId) { 
                                            setDocData(d => ({...d, pages: d.pages.map(px => px.id === editingPageId ? { ...px, title: { zh: tempPageTitle, en: tempPageTitleEn } } : px) })); 
                                            setEditingPageId(null); 
                                        }
                                    }
                                }} 
                                tabIndex={-1}
                           >
                               <input autoFocus aria-label="页面中文标题" className="bg-white border border-blue-300 rounded px-1.5 py-1 text-sm w-full" value={tempPageTitle} onChange={e => setTempPageTitle(e.target.value)} placeholder="中文标题" />
                               <div className="flex gap-1">
                                   <input aria-label="页面英文标题" className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs w-full text-gray-600" value={tempPageTitleEn} onChange={e => setTempPageTitleEn(e.target.value)} placeholder="English Title" />
                                   <button 
                                      onClick={() => translatePageTitle(tempPageTitle)} 
                                      className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 flex items-center justify-center" 
                                      title={getUi('pageTranslateTip', lang)}
                                      disabled={isTranslatingTitle}
                                   >
                                       {isTranslatingTitle ? <Loader2 size={10} className="animate-spin"/> : <Languages size={10}/>}
                                   </button>
                               </div>
                               <div className="flex justify-end mt-1">
                                    <button aria-label="保存页面标题" className="px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700" onClick={() => {
                                         setDocData(d => ({...d, pages: d.pages.map(px => px.id === editingPageId ? { ...px, title: { zh: tempPageTitle, en: tempPageTitleEn } } : px) })); 
                                         setEditingPageId(null);
                                    }}><Check size={12}/></button>
                               </div>
                           </div>
                       ) : (
                           <div className="flex flex-col w-full min-w-0 select-none">
                             {/* [FIX] Sidebar title now respects `lang` mode */}
                             {(lang === 'zh' || lang === 'bilingual') && (
                               <span className="text-sm font-medium truncate">{p.title.zh}</span>
                             )}
                             {(lang === 'en' || (lang === 'bilingual' && p.title.en)) && (
                               <span className={`truncate ${lang === 'en' ? 'text-sm font-medium' : 'text-[10px] text-gray-400 mt-0.5'}`}>
                                 {lang === 'en' ? (p.title.en || p.title.zh) : p.title.en}
                               </span>
                             )}
                           </div>
                       )}
                   </div>
                </div>
                {!isViewOnly && isEditMode && activePageId === p.id && !editingPageId && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><button aria-label="编辑页面标题" onClick={(e) => { e.stopPropagation(); setDraggedPageId(null); setEditingPageId(p.id); setTempPageTitle(p.title.zh); setTempPageTitleEn(p.title.en || ""); }} className="p-1 hover:bg-blue-200 rounded text-blue-600"><Pencil size={12}/></button><button onClick={(e) => deletePage(p.id, e)} className="p-1 hover:bg-red-200 rounded text-red-500"><Trash2 size={12}/></button></div>}
              </div>
            ))}</> : (
              <div className="space-y-5">
                {visibleKnowledgeGroups.map((group) => {
                  const groupItems = (knowledgeWorkspace?.items || []).filter((item) => item.group === group.id);
                  return (
                    <section key={group.id}>
                      <div className="px-2 mb-2">
                        <div className="text-[11px] font-black tracking-wider text-gray-500 uppercase">{group.title}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{group.description}</div>
                      </div>
                      <div className="space-y-1">
                        {groupItems.map((item) => (
                          <button key={item.id} onClick={() => selectKnowledgeItem(item.id)} className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${activeKnowledgeItemId === item.id ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-start gap-2">
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.health?.status === 'over' ? 'bg-red-500' : item.health?.status === 'warning' ? 'bg-amber-400' : item.readOnly ? 'bg-gray-400' : 'bg-emerald-500'}`}></span>
                              <span className="min-w-0">
                                <span className="block text-xs font-bold truncate">{item.title}</span>
                                {item.collection && <span className={`block text-[9px] mt-1 ${activeKnowledgeItemId === item.id ? 'text-slate-400' : 'text-gray-400'}`}>{item.collection === 'decisions' ? '决策' : item.collection === 'issues' ? '异常' : item.collection === 'changes' ? '变更' : '归档'}</span>}
                              </span>
                            </div>
                          </button>
                        ))}
                        {groupItems.length === 0 && <div className="px-3 py-3 text-[11px] text-gray-400 border border-dashed border-gray-200 rounded-xl">暂无记录</div>}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
         </div>
         <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
             {!isViewOnly && isEditMode && activeSection === 'docs' && <button onClick={addPage} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm hover:border-blue-400 hover:text-blue-600 hover:bg-white transition-all flex items-center justify-center gap-2"><Plus size={14}/> {getUi('newPage', lang)}</button>}
              {activeSection === 'docs' && <div>
                {/* [UPDATE] Added Language Label */}
                <div className="text-xs font-bold text-gray-500 text-center mb-2">{getUi('langLabel', lang)}</div>
                <div className="flex bg-white p-1 rounded-lg border shadow-sm">{['zh', 'en', 'bilingual'].map(l => (<button key={l} onClick={() => setLang(l)} className={`flex-1 py-1.5 text-[10px] rounded font-medium uppercase transition-colors ${lang === l ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{l}</button>))}</div>
              </div>}
              {activeSection === 'development' && <button onClick={() => setShowNewRecordModal(true)} className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2"><Plus size={14}/> 新建决策 / 异常 / 变更</button>}
              {activeSection !== 'docs' && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800"><LockKeyhole size={11} className="inline mr-1"/>全部项目资料和通用规则只保存在本机，不会发布到分享页面。</div>}
          </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-30 transition-all print:hidden">
          <div className="flex-1 mr-8">
             {activeSection !== 'docs' ? <div><h2 className="text-xl font-bold text-gray-800">{activeKnowledgeItem?.title || (activeSection === 'common' ? '通用规则' : getUi('development', lang))}</h2><p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><LockKeyhole size={11}/> {getUi('localOnly', lang)} · {activeKnowledgeItem?.readOnly ? '工具自动生成' : 'Markdown 文件'}</p></div> : !isViewOnly && isEditMode ? <input className="text-xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-full py-1" value={docData.docTitle} onChange={e => setDocData({...docData, docTitle: e.target.value})} placeholder={getUi('docTitlePlaceholder', lang)}/> : <h2 className="text-xl font-bold text-gray-800">{docData.docTitle}</h2>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
             {!isViewOnly && (activeSection === 'docs' ? (
               <>
                 <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0"><button onClick={() => setIsEditMode(false)} className={`px-2 py-1.5 text-xs font-bold rounded-md flex gap-1 items-center ${!isEditMode ? 'bg-white shadow-sm' : 'text-gray-400'}`}><Eye size={14}/> {getUi('previewMode', lang)}</button><button onClick={() => setIsEditMode(true)} className={`px-2 py-1.5 text-xs font-bold rounded-md flex gap-1 items-center ${isEditMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}><Edit3 size={14}/> {getUi('editMode', lang)}</button></div>
                 <div className="h-6 w-px bg-gray-200 shrink-0"></div>
                  {isEditMode && <button onClick={translateAllText} disabled={isTranslating} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${isTranslating ? 'bg-gray-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>{isTranslating ? <Loader2 size={12} className="animate-spin"/> : <Languages size={14}/>} {isTranslating ? '...' : getUi('aiTranslate', lang)}</button>}
                  <button className="doc-settings-trigger" onClick={() => setShowDocumentSettings(true)}><Palette size={14}/> 全局排版</button>
                  {saveState !== 'saved' && <div className={`doc-save-status ${saveState === 'error' ? 'is-error' : ''}`} role={saveState === 'error' ? 'alert' : 'status'}>
                    {saveState === 'error' ? <><AlertTriangle size={14}/><span>保存失败，修改尚未写入</span><button onClick={() => { void saveImmediately().catch(() => {}); }}>重试保存</button></> : <><Loader2 size={14} className="animate-spin"/><span>{getUi(saveState, lang)}</span></>}
                  </div>}
                  <button onClick={connectGitHub} disabled={isGithubConnecting || githubStatus?.available === false} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all whitespace-nowrap ${githubStatus?.authenticated ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700'} disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`} title={githubStatus?.authenticated ? `${getUi('githubConnected', lang)}：${githubStatus.accounts.join(', ')}（点击重新登录或切换账号）` : getUi('githubLogin', lang)}>
                    {isGithubConnecting ? <Loader2 size={15} className="animate-spin"/> : <LogIn size={15}/>}
                    <span>{isGithubConnecting ? getUi('githubConnecting', lang) : githubStatus?.authenticated ? githubStatus.accounts[0] : getUi('githubLogin', lang)}</span>
                  </button>
                  <button onClick={copyShareLink} disabled={!activeProject?.publication?.siteUrl} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg" title={getUi('copyShare', lang)}><Share2 size={15}/><span className="hidden 2xl:inline">{getUi('copyShare', lang)}</span></button>
                  <button onClick={printDocument} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg" title={getUi('printPdf', lang)}><Printer size={15}/><span className="hidden 2xl:inline">{getUi('printPdf', lang)}</span></button>
                  <button onClick={publishDocument} disabled={isPublishing || saveState === 'error'} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-all shadow-md text-sm font-bold">
                    {isPublishing ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>} 
                    <span>{isPublishing ? getUi('publishing', lang) : getUi('publish', lang)}</span>
                  </button>
               </>
             ) : (
               <>
                 <button onClick={() => copyAiInstruction(false)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold"><ClipboardCopy size={15}/> 复制项目读取指令</button>
                 <button onClick={() => copyAiInstruction(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold"><FileText size={15}/> 项目＋通用规则</button>
                 {activeKnowledgeItemId === 'project:handoff' && <button onClick={archiveHandoff} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"><FolderOpen size={15}/> 归档本轮交接</button>}
                 <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${knowledgeSaveState === 'error' ? 'bg-red-50 text-red-700' : knowledgeSaveState === 'saving' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                   {knowledgeSaveState === 'saving' ? <Loader2 size={15} className="animate-spin"/> : knowledgeSaveState === 'error' ? <AlertTriangle size={15}/> : <Save size={15}/>} {knowledgeSaveState === 'saving' ? getUi('devSaving', lang) : knowledgeSaveState === 'error' ? getUi('saveError', lang) : getUi('devSaved', lang)}
                 </div>
               </>
             ))}
          </div>
        </header>

        {/* Content Area */}
        {activeSection !== 'docs' && !isViewOnly ? (
        <div className="flex-1 overflow-auto bg-[#f3f4f6] relative print:bg-white print:overflow-visible">
            <div className="max-w-5xl min-h-full mx-auto px-8 py-8 flex flex-col">
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-900"><FileText size={18}/>{activeKnowledgeItem?.title}</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{activeKnowledgeItem?.description}</p>
                  </div>
                  {activeKnowledgeItem?.health && <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${knowledgeHealthClass}`}>{activeKnowledgeItem.health.lines} 行{activeKnowledgeItem.health.recommendedLines ? ` / 建议 ${activeKnowledgeItem.health.recommendedLines} 行内` : ''}</div>}
                </div>
                {activeKnowledgeItem?.health?.status === 'over' && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">当前文件已超过建议长度。请把历史推导拆为独立记录或归档，只保留当前有效结论。</div>}
                <p className="mt-3 text-[11px] break-all text-slate-400">本地文件：{activeKnowledgeItem?.path}</p>
              </div>
              <textarea
                value={knowledgeDraft}
                onChange={(event) => setKnowledgeDraft(event.target.value)}
                readOnly={activeKnowledgeItem?.readOnly}
                spellCheck={false}
                aria-label={activeKnowledgeItem?.title || '项目资料'}
                className={`flex-1 min-h-[700px] w-full resize-none rounded-2xl border bg-white px-8 py-7 font-mono text-[15px] leading-7 text-slate-800 shadow-sm outline-none transition ${activeKnowledgeItem?.readOnly ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-slate-300 focus:border-amber-400 focus:ring-4 focus:ring-amber-100'}`}
                placeholder="# 在这里填写结构化项目资料"
              />
            </div>
        </div>
        ) : (
          <RichDocumentEditor
            key={`${workspace?.activeProjectId || 'published'}:${activePageId}`}
            blocks={blocks}
            typography={docData.typography}
            editable={!isViewOnly && isEditMode}
            lang={lang}
            translatingId={translatingBlockId}
            onChange={(next) => updateContent(() => next)}
            onTranslate={translateBlock}
            onPreview={setPreviewImage}
            onContextMenu={(event, blockId) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setContextMenu({ x: event.clientX, y: event.clientY, relativeX: event.clientX - rect.left, relativeY: event.clientY - rect.top, blockWidth: rect.width, targetBlockId: blockId });
            }}
          />
        )}
        {activeSection === 'docs' && contextMenu && !isViewOnly && (
          <>
            <div className="doc-context-dismiss" onMouseDown={(event) => { if (event.button === 0) setContextMenu(null); }} onContextMenu={(event) => { event.preventDefault(); setContextMenu(null); }} />
            <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onAdd={addBlock} targetBlockId={contextMenu.targetBlockId} clipboard={clipboard} onPaste={(tid) => { if(!clipboard) return; const newAtt = { id: `a${Date.now()}`, type: clipboard.type, isFloating: true, layout: { x: contextMenu.relativeX, y: contextMenu.relativeY, width: 150, height: 100 }, data: JSON.parse(JSON.stringify(clipboard.data)), style: { size: 'text-xs', bgColor: '#fffbeb' } }; updateContent(blocks => blocks.map(b => b.id !== tid ? b : { ...b, attachments: [...(b.attachments || []), newAtt] })); }} lang={lang} />
          </>
        )}
      </main>
      {showDocumentSettings && <DocumentSettings value={docData.typography} onClose={() => setShowDocumentSettings(false)} onChange={(typography) => setDocData((current) => ({ ...current, typography, content: Object.fromEntries(Object.entries(current.content).map(([id, page]) => [id, { ...page, blocks: page.blocks.map((block) => ({ ...block, style: { ...block.style, customTypography: false } })) }])) }))}/>}
    </div>
  );
};

export default App;
