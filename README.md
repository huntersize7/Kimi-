生成一个edge插件，插件的名称是"网页翻译"，插件的图标是一个地球仪，插件的功能是翻译网页上的内容。
1，插件的实现方式：
选中网页上的内容，点击插件图标，插件会自动翻译选中的内容。
2，总结页面内容：
选中网页上的内容，点击插件图标，插件会自动总结页面内容。
要求：1翻译功能和总结功能都要使用kimi API，参考文档：https://kimi.com/docs/api/overview
2打开在侧边栏中

3，UI示意图：
![image](https://github.com/user-attachments/assets/215a9fb3-8111-441d-988d-76e180ca79d9)

4，插件代码已生成：
插件文件结构如下：
- manifest.json: 插件配置文件
- sidepanel.html: 侧边栏HTML界面
- styles.css: 样式表
- sidepanel.js: 侧边栏功能实现
- content.js: 内容脚本，用于获取选中文本
- background.js: 后台脚本，处理插件事件
- config.js: 配置文件，存储API密钥
- README.md: 使用说明文档
- images/: 图标文件夹（需手动添加图标）

主要功能实现：
1. 翻译功能：通过Kimi API将选中文本翻译为中文
2. 总结功能：通过Kimi API对选中文本进行摘要总结
3. 侧边栏UI：美观简洁的界面，提供功能切换和结果显示
4. 右键菜单：支持通过右键菜单快速使用翻译或总结功能

使用前须知：
- 需要在config.js中配置Kimi API密钥
- 需要手动添加插件图标到images目录
