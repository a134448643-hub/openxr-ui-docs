const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
const stylesCssPath = path.resolve(__dirname, '../界面原型/styles.css');

let appJs = fs.readFileSync(appJsPath, 'utf8');
let stylesCss = fs.readFileSync(stylesCssPath, 'utf8');

// 1. Update state.pluginTab valid values and default
appJs = appJs.replace(
  "pluginTab:['nodes','docs'].includes(stored.pluginTab)?stored.pluginTab:'nodes'",
  "pluginTab:['components','nodes','docs'].includes(stored.pluginTab)?stored.pluginTab:'components',pluginComponentQuery:''"
);
appJs = appJs.replace(
  "function openPlugin(id,tab='nodes')",
  "function openPlugin(id,tab='components')"
);
appJs = appJs.replace(
  "state.pluginTab = 'nodes';",
  "state.pluginTab = 'components';"
);

// 2. Update pluginCard(p) to only keep size and remove launch, build, and ide buttons
const oldPluginCardRegex = /function pluginCard\(p\)\{[\s\S]*?return `<div class="plugin-card"[\s\S]*?<\/div>`;\s*\}/;
const newPluginCardCode = `function pluginCard(p){
    const isFav=pluginFavorite(p);
    const comps=getPluginComponents(p);
    return \`<div class="plugin-card" draggable="true" data-plugin-card="\${p.id}" data-action="open-plugin" data-id="\${p.id}" style="cursor:pointer" title="点击进入插件详情">
      <div class="plugin-card-banner \${p.accentClass}">
        <div class="plugin-banner-top">
          <span class="plugin-type-badge no-launch">\${icon('code')}\${p.typeLabel}</span>
          <button class="icon-button \${isFav?'is-favorite':''}" data-action="plugin-favorite" data-id="\${p.id}" aria-label="收藏插件" title="\${isFav?'取消收藏':'设为收藏'}">\${icon('star')}</button>
        </div>
        <div class="plugin-banner-bottom">
          <div class="plugin-icon-wrap">\${icon(p.icon||'puzzle')}</div>
          <div style="display:flex;gap:5px;align-items:center">
            \${comps?.length ? \`<span class="badge badge-amber" style="font-size:9.5px">\${icon('puzzle')}\${comps.length} 组件</span>\` : ''}
            \${p.blueprintNodes?.length ? \`<span class="badge badge-purple" style="font-size:9.5px">\${icon('boxes')}\${p.blueprintNodes.length} 节点</span>\` : ''}
            <span class="badge badge-blue">UE \${escape(p.ue)}</span>
          </div>
        </div>
      </div>
      <div class="plugin-card-body">
        <div class="plugin-title-row">
          <span class="project-title" style="text-align:left;font-weight:650">\${escape(p.name)}</span>
          <span class="plugin-identifier">\${escape(p.identifier)}</span>
        </div>
        <p class="plugin-desc">\${escape(p.description)}</p>
        <div class="plugin-meta-single">
          <div class="plugin-meta-item" title="磁盘占用">\${icon('folder')}<span>大小: \${escape(p.size)}</span></div>
        </div>
        <div class="plugin-card-actions">
          <button class="plugin-install-btn button-primary" data-action="install-plugin" data-id="\${p.id}" title="将此插件安装至目标 UE 项目">\${icon('plus')}安装到项目</button>
        </div>
      </div>
    </div>\`;
  }`;

if (oldPluginCardRegex.test(appJs)) {
  appJs = appJs.replace(oldPluginCardRegex, newPluginCardCode);
  console.log('Replaced pluginCard with simplified size-only card');
} else {
  console.warn('Could not match oldPluginCardRegex');
}

