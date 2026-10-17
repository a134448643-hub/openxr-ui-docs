import React, { useEffect, useRef, useState } from 'react';
import { Extension, Node } from '@tiptap/core';
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, FontSize, Color } from '@tiptap/extension-text-style';
import { Plugin } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { Bold, Italic, Underline, Undo2, Redo2, RemoveFormatting, ImagePlus, Heading, Paintbrush, RotateCcw } from 'lucide-react';
import { applySelectedHeading } from './heading-command.mjs';
import { captureTextFormat, paintTextFormat } from './format-painter.mjs';
import { paragraphAfterImage, paragraphAfterSelectedImage, paragraphBeforeImage, paragraphBeforeSelectedImage } from './image-paragraph.mjs';
import { dropExistingImage } from './image-drag.mjs';
import { ImageSurface, FloatObject } from './document-image-tools.jsx';
import { documentFromRecords, recordsFromDocument, richId, TEXT_SIZE_PIXELS } from '../server/document-rich-text.mjs';
import { normalizeTypography } from '../server/document-typography.mjs';
import { DOCUMENT_CANVAS_WIDTH, canvasScale, elementScale, hasFloatingContent } from './document-canvas.mjs';

const INK_COLORS = ['#374151', '#9ca3af', '#dc2626', '#2563eb', '#d97706', '#16a34a'];

function clipboardImages(event) {
  const clipboard = event.clipboardData;
  const files = [...(clipboard?.files || [])].filter(file => file.type.startsWith('image/'));
  return files.length ? files : [...(clipboard?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
}

function legacyTextStyle(style = {}) {
  const declarations = [];
  if (TEXT_SIZE_PIXELS[style.size]) declarations.push(`--doc-legacy-size:${TEXT_SIZE_PIXELS[style.size]}px`);
  if (style.weight) declarations.push(`--doc-legacy-weight:${style.weight === 'font-bold' ? 700 : 400}`);
  if (style.color && style.color !== '#374151') declarations.push(`color:${style.color}`);
  if (style.customTypography) {
    if (TEXT_SIZE_PIXELS[style.size]) declarations.push(`font-size:${TEXT_SIZE_PIXELS[style.size]}px`);
    if (style.weight) declarations.push(`font-weight:${style.weight === 'font-bold' ? 700 : 400}`);
  }
  if (style.decoration === 'underline') declarations.push('text-decoration:underline');
  return declarations.join(';');
}

const ParagraphIdentity = Extension.create({
  name: 'documentParagraphs',
  addOptions() { return { language: 'zh' }; },
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: {
      recordId: { default: null, keepOnSplit: true, parseHTML: element => element.getAttribute('data-record-id'), renderHTML: attrs => attrs.recordId ? { 'data-record-id': attrs.recordId } : {} },
      field: { default: this.options.language, parseHTML: element => element.getAttribute('data-language') || this.options.language, renderHTML: attrs => ({ 'data-language': attrs.field }) },
      legacyStyle: { default: {}, rendered: false },
    } }];
  },
  addProseMirrorPlugins() {
    const defaultLanguage = this.options.language;
    return [new Plugin({ appendTransaction: (_transactions, old, state) => {
      const identities = new Set(), objects = new Set();
      const tr = state.tr;
      state.doc.descendants((node, position) => {
        if (node.type.name === 'paragraph' || node.type.name === 'heading') {
          const key = `${node.attrs.recordId}:${node.attrs.field}`;
          if (!node.attrs.recordId || identities.has(key)) {
            const id = richId(); identities.add(`${id}:${node.attrs.field}`);
            tr.setNodeMarkup(position, undefined, { ...node.attrs, recordId: id });
          } else identities.add(key);
        } else if (node.attrs.item) {
          if (objects.has(node.attrs.item.id)) tr.setNodeMarkup(position, undefined, { ...node.attrs, item: { ...node.attrs.item, id: richId() } });
          else objects.add(node.attrs.item.id);
        }
      });
      if (old.selection.from <= 1 && old.selection.to >= old.doc.content.size - 1 && state.doc.childCount === 1 && state.doc.firstChild.isTextblock) {
        const field = old.doc.firstChild.attrs.field || defaultLanguage;
        const first = tr.doc.firstChild;
        if (first.attrs.field !== field) tr.setNodeMarkup(0, undefined, { ...first.attrs, field });
      }
      return tr.docChanged ? tr : null;
    } })];
  },
});

