import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_TYPOGRAPHY, normalizeTypography } from '../server/document-typography.mjs';

export function DocumentSettings({ value, onChange, onClose }) {
  const settings = normalizeTypography(value) || DEFAULT_TYPOGRAPHY;
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.querySelector('.doc-settings-trigger');
    const escape = (event) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const controls = [...(dialogRef.current?.querySelectorAll('button, input, select') || [])];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('keydown', escape, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const change = (key, next) => onChange({ ...settings, [key]: next });
  return <div className="doc-settings-backdrop" onClick={onClose}>
    <section ref={dialogRef} className="doc-settings" role="dialog" aria-modal="true" aria-label="全局排版设置" onClick={(event) => event.stopPropagation()}>
      <header><h2>全局排版设置</h2><button autoFocus type="button" onClick={onClose} aria-label="关闭排版设置"><X size={18}/></button></header>
      <p>作用于当前文档的全部页面，修改后实时预览并自动保存。悬浮注释保持独立样式。</p>
      {[['bodySize', '正文字号', 10, 36, 1, 'px'], ['headingSize', '标题字号', 14, 64, 1, 'px'], ['lineHeight', '行距', 1, 3, 0.05, '倍'], ['paragraphGap', '段落间距', 0, 36, 1, 'px']].map(([key, label, min, max, step, unit]) => <label key={key}><span>{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={settings[key]} onChange={(event) => change(key, Number(event.target.value))}/><output>{Number(settings[key].toFixed(2))} {unit}</output></label>)}
      <label><span>标题字重</span><select aria-label="标题字重" value={settings.headingWeight} onChange={(event) => change('headingWeight', Number(event.target.value))}><option value="700">加粗</option><option value="400">常规</option></select></label>
      <label><span>标题分隔线</span><input aria-label="标题分隔线" type="checkbox" checked={settings.headingDivider} onChange={(event) => change('headingDivider', event.target.checked)}/></label>
      <p>统一调整已有标题和正文。之后仍可选中文字单独调整字号与字重。</p>
      <footer><button type="button" onClick={() => onChange({ ...DEFAULT_TYPOGRAPHY })}>恢复默认排版</button><button type="button" onClick={onClose}>完成</button></footer>
    </section>
  </div>;
}
