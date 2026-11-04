# Bing 每日签到与热点搜索（Loon）

插件默认每天按手机当前时区 **08:00** 运行。它先尝试 Bing App 每日签到，再从当天百度热搜榜随机选取 **30 个不重复热点**，逐个请求 Bing 搜索页面。执行时间、搜索数量、间隔和两个任务的开关都可以在插件参数中修改。

这是运行在手机 Loon 中的任务，GitHub 只保存代码。无需 GitHub Actions，运行时 Loon 必须保持连接和联网。

## 安装

需要 **Loon 3.5.1（983）或以上版本**，使用官方新版 Script 语法与插件参数绑定。

- [Bing.plugin 固定订阅地址](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/Bing.plugin)
- [JS 脚本](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/bing_daily.js)

在 Loon 的插件管理中通过 URL 添加上述 `.plugin` 地址。后续更新同一地址，不需要更换版本链接。

## 首次获取登录信息

网页搜索和 App 签到使用两套登录信息。**网页 Cookie 不能代替 App 签到授权**。请在两处使用同一个 Microsoft 账号，本版本按一个账号使用。

1. 启用插件的「获取登录凭据」。确认 Loon 脚本和 MitM 可用，MitM 证书已经安装并信任。
2. 用 Safari 打开 [Bing](https://www.bing.com/)，登录账号并搜索一个实际需要查询的关键词。脚本看到带 `_U` 的已登录搜索请求后，会通知已保存网页登录信息。
3. 打开 Bing App，进入 Rewards/积分页面，实际执行一次每日签到。插件只记录签到请求的配置和 Rewards 授权，不改写 App 的原始请求和响应。
4. 为了获得自动续期能力，在「获取登录凭据」开启时完成一次 Bing App 登录。仅当登录流程返回 **Rewards 专用的 Refresh Token**，且 Loon 能解密对应 OAuth 响应时，插件才保存可续期授权。无需向仓库或聊天发送 Cookie、Token、账号密码。
5. 运行「Bing查看本地状态」。确认「网页版登录」「App签到配置」「可续期授权」均已获取。然后关闭「获取登录凭据」，运行一次「Bing立即执行」检查结果。

部分 App 版本使用系统认证器、独立认证域名或不接受 MitM 的连接，插件可能无法观察到可续期授权。此时只有短期 App Token，**不能保证无人值守的跨日签到**，过期后需要通过 App 正常登录重新获取。脚本不会凭空生成 Refresh Token、伪造另一种设备或绕过证书校验。状态页面会明确显示是否取得可续期授权。

获取凭据时需要解密的主机为 `bing.com`、`www.bing.com`、`cn.bing.com`、`prod.rewardsplatform.microsoft.com`、`login.live.com`。脚本只匹配其中的搜索、Rewards 和专用 OAuth 路径，不读取登录密码或其他 OAuth scope 的令牌。任务本身使用正常 HTTPS 请求，不依赖继续抓取凭据。

## 自定义运行时间

编辑插件参数中的「每日执行时间」。填写五段 Cron，顺序是 **分、时、日、月、周**，按手机当前时区执行。

| 运行时间 | 填写内容 |
| --- | --- |
| 每天 08:00 | `0 8 * * *` |
| 每天 20:30 | `30 20 * * *` |
| 每天 09:15 | `15 9 * * *` |
| 每天 08:00 和 20:00 | `0 8,20 * * *` |

保存参数后，检查 Loon 中已启用的定时脚本及下一次执行时间。Cron 填写无效时不会触发。手机时区改变会影响实际触发时间。

每天多次触发仍共用当天计数，最多发送 30 次搜索请求。调整时间无需修改 GitHub 上的文件。关闭「启用定时任务」后，仍可手动运行「Bing立即执行」。

## 其他参数与手动入口

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| App每日签到 | 开 | 使用实际捕获的 App 签到配置与授权 |
| 每日热点搜索 | 开 | 从当天榜单随机选择未请求过的热点 |
| 搜索数量 | 30 | 可设为 1～30，同日重新运行只补足剩余请求数 |
| 搜索间隔秒数 | 5 | 固定 1～15 秒，用于控制请求频率 |
| 结果通知 | 开 | 显示签到确认状态及搜索请求数，不显示令牌 |
| Bing立即执行 | 手动入口 | 直接运行，仍受同日去重限制 |
| Bing查看本地状态 | 手动入口 | 查看凭据是否取得，以及最近任务日期和计数 |
| Bing清除本地登录凭据 | 手动入口 | 删除本插件登录信息，保留当天请求计数 |

任务最长约 9 分钟后主动收尾，Loon 配置超时为 600 秒。较长间隔或网络较慢可能使 30 个请求无法在一轮内完成，之后手动运行会补足未请求部分。网络失败而结果不明的请求也计入当天次数，不自动重复发送。

## 结果如何判断

- 签到前查询当天状态。已经完成就不重复提交。
- 签到提交后再次查询状态。只有服务端当天 `last_updated` 发生更新并能确认时，才显示「已确认完成」。HTTP 200 本身不算签到成功。结果不明时当天只查询状态，不重复提交。
- 搜索只统计返回有效 Bing 搜索页面的 HTTP 请求。Loon 的 HTTP 客户端不会像浏览器一样执行搜索页面的 JavaScript，返回页面不等于积分入账。
- 热点来自 [百度热搜实时榜](https://top.baidu.com/board?tab=realtime)。当天不足 30 条就只使用实际可取得的词条，不添加随机字符、旧词或虚构热点。
- 验证码、明确的账号验证要求或 HTTP 403/429 会停止后续微软请求，并暂停当天任务。通过 Bing 官方页面处理后，次日会使用新的任务记录。
- Cookie 或短期 Token 失效时通知重新登录。已有可续期授权时，尝试正常刷新并保存服务端返回的轮换 Refresh Token。

Microsoft Rewards 的[服务条款](https://www.microsoft.com/en-us/servicesagreement/#microsoftrewards)将符合积分资格的搜索限定为真实、手动的个人查询，排除脚本自动查询。**本插件不保证搜索积分，自动化可能不计分或受到账号限制。**

## 数据保存与接口限制

Cookie、Access Token、Refresh Token、签到配置及搜索进度保存在 Loon 本机的 `RejectAD.Bing.*.v1` 键中。日志和通知不输出完整凭据，脚本没有上传日志、远程统计或向 GitHub 写数据的功能。不要把包含登录数据的 Loon 存储导出文件发到公开仓库。

带凭据的请求限定为指定 Bing/Microsoft 地址，关闭自动重定向与自动 Cookie 复用，TLS 证书校验保持启用。向百度取得榜单时不携带 Bing 登录信息。使用实际记录的 App、地区和 User-Agent，不切换设备、代理或地区来制造额外配额。

Bing App 的 Rewards 接口不是本插件可保证长期兼容的公开签到 API。App 升级、账号区域、活动是否开放及服务端变更都可能影响签到；未取得有效配置和授权时会报告缺少配置，不伪报成功。

## 验证与源码

- 已完成 JavaScript 语法检查及 19 项无账号离线测试，覆盖同日去重、每日计数重置、请求中断续跑、429 停止、OAuth scope 限制、Refresh Token 轮换、账号令牌不混用、签到结果确认和 `$done()` 单次调用。
- 用 2026-11-04 实际取得的百度榜单页面验证，解析出 51 个不重复热点。榜单页面和实时标题不提交仓库。
- 尚未在用户 iPhone/Loon 或 Microsoft 账号上完成实际签到和计分验证，需要按首次授权步骤在设备上运行确认。

文件：

- `Tool/Loon/Plugin/Bing.plugin`
- `Tool/Loon/JS/bing_daily.js`
- `Tool/Loon/Tests/bing_daily.test.cjs`
- `Tool/Loon/README_Bing.md`

离线测试：

```sh
node --check Tool/Loon/JS/bing_daily.js
node --test Tool/Loon/Tests/bing_daily.test.cjs
```

配置和协议核对资料：

- [Loon 插件参数](https://nsloon.app/docs/Plugin/)
- [Loon Script 新版语法](https://nsloon.app/docs/Script/script_v2/)
- [Loon 脚本 API](https://nsloon.app/docs/Script/script_api/)
- [Microsoft OAuth 刷新流程说明](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow#refresh-the-access-token)
- [Bing App 签到接口结构参考](https://github.com/TheNetsky/Microsoft-Rewards-Script/blob/v5/src/rewards/app/actions/DailyCheckIn.ts)

脚本独立实现，接口结构参考不表示微软支持本插件，也不表示所有 App 版本均已验证。
