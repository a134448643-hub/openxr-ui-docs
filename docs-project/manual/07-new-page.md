---
id: p1791987538788
title:
  zh: BPC_OpenXR手势
  en: PAD_GestureConfig
---

<!-- DOCBLOCK id="b1791987903275" type="text" -->
<!-- ZH -->
PAD_手势配置
<!-- EN -->
Gesture Data Asset
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1791987925760" type="text" -->
<!-- ZH -->
该组件所有设置都在这个数据资产里面
是否开启调试？
开启调试后会显示所有OpenXR的手势骨骼
E_控制器手
设置左右手
XR手势/自定义骨骼映射
OpenXR手势骨骼和手势模型骨骼之间的名称映射，按照我的模板填入自定义模型骨骼名称即可驱动手势模型。
设置手势相对偏移
设置手势模型整体位置
设置手势相对旋转
设置手势模型整体旋转
手势骨骼旋转校准
设置手势模型所有骨骼旋转，用于与openxr手势轴向对齐
XR手势参照网格体
设置调试显示的OpenXR手势骨骼参考点模型
骨骼网格体样式
设置手势骨骼网格体模型
BPC_控件交互组件偏移
设置手指控件交互组件偏移
<!-- EN -->
Is Debug Enabled
Enables debug visualization of all OpenXR hand joints.
XRGesture Custom Bone Map
Maps OpenXR hand joint names to the bone names in your hand model. Follow the provided template and enter your custom bone names to drive the model.
Gesture Relative Offset
Sets the overall relative position of the hand model.
Gesture Relative Rotation
Sets the overall relative rotation of the hand model.
Gesture Bone Rotation Calibration
Applies a rotation correction to all bones in the hand model to align their axes with OpenXR hand tracking.
XRGesture Reference Mesh
Sets the static mesh used to visualize OpenXR hand joint reference points during debugging.
Skeletal Mesh Style
Sets the skeletal mesh used for the hand model.
Widget Interaction Offset
Sets the relative transform of the finger widget interaction component.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1791987613677" type="image" -->
![b1791987613677](../assets/819bcdcc117e67580c66.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvawx0utxw8payq" type="text" -->
<!-- ZH -->

<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1791987724721" type="text" -->
<!-- ZH -->

<!-- EN -->

<!-- /DOCBLOCK -->
