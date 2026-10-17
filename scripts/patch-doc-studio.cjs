const fs = require('fs');
const path = require('path');

const docData = JSON.parse(fs.readFileSync(path.join(__dirname, '../界面原型/docs-data.json'), 'utf8'));

const code = `
  // Real embedded documentation dataset from docs-project
  const docsData = ${JSON.stringify(docData)};

  const docState = {
    subTab: 'docs', // 'docs' | 'development' | 'rules'
    pageId: 'p1769101542580', // 默认激活 '前置条件/项目须知'
    lang: 'bilingual', // 默认 BILINGUAL（对齐用户截图）
    mode: 'edit', // 默认 编辑模式（对齐用户截图）
    floatingCollapsed: false
  };

  function resolveDocAsset(src) {
    if (!src) return '';
    const clean = src.replace(/^\\/docs-assets\\//, '').replace(/^assets\\//, '').replace(/^\\.\\.\\/assets\\//, '');
    return 'docs-assets/' + clean;
  }

  function renderDocText(text) {
    if (!text) return '';
    const lines = escape(text).split('\\n');
    return lines.map(line => {
      return line.replace(/(https?:\\/\\/[^\\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }).join('<br>');
  }

  function renderDocuments(projectId) {
    const p = projectById(projectId && projectId !== 'all' ? projectId : state.projectId || 'xr');
    const doc = docsData;
    const activePage = doc.pages.find(pg => pg.id === docState.pageId) || doc.pages[0];
    const pageContent = doc.content[activePage.id] || { blocks: [] };

    let mainBodyHtml = '';

    if (docState.subTab === 'docs') {
      mainBodyHtml = \`
        <div class="doc-paper-container">
          <article class="doc-paper">
            <header class="doc-paper-header">
              <h1 class="doc-paper-h1">\${escape(activePage.title.zh)}</h1>
              <h2 class="doc-paper-h2">\${escape(activePage.title.en)}</h2>
              <hr class="doc-paper-divider">
            </header>
            <div class="doc-blocks">
              \${pageContent.blocks.map(b => {
                if (b.type === 'image') {
                  const src = resolveDocAsset(b.data?.src);
                  return \`<div class="doc-block doc-image-wrap">
                    <img src="\${src}" alt="文档说明插图" onerror="this.src='../docs-project/assets/\${src.replace(/^docs-assets\\//,'')}'" loading="lazy">
                  </div>\`;
                }
                const isSec = b.style?.isSectionHeader;
                const zhText = b.data?.zh ? \`<p class="doc-p-zh">\${renderDocText(b.data.zh)}</p>\` : '';
                const enText = b.data?.en ? \`<p class="doc-p-en">\${renderDocText(b.data.en)}</p>\` : '';
                if (docState.lang === 'zh') {
                  return \`<div class="doc-block \${isSec ? 'doc-block-section-header' : ''}">\${zhText || enText}</div>\`;
                } else if (docState.lang === 'en') {
                  return \`<div class="doc-block \${isSec ? 'doc-block-section-header' : ''}">\${enText || zhText}</div>\`;
                } else {
                  return \`<div class="doc-block \${isSec ? 'doc-block-section-header' : ''}">\${zhText}\${enText}</div>\`;
                }
              }).join('')}
            </div>
          </article>
          <aside class="doc-floating-toolbox" style="\${docState.floatingCollapsed?'display:none':''}">
            <button class="doc-float-collapse" data-action="doc-toggle-float" title="折叠/展开工具栏">\${icon('chevron')}</button>
            <span class="doc-float-tag">正文</span>
            <button class="doc-float-btn" data-action="doc-insert-text" title="插入正文文本">\${icon('document')}</button>
            <button class="doc-float-btn" data-action="doc-insert-image" title="插入插图">\${icon('image')}</button>
          </aside>
        </div>
      \`;
    } else if (docState.subTab === 'development') {
      mainBodyHtml = \`
        <div class="doc-paper-container">
          <article class="doc-paper">
            <header class="doc-paper-header">
              <h1 class="doc-paper-h1">项目资料与开发记录</h1>
              <h2 class="doc-paper-h2">Project Records & Development Context</h2>
              <hr class="doc-paper-divider">
            </header>
            <div class="doc-blocks">
              <div class="doc-block doc-block-section-header">
                <p class="doc-p-zh">1. 当前开发状态 (Current State)</p>
                <p class="doc-p-en">项目基线：UE 5.4 / 5.6，支持 Quest 3 & PICO 4 Pro 手势追踪；源码位于 Plugins/OpenXRUI。</p>
              </div>
              <div class="doc-block doc-block-section-header">
                <p class="doc-p-zh">2. 决策记录 (Architecture Decisions)</p>
                <p class="doc-p-en">已完成项目管理器平台体检优化（PC, PCVR, 一体机顺序对齐）；MCP 转为顶栏轻量配置；文档工具完整呈现双语模式与真实图文排版。</p>
              </div>
              <div class="doc-block doc-block-section-header">
                <p class="doc-p-zh">3. 已知异常与排查 (Issues & Troubleshooting)</p>
                <p class="doc-p-en">UE 5.5 PICO 一体机安卓存在控件交互 UI 异常；UE 5.7 VR 模板需重新配置 XRPawn。</p>
              </div>
            </div>
          </article>
        </div>
      \`;
    } else {
      mainBodyHtml = \`
        <div class="doc-paper-container">
          <article class="doc-paper">
            <header class="doc-paper-header">
              <h1 class="doc-paper-h1">虚幻引擎通用规则</h1>
              <h2 class="doc-paper-h2">Common Guidelines & Best Practices</h2>
              <hr class="doc-paper-divider">
            </header>
            <div class="doc-blocks">
              <div class="doc-block doc-block-section-header">
                <p class="doc-p-zh">1. 资产命名与目录规范</p>
                <p class="doc-p-en">蓝图使用 BP_ 前缀，组件使用 BPC_ 前缀，材质使用 M_ 前缀，静态网格体使用 SM_ 前缀。</p>
              </div>
              <div class="doc-block doc-block-section-header">
                <p class="doc-p-zh">2. 跨版本兼容性要求</p>
                <p class="doc-p-en">保持对 UE 5.3~5.7 的 API 兼容；废弃节点在 5.5+ 条件宏或蓝图分流下自动平滑过渡。</p>
              </div>
            </div>
          </article>
        </div>
      \`;
    }

    return \`
      <div class="doc-studio-layout">
        <!-- Sidebar -->
        <aside class="doc-studio-sidebar">
          <div class="doc-sidebar-header">
            <div class="doc-header-brand-row">
              <button class="doc-home-btn" data-action="doc-home" title="返回项目库">\${icon('home')}</button>
              <div class="doc-brand-badge">
                <div class="doc-book-icon">\${icon('book')}</div>
                <span>\${escape(doc.sidebarTitle || 'UE5 Documentation')}</span>
              </div>
            </div>
            <div class="doc-project-sub">所属项目：<strong>\${escape(p.name)}</strong> · \${escape(p.descriptorName||p.name.toLowerCase().replace(/\\s+/g,'-'))}</div>
            <div class="doc-subnav-pills" role="tablist">
              <button class="doc-subnav-pill \${docState.subTab==='docs'?'active':''}" data-action="doc-subtab" data-id="docs">\${icon('document')}文档</button>
              <button class="doc-subnav-pill \${docState.subTab==='development'?'active':''}" data-action="doc-subtab" data-id="development">\${icon('lock')}项目资料</button>
              <button class="doc-subnav-pill \${docState.subTab==='rules'?'active':''}" data-action="doc-subtab" data-id="rules">\${icon('file')}通用规则</button>
            </div>
          </div>

          <div class="doc-page-list">
            \${docState.subTab==='docs'?doc.pages.map(pg => \`
              <button class="doc-page-item \${docState.pageId===pg.id?'active':''}" data-action="doc-select-page" data-id="\${pg.id}">
                <span class="doc-page-dot"></span>
                <div class="doc-page-item-info">
                  <span class="doc-page-item-title">\${escape(pg.title.zh)}</span>
                  <small class="doc-page-item-sub">\${escape(pg.title.en)}</small>
                </div>
              </button>
            \`).join(''):docState.subTab==='development'?\`
              <button class="doc-page-item active"><span class="doc-page-dot"></span><div class="doc-page-item-info"><span class="doc-page-item-title">项目资料与开发交接</span><small class="doc-page-item-sub">Project Records</small></div></button>
            \`:\`
              <button class="doc-page-item active"><span class="doc-page-dot"></span><div class="doc-page-item-info"><span class="doc-page-item-title">虚幻引擎通用规则</span><small class="doc-page-item-sub">Common Rules</small></div></button>
            \`}
          </div>

          <div class="doc-sidebar-footer">
            <button class="doc-new-page-btn" data-action="doc-new-page">\${icon('plus')} 新建页面</button>
            <div class="doc-lang-wrap">
              <span class="doc-lang-label">界面语言 / Language</span>
              <div class="doc-lang-segmented" role="group">
                <button class="doc-lang-btn \${docState.lang==='zh'?'active':''}" data-action="doc-lang" data-id="zh">ZH</button>
                <button class="doc-lang-btn \${docState.lang==='en'?'active':''}" data-action="doc-lang" data-id="en">EN</button>
                <button class="doc-lang-btn \${docState.lang==='bilingual'?'active':''}" data-action="doc-lang" data-id="bilingual">BILINGUAL</button>
              </div>
            </div>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="doc-studio-main">
          <header class="doc-studio-topbar">
            <div class="doc-topbar-left">
              <span class="doc-topbar-logo">UE5</span>
              <div class="doc-mode-toggle" role="group">
                <button class="doc-mode-btn \${docState.mode==='preview'?'active':''}" data-action="doc-mode" data-id="preview">\${icon('sparkles')} 预览模式</button>
                <button class="doc-mode-btn \${docState.mode==='edit'?'active':''}" data-action="doc-mode" data-id="edit">\${icon('sliders')} 编辑模式</button>
              </div>
            </div>
            <div class="doc-topbar-right">
              <button class="doc-ai-btn" data-action="doc-translate">\${icon('sparkles')} AI 全文翻译</button>
              <span class="doc-account-badge" title="当前连接的发布账号">\${icon('cloud')} → a134448643-hub</span>
              <button class="doc-top-tool-btn" data-action="doc-share" title="复制分享链接">\${icon('share')}</button>
              <button class="doc-top-tool-btn" data-action="doc-print" title="打印 / 导出 PDF">\${icon('printer')}</button>
              <button class="doc-publish-btn" data-action="doc-publish">\${icon('upload')} 发布</button>
            </div>
          </header>

          <section class="doc-studio-canvas">
            \${mainBodyHtml}
          </section>
        </main>
      </div>
    \`;
  }

  function documentAction(action, id, button) {
    if (!action.startsWith('doc-')) return false;
    if (action === 'doc-home') {
      if (state.route === 'documents') route('projects');
      else openProject(state.projectId, 'overview');
      return true;
    }
    if (action === 'doc-select-page') {
      docState.pageId = id;
      render();
      return true;
    }
    if (action === 'doc-subtab') {
      docState.subTab = id;
      render();
      return true;
    }
    if (action === 'doc-lang') {
      docState.lang = id;
      render();
      return true;
    }
    if (action === 'doc-mode') {
      docState.mode = id;
      render();
      toast('已切换为【' + (id === 'preview' ? '预览模式' : '编辑模式') + '】');
      return true;
    }
    if (action === 'doc-translate') {
      toast('AI 全文翻译：已对齐并刷新双语内容 ✨');
      return true;
    }
    if (action === 'doc-share') {
      copy('https://a134448643-hub.github.io/openxr-ui-docs/');
      return true;
    }
    if (action === 'doc-print') {
      window.print();
      return true;
    }
    if (action === 'doc-publish') {
      toast('已成功发布至 GitHub Pages: https://a134448643-hub.github.io/openxr-ui-docs/ 🚀');
      return true;
    }
    if (action === 'doc-toggle-float') {
      docState.floatingCollapsed = !docState.floatingCollapsed;
      render();
      return true;
    }
    if (action === 'doc-new-page') {
      modal('新建文档页面', '为当前文档工具添加新页面', \`
        <div class="edit-tags-dialog">
          <label class="field-label" for="new-page-zh">中文标题</label>
          <input id="new-page-zh" class="form-input" placeholder="例如：5. 手势碰撞体参数调优">
          <label class="field-label" for="new-page-en" style="margin-top:12px">英文标题</label>
          <input id="new-page-en" class="form-input" placeholder="例如：5. Gesture Collision Parameters Tuning">
        </div>
      \`, \`<button class="button button-quiet" data-action="close-modal">取消</button><button class="button button-primary" data-action="doc-save-new-page">创建页面</button>\`);
      return true;
    }
    if (action === 'doc-save-new-page') {
      const zh = $('new-page-zh')?.value.trim() || '新页面';
      const en = $('new-page-en')?.value.trim() || 'New Page';
      const newId = 'p' + Date.now();
      docsData.pages.push({ id: newId, title: { zh, en } });
      docsData.content[newId] = {
        blocks: [
          { id: 'b' + Date.now(), type: 'text', style: { isSectionHeader: true }, data: { zh, en } },
          { id: 'b' + (Date.now() + 1), type: 'text', data: { zh: '在此处输入新页面的正文说明...', en: 'Input page description here...' } }
        ]
      };
      docState.pageId = newId;
      closeModal();
      render();
      toast('已创建新页面【' + zh + '】✨');
      return true;
    }
    if (action === 'doc-insert-text') {
      const active = docsData.content[docState.pageId];
      if (active) {
        active.blocks.push({
          id: 'b' + Date.now(),
          type: 'text',
          data: { zh: '新增正文段落...', en: 'New paragraph...' }
        });
        render();
        toast('已在页面底部插入文本块');
      }
      return true;
    }
    if (action === 'doc-insert-image') {
      toast('插图工具就绪：支持直接展示已有工程截图');
      return true;
    }
    return false;
  }
`;

const appJsPath = path.join(__dirname, '../界面原型/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const startMarker = '  // Documents remain owned and edited by the existing Local Documentation Studio.';
const endMarker = '  // Native operations share the existing local service; no browser path-copy substitute.';

const startIndex = appJs.indexOf(startMarker);
const endIndex = appJs.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  throw new Error('Markers not found: ' + startIndex + ' / ' + endIndex);
}

const newAppJs = appJs.slice(0, startIndex) + code.trim() + '\n\n' + appJs.slice(endIndex);
fs.writeFileSync(appJsPath, newAppJs, 'utf8');
console.log('Successfully replaced document handling in app.js!');