// 3. Update pluginListRow(p) to only keep size and install button
const oldPluginListRowRegex = /function pluginListRow\(p\)\{[\s\S]*?return `<div class="project-list-row"[\s\S]*?<\/div>`;\s*\}/;
const newPluginListRowCode = `function pluginListRow(p){
    const comps=getPluginComponents(p);
    return \`<div class="project-list-row" draggable="true" data-plugin-card="\${p.id}" data-action="open-plugin" data-id="\${p.id}" style="cursor:pointer">
      <div class="plugin-icon-wrap" style="width:48px;height:48px;flex-shrink:0">\${icon(p.icon||'puzzle')}</div>
      <div class="project-list-name">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="project-title" style="text-align:left;font-weight:650">\${escape(p.name)}</span>
          <span class="plugin-identifier">\${escape(p.identifier)}</span>
          <span class="badge" style="color:#fcd34d">\${escape(p.typeLabel)}</span>
          <span class="badge badge-blue">UE \${escape(p.ue)}</span>
          \${comps?.length ? \`<span class="badge badge-amber">\${icon('puzzle')}\${comps.length} 个组件</span>\` : ''}
          \${p.blueprintNodes?.length ? \`<span class="badge badge-purple">\${icon('boxes')}\${p.blueprintNodes.length} 个蓝图节点</span>\` : ''}
          <span style="font-size:11px;color:var(--subtle);margin-left:auto">\${escape(p.path)}</span>
        </div>
        <p>\${escape(p.description)}</p>
      </div>
      <div class="card-actions" style="margin-left:auto;border:0;padding:0;gap:12px;align-items:center">
        <span style="font-size:12px;color:var(--muted);white-space:nowrap">\${icon('folder')} 大小: \${escape(p.size)}</span>
        <button class="plugin-install-btn button-primary" data-action="install-plugin" data-id="\${p.id}">\${icon('plus')}安装到项目</button>
      </div>
    </div>\`;
  }`;

if (oldPluginListRowRegex.test(appJs)) {
  appJs = appJs.replace(oldPluginListRowRegex, newPluginListRowCode);
  console.log('Replaced pluginListRow with size-only row');
}

// 4. Update renderPluginDetail and add renderPluginComponents & renderComponentCard
const componentRenderersCode = `
  function renderUsageSteps(text){
    if(!text) return '';
    const lines = text.split('\\n').filter(Boolean);
    return lines.map(line => {
      const match = line.match(/^(\\d+)\\.\\s*(.+)$/);
      if(match){
        return \`<div class="comp-step-item">
          <span class="comp-step-num">\${match[1]}</span>
          <div class="comp-step-content">\${renderDocText(match[2])}</div>
        </div>\`;
      }
      return \`<div class="comp-step-item">
        <span class="comp-step-dot"></span>
        <div class="comp-step-content">\${renderDocText(line)}</div>
      </div>\`;
    }).join('');
  }

  function renderComponentCard(c, p){
    return \`<div class="plugin-component-card">
      <div class="comp-card-header">
        <div class="comp-card-header-left">
          <div class="comp-icon-badge">\${icon('puzzle')}</div>
          <div class="comp-title-wrap">
            <div class="comp-title-row">
              <h3 class="comp-name">\${escape(c.name)}</h3>
              \${c.cName ? \`<span class="comp-cname">\${escape(c.cName)}</span>\` : ''}
              <span class="badge badge-purple">\${escape(c.baseClass || 'UActorComponent')}</span>
            </div>
            <div class="comp-meta-row">
              <span class="comp-mount-target">\${icon('layers')} <strong>挂载目标：</strong>\${escape(c.targetActor || 'Character / Actor')}</span>
              <span class="badge badge-blue">蓝图可挂载</span>
            </div>
          </div>
        </div>
        <div class="comp-card-header-right">
          <button class="button button-quiet button-sm" data-action="copy-code" data-code="\${escape(c.name)}" title="复制组件类名">\${icon('copy')} 复制类名</button>
        </div>
      </div>

      <div class="comp-card-body">
        <div class="comp-section">
          <div class="comp-section-title">\${icon('info')} 组件核心描述</div>
          <p class="comp-desc">\${escape(c.description)}</p>
        </div>

        <div class="comp-section">
          <div class="comp-section-title">\${icon('play')} 使用说明与接入步骤</div>
          <div class="comp-usage-box">
            \${renderUsageSteps(c.usage)}
          </div>
        </div>

        \${c.properties && c.properties.length ? \`
          <div class="comp-section">
            <div class="comp-section-title">\${icon('sliders')} 详细面板关键配置参数</div>
            <div class="comp-props-table">
              \${c.properties.map(pr => \`
                <div class="comp-prop-row">
                  <div class="comp-prop-col-name"><code>\${escape(pr.name)}</code></div>
                  <div class="comp-prop-col-type">\${escape(pr.type)}</div>
                  <div class="comp-prop-col-desc">\${escape(pr.desc)}</div>
                </div>
              \`).join('')}
            </div>
          </div>
        \` : ''}
      </div>
    </div>\`;
  }

  function renderPluginComponents(p){
    const comps = getPluginComponents(p);
    const query = (state.pluginComponentQuery || '').toLowerCase().trim();
    const filtered = comps.filter(c => {
      if(!query) return true;
      return [c.name, c.cName, c.description, c.usage, c.baseClass, c.targetActor, ...(c.properties||[]).map(pr => pr.name + ' ' + pr.desc)].join(' ').toLowerCase().includes(query);
    });
    return \`
      <div class="bp-nodes-header">
        <label class="bp-nodes-search">
          \${icon('search')}
          <input id="bp-component-search" type="search" placeholder="搜索组件名称、功能描述、挂载对象或配置参数..." value="\${escape(state.pluginComponentQuery||'')}">
        </label>
        <span class="bp-nodes-count">\${filtered.length} / \${comps.length} 个核心组件</span>
      </div>
      \${filtered.length ? \`<div class="plugin-components-grid">\${filtered.map(c => renderComponentCard(c, p)).join('')}</div>\` : empty('未找到匹配的组件', '请尝试清除搜索词。')}
    \`;
  }
`;

