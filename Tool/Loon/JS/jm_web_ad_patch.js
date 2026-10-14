/* JM 网页广告补丁 / Loon HTTP Response Script
 * Version: 1.1.2 (2026-10-14)
 * 根据 HAR 197/206/208 中的广告容器及同源加载器编写。
 * 只处理 18comic.vip / jmcomic-zzz.one 的成功完整 HTML 响应；保留正常内容、导航、表单及验证页面。
 */
(function () {
  "use strict";
  var result = {};
  try {
    var url = typeof $request !== "undefined" ? $request.url || "" : "";
    var response = typeof $response !== "undefined" ? $response : null;
    if (/^https?:\/\/(?:www\.)?(?:18comic\.vip|jmcomic-zzz\.one)\//i.test(url) &&
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
      var nodes = [];
      var ranges = [];
      // 从带明确广告标记的广告位学习本页随机类名，而非固定旧哈希。
      var adFamilies = { "c835e-33_e": true };
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
          if (node) {
            node.closeStart = token.index;
            node.end = tokens.lastIndex;
            nodes.push(node);
            if (/^(?:all_albums_\d+|list\d+|sticky2)$/.test(node.group)) {
              var markup = body.slice(node.openEnd, node.closeStart);
              var labelled = /<[^>]+\bclass\s*=\s*["'][^"']*\bgroup-notice\b[^"']*["'][^>]*>\s*AD\s*</i.test(markup) ||
                /<ins\b[^>]*\bdata-zoneid\s*=/i.test(markup);
              if (labelled) node.classes.split(/\s+/).forEach(function (name) {
                if (/^[a-f0-9]{5}-\d+_[a-z0-9]+$/i.test(name)) adFamilies[name] = true;
              });
            }
          }
          continue;
        }
        var classes = attribute(tag, "class");
        var group = attribute(tag, "data-group");
        var parent = stack.length ? stack[stack.length - 1] : null;
        stack.push({ start: token.index, openEnd: tokens.lastIndex, classes: classes, group: group, parent: parent });
      }
      var familyNames = Object.keys(adFamilies);
      var adMarkup = [];
      nodes.forEach(function (node) {
        var isAd = familyNames.some(function (family) {
          return hasClass(node.classes, family + "_sticky2") ||
            (hasClass(node.classes, family) && /^(?:all_albums_\d+|list\d+|sticky2)$/.test(node.group));
        });
        if (!isAd) return;
        adMarkup.push(body.slice(node.start, node.end));
        var parent = node.parent;
        // 只删除完全由一个广告位占据的网格；混有正常内容的父节点保留。
        var grid = parent && (hasClass(parent.classes, "list-col") ||
          (hasClass(parent.classes, "col-lg-3") && hasClass(parent.classes, "col-md-3") &&
           hasClass(parent.classes, "col-sm-3") && hasClass(parent.classes, "col-xs-6")));
        if (grid && parent.end && /^\s*$/.test(body.slice(parent.openEnd, node.start)) &&
            /^\s*$/.test(body.slice(node.end, parent.closeStart))) node = parent;
        ranges.push({ start: node.start, end: node.end });
      });
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
        var adSource = /^(?:https?:)?\/\/(?:a\.chnsrv\.com|a\.magsrv\.com)\/ad-provider\.js(?:\?|$)/i.test(src) ||
          /^(?:https?:)?\/\/campfirecroutondecorator\.com\/bn\.js(?:\?|$)/i.test(src) ||
          /^(?:(?:https?:)?\/\/(?:www\.)?(?:18comic\.vip|jmcomic-zzz\.one))?\/templates\/frontend\/airav\/js\/(?:jquery\.)?(?:33_a1e|7_2dc)\.js(?:\?|$)/i.test(src);
        var fallback = !src && /getexoloader/.test(script) && /ExoLoader\.(?:serve|addZone)\s*\(/.test(script);
        // 新同源脚本只有在文件标识与已确认广告容器内的加载槽 ID 对应时才移除。
        var loader = /^(?:(?:https?:)?\/\/(?:www\.)?(?:18comic\.vip|jmcomic-zzz\.one))?\/templates\/frontend\/airav\/js\/(?:jquery\.)?(\d+_[a-f0-9]{3})\.js(?:\?|$)/i.exec(src);
        var linkedLoader = loader && adMarkup.some(function (markup) {
          return new RegExp('\\bid\\s*=\\s*["\']div_\\d*' + loader[1] + '_\\d+["\']', "i").test(markup);
        });
        // 浮动广告的专用旋转脚本会访问被删除节点，不能留下空节点异常。
        var inline = script.slice(opening.length).replace(/<\/script\s*>$/i, "");
        var rotator = !src && /^\s*var\s+lastScrollY\s*=\s*window\.scrollY\s*;/.test(inline) &&
          /function\s+handleScroll\s*\(/.test(inline) && familyNames.some(function (family) {
            return inline.indexOf(family + "_RotateIt") !== -1;
          });
        if (adSource || fallback || linkedLoader || rotator) { scriptsRemoved++; return ""; }
        return script;
      });
      if (body !== response.body) {
        result = { body: body };
        console.log("[JM广告补丁] 删除 " + outer.length + " 个广告容器及 " + scriptsRemoved + " 个广告脚本");
      } else {
        console.log("[JM广告补丁] HTML 命中，本次未发现已知广告容器");
      }
    }
  } catch (error) {
    console.log("[JM广告补丁] 格式异常，保留原始响应");
  }
  $done(result);
})();



