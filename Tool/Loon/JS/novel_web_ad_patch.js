/* Loon: HAR 208 confirmed promotional resources on m.03banzhu.com.
 * v1.2.0 (2026-10-12). HAR 210 confirms the original diyibanzhu.me pages and ad initializer.
 * HAR 210 contains three original page responses; device validation is still required.
 */
(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request === "object" ? $request.url || "" : "";
    var response = typeof $response === "object" && $response;
    if (!response && /^https?:\/\/g\.yfrwa\.cn\/(?:2023\/07\/(?:20220343877|20220354862)|2021\/12\/31160939776)\.txt(?:\?|$)/i.test(url)) {
      // The original response is a base64 GIF string, not a normal image response.
      // Keep that format valid so the site's image decoder doesn't receive an empty body.
      $done({ response: { status: 200, headers: {
        "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store"
      }, body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" } });
      return;
    }
    if (!response && /^https?:\/\/(?:www\.(?:pm1256tiger|hm1614t|hm1619t)\.vip:9527\/?(?:\?|$)|2\.s5825hu\.cc:8888\/?(?:\?|$)|1214gc\.x2062ys\.com:8005\/(?:cc|d)\/3876(?:\?|$)|www\.c4jsrnirobpg\.vip:20110\/news\/decide-obscure\.html(?:\?|$))/i.test(url)) {
      var fromNovel = false;
      Object.keys($request.headers || {}).forEach(function (name) {
        if (/^(?:referer|origin)$/i.test(name) && /^https?:\/\/[a-z0-9.-]*banzhu[a-z0-9.-]*(?::\d+)?(?:\/|$)/i.test(String($request.headers[name]))) fromNovel = true;
      });
      if (fromNovel && String($request.method || "GET").toUpperCase() === "GET") {
        // A 204 navigation response preserves the current document instead of loading a landing page.
        // No Content-Length, body content or redirect is returned.
        console.log("[小说广告补丁] 已取消来自小说页的已知推广导航/初始化");
        $done({ response: { status: 204, headers: { "Cache-Control": "no-store" } } });
        return;
      }
    }
    var headers = response && response.headers || {};
    var type = "";
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === "content-type") type = String(headers[key]);
    });
    var body = response && response.body;
    var status = response && Number(response.status);
    if (!/^https?:\/\/[a-z0-9.-]*banzhu[a-z0-9.-]*(?::\d+)?\//i.test(url) ||
        /^https?:\/\/[^/]+\/(?:cdn-cgi|api|ajax|static|assets)(?:\/|\?|$)/i.test(url) ||
        !(status >= 200 && status < 300) || typeof body !== "string" ||
        !/^text\/html(?:\s*;|$)/i.test(type) || !/<head\b/i.test(body) || !/<\/head\s*>/i.test(body) ||
        body.indexOf('id="loon-novel-ad-guard"') !== -1) {
      $done(result); return;
    }
    // Static cleanup runs in Loon, so these known banners don't depend on browser injection/CSP.
    var markupTokens = /<!--[\s\S]*?-->|<script\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/script\s*>|<style\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/style\s*>|<\/?(?:a|div|img)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    function attr(tag, name) {
      var m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
      return m ? m[1] || m[2] || m[3] || '' : '';
    }
    var dellAd = /^https?:\/\/www\.dell\.com\/community\/assets\/community\/687062f5-603c-4f5f-ab9d-31aa7cacb376\/manhua-9fac3c05-eef9-44ee-b0da-9768c33160a8-512816432\.gif(?:\?|$)/i;
    var anchors = [], divs = [], ranges = [], part, removedBanners = 0;
    while ((part = markupTokens.exec(body))) {
      var tag = part[0];
      if (/^<(?:script|style)\b|^<!--/i.test(tag)) continue;
      if (/^<a\b/i.test(tag)) anchors.push({start:part.index,openEnd:markupTokens.lastIndex,ad:null});
      else if (/^<\/a\b/i.test(tag)) {
        var anchor = anchors.pop();
        if (anchor && anchor.ad && /^\s*$/.test(body.slice(anchor.openEnd,anchor.ad.start)) && /^\s*$/.test(body.slice(anchor.ad.end,part.index))) ranges.push({start:anchor.start,end:markupTokens.lastIndex});
      } else if (/^<img\b/i.test(tag) && dellAd.test(attr(tag,'src'))) {
        var imageRange = {start:part.index,end:markupTokens.lastIndex};
        ranges.push(imageRange); removedBanners++;
        if (anchors.length) anchors[anchors.length-1].ad=imageRange;
      } else if (/^<div\b/i.test(tag)) divs.push({start:part.index,openEnd:markupTokens.lastIndex,classes:attr(tag,'class')});
      else if (/^<\/div\b/i.test(tag)) {
        var div=divs.pop();
        if (div && /(?:^|\s)slide-ad(?:\s|$)/.test(div.classes) && /^\s*(?:<!--[\s\S]*?-->\s*)*$/.test(body.slice(div.openEnd,part.index))) ranges.push({start:div.start,end:markupTokens.lastIndex});
      }
    }
    ranges.sort(function(a,b){return a.start-b.start || b.end-a.end;});
    var outer=[];
    ranges.forEach(function(r){if(!outer.length || r.start>=outer[outer.length-1].end)outer.push(r);});
    for(var ri=outer.length-1;ri>=0;ri--)body=body.slice(0,outer[ri].start)+body.slice(outer[ri].end);
    function installGuard(bannerPrefixes) {
      "use strict";
      function classify(value) {
        try {
          var u = new URL(String(value), document.baseURI);
          if (!/^https?:$/.test(u.protocol)) return false;
          return (u.hostname === "www.c4jsrnirobpg.vip" && u.port === "20110" && u.pathname === "/news/decide-obscure.html") ||
            (u.hostname === "www.hm1614t.vip" && u.port === "9527" && u.pathname === "/") ||
            (u.hostname === "www.hm1619t.vip" && u.port === "9527" && u.pathname === "/") ||
            (u.hostname === "2.s5825hu.cc" && u.port === "8888" && u.pathname === "/") ||
            (u.hostname === "1214gc.x2062ys.com" && u.port === "8005" && /^\/(?:cc|d)\/3876$/.test(u.pathname)) ||
            (u.hostname === "www.pm1256tiger.vip" && u.port === "9527" && u.pathname === "/") ||
            (u.hostname === "g.yfrwa.cn" && /^\/(?:2023\/07\/(?:20220343877|20220354862)|2021\/12\/31160939776)\.txt$/.test(u.pathname)) ||
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
          var banner = node.tagName === "IMG" && bannerPrefixes.some(function (prefix) {
            return value.indexOf("data:image/gif;base64," + prefix) === 0;
          });
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
    var bannerPrefixes = ["R0lGODlhgALIAPf/AJat5uzo50wvHNq1mdra/OzZ/8mUdq+Xi+jGque51Le5svfM7/y56lKE/khx15JoTvfe18xprt28pFVBMP+a63FmUOvO/+3WvGhKNby3mffezWhYR+7n25aJb+vNydiqiFNPRrVLjLmqduzH", "R0lGODlhgALIAPf/AE43I9ja10gvF/q514+RkOrq5ndkTNzi+lV55YeFZ+uSSebczbekjvv8/MdbxcrN89O9lbnH9Pbm2ahjzjcjD4il7txVvoViOdbFmsu7qoZt18m3mMishOZSumiN59K76bGciCkXCHhZNLWX", "R0lGODlhgALIANU/AKmFbuzaztW6r8url5NvWdoMBmdeX+/v7t3e3RkXG8WaYraVgo1bJ0VcwdfJu+JgX/f6/u/Mvh4LZbmxqmlCK+e2prqkkUghEO3v9vjk2t7e6/nr6pOSlPXr9suajO+Nis7OzN3OzN3WzbJ/"];
    var patch = '<script id="loon-novel-ad-guard"' + (nonce ? ' nonce="' + nonce + '"' : "") + '>' +
      "(" + installGuard.toString() + ")(" + JSON.stringify(bannerPrefixes) + ");</script>";
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
    console.log("[小说广告补丁] 已移除 " + removedBanners + " 个静态广告横幅，注入已知广告节点和开窗拦截");
  } catch (error) { console.log("[小说广告补丁] 格式异常，保留原响应"); }
  $done(result);
})();