const newRenderPluginDetail = `
  function renderPluginDetail(id){
    const p=pluginById(id);
    const comps=getPluginComponents(p);
    const subTab=state.pluginTab==='docs'?'docs':state.pluginTab==='nodes'?'nodes':'components';
    return \`<div class="plugin-detail-wrap \${subTab==='docs'?'has-doc-studio':''}">
      <div class="plugin-detail-top">
        <button class="back-link" data-action="back-plugins">\${icon('arrow')}返回插件库</button>
        <div class="plugin-detail-header">
          <div class="plugin-detail-avatar">\${icon(p.icon||'puzzle')}</div>
          <div class="plugin-detail-info">
            <h1>\${escape(p.name)} <span class="plugin-identifier">\${escape(p.identifier)}</span></h1>
            <p>\${escape(p.description)}</p>
            <div class="inline-meta">
              <span class="badge" style="color:var(--accent)">\${escape(p.categoryName)}</span>
              <span class="badge badge-blue">UE \${escape(p.ue)}</span>
              <span class="badge" style="color:#7dd3fc">\${icon('folder')} 大小: \${escape(p.size)}</span>
              <span class="path-value">\${escape(p.path)}</span>
            </div>
          </div>
          <div class="plugin-detail-actions">
            <button class="button button-primary" data-action="install-plugin" data-id="\${p.id}">\${icon('plus')}安装到项目</button>
            <button class="button button-quiet" data-action="open-plugin-folder" data-id="\${p.id}">\${icon('folder')}所在目录</button>
          </div>
        </div>
        <div class="tabs" role="group" aria-label="插件内容">
          <button class="tab \${subTab==='components'?'active':''}" data-action="plugin-tab" data-tab="components">\${icon('puzzle')} 插件组件 (\${comps.length})</button>
          <button class="tab \${subTab==='nodes'?'active':''}" data-action="plugin-tab" data-tab="nodes">\${icon('boxes')} 蓝图节点 (\${p.blueprintNodes?.length||0})</button>
          <button class="tab \${subTab==='docs'?'active':''}" data-action="plugin-tab" data-tab="docs">\${icon('document')} 说明文档</button>
        </div>
      </div>
      <div class="plugin-detail-body">
        \${subTab==='components'?renderPluginComponents(p):subTab==='nodes'?renderPluginNodes(p):renderDocuments(p.id)}
      </div>
    </div>\`;
  }
`;

