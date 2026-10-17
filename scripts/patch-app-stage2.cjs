const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Replace clearDrag() and insert drag handlers
const targetClearDrag = `  function clearDrag(){document.querySelectorAll('.drag-source,.drop-target,.drop-hover').forEach(el=>el.classList.remove('drag-source','drop-target','drop-hover'));draggedId=null;}`;

const replacementClearDrag = `  let draggedPluginId=null;
  function clearDrag(){
    document.querySelectorAll('.drag-source,.drop-target,.drop-hover').forEach(el=>el.classList.remove('drag-source','drop-target','drop-hover'));
    draggedId=null;
    draggedPluginId=null;
  }
  function pluginOrderIds(){
    const ids=state.plugins.map(p=>p.id);
    return [...new Set([...(state.pluginOrder||[]), ...ids])].filter(id=>ids.includes(id));
  }
  function reorderPlugin(from,to){
    if(from===to||state.pluginSort!=='manual')return;
    const visible=filteredPlugins().map(p=>p.id);
    const a=visible.indexOf(from),b=visible.indexOf(to);
    if(a<0||b<0)return;
    const all=pluginOrderIds();
    visible.splice(a,1);
    visible.splice(b,0,from);
    const subset=new Set(visible);
    let i=0;
    state.pluginOrder=all.map(id=>subset.has(id)?visible[i++]:id);
    save();render();
    const fs=$('footer-status');if(fs)fs.textContent='插件排序已保存';
  }
  function assignPluginCategory(pluginId,catId){
    const p=pluginById(pluginId);
    if(!p)return;
    if(p.category===catId){
      toast('插件【'+p.name+'】已在【'+(pluginCategories.find(c=>c.id===catId)?.name||catId)+'】分类中');
      return;
    }
    const catObj=pluginCategories.find(c=>c.id===catId);
    p.category=catId;
    if(catObj)p.categoryName=catObj.name;
    save();render();
    toast('已将插件【'+p.name+'】移动至【'+(catObj?.name||catId)+'】分类 ✨');
  }`;

if (!content.includes(targetClearDrag)) {
  console.error('Target clearDrag not found');
  process.exit(1);
}
content = content.replace(targetClearDrag, replacementClearDrag);

// 2. Replace dragstart, dragover, dragleave, drop
const targetDragEvents = `  document.addEventListener('dragstart',e=>{const el=e.target.closest('[data-project-card]');if(!el||modalKind)return;const interactive=e.target.closest('button[data-action]:not([data-action="open-project"]),a,input,select,textarea');if(interactive)return;draggedId=el.dataset.projectCard;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedId);el.classList.add('drag-source');});
  document.addEventListener('dragover',e=>{if(!draggedId)return;const dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]'),dropCard=e.target.closest('[data-project-card]');if(dropCat||dropStatus){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));(dropCat||dropStatus).classList.add('drop-hover');return;}if(dropCard&&state.sort==='manual'){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));if(dropCard.dataset.projectCard!==draggedId)dropCard.classList.add('drop-target');}});
  document.addEventListener('dragleave',e=>{const dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]');if(dropCat&&!dropCat.contains(e.relatedTarget))dropCat.classList.remove('drop-hover');if(dropStatus&&!dropStatus.contains(e.relatedTarget))dropStatus.classList.remove('drop-hover');const dropCard=e.target.closest('[data-project-card]');if(dropCard&&!dropCard.contains(e.relatedTarget))dropCard.classList.remove('drop-target');});
  document.addEventListener('drop',e=>{if(!draggedId)return;const from=draggedId,dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]'),dropCard=e.target.closest('[data-project-card]');clearDrag();if(dropCat){e.preventDefault();const catId=dropCat.dataset.dropCategory;if(catId&&catId!=='all')assignProjectCategory(from,catId);return;}if(dropStatus){e.preventDefault();const stId=dropStatus.dataset.dropStatus;if(stId&&stId!=='all'&&stId!=='favorites')assignProjectStatus(from,stId);return;}if(dropCard&&state.sort==='manual'){e.preventDefault();reorderProject(from,dropCard.dataset.projectCard);}});`;

