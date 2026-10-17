# 通用文档工具

这是一个本地优先的图文文档编辑器。编辑器在本机运行，文档以 Markdown、YAML 和真实图片文件保存；发布后是只读的 GitHub Pages 静态网站。

当前项目已经迁移并载入 `UE5 OpenXR_UI Documentation`，旧的 `Documentation.json` 只作为一次性迁移源，不再参与日常编辑和发布。

Electron 项目管理器的桌面开发版已加入。双击根目录 `个人开发平台.lnk` 打开已打包程序，接入范围和开发命令见 [desktop/README.md](desktop/README.md)，实装状态见 [desktop/功能实装状态.md](desktop/功能实装状态.md)。原文档编辑器和公开分享入口继续保留。

0.1.19 已开始实装“项目翻译与版本适配”：可读取真实工程、创建并校验独立工作副本、提取蓝图成员、检查引擎安装与 Fab 基础文件规则。OpenXR_UI5.3 的实际扫描结果与未完成能力见 [项目转译实装进度](desktop/项目转译实装进度.md)。原工程保持只读，自动翻译和改名尚未执行。

0.1.26 的智能转译先读取真实资产类型、父类、所属蓝图与图表用途，再生成简洁开发名称并执行统一前缀和重名校验。默认固定 GPT-6 Luna，可选择独立 Codex 账号目录；其他 AI 通过语境任务 JSON 分批交接及校验导入。每次打包自动更新桌面快捷方式和启动入口。

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

进入项目后，“使用文档”中的文字、排版和图片变更会在约 700 ms 后自动保存；“项目资料”和“通用规则”也会分别自动保存。顶栏显示“已保存”即代表内容已经写入本地文件。

日常启动默认关闭文件监视、热更新和自动重载，避免其他对话修改同一工作区的源码或生成发布页面时打断文档编辑。文档自动保存继续工作；源码更新需要正常保存后重新启动文档服务，再手动刷新页面。开发时如需热更新，可在该终端设置 `$env:DOC_STUDIO_LIVE_RELOAD = '1'` 后启动；清除此变量即可恢复稳定编辑模式。

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

项目管理器可通过 `scripts/launch-ue-manager.vbs` 双击启动。工程打开按类型分流：蓝图打开 `.uproject`，C++ 打开对应 `.sln`。UE 配置工具已接入平台体检、预设库、签名、SDK、ADB 安装和 MCP 配置，操作前提供文件差异与备份。具体范围见 `界面原型/UE配置工具集成说明.md`。

## 项目管理

项目主页提供“新建项目”和“打开项目”。每个项目包含两套互相隔离的内容：

- **使用文档**：给其他开发者学习插件功能，支持图文排版、GitHub Pages 发布、复制分享链接和打印/PDF。
- **项目资料**：项目规则、背景、当前状态、待办、交接、决策、异常、变更与历史归档，只保存在 `.local/`。
- **通用规则**：跨项目复用，并由用户在需要时明确指定 AI 读取；不会自动注入所有新对话。

当前 OpenXR 项目的公开文档仍位于 `docs-project/`，因此可以继续发布到现有仓库。新建项目先保存到 `.local/projects/<项目标识>/public/`；配置独立 GitHub 仓库前，“发布”只会生成本地站点，不会误推送到 OpenXR 仓库。

“复制分享链接”读取当前项目的 `publication.siteUrl`。OpenXR 项目会复制固定的 GitHub Pages 地址；尚未配置 Pages 的新项目会显示未发布。

UE 项目管理器可以绑定这里的文档项目，并打开指定位置。例如 `http://127.0.0.1:5173/?project=openxr-ui&section=docs` 打开使用文档；`?project=openxr-ui&section=development&record=project%3Ahandoff` 打开当前交接。编辑器显示所属项目，文档、项目记录、图片和发布请求都带项目标识，因此其他标签页切换项目不会改变当前页面的保存去向。管理器只保留绑定关系，内容仍由本工具按原格式保存。

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
├─ common/
│  ├─ general-rules.md
│  └─ profiles/unreal-plugin.md
└─ projects/<项目标识>/
   ├─ public/                         # 新项目的公开文档
   └─ development/
      ├─ AI入口.md                    # 工具自动生成的统一对接入口
      ├─ rules/project-rules.md
      ├─ context/project-context.md
      ├─ current/
      │  ├─ current-state.md          # 覆盖维护，只写当前事实
      │  ├─ todo.md
      │  └─ handoff.md                # 一轮交接一个当前快照
      ├─ records/
      │  ├─ decisions/                # 一个决策一个文件
      │  ├─ issues/                   # 一个异常一个文件
      │  └─ changes/                  # 一个阶段变更一个文件
      └─ archive/                     # 旧交接和迁移前记录
```

“当前状态”和“当前交接”显示建议行数与容量状态。交接完成或切换主题时点击“归档本轮交接”，工具会保存完整原文并生成干净的新模板。独立决策、异常和变更通过界面新建，避免再次形成无限增长的单文件。

界面提供两种 AI 指令：

- “复制项目读取指令”：只读取当前项目入口和当前资料。
- “项目＋通用规则”：本次同时读取通用规则；是否使用由用户主动选择。

Codex、DeepSeek 和 Antigravity 读取同一个 `AI入口.md`。模型名称不是权威等级，当前源码、用户最新确认和验证证据高于历史记录。

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
