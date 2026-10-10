/* 51cg1.com page ad patch / Loon HTTP Response Script
 * Version: 1.0.0 (2026-10-11)
 * HAR 207 confirms the site; ad selectors and preroll API are referenced from
 * AdguardTeam/AdguardFilters ChineseFilter/sections/specific.txt.
 * The capture lacks page HTML. No image CDN, HLS or segment is blocked.
 */
(function () {
  "use strict";
  var result = {};
  try {
    var request = typeof $request === "object" && $request;
    var response = typeof $response === "object" && $response;
    var url = request && request.url || "";
    var headers = response && response.headers || {};
    var type = "";
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === "content-type") type = String(headers[key]);
    });
    var body = response && response.body;
    var status = response && Number(response.status);
    if (!/^https?:\/\/(?:www\.)?51cg1\.com\//i.test(url) ||
        /^https?:\/\/[^/]+\/(?:cdn-cgi|api|ajax|static|assets)(?:\/|\?|$)/i.test(url) ||
        !(status >= 200 && status < 300) || typeof body !== "string" ||
        !/^text\/html(?:\s*;|$)/i.test(type) ||
        !/<head\b/i.test(body) || !/<\/head\s*>/i.test(body) ||
        body.indexOf('id="loon-cg-ad-style"') !== -1) {
      $done(result);
      return;
    }
    // Install before the site's own scripts, while preserving charset and CSP metadata.
    var tokens = /<!--[\s\S]*?-->|<script\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/script\s*>|<style\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/style\s*>|<[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    var nonce = "", match;
    while ((match = tokens.exec(body))) {
      if (!/^<script\b/i.test(match[0])) continue;
      var n = /^<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(match[0])[0]
        .match(/\snonce\s*=\s*(["'])([A-Za-z0-9+/_=-]+)\1/i);
      if (n) { nonce = n[2]; break; }
    }
    function installPrerollGuard() {
      "use strict";
      var noop = function () {};
      function protect(value) {
        if (!value || (typeof value !== "object" && typeof value !== "function")) return value;
        try {
          var current = Object.getOwnPropertyDescriptor(value, "attachPreRollAd");
          if (!current || current.configurable) {
            Object.defineProperty(value, "attachPreRollAd", {
              configurable: false, enumerable: true,
              get: function () { return noop; }, set: function () {}
            });
          }
        } catch (error) {}
        return value;
      }
      try {
        var descriptor = Object.getOwnPropertyDescriptor(window, "DPLAYER_PREROLL_AD");
        var value = protect(window.DPLAYER_PREROLL_AD);
        if (!descriptor || descriptor.configurable) {
          Object.defineProperty(window, "DPLAYER_PREROLL_AD", {
            configurable: false, enumerable: true,
            get: function () { return value; },
            set: function (next) { value = protect(next); }
          });
        }
      } catch (error) {}
    }
    // Specific published ad containers only; no GIF, video, iframe or generic image filter.
    var selectors = ".post-card-ads,.horizontal-banner,#adFloat,.recommend-layer," +
      ".dplayer-pre-img,.dplayer-pre-bg,.dplayer-pre-countdown";
    var nonceAttribute = nonce ? ' nonce="' + nonce + '"' : "";
    var patch = '<style id="loon-cg-ad-style"' + nonceAttribute + '>' + selectors +
      '{display:none!important}</style><script id="loon-cg-preroll-guard"' + nonceAttribute + '>' +
      "(" + installPrerollGuard.toString() + ")();</script>";
    var head = /<head\b[^>]*>/i.exec(body);
    var end = /<\/head\s*>/i.exec(body);
    var inside = body.slice(head.index + head[0].length, end.index);
    var insertAt = end.index;
    tokens.lastIndex = 0;
    while ((match = tokens.exec(inside))) {
      if (/^<script\b/i.test(match[0])) {
        insertAt = head.index + head[0].length + match.index;
        break;
      }
    }
    body = body.slice(0, insertAt) + patch + body.slice(insertAt);
    var nextHeaders = {};
    Object.keys(headers).forEach(function (key) {
      if (!/^(?:content-length|content-encoding|etag|content-md5)$/i.test(key)) nextHeaders[key] = headers[key];
    });
    result = { body: body, headers: nextHeaders };
    console.log("[51CG广告补丁] 已注入广告样式和播放前贴片拦截");
  } catch (error) {
    console.log("[51CG广告补丁] 页面格式异常，保留原响应");
  }
  $done(result);
})();
