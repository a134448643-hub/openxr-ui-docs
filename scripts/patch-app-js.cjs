const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Enrich initialPlugins
const initialPluginsBlock = `  const initialPlugins=[
    {
      id:'p-gas-ext',name:'GameplayAbilities Extended',identifier:'GameplayAbilitiesExtended',
      description:'针对虚幻 GAS 框架的原生 C++ 扩展，包含复合技能触发器、网络属性预测扩展与预置 AttributeSet 模板。纯 C++ 模块库，无 uproject 启动文件。',
      category:'gameplay',categoryName:'玩法与能力系统',accentClass:'accent-gameplay',icon:'puzzle',
      type:'ue-cpp',typeLabel:'UE C++ 插件 (无uproject)',ue:'5.4 / 5.5',status:'compiled',statusLabel:'Binaries 已就绪',hasLaunchFile:false,
      modules:[{name:'GameplayAbilitiesExt',type:'Runtime',buildCs:'Source/GameplayAbilitiesExt/GameplayAbilitiesExt.Build.cs'},{name:'GameplayAbilitiesExtEditor',type:'Editor',buildCs:'Source/GameplayAbilitiesExtEditor/GameplayAbilitiesExtEditor.Build.cs'}],
      dependencies:['GameplayAbilities','GameplayTags','EnhancedInput'],
      path:'E:\\\\UE_Plugins\\\\GameplayAbilitiesExtended',size:'142 MB',activity:'今天 16:40',favorite:true,tags:['C++20','GAS','Replication','无uproject'],
      blueprintNodes:[
        {
          name:'ActivateAbilityByTag',cName:'通过标签激活技能',type:'BlueprintCallable',category:'GAS Extended|Abilities',
          description:'通过 GameplayTag 激活指定 Actor 上的能力实例，自动处理冷却判定、网络输入广播与能力堆叠。',
          cpp:'UFUNCTION(BlueprintCallable, Category="GAS Extended|Abilities", meta=(DefaultToSelf="InTargetActor")) static bool ActivateAbilityByTag(AActor* InTargetActor, FGameplayTag AbilityTag, bool bAllowRemoteActivation = true);',
          inputs:[{name:'InTargetActor',type:'AActor*',pin:'object'},{name:'AbilityTag',type:'FGameplayTag',pin:'struct'},{name:'bAllowRemoteActivation',type:'bool',pin:'bool',default:'true'}],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        },
        {
          name:'GetAttributeValueWithFallback',cName:'安全获取属性数值',type:'BlueprintPure',category:'GAS Extended|Attributes',
          description:'安全检索指定 AttributeSet 的当前数值，若属性未初始化或组件缺失则返回安全回退值。',
          cpp:'UFUNCTION(BlueprintPure, Category="GAS Extended|Attributes") static float GetAttributeValueWithFallback(UAbilitySystemComponent* ASC, FGameplayAttribute Attribute, float FallbackValue = 0.0f);',
          inputs:[{name:'ASC',type:'UAbilitySystemComponent*',pin:'object'},{name:'Attribute',type:'FGameplayAttribute',pin:'struct'},{name:'FallbackValue',type:'float',pin:'float',default:'0.0'}],
          outputs:[{name:'ReturnValue',type:'float',pin:'float'}]
        },
        {
          name:'AsyncWaitForGameplayTagEvent',cName:'异步监听标签变更',type:'AsyncAction',category:'GAS Extended|Async Tasks',
          description:'异步等待指定的 GameplayTag 添加或移除事件，并在状态变更时分派异步执行引脚。',
          cpp:'UFUNCTION(BlueprintCallable, meta=(BlueprintInternalUseOnly="true")) static UAsyncWaitGameplayTagTask* AsyncWaitForGameplayTagEvent(UAbilitySystemComponent* ASC, FGameplayTag Tag, bool bOnlyTriggerOnce = false);',
          inputs:[{name:'ASC',type:'UAbilitySystemComponent*',pin:'object'},{name:'Tag',type:'FGameplayTag',pin:'struct'},{name:'bOnlyTriggerOnce',type:'bool',pin:'bool',default:'false'}],
          outputs:[{name:'OnAdded',type:'Exec Pin',pin:'exec'},{name:'OnRemoved',type:'Exec Pin',pin:'exec'}]
        },
        {
          name:'ApplyPeriodicGameplayEffect',cName:'施加周期性效果(DoT/HoT)',type:'BlueprintCallable',category:'GAS Extended|Effects',
          description:'快捷施加周期性效果（DoT/HoT），自动计算持续时间、周期 Tick 频率与层数堆叠。',
          cpp:'UFUNCTION(BlueprintCallable, Category="GAS Extended|Effects") static FActiveGameplayEffectHandle ApplyPeriodicGameplayEffect(AActor* Instigator, AActor* Target, TSubclassOf<UGameplayEffect> EffectClass, float Duration, float Period);',
          inputs:[{name:'Instigator',type:'AActor*',pin:'object'},{name:'Target',type:'AActor*',pin:'object'},{name:'EffectClass',type:'TSubclassOf<UGameplayEffect>',pin:'class'},{name:'Duration',type:'float',pin:'float'},{name:'Period',type:'float',pin:'float'}],
          outputs:[{name:'ReturnValue',type:'FActiveGameplayEffectHandle',pin:'struct'}]
        }
      ],
      readme:'# GameplayAbilities Extended\\n\\n## 概述\\n针对虚幻原生 GameplayAbilities 框架的轻量化 C++ 封装扩展库。\\n- **无独立 uproject**：纯 C++ 模块插件工程，通过 UBT 独立构建或直接挂载至任意 UE 5.4/5.5 工程。\\n- **核心特性**：\\n  1. 异步技能任务内存池管理\\n  2. 网络属性同步抖动压缩\\n  3. 自定义 Slate 调试监视面板\\n\\n## 接入方法\\n在工程 [ProjectName].Build.cs 中添加模块依赖：\\nPublicDependencyModuleNames.AddRange(new string[] { "GameplayAbilitiesExt", "GameplayAbilities", "GameplayTags" });'
    },
    {
      id:'p-openxr-pose',name:'OpenXR Hand Pose Provider',identifier:'OpenXRHandPoseProvider',
      description:'基于 OpenXR 标准扩展的 XR 手部骨骼解算与 LiveLink 数据源提供器。纯模块化 C++ 驱动，直接挂载到 XR 项目。',
      category:'xr',categoryName:'XR交互与外设',accentClass:'accent-xr',icon:'headset',
      type:'ue-cpp',typeLabel:'UE C++ 插件 (无uproject)',ue:'5.3 / 5.4',status:'compiled',statusLabel:'Binaries 已就绪',hasLaunchFile:false,
      modules:[{name:'OpenXRHandPose',type:'Runtime',buildCs:'Source/OpenXRHandPose/OpenXRHandPose.Build.cs'}],
      dependencies:['OpenXRHMD','LiveLink','HeadMountedDisplay'],
      path:'E:\\\\UE_Plugins\\\\OpenXRHandPoseProvider',size:'88 MB',activity:'昨天 19:15',favorite:true,tags:['OpenXR','HandTracking','LiveLink','无uproject'],
      blueprintNodes:[
        {
          name:'GetHandBoneTransform',cName:'读取手部骨骼关节变换',type:'BlueprintPure',category:'OpenXR|HandTracking|Pose',
          description:'读取指定手部骨骼关节在世界空间或相机空间的实时 Transform 与物理线速度，内置卡尔曼滤波防抖。',
          cpp:'UFUNCTION(BlueprintPure, Category="OpenXR|HandTracking|Pose") static bool GetHandBoneTransform(EHandType Hand, EHandBone BoneId, FTransform& OutTransform, FVector& OutLinearVelocity);',
          inputs:[{name:'Hand',type:'EHandType',pin:'enum'},{name:'BoneId',type:'EHandBone',pin:'enum'}],
          outputs:[{name:'OutTransform',type:'FTransform',pin:'transform'},{name:'OutLinearVelocity',type:'FVector',pin:'vector'},{name:'ReturnValue',type:'bool',pin:'bool'}]
        },
        {
          name:'DetectHandGesture',cName:'识别手势动作',type:'BlueprintPure',category:'OpenXR|HandTracking|Gestures',
          description:'基于五指弯曲度向量与掌心法线几何特征，实时识别捏合 (Pinch)、抓握 (Grab)、指向 (Point) 手势。',
          cpp:'UFUNCTION(BlueprintPure, Category="OpenXR|HandTracking|Gestures") static EHandGesture DetectHandGesture(EHandType Hand, float ConfidenceThreshold = 0.85f);',
          inputs:[{name:'Hand',type:'EHandType',pin:'enum'},{name:'ConfidenceThreshold',type:'float',pin:'float',default:'0.85'}],
          outputs:[{name:'ReturnValue',type:'EHandGesture',pin:'enum'}]
        },
        {
          name:'SetLiveLinkHandSubjectActive',cName:'动态切换LiveLink广播',type:'BlueprintCallable',category:'OpenXR|LiveLink',
          description:'动态启用或挂起手部追踪数据的 LiveLink 动画源广播，节约待机性能与网络带宽。',
          cpp:'UFUNCTION(BlueprintCallable, Category="OpenXR|LiveLink") static void SetLiveLinkHandSubjectActive(FName SubjectName, bool bActive);',
          inputs:[{name:'SubjectName',type:'FName',pin:'name'},{name:'bActive',type:'bool',pin:'bool'}],
          outputs:[{name:'Then',type:'Exec Pin',pin:'exec'}]
        }
      ],
      readme:'# OpenXR Hand Pose Provider\\n\\n## 概述\\n针对 OpenXR 规范 XR_EXT_hand_tracking 扩展的硬件解算器插件，提供高频低延迟的关节变换。\\n- 即插即用，支持 Meta Quest / Pico 等 OpenXR 运行时。\\n- 无启动文件，通过 LiveLinkSource 注入虚幻引擎动画管线。'
    },
    {
      id:'p-claude-bridge',name:'Unreal Claude Bridge',identifier:'UnrealClaudeBridge',
      description:'虚幻编辑器内嵌式大模型协作插件，提供 Slate UI 交互面板与 EditorSubsystem 资产自动化脚本桥接。',
      category:'editor',categoryName:'编辑器扩展',accentClass:'accent-editor',icon:'sparkles',
      type:'editor-tool',typeLabel:'编辑器扩展工具',ue:'5.4',status:'compiled',statusLabel:'Binaries 已就绪',hasLaunchFile:false,
      modules:[{name:'ClaudeBridgeEditor',type:'Editor',buildCs:'Source/ClaudeBridgeEditor/ClaudeBridgeEditor.Build.cs'}],
      dependencies:['EditorScriptingUtilities','Slate','HTTP'],
      path:'E:\\\\UE_Plugins\\\\UnrealClaudeBridge',size:'64 MB',activity:'3 天前',favorite:true,tags:['Slate','EditorTool','LLM','AI助手'],
      blueprintNodes:[
        {
          name:'PromptClaudeEditor',cName:'调用Claude分析资产与代码',type:'AsyncAction',category:'ClaudeBridge|EditorAutomation',
          description:'在虚幻编辑器环境中异步调用 Claude 大模型，分析选中的资产依赖并生成蓝图代码或配置重构方案。',
          cpp:'UFUNCTION(BlueprintCallable, Category="ClaudeBridge|EditorAutomation") static UAsyncClaudePromptTask* PromptClaudeEditor(const FString& PromptText, const TArray<FAssetData>& SelectedAssets);',
          inputs:[{name:'PromptText',type:'FString',pin:'string'},{name:'SelectedAssets',type:'TArray<FAssetData>',pin:'array'}],
          outputs:[{name:'OnSuccess',type:'Exec Pin',pin:'exec'},{name:'OnFailure',type:'Exec Pin',pin:'exec'},{name:'ResponseText',type:'FString',pin:'string'}]
        },
        {
          name:'AutoOrganizeBlueprintGraph',cName:'自动整理蓝图连线布局',type:'BlueprintCallable',category:'ClaudeBridge|GraphTools',
          description:'对指定蓝图图表执行基于拓扑排序与连线紧凑度优化的自动化节点排版。',
          cpp:'UFUNCTION(BlueprintCallable, Category="ClaudeBridge|GraphTools") static bool AutoOrganizeBlueprintGraph(UEdGraph* TargetGraph);',
          inputs:[{name:'TargetGraph',type:'UEdGraph*',pin:'object'}],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        },
        {
          name:'InspectAssetDependencyTree',cName:'递归检查资产依赖树',type:'BlueprintPure',category:'ClaudeBridge|AssetInspection',
          description:'递归检索资产依赖树，分析软硬引用与内存占用峰值。',
          cpp:'UFUNCTION(BlueprintPure, Category="ClaudeBridge|AssetInspection") static FAssetDependencyReport InspectAssetDependencyTree(const FString& AssetPath, int32 MaxDepth = 5);',
          inputs:[{name:'AssetPath',type:'FString',pin:'string'},{name:'MaxDepth',type:'int32',pin:'int',default:'5'}],
          outputs:[{name:'ReturnValue',type:'FAssetDependencyReport',pin:'struct'}]
        }
      ],
      readme:'# Unreal Claude Bridge\\n\\n## 概述\\n基于 Slate 开发的编辑器内大模型助手工具，支持快捷生成关卡配置、自动化重命名蓝图节点与 UMG 排版建议。'
    },
    {
      id:'p-loading-screen',name:'Fast Async Loading Screen',identifier:'FastAsyncLoadingScreen',
      description:'独立渲染线程异步关卡加载屏与视频过渡模块，彻底避免主线程卡顿与音频破音，开箱即用。',
      category:'core',categoryName:'底层架构与核心',accentClass:'accent-ai',icon:'rotate',
      type:'ue-cpp',typeLabel:'UE C++ 插件 (无uproject)',ue:'5.2 - 5.5',status:'compiled',statusLabel:'Binaries 已就绪',hasLaunchFile:false,
      modules:[{name:'AsyncLoadingScreen',type:'Runtime',buildCs:'Source/AsyncLoadingScreen/AsyncLoadingScreen.Build.cs'}],
      dependencies:['MoviePlayer','Slate','SlateCore'],
      path:'E:\\\\UE_Plugins\\\\FastAsyncLoadingScreen',size:'42 MB',activity:'9 月 27 日',favorite:false,tags:['LoadingScreen','Async','Slate','无uproject'],
      blueprintNodes:[
        {
          name:'ShowAsyncLoadingScreen',cName:'播放异步加载屏',type:'BlueprintCallable',category:'LoadingScreen|Playback',
          description:'在独立 Slate 渲染线程唤醒全屏关卡加载界面，支持视频播放、提示轮播与动态进度条。',
          cpp:'UFUNCTION(BlueprintCallable, Category="LoadingScreen|Playback") static void ShowAsyncLoadingScreen(const FLoadingScreenConfig& Config);',
          inputs:[{name:'Config',type:'FLoadingScreenConfig',pin:'struct'}],
          outputs:[{name:'Then',type:'Exec Pin',pin:'exec'}]
        },
        {
          name:'HideAsyncLoadingScreen',cName:'平滑淡出加载屏',type:'BlueprintCallable',category:'LoadingScreen|Playback',
          description:'平滑淡出加载屏界面，通知主线程恢复视口渲染与音频混音器。',
          cpp:'UFUNCTION(BlueprintCallable, Category="LoadingScreen|Playback") static void HideAsyncLoadingScreen(float FadeOutDuration = 0.5f);',
          inputs:[{name:'FadeOutDuration',type:'float',pin:'float',default:'0.5'}],
          outputs:[{name:'Then',type:'Exec Pin',pin:'exec'}]
        },
        {
          name:'SetLoadingProgressManual',cName:'更新自定义加载进度',type:'BlueprintCallable',category:'LoadingScreen|Status',
          description:'在分步加载管线中手动更新百分比数值 (0.0 ~ 1.0) 与提示文本。',
          cpp:'UFUNCTION(BlueprintCallable, Category="LoadingScreen|Status") static void SetLoadingProgressManual(float InProgress, const FText& StatusText);',
          inputs:[{name:'InProgress',type:'float',pin:'float'},{name:'StatusText',type:'FText',pin:'text'}],
          outputs:[{name:'Then',type:'Exec Pin',pin:'exec'}]
        },
        {
          name:'IsLoadingScreenActive',cName:'查询加载屏活动状态',type:'BlueprintPure',category:'LoadingScreen|Status',
          description:'查询当前独立渲染线程是否正处于加载屏活动播放状态。',
          cpp:'UFUNCTION(BlueprintPure, Category="LoadingScreen|Status") static bool IsLoadingScreenActive();',
          inputs:[],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        }
      ],
      readme:'# Fast Async Loading Screen\\n\\n## 概述\\n轻量级虚幻引擎异步加载插件，依托 FMoviePlayer 机制与独立 Slate 渲染线程，在关卡无缝切换期间呈现平滑 60fps 动效。'
    },
    {
      id:'p-asio-net',name:'Universal Asio Sockets',identifier:'UniversalAsioSockets',
      description:'跨平台高并发 C++ 异步网络通信库，基于 Boost.Asio 独立 CMake 编译封装，支持 TCP/UDP/WebSocket 协议。',
      category:'core',categoryName:'底层架构与核心',accentClass:'accent-network',icon:'cpu',
      type:'cpp-lib',typeLabel:'C++ 第三方模块',ue:'通用 (5.x)',status:'configured',statusLabel:'源码 + CMake 就绪',hasLaunchFile:false,
      modules:[{name:'UniversalAsio',type:'ThirdParty',buildCs:'Source/ThirdParty/UniversalAsio/UniversalAsio.Build.cs'}],
      dependencies:['Sockets','Networking'],
      path:'E:\\\\CPP_Libraries\\\\UniversalAsioSockets',size:'185 MB',activity:'9 月 20 日',favorite:false,tags:['Boost.Asio','WebSocket','C++17/20','ThirdParty'],
      blueprintNodes:[
        {
          name:'ConnectAsioWebSocketAsync',cName:'异步建立WebSocket长连接',type:'AsyncAction',category:'AsioNet|WebSocket',
          description:'异步建立与远端 WebSocket 服务器的安全双向长连接，内置底层心跳与断线重连守护。',
          cpp:'UFUNCTION(BlueprintCallable, Category="AsioNet|WebSocket") static UAsyncAsioConnectTask* ConnectAsioWebSocketAsync(const FString& ServerUrl, int32 Port, const FString& Protocol = "wss");',
          inputs:[{name:'ServerUrl',type:'FString',pin:'string'},{name:'Port',type:'int32',pin:'int'},{name:'Protocol',type:'FString',pin:'string',default:'"wss"'}],
          outputs:[{name:'OnConnected',type:'Exec Pin',pin:'exec'},{name:'OnDisconnected',type:'Exec Pin',pin:'exec'},{name:'SessionId',type:'int32',pin:'int'}]
        },
        {
          name:'SendAsioBinaryPacket',cName:'发送底层二进制数据包',type:'BlueprintCallable',category:'AsioNet|Transport',
          description:'以非阻塞方式向指定套接字会话发送压缩二进制数据流。',
          cpp:'UFUNCTION(BlueprintCallable, Category="AsioNet|Transport") static bool SendAsioBinaryPacket(int32 SessionId, const TArray<uint8>& Payload);',
          inputs:[{name:'SessionId',type:'int32',pin:'int'},{name:'Payload',type:'TArray<uint8>',pin:'array'}],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        }
      ],
      readme:'# Universal Asio Sockets\\n\\n## 概述\\n高性能异步通信底层模块，无 Unreal 运行时强绑定，既可作为 UE 项目 ThirdParty 模块动态链接，也可在独立工具中复用。'
    },
    {
      id:'p-asset-auditor',name:'Asset Auditor Toolbox',identifier:'AssetAuditorToolbox',
      description:'纯 C++ 实现的资产规格稽核与合规检查器，自动校验贴图 POT、碰撞体复杂度、LOD 阶数与废弃依赖引用。',
      category:'editor',categoryName:'编辑器扩展',accentClass:'accent-editor',icon:'wrench',
      type:'editor-tool',typeLabel:'编辑器扩展工具',ue:'5.3 / 5.4',status:'compiled',statusLabel:'Binaries 已就绪',hasLaunchFile:false,
      modules:[{name:'AssetAuditor',type:'Editor',buildCs:'Source/AssetAuditor/AssetAuditor.Build.cs'}],
      dependencies:['UnrealEd','AssetRegistry','ContentBrowser'],
      path:'E:\\\\UE_Plugins\\\\AssetAuditorToolbox',size:'76 MB',activity:'9 月 15 日',favorite:false,tags:['Audit','QC','AssetRegistry','无uproject'],
      blueprintNodes:[
        {
          name:'RunAssetAuditRule',cName:'执行资产规范检查规则',type:'BlueprintCallable',category:'AssetAuditor|Execution',
          description:'对指定 Content 目录执行规范稽核规则（贴图 POT、面数过高、缺失碰撞、未清理无用材质）。',
          cpp:'UFUNCTION(BlueprintCallable, Category="AssetAuditor|Execution") static FAuditSummary RunAssetAuditRule(const FString& InPackagePath, EAuditSeverity FilterSeverity = EAuditSeverity::Warning);',
          inputs:[{name:'InPackagePath',type:'FString',pin:'string'},{name:'FilterSeverity',type:'EAuditSeverity',pin:'enum'}],
          outputs:[{name:'ReturnValue',type:'FAuditSummary',pin:'struct'}]
        },
        {
          name:'ExportAuditReportToJSON',cName:'导出资产规范审计报告',type:'BlueprintCallable',category:'AssetAuditor|Export',
          description:'将上一次资产规范检查的诊断违规清单导出为本地 JSON 审计报告。',
          cpp:'UFUNCTION(BlueprintCallable, Category="AssetAuditor|Export") static bool ExportAuditReportToJSON(const FAuditSummary& Summary, const FString& OutputFilePath);',
          inputs:[{name:'Summary',type:'FAuditSummary',pin:'struct'},{name:'OutputFilePath',type:'FString',pin:'string'}],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        }
      ],
      readme:'# Asset Auditor Toolbox\\n\\n## 概述\\n专为 UE 团队定制的资产自动化规格检查器，扫描 Content 目录下未合规资源并一键导出 JSON 审计报告。'
    },
    {
      id:'p-blender-pipeline',name:'Blender to UE Pipeline',identifier:'BlenderToUEPipeline',
      description:'面向 Blender 的 Python/C++ 骨骼重对齐与材质一键烘焙工具集，集成 UE Commandlet 资产静默入库脚本。',
      category:'dcc',categoryName:'美术与DCC管线',accentClass:'accent-dcc',icon:'boxes',
      type:'dcc-tool',typeLabel:'DCC / 独立工具',ue:'外部工具 (对接 5.x)',status:'configured',statusLabel:'独立脚本工具',hasLaunchFile:false,
      modules:[{name:'BlenderAddon',type:'Python/DCC',buildCs:'scripts/blender_addon.py'},{name:'UECommandletHook',type:'Commandlet',buildCs:'Source/UEPipelineHook.Build.cs'}],
      dependencies:['Blender 4.x+','Python 3.10+'],
      path:'D:\\\\DCC_Tools\\\\BlenderToUEPipeline',size:'310 MB',activity:'9 月 10 日',favorite:false,tags:['Blender','Python','FBX/glTF','独立工具'],
      blueprintNodes:[
        {
          name:'TriggerCommandletImport',cName:'静默触发Commandlet导入',type:'BlueprintCallable',category:'BlenderPipeline|Automation',
          description:'静默触发 UE Commandlet 资产流水线导入器，自动应用骨骼重定向映射表并入库。',
          cpp:'UFUNCTION(BlueprintCallable, Category="BlenderPipeline|Automation") static bool TriggerCommandletImport(const FString& FBXPath, const FString& TargetPackagePath);',
          inputs:[{name:'FBXPath',type:'FString',pin:'string'},{name:'TargetPackagePath',type:'FString',pin:'string'}],
          outputs:[{name:'ReturnValue',type:'bool',pin:'bool'}]
        }
      ],
      readme:'# Blender to UE Pipeline\\n\\n## 概述\\n连接 Blender 建模环节与 Unreal Engine 资产管线的外部工具，自动纠正骨骼轴向并调用引擎后台命令完成自动化导入。'
    }
  ];`;

