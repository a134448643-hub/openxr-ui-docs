---
id: p1792150504802
title:
  zh: 配置流程
  en: New Page
---

<!-- DOCBLOCK id="pmvb0364sisrtwii" type="text" -->
<!-- ZH -->
BPC_OpenXR手势配置
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb0364suge2f1x" type="text" -->
<!-- ZH -->
极致简化手势配置流程
现在只需要添加一个手势组件，设置数据资产即可正常运行。
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="b1791987675801" type="image" -->
![b1791987675801](../assets/beb5217e7e010f47a697.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvavvm8pn0o2qsw" type="text" -->
<!-- ZH -->
BPC_控件交互组件/射线配置
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb04lsd3vo0fz1" type="text" -->
<!-- ZH -->
手势角色：添加到BPC_OpenXR手势组件下，无需绑定输入
手柄角色：添加到角色手部骨骼网格体的食指骨骼上
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvbnn04ad3hdi63" type="image" -->
![pmvbnn04ad3hdi63](../assets/1403290e51b43a694e9c.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvbnou2ht8de4vc" type="text" -->
<!-- ZH -->
依然可以在构造脚本，通过编辑器调试节点，在蓝图视口预览组件情况，记得组件细节面板开启调试
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvbnoo80qphjb0d" type="image" -->
![pmvbnoo80qphjb0d](../assets/7f3a1f9f900cb5f8b577.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvbnn04bmvof3b3" type="text" -->
<!-- ZH -->

BPC_控件交互组件_射线需要绑定一个输入，用于触发鼠标左键按压，布尔控制按下左键和松开左键
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb0tv6x69uso4n" type="image" -->
![pmvb0tv6x69uso4n](../assets/876c2b7c40bb3ef60c49.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb0d7j111gxu2l" type="text" -->
<!-- ZH -->
BPC_UI显示组件
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb0d370o409oj8" type="text" -->
<!-- ZH -->
添加你的需要显示UI Actor
在构造脚本，拖出BPC_UI显示组件，连接编辑器调试节点，可在编辑器里观察设置位置（手势模式不太好定位，需要运行时预览效果）
设置箭头位置，箭头是触发器，看向箭头才会触发UI,一般箭头位置在掌心
<!-- EN -->

<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb0gwgs1282nbp" type="image" -->
![pmvb0gwgs1282nbp](../assets/0566accc38c2098d1bb5.png)
<!-- /DOCBLOCK -->

<!-- DOCBLOCK id="pmvb197u0t7ac6m4" type="text" -->
<!-- ZH -->

<!-- EN -->

<!-- /DOCBLOCK -->
