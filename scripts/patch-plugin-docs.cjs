const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. Check if pluginDocsMap is already defined
if (!appJs.includes('const pluginDocsMap =')) {
  const pluginDocsCode = `
  const pluginDocsMap = {
    'p-gas-ext': {
      sidebarTitle: 'GAS Extended Docs',
      docTitle: 'GameplayAbilities Extended 说明文档',
      pages: [
        { id: 'gas-p1', title: { zh: '1. 架构设计与模块概览', en: '1. Architecture & Module Overview' } },
        { id: 'gas-p2', title: { zh: '2. 快速接入与 Build.cs 配置', en: '2. Quick Setup & Build.cs' } },
        { id: 'gas-p3', title: { zh: '3. 核心暴露蓝图节点清单', en: '3. Core Blueprint Nodes Reference' } },
        { id: 'gas-p4', title: { zh: '4. 网络属性同步与并发优化', en: '4. Network Replication & Optimization' } }
      ],
      content: {
        'gas-p1': {
          blocks: [
            { id: 'g1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. 模块架构与无 uproject 说明', en: '1. Standalone Architecture Specification' } },
            { id: 'g2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: 'GameplayAbilities Extended 是专为虚幻引擎 GAS (Gameplay Ability System) 打造的原生 C++ 增强扩展库。\\n本模块完全作为纯 C++ 模块工程构建，无独立 .uproject 启动文件，直接遵循 UBT 标准进行独立编译与跨项目符号链接 (Symlink) 挂载。',
              en: 'GameplayAbilities Extended is a native C++ extension library built for Unreal Engine Gameplay Ability System (GAS).\\nConstructed as a pure C++ module codebase without .uproject launch files, it compiles directly via UnrealBuildTool and mounts seamlessly across UE 5.4/5.5 projects.'
            }},
            { id: 'g3', type: 'text', style: { isSectionHeader: true }, data: { zh: '模块拓扑分层', en: 'Module Layering' } },
            { id: 'g4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• GameplayAbilitiesExt (Runtime 运行期模块)：包含异步能力任务内存池、增强属性集模板与网络状态量化器。\\n• GameplayAbilitiesExtEditor (Editor 编辑器模块)：包含蓝图动作引脚定制、Slate 技能调试树与属性预览窗口。',
              en: '• GameplayAbilitiesExt (Runtime): Contains async ability task memory pools, enhanced AttributeSet templates, and replication quantizers.\\n• GameplayAbilitiesExtEditor (Editor): Provides custom Blueprint action pins, Slate debug trees, and live attribute previewers.'
            }}
          ]
        },
        'gas-p2': {
          blocks: [
            { id: 'g5', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 工程接入与依赖配置', en: '2. Project Integration & Dependency Setup' } },
            { id: 'g6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '在目标 UE 工程的 [ProjectName].Build.cs 文件中，向 PublicDependencyModuleNames 追加以下模块名：\\n\\nPublicDependencyModuleNames.AddRange(new string[] {\\n    "GameplayAbilitiesExt",\\n    "GameplayAbilities",\\n    "GameplayTags",\\n    "EnhancedInput"\\n});',
              en: 'In your target project [ProjectName].Build.cs, add the following module dependencies:\\n\\nPublicDependencyModuleNames.AddRange(new string[] {\\n    "GameplayAbilitiesExt",\\n    "GameplayAbilities",\\n    "GameplayTags",\\n    "EnhancedInput"\\n});'
            }},
            { id: 'g7', type: 'text', style: { isSectionHeader: true }, data: { zh: '默认标签层次声明', en: 'Default GameplayTags Declaration' } },
            { id: 'g8', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '建议在 Config/DefaultGameplayTags.ini 中添加基础标签树：\\nAbility.Action.Primary\\nAbility.Action.Secondary\\nState.Cooldown\\nState.Immunity',
              en: 'Add standard tag roots to Config/DefaultGameplayTags.ini:\\nAbility.Action.Primary\\nAbility.Action.Secondary\\nState.Cooldown\\nState.Immunity'
            }}
          ]
        },
        'gas-p3': {
          blocks: [
            { id: 'g9', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 核心暴露蓝图节点速查', en: '3. Core Blueprint Nodes Reference' } },
            { id: 'g10', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '本插件对外暴露以下极简蓝图节点，已剥离所有冗余调试信息，专注于直观调用：',
              en: 'Exposed native Blueprint nodes stripped of low-level pin noise for maximum developer ergonomics:'
            }},
            { id: 'g11', type: 'text', style: { isSectionHeader: true }, data: { zh: '节点 1: ActivateAbilityByTag (通过标签激活技能)', en: 'Node 1: ActivateAbilityByTag' } },
            { id: 'g12', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '通过 GameplayTag 激活指定 Actor 上的能力实例，自动处理冷却判定、网络输入广播与能力堆叠。无需手动遍历 AbilitySpec 容器。\\n• 分类: GAS Extended|Abilities | 类型: BlueprintCallable',
              en: 'Activates an ability instance on the target Actor via GameplayTag, resolving cooldown checks, network input dispatch, and ability stacking without manually iterating specs.\\n• Category: GAS Extended|Abilities | Type: BlueprintCallable'
            }},
            { id: 'g13', type: 'text', style: { isSectionHeader: true }, data: { zh: '节点 2: GetAttributeValueWithFallback (安全获取属性数值)', en: 'Node 2: GetAttributeValueWithFallback' } },
            { id: 'g14', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '安全检索指定 AttributeSet 的当前数值，若属性未初始化或组件缺失则返回安全回退值，彻底规避游戏运行期因空指针导致的致命崩溃。\\n• 分类: GAS Extended|Attributes | 类型: BlueprintPure',
              en: 'Safely queries an attribute value from the AttributeSet, gracefully returning a fallback value if uninitialized or missing to prevent fatal nullptr crashes.\\n• Category: GAS Extended|Attributes | Type: BlueprintPure'
            }},
            { id: 'g15', type: 'text', style: { isSectionHeader: true }, data: { zh: '节点 3: AsyncWaitForGameplayTagEvent (异步监听标签变更)', en: 'Node 3: AsyncWaitForGameplayTagEvent' } },
            { id: 'g16', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '异步等待指定的 GameplayTag 添加或移除事件，并在状态变更时分派异步执行引脚。\\n• 分类: GAS Extended|Async Tasks | 类型: AsyncAction',
              en: 'Asynchronously waits for specified GameplayTag addition or removal events, dispatching dual async output paths.\\n• Category: GAS Extended|Async Tasks | Type: AsyncAction'
            }},
            { id: 'g17', type: 'text', style: { isSectionHeader: true }, data: { zh: '节点 4: ApplyPeriodicGameplayEffect (施加周期性效果)', en: 'Node 4: ApplyPeriodicGameplayEffect' } },
            { id: 'g18', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '快捷施加周期性效果（DoT/HoT），自动计算持续时间、周期 Tick 频率与层数堆叠。\\n• 分类: GAS Extended|Effects | 类型: BlueprintCallable',
              en: 'Directly applies periodic GameplayEffects (DoT/HoT) with automatic duration, tick rate, and stack calculation.\\n• Category: GAS Extended|Effects | Type: BlueprintCallable'
            }}
          ]
        },
        'gas-p4': {
          blocks: [
            { id: 'g19', type: 'text', style: { isSectionHeader: true }, data: { zh: '4. 网络属性同步与高并发优化', en: '4. Network Replication & Optimization' } },
            { id: 'g20', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '1. 采用 FastArraySerializer 序列化属性修饰器，实测多人网络带宽消耗下降 35%。\\n2. 异步监听任务采用静态内存对象池，彻底消除高频技能触发下的 GC 垃圾回收瞬时卡顿。\\n3. 原生支持 Dedicated Server 专用服务器无渲染模式安全剔除。',
              en: '1. Employs FastArraySerializer for active attribute modifiers, slashing network replication bandwidth by 35%.\\n2. Async tasks utilize static pooling, eliminating GC latency spikes during high-frequency combat.\\n3. Full headless Dedicated Server stripping support.'
            }}
          ]
        }
      }
    },
    'p-claude-bridge': {
      sidebarTitle: 'Claude Bridge Docs',
      docTitle: 'Unreal Claude Bridge 说明文档',
      pages: [
        { id: 'cl-p1', title: { zh: '1. 插件概述与架构桥接', en: '1. Architecture & Subsystem' } },
        { id: 'cl-p2', title: { zh: '2. 暴露蓝图与自动化节点', en: '2. Blueprint Nodes Reference' } },
        { id: 'cl-p3', title: { zh: '3. API 鉴权与安全沙箱', en: '3. Security & Sandboxing' } }
      ],
      content: {
        'cl-p1': {
          blocks: [
            { id: 'cl1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. 插件架构设计', en: '1. Architecture Design' } },
            { id: 'cl2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: 'Unreal Claude Bridge 是为虚幻引擎 5 深度定制的本地大模型协作插件。\\n通过 EditorSubsystem 挂载，无缝衔接 Claude 协议，支持直接分析当前视口选中的 Actor、自动诊断编译报错并生成修正脚本。',
              en: 'Unreal Claude Bridge provides native LLM integration for UE5 via an EditorSubsystem, allowing direct scene context introspection, automated error diagnosis, and script fixes.'
            }}
          ]
        },
        'cl-p2': {
          blocks: [
            { id: 'cl3', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 暴露蓝图节点说明', en: '2. Blueprint Nodes Reference' } },
            { id: 'cl4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• InvokeClaudePrompt: 异步向 Claude 服务端分派结构化提示词并获取流式响应。\\n• ExtractCurrentLevelContext: 提取当前关卡选中物体的变换、层级与材质配置上下文。\\n• ExecuteEditorAutomationCommand: 在安全沙箱中执行由 AI 生成的编辑器批处理命令。',
              en: '• InvokeClaudePrompt: Sends structured prompts to Claude and receives streaming replies.\\n• ExtractCurrentLevelContext: Extracts hierarchy, transforms, and materials of selected actors.\\n• ExecuteEditorAutomationCommand: Safely executes AI-generated batch commands in editor sandbox.'
            }}
          ]
        },
        'cl-p3': {
          blocks: [
            { id: 'cl5', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 安全与权限机制', en: '3. Security & Sandboxing' } },
            { id: 'cl6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '所有由 AI 生成的代码或资产变动均需通过本地事务管理器审查确认，支持一键撤销 (Undo/Redo)。API 密钥通过系统凭据管理器加密存储。',
              en: 'All AI modifications pass through the local transaction manager with full Undo/Redo capability. API keys are safely encrypted in Windows Credential Manager.'
            }}
          ]
        }
      }
    },
    'p-loading-screen': {
      sidebarTitle: 'Loading Screen Docs',
      docTitle: 'Async Loading Screen Pro 说明文档',
      pages: [
        { id: 'ld-p1', title: { zh: '1. 异步过渡与电影模式原理', en: '1. Movie Player & Transition' } },
        { id: 'ld-p2', title: { zh: '2. 蓝图控制节点清单', en: '2. Blueprint Nodes Reference' } },
        { id: 'ld-p3', title: { zh: '3. UI 预设与视频格式规范', en: '3. UI Presets & Video Specs' } }
      ],
      content: {
        'ld-p1': {
          blocks: [
            { id: 'ld1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. 异步无缝加载原理', en: '1. Seamless Loading Architecture' } },
            { id: 'ld2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '基于虚幻引擎 ILoadingScreenModule 原生底层接口，在渲染线程与专用电影播放线程独立调度 Slate 控件。\\n即使主线程处于高负荷资产反序列化或世界关卡加载状态，屏幕帧率依然稳定维持在 60fps 以上，彻底避免游戏黑屏或画面冻结。',
              en: 'Utilizes UE ILoadingScreenModule to drive Slate widgets on dedicated movie player threads. Guarantees silky smooth 60fps rendering even while main thread deserializes massive worlds.'
            }}
          ]
        },
        'ld-p2': {
          blocks: [
            { id: 'ld3', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 蓝图控制节点说明', en: '2. Blueprint Nodes Reference' } },
            { id: 'ld4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• StartLoadingScreenTransition: 触发全屏异步加载过渡屏，内置淡入淡出动效。\\n• SetLoadingProgressText: 动态更新加载提示文字或百分比进度条。\\n• StopLoadingScreen: 平滑淡出并销毁加载屏幕，进入新关卡。',
              en: '• StartLoadingScreenTransition: Triggers smooth fullscreen loading transition.\\n• SetLoadingProgressText: Updates loading tips and progress percentage.\\n• StopLoadingScreen: Fades out and tears down the screen safely.'
            }}
          ]
        },
        'ld-p3': {
          blocks: [
            { id: 'ld5', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 视频与动态遮罩规范', en: '3. Movie & Mask Specs' } },
            { id: 'ld6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '推荐视频格式为 MP4 (H.264 Baseline Profile)，无音频轨以减少加载开销；支持配置 4K 背景图与粒子呼吸动画。',
              en: 'Recommended movie format is MP4 (H.264 Baseline). Supports 4K background stills and subtle particle animations.'
            }}
          ]
        }
      }
    },
    'p-asio-net': {
      sidebarTitle: 'Asio Network Docs',
      docTitle: 'Asio Network Driver 说明文档',
      pages: [
        { id: 'as-p1', title: { zh: '1. 高并发异步通信原理', en: '1. High-Concurrency Async I/O' } },
        { id: 'as-p2', title: { zh: '2. 蓝图网络节点速查', en: '2. Blueprint Nodes Reference' } },
        { id: 'as-p3', title: { zh: '3. 协议封包与插值防抖', en: '3. Packets & Interpolation' } }
      ],
      content: {
        'as-p1': {
          blocks: [
            { id: 'as1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. Boost.Asio 异步 I/O 架构', en: '1. Boost.Asio Architecture' } },
            { id: 'as2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '嵌入现代化 Boost.Asio C++ 异步网络核心，独立工作线程驱动 epoll/IOCP 事件分发。\\n专为需要万级并发长连接、高频遥测或自定义二进制 TCP/UDP 通信的大型项目量身打造。',
              en: 'Integrates Boost.Asio async network core with IOCP/epoll worker threads. Built for massive concurrent sockets and high-rate telemetry.'
            }}
          ]
        },
        'as-p2': {
          blocks: [
            { id: 'as3', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 蓝图网络节点说明', en: '2. Blueprint Nodes Reference' } },
            { id: 'as4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• AsioConnectAsync: 异步发起 TCP/UDP 套接字连接，连接成功或失败分派执行流。\\n• AsioSendPacket: 线程安全分派自定义二进制数据包。\\n• AsioOnDataReceived: 订阅远端数据包分发事件，自动在主线程安全回调。',
              en: '• AsioConnectAsync: Initiates async socket connection.\\n• AsioSendPacket: Thread-safe packet dispatcher.\\n• AsioOnDataReceived: Main-thread safe packet receive subscription.'
            }}
          ]
        },
        'as-p3': {
          blocks: [
            { id: 'as5', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 数据包压缩与时间戳同步', en: '3. Compression & Clock Sync' } },
            { id: 'as6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '内置 Zstandard 高速压缩算法，客户端与服务器时间戳纳秒级对齐，支持丢包重传与状态预测插值。',
              en: 'Built-in Zstandard compression with nanosecond clock synchronization and client prediction interpolation.'
            }}
          ]
        }
      }
    },
    'p-asset-auditor': {
      sidebarTitle: 'Asset Auditor Docs',
      docTitle: 'Project Asset Auditor 说明文档',
      pages: [
        { id: 'aud-p1', title: { zh: '1. 资产规范与合规规则', en: '1. Asset Rules & Standards' } },
        { id: 'aud-p2', title: { zh: '2. 编辑器自动化检查节点', en: '2. Blueprint Audit Nodes' } },
        { id: 'aud-p3', title: { zh: '3. CI/CD 流水线集成', en: '3. CI/CD Pipeline Integration' } }
      ],
      content: {
        'aud-p1': {
          blocks: [
            { id: 'aud1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. 资产合规性检查规则', en: '1. Validation Rules' } },
            { id: 'aud2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '一键扫描全工程资产，检测前缀命名失范（BP_, SM_, M_ 等）、2的幂次纹理尺寸违规、未烘焙碰撞体的网格体以及孤儿废弃资产。',
              en: 'Scans project assets for naming prefixes, non-power-of-two textures, missing collisions, and orphaned assets.'
            }}
          ]
        },
        'aud-p2': {
          blocks: [
            { id: 'aud3', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 蓝图审计节点说明', en: '2. Blueprint Audit Nodes' } },
            { id: 'aud4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• AuditCurrentProjectAssets: 全局或指定目录深度审计资产合规性。\\n• FixMissingMaterialsBatch: 批量重定向丢失材质至项目默认备用材质。\\n• ExportAuditReportToJSON: 导出标准化 JSON/HTML 质量分析体检报告。',
              en: '• AuditCurrentProjectAssets: Deep asset audit for directory or project.\\n• FixMissingMaterialsBatch: Batch redirects missing materials.\\n• ExportAuditReportToJSON: Exports JSON/HTML audit reports.'
            }}
          ]
        },
        'aud-p3': {
          blocks: [
            { id: 'aud5', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. CI/CD 自动化集成', en: '3. CI/CD Integration' } },
            { id: 'aud6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '支持虚幻引擎无头命令行模式运行：\\nUnrealEditor-Cmd.exe MyProject.uproject -run=AssetAudit -json="Reports/audit.json"',
              en: 'Command-line execution for automated build gates:\\nUnrealEditor-Cmd.exe MyProject.uproject -run=AssetAudit -json="Reports/audit.json"'
            }}
          ]
        }
      }
    },
    'p-blender-pipeline': {
      sidebarTitle: 'Blender Bridge Docs',
      docTitle: 'Blender UE5 Bridge & Sync 说明文档',
      pages: [
        { id: 'bl-p1', title: { zh: '1. 双向资产互通管线', en: '1. Bi-directional Pipeline' } },
        { id: 'bl-p2', title: { zh: '2. 蓝图与自动化节点', en: '2. Blueprint Nodes Reference' } },
        { id: 'bl-p3', title: { zh: '3. OpenXR 骨骼自动映射', en: '3. OpenXR Bone Remapping' } }
      ],
      content: {
        'bl-p1': {
          blocks: [
            { id: 'bl1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. Blender to UE5 自动化互通', en: '1. Blender to UE5 Bridge' } },
            { id: 'bl2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '打破 DCC 软件与游戏引擎之间的导出导入藩篱。在 Blender 中一键同步修改模型、材质与骨骼蒙皮，虚幻引擎实时无感热重载。',
              en: 'Seamless two-way bridge between Blender and UE5 with live mesh, material, and bone skin hot-reloading.'
            }}
          ]
        },
        'bl-p2': {
          blocks: [
            { id: 'bl3', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 蓝图同步节点清单', en: '2. Blueprint Nodes Reference' } },
            { id: 'bl4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '• SendMeshToBlenderLive: 将虚幻视口中选中的网格体即时发送至 Blender 进行拓扑重构。\\n• ImportBlenderExportAsset: 自动解析 Blender 导出的 FBX/glTF 并应用预设材质。\\n• AutoRigHandMeshToOpenXR: 自动将手部几何体对齐到 OpenXR 26 关节点标准骨架。',
              en: '• SendMeshToBlenderLive: Sends viewport mesh to Blender for remeshing.\\n• ImportBlenderExportAsset: Auto-imports FBX/glTF with material assignment.\\n• AutoRigHandMeshToOpenXR: Auto-aligns hand mesh to OpenXR 26-joint skeleton.'
            }}
          ]
        },
        'bl-p3': {
          blocks: [
            { id: 'bl5', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 骨骼轴向自动化矫正', en: '3. Bone Axis Alignment' } },
            { id: 'bl6', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '自动适配 Blender 的 Z-Up 坐标系与虚幻引擎的 X-Forward 坐标系，彻底消除手部骨骼在 VR 视口中的翻转畸变。',
              en: 'Automatically aligns Blender Z-Up coordinate space with UE5 X-Forward space, eliminating joint twisting.'
            }}
          ]
        }
      }
    }
  };

  function getPluginDocData(p) {
    if (!p) return docsData;
    if (p.id === 'p-openxr-pose') return docsData;
    if (pluginDocsMap[p.id]) return pluginDocsMap[p.id];
    return generateGenericPluginDocs(p);
  }

  function generateGenericPluginDocs(plugin) {
    const pName = plugin.name || 'UE C++ 插件';
    return {
      sidebarTitle: (plugin.identifier || plugin.name) + ' Docs',
      docTitle: pName + ' 说明文档',
      pages: [
        { id: 'gen-p1', title: { zh: '1. 插件概述与环境要求', en: '1. Overview & Requirements' } },
        { id: 'gen-p2', title: { zh: '2. 暴露蓝图节点清单', en: '2. Blueprint Nodes Reference' } },
        { id: 'gen-p3', title: { zh: '3. 模块结构与 Build.cs 依赖', en: '3. Modules & Build Dependencies' } }
      ],
      content: {
        'gen-p1': {
          blocks: [
            { id: 'gb1', type: 'text', style: { isSectionHeader: true }, data: { zh: '1. 插件概述', en: '1. Plugin Overview' } },
            { id: 'gb2', type: 'text', style: { isSectionHeader: false }, data: {
              zh: (plugin.description || '纯 C++ 模块插件工程，无 uproject 启动文件。') + '\\n物理路径：' + (plugin.path || '未指定'),
              en: 'C++ module plugin package without .uproject launch file.\\nPhysical path: ' + (plugin.path || 'Unspecified')
            }},
            { id: 'gb3', type: 'text', style: { isSectionHeader: true }, data: { zh: '环境兼容性', en: 'Environment Compatibility' } },
            { id: 'gb4', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '目标引擎版本：UE ' + (plugin.ue || '5.4') + '；编译状态：' + (plugin.statusLabel || '已就绪') + '。',
              en: 'Target Unreal Engine Version: UE ' + (plugin.ue || '5.4') + '; Build status: ' + (plugin.statusLabel || 'Ready') + '.'
            }}
          ]
        },
        'gen-p2': {
          blocks: [
            { id: 'gb5', type: 'text', style: { isSectionHeader: true }, data: { zh: '2. 暴露蓝图节点清单', en: '2. Blueprint Nodes Reference' } },
            ...(plugin.blueprintNodes && plugin.blueprintNodes.length ? plugin.blueprintNodes.flatMap((n, idx) => [
              { id: 'gb-node-h-' + idx, type: 'text', style: { isSectionHeader: true }, data: { zh: \`\${idx+1}. \${n.name} (\${n.cName || n.type})\`, en: \`\${idx+1}. \${n.name} [\${n.type}]\` } },
              { id: 'gb-node-d-' + idx, type: 'text', style: { isSectionHeader: false }, data: {
                zh: \`所属分类: \${n.category || 'Default'}\\n功能说明: \${n.description || '无说明'}\`,
                en: \`Category: \${n.category || 'Default'}\\nDescription: \${n.description || 'No description available'}\`
              }}
            ]) : [
              { id: 'gb-no-nodes', type: 'text', style: { isSectionHeader: false }, data: { zh: '当前插件尚未向蓝图暴露公共节点，请直接通过 C++ 头文件调用模块 API。', en: 'No public Blueprint nodes are currently exposed. Please invoke module APIs via C++ headers directly.' } }
            ])
          ]
        },
        'gen-p3': {
          blocks: [
            { id: 'gb6', type: 'text', style: { isSectionHeader: true }, data: { zh: '3. 模块结构与工程引入', en: '3. Module Structure & Integration' } },
            { id: 'gb7', type: 'text', style: { isSectionHeader: false }, data: {
              zh: '在目标 UE 工程的 [ProjectName].Build.cs 中添加模块依赖：\\nPublicDependencyModuleNames.AddRange(new string[] { ' + (plugin.modules ? plugin.modules.map(m => \`"\${m.name}"\`).join(', ') : \`"\${plugin.identifier}"\`) + ' });',
              en: 'Add module dependency in target project [ProjectName].Build.cs:\\nPublicDependencyModuleNames.AddRange(new string[] { ' + (plugin.modules ? plugin.modules.map(m => \`"\${m.name}"\`).join(', ') : \`"\${plugin.identifier}"\`) + ' });'
            }}
          ]
        }
      }
    };
  }
`;

  // Insert before `const docsData =`
  appJs = appJs.replace('const docsData =', pluginDocsCode + '\n  const docsData =');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Successfully injected pluginDocsMap and getPluginDocData into app.js');
