import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, Image as ImageIcon, ChevronRight, ChevronLeft, Plus, 
  Trash2, Edit3, GripVertical, Type as TypeIcon, Move, 
  Check, X, Languages, Loader2, Copy, Sticker, MousePointer2, 
  FileText, Pencil, Eye, UploadCloud, Bold, Underline, Heading, 
  Anchor, ClipboardCopy, FileCode, AlertTriangle, Palette,
  Maximize2, Minimize2, MoreHorizontal, Save, LogIn
} from 'lucide-react';

// --- 1. Constants & Dictionaries ---
const UI_TEXT = {
  previewMode: { zh: '预览模式', en: 'Preview' },
  editMode: { zh: '编辑模式', en: 'Edit' },
  aiTranslate: { zh: 'AI 全文翻译', en: 'Translate All' },
  translating: { zh: '翻译中...', en: 'Translating...' },
  exportHtml: { zh: '导出 HTML', en: 'Export HTML' },
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
  anchorHere: { zh: '锚定到此块', en: 'Anchor Here' },
  pasteFloat: { zh: '粘贴悬浮', en: 'Paste Float' },
  addFollowNote: { zh: '添加悬浮框文本', en: 'Add Float Text' },
  addFollowLayer: { zh: '添加悬浮框图片', en: 'Add Float Image' },
  pageTranslateTip: { zh: '翻译标题', en: 'Translate Title' },
};

const IS_PUBLISHED = import.meta.env.MODE === 'published';

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

const AutoResizeTextarea = ({ className, style, value, onChange, placeholder, readOnly, onClick }) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value, style]); 
  return <textarea ref={textareaRef} className={className} style={style} rows={1} value={value || ''} onChange={onChange} onClick={onClick} placeholder={placeholder} readOnly={readOnly}/>;
};

// --- 3. Functional UI Components ---

