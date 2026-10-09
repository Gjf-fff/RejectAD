# 视频播放广告弹窗补丁（Loon）

目标是点击播放时阻止广告新标签页的创建。原 `Ruler/VideoPopup.list` 只拒绝广告网络请求，浏览器可能已经打开标签页，所以它单独使用时会留下无法加载的页面。

## 安装

在 Loon 添加并启用 [VideoPopup.plugin](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/VideoPopup.plugin)。它会自动下载脚本。确认脚本、MitM 开关开启，MitM 证书已安装并信任。

关闭原视频网页，重新打开，或重新加载整个网页后再点播放。仅在已经加载的播放器上再次点击，不会触发 HTML 修改。已打开的广告标签页也不会自动关闭。

原 `Tool/Loon/Ruler/VideoPopup.list` 可作为后备保留，不需要给原网页或 `surrit.com` 添加 REJECT。插件放在 `Plugin/`，分流规则仍在 `Ruler/`。

## 处理方式

- 仅修改 `missav.ai` 和 `www.missav.ai` 的成功 HTML 响应；不处理其他域名、JSON、JS、m3u8 和视频分片。
- 将 HTML 中独立的 `pop()` 点击处理替换为 `void 0`，保留播放器节点和其他事件。混合了播放逻辑的表达式不直接改写。
- 在网站首个脚本之前注入浏览器脚本：拦截 `window.open` 到本站 `/pop` 路径或原规则确认的广告域名；阻止广告链接的默认跳转，不阻断点击事件传播。
- 正常链接和普通开窗继续使用原浏览器行为；不会全面禁用 `window.open`，也不修改播放器的 play/pause。
- 保留 CSP。发现脚本 nonce 时沿用；严格 CSP 仍可能禁止注入脚本，此时仅 HTML 事件修改能生效。

## 证据与验证范围

2026-10-09 的原始视频 HAR 共 56 条请求，视频请求的 Origin/Referer 为 `missav.ai`，广告初始请求的 Referer 为本站 `/pop?url=…`，随后访问 `diffusedpassionquaking.com` 和 `ladyoffices.com`。HAR 没有包含原视频页面 HTML，所以不能声称已回放验证实际播放器点击。

`pop()` 点击属性的处理参考 [hlaspoor 发布的 MissAV AdBlocker 源码](https://sleazyfork.org/en/scripts/524198-missav-adblocker/code) 中的页面结构线索；本仓库实现独立编写。Loon 配置参考 [官方 Script 文档](https://nsloon.app/docs/Script/)。

本地 JavaScript 环境模拟测试检查广告开窗/广告链接被阻止、正常开窗保留、点击事件不会被停止传播、注入位于网站脚本之前、重复处理不会重复注入，以及非 HTML/其他主机/异常状态保留原响应。没有进行真实浏览器或真实播放器测试。

尚未在用户 iPhone 上验证。只覆盖已确认的广告路径和域名；动态插入的独立广告事件、先开空白页再赋值、跨域 iframe 自己开窗、新广告域名或绕过 window.open 的机制可能不在当前范围内。如仍弹窗，需从重新打开原视频页面之前开始抓包，保留 HTML/JS 响应正文以继续定位。

## 排查

Loon 应出现 `[视频弹窗补丁] 已注入广告开窗拦截` 日志。日志表示响应已改写，不能证明浏览器执行了注入脚本。没有日志时检查 MitM、脚本下载和 HTML 缓存；其他插件处理同一响应体时也可能冲突。当前只配置抓包确认的 `missav.ai`，更换站点域名时需要新增对应匹配和 MitM 主机。