const replacementDragEvents = `  document.addEventListener('dragstart',e=>{
    const pCard=e.target.closest('[data-plugin-card]');
    if(pCard&&!modalKind){
      const interactive=e.target.closest('button[data-action]:not([data-action="open-plugin"]),a,input,select,textarea');
      if(interactive)return;
      draggedPluginId=pCard.dataset.pluginCard;
      e.dataTransfer.effectAllowed='move';
      e.dataTransfer.setData('text/plain',draggedPluginId);
      pCard.classList.add('drag-source');
      return;
    }
    const el=e.target.closest('[data-project-card]');
    if(!el||modalKind)return;
    const interactive=e.target.closest('button[data-action]:not([data-action="open-project"]),a,input,select,textarea');
    if(interactive)return;
    draggedId=el.dataset.projectCard;
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',draggedId);
    el.classList.add('drag-source');
  });
  document.addEventListener('dragover',e=>{
    if(draggedPluginId){
      const dropCat=e.target.closest('[data-drop-plugin-category]'),dropCard=e.target.closest('[data-plugin-card]');
      if(dropCat){
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        document.querySelectorAll('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));
        dropCat.classList.add('drop-hover');
        return;
      }
      if(dropCard&&state.pluginSort==='manual'){
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));
        if(dropCard.dataset.pluginCard!==draggedPluginId)dropCard.classList.add('drop-target');
      }
      return;
    }
    if(!draggedId)return;
    const dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]'),dropCard=e.target.closest('[data-project-card]');
    if(dropCat||dropStatus){
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      document.querySelectorAll('.drop-hover').forEach(x=>x.classList.remove('drop-hover'));
      (dropCat||dropStatus).classList.add('drop-hover');
      return;
    }
    if(dropCard&&state.sort==='manual'){
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
      document.querySelectorAll('.drop-target').forEach(x=>x.classList.remove('drop-target'));
      if(dropCard.dataset.projectCard!==draggedId)dropCard.classList.add('drop-target');
    }
  });
  document.addEventListener('dragleave',e=>{
    if(draggedPluginId){
      const dropCat=e.target.closest('[data-drop-plugin-category]');
      if(dropCat&&!dropCat.contains(e.relatedTarget))dropCat.classList.remove('drop-hover');
      const dropCard=e.target.closest('[data-plugin-card]');
      if(dropCard&&!dropCard.contains(e.relatedTarget))dropCard.classList.remove('drop-target');
      return;
    }
    const dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]');
    if(dropCat&&!dropCat.contains(e.relatedTarget))dropCat.classList.remove('drop-hover');
    if(dropStatus&&!dropStatus.contains(e.relatedTarget))dropStatus.classList.remove('drop-hover');
    const dropCard=e.target.closest('[data-project-card]');
    if(dropCard&&!dropCard.contains(e.relatedTarget))dropCard.classList.remove('drop-target');
  });
  document.addEventListener('drop',e=>{
    if(draggedPluginId){
      const from=draggedPluginId;
      const dropCat=e.target.closest('[data-drop-plugin-category]');
      const dropCard=e.target.closest('[data-plugin-card]');
      clearDrag();
      if(dropCat){
        e.preventDefault();
        const catId=dropCat.dataset.dropPluginCategory;
        if(catId&&catId!=='all')assignPluginCategory(from,catId);
        return;
      }
      if(dropCard&&state.pluginSort==='manual'){
        e.preventDefault();
        reorderPlugin(from,dropCard.dataset.pluginCard);
        return;
      }
      return;
    }
    if(!draggedId)return;
    const from=draggedId,dropCat=e.target.closest('[data-drop-category]'),dropStatus=e.target.closest('[data-drop-status]'),dropCard=e.target.closest('[data-project-card]');
    clearDrag();
    if(dropCat){e.preventDefault();const catId=dropCat.dataset.dropCategory;if(catId&&catId!=='all')assignProjectCategory(from,catId);return;}
    if(dropStatus){e.preventDefault();const stId=dropStatus.dataset.dropStatus;if(stId&&stId!=='all'&&stId!=='favorites')assignProjectStatus(from,stId);return;}
    if(dropCard&&state.sort==='manual'){e.preventDefault();reorderProject(from,dropCard.dataset.projectCard);}
  });`;

if (!content.includes(targetDragEvents)) {
  console.error('Target drag events not found');
  process.exit(1);
}
content = content.replace(targetDragEvents, replacementDragEvents);

// 3. Replace filteredPlugins through renderPlugins by exact substring indices
const startMarker = '  function filteredPlugins(){';
const endMarker = '  function openInstallPluginModal(id){';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) {
  console.error('Start or end marker for plugin section not found', startIdx, endIdx);
  process.exit(1);
}

