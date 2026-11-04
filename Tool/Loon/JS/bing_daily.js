/*
 * Bing 每日签到与热点搜索 1.0.0
 * Loon 3.5.1 (983)+. Credentials stay in Loon's local persistent store.
 * HTTP success is not proof of Microsoft Rewards points being credited.
 * Protocol notes and setup: ../README_Bing.md
 */
(function () {
  "use strict";
  var VERSION = "1.0.0";
  var KEYS = {
    web: "RejectAD.Bing.Web.v1",
    auth: "RejectAD.Bing.Auth.v1",
    app: "RejectAD.Bing.App.v1",
    state: "RejectAD.Bing.State.v1",
    lock: "RejectAD.Bing.Lock.v1"
  };
  var PLATFORM = "https://prod.rewardsplatform.microsoft.com/dapi/me";
  var TOKEN_URL = "https://login.live.com/oauth20_token.srf";
  var HOT_URL = "https://top.baidu.com/board?tab=realtime";
  var INTERNAL = "bing-daily-v1";
  var MAX_SEARCHES = 30;
  var BUDGET_MS = 540000;

  function dateKey(value) {
    var d = new Date(value);
    function pad(n) { return String(n).padStart(2, "0"); }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function json(value) {
    if (typeof value !== "string" || value.length > 1500000) return null;
    try { return JSON.parse(value); } catch (_) { return null; }
  }
  function header(headers, name) {
    var key = Object.keys(headers || {}).find(function (k) { return k.toLowerCase() === name.toLowerCase(); });
    return key ? String(headers[key]) : "";
  }
  function parseForm(body) {
    var out = Object.create(null);
    String(body || "").split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i < 0) return;
      try {
        var k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, " "));
        var v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
        if (k !== "__proto__" && k !== "constructor") out[k] = v;
      } catch (_) { /* Ignore malformed form fields. */ }
    });
    return out;
  }
  function form(fields) {
    return Object.keys(fields).filter(function (k) { return fields[k] !== undefined; }).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(fields[k]);
    }).join("&");
  }
  function uuid(random) {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.floor(random() * 16);
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }
  function shuffled(values, random) {
    var result = values.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var a = result[i]; result[i] = result[j]; result[j] = a;
    }
    return result;
  }
  function parseHotWords(html) {
    var words = [];
    var marker = /<!--s-data:([\s\S]*?)-->/.exec(html || "");
    var data = marker && json(marker[1]);
    var cards = data && data.data && data.data.cards;
    if (Array.isArray(cards)) cards.forEach(function (card) {
      if (card.component !== "hotList" || !Array.isArray(card.content)) return;
      card.content.forEach(function (item) { if (!item.isAd && !item.is_ad) words.push(item.word); });
    });
    if (!words.length && /热搜|hotList/.test(html || "")) {
      var re = /"word"\s*:\s*("(?:\\.|[^"\\])*")/g;
      var match;
      while ((match = re.exec(html)) !== null && words.length < 200) words.push(json(match[1]));
    }
    var seen = Object.create(null);
    return words.filter(function (s) { return typeof s === "string"; }).map(function (s) {
      return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    }).filter(function (s) {
      if (s.length < 2 || s.length > 120 || seen[s]) return false;
      seen[s] = true; return true;
    });
  }
  function isCheckinBody(body) {
    if (!body || Number(body.amount) !== 1 || !/^(SAIOS|SAAndroid)$/.test(body.channel || "")) return false;
    if (Number(body.type) === 103) return true;
    var attrs = body.attributes || {};
    return Number(body.type) === 101 && /^Gamification_(?:Sapphire_)?DailyCheckIn$/i.test(attrs.offerid || attrs.offerId || "");
  }
  function requiresHuman(response) {
    var status = Number(response.status);
    var body = String(response.body || "");
    var location = header(response.headers, "location");
    var parsed = json(body);
    var code = parsed && parsed.error && (typeof parsed.error === "string" ? parsed.error : parsed.error.code);
    return status === 403 || status === 429 || /(?:captcha|challenge_required|interaction_required|account_?(?:locked|suspended)|toomanyrequests)/i.test(String(code || "")) ||
      /(?:login|account)\.live\.com/i.test(location) ||
      /id\s*=\s*["']b_captcha|\/turing\/captcha|<title>[^<]*(?:captcha|verify your|验证)/i.test(body);
  }
  function checkinComplete(data, now) {
    var promotions = data && data.response && data.response.promotions;
    return Array.isArray(promotions) && promotions.some(function (p) {
      var a = p.attributes || {};
      if (String(a.type).toLowerCase() !== "checkin") return false;
      var updated = Date.parse(a.last_updated || "");
      return Number.isFinite(updated) && dateKey(updated) === dateKey(now);
    });
  }
  function argumentsOf(value) {
    if (value && typeof value === "object") return value;
    return parseForm(value || "");
  }
  function optionsOf(value) {
    var a = argumentsOf(value);
    function flag(k, fallback) { return a[k] === undefined ? fallback : a[k] === true || a[k] === "true"; }
    function integer(k, fallback, min, max) {
      var n = a[k] === undefined ? fallback : Number(a[k]);
      if (!Number.isInteger(n) || n < min || n > max) throw new Error(k + " 参数应为 " + min + "～" + max + " 的整数");
      return n;
    }
    return {
      enabled: flag("enabled", true), capture: flag("captureEnabled", true),
      checkin: flag("checkInEnabled", true), search: flag("searchEnabled", true),
      notifications: flag("notifications", true),
      count: integer("searchCount", 30, 1, MAX_SEARCHES),
      interval: integer("intervalSeconds", 5, 1, 15) * 1000,
      action: a.action || "run"
    };
  }

  function createApp(io) {
    var opts = optionsOf(io.argument);
    var started = io.now();
    function log(message) { io.log("[Bing " + VERSION + "] " + message); }
    function notify(message) {
      log(message);
      if (opts.notifications) io.notify("Bing 每日任务", "", message, { openUrl: "https://rewards.bing.com/" });
    }
    function read(key, fallback) {
      var raw = io.read(key);
      if (!raw) return fallback;
      var result = json(raw);
      if (result === null) throw new Error("本地任务记录损坏，请在确认状态后清除本插件数据并重新授权");
      return result;
    }
    function write(key, value) {
      if (io.write(JSON.stringify(value), key) !== true) throw new Error("本地保存失败，已停止发送请求");
    }
    function remove(key) { io.write(undefined, key); }
    function safeHeaders(headers) {
      var out = {};
      ["User-Agent", "Accept-Language", "X-Rewards-AppId", "X-Rewards-IsMobile", "X-Rewards-Country", "X-Rewards-Language", "X-Rewards-PartnerId", "X-Rewards-Flights"].forEach(function (k) {
        var value = header(headers, k); if (value) out[k] = value;
      });
      return out;
    }
    async function http(method, url, headers, body) {
      var allowed = /^https:\/\/(?:www\.|cn\.)?bing\.com\/search\?/.test(url) ||
        url === HOT_URL || url === TOKEN_URL || url === PLATFORM + "/activities" ||
        /^https:\/\/prod\.rewardsplatform\.microsoft\.com\/dapi\/me\?channel=(?:SAIOS|SAAndroid)$/.test(url);
      if (!allowed) throw new Error("请求地址不在本插件允许范围内");
      var settings = { url: url, headers: Object.assign({}, headers, { "X-RejectAD-Internal": INTERNAL }),
        timeout: 10000, "auto-redirect": false, "auto-cookie": false, insecure: false };
      if (body !== undefined) settings.body = body;
      try { return await io.http(method, settings); }
      catch (_) { throw new Error("网络请求失败，本次请求不自动重发"); }
    }
    function capture(request, response) {
      if (!opts.capture || header(request.headers, "X-RejectAD-Internal") === INTERNAL) return;
      var url = String(request.url || "");
      var webMatch = /^https:\/\/((?:www\.|cn\.)?bing\.com)\/search(?:\?|$)/i.exec(url);
      if (webMatch && !response) {
        var cookie = header(request.headers, "Cookie");
        if (!/(?:^|;\s*)_U=[^;\s]+/.test(cookie)) return;
        var old = read(KEYS.web, null);
        write(KEYS.web, { host: webMatch[1].toLowerCase(), cookie: cookie,
          userAgent: header(request.headers, "User-Agent"), language: header(request.headers, "Accept-Language"), capturedAt: io.now() });
        if (!old) notify("已保存 Bing 网页登录信息，内容仅保存在本机。");
        return;
      }
      if (/^https:\/\/prod\.rewardsplatform\.microsoft\.com\/dapi\/me(?:\/activities)?(?:\?|$)/i.test(url) && !response) {
        var token = header(request.headers, "Authorization").replace(/^Bearer\s+/i, "").trim();
        if (!/^Bearer\s+\S+/i.test(header(request.headers, "Authorization"))) return;
        var auth = read(KEYS.auth, {});
        // Without the matching OAuth response, a new opaque token cannot be paired safely with an old refresh token.
        if (auth.accessToken !== token) write(KEYS.auth, { accessToken: token, expiresAt: 0 });
        var body = json(request.body || "");
        if (isCheckinBody(body)) {
          var first = !read(KEYS.app, null);
          write(KEYS.app, { headers: safeHeaders(request.headers), body: body });
          if (first) notify("已记录 Bing App 签到配置。取得可续期授权后可按计划自动签到。");
        }
        return;
      }
      if (/^https:\/\/login\.live\.com\/oauth20_token\.srf(?:\?|$)/i.test(url) && response && Number(response.status) === 200) {
        var fields = parseForm(request.body);
        var result = json(response.body);
        var scope = String(fields.scope || (result && result.scope) || "");
        if (!/(?:^|\s)service::prod\.rewardsplatform\.microsoft\.com::MBI_SSL(?:\s|$)/i.test(scope)) return;
        if (!result || !result.access_token || !fields.client_id || fields.client_secret) return;
        var previous = read(KEYS.auth, {});
        var sameRefresh = previous.clientId === fields.client_id && fields.grant_type === "refresh_token" && fields.refresh_token === previous.refreshToken;
        var refreshed = result.refresh_token || (sameRefresh ? previous.refreshToken : "");
        write(KEYS.auth, { accessToken: result.access_token, refreshToken: refreshed || "", clientId: fields.client_id,
          scope: scope, expiresAt: result.expires_in ? io.now() + Number(result.expires_in) * 1000 : 0 });
        if (refreshed && !previous.refreshToken) notify("已保存 Bing 可续期授权。Token 仅保存在 Loon 本机，不会上传 GitHub。");
      }
    }
    async function accessToken(force) {
      var auth = read(KEYS.auth, {});
      var expired = auth.expiresAt > 0 && auth.expiresAt <= io.now() + 60000;
      if (auth.refreshToken && auth.clientId && (force || expired || !auth.accessToken)) {
        var response = await http("post", TOKEN_URL, { "Content-Type": "application/x-www-form-urlencoded" },
          form({ client_id: auth.clientId, grant_type: "refresh_token", refresh_token: auth.refreshToken, scope: auth.scope }));
        if (requiresHuman(response)) { var stop = new Error("授权服务要求人工验证或限流，请打开 Bing App 处理后再试"); stop.stop = true; throw stop; }
        var data = json(response.body);
        if (response.status !== 200 || !data || !data.access_token) throw new Error("Bing 可续期授权已失效，请重新登录 App 获取授权");
        auth.accessToken = data.access_token;
        auth.refreshToken = data.refresh_token || auth.refreshToken;
        auth.expiresAt = data.expires_in ? io.now() + Number(data.expires_in) * 1000 : 0;
        write(KEYS.auth, auth);
      } else if (force || !auth.accessToken) throw new Error("缺少有效 App 授权，请打开 Bing App 登录并获取签到配置");
      return auth.accessToken;
    }
    async function appRequest(method, suffix, config, body) {
      var headers = Object.assign({}, config.headers, { Authorization: "Bearer " + await accessToken(false) });
      if (body !== undefined) headers["Content-Type"] = "application/json";
      var response = await http(method, PLATFORM + suffix, headers, body);
      // A 401 means the request was not authorized. Refresh once, never retry a submitted POST on a network error.
      if (Number(response.status) === 401) {
        headers.Authorization = "Bearer " + await accessToken(true);
        response = await http(method, PLATFORM + suffix, headers, body);
      }
      return response;
    }
    async function checkIn(state) {
      if (state.checkin === "confirmed") return "签到：今日已确认完成";
      var config = read(KEYS.app, null);
      if (!config || !isCheckinBody(config.body)) return "签到：尚未获取 App 签到配置";
      var path = "?channel=" + config.body.channel;
      var before = await appRequest("get", path, config);
      if (requiresHuman(before)) { state.blocked = true; throw new Error("微软要求验证或限流，今日任务已停止"); }
      if (Number(before.status) !== 200) throw new Error("App 状态查询失败（HTTP " + Number(before.status) + "）");
      if (checkinComplete(json(before.body), io.now())) {
        state.checkin = "confirmed"; write(KEYS.state, state); return "签到：今日已完成";
      }
      if (state.checkin === "submitted") return "签到：今日已提交，尚未确认成功，不重复提交";
      var payload = JSON.parse(JSON.stringify(config.body));
      if (Object.prototype.hasOwnProperty.call(payload, "id")) payload.id = uuid(io.random);
      // Never synthesize or remove the app's risk/attestation fields.
      if (payload.attributes && /^\d{8}$/.test(String(payload.attributes.date || ""))) payload.attributes.date = dateKey(io.now()).replace(/-/g, "");
      state.checkin = "submitted"; write(KEYS.state, state);
      var response = await appRequest("post", "/activities", config, JSON.stringify(payload));
      if (requiresHuman(response)) { state.blocked = true; throw new Error("微软要求验证或限流，今日任务已停止"); }
      if (Number(response.status) < 200 || Number(response.status) >= 300) throw new Error("签到请求未成功（HTTP " + Number(response.status) + "），不自动重发");
      var result = json(response.body);
      var responseData = result && result.response;
      if (!responseData) return "签到：已提交，返回结果未确认";
      var after = await appRequest("get", path, config);
      if (requiresHuman(after)) { state.blocked = true; throw new Error("微软要求验证或限流，今日任务已停止"); }
      if (Number(after.status) === 200 && checkinComplete(json(after.body), io.now())) {
        state.checkin = "confirmed"; write(KEYS.state, state); return "签到：已确认完成";
      }
      return "签到：已提交，状态暂未确认，请在 App 查看";
    }
    async function searches(state) {
      var web = read(KEYS.web, null);
      if (!web || !/^(?:www\.|cn\.)?bing\.com$/.test(web.host) || !/(?:^|;\s*)_U=[^;\s]+/.test(web.cookie || "")) return "搜索：尚未获取网页版登录 Cookie";
      if (state.attempts.length >= opts.count) return "搜索：今日已达 " + state.attempts.length + " 次请求，不重复执行";
      var response = await http("get", HOT_URL, { Accept: "text/html" });
      if (Number(response.status) !== 200) throw new Error("热点榜获取失败，未使用过期词条替代");
      var pool = parseHotWords(response.body).filter(function (word) { return !state.attempts.some(function (a) { return a.term === word; }); });
      pool = shuffled(pool, io.random).slice(0, opts.count - state.attempts.length);
      if (!pool.length) return "搜索：当天热点为空或已经搜索过";
      for (var i = 0; i < pool.length; i++) {
        if (dateKey(io.now()) !== state.date || io.now() - started > BUDGET_MS - 20000) break;
        if (i > 0) await io.wait(opts.interval);
        if (dateKey(io.now()) !== state.date || io.now() - started > BUDGET_MS - 10000) break;
        var attempt = { term: pool[i], status: "pending" };
        state.attempts.push(attempt); write(KEYS.state, state);
        var headers = { Cookie: web.cookie, Accept: "text/html", Referer: "https://" + web.host + "/" };
        if (web.userAgent) headers["User-Agent"] = web.userAgent;
        if (web.language) headers["Accept-Language"] = web.language;
        var page;
        try { page = await http("get", "https://" + web.host + "/search?q=" + encodeURIComponent(pool[i]), headers); }
        catch (error) { attempt.status = "uncertain"; write(KEYS.state, state); throw error; }
        if (requiresHuman(page) || Number(page.status) === 401 || Number(page.status) >= 300 && Number(page.status) < 400) {
          attempt.status = "blocked"; state.blocked = true; write(KEYS.state, state);
          throw new Error("Bing 要求登录、验证或限流，今日搜索已停止");
        }
        if (Number(page.status) !== 200 || !/\bid\s*=\s*["']b_results["']|\bclass\s*=\s*["'][^"']*b_algo\b/i.test(page.body || "")) {
          attempt.status = "unconfirmed"; write(KEYS.state, state);
          throw new Error("搜索页面未确认有效，已停止后续请求");
        }
        attempt.status = "http-ok"; write(KEYS.state, state);
        log("搜索请求 " + state.attempts.length + "/" + opts.count + " 返回有效页面");
      }
      var ok = state.attempts.filter(function (a) { return a.status === "http-ok"; }).length;
      return "搜索：有效页面 " + ok + "，今日请求 " + state.attempts.length + "/" + opts.count + "（不等于积分到账）";
    }
    async function run() {
      if (opts.action === "clear") {
        if (read(KEYS.lock, null) && read(KEYS.lock, null).expires > io.now()) { notify("任务正在运行，结束后再清除。"); return; }
        [KEYS.web, KEYS.auth, KEYS.app].forEach(remove);
        notify("已清除本插件登录凭据。今日搜索计数保留，避免重新授权后重复执行。"); return;
      }
      if (opts.action === "status") {
        var auth = read(KEYS.auth, {}); var status = read(KEYS.state, null);
        notify("网页版登录：" + (read(KEYS.web, null) ? "已获取" : "未获取") +
          "\nApp 签到配置：" + (read(KEYS.app, null) ? "已获取" : "未获取") +
          "\n可续期授权：" + (auth.refreshToken ? "已获取" : "未获取") +
          "\n任务记录：" + (status ? status.date + "，请求 " + status.attempts.length + " 次，签到 " + status.checkin : "暂无")); return;
      }
      if (!opts.enabled) return;
      var existing = read(KEYS.lock, null);
      if (existing && existing.expires > io.now()) { log("已有任务运行，本次跳过"); return; }
      var owner = uuid(io.random);
      write(KEYS.lock, { owner: owner, expires: io.now() + 610000 });
      try {
        var state = read(KEYS.state, null);
        if (!state || state.date !== dateKey(io.now())) state = { date: dateKey(io.now()), attempts: [], checkin: "pending", blocked: false };
        if (!Array.isArray(state.attempts) || typeof state.checkin !== "string") throw new Error("任务记录格式错误，已停止运行");
        if (state.blocked) { notify("今日曾遇到登录校验或限流，已暂停任务。请在 Bing 中检查，次日再运行。"); return; }
        write(KEYS.state, state);
        var messages = [];
        if (opts.checkin) {
          try { messages.push(await checkIn(state)); }
          catch (error) { if (error.stop) state.blocked = true; write(KEYS.state, state); messages.push("签到：" + error.message); }
        }
        if (opts.search && !state.blocked) {
          try { messages.push(await searches(state)); }
          catch (error) { write(KEYS.state, state); messages.push("搜索：" + error.message); }
        }
        notify(messages.join("\n") || "签到与搜索均已关闭。");
      } finally {
        var lock = read(KEYS.lock, null);
        if (lock && lock.owner === owner) remove(KEYS.lock);
      }
    }
    return { capture: capture, run: run, notify: notify };
  }

  var exportsForTest = { createApp: createApp, parseHotWords: parseHotWords, isCheckinBody: isCheckinBody,
    checkinComplete: checkinComplete, requiresHuman: requiresHuman, optionsOf: optionsOf,
    shuffled: shuffled, dateKey: dateKey, KEYS: KEYS, VERSION: VERSION };
  if (typeof module !== "undefined" && module.exports) { module.exports = exportsForTest; return; }

  var io = {
    argument: typeof $argument === "undefined" ? null : $argument,
    now: function () { return Date.now(); }, random: function () { return Math.random(); },
    read: function (key) { return $persistentStore.read(key); },
    write: function (value, key) { return $persistentStore.write(value, key); },
    wait: function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); },
    log: function (message) { console.log(message); },
    notify: function (title, subtitle, body, attach) { $notification.post(title, subtitle, body, attach); },
    http: function (method, options) {
      return new Promise(function (resolve, reject) {
        $httpClient[method](options, function (error, response, data) {
          if (error) reject(new Error("network"));
          else resolve({ status: Number(response.status), headers: response.headers || {}, body: typeof data === "string" ? data : "" });
        });
      });
    }
  };
  Promise.resolve().then(async function () {
    var app = createApp(io);
    if (typeof $request !== "undefined") app.capture($request, typeof $response === "undefined" ? null : $response);
    else await app.run();
  }).catch(function (error) {
    console.log("[Bing " + VERSION + "] " + error.message);
    var notifications = argumentsOf(io.argument).notifications;
    if (notifications !== false && notifications !== "false") $notification.post("Bing 每日任务", "执行中止", error.message);
  }).finally(function () { $done({}); });
})();
