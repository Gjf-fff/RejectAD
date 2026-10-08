# 知乎回答间广告补丁（Loon）

移除知乎回答之间的独立广告卡片，例如饿了么、游戏广告。脚本只过滤 `/next-render` 响应 `data` 数组里 `type === "ad"` 的项，保留其他内容和原始 `paging`。正常回答中出现广告相关关键词或 `ad_info` 不会导致整条内容被删除。

## 目录

与本仓库 QuanX 的目录对应：

- `Tool/Loon/JS/zhihu_ad_patch.js`：广告响应脚本。
- `Tool/Loon/Rewrite/Zhihu.plugin`：可直接订阅的 Loon 插件。

插件使用知乎图标，图标地址来自 [fmz200/wool_scripts](https://raw.githubusercontent.com/fmz200/wool_scripts/main/icons/apps/zhihu.png)。

## 安装

在 Loon 的插件页面添加下面的 URL，保存并启用：

```text
https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Rewrite/Zhihu.plugin
```

插件会自动从本仓库下载脚本，不需要把 JS 保存到本地。确认 Loon 的脚本、MitM 总开关启用，并已安装和信任 MitM 证书。插件会添加 `api.zhihu.com` 到 MitM 域名。

保存并重载配置后，重新打开知乎或刷新回答页面。

## 与可莉知乎插件配合

本补丁只处理回答间的独立广告，可继续使用可莉处理其他接口。但 Loon 的同一响应最多执行一个响应脚本；若响应 Body Rewrite 命中，响应脚本不会执行。

首次测试可临时停用可莉知乎插件。若补丁有效，之后在可莉的可编辑本地副本中关闭覆盖 `/next-render` 的重复响应脚本或响应体重写，再启用该副本，保留其他规则。也检查其他插件中覆盖该接口的宽泛正则。单纯调整排序不一定能解决 Body Rewrite 冲突。

当前安装的可莉插件文本未提供，不能确定具体冲突行。

## 日志

成功删除广告时：

```text
[知乎广告补丁] /next-render 删除 1 张广告卡片，保留 4 条内容
```

响应没有独立广告时：

```text
[知乎广告补丁] /next-render 命中，本次无独立广告卡片
```

没有日志时，检查脚本下载是否成功、MitM 是否成功，以及重复脚本或响应体重写是否冲突。已加载到页面上的旧广告需要刷新后才会重新经过补丁。

## 手动配置

已添加插件时无需重复添加以下配置。若选择手动配置，把脚本行加入已有 `[Script]` 区域，在已有 `[Mitm]` 的 hostname 列表追加 `api.zhihu.com`，保留原有域名。

```ini
[Script]
http-response ^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$) script-path=https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js,requires-body=true,timeout=10,tag=知乎回答间广告补丁,enable=true

[Mitm]
hostname = api.zhihu.com
```

脚本原文：[zhihu_ad_patch.js](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js)

## 验证和范围

基于 2026-10-08 的知乎 iOS 11.10.0 HAR 响应验证。离线回放 238 条记录，其中 3 条 `/next-render` 响应分别由 5 条变为 4、5、4 条，移除了饿了么和另一张游戏广告。所有非广告条目与原始翻页数据保持一致；无广告、非 JSON、异常状态码和其他 URL 保留原响应。

尚未在用户手机上验证。本补丁处理回答间的独立广告，不包含后台恢复开屏、正文内推广或其他接口。脚本无 Cookie、联网请求、持久化存储和定时任务。

官方说明：[脚本执行及 Rewrite 冲突关系](https://nsloon.app/docs/Script/script_v2/)。