const replacementPluginSection = `function openPlugin(id,tab='nodes'){
    state.pluginId=id;
    state.pluginTab=tab;
    state.route='plugin';
    state.pluginNodeQuery='';
    state.pluginNodeType='all';
    render();
    window.scrollTo({top:0,behavior:'instant'});
    save();
  }
  function filteredPlugins(){
    const order=pluginOrderIds();
    const query=(state.route==='plugins'?state.query:'').toLowerCase().trim();
    return state.plugins.filter(p=>{
      if(state.pluginCategory!=='all'&&p.category!==state.pluginCategory) return false;
      if(state.pluginFilter==='favorites'&&!pluginFavorite(p)) return false;
      if(state.pluginFilter!=='all'&&state.pluginFilter!=='favorites'&&p.type!==state.pluginFilter) return false;
      if(query){
        const text=[p.name,p.identifier,p.description,p.typeLabel,p.path,...(p.tags||[]),...(p.dependencies||[]),...p.modules.map(m=>m.name)].join(' ').toLowerCase();
        if(!text.includes(query)) return false;
      }
      return true;
    }).sort((a,b)=>{
      if(state.pluginSort==='name') return a.name.localeCompare(b.name,'zh-CN',{numeric:true});
      if(state.pluginSort==='recent') return (b.activity||'').localeCompare(a.activity||'');
      return order.indexOf(a.id)-order.indexOf(b.id);
    });
  }
  function pluginCard(p){
    const isFav=pluginFavorite(p);
    return \`<div class="plugin-card" draggable="true" data-plugin-card="\${p.id}">
      <div class="plugin-card-banner \${p.accentClass}" data-action="open-plugin" data-id="\${p.id}" style="cursor:pointer" title="点击进入插件详情与蓝图节点">
        <div class="plugin-banner-top">
          <span class="plugin-type-badge no-launch">\${icon('code')}\${p.typeLabel}</span>
          <button class="icon-button \${isFav?'is-favorite':''}" data-action="plugin-favorite" data-id="\${p.id}" aria-label="收藏插件" title="\${isFav?'取消收藏':'设为收藏'}">\${icon('star')}</button>
        </div>
        <div class="plugin-banner-bottom">
          <div class="plugin-icon-wrap">\${icon(p.icon||'puzzle')}</div>
          <div style="display:flex;gap:5px;align-items:center">
            \${p.blueprintNodes?.length ? \`<span class="badge badge-purple" style="font-size:9.5px">\${icon('boxes')}\${p.blueprintNodes.length} 节点</span>\` : ''}
            <span class="badge badge-blue">UE \${escape(p.ue)}</span>
          </div>
        </div>
      </div>
      <div class="plugin-card-body">
        <div class="plugin-title-row">
          <button class="project-title" data-action="open-plugin" data-id="\${p.id}" style="text-align:left;cursor:pointer;border:0;background:transparent;padding:0" title="查看详情">\${escape(p.name)}</button>
          <span class="plugin-identifier">\${escape(p.identifier)}</span>
        </div>
        <p class="plugin-desc" data-action="open-plugin" data-id="\${p.id}" style="cursor:pointer">\${escape(p.description)}</p>
        <div class="plugin-meta-grid">
          <div class="plugin-meta-item" title="包含模块">\${icon('boxes')}<span>模块: \${escape(p.modules.map(m=>m.name).join(', '))}</span></div>
          <div class="plugin-meta-item" title="依赖模块">\${icon('link')}<span>依赖: \${escape((p.dependencies||[]).join(', '))}</span></div>
          <div class="plugin-meta-item" title="磁盘占用">\${icon('folder')}<span>大小: \${escape(p.size)}</span></div>
          <div class="plugin-meta-item" title="编译就绪状态">\${icon('circlecheck')}<span>\${escape(p.statusLabel)}</span></div>
        </div>
        <div class="plugin-card-actions">
          <button class="button-launch" data-action="open-plugin" data-id="\${p.id}" title="进入插件详情，查看蓝图节点与文档">\${icon('book')}详情与节点</button>
          <button class="plugin-install-btn" data-action="install-plugin" data-id="\${p.id}" title="将此插件安装或挂载至项目库工程">\${icon('plus')}安装</button>
          <button class="plugin-tool-btn" data-action="build-plugin" data-id="\${p.id}" title="调用 UBT / RunUAT 独立构建插件">\${icon('hammer')}编译</button>
          <button class="icon-button" data-action="open-plugin-ide" data-id="\${p.id}" title="在 IDE 中查看源码">\${icon('code')}</button>
        </div>
      </div>
    </div>\`;
  }
  function pluginListRow(p){
    return \`<div class="project-list-row" draggable="true" data-plugin-card="\${p.id}">
      <div class="plugin-icon-wrap" style="width:48px;height:48px;flex-shrink:0">\${icon(p.icon||'puzzle')}</div>
      <div class="project-list-name">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="project-title" data-action="open-plugin" data-id="\${p.id}" style="text-align:left;cursor:pointer;border:0;background:transparent;padding:0;font-weight:650">\${escape(p.name)}</button>
          <span class="plugin-identifier">\${escape(p.identifier)}</span>
          <span class="badge" style="color:#fcd34d">\${escape(p.typeLabel)}</span>
          <span class="badge badge-blue">UE \${escape(p.ue)}</span>
          \${p.blueprintNodes?.length ? \`<span class="badge badge-purple">\${icon('boxes')}\${p.blueprintNodes.length} 个蓝图节点</span>\` : ''}
          <span style="font-size:11px;color:var(--subtle);margin-left:auto">\${escape(p.path)}</span>
        </div>
        <p>\${escape(p.description)}</p>
      </div>
      <div class="card-actions" style="margin-left:auto;border:0;padding:0;gap:6px">
        <button class="button-launch" data-action="open-plugin" data-id="\${p.id}">\${icon('book')}详情与节点</button>
        <button class="plugin-install-btn" data-action="install-plugin" data-id="\${p.id}">\${icon('plus')}安装</button>
        <button class="plugin-tool-btn" data-action="build-plugin" data-id="\${p.id}">\${icon('hammer')}编译</button>
        <button class="plugin-tool-btn" data-action="open-plugin-ide" data-id="\${p.id}">\${icon('code')}源码</button>
      </div>
    </div>\`;
  }
  function renderPlugins(){
    const found=filteredPlugins();
    return \`<div class="page-heading">
      <div>
        <div class="eyebrow">PLUGIN VAULT &amp; C++ MODULES</div>
        <h1>\${state.pluginCategory==='all'?'插件库':escape(pluginCategories.find(c=>c.id===state.pluginCategory)?.name||'插件库')}</h1>
        <p class="page-description">\${state.plugins.length} 个 C++ 源码模块与独立工具。<strong>支持按住卡片手动拖拽排序，拖拽至顶部分类胶囊快速归类；点击任意插件进入详情查看暴露的蓝图节点与文档。</strong></p>
      </div>
      <div class="page-actions">
        <button class="button button-debug" data-action="add-demo-plugin" title="添加 1 个测试 C++ 插件 (调试)">\${icon('plus')}添加测试插件 (调试)</button>
        <button class="button button-primary" data-action="scan-plugin-folder">\${icon('folder')}导入插件文件夹</button>
      </div>
    </div>
    <div class="category-toolbar">
      <div class="category-tabs" role="group" aria-label="插件分类">
        \${pluginCategories.map(c=>\`<button class="category-pill \${state.pluginCategory===c.id?'active':''}" data-action="plugin-category" data-id="\${c.id}" \${c.id!=='all'?\`data-drop-plugin-category="\${c.id}"\`:''} style="--cat-color:\${c.color}" aria-pressed="\${state.pluginCategory===c.id}" title="\${c.id!=='all'?'点击筛选分类 / 拖拽插件卡片到此处直接归类':'全部插件'}">\${escape(c.name)}<small>\${c.id==='all'?state.plugins.length:state.plugins.filter(p=>p.category===c.id).length}</small></button>\`).join('')}
      </div>
    </div>
    <div class="filter-toolbar">
      <div class="filters">
        \${pluginFilters.map(f=>\`<button class="status-pill \${state.pluginFilter===f.id?'active':''}" data-action="plugin-filter" data-id="\${f.id}" style="--status-color:\${f.color}">\${escape(f.name)}<small>\${f.id==='all'?state.plugins.length:f.id==='favorites'?state.plugins.filter(pluginFavorite).length:state.plugins.filter(p=>p.type===f.id).length}</small></button>\`).join('')}
      </div>
      <div class="library-display">
        <select id="plugin-sort" class="sort-select" aria-label="插件排序方式">
          <option value="manual" \${state.pluginSort==='manual'?'selected':''}>自定义拖拽排序</option>
          <option value="recent" \${state.pluginSort==='recent'?'selected':''}>最近更新</option>
          <option value="name" \${state.pluginSort==='name'?'selected':''}>插件名称</option>
        </select>
        <div class="view-toggle" role="group" aria-label="插件展示方式">
          <button class="icon-button \${state.pluginView==='grid'?'active':''}" data-action="plugin-view" data-id="grid" aria-label="网格视图" aria-pressed="\${state.pluginView==='grid'}">\${icon('grid')}</button>
          <button class="icon-button \${state.pluginView==='list'?'active':''}" data-action="plugin-view" data-id="list" aria-label="列表视图" aria-pressed="\${state.pluginView==='list'}">\${icon('list')}</button>
        </div>
      </div>
    </div>
    <div class="library-context">
      <span>\${found.length} 个插件 / 模块\${state.pluginCategory!=='all'?' · '+escape(pluginCategories.find(c=>c.id===state.pluginCategory)?.name):''}</span>
      <span>\${state.pluginSort==='manual'?'直接按住卡片拖动可排序，拖至顶部胶囊可直接归类':'拖动卡片至顶部分类胶囊完成归类（当前按'+{recent:'最近更新',name:'插件名称'}[state.pluginSort]+'排序）'}</span>
    </div>
    \${found.length?\`<div class="\${state.pluginView==='grid'?'plugin-grid':'project-list-view'}">\${found.map(state.pluginView==='grid'?pluginCard:pluginListRow).join('')}</div>\`:empty('没有找到符合条件的插件或工具','可尝试更换分类/筛选标签，或点击右上角导入插件文件夹。')}\`;
  }

  function renderPluginNodes(p){
    const nodes=p.blueprintNodes||[];
    const q=(state.pluginNodeQuery||'').toLowerCase().trim();
    const filterType=state.pluginNodeType||'all';
    const filtered=nodes.filter(n=>{
      if(filterType!=='all'&&n.type!==filterType)return false;
      if(q){
        const text=[n.name,n.cName,n.category,n.description,n.cpp,...(n.inputs||[]).map(i=>i.name+' '+i.type),...(n.outputs||[]).map(o=>o.name+' '+o.type)].join(' ').toLowerCase();
        if(!text.includes(q))return false;
      }
      return true;
    });
    const filterButtons=[
      {id:'all',label:'全部节点 ('+nodes.length+')'},
      {id:'BlueprintCallable',label:'Callable ('+nodes.filter(n=>n.type==='BlueprintCallable').length+')'},
      {id:'BlueprintPure',label:'Pure ('+nodes.filter(n=>n.type==='BlueprintPure').length+')'},
      {id:'AsyncAction',label:'Async Action ('+nodes.filter(n=>n.type==='AsyncAction').length+')'}
    ];
    return \`<div class="bp-nodes-header">
      <label class="bp-nodes-search">
        \${icon('search')}
        <input id="bp-node-search" type="search" placeholder="搜索蓝图节点名称、参数、分类或说明..." value="\${escape(state.pluginNodeQuery||'')}">
      </label>
      <div class="bp-nodes-filters">
        \${filterButtons.map(fb=>\`<button class="bp-filter-pill \${filterType===fb.id?'active':''}" data-action="bp-filter" data-id="\${fb.id}">\${escape(fb.label)}</button>\`).join('')}
      </div>
      <span class="bp-nodes-count">\${filtered.length} / \${nodes.length} 个节点</span>
    </div>
    \${filtered.length ? \`<div class="bp-nodes-grid">\${filtered.map(n=>renderBlueprintNodeCard(n,p)).join('')}</div>\` : empty('未找到匹配的蓝图节点','请尝试清除搜索词或切换节点类型筛选标签。')}\`;
  }

  function renderBlueprintNodeCard(n,p){
    const typeBadgeClass={
      BlueprintCallable:'type-callable',
      BlueprintPure:'type-pure',
      AsyncAction:'type-async',
      EventDispatcher:'type-delegate'
    }[n.type]||'type-callable';
    const typeBadgeText={
      BlueprintCallable:'Callable',
      BlueprintPure:'Pure',
      AsyncAction:'Async Action',
      EventDispatcher:'Delegate'
    }[n.type]||n.type;
    return \`<div class="bp-node-card">
      <div class="bp-node-head">
        <div class="bp-node-head-left">
          <span class="bp-node-title">\${icon('boxes')}<strong>\${escape(n.name)}</strong>\${n.cName ? \`<small style="color:#94a3b8;font-weight:normal;margin-left:6px">\${escape(n.cName)}</small>\` : ''}</span>
          <span class="bp-node-category">\${escape(n.category)}</span>
        </div>
        <span class="bp-node-badge \${typeBadgeClass}">\${icon('code')}\${escape(typeBadgeText)}</span>
      </div>
      <div class="bp-node-body">
        <p class="bp-node-desc">\${escape(n.description)}</p>
        <div class="bp-pins-wrap">
          <div class="bp-pins-col">
            <span class="bp-pins-col-title">INPUT PINS (输入)</span>
            \${n.type==='BlueprintCallable'||n.type==='AsyncAction' ? \`<div class="bp-pin-row"><span class="bp-pin-dot pin-exec"></span><span class="bp-pin-name">Exec</span><span class="bp-pin-type">流程输入</span></div>\` : ''}
            \${(n.inputs||[]).map(inp=>\`<div class="bp-pin-row" title="\${escape(inp.name)}: \${escape(inp.type)}"><span class="bp-pin-dot pin-\${inp.pin||'object'}"></span><span class="bp-pin-name">\${escape(inp.name)}</span><span class="bp-pin-type">\${escape(inp.type)}</span>\${inp.default ? \`<span class="bp-pin-default">\${escape(inp.default)}</span>\` : ''}</div>\`).join('')}
          </div>
          <div class="bp-pins-col">
            <span class="bp-pins-col-title">OUTPUT PINS (输出)</span>
            \${n.type==='BlueprintCallable' ? \`<div class="bp-pin-row"><span class="bp-pin-dot pin-exec"></span><span class="bp-pin-name">Then</span><span class="bp-pin-type">流程输出</span></div>\` : ''}
            \${(n.outputs||[]).map(outp=>\`<div class="bp-pin-row" title="\${escape(outp.name)}: \${escape(outp.type)}"><span class="bp-pin-dot pin-\${outp.pin||'object'}"></span><span class="bp-pin-name">\${escape(outp.name)}</span><span class="bp-pin-type">\${escape(outp.type)}</span></div>\`).join('')}
          </div>
        </div>
        <div class="bp-cpp-box">
          <code class="bp-cpp-code" title="\${escape(n.cpp)}">\${escape(n.cpp)}</code>
          <button class="bp-copy-btn" data-action="copy-code" data-code="\${escape(n.cpp)}" title="复制 C++ 签名声明">\${icon('copy')}</button>
        </div>
      </div>
    </div>\`;
  }

  function renderPluginDocs(p){
    return \`<div class="plugin-readme-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:14px;flex-wrap:wrap;gap:10px">
        <div>
          <h2 style="margin:0;font-size:18px;color:var(--text)">\${escape(p.name)} · 说明与接入指南</h2>
          <small style="color:var(--subtle)">位置: \${escape(p.path)} · 引擎目标: UE \${escape(p.ue)}</small>
        </div>
        <div style="display:flex;gap:8px">
          <button class="button button-quiet" data-action="copy-code" data-code="\${escape(p.readme)}">\${icon('copy')}复制文档</button>
          <button class="button button-primary" data-action="open-plugin-folder" data-id="\${p.id}">\${icon('folder')}在资源管理器查看</button>
        </div>
      </div>
      <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
        <h3 style="margin-top:0;font-size:13px;color:#7dd3fc">\${icon('sparkles')} 快速引入说明</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:8px">在你的目标 UE 工程中引用此模块，请在 <code>Source/[ProjectName]/[ProjectName].Build.cs</code> 添加：</p>
        <pre style="margin:0"><code>PublicDependencyModuleNames.AddRange(new string[] { "\${escape(p.modules[0]?.name || p.identifier)}" });</code></pre>
      </div>
      <div>
        \${p.readme.split(/\\\\n\\\\n+/).map(block=>{
          block=block.trim();
          if(block.startsWith('# ')) return \`<h1 style="font-size:20px;color:var(--text);margin-bottom:10px">\${escape(block.slice(2))}</h1>\`;
          if(block.startsWith('## ')) return \`<h2 style="font-size:16px;color:#7dd3fc;margin:18px 0 8px">\${escape(block.slice(3))}</h2>\`;
          if(block.startsWith('- ')) return \`<ul style="padding-left:18px;margin:8px 0">\${block.split('\\\\n').map(l=>\`<li>\${escape(l.replace(/^-\\s+/,''))}</li>\`).join('')}</ul>\`;
          return \`<p style="font-size:12px;line-height:1.8;color:var(--muted)">\${escape(block)}</p>\`;
        }).join('')}
      </div>
    </div>\`;
  }

  function renderPluginOverview(p){
    const upluginCode=JSON.stringify({
      FileVersion: 3,
      Version: 1,
      VersionName: "1.0",
      FriendlyName: p.name,
      Description: p.description,
      Category: p.categoryName,
      CreatedBy: "Developer",
      CanContainContent: false,
      IsBetaVersion: false,
      Installed: true,
      Modules: p.modules.map(m=>({
        Name: m.name,
        Type: m.type,
        LoadingPhase: m.type === 'Editor' ? 'PostEngineInit' : 'Default'
      }))
    }, null, 2);

    return \`<div class="overview-grid">
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="content-panel">
          <div class="panel-label">C++ MODULES ARCHITECTURE</div>
          <h2>包含的 C++ 源码模块 (\${p.modules.length})</h2>
          <p>此插件工程为纯 C++ 模块库，无启动用 .uproject 依赖，通过 UBT 独立链接或挂载于工程 Plugins/ 目录。</p>
          <div class="plugin-modules-list" style="margin-top:14px">
            \${p.modules.map(m=>\`<div class="plugin-module-item"><div class="plugin-module-top"><strong>\${escape(m.name)}</strong><span class="badge \${m.type==='Editor'?'badge-purple':'badge-blue'}">\${escape(m.type)} 模块</span></div><div class="plugin-module-path">\${escape(m.buildCs)}</div></div>\`).join('')}
          </div>
        </div>
        <div class="content-panel">
          <div class="panel-label">DEPENDENCIES &amp; TAGS</div>
          <h2>引擎模块依赖与技术栈</h2>
          <div style="display:flex;gap:7px;flex-wrap:wrap;margin:12px 0">
            \${(p.dependencies||[]).map(d=>\`<span class="badge badge-blue">\${icon('link')}\${escape(d)}</span>\`).join('')}
          </div>
          <div class="panel-label" style="margin-top:16px">技术栈标签</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            \${(p.tags||[]).map(t=>\`<span class="plugin-tag">\${escape(t)}</span>\`).join('')}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <div class="content-panel">
          <div class="panel-label">PLUGIN DESCRIPTOR</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h2 style="margin:0;font-size:16px">\${escape(p.identifier)}.uplugin</h2>
            <button class="bp-copy-btn" data-action="copy-code" data-code="\${escape(upluginCode)}" title="复制 uplugin 描述内容">\${icon('copy')}</button>
          </div>
          <pre style="background:#090d16;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;font-family:'Cascadia Code',Consolas,monospace;font-size:10.5px;color:#7dd3fc;overflow-x:auto;max-height:280px;line-height:1.5;margin:0"><code>\${escape(upluginCode)}</code></pre>
        </div>
        <div class="content-panel">
          <div class="panel-label">METADATA &amp; STORAGE</div>
          <div class="overview-meta" style="margin-top:8px">
            <div>
              <span class="metadata-label">插件目录</span>
              <div class="path-value">\${escape(p.path)}</div>
            </div>
            <div>
              <span class="metadata-label">磁盘占用</span>
              <div class="metadata-value">\${escape(p.size)}</div>
            </div>
            <div>
              <span class="metadata-label">UE 版本兼容</span>
              <div class="metadata-value">Unreal Engine \${escape(p.ue)}</div>
            </div>
            <div>
              <span class="metadata-label">编译状态</span>
              <div class="metadata-value" style="color:var(--green)">\${escape(p.statusLabel)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>\`;
  }

  function renderPluginBuild(p){
    const cmd=\`Engine\\\\Build\\\\BatchFiles\\\\RunUAT.bat BuildPlugin -Plugin="\${p.path}\\\\\${p.identifier}.uplugin" -Package="\${p.path}\\\\Output" -Rocket\`;
    return \`<div class="content-panel" style="max-width:960px">
      <div class="panel-label">UBT STANDALONE BUILD</div>
      <h2>UnrealBuildTool / RunUAT 独立编译环境</h2>
      <p>无需启动 Unreal Editor，即可直接调用引擎批处理脚本对本 C++ 插件进行无头编译、语法诊断与打包验证。</p>
      <div style="display:flex;gap:12px;align-items:center;margin:16px 0;flex-wrap:wrap">
        <span class="badge badge-green">\${icon('circlecheck')}MSVC v143 / Clang 工具链就绪</span>
        <span class="badge badge-blue">UE \${escape(p.ue)} 引擎上下文</span>
        <button class="button button-primary" style="margin-left:auto" data-action="run-sim-build" data-id="\${p.id}">\${icon('play')}执行独立编译</button>
      </div>
      <div class="panel-label">构建命令行</div>
      <div style="background:#090d16;padding:10px 12px;border-radius:6px;font-family:'Cascadia Code',Consolas,monospace;font-size:11px;color:#fcd34d;word-break:break-all;margin-bottom:16px;border:1px solid rgba(255,255,255,0.06)">
        \${escape(cmd)}
      </div>
      <div class="panel-label">UBT 输出终端</div>
      <div class="plugin-build-log" id="plugin-detail-build-log"><span class="log-info">[UBT] Target Engine: Unreal Engine \${escape(p.ue)}</span>
<span class="log-info">[UBT] Discovered modules: \${escape(p.modules.map(m=>m.name).join(', '))}</span>
<span class="log-info">[UBT] Analyzing dependencies: \${escape((p.dependencies||[]).join(', '))}</span>
<span class="log-success">[UBT] Header parser completed without errors.</span>
<span class="log-success">[UBT] Compile finished: 0 errors, 0 warnings. Binary targets up to date.</span></div>
    </div>\`;
  }

  function renderPluginDetail(id){
    const p=pluginById(id);
    const subTab=state.pluginTab||'nodes';
    return \`<div>
      <button class="back-link" data-action="back-plugins">\${icon('arrow')}返回插件库</button>
      <div class="plugin-detail-header">
        <div class="plugin-detail-avatar">\${icon(p.icon||'puzzle')}</div>
        <div class="plugin-detail-info">
          <h1>\${escape(p.name)} <span class="plugin-identifier">\${escape(p.identifier)}</span></h1>
          <p>\${escape(p.description)}</p>
          <div class="inline-meta">
            <span class="badge" style="color:var(--accent)">\${escape(p.categoryName)}</span>
            <span class="badge" style="color:#fcd34d">\${escape(p.typeLabel)}</span>
            <span class="badge badge-blue">UE \${escape(p.ue)}</span>
            <span class="badge badge-green">\${icon('circlecheck')}\${escape(p.statusLabel)}</span>
            <span class="badge badge-purple">\${icon('boxes')}\${p.blueprintNodes?.length||0} 个暴露蓝图节点</span>
            <span>\${p.modules.length} 个 C++ 模块</span>
            <span>\${escape(p.size)}</span>
            <span class="path-value">\${escape(p.path)}</span>
          </div>
        </div>
        <div class="plugin-detail-actions">
          <button class="button button-primary" data-action="install-plugin" data-id="\${p.id}">\${icon('plus')}安装到项目</button>
          <button class="button" data-action="build-plugin" data-id="\${p.id}">\${icon('hammer')}UBT 独立编译</button>
          <button class="button" data-action="open-plugin-ide" data-id="\${p.id}">\${icon('code')}查看源码</button>
          <button class="button button-quiet" data-action="open-plugin-folder" data-id="\${p.id}">\${icon('folder')}所在目录</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab \${subTab==='nodes'?'active':''}" data-action="plugin-tab" data-tab="nodes">\${icon('boxes')} 暴露的蓝图节点 (\${p.blueprintNodes?.length||0})</button>
        <button class="tab \${subTab==='overview'?'active':''}" data-action="plugin-tab" data-tab="overview">\${icon('layers')} 模块与架构</button>
        <button class="tab \${subTab==='docs'?'active':''}" data-action="plugin-tab" data-tab="docs">\${icon('document')} 说明文档</button>
        <button class="tab \${subTab==='build'?'active':''}" data-action="plugin-tab" data-tab="build">\${icon('hammer')} UBT 编译与验证</button>
      </div>
      <div>
        \${subTab==='nodes'?renderPluginNodes(p):subTab==='overview'?renderPluginOverview(p):subTab==='docs'?renderPluginDocs(p):renderPluginBuild(p)}
      </div>
    </div>\`;
  }
  
  `;