function useNodePlacement(editor, node) {
  const [geometry, setGeometry] = useState({ width: 642, originY: 0 });
  useEffect(() => {
    if (!editor?.view?.dom) return;
    const root = editor.view.dom;
    const measure = () => {
      const anchor = node.attrs.anchorId && root.querySelector(`[data-record-id="${CSS.escape(node.attrs.anchorId)}"]`);
      const next = { width: root.clientWidth || DOCUMENT_CANVAS_WIDTH, originY: anchor ? (anchor.getBoundingClientRect().top - root.getBoundingClientRect().top) / elementScale(root) : 0 };
      setGeometry(old => old.width === next.width && old.originY === next.originY ? old : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    const observe = () => { observer.observe(root); for (const child of root.children) observer.observe(child); measure(); };
    observe(); editor.on('update', observe);
    return () => { observer.disconnect(); editor.off('update', observe); };
  }, [editor, node.attrs.anchorId]);
  return geometry;
}

function DocumentImageView({ editor, node, updateAttributes, getPos, selected, deleteNode }) {
  const [tool, setTool] = useState('move');
  const language = editor.storage.documentUI.language;
  const [activeImage, setActiveImage] = useState(language === 'en' ? 'en' : 'zh');
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const englishFile = useRef(null);
  const geometry = useNodePlacement(editor, node);
  const item = node.attrs.item;
  const editable = editor.isEditable;
  useEffect(() => {
    if (!item.data?.src) return;
    const image = new Image(); let active = true;
    image.onload = () => { if (active && image.naturalWidth && image.naturalHeight) setAspectRatio(image.naturalWidth / image.naturalHeight); };
    image.src = item.data.src;
    return () => { active = false; image.onload = null; };
  }, [item.data?.src]);
  const patch = changes => updateAttributes({ item: { ...item, ...changes } });
  const beginGesture = () => { editor.view.dispatch(closeHistory(editor.state.tr)); editor.view.focus(); };
  const select = () => { const position = getPos(); if (typeof position === 'number') editor.chain().focus(undefined, { scrollIntoView: false }).setNodeSelection(position).run(); };
  const continueAfter = (event, reuseFollowing, before = false) => {
    if (!editable || item.isFloating) return;
    const position = getPos();
    if (typeof position !== 'number') return;
    const surfaces = [...event.currentTarget.querySelectorAll('[data-image-language]')];
    const targetSurface = event.target.closest('[data-image-language]') || surfaces.find(surface => { const box = surface.getBoundingClientRect(); return event.clientY >= box.top && event.clientY <= box.bottom; });
    const field = targetSurface?.dataset.imageLanguage || activeImage;
    const command = before ? paragraphBeforeImage(position, { language: field, reusePrevious: reuseFollowing }) : paragraphAfterImage(position, { language: field, reuseFollowing });
    if (!command({ state: editor.state })) return;
    event.preventDefault(); event.stopPropagation();
    editor.chain().command(command).focus(undefined, { scrollIntoView: false }).run();
  };
  const uploadEnglish = async file => {
    if (!file || !editable) return;
    try {
      const srcEn = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
      const position = getPos();
      if (editor.isDestroyed || typeof position !== 'number') return;
      const latest = editor.state.doc.nodeAt(position)?.attrs.item;
      if (!latest || latest.id !== item.id) return;
      beginGesture(); updateAttributes({ item: { ...latest, data: { ...latest.data, srcEn, shareWithEnglish: false } } });
    } catch (error) { window.alert(`英文图片添加失败：${error.message}`); }
  };
  const renderPicture = field => {
    const english = field === 'en';
    const shared = english && item.data?.shareWithEnglish;
    const surfaceItem = english ? { ...item, data: { ...item.data, src: shared ? item.data.src : item.data?.srcEn || '' }, annotations: shared ? item.annotations : item.data?.enAnnotations || [], style: { ...item.style, annotations: shared ? item.style?.annotations : [] } } : item;
    return <ImageSurface key={field} unifiedEditor imageLanguage={field} item={{ ...surfaceItem, isAttachment: Boolean(node.attrs.anchorId) }} editable={editable} selected={selected && activeImage === field} tool={activeImage === field ? tool : 'move'} columnWidth={geometry.width} lang={language}
    emptyLabel={english ? '待补英文图片 · 选中后 Ctrl+V 粘贴截图，或同步中文图片' : undefined} emptyAspectRatio={english ? aspectRatio : undefined}
    toolbarContent={english ? <>
      <button type="button" className="doc-text-btn" aria-pressed={Boolean(shared)} disabled={!item.data?.src} onClick={() => { beginGesture(); patch({ data: { ...item.data, shareWithEnglish: !shared } }); }}>{shared ? '取消同步中文图片' : '同步中文图片'}</button>
      <button type="button" className="doc-text-btn" onClick={() => englishFile.current?.click()}>上传英文图片</button>
      {item.isFloating && language === 'bilingual' && <button type="button" className="doc-text-btn" onClick={() => { setActiveImage('zh'); setTool('move'); }}>显示中文图片</button>}
    </> : item.isFloating && language === 'bilingual' ? <button type="button" className="doc-text-btn" onClick={() => { setActiveImage('en'); setTool('move'); }}>显示英文配图</button> : undefined}
    deleteLabel={english ? '清除英文图片' : '删除图片'}
    onSelect={() => { if (activeImage !== field) setTool('move'); setActiveImage(field); editor.storage.documentUI.imageLanguage = field; select(); }} onTool={setTool}
    onWidth={(_id, imageWidth) => patch({ style: { ...item.style, imageWidth } })}
    onAnnotations={(_id, annotations) => english && !shared ? patch({ data: { ...item.data, enAnnotations: annotations } }) : patch({ annotations, style: { ...item.style, annotations } })}
    onToggleFloat={() => { beginGesture(); patch({ isFloating: !item.isFloating, layout: item.layout || { rx: .12, ry: .1, rw: .6, rh: .3 } }); updateAttributes({ anchorId: null }); }}
    onUndo={beginGesture} onPreview={src => editor.storage.documentUI.preview(src)} onDragStart={() => { editor.storage.documentUI.draggedImageId = item.id; }} onDelete={() => { beginGesture(); if (english) patch({ data: { ...item.data, srcEn: '', shareWithEnglish: false, enAnnotations: [] } }); else deleteNode(); editor.view.focus(); }}/>;
  };
  const picture = <>{item.isFloating && language === 'bilingual' ? renderPicture(activeImage) : <>{language !== 'en' && renderPicture('zh')}{language !== 'zh' && renderPicture('en')}</>}{editable && <input ref={englishFile} type="file" aria-label="选择英文图片" accept="image/*" hidden onChange={event => { void uploadEnglish(event.target.files?.[0]); event.target.value = ''; }}/>}</>;
  return <NodeViewWrapper className={item.isFloating ? 'doc-floating-anchor' : 'doc-rich-image'} data-image-id={item.id} contentEditable={false} data-drag-handle={item.isFloating ? undefined : ''}
    onPasteCapture={event => {
      if (!editable || event.target.closest('input,textarea,[data-field]')) return;
      const files = clipboardImages(event);
      if (!files.length) return;
      event.preventDefault(); event.stopPropagation();
      void editor.storage.documentUI.pasteImages(files, undefined, { id: item.id, field: activeImage });
    }}
    onDragEnd={() => { editor.storage.documentUI.draggedImageId = null; }}
    onMouseDown={event => { if (event.button === 0 && !event.target.closest('.doc-image-wrap')) continueAfter(event, true); }}
    onKeyDownCapture={event => { if (['Enter', 'ArrowUp'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('button,input,textarea,select,[data-field]')) continueAfter(event, event.key === 'ArrowUp', event.key === 'ArrowUp'); }}>
    {editable && !item.isFloating && <div className="doc-image-text-boundary" data-image-boundary="before" aria-label="在图片上方输入文字" onMouseDown={event => { if (event.button === 0) continueAfter(event, true, true); }}/>}
    {item.isFloating ? <FloatObject item={item} editable={editable} selected={selected} columnWidth={geometry.width} originY={geometry.originY} canDrag={tool === 'move'} onSelect={select} onGestureStart={beginGesture} onLayout={(_id, layout) => patch({ layout })}>{picture}</FloatObject> : picture}
  </NodeViewWrapper>;
}

function FloatingTextView({ editor, node, updateAttributes, getPos, selected, selectionInside }) {
  const geometry = useNodePlacement(editor, node);
  const item = node.attrs.item;
  return <NodeViewWrapper className="doc-floating-anchor" data-note-id={item.id}>
    <FloatObject item={item} editable={editor.isEditable} selected={selected || selectionInside} columnWidth={geometry.width} originY={geometry.originY} canDrag onSelect={() => {}} onGestureStart={() => editor.view.dispatch(closeHistory(editor.state.tr))} onLayout={(_id, layout) => updateAttributes({ item: { ...item, layout } })}>
      <NodeViewContent className="doc-float-text doc-floating-content" data-field="floating-text" style={item.style?.bgColor && item.style.bgColor !== '#fffbeb' ? { background: item.style.bgColor } : undefined}/>
    </FloatObject>
  </NodeViewWrapper>;
}

const DocumentImage = Node.create({
  name: 'documentImage', group: 'block', atom: true, draggable: true,
  addAttributes() { return { item: { default: null }, anchorId: { default: null } }; },
  parseHTML() { return [
    { tag: 'figure[data-doc-image]', getAttrs: element => { try { return { item: JSON.parse(element.getAttribute('data-doc-image')) }; } catch { return false; } } },
    { tag: 'img[src]', getAttrs: element => ({ item: { id: richId(), type: 'image', data: { src: element.getAttribute('src') }, style: { imageWidth: 72 }, attachments: [] } }) },
  ]; },
  renderHTML({ node }) { return ['figure', { 'data-doc-image': JSON.stringify(node.attrs.item) }, ['img', { src: node.attrs.item?.data?.src || '', alt: '' }]]; },
  addNodeView() { return ReactNodeViewRenderer(DocumentImageView); },
});

const FloatingText = Node.create({
  name: 'floatingText', group: 'block', content: '(paragraph | heading)+', defining: true,
  addAttributes() { return { item: { default: null }, anchorId: { default: null } }; },
  parseHTML() { return [{ tag: 'aside[data-floating-text]', getAttrs: element => { try { return { item: JSON.parse(element.getAttribute('data-floating-text')) }; } catch { return false; } } }]; },
  renderHTML({ node }) { return ['aside', { 'data-floating-text': JSON.stringify(node.attrs.item) }, 0]; },
  addNodeView() { return ReactNodeViewRenderer(FloatingTextView); },
});

const DocumentUI = Extension.create({ name: 'documentUI', addOptions() { return { language: 'bilingual' }; }, addStorage() { return { language: this.options.language, preview: () => {} }; } });
const ImageParagraph = Extension.create({
  name: 'imageParagraph', priority: 1200,
  addKeyboardShortcuts() {
    const continueAfter = () => this.editor.commands.command(paragraphAfterSelectedImage({ language: this.editor.storage.documentUI.imageLanguage || this.editor.storage.documentUI.language }));
    return { Enter: continueAfter, 'Shift-Enter': continueAfter, ArrowUp: () => this.editor.commands.command(paragraphBeforeSelectedImage({ language: this.editor.storage.documentUI.imageLanguage || this.editor.storage.documentUI.language, reusePrevious: true })) };
  },
});
const HeadingSelection = Extension.create({
  name: 'headingSelection', priority: 1100,
  addKeyboardShortcuts() {
    return Object.fromEntries([1, 2, 3].map(level => [`Mod-Alt-${level}`, () => this.editor.chain().focus().command(applySelectedHeading(level)).run()]));
  },
});

const ParagraphDecoration = Extension.create({
  name: 'paragraphDecoration',
  addGlobalAttributes() { return [{ types: ['paragraph', 'heading'], attributes: {
    legacyStyle: { default: {}, parseHTML: () => ({}), renderHTML: attrs => ({ ...(legacyTextStyle(attrs.legacyStyle) ? { style: legacyTextStyle(attrs.legacyStyle) } : {}) }) },
  } }]; },
});

export function RichDocumentEditor({ blocks, typography, editable, lang, onChange, onPreview, onContextMenu }) {
  const scrollRef = useRef(null);
  const paperRef = useRef(null);
  const fixedCanvas = hasFloatingContent(blocks);
  const [canvas, setCanvas] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    if (!fixedCanvas || !scrollRef.current) return;
    const scroll = scrollRef.current;
    const measure = () => {
      const scale = canvasScale(scroll.clientWidth), height = paperRef.current.offsetHeight * scale;
      setCanvas(old => old.scale === scale && old.height === height ? old : { scale, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroll); observer.observe(paperRef.current); measure();
    return () => observer.disconnect();
  }, [fixedCanvas]);
  const callbacks = useRef({ onChange, onPreview }); callbacks.current = { onChange, onPreview };
  const recordsRef = useRef(blocks);
  const emittedArrays = useRef(new WeakSet());
  const emittedRef = useRef(JSON.stringify(blocks));
  const pending = useRef(new Set());
  const fileInput = useRef(null);
  const editorRef = useRef(null);
  const painter = useRef(null);
  const paintFrame = useRef(null);
  const [painterActive, setPainterActive] = useState(false);
  const [, setRevision] = useState(0);
  const editor = useEditor({
    extensions: [StarterKit.configure({ blockquote: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false }, heading: { levels: [1, 2, 3] } }), TextStyle, FontSize, Color, ParagraphIdentity.configure({ language: lang === 'en' ? 'en' : 'zh' }), ParagraphDecoration, DocumentImage, FloatingText, DocumentUI.configure({ language: lang }), HeadingSelection, ImageParagraph],
    content: documentFromRecords(recordsRef.current, lang), editable, shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'doc-surface doc-column', role: 'textbox', 'aria-label': '文档正文', 'aria-multiline': 'true', spellcheck: 'false' },
      handlePaste: (_view, event) => {
        if (!_view.editable) return false;
        const files = clipboardImages(event);
        if (!files.length) return false;
        event.preventDefault(); void insertImages(files, undefined, undefined, true); return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const id = view.dom.editor.storage.documentUI.draggedImageId;
        view.dom.editor.storage.documentUI.draggedImageId = null;
        if (id) return dropExistingImage(view, event, id);
        if (view.dragging || moved) return false;
        const files = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault(); const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(files, position); return true;
      },
    },
    onTransaction: ({ transaction }) => { for (const token of pending.current) token.bookmark = token.bookmark.map(transaction.mapping); },
    onSelectionUpdate: () => setRevision(value => value + 1),
    onUpdate: ({ editor }) => {
      const next = recordsFromDocument(editor.getJSON(), recordsRef.current, lang);
      emittedArrays.current.add(next);
      emittedRef.current = JSON.stringify(next); recordsRef.current = next;
      callbacks.current.onChange(next); setRevision(value => value + 1);
    },
  }, [lang]);
  editorRef.current = editor;

  const cancelPainter = () => {
    painter.current = null; setPainterActive(false);
    if (paintFrame.current != null) cancelAnimationFrame(paintFrame.current);
    paintFrame.current = null;
  };
  const applyPainter = () => {
    if (!painter.current || !editable || !editor || editor.isDestroyed) return;
    if (paintFrame.current != null) cancelAnimationFrame(paintFrame.current);
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = null;
      const selection = window.getSelection(), root = editor.view.dom;
      if (!painter.current || selection?.isCollapsed || !root.contains(selection?.anchorNode) || !root.contains(selection?.focusNode)) return;
      const anchor = editor.view.posAtDOM(selection.anchorNode, selection.anchorOffset);
      const head = editor.view.posAtDOM(selection.focusNode, selection.focusOffset);
      if (anchor === head) return;
      const applied = editor.chain().setTextSelection({ from: Math.min(anchor, head), to: Math.max(anchor, head) }).command(paintTextFormat(painter.current)).run();
      if (applied) cancelPainter();
    });
  };
  useEffect(() => {
    cancelPainter();
    return () => { painter.current = null; if (paintFrame.current != null) cancelAnimationFrame(paintFrame.current); };
  }, [editor, editable]);

  const insertImages = async (files, position, target, replaceSelected = false) => {
    const activeEditor = editorRef.current;
    if (!activeEditor || activeEditor.isDestroyed || !activeEditor.isEditable) return;
    if (position != null) activeEditor.commands.setTextSelection(position);
    const selected = activeEditor.state.selection.node;
    const replacement = target || (replaceSelected && position == null && selected?.type.name === 'documentImage' ? { id: selected.attrs.item.id, field: lang === 'en' ? 'en' : lang === 'zh' ? 'zh' : activeEditor.storage.documentUI.imageLanguage || 'zh' } : null);
    const token = { bookmark: activeEditor.state.selection.getBookmark() }; pending.current.add(token);
    try {
      const images = await Promise.all((replacement ? [...files].slice(0, 1) : [...files]).map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ type: 'documentImage', attrs: { item: { id: richId(), type: 'image', data: { src: reader.result }, style: { imageWidth: 72 }, attachments: [] } } }); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); })));
      if (activeEditor.isDestroyed) return;
      if (replacement) {
        let found;
        activeEditor.state.doc.descendants((node, pos) => { if (node.type.name === 'documentImage' && node.attrs.item?.id === replacement.id) found = { node, pos }; });
        if (!found || !activeEditor.isEditable) return;
        const original = found.node.attrs.item, src = images[0].attrs.item.data.src;
        const item = replacement.field === 'en'
          ? { ...original, data: { ...original.data, srcEn: src, shareWithEnglish: false, enAnnotations: [] } }
          : { ...original, data: { ...original.data, src }, annotations: [], style: { ...original.style, annotations: [] } };
        const transaction = closeHistory(activeEditor.state.tr).setNodeMarkup(found.pos, undefined, { ...found.node.attrs, item }).setMeta('uiEvent', 'paste');
        activeEditor.view.dispatch(transaction);
        activeEditor.view.dispatch(closeHistory(activeEditor.state.tr));
        activeEditor.view.focus();
        return;
      }
      const selection = token.bookmark.resolve(activeEditor.state.doc);
      activeEditor.view.dispatch(closeHistory(activeEditor.state.tr));
      const localized = lang === 'en' ? images.map(image => ({ ...image, attrs: { ...image.attrs, item: { ...image.attrs.item, data: { src: '', srcEn: image.attrs.item.data.src, shareWithEnglish: false } } } })) : images;
      activeEditor.chain().focus().setTextSelection({ from: selection.from, to: selection.to }).insertContent(localized).setMeta('uiEvent', 'paste').run();
    } catch (error) { window.alert(`图片插入失败：${error.message}`); }
    finally { pending.current.delete(token); }
  };
  if (editor) editor.storage.documentUI.pasteImages = insertImages;

  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(editable); }, [editor, editable]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.storage.documentUI.language = lang;
    editor.storage.documentUI.preview = src => callbacks.current.onPreview(src);
    // React can commit an earlier emitted snapshot after the next PM
    // transaction. Echoes are identified by array identity, never reapplied.
    if (emittedArrays.current.has(blocks)) return;
    const serialized = JSON.stringify(blocks);
    if (serialized === emittedRef.current) return;
    cancelPainter();
    emittedRef.current = serialized;
    recordsRef.current = blocks;
    const selection = editor.state.selection;
    editor.commands.setContent(documentFromRecords(blocks, lang), { emitUpdate: false });
    const end = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(selection.from, end), to: Math.min(selection.to, end) });
  }, [blocks, editor, lang]);

  const global = normalizeTypography(typography);
  const surfaceStyle = { '--doc-body-size': `${global?.bodySize || 16}px`, '--doc-heading-size': `${global?.headingSize || 24}px`, '--doc-heading-weight': global?.headingWeight || 700, '--doc-line-height': global?.lineHeight || 1.75, '--doc-paragraph-gap': `${global?.paragraphGap ?? 6}px`, '--doc-heading-border': global?.headingDivider === false ? '0px' : '2px' };
  const fontSize = editor?.getAttributes('textStyle').fontSize || '';
  const command = callback => { if (editor) callback(editor.chain().focus()).run(); };
  return <div ref={scrollRef} className="doc-scroll" data-editor-mode="continuous-text" data-document-language={lang} data-document-layout={fixedCanvas ? 'fixed-canvas' : 'flow'} data-format-painter={painterActive ? 'active' : undefined} data-global-typography={global ? 'true' : undefined} style={{...surfaceStyle, '--doc-canvas-width': `${DOCUMENT_CANVAS_WIDTH}px`, '--doc-canvas-scale': fixedCanvas ? canvas.scale : 1, '--doc-canvas-height': `${canvas.height}px`}} onKeyDownCapture={event => { if (event.key === 'Escape' && painter.current) { event.preventDefault(); event.stopPropagation(); cancelPainter(); } }}>
    {editable && <div className="doc-format-toolbar" role="toolbar" aria-label="文字格式">
      <button type="button" title="撤销" onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}><Undo2 size={16}/></button>
      <button type="button" title="重做" onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}><Redo2 size={16}/></button>
      <select aria-label="段落样式" title="选中文字后转为标题；未选中文字时新建空标题" value={editor?.isActive('heading') ? String(editor.getAttributes('heading').level) : 'body'} onChange={event => command(chain => chain.command(applySelectedHeading(event.target.value === 'body' ? null : Number(event.target.value))))}><option value="body">正文</option><option value="1">一级标题</option><option value="2">二级标题</option><option value="3">三级标题</option></select>
      <button type="button" title="在光标处新建空标题" aria-label="新建标题" onMouseDown={event => event.preventDefault()} onClick={() => command(chain => chain.command(applySelectedHeading(1, { insert: true })))}><Heading size={16}/> 新建标题</button>
      <select aria-label="所选文字字号" value={fontSize} onChange={event => command(chain => event.target.value ? chain.setFontSize(event.target.value) : chain.unsetFontSize())}><option value="">默认字号</option>{[12, 14, 16, 18, 20, 24, 30, 36, 48, 64].map(size => <option key={size} value={`${size}px`}>{size} px</option>)}</select>
      {[[Bold, '加粗', 'bold', chain => chain.toggleBold()], [Italic, '斜体', 'italic', chain => chain.toggleItalic()], [Underline, '下划线', 'underline', chain => chain.toggleUnderline()]].map(([Icon, label, mark, action]) => <button type="button" key={mark} title={label} aria-label={label} aria-pressed={editor?.isActive(mark) || false} onMouseDown={event => event.preventDefault()} onClick={() => command(action)}><Icon size={16}/></button>)}
      <span className="doc-toolbar-separator"/>
      <button type="button" aria-label="格式刷" aria-pressed={painterActive} title={painterActive ? '框选目标文字以应用格式；Esc 取消' : '选中来源文字，再点击格式刷'} disabled={!painterActive && (!editor || editor.state.selection.empty)} onMouseDown={event => event.preventDefault()} onClick={() => {
        if (painter.current) { cancelPainter(); return; }
        const format = editor && captureTextFormat(editor.state, { useLegacySize: !global });
        if (format) { painter.current = format; setPainterActive(true); }
      }}><Paintbrush size={16}/> 格式刷</button>
      <button type="button" aria-label="默认文字颜色" title="恢复当前主题的默认文字颜色，保留其他格式" onMouseDown={event => event.preventDefault()} onClick={() => command(chain => chain.unsetColor())}><RotateCcw size={14}/> 默认颜色</button>
      {INK_COLORS.map(color => <button type="button" key={color} className="doc-color" title={`文字颜色 ${color}`} aria-label={`文字颜色 ${color}`} style={{ background: color }} onMouseDown={event => event.preventDefault()} onClick={() => command(chain => chain.setColor(color))}/>)}
      <button type="button" title="清除所选文字格式" onMouseDown={event => event.preventDefault()} onClick={() => command(chain => chain.unsetAllMarks())}><RemoveFormatting size={16}/></button>
      <button type="button" className="doc-toolbar-image" onMouseDown={event => event.preventDefault()} onClick={() => fileInput.current?.click()}><ImagePlus size={16}/> 插入图片</button>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={event => { void insertImages(event.target.files); event.target.value = ''; }}/>
    </div>}
    <div className="doc-page-frame"><div ref={paperRef} className="doc-paper" onMouseDown={event => {
      if (!editable || !editor || event.button !== 0 || event.target !== event.currentTarget) return;
      const root = editor.view.dom, first = root.firstElementChild, rect = root.getBoundingClientRect();
      if (!first || event.clientY > first.getBoundingClientRect().top || event.clientX < rect.left || event.clientX > rect.right) return;
      const command = paragraphBeforeImage(0, { language: lang });
      if (!command({ state: editor.state })) return;
      event.preventDefault(); editor.chain().command(command).focus().run();
    }} onPointerUp={event => { if (event.button === 0) applyPainter(); }} onKeyUp={event => { if (event.key === 'Shift' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')) applyPainter(); }} onContextMenu={event => {
      if (!editable || event.target.closest('.doc-format-toolbar')) return;
      const host = event.target.closest('[data-record-id]');
      if (!host) return;
      event.preventDefault(); event.stopPropagation();
      onContextMenu({ clientX: event.clientX, clientY: event.clientY, currentTarget: host }, host.dataset.recordId);
    }}>
      <EditorContent editor={editor}/>
    </div></div>
  </div>;
}
