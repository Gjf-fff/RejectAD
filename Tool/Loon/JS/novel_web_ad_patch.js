/* Loon: HAR 208 confirmed promotional resources on m.03banzhu.com.
 * v1.0.0 (2026-10-12). Only known ad URLs/banner fingerprints are processed.
 * This capture lacks original page HTML; device validation is still required.
 */
(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request === "object" ? $request.url || "" : "";
    var response = typeof $response === "object" && $response;
    if (!response && /^https?:\/\/g\.yfrwa\.cn\/2023\/07\/20220343877\.txt(?:\?|$)/i.test(url)) {
      // The original response is a base64 GIF string, not a normal image response.
      // Keep that format valid so the site's image decoder doesn't receive an empty body.
      $done({ response: { status: 200, headers: {
        "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }, body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" } });
      return;
    }
    var headers = response && response.headers || {};
    var type = "";
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === "content-type") type = String(headers[key]);
    });
    var body = response && response.body;
    var status = response && Number(response.status);
    if (!/^https?:\/\/m\.03banzhu\.com\//i.test(url) ||
        /^https?:\/\/[^/]+\/(?:cdn-cgi|api|ajax|static|assets)(?:\/|\?|$)/i.test(url) ||
        !(status >= 200 && status < 300) || typeof body !== "string" ||
        !/^text\/html(?:\s*;|$)/i.test(type) || !/<head\b/i.test(body) || !/<\/head\s*>/i.test(body) ||
        body.indexOf('id="loon-novel-ad-guard"') !== -1) {
      $done(result); return;
    }
    function installGuard(bannerPrefix) {
      "use strict";
      function classify(value) {
        try {
          var u = new URL(String(value), document.baseURI);
          if (!/^https?:$/.test(u.protocol)) return false;
          return (u.hostname === "www.c4jsrnirobpg.vip" && u.port === "20110" && u.pathname === "/news/decide-obscure.html") ||
            (u.hostname === "www.hm1614t.vip" && u.port === "9527" && u.pathname === "/") ||
            (u.hostname === "g.yfrwa.cn" && u.pathname === "/2023/07/20220343877.txt") ||
            (u.hostname === "www.dell.com" && u.pathname === "/community/assets/community/687062f5-603c-4f5f-ab9d-31aa7cacb376/manhua-9fac3c05-eef9-44ee-b0da-9768c33160a8-512816432.gif");
        } catch (error) { return false; }
      }
      var nativeOpen = window.open;
      window.open = function (url) {
        if (classify(url)) return null;
        return nativeOpen.apply(this, arguments);
      };
      document.addEventListener("click", function (event) {
        var node = event.target;
        if (node && node.nodeType !== 1) node = node.parentElement;
        var link = node && node.closest && node.closest("a[href]");
        if (link && classify(link.href)) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      }, true);
      function sweep() {
        document.querySelectorAll("a[href],img[src]").forEach(function (node) {
          var value = node.tagName === "A" ? node.href : node.src;
          var banner = node.tagName === "IMG" && value.indexOf("data:image/gif;base64," + bannerPrefix) === 0;
          if (!classify(value) && !banner) return;
          // Only remove the confirmed ad node or its enclosing link; retain unknown containers.
          var target = node.tagName === "IMG" ? node.closest("a") || node : node;
          target.remove();
        });
      }
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        setTimeout(function () { queued = false; sweep(); }, 0);
      }).observe(document.documentElement, {
        childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href"]
      });
      sweep();
    }
    var tokens = /<!--[\s\S]*?-->|<script\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/script\s*>|<style\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/style\s*>|<[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    var nonce = "", match;
    while ((match = tokens.exec(body))) {
      if (!/^<script\b/i.test(match[0])) continue;
      var opening = /^<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(match[0])[0];
      var n = opening.match(/\snonce\s*=\s*(["'])([A-Za-z0-9+/_=-]+)\1/i);
      if (n) { nonce = n[2]; break; }
    }
    var bannerPrefix = "R0lGODlhgALIAPf/AJat5uzo50wvHNq1mdra/OzZ/8mUdq+Xi+jGque51Le5svfM7/y56lKE/khx15JoTvfe18xprt28pFVBMP+a63FmUOvO/+3WvGhKNby3mffezWhYR+7n25aJb+vNydiqiFNPRrVLjLmqduzH";
    var patch = '<script id="loon-novel-ad-guard"' + (nonce ? ' nonce="' + nonce + '"' : "") + '>' +
      "(" + installGuard.toString() + ")(" + JSON.stringify(bannerPrefix) + ");</script>";
    var head = /<head\b[^>]*>/i.exec(body), end = /<\/head\s*>/i.exec(body);
    var inside = body.slice(head.index + head[0].length, end.index), insertAt = end.index;
    tokens.lastIndex = 0;
    while ((match = tokens.exec(inside))) {
      if (/^<script\b/i.test(match[0])) { insertAt = head.index + head[0].length + match.index; break; }
    }
    var nextHeaders = {};
    Object.keys(headers).forEach(function (key) {
      if (!/^(?:content-length|content-encoding|etag|content-md5)$/i.test(key)) nextHeaders[key] = headers[key];
    });
    result = { body: body.slice(0, insertAt) + patch + body.slice(insertAt), headers: nextHeaders };
    console.log("[小说广告补丁] 已注入已知广告节点和开窗拦截");
  } catch (error) { console.log("[小说广告补丁] 格式异常，保留原响应"); }
  $done(result);
})();