content = content.substring(0, startIdx) + replacementPluginSection + content.substring(endIdx);

// 4. Update pluginAction handler
const targetPluginActionStart = `  function pluginAction(action,id,button){
    if(action==='plugin-category'){state.pluginCategory=id;render();return true;}`;

const replacementPluginActionStart = `  function pluginAction(action,id,button){
    if(action==='open-plugin'){openPlugin(id);return true;}
    if(action==='back-plugins'){route('plugins');return true;}
    if(action==='plugin-tab'){state.pluginTab=button.dataset.tab;render();return true;}
    if(action==='bp-filter'){state.pluginNodeType=id;render();return true;}
    if(action==='copy-code'){
      const code=button.dataset.code;
      if(code)copy(code);
      toast('已复制到剪贴板 📋');
      return true;
    }
    if(action==='run-sim-build'){
      const p=pluginById(id);
      const consoleEl=$('plugin-detail-build-log');
      if(consoleEl){
        consoleEl.innerHTML+='\\n<span class="log-cmd">[UBT] Executing standalone compilation for target Win64...</span>\\n<span class="log-info">[UBT] Dynamic link library created: '+p.identifier+'.dll</span>\\n<span class="log-success">[✓] BUILD SUCCESSFUL! Duration: 2.18s</span>';
        consoleEl.scrollTop=consoleEl.scrollHeight;
      }
      p.status='compiled';
      p.statusLabel='Binaries 已就绪';
      save();
      toast('【'+p.name+'】独立编译通过！🎉');
      return true;
    }
    if(action==='plugin-category'){state.pluginCategory=id;render();return true;}`;

if (!content.includes(targetPluginActionStart)) {
  console.error('Target pluginAction start not found');
  process.exit(1);
}
content = content.replace(targetPluginActionStart, replacementPluginActionStart);

// Update view-plugin-readme to open plugin docs tab
content = content.replace(
  "if(action==='view-plugin-readme'){openPluginReadme(id);return true;}",
  "if(action==='view-plugin-readme'){openPlugin(id, 'docs');return true;}"
);

// Add bp-node-search input listener
content = content.replace(
  "if(id==='node-search'){state.nodeQuery=e.target.value;render();}",
  "if(id==='node-search'){state.nodeQuery=e.target.value;render();}\n    if(id==='bp-node-search'){state.pluginNodeQuery=e.target.value;render();}"
);

// Save updated app.js
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Stage 2 patch successfully applied!');
