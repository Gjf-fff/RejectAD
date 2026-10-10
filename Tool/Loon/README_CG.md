# 51CG 网页广告补丁（已合并到“我不是涩神”）

在 Loon 更新并启用现有 [JM.plugin](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/JM.plugin)，无需添加另一份插件。开启脚本和 MitM，安装并信任证书；关闭原网页，重新打开或重新加载完整网页后测试。

插件新增 `51cg1.com` 与 `www.51cg1.com` 的 MitM 和独立网页脚本，原 JM、MissAV 功能、名称、图标及订阅地址保留。

## 新增处理

仅处理指定站点的成功 HTML 响应，在网站首个脚本之前注入：

- 隐藏 `.post-card-ads`、`.horizontal-banner`、`#adFloat`、`.recommend-layer` 这些明确的广告容器。
- 隐藏 `.dplayer-pre-img`、`.dplayer-pre-bg`、`.dplayer-pre-countdown` 播放前贴片元素。
- 将 `DPLAYER_PREROLL_AD.attachPreRollAd` 替换为空操作，包括 API 在注入后才赋值的情况；其他 API 属性和播放器的 play/pause 方法保留。

广告选择器及 API 名称参考 [AdGuard 官方中文过滤规则](https://github.com/AdguardTeam/AdguardFilters/blob/master/ChineseFilter/sections/specific.txt)。本仓库的 Loon 注入实现独立编写，并没有将其整套规则复制到插件中。未使用该规则中的 GIF 背景启发式，不按任意图片、尺寸或内容关键词删除正常内容。

## HAR 207 证据与验证范围

2026-10-11 的 HAR 共 48 条请求，Origin/Referer 指向 `51cg1.com`。包含 20 条视频相关请求（4 条 m3u8、16 条 m4s），25 条图片资源请求，2 条事件追踪和 1 条分享脚本请求。

抓包没有网页 HTML 或广告卡片下发响应。图片响应不能作为普通图片直接解码，所以没有凭 GIF 后缀或资源目录推断哪些是广告，也没有拦截 `pic.gyezbp.cn` 或其中某个目录。事件追踪拦截不等于移除广告，本次也未新增追踪域名黑名单。

新增网页脚本的 URL 匹配不会命中本 HAR 中的任何请求，48 条响应均保持原样。播放列表中有 620 个媒体片段条目，未据此剪切视频；`hls.weagdnz.cn`、`mts.hhjd.mobi` 和正常图片 CDN 均保持放行。

本地样例 HTML 和 JavaScript 模拟检查通过：广告样式/贴片拦截在网站脚本前注入，延迟赋值的广告 API 被处理，原网页内容、其他 API、CSP 和 Cookie 保留，重复执行不会重复注入，其他域名/JSON/静态路径/错误状态不修改。结果见 [CG_verification_207.json](CG_verification_207.json)。这些检查不等于真实网页或手机去广告效果验证。

## 限制与排查

尚未在实际网页或用户 iPhone 上验证。网站更换广告选择器、在跨域 iframe 中展示广告、使用不同播放前 API，或严格 CSP 禁止内联脚本/样式时，可能仍有广告。现有 CSP 不会被删除；有脚本 nonce 时沿用，但样式策略可能与脚本不同。

Loon 应显示 `[51CG广告补丁] 已注入广告样式和播放前贴片拦截` 日志。没有日志时检查网页是否完整重新加载、脚本下载、MitM 或重复响应体规则；有日志也不能证明浏览器执行了注入脚本。

如仍有广告，请从重新打开原网页之前开始抓包，并保留 HTML/JS 响应正文及广告位置截图，便于用真实页面定位。当前只覆盖抓包确认的 `51cg1.com`，未自动扩展到其他吃瓜站点。
