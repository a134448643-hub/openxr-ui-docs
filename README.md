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

打开 `http://127.0.0.1:5173/`。网页中的文字、排版和图片变更会在约 700 ms 后自动保存，顶栏显示“已保存”即代表文件已经写入本地项目目录。

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

## 文档目录

```text
docs-project/
├─ document.yaml        # 文档标题、页面顺序和发布配置
├─ manual/              # 每页正文，Markdown，适合 Codex 等 AI 直接编辑
├─ layouts/             # 每页排版、块样式、悬浮元素和附件信息
└─ assets/              # 真实图片文件，按内容哈希去重命名
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

远程仓库建立后，需要在 `docs-project/document.yaml` 的 `publication` 中记录仓库和 Pages 地址。公开页面仅包含只读文档，不包含编辑按钮、本地保存接口或发布按钮。

## 其他导出

编辑器保留“导出 HTML”和浏览器打印为 PDF 的流程，方便生成离线文件。PDF 是导出结果；GitHub Pages 链接是持续更新的在线版本。

## 原版本来源

编辑器界面基线来自：

`C:\Users\10728\Documents\Obsidian Vault\Gemini工具\通用文档工具\代码_通用文档工具.md`

该版本晚于桌面的 `gemini工具.txt`，包含悬浮元素交互、图片选中边框、双语标题导出和打印排版等修复。