const UnifiedStyleMenu = ({ style, onUpdate, isFloating }) => {
  const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
  const textColors = ['#374151', '#9ca3af', '#dc2626', '#2563eb', '#d97706', '#16a34a', '#ffffff'];
  const bgColors = ['#fffbeb', '#eff6ff', '#f0fdf4', '#fef2f2', '#f3f4f6', '#ffffff', '#1f2937'];
  
  const safeStyle = style || {};

  const changeSize = (delta) => {
    const currentIdx = sizes.indexOf(safeStyle.size || 'text-base');
    const newIdx = Math.max(0, Math.min(sizes.length - 1, currentIdx + delta));
    onUpdate({ ...safeStyle, size: sizes[newIdx] });
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white shadow-xl border border-gray-200 rounded-lg p-2 z-[70] flex flex-col gap-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-150 cursor-default" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center bg-gray-50 rounded border border-gray-100 p-0.5">
           <button onClick={() => changeSize(-1)} className="p-1 hover:bg-white rounded text-gray-500 hover:shadow-sm transition-all"><TypeIcon size={10}/><span className="text-[8px] ml-0.5">-</span></button>
           <div className="w-px h-3 bg-gray-200 mx-1"></div>
           <button onClick={() => changeSize(1)} className="p-1 hover:bg-white rounded text-gray-500 hover:shadow-sm transition-all"><TypeIcon size={10}/><span className="text-[8px] ml-0.5">+</span></button>
        </div>
        <div className="flex items-center gap-1">
           <button onClick={() => onUpdate({ ...safeStyle, weight: safeStyle.weight === 'font-bold' ? 'font-normal' : 'font-bold' })} className={`w-6 h-6 flex items-center justify-center rounded ${safeStyle.weight === 'font-bold' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}><Bold size={13}/></button>
           <button onClick={() => onUpdate({ ...safeStyle, decoration: safeStyle.decoration === 'underline' ? 'none' : 'underline' })} className={`w-6 h-6 flex items-center justify-center rounded ${safeStyle.decoration === 'underline' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}><Underline size={13}/></button>
           {!isFloating && (
             <button onClick={() => onUpdate({ ...safeStyle, isSectionHeader: !safeStyle.isSectionHeader, size: !safeStyle.isSectionHeader ? 'text-2xl' : 'text-base', weight: !safeStyle.isSectionHeader ? 'font-bold' : 'font-normal' })} className={`w-6 h-6 flex items-center justify-center rounded ${safeStyle.isSectionHeader ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`} title="标题"><Heading size={13}/></button>
           )}
        </div>
      </div>

      <div className="space-y-1.5 pt-1 border-t border-gray-100">
        <div className="flex items-center justify-between gap-2">
           <div className="flex gap-1 flex-wrap">
             {textColors.map(c => (
                 <button key={c} onClick={() => onUpdate({ ...safeStyle, color: c })} className={`w-3.5 h-3.5 rounded-full border border-gray-300 hover:scale-125 transition-transform ${safeStyle.color === c ? 'ring-1 ring-offset-1 ring-blue-400' : ''}`} style={{ backgroundColor: c }} title="文字颜色"/>
             ))}
           </div>
           {isFloating && <Palette size={12} className="text-gray-300 shrink-0"/>}
        </div>
        
        {isFloating && (
           <div className="flex gap-1 flex-wrap justify-end">
             {bgColors.map(c => (
                <button key={c} onClick={() => onUpdate({ ...safeStyle, bgColor: c })} className={`w-3.5 h-3.5 rounded-sm border border-gray-300 hover:scale-125 transition-transform ${safeStyle.bgColor === c ? 'ring-1 ring-offset-1 ring-blue-400' : ''}`} style={{ backgroundColor: c }} title="背景颜色"/>
             ))}
           </div>
        )}
      </div>
    </div>
  );
};

const UnifiedToolbar = ({ type, isFloating, style, onUpdateStyle, onTranslate, isTranslating, onCopy, onDelete, isMenuOpen, onToggleMenu, dragHandleProps }) => {
  const btnClass = "w-7 h-7 flex items-center justify-center text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors relative pointer-events-auto"; 
  return (
    <div 
      className={`flex items-center gap-0.5 bg-white border border-gray-200 shadow-lg rounded-lg p-0.5 z-[60] select-none ${isFloating ? 'absolute -top-10 right-0' : 'absolute -top-9 left-0'} animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto`} 
      onMouseDown={e => e.stopPropagation()} 
      onClick={e => e.stopPropagation()} 
    >
      <div className="absolute top-full left-0 w-full h-4 bg-transparent pointer-events-auto"></div>

      {dragHandleProps && <div {...dragHandleProps} className="p-1.5 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing border-r border-gray-100 mr-1"><GripVertical size={14}/></div>}
      {style && (
        <div className="relative">
          <button className={`${btnClass} ${isMenuOpen ? 'bg-blue-50 text-blue-600' : ''}`} onClick={(e) => { e.stopPropagation(); onToggleMenu && onToggleMenu(); }}><Palette size={14}/></button>
          {isMenuOpen && <UnifiedStyleMenu style={style} onUpdate={onUpdateStyle} isFloating={isFloating} />}
        </div>
      )}
      <div className="h-4 w-px bg-gray-200 mx-0.5"></div>
      {type === 'text' && <button onClick={(e) => { e.stopPropagation(); onTranslate && onTranslate(); }} className={`${btnClass} ${isTranslating ? 'animate-spin text-blue-500' : ''}`} disabled={isTranslating}>{isTranslating ? <Loader2 size={14}/> : <Languages size={14}/>}</button>}
      <button onClick={(e) => { e.stopPropagation(); onCopy && onCopy(); }} className={btnClass}><Copy size={14}/></button>
      <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
    </div>
  );
};

const RightToolbar = ({ isEditMode, onAdd, lang }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  if (!isEditMode) return null;
  return (
    <div className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 transition-all duration-300 flex items-start gap-0 print:hidden ${isCollapsed ? 'translate-x-[calc(100%-20px)]' : 'translate-x-0'}`}>
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="mt-8 bg-white border border-r-0 border-gray-200 p-1 rounded-l-md shadow-sm text-gray-500 hover:text-blue-600 z-10">{isCollapsed ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}</button>
      <div className="bg-white border border-gray-200 shadow-xl rounded-l-2xl p-3 flex flex-col gap-4 w-16 items-center">
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{getUi('body', lang)}</div>
        <button onClick={() => onAdd('text', false)} className="group flex flex-col items-center gap-1 w-full"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><FileText size={20}/></div></button>
        <button onClick={() => onAdd('image', false)} className="group flex flex-col items-center gap-1 w-full"><div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><ImageIcon size={20}/></div></button>
      </div>
    </div>
  );
};

const ContextMenu = ({ x, y, onClose, onAdd, targetBlockId, clipboard, onPaste, lang }) => {
  return (
    <div className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-gray-100 py-2 w-48 animate-in fade-in zoom-in-95 duration-100" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {targetBlockId ? (
        <>
          <div className="px-3 py-1 text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1"><Anchor size={12}/> {getUi('anchorHere', lang)}</div>
          {clipboard && <button onClick={() => { onPaste(targetBlockId); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm text-green-700 flex items-center gap-2 border-b border-gray-100 font-bold"><ClipboardCopy size={16}/> {getUi('pasteFloat', lang)}</button>}
          <button onClick={() => { onAdd('text', true, null, targetBlockId); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"><Sticker size={16} className="text-blue-600"/> {getUi('addFollowNote', lang)}</button>
          <button onClick={() => { onAdd('image', true, null, targetBlockId); onClose(); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 flex items-center gap-2"><MousePointer2 size={16} className="text-blue-600"/> {getUi('addFollowLayer', lang)}</button>
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

const InsertZone = ({ onInsert, lang, isOverlay, hidden }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  if (hidden) return null;

  if (isOverlay) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
           onMouseEnter={() => setIsHovered(true)} 
           onMouseLeave={() => setIsHovered(false)}
      >
         <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-blue-300 transition-opacity pointer-events-auto ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
         <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 w-full pointer-events-auto opacity-0" onMouseEnter={() => setIsHovered(true)}></div>
         <div className={`relative z-10 flex items-center gap-2 transition-all transform pointer-events-auto ${isHovered ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
            <button onClick={() => onInsert('text')} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full shadow-lg hover:bg-blue-700 whitespace-nowrap"><FileText size={12}/> {getUi('insertText', lang)}</button>
            <button onClick={() => onInsert('image')} className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-xs rounded-full shadow-lg hover:bg-purple-700 whitespace-nowrap"><ImageIcon size={12}/> {getUi('insertImage', lang)}</button>
         </div>
      </div>
    )
  }

  return (
    <div className={`relative py-1 -my-2 z-10 group/insert transition-all print:hidden ${isHovered ? 'h-8' : 'h-4'} pointer-events-none`} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-blue-300 transition-opacity pointer-events-auto ${isHovered ? 'opacity-100' : 'opacity-0'}`}></div>
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 transition-all transform pointer-events-auto ${isHovered ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
        <button onClick={() => onInsert('text')} className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded-full shadow-lg hover:bg-blue-700"><FileText size={12}/> {getUi('insertText', lang)}</button>
        <button onClick={() => onInsert('image')} className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-xs rounded-full shadow-lg hover:bg-purple-700"><ImageIcon size={12}/> {getUi('insertImage', lang)}</button>
      </div>
    </div>
  );
};

const DraggableBlock = ({ children, layout, onUpdate, isEditMode, onDelete, isSelected, onSelect, hideControls, forceAutoHeight, onHoverChange, setAnyFloatHovered }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef({ x: 0, y: 0, lx: 0, ly: 0, lw: 0, lh: 0 });

  const handleMouseDown = (e, type) => {
    if (!isEditMode) return;
    e.stopPropagation(); e.preventDefault();
    if (onSelect) onSelect();
    startPos.current = { x: e.clientX, y: e.clientY, lx: layout.x || 0, ly: layout.y || 0, lw: layout.width || 200, lh: layout.height || 100 };
    if (type === 'move') setIsDragging(true);
    if (type === 'resize') setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) onUpdate({ x: startPos.current.lx + (e.clientX - startPos.current.x), y: startPos.current.ly + (e.clientY - startPos.current.y) });
      if (isResizing) onUpdate({ width: Math.max(50, startPos.current.lw + (e.clientX - startPos.current.x)), height: Math.max(30, startPos.current.lh + (e.clientY - startPos.current.y)) });
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); document.body.style.userSelect = ''; document.body.style.cursor = ''; };
    if (isDragging || isResizing) { document.body.style.userSelect = 'none'; document.body.style.cursor = isDragging ? 'grabbing' : 'nwse-resize'; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, isResizing]);

  return (
    <div 
      style={{ 
        position: 'absolute', 
        left: layout.x || 0, 
        top: layout.y || 0, 
        width: layout.width || 200, 
        height: forceAutoHeight ? 'auto' : (layout.height || 100), 
        zIndex: isDragging ? 100 : (isSelected ? 90 : 60) 
      }} 
      // [FIX] Removed visual ring from container, added global hover handlers
      className={`group flex flex-col rounded-md transition-shadow pointer-events-auto`} 
      onMouseDown={(e) => { if(isEditMode) { e.stopPropagation(); if (onSelect) onSelect(); } }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => { onHoverChange && onHoverChange(true); setAnyFloatHovered && setAnyFloatHovered(true); }}
      onMouseLeave={() => { onHoverChange && onHoverChange(false); setAnyFloatHovered && setAnyFloatHovered(false); }}
    >
      <div className="flex-1 w-full h-full relative">{children}</div>
      {isEditMode && (
        <>
          <div onMouseDown={(e) => handleMouseDown(e, 'move')} className="absolute -bottom-3 -left-3 w-6 h-6 bg-white border border-gray-200 text-purple-600 rounded-full shadow-sm flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 z-50 hover:bg-purple-50 print:hidden transition-opacity pointer-events-auto"><Move size={12}/></div>
          <div onMouseDown={(e) => handleMouseDown(e, 'resize')} className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 cursor-nwse-resize opacity-0 group-hover:opacity-100 rounded-tl-md z-50 print:hidden pointer-events-auto"/>
        </>
      )}
    </div>
  );
};

const ContentRenderer = ({ block, isEditMode, lang, onUpdateData, onActivate, onPreviewImage, imgClassName }) => {
  const [isDragActive, setIsDragActive] = useState(false); 
  if (!block) return null;
  const style = block.style || {}; 
  const data = block.data || {};
  
  const showZh = lang === 'zh' || lang === 'bilingual';
  const showEn = lang === 'en' || lang === 'bilingual';
  
  const commonStyle = `${style.size || 'text-base'} ${style.weight || 'font-normal'} ${style.decoration === 'underline' ? 'underline' : ''}`;

  if (block.type === 'text') {
    const headerStyle = style.isSectionHeader ? 'border-b-2 border-gray-200 pb-2 mb-2 font-bold text-2xl' : '';
    return (
      <div className={`flex-1 flex flex-col gap-1 overflow-auto no-scrollbar ${headerStyle} pointer-events-auto`}>
         {isEditMode ? (
            <>
              {showZh && <AutoResizeTextarea className={`w-full bg-transparent border-none outline-none resize-none text-gray-800 min-h-[24px] ${commonStyle}`} style={{ color: style.color }} value={data.zh || ''} onChange={e => onUpdateData('zh', e.target.value)} onClick={e => { e.stopPropagation(); onActivate && onActivate(); }} placeholder={getUi('zhLabel', lang)}/>}
              {showEn && <AutoResizeTextarea className={`w-full bg-transparent border-none outline-none resize-none text-gray-500 min-h-[24px] ${commonStyle}`} style={{ color: style.color }} value={data.en || ''} onChange={e => onUpdateData('en', e.target.value)} onClick={e => { e.stopPropagation(); onActivate && onActivate(); }} placeholder={getUi('enLabel', lang)}/>}
            </>
         ) : (
            <div className="flex flex-col h-full">
               {showZh && <div className={`whitespace-pre-wrap ${commonStyle}`} style={{ color: style.color }}>{data.zh || ''}</div>}
               {showEn && data.en && <div className={`whitespace-pre-wrap mt-1 ${commonStyle}`} style={{ color: style.color }}>{data.en}</div>}
            </div>
         )}
      </div>
    );
  }
  if (block.type === 'image') {
    return (
      <div className="w-full h-full relative group/img-att min-h-[50px] pointer-events-auto flex items-center justify-center">
         {data.src ? (
             <img 
               src={data.src} 
               // [FIX] Accept custom imgClassName for cleaner selection borders
               className={imgClassName || `w-full h-full object-contain ${!isEditMode ? 'cursor-zoom-in pointer-events-auto' : ''}`} 
               onClick={(e) => {
                 if (!isEditMode && onPreviewImage) {
                   e.stopPropagation();
                   onPreviewImage(data.src);
                 }
               }}
             />
         ) : (
             <div 
                className={`w-full h-full bg-purple-50/50 border border-dashed ${isDragActive ? 'border-purple-500 bg-purple-100' : 'border-purple-300'} flex flex-col items-center justify-center text-[10px] text-purple-400 p-4 text-center select-none print:hidden transition-colors`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); 
                    setIsDragActive(false);
                    if(e.dataTransfer.files?.[0]) {
                        const r = new FileReader();
                        r.onload = (ev) => onUpdateData('src', ev.target.result);
                        r.readAsDataURL(e.dataTransfer.files[0]);
                    }
                }}
             >
               <UploadCloud size={16} className="mb-2"/>
               <span className="text-xs">{getUi('clickToUpload', lang)}</span>
               <input 
                 type="file" 
                 className="absolute inset-0 opacity-0 cursor-pointer pointer-events-auto z-10" 
                 onChange={e => { if(e.target.files?.[0]) { const r = new FileReader(); r.onload = (ev) => onUpdateData('src', ev.target.result); r.readAsDataURL(e.target.files[0]); } }}
                 onClick={e => { e.stopPropagation(); onActivate && onActivate(); }} 
               />
             </div>
         )}
      </div>
    );
  }
  return null;
};

const FloatBlockInner = ({ block, isEditMode, isViewOnly, lang, onUpdateData, onUpdateStyle, onUpdateLayout, onTranslate, isTranslating, isSelected, onDelete, onCopy, isMenuOpen, onToggleMenu, onActivate, onPreviewImage }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  if (!block) return null;
  const style = block.style || {}; 
  const data = block.data || {};

  const isImage = block.type === 'image';
  const bgColor = isImage ? 'transparent' : (style.bgColor || '#fffbeb');
  
  // [FIX] Layout and border logic separation
  const containerClass = isImage 
    ? `w-full h-full flex items-center justify-center relative group/float` // Center images, no default border
    : `w-full h-full px-4 py-3 border shadow-sm rounded flex flex-col transition-colors relative group/float ${isEditMode && !isViewOnly && isSelected ? 'ring-2 ring-purple-500 shadow-lg' : ''}`; // Border/Ring on Text Container

  // [FIX] Apply ring directly to image element so it hugs the image content
  const imgClasses = isImage && isEditMode && !isViewOnly && isSelected 
      ? `max-w-full max-h-full w-auto h-auto object-contain ring-2 ring-purple-500 shadow-lg cursor-pointer` 
      : `w-full h-full object-contain ${!isEditMode ? 'cursor-zoom-in pointer-events-auto' : ''}`;

  return (
    <div 
      className={containerClass} 
      style={{ backgroundColor: bgColor, borderColor: isEditMode && !isViewOnly && !isImage ? (isSelected ? '#a78bfa' : '#e5e7eb') : 'transparent' }} 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)} 
      onClick={(e) => { e.stopPropagation(); onActivate(); }}
    >
      {isEditMode && !isViewOnly && (isSelected || isHovered || isMenuOpen) && (
        <>
            {block.type === 'text' && (
                <UnifiedToolbar type={block.type} isFloating={true} style={block.style} onUpdateStyle={onUpdateStyle} onTranslate={onTranslate} isTranslating={isTranslating} onCopy={onCopy} onDelete={onDelete} isMenuOpen={isMenuOpen} onToggleMenu={onToggleMenu}/>
            )}
            {block.type === 'image' && (
                <div 
                   className="absolute -top-9 right-0 flex items-center gap-1 bg-white border border-gray-200 shadow-sm p-1 rounded-md z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-auto"
                   onClick={(e) => e.stopPropagation()}
                >
                   <div className="absolute top-full right-0 w-full h-4 bg-transparent"></div>
                   <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Copy size={14}/></button>
                   <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                </div>
            )}
        </>
      )}
      <ContentRenderer block={block} isEditMode={!isViewOnly && isEditMode} lang={lang} onUpdateData={onUpdateData} onActivate={onActivate} onPreviewImage={onPreviewImage} imgClassName={imgClasses} />
    </div>
  );
};

const FlowBlock = ({ children, isEditMode, onDelete, onUpdateStyle, style, index, onDragStart, onDragOver, onDrop, onContextMenu, id, attachments, onUpdateAttachment, onDeleteAttachment, onPreviewImage, onCopyAttachment, lang, type, onTranslate, isTranslating, isMenuOpen, onToggleMenu, isActive, onActivate, activeMenuId, setActiveMenuId, updateBlockData, blockData, anyFloatHovered, setAnyFloatHovered }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFloatHovered, setIsFloatHovered] = useState(false); 

  return (
    <div 
      className={`group relative transition-all ${isEditMode ? 'rounded-lg border-2' : ''} ${isDragOver && isEditMode ? 'border-blue-400 bg-blue-50' : 'border-transparent'} ${isEditMode ? 'hover:border-gray-200' : ''} ${isFloatHovered ? 'z-[100]' : (isHovered || isMenuOpen || isActive ? 'z-30' : 'z-10')}`}
      onMouseEnter={() => { setIsHovered(true); }}
      onMouseLeave={() => { setIsHovered(false); }}
      onDragOver={(e) => { if (!isEditMode) return; e.preventDefault(); onDragOver(e, index); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { if (!isEditMode) return; e.preventDefault(); setIsDragOver(false); onDrop(e, index); }}
      onContextMenu={(e) => onContextMenu(e, id)} 
      onClick={(e) => { if(isEditMode) { e.stopPropagation(); onActivate && onActivate(); } }}
    >
      {isEditMode && (isHovered || isMenuOpen || isActive) && type === 'text' && (
        <UnifiedToolbar type={type} isFloating={false} style={style} onUpdateStyle={onUpdateStyle} onTranslate={onTranslate} isTranslating={isTranslating} onCopy={() => onCopyAttachment(type, { zh: '...', en: '...' })} onDelete={onDelete} dragHandleProps={{ draggable: true, onDragStart: (e) => onDragStart(e, index) }} isMenuOpen={isMenuOpen} onToggleMenu={onToggleMenu}/>
      )}
      {isEditMode && (isHovered || isActive) && type === 'image' && (
         <div className="absolute -top-3 -right-3 flex gap-1 z-50 pointer-events-auto">
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-red-500 text-white p-1 rounded-full shadow-md hover:scale-110 transition-transform"><Trash2 size={12}/></button>
         </div>
      )}

      <div className={isEditMode ? "p-3 relative" : "relative"}>
        {/* [FIX] Disable pointer events on text content when a float is being hovered to prevent stealing focus */}
        <div style={{ pointerEvents: anyFloatHovered ? 'none' : 'auto' }}>
            <ContentRenderer block={{ type, data: blockData, style }} isEditMode={isEditMode} lang={lang} onUpdateData={(field, val) => updateBlockData(field, val)} onActivate={onActivate} onPreviewImage={onPreviewImage} />
        </div>
        
        {attachments?.map(att => {
            const safeAtt = {
                ...att,
                style: att.style || { size: 'text-xs', bgColor: '#fffbeb', color: '#374151' }
            };
            return (
                <DraggableBlock 
                   key={att.id} 
                   layout={att.layout} 
                   isEditMode={isEditMode} 
                   isSelected={isActive === att.id} 
                   onSelect={() => onActivate(att.id)} 
                   onUpdate={(newLayout) => onUpdateAttachment(id, att.id, { layout: newLayout })} 
                   onDelete={() => onDeleteAttachment(id, att.id)} 
                   hideControls={true}
                   forceAutoHeight={lang === 'zh' && att.type === 'text'}
                   onHoverChange={setIsFloatHovered}
                   setAnyFloatHovered={setAnyFloatHovered} // Pass global hover setter
                >
                   <FloatBlockInner 
                      block={safeAtt} isEditMode={isEditMode} isViewOnly={false} lang={lang} 
                      onUpdateData={(field, val) => onUpdateAttachment(id, att.id, { data: { ...att.data, [field]: val } })} 
                      onUpdateStyle={(newStyle) => onUpdateAttachment(id, att.id, { style: newStyle })} 
                      onUpdateLayout={(newLayout) => onUpdateAttachment(id, att.id, { layout: newLayout })} 
                      onTranslate={() => onTranslate(att.id)} isTranslating={isTranslating === att.id} isSelected={isActive === att.id} 
                      onDelete={() => onDeleteAttachment(id, att.id)} onCopy={() => onCopyAttachment(att.type, att.data)} 
                      isMenuOpen={activeMenuId === att.id} onToggleMenu={() => setActiveMenuId(activeMenuId === att.id ? null : att.id)} 
                      onActivate={() => onActivate(att.id)}
                      onPreviewImage={onPreviewImage}
                   />
                </DraggableBlock>
            );
        })}
      </div>
    </div>
  );
};

// --- 4. Main Application ---

const App = () => {
  const [isEditMode, setIsEditMode] = useState(!IS_PUBLISHED);
  const [isViewOnly] = useState(IS_PUBLISHED);
  const [lang, setLang] = useState('bilingual'); 
  const [activePageId, setActivePageId] = useState('p1');
  const [isTranslating, setIsTranslating] = useState(false); 
  const [translatingBlockId, setTranslatingBlockId] = useState(null); 
  const [docData, setDocData] = useState(INITIAL_DATA);
  const [activeBlockId, setActiveBlockId] = useState(null); 
  const [activeMenuId, setActiveMenuId] = useState(null); 
  const [contextMenu, setContextMenu] = useState(null); 
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
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState(IS_PUBLISHED ? 'saved' : 'loading');
  const [isPublishing, setIsPublishing] = useState(false);
  const [githubStatus, setGithubStatus] = useState(null);
  const [isGithubConnecting, setIsGithubConnecting] = useState(false);
  const saveTimerRef = useRef(null);
  const lastPersistedRef = useRef('');
  const latestDocumentRef = useRef(INITIAL_DATA);
  const canvasRef = useRef(null); 
  const apiKey = ""; 

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const endpoint = IS_PUBLISHED ? './document-data.json' : '/api/document';
        const response = await fetch(endpoint, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Document load failed (${response.status})`);
        const document = await response.json();
        if (cancelled) return;
        const serialized = JSON.stringify(document);
        lastPersistedRef.current = serialized;
        latestDocumentRef.current = document;
        setDocData(document);
        setActivePageId(document.pages?.[0]?.id || '');
        setSaveState('saved');
        setIsLoaded(true);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSaveState('error');
          setIsLoaded(true);
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
    latestDocumentRef.current = docData;
    if (!isLoaded || IS_PUBLISHED) return undefined;
    const serialized = JSON.stringify(docData);
    if (serialized === lastPersistedRef.current) return undefined;
    setSaveState('saving');
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: serialized,
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || `Save failed (${response.status})`);
        }
        lastPersistedRef.current = serialized;
        setSaveState('saved');
      } catch (error) {
        console.error(error);
        setSaveState('error');
      }
    }, 700);
    return () => window.clearTimeout(saveTimerRef.current);
  }, [docData, isLoaded]);

  const showToast = (message, type = 'info') => setToast({ message, type });

  const saveImmediately = async () => {
    if (IS_PUBLISHED) return;
    window.clearTimeout(saveTimerRef.current);
    const document = latestDocumentRef.current;
    const serialized = JSON.stringify(document);
    if (serialized === lastPersistedRef.current) return;
    setSaveState('saving');
    const response = await fetch('/api/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized,
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Save failed (${response.status})`);
    }
    lastPersistedRef.current = serialized;
    setSaveState('saved');
  };

  const publishDocument = async () => {
    if (!window.confirm('发布将保存当前文档、构建公开网站，并在 GitHub 配置完成后推送更新。是否继续？')) return;
    setIsPublishing(true);
    try {
      await saveImmediately();
      const response = await fetch('/api/publish', { method: 'POST' });
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
        const newAtt = { id: `a${Date.now()}`, type, isFloating: true, layout: { x: contextMenu?.relativeX ?? 20, y: contextMenu?.relativeY ?? -20, width: 150, height: 100 }, data: JSON.parse(JSON.stringify(clipboard ? clipboard.data : (type === 'text' ? { zh: '...', en: '' } : { src: '' }))), style: { size: 'text-xs', bgColor: '#fffbeb' } };
        updateContent(blocks => blocks.map(b => b.id === targetBlockId ? { ...b, attachments: [...(b.attachments || []), newAtt] } : b));
        return;
    }
    const layout = undefined;
    const newBlock = { id: `b${Date.now()}`, type, isFloating: false, style: { size: 'text-base', weight: 'font-normal', color: '#374151', decoration: 'none', isSectionHeader: false }, layout, data: type === 'text' ? { zh: '点此输入...', en: '...' } : { src: '' }, attachments: [] };
    updateContent(blocks => { const flow = blocks.filter(b => !b.isFloating); if (index !== null) flow.splice(index, 0, newBlock); else flow.push(newBlock); return flow; });
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

      if (b.type === 'text') {
        if (showZh) {
            const divZh = document.createElement('div');
            divZh.className = 'text-content ' + commonStyle + ' ' + headerStyle;
            divZh.style.color = style.color;
            divZh.textContent = b.data.zh || '';
            bDiv.appendChild(divZh);
        }

        if (showEn && b.data.en) {
          const divEn = document.createElement('div');
          // UPDATED: Added headerStyle to English block as well to ensure consistency
          divEn.className = 'text-content mt-1 ' + commonStyle + ' ' + (style.isSectionHeader ? 'font-bold text-2xl' : '');
          divEn.style.color = style.color;
          divEn.textContent = b.data.en;
          bDiv.appendChild(divEn);
        }
      } else if (b.type === 'image') {
        if (b.data.src) {
            const img = document.createElement('img');
            img.src = b.data.src;
            img.className = 'rounded';
            bDiv.appendChild(img);
        }
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
            const aImg = document.createElement('img');
            aImg.src = a.data.src;
            aImg.className = 'w-full h-full object-contain';
            ad.appendChild(aImg);
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

  const blocks = docData.content[activePageId]?.blocks || [];
  const flowBlocks = blocks.filter(b => !b.isFloating);

  return (
    <div className="flex h-screen bg-[#f9fafb] font-sans text-gray-900 overflow-hidden app-root" onClick={() => { setContextMenu(null); setActiveBlockId(null); setActiveMenuId(null); }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmModal && <ConfirmModal {...confirmModal} />}
      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      <nav className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm shrink-0 z-40 print:hidden">
         <div className="p-5 flex items-center gap-3 border-b border-gray-100">
             <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shrink-0"><BookOpen size={18}/></div>
             {!isViewOnly && isEditMode ? <input className="font-bold text-gray-800 bg-transparent outline-none w-full" value={docData.sidebarTitle} onChange={(e) => setDocData({...docData, sidebarTitle: e.target.value})}/> : <div className="font-bold">{docData.sidebarTitle}</div>}
         </div>
         <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {docData.pages.map(p => (
              <div key={p.id} onClick={() => setActivePageId(p.id)} draggable={!isViewOnly && isEditMode} onDragStart={(e) => { setDraggedPageId(p.id); e.dataTransfer.effectAllowed = "move"; }} onDrop={(e) => { e.preventDefault(); if(!draggedPageId || draggedPageId === p.id) return; const ps = [...docData.pages]; const f = ps.findIndex(x=>x.id===draggedPageId); const t = ps.findIndex(x=>x.id===p.id); const [m] = ps.splice(f,1); ps.splice(t,0,m); setDocData(d=>({...d, pages: ps})); setDraggedPageId(null); }} onDragOver={(e) => e.preventDefault()} className={`group flex items-center justify-between w-full px-3 py-2.5 rounded-lg cursor-pointer transition-all ${activePageId === p.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>
                <div className="flex items-center gap-3 overflow-hidden w-full relative">
                   <div className="flex items-center gap-3 overflow-hidden w-full">
                       {activePageId === p.id ? <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"/> : <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 group-hover:bg-gray-400"/>}
                       
                       {/* [UPDATE] New Sidebar Page Edit Logic: 2 Inputs + Translate */}
                       {!isViewOnly && isEditMode && editingPageId === p.id ? (
                           <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()} 
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
                               <input autoFocus className="bg-white border border-blue-300 rounded px-1.5 py-1 text-sm w-full" value={tempPageTitle} onChange={e => setTempPageTitle(e.target.value)} placeholder="中文标题" />
                               <div className="flex gap-1">
                                   <input className="bg-white border border-gray-200 rounded px-1.5 py-1 text-xs w-full text-gray-600" value={tempPageTitleEn} onChange={e => setTempPageTitleEn(e.target.value)} placeholder="English Title" />
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
                                    <button className="px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700" onClick={() => {
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
                {!isViewOnly && isEditMode && activePageId === p.id && !editingPageId && <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><button onClick={(e) => { e.stopPropagation(); setEditingPageId(p.id); setTempPageTitle(p.title.zh); setTempPageTitleEn(p.title.en || ""); }} className="p-1 hover:bg-blue-200 rounded text-blue-600"><Pencil size={12}/></button><button onClick={(e) => deletePage(p.id, e)} className="p-1 hover:bg-red-200 rounded text-red-500"><Trash2 size={12}/></button></div>}
              </div>
            ))}
         </div>
         <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
             {!isViewOnly && isEditMode && <button onClick={addPage} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm hover:border-blue-400 hover:text-blue-600 hover:bg-white transition-all flex items-center justify-center gap-2"><Plus size={14}/> {getUi('newPage', lang)}</button>}
             <div>
                {/* [UPDATE] Added Language Label */}
                <div className="text-xs font-bold text-gray-500 text-center mb-2">{getUi('langLabel', lang)}</div>
                <div className="flex bg-white p-1 rounded-lg border shadow-sm">{['zh', 'en', 'bilingual'].map(l => (<button key={l} onClick={() => setLang(l)} className={`flex-1 py-1.5 text-[10px] rounded font-medium uppercase transition-colors ${lang === l ? 'bg-gray-800 text-white shadow' : 'text-gray-400 hover:text-gray-600'}`}>{l}</button>))}</div>
             </div>
         </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-30 transition-all print:hidden">
          <div className="flex-1 mr-8">
             {!isViewOnly && isEditMode ? <input className="text-xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none w-full py-1" value={docData.docTitle} onChange={e => setDocData({...docData, docTitle: e.target.value})} placeholder={getUi('docTitlePlaceholder', lang)}/> : <h2 className="text-xl font-bold text-gray-800">{docData.docTitle}</h2>}
          </div>
          <div className="flex items-center gap-4 shrink-0">
             {!isViewOnly && (
               <>
                 <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0"><button onClick={() => setIsEditMode(false)} className={`px-2 py-1.5 text-xs font-bold rounded-md flex gap-1 items-center ${!isEditMode ? 'bg-white shadow-sm' : 'text-gray-400'}`}><Eye size={14}/> {getUi('previewMode', lang)}</button><button onClick={() => setIsEditMode(true)} className={`px-2 py-1.5 text-xs font-bold rounded-md flex gap-1 items-center ${isEditMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}><Edit3 size={14}/> {getUi('editMode', lang)}</button></div>
                 <div className="h-6 w-px bg-gray-200 shrink-0"></div>
                  {isEditMode && <button onClick={translateAllText} disabled={isTranslating} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${isTranslating ? 'bg-gray-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>{isTranslating ? <Loader2 size={12} className="animate-spin"/> : <Languages size={14}/>} {isTranslating ? '...' : getUi('aiTranslate', lang)}</button>}
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${saveState === 'error' ? 'text-red-600' : saveState === 'saving' || saveState === 'loading' ? 'text-amber-600' : 'text-emerald-600'}`} title={saveState === 'error' ? getUi('saveError', lang) : getUi(saveState, lang)}>
                    {saveState === 'saving' || saveState === 'loading' ? <Loader2 size={14} className="animate-spin"/> : saveState === 'error' ? <AlertTriangle size={14}/> : <Save size={14}/>} 
                    <span className="hidden xl:inline">{saveState === 'error' ? getUi('saveError', lang) : getUi(saveState, lang)}</span>
                  </div>
                  <button onClick={connectGitHub} disabled={isGithubConnecting || githubStatus?.available === false} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all whitespace-nowrap ${githubStatus?.authenticated ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-700'} disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`} title={githubStatus?.authenticated ? `${getUi('githubConnected', lang)}：${githubStatus.accounts.join(', ')}（点击重新登录或切换账号）` : getUi('githubLogin', lang)}>
                    {isGithubConnecting ? <Loader2 size={15} className="animate-spin"/> : <LogIn size={15}/>}
                    <span>{isGithubConnecting ? getUi('githubConnecting', lang) : githubStatus?.authenticated ? githubStatus.accounts[0] : getUi('githubLogin', lang)}</span>
                  </button>
                  <button onClick={handleExportHtml} className="w-8 h-8 flex items-center justify-center text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg" title={getUi('exportHtml', lang)}><FileCode size={16}/></button>
                  <button onClick={publishDocument} disabled={isPublishing || saveState === 'error'} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-all shadow-md text-sm font-bold">
                    {isPublishing ? <Loader2 size={16} className="animate-spin"/> : <UploadCloud size={16}/>} 
                    <span>{isPublishing ? getUi('publishing', lang) : getUi('publish', lang)}</span>
                  </button>
               </>
             )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#f3f4f6] relative print:bg-white print:overflow-visible" onContextMenu={(e) => { if(isEditMode) { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, targetBlockId: null }); } }}>
          {/* FIX: Locked width to A4 (794px) to match export layout */}
          <div ref={canvasRef} className="w-[794px] mx-auto my-12 bg-white min-h-[1000px] shadow-sm border border-gray-200 px-16 py-16 relative print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none">
            <div className="relative z-10 space-y-4">
              {/* FIX: InsertZone top - also receives hidden prop */}
              {!isViewOnly && isEditMode && <InsertZone onInsert={(type) => addBlock(type, false, 0)} lang={lang} hidden={activeMenuId !== null} />}
              
              {flowBlocks.map((block, index) => (
                // [FIX] REMOVED z-0 to fix stacking context issues allowing floats to be above other text blocks
                <div key={block.id} className="relative pointer-events-none">
                  <FlowBlock 
                    id={block.id} index={index} 
                    isEditMode={!isViewOnly && isEditMode} 
                    onDelete={() => deleteBlock(block.id)} 
                    style={block.style} 
                    onUpdateStyle={(s) => updateBlockStyle(block.id, s)} 
                    onDragStart={(e) => { setDraggedIndex(index); e.dataTransfer.effectAllowed = "move"; }} 
                    onDragOver={(e) => e.preventDefault()} 
                    onDrop={handleFlowDrop} 
                    onContextMenu={(e) => { if(!isEditMode) return; e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, relativeX: e.clientX - e.currentTarget.getBoundingClientRect().left, relativeY: e.clientY - e.currentTarget.getBoundingClientRect().top, targetBlockId: block.id }); }} 
                    attachments={block.attachments} 
                    onUpdateAttachment={updateAttachment} 
                    onDeleteAttachment={deleteAttachment} 
                    onPreviewImage={setPreviewImage} 
                    onCopyAttachment={(type, data) => { setClipboard({type, data}); showToast(getUi('copySuccess', lang), 'success'); }} 
                    lang={lang}
                    type={block.type}
                    // FIX: Pass arguments to translation function
                    onTranslate={(targetId) => translateBlock(targetId || block.id)}
                    isTranslating={translatingBlockId === block.id}
                    isActive={activeBlockId === block.id}
                    onActivate={(id) => { const targetId = id || block.id; if (activeBlockId !== targetId) setActiveBlockId(targetId); }} 
                    activeMenuId={activeMenuId}
                    setActiveMenuId={setActiveMenuId}
                    updateBlockData={(field, val) => updateBlockData(block.id, field, val)}
                    blockData={block.data}
                    // FIX: Missing Props added
                    isMenuOpen={activeMenuId === block.id} 
                    onToggleMenu={() => setActiveMenuId(activeMenuId === block.id ? null : block.id)}
                    anyFloatHovered={anyFloatHovered}
                    setAnyFloatHovered={setAnyFloatHovered}
                  />
                  {!isViewOnly && isEditMode && (
                     // FIX: Use absolute positioning to place InsertZone exactly in the gap
                     // FIX: z-0 ensures it is below the text content (which is z-10 or z-30)
                     <div className="absolute left-0 right-0 top-full h-4 z-0 pointer-events-none">
                        {/* FIX: Pass hidden prop to prevent interference */}
                        <InsertZone onInsert={(type) => addBlock(type, false, index + 1)} lang={lang} isOverlay={true} hidden={activeMenuId !== null} />
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <RightToolbar isEditMode={!isViewOnly && isEditMode} onAdd={addBlock} lang={lang} />
        {contextMenu && !isViewOnly && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} />
            <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onAdd={addBlock} targetBlockId={contextMenu.targetBlockId} clipboard={clipboard} onPaste={(tid) => { if(!clipboard) return; const newAtt = { id: `a${Date.now()}`, type: clipboard.type, isFloating: true, layout: { x: contextMenu.relativeX, y: contextMenu.relativeY, width: 150, height: 100 }, data: JSON.parse(JSON.stringify(clipboard.data)), style: { size: 'text-xs', bgColor: '#fffbeb' } }; updateContent(blocks => blocks.map(b => b.id !== tid ? b : { ...b, attachments: [...(b.attachments || []), newAtt] })); }} lang={lang} />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
