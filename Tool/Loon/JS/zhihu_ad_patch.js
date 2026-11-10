/*
 * 知乎广告补丁 / Loon HTTP Response Script
 * Version: 1.2.0 (2026-11-10)
 *
 * /next-render：依据知乎 iOS 11.10.0 HAR，删除 data[].type === "ad" 的回答间独立广告项。
 * /api/v4/videos：仅在播放列表明确含 ad_bidding(_ob) 素材时清空两套播放源。
 * /topstory/recommend：依据知乎 iOS 11.14.0 HAR 278，删除首页推荐流中的知+推广卡片。
 *   data[] 卡片：extra.promotion 非空，或 extra.business_ext_map.deliver_type === "ZPlus"。
 *   dataV1[] 卡片：unify_content.biz_ext.promotion 非空、rec.deliver_type === "ZPlus"、
 *   rec.source_type === "TS_SOURCE_EXTRA_PROMOTION"，或带 commercial_content_plugin_ad_tag 标签。
 *   HAR 279 补充：type === "feed_advert" 的第三方 DSP 广告卡片（两个列表都有）。
 *   两个列表中内容 ID 相同的卡片一起删除；付费内容、普通视频及其他字段保留。
 * /related_recommend/feed/waterfall：依据 HAR 279，删除想法/回答详情页下方推荐流中
 *   is_zplus === true 或 feedDeliveryType / content.deliver_type === "ZPlus" 的推广卡片。
 * 不按品牌、关键词、图片域名或空的 ad_info 判断正常内容是否为广告。
 * 本脚本无需联网、Cookie、持久化存储或定时任务。
 *
 * [Script]
 * http-response ^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$) script-path=https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js,requires-body=true,timeout=10,tag=知乎回答间广告补丁,enable=true
 * http-response ^https?:\/\/api\.zhihu\.com\/topstory\/recommend\/?(?:\?|$) script-path=https://raw.githubusercontent.com/Gjf-fff/RejectAD/main/Tool/Loon/JS/zhihu_ad_patch.js,requires-body=true,timeout=10,tag=知乎首页推荐流广告补丁,enable=true
 * [Mitm]
 * hostname = api.zhihu.com,lens.zhihu.com
 */

