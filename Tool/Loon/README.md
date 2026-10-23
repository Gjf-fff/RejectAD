# 知乎回答页广告补丁（Loon）

原订阅地址保持不变；本次更新合并进已有插件，不需要另装一份插件。

## 安装与更新

[Zhihu.plugin 订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/Zhihu.plugin)

在 Loon 的插件页面更新该订阅，开启脚本、复写和 MitM，安装并信任 MitM 证书。插件会添加以下 HTTPS 解密主机：

`lens.zhihu.com`、`*.vzuu.com`、`sugar.zhihu.com`、`api.zhihu.com`、`zhstatic.zhihu.com`、`qh-material.taobao.com`、`adx-track.domob.cn`、`wcp.taobao.com`、`lftxali.fancyapi.com`、`rtb.julang.taobao.com`。

更新后彻底退出知乎并重新打开，再刷新原回答。已缓存的广告不会因为规则更新而立即从页面消失。

## HAR 243：广告视频及备用播放源修复（2026-10-23 / 1.0.2）

本次抓包为知乎，共 144 条请求。6 次成功的 206 视频请求使用 `vdn3.vzuu.com/HD/ad_bidding/` 或 `/HD/ad_bidding_ob/` 广告素材目录；3 份 `lens.zhihu.com/api/v4/videos/<数字ID>` 响应返回这些广告的播放列表，其中 2 份还返回不带广告目录的 `playlist_v2` 备用编码。旧规则没有覆盖这两个入口。

本次合并两项处理：

- 仅拒绝 `vdn<数字>.vzuu.com` 主机下 `ad_bidding`、`ad_bidding_ob` 完整目录的视频请求，不按整个视频域名拒绝。
- 对 `lens.zhihu.com/api/v4/videos/<数字ID>` 的成功 JSON 响应，仅当 `playlist` 或 `playlist_v2` 的 `play_url` 明确命中上述广告目录时，清空同一视频的两套播放列表。备用编码可能没有广告路径，但仍属于同一条已确认的广告视频。封面、标题及其他字段保留；未命中广告目录的视频保留原响应。

新增常驻解密 `lens.zhihu.com`、`*.vzuu.com`，分别用于播放源响应处理和媒体 URL 路径复写。通配解密覆盖视频 CDN 的主机变化，并不表示拒绝全部视频。其他现有规则、图标和订阅地址保留，脚本版本及下载参数更新至 `1.0.2`。

离线回放结果：3 份广告视频响应清空主/备用播放源，6 次广告视频请求匹配新增拒绝规则；2 次普通视频请求和 9 份正常/付费回答响应保留。旧 HAR 230 的 3 份回答广告卡片过滤结果保留，并额外识别 1 份同类广告视频；HAR 233 的响应仍全部保留。普通视频、域名/路径边界、异常 JSON、失败状态和重复执行检查通过。结果见 [Zhihu_verification_243.json](Zhihu_verification_243.json)。

更新同一插件后，确认 MitM 证书已安装并信任，彻底退出知乎再打开；若仍播放旧广告，可清理知乎缓存后重试。新日志包含 `[知乎广告补丁 1.0.2] /api/v4/videos 清空已确认广告视频的主/备用播放源`。本次抓包没有 `/next-render` 或开屏广告下发响应，不能据此确认所有广告卡片或开屏广告已消失；已缓存素材和页面占位仍需手机验证。原始 HAR、签名播放地址、视频数据、回答正文和个人标识不上传仓库。

## HAR 233：关闭抓包后广告恢复的传输排查（2026-10-18）

HAR 233 共 184 条请求，未捕获 `api.zhihu.com` 或 `/next-render`；12 条 `page-info.zhihu.com` 请求是正常回答/文章响应。多条广告素材和曝光请求已经返回 404，不能将这些状态当作广告卡片已被清理的证明。与此前 HAR 230 能抓到 5 条 `/next-render` 响应的情况不同，本次无法判断核心 API 是走其他传输、使用缓存，还是未被当前记录范围捕获；未证实 QUIC 是原因。

