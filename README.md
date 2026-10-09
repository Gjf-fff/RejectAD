# RejectAD
remove some ads

## Loon

- [知乎回答页广告补丁：安装与说明](Tool/Loon/README.md)
- [知乎插件订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/Zhihu.plugin)
- [JM 网页广告补丁：安装与说明](Tool/Loon/README_JM.md)
- [JM 插件订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/JM.plugin)

### 视频点击广告分流规则

- [VideoPopup.list 订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Ruler/VideoPopup.list)
- 在 Loon 中添加为远程规则（订阅规则），策略选择 `REJECT`，启用后使用分流模式重新加载网页。此文件不是插件。
- 无需 MitM；阻断已识别的广告跳转及落地页，仍可能出现空白或错误标签页。

### Loon 目录

- `Tool/Loon/Ruler/`：分流规则列表。
- `Tool/Loon/Plugin/`：Loon 插件。
- `Tool/Loon/JS/`：插件使用的脚本。

原 `Tool/Loon/Rewrite/` 目录已迁移；已订阅知乎或 JM 插件的用户请改用上方的新地址。