(function () {
  "use strict";
  var TAG = "[知乎广告补丁 1.2.0]";
  var result = {};

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  // 有的字段是对象，有的是 JSON 字符串；解析失败时返回 null。
  function asObject(value) {
    if (isObject(value)) return value;
    if (typeof value === "string" && value.charAt(0) === "{") {
      try {
        var parsed = JSON.parse(value);
        return isObject(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // 正常卡片的 promotion 为 null；推广卡片为非空 JSON 字符串或对象。
  function hasPromotion(value) {
    if (typeof value === "string") {
      var text = value.replace(/^\s+|\s+$/g, "");
      return text !== "" && text !== "null" && text !== "{}";
    }
    return isObject(value) && Object.keys(value).length > 0;
  }

  function addId(ids, value) {
    if ((typeof value === "string" && value !== "") || typeof value === "number") ids.push(String(value));
  }

  function cardInfo(item) {
    if (isObject(item) && item.type === "feed_advert") return { ad: true, ids: [] };
    var extra = isObject(item) && isObject(item.extra) ? item.extra : null;
    if (!extra) return { ad: false, ids: [] };
    var biz = asObject(extra.business_ext_map) || {};
    var ids = [];
    addId(ids, extra.content_id);
    addId(ids, biz.contentId);
    addId(ids, biz.contentToken);
    return { ad: hasPromotion(extra.promotion) || biz.deliver_type === "ZPlus", ids: ids };
  }

  function sduiInfo(item) {
    if (isObject(item) && item.type === "feed_advert") return { ad: true, ids: [] };
    var content = isObject(item) && isObject(item.unify_content) ? item.unify_content : null;
    if (!content) return { ad: false, ids: [] };
    var biz = asObject(content.biz_ext) || {};
    var rec = asObject(content.rec) || {};
    var scm = asObject(content.scm) || {};
    var adTag = Array.isArray(content.tags) && content.tags.some(function (tag) {
      return isObject(tag) && tag.code === "commercial_content_plugin_ad_tag";
    });
    var ids = [];
    addId(ids, scm.content_id);
    addId(ids, scm.content_token);
    return {
      ad: hasPromotion(biz.promotion) || rec.deliver_type === "ZPlus" ||
        rec.source_type === "TS_SOURCE_EXTRA_PROMOTION" || adTag,
      ids: ids
    };
  }

  function filterFeed(payload) {
    var lists = [
      { key: "data", info: cardInfo },
      { key: "dataV1", info: sduiInfo }
    ].filter(function (list) { return Array.isArray(payload[list.key]); });
    var adIds = {};
    lists.forEach(function (list) {
      list.marks = payload[list.key].map(function (item) {
        var info = list.info(item);
        if (info.ad) info.ids.forEach(function (id) { adIds[id] = true; });
        return info;
      });
    });
    var removed = 0, kept = 0;
    lists.forEach(function (list) {
      var next = payload[list.key].filter(function (item, index) {
        var info = list.marks[index];
        return !(info.ad || info.ids.some(function (id) { return adIds[id]; }));
      });
      removed += payload[list.key].length - next.length;
      kept += next.length;
      payload[list.key] = next;
    });
    return { removed: removed, kept: kept };
  }

  function isZplusWaterfallCard(item) {
    if (!isObject(item)) return false;
    var content = isObject(item.content) ? item.content : {};
    return item.is_zplus === true || item.feedDeliveryType === "ZPlus" ||
      content.is_zplus === true || content.deliver_type === "ZPlus" || content.feedDeliveryType === "ZPlus";
  }

  try {
    var url = typeof $request !== "undefined" ? $request.url || "" : "";
    var hasResponse = typeof $response !== "undefined" && $response;
    var status = hasResponse ? Number($response.status) : 0;
    var body = hasResponse ? $response.body : null;
    var okBody = status >= 200 && status < 300 && typeof body === "string" && body.length > 0;

    if (/^https?:\/\/lens\.zhihu\.com\/api\/v4\/videos\/\d+\/?(?:\?|$)/i.test(url)) {
      if (okBody) {
        var video = JSON.parse(body);
        var adVideo = isObject(video) &&
          [video.playlist, video.playlist_v2].some(function (playlist) {
            return isObject(playlist) &&
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
          console.log(TAG + " /api/v4/videos 清空已确认广告视频的主/备用播放源");
        } else {
          console.log(TAG + " /api/v4/videos 保留未命中广告路径的视频");
        }
      }
    } else if (/^https?:\/\/api\.zhihu\.com\/topstory\/recommend\/?(?:\?|$)/i.test(url)) {
      if (okBody) {
        var feed = JSON.parse(body);
        if (isObject(feed)) {
          var counts = filterFeed(feed);
          if (counts.removed > 0) {
            result = { body: JSON.stringify(feed) };
            console.log(TAG + " /topstory/recommend 删除 " + counts.removed + " 张推广卡片，保留 " + counts.kept + " 张");
          } else {
            console.log(TAG + " /topstory/recommend 命中，本次无推广卡片");
          }
        }
      }
    } else if (/^https?:\/\/api\.zhihu\.com\/related_recommend\/feed\/waterfall\/?(?:\?|$)/i.test(url)) {
      if (okBody) {
        var related = JSON.parse(body);
        if (isObject(related) && Array.isArray(related.data)) {
          var relatedKept = related.data.filter(function (item) { return !isZplusWaterfallCard(item); });
          var relatedRemoved = related.data.length - relatedKept.length;
          if (relatedRemoved > 0) {
            related.data = relatedKept;
            result = { body: JSON.stringify(related) };
            console.log(TAG + " /related_recommend 删除 " + relatedRemoved + " 张推广卡片，保留 " + relatedKept.length + " 张");
          } else {
            console.log(TAG + " /related_recommend 命中，本次无推广卡片");
          }
        }
      }
    } else if (/^https?:\/\/api\.zhihu\.com\/next-render\/?(?:\?|$)/i.test(url) && hasResponse) {
      console.log(TAG + " /next-render 响应脚本已执行，HTTP " + status);
      if (okBody) {
        var payload = JSON.parse(body);
        if (isObject(payload) && Array.isArray(payload.data)) {
          var kept = payload.data.filter(function (item) {
            return !(isObject(item) && item.type === "ad");
          });
          var removed = payload.data.length - kept.length;
          if (removed > 0) {
            payload.data = kept;
            result = { body: JSON.stringify(payload) };
            console.log(TAG + " /next-render 删除 " + removed + " 张广告卡片，保留 " + kept.length + " 条内容");
          } else {
            console.log(TAG + " /next-render 命中，本次无独立广告卡片");
          }
        }
      }
    }
  } catch (error) {
    result = {};
    console.log(TAG + " 响应格式不符合预期，保留原始响应");
  }
  // Loon 中 $done({}) 表示继续使用原始响应；不使用无参数 $done()。
  $done(result);
})();
