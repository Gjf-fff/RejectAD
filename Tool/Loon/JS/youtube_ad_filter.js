/* 广告过滤器 / Loon YouTube Protobuf response filter
 * Version 1.0.0 (2026-10-19). No network, credentials or persistent storage.
 * Wire schemas cross-checked against app2smile/rules (MIT) and
 * Maasea/sgmodule (Apache-2.0); independently implemented wire preservation.
 * Only known ad fields/cards are removed. Unknown fields stay byte-identical.
 */
(function () {
  "use strict";
  var result = {}, removed = 0, visited = 0;
  try {
    var request = typeof $request === "undefined" ? null : $request;
    var response = typeof $response === "undefined" ? null : $response;
    var match = request && /^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|player)(?:\?|$)/i.exec(request.url || "");
    if (!match || request.method !== "POST" || !response || Number(response.status) !== 200) return $done(result);
    var bytes = response.body;
    if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > 8388608) return $done(result);
    var mime = "";
    Object.keys(response.headers || {}).forEach(function (key) {
      if (key.toLowerCase() === "content-type") mime = String(response.headers[key]);
    });
    if (!/^application\/(?:x-protobuf|protobuf|octet-stream)(?:\s*;|$)/i.test(mime)) return $done(result);

    function uint32(data, state) {
      var value = 0, factor = 1;
      for (var i = 0; i < 5; i++) {
        if (state.pos >= data.length) throw new Error("truncated varint");
        var b = data[state.pos++]; value += (b & 127) * factor;
        if (value > 4294967295) throw new Error("uint32 overflow");
        if (b < 128) return value;
        factor *= 128;
      }
      throw new Error("invalid uint32");
    }
    function parse(data) {
      var state = { pos: 0 }, fields = [];
      while (state.pos < data.length) {
        if (++visited > 250000) throw new Error("field budget");
        var start = state.pos, tag = uint32(data, state), number = Math.floor(tag / 8), wire = tag % 8;
        if (number === 0 || number > 536870911) throw new Error("invalid field");
        var dataStart = state.pos;
        if (wire === 0) {
          var ended = false;
          for (var i = 0; i < 10; i++) {
            if (state.pos >= data.length) throw new Error("truncated integer");
            var b = data[state.pos++];
            if (i === 9 && b > 1) throw new Error("uint64 overflow");
            if (b < 128) { ended = true; break; }
          }
          if (!ended) throw new Error("invalid integer");
        } else if (wire === 1) state.pos += 8;
        else if (wire === 5) state.pos += 4;
        else if (wire === 2) { var size = uint32(data, state); dataStart = state.pos; state.pos += size; }
        else throw new Error("unsupported wire type");
        if (state.pos > data.length) throw new Error("truncated field");
        fields.push({ number: number, wire: wire, raw: data.subarray(start, state.pos), data: wire === 2 ? data.subarray(dataStart, state.pos) : null });
      }
      return fields;
    }
    function encode(value) {
      var out = [];
      do { var b = value % 128; value = Math.floor(value / 128); out.push(b + (value ? 128 : 0)); } while (value);
      return new Uint8Array(out);
    }
    function join(parts) {
      var size = 0; parts.forEach(function (p) { size += p.length; });
      var out = new Uint8Array(size), offset = 0;
      parts.forEach(function (p) { out.set(p, offset); offset += p.length; }); return out;
    }
    function pathValues(data, path) {
      var current = [data];
      path.forEach(function (number) {
        var next = [];
        current.forEach(function (message) {
          parse(message).forEach(function (field) { if (field.number === number && field.wire === 2) next.push(field.data); });
        });
        current = next;
      });
      return current;
    }
    var contentPrefix = [153515154, 172660663, 1, 168777401, 5];
    var adLabels = [
      [454362329,8,4,2], [224457493,2,3], [461080918,7,4,2],
      [472329933,7,4,2], [478840678,7,4,2], [224590612,2,3],
      [224590612,2,9], [394770629,8,4,2], [491441836,8,4,2],
      [232954548,19,3], [456430508,7,4,2]
    ];
    function isAdCard(data) {
      var contents = pathValues(data, contentPrefix);
      for (var i = 0; i < contents.length; i++) {
        for (var j = 0; j < adLabels.length; j++) {
          if (pathValues(contents[i], adLabels[j]).some(function (value) { return value.length > 0; })) return true;
        }
      }
      if (pathValues(data, [166487981,1,83537025,3,83784541,1,1,2]).some(function (value) { return value.length > 0; })) return true;
      return pathValues(data, [153515154,172660663,2,183314536,1]).some(function (value) {
        var prefix = "inline_injection_entrypoint_layout.eml";
        if (value.length < prefix.length) return false;
        for (var n = 0; n < prefix.length; n++) if (value[n] !== prefix.charCodeAt(n)) return false;
        return value.length === prefix.length || [45,58,124].indexOf(value[prefix.length]) >= 0;
      });
    }
    var schema = {
      browse: {9:"content",10:"content"}, next: {7:"nextContent",8:"content"},
      nextContent: {51779735:"nextResult"}, nextResult: {1:"content"},
      content: {58173949:"single",49399797:"sections"}, single: {1:"tab"},
      tab: {58174010:"tabRenderer"}, tabRenderer: {4:"content"},
      sections: {1:"section"}, section: {50195462:"items",51845067:"shelf"},
      shelf: {5:"richSection"}, richSection: {51431404:"reels"}
    };
    function transform(data, type, depth) {
      if (depth > 20) throw new Error("depth budget");
      var fields = parse(data), changed = false, parts = [];
      fields.forEach(function (field) {
        if (type === "player" && field.wire === 2 && (field.number === 7 || field.number === 68)) {
          removed++; changed = true; return;
        }
        if ((type === "items" || type === "reels") && field.number === 1 && field.wire === 2) {
          if (isAdCard(field.data)) { removed++; changed = true; return; }
        }
        var childType = schema[type] && schema[type][field.number];
        if (childType && field.wire === 2) {
          var child = transform(field.data, childType, depth + 1);
          if (child !== field.data) {
            changed = true; parts.push(encode(field.number * 8 + 2), encode(child.length), child); return;
          }
        }
        parts.push(field.raw);
      });
      return changed ? join(parts) : data;
    }
    var filtered = transform(bytes, match[1].toLowerCase(), 0);
    if (filtered !== bytes) result = { body: filtered };
    console.log("[广告过滤器 1.0.0] " + match[1] + " 移除 " + removed + " 个已知广告槽/卡片");
  } catch (error) {
    console.log("[广告过滤器 1.0.0] 无法安全解析，保留原响应");
  }
  $done(result);
})();
