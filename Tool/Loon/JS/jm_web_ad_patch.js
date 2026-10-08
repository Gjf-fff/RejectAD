/* JM 网页广告补丁 / Loon HTTP Response Script
 * Version: 1.0.0 (2026-10-08)
 * 根据 HAR 197 中的 HTML 广告容器及同源 NeverBlock/ExoLoader 回退链路编写。
 * 只处理 18comic.vip 的成功完整 HTML 响应；保留正常内容、导航、表单及验证页面。
 */
(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request !== "undefined" ? $request.url || "" : "";
    var response = typeof $response !== "undefined" ? $response : null;
    if (/^https?:\/\/(?:www\.)?18comic\.vip\//i.test(url) &&
        !/^https?:\/\/[^/]+\/(?:cdn-cgi|templates|static|ajax)(?:\/|\?|$)/i.test(url) &&
        response && Number(response.status) >= 200 && Number(response.status) < 300 &&
        typeof response.body === "string" && /<(?:!doctype\s+html|html|head|body)\b/i.test(response.body)) {
      var contentType = "";
      Object.keys(response.headers || {}).forEach(function (name) {
        if (name.toLowerCase() === "content-type") contentType = String(response.headers[name]);
      });
      if (contentType && !/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(contentType)) {
        $done(result);
        return;
      }
      var body = response.body;
      var stack = [];
      var ranges = [];
      // 跳过注释和 script/style 文本，避免将 JS 字符串里的 <div> 当成 HTML。
      var tokens = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<\/?div\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
      var token;
      function attribute(tag, name) {
        var match = new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag);
        return match ? match[1] || match[2] || match[3] || "" : "";
      }
      function hasClass(classes, name) {
        return (" " + classes.replace(/\s+/g, " ") + " ").indexOf(" " + name + " ") !== -1;
      }
      while ((token = tokens.exec(body))) {
        var tag = token[0];
        if (!/^<\/?div\b/i.test(tag)) continue;
        if (/^<\/div/i.test(tag)) {
          var node = stack.pop();
          if (node && node.remove) ranges.push({ start: node.start, end: tokens.lastIndex });
          continue;
        }
        var classes = attribute(tag, "class");
        var group = attribute(tag, "data-group");
        var isAd = hasClass(classes, "c835e-33_e_sticky2") ||
          (hasClass(classes, "c835e-33_e") && /^(?:all_albums_\d+|sticky2)$/.test(group));
        var parent = stack.length ? stack[stack.length - 1] : null;
        if (isAd && /^all_albums_\d+$/.test(group) && parent &&
            hasClass(parent.classes, "list-col") && /^\s*$/.test(body.slice(parent.openEnd, token.index))) {
          parent.remove = true;
        }
        stack.push({ start: token.index, openEnd: tokens.lastIndex, classes: classes, remove: isAd });
      }
      ranges.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
      var outer = [];
      ranges.forEach(function (range) {
        if (!outer.length || range.start >= outer[outer.length - 1].end) outer.push(range);
      });
      for (var index = outer.length - 1; index >= 0; index--) {
        body = body.slice(0, outer[index].start) + body.slice(outer[index].end);
      }
      var scriptsRemoved = 0;
      body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, function (script) {
        var opening = /^<script\b[^>]*>/i.exec(script)[0];
        var src = attribute(opening, "src");
        var adSource = /^(?:https?:)?\/\/a\.chnsrv\.com\/ad-provider\.js(?:\?|$)/i.test(src) ||
          /^(?:https?:)?\/\/campfirecroutondecorator\.com\/bn\.js(?:\?|$)/i.test(src) ||
          /^(?:(?:https?:)?\/\/(?:www\.)?18comic\.vip)?\/templates\/frontend\/airav\/js\/(?:jquery\.)?33_a1e\.js(?:\?|$)/i.test(src);
        var fallback = !src && /getexoloader/.test(script) && /ExoLoader\.(?:serve|addZone)\s*\(/.test(script);
        if (adSource || fallback) { scriptsRemoved++; return ""; }
        return script;
      });
      if (body !== response.body) {
        result = { body: body };
        console.log("[JM广告补丁] 删除 " + outer.length + " 个广告容器及 " + scriptsRemoved + " 个广告加载脚本");
      } else {
        console.log("[JM广告补丁] HTML 命中，本次未发现已知广告容器");
      }
    }
  } catch (error) {
    console.log("[JM广告补丁] 格式异常，保留原始响应");
  }
  $done(result);
})();
