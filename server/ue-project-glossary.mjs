export const defaultProjectTerms=[['手势','Gesture'],['抓取','Grab'],['捏合','Pinch'],['手指弯曲','FingerCurl'],['追踪','Tracking'],['纹理资产前缀','T_'],['静态网格体资产前缀','SM_'],['骨骼网格体资产前缀','SK_'],['材质资产前缀','M_'],['材质实例资产前缀','MI_'],['普通蓝图资产前缀','BP_'],['Actor Component 蓝图资产前缀','AC_'],['蓝图接口资产前缀','BPI_'],['控件蓝图资产前缀','WBP_'],['动画蓝图资产前缀','ABP_'],['场景组件成员命名','按用途使用 PascalCase，例如 HandTracking；不统一添加 AC_'],['普通变量命名','PascalCase，例如 GrabDistance；不添加 Var_'],['布尔变量命名','b + 明确语义，例如 bIsTracking'],['函数命名','行为动词，例如 RecognizeGesture；Get/Set/Is/Has/Can 按语义使用'],['自定义事件命名','On + 事件语义，例如 OnGestureRecognized'],['资产名称格式','类型前缀_名称_描述_可选变体；避免重复前缀'],['分类层级','保留 | 层级，例如 Gestures|Recognition']];
export function validateProjectTerms(terms){if(!Array.isArray(terms)||terms.length>200||terms.some(t=>!Array.isArray(t)||t.length!==2||t.some(v=>typeof v!=='string'||v.length>1000)))throw Error('项目术语表格式无效');return terms.map(t=>[...t]);}
defaultProjectTerms.push(
 ['布尔类型规则','真实 scalar bool 使用小写 b + PascalCase，如 bIsTracking；B_ 是可自定约定，不是 Epic 默认'],
 ['整型变量规则','表达数量或索引，如 HandCount、CurrentIndex；不机械添加 I_'],
 ['浮点变量规则','表达用途和单位，如 GrabDistance、BlendWeight、DurationSeconds；不机械添加 F_'],
 ['向量变量规则','表达位置、方向、尺度，如 HandLocation、MoveDirection、TargetScale；不把类型前缀 F 放到变量上'],
 ['旋转变量规则','Rotator，如 HandRotation、TargetRotation'],['变换变量规则','Transform，如 GripTransform、ReferenceTransform'],
 ['颜色变量规则','Color / LinearColor，如 HighlightColor；不是类型名称 FColor'],
 ['字符串变量规则','String，如 DisplayString、UserInput'],['名称变量规则','Name，如 SocketName、BoneName'],['文本变量规则','Text，如 DisplayText、TooltipText'],
 ['对象引用规则','按职责命名，如 GestureRecognizer、TargetActor、InteractionWidget；U/A 是原生类型前缀，不统一加到变量上'],
 ['类引用规则','按职责使用 Class 后缀，如 MenuWidgetClass'],['枚举变量规则','表达状态或选项，如 TrackingState、GestureType；E_ 用于枚举资产'],
 ['结构体变量规则','表达数据语义，如 GestureData、HandPose；F_ 用于结构体资产或原生类型，不统一加到变量上'],
 ['数组变量规则','描述集合并按语义使用复数，如 HandPoses、TrackedActors；不为 bool 数组统一加 b'],
 ['集合变量规则','如 ActiveGestures、SelectedActors'],['映射变量规则','表达键和值关系，如 GestureByName、PoseByHand'],
 ['输入参数规则','描述输入含义；需要区分时使用 In，如 InPose'],['输出参数规则','写入调用方参数使用 Out，如 OutPose；布尔输出 bOutResult'],
 ['局部变量规则','PascalCase，限定于对应函数，不跨函数判定重名'],['组件成员规则','按职责命名，如 LeftMotionController、HandTracking；AC_ 对应组件蓝图资产'],
 ['函数取值规则','GetGripTransform、GetGestureCount；只在实际取值时用 Get'],['函数设置规则','SetTrackingEnabled、SetGestureThreshold；只在修改状态时用 Set'],
 ['布尔判断函数规则','IsHandTracked、HasValidPose、CanGrab、ShouldRecognize；函数名不加 b'],
 ['事件分发器规则','OnGestureChanged、OnGrabStarted'],['中文学习项目规则','允许中文暴露名称，保留资产类型前缀和原生 C++ 标识'],
 ['枚举资产前缀','E_'],['结构体资产前缀','F_'],['数据表资产前缀','DT_'],['曲线表资产前缀','CT_'],['数据资产项目约定','DA_'],
 ['材质函数资产项目约定','MF_'],['骨架资产前缀','SKEL_'],['物理资产前缀','PHYS_'],['物理材质前缀','PM_'],
 ['动画序列前缀','AS_'],['动画蒙太奇前缀','AM_'],['混合空间前缀','BS_'],['关卡序列前缀','LS_'],
 ['Niagara 系统前缀','FXS_'],['Niagara 发射器前缀','FXE_'],['输入动作项目约定','IA_'],['输入映射项目约定','IMC_'],
 ['纹理用途描述','BaseColor / Normal / Roughness / Metallic / Opacity；依据实际用途，不猜测通道'],
 ['文件夹命名规则','英文 PascalCase，按功能模块与资源类型组织，保留产品根目录'],
 ['蓝图','Blueprint'],['Actor','Actor'],['Actor 组件','Actor Component'],['场景组件','Scene Component'],['控件','Widget'],
 ['静态网格体','Static Mesh'],['骨骼网格体','Skeletal Mesh'],['动画蓝图','Animation Blueprint'],['材质实例','Material Instance'],
 ['手部追踪','Hand Tracking'],['运动控制器','Motion Controller'],['输入动作','Input Action'],['输入映射上下文','Input Mapping Context'],
 ['游戏标签','Gameplay Tag'],['事件分发器','Event Dispatcher'],['构造脚本','Construction Script'],['时间轴','Timeline'],
 ['参考示例','ContentExamples_5.8；示例有历史和不同模块惯例，按实际类型与官方规范选择，不照搬所有前缀']
);

