# 广告过滤器（Loon / YouTube App）

订阅：[AdFilter.plugin](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/AdFilter.plugin)

在 Loon 添加并启用插件，开启脚本、复写和 MitM，安装并信任 MitM 证书。协议/逻辑规则需要 Loon 3.1.7+。更新或安装后彻底退出 YouTube 再重新打开。名称为“广告过滤器”，独立于现有 JM 与知乎插件。

## 处理范围

- 以二进制模式处理 `youtubei.googleapis.com/youtubei/v1/browse|next|player` 的成功 Protobuf 响应。
- `player` 只移除已知的顶层 `adPlacements`（7）和 `adSlots`（68）。播放状态、视频流、字幕及未知字段保留。
- 首页和下一页推荐只在已知列表容器中，根据明确的广告元数据字段路径或 `inline_injection_entrypoint_layout.eml` 渲染类型移除广告卡片。保留普通视频、Shorts、未知渲染器及根字段 777 模板。
- 精确处理抓包中的 `tpc.googlesyndication.com/simgad/` 广告图和 `www.youtube.com/pagead/adview` 展示通知。展示通知拦截不等于移除广告视频。
- 仅拒绝核心 API 主机的 QUIC，促使支持回退的连接改用 TCP。没有封锁 Google 视频 CDN、登录、账户、搜索建议或全部统计接口。

脚本在 Loon 本机处理，没有联网、账号转发、Cookie 读取或持久化存储。出现不支持的数据类型、解析异常、结构越界或超过 8 MiB 的响应时使用原始响应。过滤只重建发生变化的父消息长度；其余字段保留原字节，不重新编码未知字段。

## 与已有 YouTube 插件一起使用

同一响应的改写可能互相冲突。HAR 238 出现 `init-stream.maasea.workers.dev` 请求；这说明抓包环境中还有其他播放处理链，不能把本次全部行为归于本插件。安装本插件时，请停用其他匹配 YouTube `browse/next/player` 的响应脚本，再单独测试；原 JM 和知乎插件可以继续使用。

本插件不包含字幕翻译、后台播放、画中画或第三方播放代理。它不解密或重建加密的 Onesie/SABR 流，不保证覆盖服务器插入广告、所有 Shorts 广告或未来协议变更。

## HAR 244：补充新版赞助商卡片字段（2026-10-23 / 1.0.1）

本次抓包共 40 条请求，包含 4 份 browse 和 1 份 player 响应。其中 3 份 browse 各有 1 张明确标为“赞助商广告”的卡片，旧版 1.0.0 在这 3 份响应中均未识别到广告。

新路径位于原有卡片内容前缀之后：`461080918 → 55 → 7 → 8 → 1`、`491441836 → 19 → 8 → 8 → 1`。只在这些明确的徽标位置匹配完整 UTF-8 广告标识（简/繁中文“赞助商广告”“广告”、英文 Sponsored/Ad/Ads），再移除所在卡片。不会按正文中出现“广告”、整类图片布局或所有未知字段删除内容。

回放实际移除 3 张广告卡片；其他 37 条响应保留。独立解析器生成预期结果并逐字节比对，确认其余卡片、未知字段、分页相关数据及根字段 777 模板保留。播放器响应和 2 次 Google 视频 CDN 初始化连接保留。旧 HAR 238、原有播放器/推荐卡片构造用例、异常数据回退、普通内容及未知渲染器、重复执行检查通过。结果见 [AdFilter_verification_244.json](AdFilter_verification_244.json)。

本次更新脚本及下载参数至 `1.0.1`，图标与订阅地址保留。抓包仍出现 `init-stream.maasea.workers.dev` 请求且返回 404，说明有其他播放处理链；这不能证明其为广告根因。测试本插件时，请停用其他匹配 YouTube browse/next/player 的响应脚本，更新插件后彻底退出 YouTube 再打开。离线验证证明这 3 张卡片可被移除，手机显示效果及其他广告类型仍需实际验证。本次 player 没有旧版可识别的 7/68 广告槽，不能据此承诺贴片广告效果。原始 HAR、请求令牌、签名 URL、观看记录和完整响应不上传仓库。

## HAR 238 的验证与限制

抓包共 93 条记录，其中 8 条命中响应脚本范围（6 条 browse、2 条 player）。这 8 条响应没有出现本插件能够明确识别的广告槽/卡片，因此都保留原字节；其余 85 条响应也不改写。两条请求命中广告图/展示通知规则；广告图原本已返回 404。

两份播放器响应已经没有 7/68 广告槽，不能据此声称成功移除了这次实际贴片。6 条正常 googlevideo 视频/初始化连接均不匹配拦截规则。另用构造的 Protobuf 消息验证播放器广告槽与推荐广告卡片删除，并逐字节检查视频字段、字幕、普通卡片、Shorts、根模板、未知字段和非规范 Varint 保留；还检查了重复执行、截断消息及主机、路径、状态、方法、类型边界。

结果：[AdFilter_verification_238.json](AdFilter_verification_238.json)。尚未在真实 iPhone 验证播放和广告消失效果。抓包中的账号、令牌、签名播放地址、观看数据、完整响应及原始 HAR 不上传仓库。

日志前缀为 `[广告过滤器 1.0.1]`。若仍有广告，请记录广告位置和对应脚本日志，再抓取广告出现前的 player/browse 响应。

## 文件和图标

- `Tool/Loon/Plugin/AdFilter.plugin`：插件。
- `Tool/Loon/JS/youtube_ad_filter.js`：本机二进制过滤脚本。
- `Tool/Loon/Icon/AdFilter.png`：512 × 512 插件图标，从本次生成的 1254 × 1254 原图制作应用尺寸版本。

图标使用内置图片生成工具生成，并采用用户最终选择的版本。提示词：白底方形图标，橙红至深红渐变禁止圆圈；斜杠从左下至右上，在字母处断开，断口保留短平面并用小圆角顺滑衔接；居中黑色圆润粗体大写“AD”，笔画在前版基础上减细约 1/8，保持字母大小和位置，无其他文字或装饰。配色与字形风格参考 [Qure Advertising](https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Advertising.png)，断开斜杠的构图按用户提供的参考和手绘调整。

## 结构参考

字段路径核对自 [app2smile/rules](https://github.com/app2smile/rules/blob/master/js/youtube.js)（MIT）及 [Maasea/sgmodule](https://github.com/Maasea/sgmodule/blob/master/Script/Youtube/youtube.response.js)（Apache-2.0）的公开消息定义。本仓库使用独立实现的字节保留解析器，不复制上游完整功能包或它们的远程请求流程。

Loon 官方文档：[二进制脚本 API](https://nsloon.app/docs/Script/script_api/)、[脚本旧版配置](https://nsloon.app/docs/Script/)、[协议规则](https://nsloon.app/docs/Rule/protocol_rule/)。


