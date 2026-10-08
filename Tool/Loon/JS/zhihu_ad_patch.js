/*
 * 知乎回答间广告补丁 / Loon HTTP Response Script
 * Version: 1.0.0 (2026-10-08)
 *
 * 依据用户 HAR 中知乎 iOS 11.10.0 的 /next-render 响应编写。
 * 独立广告位：data[].type === "ad"，广告内容在 adjson 内。
 * 只移除独立广告项，保留正常内容及原始 paging。
 * 不按品牌、关键词、图片域名或 ad_info 判断正常回答是否为广告。
 * 本脚本无需联网、Cookie、持久化存储或定时任务。
 *
 * [Script]
 * http-response ^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$) script-path=https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js,requires-body=true,timeout=10,tag=知乎回答间广告补丁,enable=true
 * [Mitm]
 * hostname = api.zhihu.com
 */

(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request !== "undefined" ? $request.url || "" : "";
    if (/^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$)/i.test(url) &&
        typeof $response !== "undefined" && $response) {
      var status = Number($response.status);
      var body = $response.body;
      if (!(status < 200 || status >= 300) && typeof body === "string" && body.length > 0) {
        var payload = JSON.parse(body);
        if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
          var kept = payload.data.filter(function (item) {
            return !(item && typeof item === "object" && item.type === "ad");
          });
          var removed = payload.data.length - kept.length;
          if (removed > 0) {
            payload.data = kept;
            result = { body: JSON.stringify(payload) };
            console.log("[知乎广告补丁] /next-render 删除 " + removed + " 张广告卡片，保留 " + kept.length + " 条内容");
          } else {
            console.log("[知乎广告补丁] /next-render 命中，本次无独立广告卡片");
          }
        }
      }
    }
  } catch (error) {
    console.log("[知乎广告补丁] 响应格式不符合预期，保留原始响应");
  }
  // Loon 中 $done({}) 表示继续使用原始响应；不使用无参数 $done()。
  $done(result);
})();