defaultProjectTerms.push(['PrimaryDataAsset 蓝图类前缀','PAD_；依据真实父类识别；实例使用 DA_，不叠加 BP_'],['简洁开发命名','先理解用途再命名；Config、UI、XR 可用，AC_ 资产省略冗余 Component，保留方向和交互方式'],['语境不足处理','标记需确认，不猜测含义、不按长度强行截断'],['前缀处理顺序','读取真实类型和父类 → 分离旧前缀 → 翻译词干 → 添加一次项目目标前缀']);

const commonLabels=new Set(['手势','抓取','捏合','手指弯曲','追踪','蓝图','Actor','Actor 组件','场景组件','控件','静态网格体','骨骼网格体','动画蓝图','材质实例','手部追踪','运动控制器','输入动作','输入映射上下文','游戏标签','事件分发器','构造脚本','时间轴']);
export const defaultUECommonTerms=defaultProjectTerms.filter(([label])=>commonLabels.has(label));
export const projectRuleLabels=new Set(defaultProjectTerms.filter(([label])=>!commonLabels.has(label)).map(([label])=>label));
export function splitUEGlossary(terms,commonTerms,knownCommonLabels=[]){const commonKeys=new Set([...commonLabels,...knownCommonLabels,...commonTerms.map(([label])=>label)]);return {commonTerms,projectTerms:terms.filter(([label])=>!commonKeys.has(label)&&!projectRuleLabels.has(label))};}
export function mergeUEGlossary(terms,commonTerms,knownCommonLabels=[]){const commonKeys=new Set([...commonLabels,...knownCommonLabels,...commonTerms.map(([label])=>label)]),mapping=new Map(commonTerms),used=new Set(),merged=[];for(const pair of terms){if(commonKeys.has(pair[0])){if(mapping.has(pair[0])&&!used.has(pair[0])){merged.push([pair[0],mapping.get(pair[0])]);used.add(pair[0]);}}else merged.push([...pair]);}for(const pair of commonTerms)if(!used.has(pair[0]))merged.push([...pair]);return merged;}
