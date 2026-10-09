# JM 网页广告补丁（Loon）

根据 2026-10-08 的 HAR 197 编写，针对 `18comic.vip` 网页。包含 HTML 广告容器清理与抓包确认的第三方广告主机拦截。

现已合并 `missav.ai` 视频播放防弹窗功能，更新同一个 JM 插件即可。原 JM 图标、订阅地址、去广告脚本及域名规则保留。

## 安装

在 Loon 的插件页面添加、启用下面的订阅地址：

```text
https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/JM.plugin
```

开启脚本及 MitM，安装并信任 Loon 的 MitM 证书。插件会加入 `18comic.vip`、`www.18comic.vip`、`missav.ai` 与 `www.missav.ai`；两个 JS 自动从本仓库下载。添加后重载配置，关闭原网页标签并重新打开，使新 HTML 经过补丁。

若已安装独立 `VideoPopup.plugin`，更新 JM 后停用独立插件，避免同一页面配置重复响应脚本。旧 `Ruler/VideoPopup.list` 可保留作后备。

JM 日志示例：

```text
[JM广告补丁] 删除 9 个广告容器及 2 个广告加载脚本
```

## 处理范围

- 列表页中 8 个 `all_albums_*` 广告/推广栏，连同其单独网格占位一起移除。
- 底部 `sticky2` 轮播悬浮广告，包含其内部的 4 张广告素材。
- `a.chnsrv.com/ad-provider.js` 与 `campfirecroutondecorator.com/bn.js` 的动态广告加载入口。
- 网站自身托管的 NeverBlock/ExoLoader 加载器 `jquery.33_a1e.js`，以及调用 `ExoLoader.serve` 的内联回退代码。HAR 中的 `/templates/frontend/airav/js/33_a1e.js` 确认返回广告数据，说明只封第三方广告域名不能覆盖这条同源回退链路。
- 抓包确认的 11 个第三方广告主机。插件按完整主机名拒绝连接，包括广告 API、跟踪跳转及素材主机；这些主机上的广告请求在其他网站也会被拦截。

原 JM HTML 脚本只修改 `18comic.vip` 的成功完整 HTML 响应，跳过静态资源、AJAX、Cloudflare 验证路径及非成功响应。普通封面 CDN、分页、导航、表单、正常 iframe 与窗口打开逻辑均保留。没有按图片尺寸、关键词、高 z-index 或所有 iframe 进行过滤。

## 合并的视频防弹窗功能

对 `missav.ai` 与 `www.missav.ai` 使用 `video_popup_patch.js`：禁用页面中独立的 `pop()` 点击事件，在网站脚本之前注入对已识别广告地址的开窗拦截。不改写播放器播放逻辑，不拦截 `surrit.com` 的正常视频流。

需关闭原视频网页并重新打开，或重新加载整个网页后再点播放。已打开的广告标签页不会自动关闭。Loon 对应日志为 `[视频弹窗补丁] 已注入广告开窗拦截`。

视频部分已通过本地 JavaScript 模拟检查，尚未进行真实浏览器和 iPhone 播放测试；原抓包没有视频页面 HTML，严格 CSP、跨域 iframe 或其他开窗方式仍可能无法覆盖。详见 [视频防弹窗的处理方式与验证范围](README_VideoPopup.md)。

## 原 JM 抓包回放验证

HAR 共 295 条记录。域名规则匹配 49 条已确认广告链路请求；HTML 脚本只修改第 100、259 条成功的列表页面响应。

| 检查 | 第 100 条 | 第 259 条 |
| --- | ---: | ---: |
| 移除列表广告/推广栏 | 8 | 8 |
| 移除底部悬浮广告容器 | 1 | 1 |
| 保留的正常内容链接 | 82 | 82 |
| 保留的正常图片元素 | 109 | 109 |
| 分页、表单、导航、样式表 | 内容一致 | 内容一致 |
| 剩余已知广告加载器 | 0 | 0 |

在隔离、无外部联网的浏览器 DOM 中比较了原始 HTML 与处理后 HTML；正常内容链接、图片元素、分页、表单、导航、样式表和正常窗口打开脚本保持一致。还验证了重复执行、空响应、其他域名、非 HTML、验证路径及错误状态码。

结果文件：[JM_verification.json](JM_verification.json)。这是离线回放和 DOM 检查，尚未在用户 iPhone 上验证。附件截图的本地路径已失效，未完成截图与具体广告素材的逐一对应。

当前 HTML 容器类名来自本次抓包，网站更换布局或域名后可能需要更新；当前不包含原生 App。抓包里的其他第三方请求未被统一认作广告。

## 与其他规则同时使用

同一网页只保留一个匹配的响应脚本。若其他插件对该站点执行响应体重写，需要关闭对应冲突行，否则本脚本可能无法执行。纯域名去广告规则可以配合使用；若本地规则显式放行上述广告主机，按 Loon 的规则来源优先级，本地规则优先于插件规则，需要调整相应放行行。

官方说明：[脚本执行规则](https://nsloon.app/docs/Script/script_v2/)、[分流规则优先级](https://nsloon.app/docs/Rule/)。
