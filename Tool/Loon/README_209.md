# HAR 209：小说站广告轮换及自动跳转补充

更新 Loon 中现有的 [“我不是涩神”插件](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/JM.plugin)，保持复写、脚本和 MitM 开启，MitM 证书已安装并信任。小说脚本地址更新为 `novel_web_ad_patch.js?v=1.1.0`，关闭原小说网页后重新打开测试。

## 上一版遗漏与修正

HAR 209 共 101 条请求，广告横幅从 `20220343877.txt` 换成 `20220354862.txt`，仍是 `g.yfrwa.cn/2023/07/` 下的 Base64 GIF 推广素材。两份素材都确认是推广横幅，1.1.0 对这两个完整文件名返回有效透明 GIF 文本，并在原小说页面识别两份横幅指纹。未将整个目录或所有 GIF 作为广告。

新增落地页为 `www.pm1256tiger.vip:9527/`，抓到的 HTML 明确启用了推广配置，请求 Referer 指向 `m.03banzhu.com`。原有 `www.c4jsrnirobpg.vip:20110/news/decide-obscure.html` 跳转也仍有请求。

- 页面内处理：拦截已知推广地址的 `window.open` 和链接点击，清理明确推广节点，保留正常章节链接、正文及正常图片。新增落地页加入已有地址判断。
- 请求侧后备：对三个已确认推广落地页的 GET 请求，只有 Referer/Origin 明确为 `m.03banzhu.com` 时才返回 `204 No Content`。直接访问、其他来源、API 路径和 POST 保留原请求。

204 的目的是让同标签页导航保留当前文档，而不是返回一张错误页面；响应不包含正文或 Content-Length。行为依据 [MDN 204 说明](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/204) 及其引用的 HTTP 标准，尚未在用户浏览器验证。

新增 MitM 主机为 `www.pm1256tiger.vip`、`www.hm1614t.vip`、`www.c4jsrnirobpg.vip`；脚本的 URL 判断同时限定抓包中的端口和路径。没有对这些站点或下游图片/接口 CDN 做整域名 REJECT。

## 验证与限制

- 对 HAR 209 的 2 条已知推广落地导航生成 204 响应，1 条新横幅请求生成透明 GIF 文本；其余 98 条抓包响应不改写。
- GET/来源/主机/端口/路径边界，以及直接访问和普通 API 不修改，均通过模拟检查。
- 新旧横幅、推广链接和开窗的 JavaScript 模拟检查通过；正常章节链接、图片、正文和普通开窗保留。
- HAR 208 功能回归检查通过；新增后备导航处理同时覆盖其中第 20、66、73 条已确认的推广导航。

结果见 [verification_209.json](verification_209.json)。本次抓到了广告落地页 HTML，仍没抓到原小说页面 HTML，不能证明原页面使用了哪一种自动跳转调用。没有进行真实浏览器或 iPhone 导航测试。

页面脚本受缓存、严格 CSP 或重复响应体处理影响时可能未执行。请求侧 204 可处理有小说来源头的已知导航；如果原脚本已先创建新标签页，204 本身不能撤销这个新标签页，仍可能留下空白标签。无来源头、新落地地址、其他端口、跨域 iframe 或其他机制也可能不在覆盖范围内。

如仍有广告或自动跳转，请从关闭旧标签、重新打开原小说网址之前开始抓包，保留原站的 HTML/JS 响应正文及广告位置截图。原始 HAR、Cookie、用户信息、接口数据和完整页面内容不上传。
