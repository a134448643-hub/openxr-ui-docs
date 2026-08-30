# 通用文档工具

这是一个本地优先的图文文档编辑器。编辑器在本机运行，文档以 Markdown、YAML 和真实图片文件保存；发布后是只读的 GitHub Pages 静态网站。

当前项目已经迁移并载入 `UE5 OpenXR_UI Documentation`，旧的 `Documentation.json` 只作为一次性迁移源，不再参与日常编辑和发布。

## 日常使用

首次安装依赖：

```powershell
npm install
```

启动编辑器：

```powershell
npm run dev
```

打开 `http://127.0.0.1:5173/` 后先进入“项目文档工作区”，选择“打开项目”或“新建项目”。`127.0.0.1` 只代表当前电脑，不是公开分享地址。

进入项目后，“使用文档”中的文字、排版和图片变更会在约 700 ms 后自动保存；“开发记录”也会单独自动保存。顶栏显示“已保存”即代表内容已经写入本地文件。

完成编辑后点击“发布”：

1. 先保存当前文档。
2. 在本地生成只读静态网站。
3. GitHub 远程仓库配置完成后，自动创建提交并推送 `main`。
4. GitHub Actions 重新构建并更新固定的 Pages 分享链接。

也可以从终端单独检查发布构建：

```powershell
npm run build:site
```

构建结果位于 `site-dist/`，该目录不提交到 Git；GitHub Actions 会在云端重新生成。

## 项目管理

项目主页提供“新建项目”和“打开项目”。每个项目包含两套互相隔离的内容：

- **使用文档**：给其他开发者学习插件功能，支持图文排版、GitHub Pages 发布、复制分享链接和打印/PDF。
- **开发记录**：记录进度、异常、原因、最近解决方法、存储规则和 AI 交接，只保存在 `.local/`。

当前 OpenXR 项目的公开文档仍位于 `docs-project/`，因此可以继续发布到现有仓库。新建项目先保存到 `.local/projects/<项目标识>/public/`；配置独立 GitHub 仓库前，“发布”只会生成本地站点，不会误推送到 OpenXR 仓库。

“复制分享链接”读取当前项目的 `publication.siteUrl`。OpenXR 项目会复制固定的 GitHub Pages 地址；尚未配置 Pages 的新项目会显示未发布。

## 文档目录

```text
docs-project/
├─ document.yaml        # 文档标题、页面顺序和发布配置
├─ manual/              # 每页正文，Markdown，适合 Codex 等 AI 直接编辑
├─ layouts/             # 每页排版、块样式、悬浮元素和附件信息
└─ assets/              # 真实图片文件，按内容哈希去重命名
```

```text
.local/
├─ projects.yaml
└─ projects/<项目标识>/
   ├─ public/                     # 新项目的公开文档
   └─ development/development.md # 私有开发记录，Codex 等 AI 可直接编辑
```

磁盘中的正式文档不再是单一 JSON 文件。本地 API 和发布构建内部仍会使用 JSON 传输运行时数据，但它只是程序通信格式，不是需要人工管理的文档文件。

## 旧 JSON 迁移

只有在恢复旧备份时才使用：

```powershell
npm run migrate -- "C:\path\Documentation.json"
```

迁移会重建 `docs-project/`，提取 Base64 图片为真实文件，并保留原 JSON 不变。日常工作无需导入或导出 JSON。

## GitHub Pages

工作流位于 `.github/workflows/pages.yml`。推送 `main` 后会执行：

```text
npm ci → npm run build:site → 上传 Pages 构建物 → 部署
```

远程仓库建立后，需要在项目 `document.yaml` 的 `publication` 中记录仓库和 Pages 地址。发布器还会核对该地址是否与当前 Git 远程仓库一致，不一致时不会推送。公开页面仅包含只读使用文档，不包含项目主页、开发记录、编辑按钮、本地保存接口或发布按钮。

## 打印 / PDF

点击“打印 / PDF”会打开浏览器原生打印窗口，可选择打印机或“另存为 PDF”。GitHub Pages 链接是持续更新的在线版本。

## 原版本来源

编辑器界面基线来自：

`C:\Users\10728\Documents\Obsidian Vault\Gemini工具\通用文档工具\代码_通用文档工具.md`

该版本晚于桌面的 `gemini工具.txt`，包含悬浮元素交互、图片选中边框、双语标题导出和打印排版等修复。