增加仅针对 `api.zhihu.com` 的传输排查规则：

```text
AND,((DOMAIN,api.zhihu.com),(PROTOCOL,QUIC)),REJECT
```

这条规则只拒绝该主机的 QUIC，目的是促使支持回退的连接改走 TCP，使现有 HTTPS 解密和响应脚本有机会生效。需要 Loon 3.1.7+，语法依据 [协议规则](https://nsloon.app/docs/Rule/protocol_rule/) 和 [逻辑规则](https://nsloon.app/docs/Rule/logic_rule/)；插件规则可能被更高优先级的本地规则覆盖。它不是已被本次 HAR 验证的根因修复；没有在手机上验证协议回退。若新增规则导致核心 API 无法加载，可暂时停用这一条规则。

脚本更新为 1.0.1，订阅使用 `?v=1.0.1` 以刷新脚本下载，并增加执行日志：

```text
[知乎广告补丁 1.0.1] /next-render 响应脚本已执行，HTTP 200
```

广告识别与删除逻辑、复写、MitM 主机、名称、图标均保留。HAR 230 回放仍在 3 条响应中各移除 1 个独立广告项，正常内容和 paging 保留；HAR 233 全部 184 条响应不被脚本修改。两份抓包的过滤输出与 1.0.0 完全一致。没有给缺少广告卡片字段的正常回答接口增加内容删改，也没有继续堆叠已返回 404 的曝光拦截。

更新同一个插件，关闭抓包后彻底退出知乎并重连 Loon，再打开知乎验证。若仍有广告，先查看是否出现上述版本日志：没有日志时需继续检查连接传输、解密和规则优先级；有日志但仍显示广告时，需要对应广告的接口响应。无需持续开抓包使用。原始 HAR、回答正文、请求参数和个人标识不上传仓库。

## 2026-10-18：补充常驻 MitM 域名

根据 HAR 230，补充 `sugar.zhihu.com`，对应抓包中的 12 条 `/plutus_adreaper` 广告相关请求。此前插件已有的 7 个主机已经完整覆盖现有脚本和 URL 复写规则，没有发现这些规则本身缺少解密主机。

本次仅扩充 MitM 范围，脚本、复写规则、插件名称及图标均保留。`sugar.zhihu.com` 暂未新增拒绝规则，单独解密并不等于拦截广告。没有把正常知乎图片 CDN、视频、登录、推送、DNS 或所有第三方广告曝光主机统一纳入解密。

已检查全部现有规则主机都在解密列表内、原列表无删除/重复，且新主机在抓包中实际出现。用户已反馈广告处理有效，本次不调整过滤逻辑；关闭抓包后是否保持同样效果仍需手机验证。

更新同一个插件后，保持 MitM、复写、脚本开启，关闭抓包并彻底退出知乎后重开测试；主配置中若对相关主机设有解密排除，也需要核对。原始 HAR、请求参数、Cookie 和个人浏览数据不上传仓库。

## 合并内容

### 1. 保留原来的回答间广告过滤

回答间卡片过滤保留：在 `api.zhihu.com/next-render` 成功 JSON 响应中移除 `data[].type === "ad"` 的独立广告项，保留其他内容及原始 `paging`。

不会根据正文中的品牌、广告关键词或 `ad_info` 删除正常回答。日志沿用“[知乎广告补丁] /next-render 删除 … 张广告卡片”。

### 2. 回答底部商业广告入口

对 `api.zhihu.com/commercial_api/answer/<数字ID>/bottom-v2` 返回空 JSON 对象。

这是公开规则中已有的回答底部广告接口，参考 [blackmatrix7 的 Loon 规则](https://github.com/blackmatrix7/ios_rule_script/blob/master/rewrite/Loon/AllInOne/AllInOne.plugin)。本次抓包没有捕获该接口，因此它对当前知乎版本的实际效果仍需要手机验证；不能把它计入本次 HAR 的命中结果。

未屏蔽整个 `commercial_api`，也未屏蔽回答相关推荐接口。

### 3. 本次抓包确认的广告资源和通知

| 主机 | 限定路径 | 处理 |
| --- | --- | --- |
| zhstatic.zhihu.com | /brand-ad/image/ | 拒绝品牌广告资源 |
| qh-material.taobao.com | /auto/aigc/pic/AI_FLOW_PIC_… 图片 | 返回透明小图 |
| adx-track.domob.cn | /imp | 返回空响应 |
| wcp.taobao.com | /adstrack/track.json | 返回空响应 |
| lftxali.fancyapi.com | /win | 返回空响应 |
| rtb.julang.taobao.com | /dsp/surge/winNotice/ADX_YIZHUN | 返回空响应 |

这些是插件中的 URL 复写，不是整域名分流黑名单，因此合并在 `Tool/Loon/Plugin/Zhihu.plugin` 内。每条规则都有主机和路径边界；但其他 App 如果请求相同广告路径，也会被拦截。

## 本次抓包的证据与限制

2026-10-09 的抓包共 77 条请求。广告通知中含有知乎 App 标识，页面行为日志出现 `AD_ZHI_PLUS` 和 `BOTTOM_ZHI_PLUS`；这些是广告展示信号，不是可以直接删去广告的接口响应。

抓到的 `page-info.zhihu.com/answers/v2/<ID>` 是正常回答数据：包含 5 段文字、2 张正文图片和正常互动信息，没有明确的广告卡片字段，因此保持原响应，不对它做递归删字段或内容过滤。

新增素材/通知规则离线匹配 6 条请求，其余 71 条请求均未匹配。6 条中原本已有 4 条返回 404、1 条状态为 0，仅 1 条返回 200；因此“规则命中 6 条”不能证明页面广告已消失。缺少广告卡片下发响应，素材屏蔽后仍可能留下广告文字、按钮或空白占位，曝光通知屏蔽也不等于卡片移除。

若更新后回答内仍有广告，请从彻底退出知乎后重新启动开始抓包，进入有广告的回答后导出，保留 HTTPS 响应正文，并附广告位置截图。这样才能继续定位卡片下发接口。

## 验证记录

- 旧版记录：2026-10-08 的 HAR 中 3 条 `/next-render` 响应移除了独立广告。此次未重新回放旧 HAR，原脚本字节保持不变。
- 本次：回放 77 条请求检查 URL 匹配；正常回答正文、正文图片和其他接口未匹配新增复写。
- 用正常回答、独立广告、`ad_info`、分页数据、无广告、异常 JSON、失败状态和不相关 URL 检查原脚本行为。
- 尚未在用户手机上验证，也不宣称已彻底移除回答页面的所有广告。

## 与其他插件一起使用

Loon 同一响应最多执行一个响应脚本；命中响应体 Rewrite 时，响应脚本可能不执行。若另一个插件也处理 `/next-render`，应关闭重复规则后测试；单纯改排序不一定能解决冲突。新增请求侧复写与原来的响应脚本处理不同接口。

没有旧脚本日志时，检查脚本下载、MitM 及重复响应处理；新增复写的命中情况看 Loon 请求记录，不会出现在旧脚本的卡片删除日志里。

官方说明：[复写](https://nsloon.app/docs/Rewrite/)、[脚本执行规则](https://nsloon.app/docs/Script/script_v2/)。

## 文件

- `Tool/Loon/Plugin/Zhihu.plugin`：合并插件。
- `Tool/Loon/JS/zhihu_ad_patch.js`：回答间卡片及广告视频播放源过滤脚本。
- 知乎图标仍使用 [fmz200/wool_scripts 的图标](https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/zhihu.png)。

脚本无需 Cookie、联网请求、持久化存储或定时任务。

