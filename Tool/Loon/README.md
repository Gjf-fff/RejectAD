# 知乎回答页广告补丁（Loon）

原订阅地址保持不变；本次更新合并进已有插件，不需要另装一份插件。

## 安装与更新

[Zhihu.plugin 订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/Zhihu.plugin)

在 Loon 的插件页面更新该订阅，开启脚本、复写和 MitM，安装并信任 MitM 证书。插件会添加以下 HTTPS 解密主机：

`api.zhihu.com`、`zhstatic.zhihu.com`、`qh-material.taobao.com`、`adx-track.domob.cn`、`wcp.taobao.com`、`lftxali.fancyapi.com`、`rtb.julang.taobao.com`。

更新后彻底退出知乎并重新打开，再刷新原回答。已缓存的广告不会因为规则更新而立即从页面消失。

## 合并内容

### 1. 保留原来的回答间广告过滤

`Tool/Loon/JS/zhihu_ad_patch.js` 保持原样，仍只在 `api.zhihu.com/next-render` 成功 JSON 响应中移除 `data[].type === "ad"` 的独立广告项，保留其他内容及原始 `paging`。

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
- `Tool/Loon/JS/zhihu_ad_patch.js`：原回答间卡片过滤脚本。
- 知乎图标仍使用 [fmz200/wool_scripts 的图标](https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/zhihu.png)。

脚本无需 Cookie、联网请求、持久化存储或定时任务。
