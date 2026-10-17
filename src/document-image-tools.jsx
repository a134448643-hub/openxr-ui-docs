import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Move, MousePointer2, PenLine, Square, Trash2 } from 'lucide-react';
import { DOCUMENT_CANVAS_WIDTH, elementScale, floatingBox } from './document-canvas.mjs';

const COLORS = ['#374151', '#9ca3af', '#dc2626', '#2563eb', '#d97706', '#16a34a'];
const REFERENCE_WIDTH = DOCUMENT_CANVAS_WIDTH;

const textOf = (lang) => (lang === 'en' ? { primary: 'en', secondary: null } : lang === 'zh' ? { primary: 'zh', secondary: null } : { primary: 'zh', secondary: 'en' });

function readText(element) {
  return (element?.innerText || '').replace(/\u00a0/g, ' ').replace(/\n$/, '');
}

function caretOffset(root) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return 0;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.focusNode, selection.focusOffset);
  return range.toString().length;
}

function newId(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pixelsToLayout(left, top, width, height, columnWidth) {
  const safe = columnWidth || REFERENCE_WIDTH;
  const rx = left / safe;
  const ry = top / safe;
  const rw = Math.max(0.08, width / safe);
  const rh = Math.max(0.04, height / safe);
  return { x: rx * REFERENCE_WIDTH, y: ry * REFERENCE_WIDTH, width: rw * REFERENCE_WIDTH, height: rh * REFERENCE_WIDTH, rx, ry, rw, rh };
}

function floatStyle(layout, columnWidth) {
  return floatingBox(layout, columnWidth || REFERENCE_WIDTH);
}

function EditableText({ value, field, placeholder, className, color, typographyStyle, editable, onChange, onSplit, onMergeBack, onActivate }) {
  const ref = useRef(null);
  const focused = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || focused.current) return;
    if (readText(element) !== (value || '')) element.textContent = value || '';
  }, [value]);

  const emit = () => onChange(readText(ref.current));

  return (
    <div
      ref={ref}
      data-field={field}
      role="textbox"
      aria-multiline="true"
      className={`${className} ${value ? '' : 'is-empty'}`}
      style={{ color: color === '#374151' ? 'var(--doc-paper-text, #374151)' : color, ...typographyStyle }}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      onFocus={() => { focused.current = true; onActivate?.(); }}
      onMouseDown={() => onActivate?.()}
      onBlur={() => { focused.current = false; emit(); }}
      onInput={(event) => { if (!event.nativeEvent.isComposing) emit(); }}
      onCompositionEnd={emit}
      onPaste={(event) => {
        const images = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
        if (images.length) return;
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      }}
      onKeyDown={(event) => {
        if (!editable || event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter' && !event.shiftKey && onSplit) {
          event.preventDefault();
          const text = readText(ref.current);
          const offset = caretOffset(ref.current);
          ref.current.textContent = text.slice(0, offset);
          onSplit(text.slice(0, offset), text.slice(offset));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          document.execCommand('insertText', false, '\n');
        } else if (event.key === 'Backspace' && onMergeBack && caretOffset(ref.current) === 0 && window.getSelection()?.isCollapsed) {
          event.preventDefault();
          onMergeBack(readText(ref.current));
        }
      }}
    />
  );
}

function AnnotationShape({ annotation, markerId, width, height }) {
  const color = annotation.color || '#dc2626';
  const thickness = Math.max(1, Math.min(16, annotation.strokeWidth || 2));
  const px = (value) => value * width;
  const py = (value) => value * height;
  if (annotation.type === 'pen') {
    const points = annotation.points || [];
    if (!points.length) return null;
    const d = points.map((point, index) => `${index ? 'L' : 'M'}${px(point.x)} ${py(point.y)}`).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeLinejoin="round"/>;
  }
  if (annotation.type === 'rect') {
    const x = Math.min(annotation.x, annotation.x + annotation.w);
    const y = Math.min(annotation.y, annotation.y + annotation.h);
    return <rect x={px(x)} y={py(y)} width={px(Math.abs(annotation.w))} height={py(Math.abs(annotation.h))} fill="none" stroke={color} strokeWidth={thickness}/>;
  }
  if (annotation.type === 'arrow') {
    const x = px(annotation.x1), y = py(annotation.y1);
    const dx = px(annotation.x2) - x, dy = py(annotation.y2) - y;
    const length = Math.hypot(dx, dy);
    if (length < 1) return null;
    const head = Math.min(length * 0.4, Math.max(12, thickness * 4));
    const neck = length - head * 0.75;
    const shaft = Math.min(thickness * 0.65, length * 0.04);
    const wing = Math.min(Math.max(6, thickness * 1.8), length * 0.2);
    return (
      <path data-arrow-style="tapered" transform={`translate(${x} ${y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`} d={`M0 0 L${neck} ${-shaft} L${length - head} ${-wing} L${length} 0 L${length - head} ${wing} L${neck} ${shaft} Z`} fill={color}/>
    );
  }
  return null;
}

