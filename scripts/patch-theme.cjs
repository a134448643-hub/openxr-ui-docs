const fs = require('fs');
const path = require('path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// Replace setTheme and renderThemeSelector
const oldSetThemeRegex = /function setTheme\([\s\S]*?function renderThemeSelector\([\s\S]*?<\/div>[\s\S]*?;\s*}/;

const newThemeHelpers = `function setTheme(themeId){
    if(!THEMES.some(t=>t.id===themeId))return;
    state.theme=themeId;
    document.documentElement.dataset.theme=themeId;
    try{localStorage.setItem('ue-pm-theme',themeId);}catch{}
    save();
    render();
    const currentTheme=THEMES.find(t=>t.id===themeId);
    toast('已切换为【'+currentTheme.name+'】色系');
  }

  function renderThemeSelector(context='global',compact=false){
    const current=THEMES.find(t=>t.id===state.theme)||THEMES[0];
    return \`<div class="theme-selector-wrap" data-theme-picker-id="\${context}"><button class="theme-picker-btn \${compact?'compact':''}" data-action="toggle-theme-picker" data-picker="\${context}" aria-haspopup="true" aria-expanded="false" title="切换界面与文档色系"><span class="theme-color-preview \${current.colorClass}"></span><span>\${escape(current.name)}</span>\${icon('chevron')}</button><div class="theme-menu" role="menu" hidden><div class="theme-menu-header">界面与文档色系</div>\${THEMES.map(t=>\`<button class="theme-menu-item \${t.id===state.theme?'active':''}" data-action="set-theme" data-theme-id="\${t.id}" role="menuitem"><span class="theme-color-preview \${t.colorClass}"></span><span class="theme-meta"><strong>\${escape(t.name)}</strong><small>\${escape(t.desc)}</small></span>\${t.id===state.theme?icon('check'):''}</button>\`).join('')}</div></div>\`;
  }`;

if (oldSetThemeRegex.test(code)) {
  code = code.replace(oldSetThemeRegex, newThemeHelpers);
}

// Replace click handler start
const oldClickRegex = /document\.addEventListener\('click',async event=>\{[\s\S]*?if\(action==='set-theme'\)\{[\s\S]*?return;\s*\}/;

const newClickStart = `document.addEventListener('click',async event=>{
    if(!event.target.closest('.theme-selector-wrap')){
      document.querySelectorAll('.theme-menu').forEach(m=>{m.hidden=true;});
      document.querySelectorAll('.theme-picker-btn').forEach(b=>{b.setAttribute('aria-expanded','false');});
    }
    const nav=event.target.closest('[data-nav]');if(nav){route(nav.dataset.nav);return;}
    const button=event.target.closest('[data-action]');if(!button)return;const {action,id,preset,node,entry,picker,themeId}=button.dataset;
    if(action==='toggle-theme-picker'){
      const wrap=button.closest('.theme-selector-wrap');
      const menu=wrap?.querySelector('.theme-menu');
      if(menu){
        const isHidden=menu.hidden;
        document.querySelectorAll('.theme-menu').forEach(m=>{m.hidden=true;});
        document.querySelectorAll('.theme-picker-btn').forEach(b=>{b.setAttribute('aria-expanded','false');});
        menu.hidden=!isHidden;
        button.setAttribute('aria-expanded',String(!isHidden));
      }
      return;
    }
    if(action==='set-theme'){
      document.querySelectorAll('.theme-menu').forEach(m=>{m.hidden=true;});
      document.querySelectorAll('.theme-picker-btn').forEach(b=>{b.setAttribute('aria-expanded','false');});
      const target=themeId||button.dataset.themeId;
      if(target)setTheme(target);
      return;
    }`;

if (oldClickRegex.test(code)) {
  code = code.replace(oldClickRegex, newClickStart);
}

// Replace Escape key handler
const oldEscapeRegex = /if\(e\.key==='Escape'\)\{[\s\S]*?closeModal\(\);\s*\}\}/;
const newEscape = `if(e.key==='Escape'){
      const openMenu=document.querySelector('.theme-menu:not([hidden])');
      if(openMenu){
        document.querySelectorAll('.theme-menu').forEach(m=>{m.hidden=true;});
        document.querySelectorAll('.theme-picker-btn').forEach(b=>{b.setAttribute('aria-expanded','false');});
        return;
      }
      if(modalKind){e.preventDefault();closeModal();}
    }}`;
if (oldEscapeRegex.test(code)) {
  code = code.replace(oldEscapeRegex, newEscape);
}

fs.writeFileSync(appJsPath, code, 'utf8');
console.log('Successfully updated app.js with non-blocking, clean theme dropdown logic!');
