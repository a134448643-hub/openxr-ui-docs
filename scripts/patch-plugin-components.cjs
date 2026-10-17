const fs = require('node:fs');
const path = require('node:path');

const appJsPath = path.resolve(__dirname, '../界面原型/app.js');
const stylesCssPath = path.resolve(__dirname, '../界面原型/styles.css');

let appJs = fs.readFileSync(appJsPath, 'utf8');
let stylesCss = fs.readFileSync(stylesCssPath, 'utf8');

// 1. Define pluginComponentsMap
const componentsMapCode = `
  const pluginComponentsMap = {
    'p-gas-ext': [
      {
        name: 'BPC_AbilitySystemExtComponent',
        cName: 'GAS 能力扩展组件',
        baseClass: 'UActorComponent',
        targetActor: '推荐挂载至 Character / PlayerState',
        description: '针对虚幻原生 GAS 框架封装的高级能力组件，自动初始化 ActorInfo 拓扑、接管本地网络属性预测广播与能力堆叠队列。',
        usage: '1. 在角色蓝图（如 BP_ThirdPersonCharacter）点击【添加组件】，搜索并添加 BPC_AbilitySystemExtComponent。\\n2. 在“详细”面板配置 DefaultAbilities 默认技能列表与初始 AttributeSet 属性集。\\n3. 在角色 BeginPlay 节点中调用 InitAbilityActorInfo 绑定 Owner 和 Avatar 引用，后续即可直接在蓝图中通过 GameplayTag 触发技能。',
        properties: [
          { name: 'DefaultAbilities', type: 'TArray<TSubclassOf<UGameplayAbility>>', desc: '生成或初始化时自动赋予该角色的技能列表' },
          { name: 'bAutoInitOnPossess', type: 'bool', desc: '玩家控制器 Possess 附身时是否自动初始化 ActorInfo' }
        ]
      },
      {
        name: 'BPC_AttributeMonitorComponent',
        cName: 'GAS 属性监听与 UI 广播组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 UI 控件宿主 Actor 或玩家控制器',
        description: '用于解耦 UI 血条/状态栏与底层 AttributeSet。动态订阅生命值、魔法值、护盾与耐力变化，自动计算百分比并通过动态委托广播至 UMG 界面。',
        usage: '1. 挂载至需要显示状态 UI 的 Pawn 或 PlayerController 宿主。\\n2. 在组件详细面板勾选需要监视的属性（Health, Mana, Stamina 等）。\\n3. 绑定 OnAttributeChanged 动态委托，获取 NewValue 与 Delta 差值驱动 UMG 动效。',
        properties: [
          { name: 'MonitoredAttributes', type: 'FGameplayAttribute[]', desc: '需要主动订阅的属性集列表' },
          { name: 'bBroadcastPercent', type: 'bool', desc: '是否自动计算并广播当前值/最大值的百分比浮点' }
        ]
      }
    ],
    'p-openxr-pose': [
      {
        name: 'BPC_OpenXRGestureComponent',
        cName: 'OpenXR 手势骨骼追踪解算组件',
        baseClass: 'UActorComponent',
        targetActor: '必须挂载为手部 PoseableMesh 的直接子组件',
        description: '基于 OpenXR 规范 XR_EXT_hand_tracking 扩展实时解算 26 个手部关节 Transform，内置 Meta Quest 与 Pico 骨骼偏移校准，直接驱动手部网格体姿态。',
        usage: '1. 在 VR Pawn 中，首先确保手部模型为 PoseableMeshComponent。\\n2. 将 BPC_OpenXRGestureComponent 拖拽挂载到 PoseableMesh 下方（作为其子级）。\\n3. 在详细面板中分配对应手部的数据资产（如 DA_OpenXRGesture_Quest 或 DA_OpenXRGesture_Pico）。\\n4. 勾选 bEnableDebugDraw 可在视口中绘制 26 关节点参照方块，便于校验手部物理对齐。',
        properties: [
          { name: 'HandGestureDataAsset', type: 'UOpenXRGestureDataAsset*', desc: '对应设备手型的骨骼轴向映射与防抖滤波数据资产' },
          { name: 'bEnableDebugDraw', type: 'bool', desc: '是否在运行期绘制 26 个关节的实时调试方块' }
        ]
      },
      {
        name: 'BPC_WidgetInteractionExtComponent',
        cName: 'VR 空间手势触控交互组件',
        baseClass: 'UWidgetInteractionComponent',
        targetActor: '附加到手部骨骼网格体食指关节 (IndexTip)',
        description: '专为空间 3D UI 打造的手势交互组件。支持近距离食指物理按压触碰与远距离瞄准射线平滑切换，内置自适应抖动滤波与按压阻尼。',
        usage: '1. 在角色蓝图中添加此组件，并将其 AttachToComponent 挂载至右手或左手食指末端骨骼。\\n2. 将“检测通道 (Trace Channel)”设置为专用的 VRUI 通道，开启“手势触碰模式”。\\n3. 在空间 UI 蓝图中使用专用的 BPC_CommonUIButton 即可获得按压下陷与震动触觉反馈。',
        properties: [
          { name: 'InteractionDistance', type: 'float', desc: '近距离手势触控的有效触发距离（默认 5.0 cm）' },
          { name: 'TraceChannel', type: 'ECollisionChannel', desc: '空间 3D 控件碰撞检测通道，默认设置为 ECC_GameTraceChannel1 (VRUI)' }
        ]
      },
      {
        name: 'BPC_UIDisplayComponent',
        cName: '空间跟随手腕 UI 组件',
        baseClass: 'USceneComponent',
        targetActor: '挂载在玩家左手或右手手腕骨骼',
        description: '手腕快捷呼出菜单组件。实时检测玩家手腕法线与摄像机视线夹角，当玩家做出看表手势时平滑淡入呼出快捷菜单，视线移开时自动隐去。',
        usage: '1. 挂载到左手或右手骨骼根节点，将组件相对位置调整到掌心或手腕外侧。\\n2. 在“显示的 UI”中指定需要弹出的 3D Widget Actor 类。\\n3. 在详细面板中调节检测角度阈值（默认 45°）与响应迟滞量，避免玩家挥手时误触发。',
        properties: [
          { name: 'WidgetActorClass', type: 'TSubclassOf<AActor>', desc: '触发看表手势时弹出的 3D UI 资产类' },
          { name: 'ActivationAngleThreshold', type: 'float', desc: '手掌法线正对摄像机的夹角激活阈值，单位度（默认 45.0）' }
        ]
      }
    ],
    'p-claude-bridge': [
      {
        name: 'BPC_ClaudeContextCollector',
        cName: '编辑器场景拓扑采集组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 Editor Utility Blueprint 或调试管理 Actor',
        description: '负责在虚幻编辑器环境中快速采集当前视口选中的 Actor 变换矩阵、材质实例参数与关卡蓝图依赖，并序列化为 AI 上下文 Prompt。',
        usage: '1. 在编辑器工具蓝图 (Editor Utility Blueprint) 中添加此组件。\\n2. 绑定快捷键或 Slate 按钮调用 CollectSelectionContext 方法。\\n3. 采集完成后分派至 ClaudeBridgeEditorSubsystem 进行大模型诊断分析。',
        properties: [
          { name: 'bIncludeMaterialParameters', type: 'bool', desc: '采集上下文时是否一并导出材质标量与矢量参数' },
          { name: 'MaxTokensLimit', type: 'int32', desc: '上下文序列化最大 Token 预算截断（默认 8000）' }
        ]
      },
      {
        name: 'BPC_AIAutomationTaskComponent',
        cName: 'AI 批处理事务安全执行组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至编辑器自动化运行器',
        description: '安全执行 AI 生成的自动化重命名、资产迁移与节点连线指令，内置事务审查机制，支持完整的 Ctrl+Z 撤销回滚。',
        usage: '1. 挂载至自动化任务调度 Actor。\\n2. 传入 AI 生成的 CommandJSON 指令流。\\n3. 组件在主线程自动创建 GEditor->BeginTransaction 事务快照后执行，如遇异常自动中断回滚。',
        properties: [
          { name: 'bAutoCreateUndoSnapshot', type: 'bool', desc: '每次执行批处理命令前是否自动记录 Undo 事务' }
        ]
      }
    ],
    'p-loading-screen': [
      {
        name: 'BPC_LoadingScreenTrigger',
        cName: '异步过渡屏幕触发组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至传送门、门扉或关卡 TriggerVolume',
        description: '关卡无缝传送专用的触发管理组件。监听玩家重叠碰撞，向专用电影播放线程发送切关过渡指令，维持 60fps 稳定渲染。',
        usage: '1. 在关卡传送门 Actor 中点击【添加组件】，选择 BPC_LoadingScreenTrigger。\\n2. 在“详细”面板指定 TargetLevel 目标关卡路径与过渡视频预设。\\n3. 玩家触碰碰撞体后，组件自动阻塞主线程画面，并调度专用渲染线程展示过渡动效。',
        properties: [
          { name: 'TargetLevelName', type: 'FName', desc: '触发后即将加载的目标关卡资产名称' },
          { name: 'TransitionDuration', type: 'float', desc: '加载完成后过渡遮罩的平滑淡出持续时间（默认 0.8s）' }
        ]
      },
      {
        name: 'BPC_AsyncAssetPreloader',
        cName: '后台流送预加载组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 GameMode 或关卡入口 Actor',
        description: '基于 FStreamableManager 在异步过渡期间静默预加载关键角色模型、材质包与音频资源，彻底杜绝切关后材质灰模与音效破音。',
        usage: '1. 挂载到 GameMode 或场景管理 Actor 上。\\n2. 将需要预加载的资产软引用填入 PreloadAssetList 数组。\\n3. 绑定 OnPreloadComplete 委托，在资源全部就绪后再触发关闭过渡遮罩。',
        properties: [
          { name: 'PreloadAssetList', type: 'TArray<TSoftObjectPtr<UObject>>', desc: '切关期间需提前完成异步流送的关键资产清单' }
        ]
      }
    ],
    'p-asio-net': [
      {
        name: 'BPC_AsioClientSocketComponent',
        cName: '高并发异步套接字通信组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 PlayerController 或 GameInstance 宿主',
        description: '由独立 Boost.Asio 工作线程驱动的高性能网络组件。支持 TCP/UDP 长连接通信、心跳保活与自定义二进制协议序列化。',
        usage: '1. 在游戏主控制器 (PlayerController) 中添加 BPC_AsioClientSocketComponent。\\n2. 调用 ConnectAsync(ServerIP, Port) 异步发起连接。\\n3. 在蓝图事件图表中绑定 OnDataPacketReceived 委托，解析自定义二进制包体。',
        properties: [
          { name: 'HeartbeatIntervalSeconds', type: 'float', desc: '客户端自动向服务端发送 Ping 心跳包的时间间隔（默认 5.0s）' },
          { name: 'bAutoReconnect', type: 'bool', desc: '发生异常断线时是否自动开启指数退避重连' }
        ]
      },
      {
        name: 'BPC_NetworkReplicationExtComponent',
        cName: '高频网络状态插值组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至高频同步的载具或多人 Character',
        description: '负责网络抖动数据包的 Hermite 样条平滑插值与航位推测 (Dead Reckoning)，消除多人在线环境中的瞬移、抖动与回弹。',
        usage: '1. 挂载到需要高精位置同步的 Actor 上。\\n2. 设置网络更新率 (ReplicationRate) 与插值缓冲时长（建议 60~100ms）。\\n3. 收到远端位置包后调用 PushStateSnapshot，组件将自动接管平滑渲染位姿。',
        properties: [
          { name: 'InterpolationDelayMs', type: 'float', desc: '插值缓冲延迟时长，单位毫秒（建议 50.0 ~ 100.0）' }
        ]
      }
    ],
    'p-asset-auditor': [
      {
        name: 'BPC_AssetValidatorComponent',
        cName: '资产规则检查组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 Editor Utility Blueprint 或自动化检查 Actor',
        description: '运行期快速扫描工程资产合规性，检测命名规范、材质槽位滥用与未配置碰撞网格体，输出体检评分。',
        usage: '1. 挂载在编辑器工具蓝图中。\\n2. 传入目标扫描文件夹路径（如 /Game/Maps 或 /Game/Characters）。\\n3. 调用 RunValidationCheck，并在界面上实时呈现违规资产列表与警告等级。',
        properties: [
          { name: 'bEnforcePrefixConvention', type: 'bool', desc: '是否严格强制检查 BP_、SM_、M_ 等资产命名前缀' }
        ]
      },
      {
        name: 'BPC_BatchRedirectorComponent',
        cName: '失效材质批量重定向组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至编辑器视口工具',
        description: '一键排查迁移后丢失的材质引用，并批量重定向至项目默认备用材质或指定材质实例。',
        usage: '1. 挂载至资产管理面板。\\n2. 点击“扫描失效材质”定位孤儿引用。\\n3. 指定兜底材质并点击“批量安全重定向”，自动更新引用关系。',
        properties: [
          { name: 'FallbackMaterial', type: 'UMaterialInterface*', desc: '检测到材质丢失时用于替换的全局默认备用材质' }
        ]
      }
    ],
    'p-blender-pipeline': [
      {
        name: 'BPC_BlenderLiveSyncComponent',
        cName: 'Blender 实时双向热重载组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至需要与 Blender 联调的关卡 Actor',
        description: '基于本地 WebSocket 监听 Blender 插件端的模型与蒙皮导出，在 UE5 视口中实时热重载网格体与材质，免去手动导入。',
        usage: '1. 在关卡测试 Actor 中添加此组件，保持监听端口 8081。\\n2. 在 Blender 端点击“Sync to Unreal Engine”。\\n3. 视口中的 StaticMesh / SkeletalMesh 将在 1 秒内无感热重载生效。',
        properties: [
          { name: 'ListenPort', type: 'int32', desc: '本地 WebSocket 监听端口号（默认 8081）' }
        ]
      },
      {
        name: 'BPC_OpenXRAutoRigComponent',
        cName: 'OpenXR 手势骨骼重映射组件',
        baseClass: 'UActorComponent',
        targetActor: '挂载至 SkeletalMeshComponent',
        description: '自动将 Blender 导出的手部骨骼层级映射为 OpenXR 26 骨节标准命名，并自动矫正 Z-Up 与 X-Forward 旋转轴向。',
        usage: '1. 挂载在手部骨架网格体组件上。\\n2. 在配置中选择源骨骼模板（如 Blender Rigify）。\\n3. 点击“执行重映射”即可自动生成兼容 OpenXR 手势追踪的 PoseableMesh。',
        properties: [
          { name: 'SourceBoneTemplate', type: 'FString', desc: 'Blender 端使用的手部骨骼预设类型（默认 Rigify_Hands）' }
        ]
      }
    ]
  };

  function getPluginComponents(p) {
    if (!p) return [];
    if (p.components && p.components.length) return p.components;
    if (pluginComponentsMap[p.id]) return pluginComponentsMap[p.id];
    const safeName = (p.identifier || p.name || 'CustomPlugin').replace(/[^a-zA-Z0-9]/g, '');
    return [
      {
        name: 'BPC_' + safeName + 'Component',
        cName: (p.name || '插件') + ' 核心组件',
        baseClass: 'UActorComponent',
        targetActor: '推荐挂载至 Character / Actor',
        description: (p.description || '纯 C++ 模块插件核心组件，提供原生蓝图生命周期管理。'),
        usage: '1. 在目标 Actor 蓝图中点击【添加组件】，搜索并添加 BPC_' + safeName + 'Component。\\n2. 在“详细”面板中配置相关业务参数。\\n3. 运行时调用组件对外暴露的公开蓝图方法。',
        properties: [
          { name: 'bAutoActivate', type: 'bool', desc: 'Actor 生成时是否自动激活组件 Tick 与生命周期' }
        ]
      }
    ];
  }
`;

// Insert pluginComponentsMap before const pluginDocsMap =
if (!appJs.includes('const pluginComponentsMap =')) {
  appJs = appJs.replace('const pluginDocsMap =', componentsMapCode + '\n  const pluginDocsMap =');
}

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('Step 1: Injected pluginComponentsMap and getPluginComponents');
