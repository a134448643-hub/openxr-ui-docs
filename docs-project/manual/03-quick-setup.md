---
id: p1769099094056
title:
  zh: 2.快速配置
  en: Quick Setup
---

<!-- DOCBLOCK id="b1769101324105" type="text" -->
<!-- ZH -->
功能验证
<!-- EN -->
Functionality Verification
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769101324860" type="text" -->
<!-- ZH -->
完成1.导入项目之后
更换手柄/手势角色验证是否正常运行
<!-- EN -->
After completing step 1 (Project Import), switch the controller/gesture character to verify proper operation.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769101422823" type="image" -->
![b1769101422823](../assets/7ccc53a266e141aa58e5.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769110697908" type="text" -->
<!-- ZH -->

<!-- EN -->
Fix Node
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769110856334" type="text" -->
<!-- ZH -->

<!-- EN -->
If you import a low-version project, such as 5.3, into a higher version, such as 5.5/5.7, the BPC_OpenXR Gestures will report an error, and the 5.3 nodes will be enabled.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769111147376" type="text" -->
<!-- ZH -->

<!-- EN -->
We use the GetHand TrackingState node to reconnect the pins and fix the error.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769111480132" type="text" -->
<!-- ZH -->

<!-- EN -->
Configure VR Controller Character
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113229920" type="text" -->
<!-- ZH -->

<!-- EN -->
Create/Duplicate VR Template Character
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769111571536" type="text" -->
<!-- ZH -->

<!-- EN -->
Create/Copy the character from the VR template corresponding to your UE version. Delete the selected unused components (shown in the image), and ideally, the button menu. Note: Especially the WidgetInteraction component, as it will affect this project's widget interaction components!
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113202817" type="text" -->
<!-- ZH -->

<!-- EN -->
Add BPC_WidgetInteraction
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769111911501" type="text" -->
<!-- ZH -->

<!-- EN -->
Using the right hand as an example, add the BPC_ControlInteractionComponent beneath the hand skeletal mesh.
1. Enable Editor Debug Lines, add the Editor Debug UI Blueprint Interface node in the Construction Script, and check "Enable Debugging" in the Debug settings.
2. Attach the component to the skeletal mesh index finger bone.
3. Set the component's location and rotation.
4. Select whether to use gestures or the controller/gamepad based on your requirements.
5. Set whether it is the left hand or the right hand.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769114443578" type="text" -->
<!-- ZH -->
注意：该项目没有包含HTAB手部资产，按所需去FAB自行购买！
<!-- EN -->
Note: This project does not include the HTAB hand assets. Please purchase them separately from FAB as required.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113251285" type="text" -->
<!-- ZH -->

<!-- EN -->
Add PoseableMesh Component
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769114436642" type="image" -->
![b1769114436642](../assets/694a545c917d7b5c8596.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvaunl4wu5t4d9t" type="text" -->
<!-- ZH -->

<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769112980660" type="text" -->
<!-- ZH -->

<!-- EN -->
1. Add PoseableMesh under the BPC_WidgetInteraction and set the corresponding hand model's skeletal mesh
2. Set PoseableMesh's visibility to false, hide the UI hand
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113318494" type="text" -->
<!-- ZH -->

<!-- EN -->
The setup process for the the left hand is consistent with the right hand.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113120549" type="text" -->
<!-- ZH -->

<!-- EN -->
Add BPC_UIDisplay
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113313515" type="text" -->
<!-- ZH -->

<!-- EN -->
Add the BPC_UIDisplay to the Left Hand:
1. Enable Editor Debugging, and add the Editor Debug UI Blueprint interface node within the Construction Script
2. Add the UI Actor you intend to interact with
3. Set the desired position for UI interaction
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113874001" type="text" -->
<!-- ZH -->

<!-- EN -->
VR Handheld Character Configuration Complete
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113896239" type="text" -->
<!-- ZH -->

<!-- EN -->
Configure VR Gesture Character
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769113969671" type="text" -->
<!-- ZH -->

<!-- EN -->
The setup process for the BPC_WidgetInteraction / BPC_UIDisplay is consistent with the Gamepad Character Configuration flow.
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769114011940" type="text" -->
<!-- ZH -->

<!-- EN -->
Add PoseableMesh and BPC_OpenXRGesture
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1769114156899" type="text" -->
<!-- ZH -->

<!-- EN -->
1. Set the Skeletal Mesh for the Poseable Mesh
2. Attach the BPC_OpenXRGesture under the Poseable Mesh
3. Add the BPC_OpenXRGesture Data Asset, typically the UE5VR template/Quest/Pico/HTAB hand model data asset
<!-- /DOCBLOCK -->
