/* Loon response script: stop the captured MissAV advertising popup at its source.
 * v1.0.0 (2026-10-09). Only missav.ai HTML is processed.
 * No cookies, remote requests, storage or changes to video playback.
 */
(function () {
  "use strict";
  var result = {};
  try {
    var response = typeof $response === "object" && $response;
    var url = typeof $request === "object" ? $request.url || "" : "";
    var headers = response && response.headers || {};
    var contentType = "";
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === "content-type") contentType = headers[key];
    });
    var body = response && response.body;
    var status = response && Number(response.status);
    if (!/^https?:\/\/(?:www\.)?missav\.ai\//i.test(url) ||
        !(status >= 200 && status < 300) || typeof body !== "string" ||
        !/^text\/html(?:;|$)/i.test(contentType) || !/<head\b/i.test(body) ||
        body.indexOf('id="loon-video-popup-guard"') !== -1) {
      $done(result);
      return;
    }

    // Only a standalone pop() event is disabled: mixed playback expressions stay intact.
    // Skip comments and raw-text elements so JS strings and displayed source aren't edited.
    var tokens = /<!--[\s\S]*?-->|<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<[a-z][a-z0-9:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
    var disabled = 0;
    body = body.replace(tokens, function (tag) {
      if (/^<!--|^<(?:script|style|textarea|title)\b/i.test(tag)) return tag;
      return tag.replace(/\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g,
        function (attribute) {
          var event = /^(\s+(?:@click(?:\.[\w-]+)*|x-on:click(?:\.[\w-]+)*|onclick|@keyup\.space\.window)\s*=\s*)(["'])([\s\S]*?)\2$/i.exec(attribute);
          if (!event) return attribute;
          var prefix = event[1], quote = event[2], expression = event[3];
          if (!/^\s*(?:return\s+)?(?:window\.)?pop\s*\(\s*\)\s*;?\s*$/.test(expression)) return attribute;
          disabled += 1;
          return prefix + quote + "void 0" + quote;
        });
    });

    // This function runs in the browser, not in the Loon script environment.
    function installGuard() {
      "use strict";
      var nativeOpen = window.open;
      function isAd(value) {
        try {
          var u = new URL(String(value), document.baseURI);
          var host = u.hostname.toLowerCase();
          return (/^(?:www\.)?missav\.ai$/.test(host) && /^\/pop\/?$/.test(u.pathname)) ||
            /(^|\.)(?:diffusedpassionquaking\.com|ladyoffices\.com)$/.test(host) ||
            /^(?:phoddto36box\.tc87\.top|appdw\.tjucp\.top|httpserver\.ssg01\.com)$/.test(host);
        } catch (error) { return false; }
      }
      window.open = function (url) {
        if (isAd(url)) return null;
        return nativeOpen.apply(this, arguments);
      };
      document.addEventListener("click", function (event) {
        var node = event.target;
        if (node && node.nodeType !== 1) node = node.parentElement;
        var anchor = node && node.closest && node.closest("a[href]");
        if (anchor && isAd(anchor.href)) event.preventDefault();
        // Don't stop event propagation: the player's click must still be processed.
      }, true);
    }
    // Reuse an existing nonce without removing or weakening CSP.
    var scriptTags = body.match(tokens) || [];
    var nonce = null;
    scriptTags.some(function (tag) {
      if (!/^<script\b/i.test(tag)) return false;
      nonce = tag.match(/\snonce\s*=\s*(["'])([A-Za-z0-9+/_=-]+)\1/i);
      return !!nonce;
    });
    var guard = '<script id="loon-video-popup-guard"' +
      (nonce ? ' nonce="' + nonce[2] + '"' : "") + '>' +
      "(" + installGuard.toString() + ")();</script>";
    // Preserve leading charset/CSP metadata, but run before the site's first script.
    var head = /<head\b[^>]*>/i.exec(body);
    var end = /<\/head\s*>/i.exec(body);
    if (!end) { $done(result); return; }
    var headBody = body.slice(head.index + head[0].length, end.index);
    var token;
    var insertAt = end.index;
    tokens.lastIndex = 0;
    while ((token = tokens.exec(headBody))) {
      if (/^<script\b/i.test(token[0])) {
        insertAt = head.index + head[0].length + token.index;
        break;
      }
    }
    body = body.slice(0, insertAt) + guard + body.slice(insertAt);
    var changedHeaders = {};
    Object.keys(headers).forEach(function (key) {
      if (!/^(?:content-length|content-encoding|etag|content-md5)$/i.test(key)) changedHeaders[key] = headers[key];
    });
    result = { body: body, headers: changedHeaders };
    console.log("[视频弹窗补丁] 已注入广告开窗拦截，禁用 " + disabled + " 个 pop() 事件");
  } catch (error) {
    console.log("[视频弹窗补丁] 页面格式异常，保留原响应");
  }
  $done(result);
})();
