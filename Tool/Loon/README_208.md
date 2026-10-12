# HAR 208 补充（“我不是涩神”）

在 Loon 更新现有 [JM.plugin](https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/Plugin/JM.plugin)，开启复写、脚本与 MitM，并确认 MitM 证书已安装及信任。关闭原网页并重新打开后测试。名称、图标、原 JM/MissAV/51CG 功能保持不变。

## 抓包确认的新增处理

本次 137 条请求涉及 JM 和 `m.03banzhu.com`，没有原网页 HTML 响应。

- JM 的 `/templates/frontend/airav/js/jquery.7_2dc.js` 返回完整 NeverBlock/ExoLoader 广告加载器。1.1.1 将这个确定的文件从 HTML 中移除，并添加精确请求复写作为后备，避免页面 HTML 使用缓存时它仍能加载。没有屏蔽所有 jquery 文件。
- `a.magsrv.com/ad-provider.js` 是本次出现的广告加载入口，添加精确文件复写和 JM HTML 清理；本次请求已经返回 404，不能将其计为实际广告消失的证明。
- `g.yfrwa.cn/2023/07/20220343877.txt` 返回一个 Base64 GIF 推广横幅。只替换这一个文件为有效的透明 1×1 GIF Base64 文本，保留原数据格式，避免空响应使图片解码失败。
- `www.dell.com/community/assets/community/…/manhua-…512816432.gif` 是抓包中的另一张漫画推广横幅。只对完整已确认路径返回透明图片，未屏蔽整个 Dell 网站或其他图片。
- 新增 `m.03banzhu.com` 网页脚本，移除上述已确认资源对应的图片/链接和已知跳转链接；兼顾动态插入节点。对已确认的 `www.c4jsrnirobpg.vip:20110/news/decide-obscure.html` 与 `www.hm1614t.vip:9527/` 开窗及链接点击在页面内拦截，普通小说链接、正常开窗和图片保留。

小说脚本只移除明确的广告节点或其链接，不删除无法确认的父容器，因此可能留下布局占位。只识别抓包确认的广告路径及横幅指纹；新文件、新落地页或其他开窗机制可能不在范围内。

`123876gc.mehqk5u.com` 的本次脚本只是 `console.log("ok_xm")`，没有据此将整域名认作广告。正常封面、用户头像、验证码、勋章、分享/样式资源、视频请求以及 DNS/天气服务均未添加屏蔽规则。

## 验证

- 新资源处理匹配本 HAR 的 4 条请求：2 条广告素材和 2 条广告加载入口；其余 133 条请求未匹配新增资源处理。
- 透明替代 GIF 实际解码为 1×1 并带透明索引。
- 小说网页样例与 JavaScript 模拟检查：已知广告节点及开窗被拦截，普通章节链接、图片、正文、表单和普通开窗保留；动态插入、重复处理、其他主机/路径和非成功响应检查通过。CSP 和 Cookie 保留；发现已有 nonce 时沿用。
- 重新回放 HAR 206 的全部 41 条请求并比较 HTML DOM，3 个 JM 页面仍移除原已确认广告，正常链接、图片、脚本、分页、表单和样式表保留。旧布局样例检查通过。

结果：[verification_208.json](verification_208.json)。本次 HAR 缺少原网页 HTML，没有实测原小说网页的 DOM 或真实点击。模拟通过不代表手机上的所有广告已消失；严格 CSP、缓存及跨域 iframe 可能影响注入效果。没有删除 CSP，也未注入到其他站点。

小说网页日志为 `[小说广告补丁] 已注入已知广告节点和开窗拦截`。如更新后仍有广告，请从重新打开原网页之前开始抓包，保留 HTML/JS 响应正文并附广告位置截图。原始 HAR、Cookie、浏览内容和响应正文不会上传到仓库。