export function ImageSurface({ item, editable, selected, tool, selectedAnnotation, columnWidth, lang, onSelect, onTool, onWidth, onAnnotations, onToggleFloat, onUndo, onPreview, onDragStart, onDelete, unifiedEditor = false, emptyLabel, emptyAspectRatio, toolbarContent, imageLanguage, deleteLabel = '删除图片' }) {
  const frameRef = useRef(null);
  const draftRef = useRef(null);
  const [draft, setDraft] = useState(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [ink, setInk] = useState('#dc2626');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [frameSize, setFrameSize] = useState({ w: 100, h: 100 });
  const annotations = item.annotations || item.style?.annotations || [];
  const markerId = `arrow-${item.id}`;
  const fields = textOf(lang);
  const widthPercent = item.style?.imageWidth || (item.layout?.rw ? Math.round(item.layout.rw * 100) : 100);
  const drawing = tool === 'pen' || tool === 'rect' || tool === 'arrow';

  useEffect(() => { if (!selected) setDrawOpen(false); }, [selected]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setFrameSize({ w: Math.max(1, rect.width), h: Math.max(1, rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.data?.src, item.layout, item.style?.imageWidth]);

  const pointOf = (event) => {
    const rect = frameRef.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const commitAnnotations = (next, recordUndo = true) => {
    if (recordUndo) onUndo(item);
    onAnnotations(item.id, next);
  };

  const finishDraft = () => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current) return;
    if (current.type === 'pen' && (current.points || []).length < 2) return;
    if (current.type === 'rect' && (Math.abs(current.w) < 0.01 || Math.abs(current.h) < 0.01)) return;
    if (current.type === 'arrow' && Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 0.01) return;
    commitAnnotations([...annotations, current]);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (!editable) {
      if (item.data?.src) onPreview(item.data.src);
      return;
    }
    onSelect(item.id);
    // Image selection owns keyboard focus, even immediately after typing.
    if (!unifiedEditor) {
      document.activeElement?.blur();
      frameRef.current?.focus({ preventScroll: true });
      window.getSelection()?.removeAllRanges();
    }
    if (tool !== 'pen' && tool !== 'rect' && tool !== 'arrow') return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointOf(event);
    const next = tool === 'pen'
      ? { id: newId('n'), type: 'pen', points: [point], color: ink }
      : tool === 'rect'
        ? { id: newId('n'), type: 'rect', x: point.x, y: point.y, w: 0, h: 0, color: ink }
        : { id: newId('n'), type: 'arrow', x1: point.x, y1: point.y, x2: point.x, y2: point.y, color: ink };
    draftRef.current = { ...next, strokeWidth };
    setDraft(draftRef.current);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!draftRef.current) return;
    const point = pointOf(event);
    const current = draftRef.current;
    const next = current.type === 'pen'
      ? { ...current, points: [...current.points, point] }
      : current.type === 'rect'
        ? { ...current, w: point.x - current.x, h: point.y - current.y }
        : { ...current, x2: point.x, y2: point.y };
    draftRef.current = next;
    setDraft(next);
  };

  const shapes = draft ? [...annotations, draft] : annotations;

  return (
    <div className={`doc-image-wrap ${selected ? 'is-selected' : ''}`} data-image-language={imageLanguage} style={item.isFloating || item.isAttachment ? null : { width: `${widthPercent}%` }} onMouseDown={(event) => event.stopPropagation()}>
      {editable && selected && (
        <div className="doc-image-toolbar" onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className={`doc-text-btn ${drawOpen ? 'is-on' : ''}`} onClick={() => { const next = !drawOpen; setDrawOpen(next); if (!next) onTool('move'); }}>涂鸦</button>
          <button type="button" className="doc-text-btn" onClick={() => onToggleFloat(item)}>{item.isAttachment || item.isFloating ? '嵌入正文' : '悬浮'}</button>
          <button type="button" title={deleteLabel} aria-label={deleteLabel} onClick={() => onDelete(item.id)}><Trash2 size={14}/></button>
          {toolbarContent}
          {drawOpen && (
            <div className="doc-draw-menu">
              <button type="button" className={tool === 'move' ? 'is-on' : ''} title="选择与移动" onClick={() => onTool('move')}><MousePointer2 size={14}/></button>
              <button type="button" className={tool === 'pen' ? 'is-on' : ''} title="画笔" onClick={() => onTool('pen')}><PenLine size={14}/></button>
              <button type="button" className={tool === 'rect' ? 'is-on' : ''} title="方框" onClick={() => onTool('rect')}><Square size={14}/></button>
              <button type="button" className={tool === 'arrow' ? 'is-on' : ''} title="箭头" onClick={() => onTool('arrow')}><ArrowRight size={14}/></button>
              {COLORS.map((color) => <button type="button" key={color} className={`doc-color ${ink === color ? 'is-on' : ''}`} style={{ background: color }} onClick={() => setInk(color)}/>)}
              <label className="doc-stroke-width">粗细 <input aria-label="涂鸦粗细" type="range" min="1" max="16" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))}/><output>{strokeWidth}</output></label>
              <button type="button" className="doc-text-btn" title="撤销上一笔" disabled={!annotations.length} onClick={() => commitAnnotations(annotations.slice(0, -1))}>撤销</button>
            </div>
          )}
        </div>
      )}
      <div
        ref={frameRef}
        tabIndex={editable ? 0 : undefined}
        data-image-placeholder={!item.data?.src && emptyLabel ? 'english' : undefined}
        aria-label="文档图片"
        className={`doc-image-frame ${drawing ? 'is-drawing' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDraft}
        onPointerCancel={() => { draftRef.current = null; setDraft(null); }}
      >
        {item.data?.src ? (
          <img
            src={item.data.src}
            alt=""
            draggable={editable && tool === 'move' && !item.isAttachment && !item.isFloating}
            onDragStart={onDragStart}
            onClick={(event) => { if (!editable) { event.stopPropagation(); onPreview(item.data.src); } }}
          />
        ) : <div className="doc-image-empty" style={emptyAspectRatio ? { aspectRatio: String(emptyAspectRatio), minHeight: 0, boxSizing: 'border-box' } : undefined}>{emptyLabel || '拖入或粘贴图片'}</div>}
        <svg className="doc-anno" viewBox={`0 0 ${frameSize.w} ${frameSize.h}`} preserveAspectRatio="none">
          {shapes.filter((annotation) => annotation.type !== 'text').map((annotation) => <AnnotationShape key={annotation.id} annotation={annotation} markerId={`${markerId}-${annotation.id}`} width={frameSize.w} height={frameSize.h}/>)}
        </svg>
        {annotations.filter((annotation) => annotation.type === 'text').map((annotation) => (
          <div
            key={annotation.id}
            className={`doc-anno-text ${selectedAnnotation === annotation.id ? 'is-selected' : ''}`}
            style={{ left: `${annotation.x * 100}%`, top: `${annotation.y * 100}%`, width: `${(annotation.w || 0.32) * 100}%` }}
            onPointerDown={(event) => { if (!editable || tool !== 'move') return; event.stopPropagation(); onSelect(item.id, annotation.id); dragAnnotation(event, annotation, frameRef.current, annotations, (next) => onAnnotations(item.id, next), () => onUndo(item)); }}
          >
            <EditableText editable={editable} field={`${item.id}-zh`} value={annotation.zh || ''} placeholder="标注" className="doc-text doc-anno-input" onChange={(value) => onAnnotations(item.id, annotations.map((entry) => entry.id === annotation.id ? { ...entry, zh: value } : entry))}/>
            {fields.secondary && <EditableText editable={editable} field={`${item.id}-en`} value={annotation.en || ''} placeholder="EN" className="doc-text doc-anno-input is-secondary" onChange={(value) => onAnnotations(item.id, annotations.map((entry) => entry.id === annotation.id ? { ...entry, en: value } : entry))}/>}
          </div>
        ))}
        {editable && selected && tool === 'move' && !item.isAttachment && !item.isFloating && (
          <div
            className="doc-resize"
            onMouseDown={(event) => resizeImage(event, frameRef.current, columnWidth, (percent) => onWidth(item.id, percent))}
          />
        )}
      </div>
    </div>
  );
}

function dragAnnotation(event, annotation, frame, annotations, commit, pushUndo) {
  event.preventDefault();
  pushUndo();
  const rect = frame.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY };
  const origin = structuredClone(annotation);
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
    const move = (ev) => {
      if (ev.buttons === 0) { end(); return; }
      const dx = (ev.clientX - start.x) / rect.width;
      const dy = (ev.clientY - start.y) / rect.height;
      const next = origin.points
        ? { ...origin, points: origin.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) }
        : origin.x1 != null
          ? { ...origin, x1: origin.x1 + dx, y1: origin.y1 + dy, x2: origin.x2 + dx, y2: origin.y2 + dy }
          : { ...origin, x: origin.x + dx, y: origin.y + dy };
      commit(annotations.map((entry) => entry.id === annotation.id ? next : entry));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
}

function resizeImage(event, frame, columnWidth, onWidth) {
  event.preventDefault();
  event.stopPropagation();
  const wrap = frame.parentElement;
  const startX = event.clientX;
  const scale = elementScale(wrap);
  const startWidth = wrap.getBoundingClientRect().width / scale;
  const limit = columnWidth || wrap.parentElement.clientWidth;
  const move = (ev) => {
    const next = Math.min(limit, Math.max(limit * 0.16, startWidth + (ev.clientX - startX) / scale));
    onWidth(Math.round(next / limit * 100));
  };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

export function FloatObject({ item, editable, selected, columnWidth, canDrag, children, onSelect, onLayout, onGestureStart, originY = 0 }) {
  const ref = useRef(null);
  const box = floatStyle(item.layout, columnWidth);
  const startDrag = (event, mode) => {
    if (!editable || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect(item.id);
    document.activeElement?.blur();
    ref.current?.focus({ preventScroll: true });
    const parentNode = ref.current.offsetParent || ref.current.parentElement;
    const parent = parentNode.getBoundingClientRect();
    const scale = elementScale(parentNode);
    const parentWidth = parentNode.clientWidth;
    const rect = ref.current.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, left: (rect.left - parent.left) / scale, top: (rect.top - parent.top) / scale, width: rect.width / scale, height: rect.height / scale };
    const pointerId = event.pointerId;
    let dragging = false;
    const end = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      document.removeEventListener('mouseup', end, true);
      window.removeEventListener('blur', end);
    };
    const move = (ev) => {
      if (pointerId != null && ev.pointerId != null && ev.pointerId !== pointerId) return;
      if ((ev.buttons ?? 1) === 0) { end(); return; }
      if (!dragging) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
        dragging = true;
        onGestureStart?.();
      }
      const dx = (ev.clientX - start.x) / scale, dy = (ev.clientY - start.y) / scale;
      const left = mode === 'move' ? Math.max(0, Math.min(parentWidth - start.width, start.left + dx)) : start.left;
      const column = ref.current.closest('.doc-column');
      const minTop = ((column?.getBoundingClientRect().top ?? parent.top) - parent.top) / scale;
      const top = mode === 'move' ? Math.max(minTop, start.top + dy) : start.top;
      const width = mode === 'resize' ? Math.min(Math.max(80, parentWidth - start.left), Math.max(80, start.width + dx)) : start.width;
      const height = mode === 'resize' ? Math.max(48, start.height + dy) : start.height;
      onLayout(item.id, pixelsToLayout(left, top - originY, width, height, parentWidth));
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    document.addEventListener('mouseup', end, true);
    window.addEventListener('blur', end);
  };
  return (
    <div
      ref={ref}
      tabIndex={editable ? 0 : undefined}
      className={`doc-float ${selected ? 'is-selected' : ''} ${canDrag ? 'can-drag' : ''}`}
      style={{ left: box.left, top: box.top + originY, width: box.width, height: item.type === 'text' ? 'auto' : box.height }}
      data-block-id={item.id}
      onPointerDown={(event) => {
        if (!editable || !canDrag) return;
        if (event.target.closest('.doc-image-toolbar, .doc-resize, .doc-anno-text, [data-field]')) return;
        startDrag(event, 'move');
      }}
      onMouseDown={(event) => { event.stopPropagation(); onSelect(item.id); }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      {editable && <button type="button" className="doc-float-move" title="拖动悬浮内容" aria-label="拖动悬浮内容" onPointerDown={(event) => startDrag(event, 'move')}><Move size={14}/></button>}
      {editable && <div className="doc-resize" onPointerDown={(event) => startDrag(event, 'resize')}/>}
    </div>
  );
}

