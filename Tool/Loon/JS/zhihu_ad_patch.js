/*
 * 知乎回答间广告补丁 / Loon HTTP Response Script
 * Version: 1.0.2 (2026-10-23)
 *
 * 依据用户 HAR 中知乎 iOS 11.10.0 的 /next-render 响应编写。
 * 独立广告位：data[].type === "ad"，广告内容在 adjson 内。
 * 移除独立广告项，保留正常内容及原始 paging。
 * /api/v4/videos 仅在播放列表明确含 ad_bidding(_ob) 素材时清空两套播放源。
 * 不按品牌、关键词、图片域名或 ad_info 判断正常回答是否为广告。
 * 本脚本无需联网、Cookie、持久化存储或定时任务。
 *
 * [Script]
 * http-response ^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$) script-path=https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js,requires-body=true,timeout=10,tag=知乎回答间广告补丁,enable=true
 * [Mitm]
 * hostname = api.zhihu.com,lens.zhihu.com
 */

(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request !== "undefined" ? $request.url || "" : "";
    var isLens = /^https?:\/\/lens\.zhihu\.com\/api\/v4\/videos\/\d+\/?(?:\?|$)/i.test(url);
    if (isLens && typeof $response !== "undefined" && $response) {
      var lensStatus = Number($response.status), lensBody = $response.body;
      if (lensStatus >= 200 && lensStatus < 300 && typeof lensBody === "string" && lensBody.length > 0) {
        var video = JSON.parse(lensBody);
        var adVideo = video && typeof video === "object" && !Array.isArray(video) &&
          [video.playlist, video.playlist_v2].some(function (playlist) {
            return playlist && typeof playlist === "object" && !Array.isArray(playlist) &&
              Object.keys(playlist).some(function (quality) {
                var source = playlist[quality];
                return source && typeof source.play_url === "string" &&
                  /^https?:\/\/vdn\d+\.vzuu\.com\/(?:[^/?#]+\/)?ad_bidding(?:_ob)?\//i.test(source.play_url);
              });
          });
        if (adVideo) {
          // 同一视频的备用编码仍可能是广告，不能只删带广告路径的一套播放源。
          if (Object.prototype.hasOwnProperty.call(video, "playlist")) video.playlist = {};
          if (Object.prototype.hasOwnProperty.call(video, "playlist_v2") && video.playlist_v2 !== null) video.playlist_v2 = {};
          result = { body: JSON.stringify(video) };
          console.log("[知乎广告补丁 1.0.2] /api/v4/videos 清空已确认广告视频的主/备用播放源");
        } else {
          console.log("[知乎广告补丁 1.0.2] /api/v4/videos 保留未命中广告路径的视频");
        }
      }
      return $done(result);
    }
    if (/^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$)/i.test(url) &&
        typeof $response !== "undefined" && $response) {
      var status = Number($response.status);
      console.log("[知乎广告补丁 1.0.2] /next-render 响应脚本已执行，HTTP " + status);
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
            console.log("[知乎广告补丁 1.0.2] /next-render 删除 " + removed + " 张广告卡片，保留 " + kept.length + " 条内容");
          } else {
            console.log("[知乎广告补丁 1.0.2] /next-render 命中，本次无独立广告卡片");
          }
        }
      }
    }
  } catch (error) {
    console.log("[知乎广告补丁 1.0.2] 响应格式不符合预期，保留原始响应");
  }
  // Loon 中 $done({}) 表示继续使用原始响应；不使用无参数 $done()。
  $done(result);
})();