// Replace initialPlugins block in content
const initPluginsRegex = /const initialPlugins=\[\s*\{id:'p-gas-ext'[\s\S]*?\{id:'p-blender-pipeline'[\s\S]*?\}\s*\];/;
if (!initPluginsRegex.test(content)) {
  console.error('Failed to match initialPlugins block');
  process.exit(1);
}
content = content.replace(initPluginsRegex, initialPluginsBlock.trim());

// 2. State & Merging
const statePluginsInit = `  const initialPluginMap=new Map(initialPlugins.map(p=>[p.id,p]));
  const loadedPlugins=(Array.isArray(stored.plugins)&&stored.plugins.length?stored.plugins:initialPlugins).map(p=>{
    const init=initialPluginMap.get(p.id);
    if(!init) return p;
    return {...init,...p,blueprintNodes:init.blueprintNodes,modules:init.modules,readme:p.readme||init.readme};
  });
  const state={theme:safeStorage.get('ue-pm-theme')||stored.theme||'dark-unreal',docsService:stored.docsService||'http://127.0.0.1:5173/',docsBindings:stored.docsBindings||{xr:'openxr-ui'},docsProjectId:projects.some(p=>p.id===stored.projectId)?stored.projectId:'xr',catalog,categories:Array.isArray(stored.categories)?stored.categories:[{id:'vr',name:'VR 功能开发',color:'#38bdf8'},{id:'assets',name:'素材库',color:'#a78bfa'},{id:'plugins',name:'工具与插件',color:'#34d399'}],statuses:Array.isArray(stored.statuses)&&stored.statuses.length?stored.statuses:defaultStatuses,order:Array.isArray(stored.order)?stored.order:projects.map(p=>p.id),category:'all',sort:['manual','name','recent'].includes(stored.sort)?stored.sort:'manual',route:'projects',projectId:projects.some(p=>p.id===stored.projectId)?stored.projectId:'xr',projectTab:'overview',filter:'all',query:'',view:stored.view==='list'?'list':'grid',selectedNode:null,nodeProject:'all',nodeQuery:'',milestones:false,documentId:null,overrides:stored.overrides||{},nodeOverrides:stored.nodeOverrides||{},configs:stored.configs||{},requests:Array.isArray(stored.requests)?stored.requests:[],toolboxHeight:stored.toolboxHeight||160,sidebarWidth:stored.sidebarWidth||240,plugins:loadedPlugins,pluginCategory:stored.pluginCategory||'all',pluginFilter:stored.pluginFilter||'all',pluginSort:stored.pluginSort||'manual',pluginView:stored.pluginView==='list'?'list':'grid',pluginOverrides:stored.pluginOverrides||{},pluginId:stored.pluginId||'p-gas-ext',pluginTab:stored.pluginTab||'overview',pluginOrder:Array.isArray(stored.pluginOrder)?stored.pluginOrder:initialPlugins.map(p=>p.id),pluginNodeQuery:'',pluginNodeType:'all'};`;

const stateRegex = /const state=\{theme:safeStorage\.get\('ue-pm-theme'\)[\s\S]*?pluginOverrides:stored\.pluginOverrides\|\|\{\}\};/;
if (!stateRegex.test(content)) {
  console.error('Failed to match state block');
  process.exit(1);
}
content = content.replace(stateRegex, statePluginsInit);

// Update save() to persist pluginOrder, pluginTab, pluginId
content = content.replace(
  'pluginView:state.pluginView,pluginOverrides:state.pluginOverrides',
  'pluginView:state.pluginView,pluginOverrides:state.pluginOverrides,pluginOrder:state.pluginOrder,pluginTab:state.pluginTab,pluginId:state.pluginId'
);

// 3. Update router in render() to support route === 'plugin' and renderPluginDetail(state.pluginId)
content = content.replace(
  "mainEl.innerHTML=state.route==='projects'?renderLibrary():state.route==='plugins'?renderPlugins():state.route==='project'?renderProject()",
  "mainEl.innerHTML=state.route==='projects'?renderLibrary():state.route==='plugins'?renderPlugins():state.route==='plugin'?renderPluginDetail(state.pluginId):state.route==='project'?renderProject()"
);

content = content.replace(
  "b.dataset.nav===(state.route==='project'?'projects':state.route)",
  "b.dataset.nav===(state.route==='project'?'projects':(state.route==='plugin'||state.route==='plugins')?'plugins':state.route)"
);

content = content.replace(
  "bc.textContent=state.route==='project'?projectById(state.projectId).name:({projects:'UE项目库',plugins:'插件库',backups:'备份记录',documents:'项目文档',configuration:'UE 项目配置','vr-install':'VR设备与 APK 安装'}[state.route]||'UE项目库');",
  "bc.textContent=state.route==='project'?projectById(state.projectId).name:state.route==='plugin'?pluginById(state.pluginId).name:({projects:'UE项目库',plugins:'插件库',backups:'备份记录',documents:'项目文档',configuration:'UE 项目配置','vr-install':'VR设备与 APK 安装'}[state.route]||'UE项目库');"
);

// Write and test
fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Patch stage 1 complete');