const oldRenderPluginDetailRegex = /function renderPluginDetail\(id\)\{[\s\S]*?return `<div class="plugin-detail-wrap[\s\S]*?<\/div>`;\s*\}/;
if (oldRenderPluginDetailRegex.test(appJs)) {
  appJs = appJs.replace(oldRenderPluginDetailRegex, componentRenderersCode + '\n' + newRenderPluginDetail);
  console.log('Replaced renderPluginDetail and added component renderers');
}

// 5. Update input event listener for bp-component-search
if (!appJs.includes("id==='bp-component-search'")) {
  appJs = appJs.replace(
    "if(id==='bp-node-search'){state.pluginNodeQuery=e.target.value;render();}",
    "if(id==='bp-node-search'){state.pluginNodeQuery=e.target.value;render();}\n    if(id==='bp-component-search'){state.pluginComponentQuery=e.target.value;render();}"
  );
}

fs.writeFileSync(appJsPath, appJs, 'utf8');

// 6. Update styles.css with CSS for .plugin-meta-single and component cards
const compCss = `
/* Plugin Meta Single (Only size) */
.plugin-meta-single {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--subtle);
  background: rgba(0, 0, 0, 0.22);
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 12px;
}
.plugin-meta-single .plugin-meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #cad5e2;
  font-size: 11.5px;
}
.plugin-meta-single .plugin-meta-item .icon {
  width: 13px;
  height: 13px;
  color: #38bdf8;
}

/* Plugin Components Layout */
.plugin-components-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 20px;
}
.plugin-component-card {
  background: #111a26;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
  transition: border-color .15s, box-shadow .15s;
}
.plugin-component-card:hover {
  border-color: rgba(56, 189, 248, 0.35);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}
.comp-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.comp-card-header-left {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  min-width: 260px;
}
.comp-icon-badge {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: #38bdf8;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.comp-icon-badge .icon {
  width: 20px;
  height: 20px;
}
.comp-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.comp-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.comp-name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.comp-cname {
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 500;
}
.comp-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--muted);
  flex-wrap: wrap;
}
.comp-mount-target {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #94a3b8;
}
.comp-mount-target .icon {
  width: 13px;
  height: 13px;
  color: #38bdf8;
}
.comp-card-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.comp-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.comp-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 650;
  color: #7dd3fc;
  letter-spacing: -0.2px;
}
.comp-section-title .icon {
  width: 14px;
  height: 14px;
}
.comp-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.65;
  color: #cbd5e1;
}
.comp-usage-box {
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.comp-step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.comp-step-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-top: 1px;
}
.comp-step-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  flex-shrink: 0;
  margin-top: 7px;
  margin-left: 7px;
  margin-right: 7px;
}
.comp-step-content {
  font-size: 12.5px;
  line-height: 1.6;
  color: #e2e8f0;
  flex: 1;
}
.comp-props-table {
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.comp-prop-row {
  display: grid;
  grid-template-columns: 220px 180px 1fr;
  gap: 10px;
  padding: 8px 12px;
  font-size: 11.5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  align-items: center;
}
.comp-prop-row:last-child {
  border-bottom: 0;
}
.comp-prop-col-name code {
  color: #7dd3fc;
  background: rgba(56, 189, 248, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.comp-prop-col-type {
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
}
.comp-prop-col-desc {
  color: var(--text);
  font-size: 12px;
}
@media (max-width: 900px) {
  .comp-prop-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
`;

if (!stylesCss.includes('.plugin-components-grid')) {
  stylesCss += '\n' + compCss;
  fs.writeFileSync(stylesCssPath, stylesCss, 'utf8');
  console.log('Appended component CSS to styles.css');
}
