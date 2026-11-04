"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../JS/bing_daily.js');
const K = core.KEYS;
const scope = 'service::prod.rewardsplatform.microsoft.com::MBI_SSL';
const platform = 'https://prod.rewardsplatform.microsoft.com/dapi/me';
const tokenUrl = 'https://login.live.com/oauth20_token.srf';
const now = Date.parse('2026-11-04T01:00:00Z');
const web = {host:'www.bing.com',cookie:'_U=fixture-cookie; MUID=fixture',userAgent:'Fixture Browser',language:'zh-CN'};
const app = {headers:{'User-Agent':'Fixture Bing App','X-Rewards-AppId':'SAIOS/fixture'},body:{amount:1,type:103,channel:'SAIOS',country:'cn',attributes:{},risk_context:{},id:'old-id'}};
const hotHtml = '<!--s-data:'+JSON.stringify({data:{cards:[{component:'hotList',content:Array.from({length:50},(_,i)=>({word:'热点样本 '+i}))}]}})+'-->';
const success = body => ({status:200,headers:{},body:typeof body==='string'?body:JSON.stringify(body)});
const dashboard = checked => success({response:{promotions:[{attributes:{type:'checkin',last_updated:checked?new Date(now).toISOString():'2026-11-02T00:00:00Z'}}]}});

function harness(argument={}, initial={}, handler) {
 let clock=now, sequence=0;
 const values=new Map(Object.entries(initial).map(([k,v])=>[k,typeof v==='string'?v:JSON.stringify(v)]));
 const calls=[], messages=[], logs=[];
 const io={argument, now:()=>clock, random:()=>((++sequence*0.61803398875)%1), read:k=>values.get(k),
  write:(v,k)=>{if(v===undefined)values.delete(k);else values.set(k,v);return true;},
  wait:async ms=>{clock+=ms;}, log:s=>logs.push(s), notify:(a,b,s)=>messages.push(s),
  http:async(method,options)=>{calls.push({method,...options});return handler?handler(method,options,calls):success('<div id="b_results"></div>');}};
 return {io,values,calls,messages,logs,get:k=>JSON.parse(values.get(k)||'null'),advance:ms=>clock+=ms,app:()=>core.createApp(io)};
}

test('extracts current hot list, removes duplicates, ads and malformed words',()=>{
 const html='<!--s-data:'+JSON.stringify({data:{cards:[{component:'hotList',content:[{word:'真实热点'},{word:'真实热点'},{word:'广告',isAd:true},{word:'<b>第二条</b>'},{word:''}]}]}})+'-->';
 assert.deepEqual(core.parseHotWords(html),['真实热点','第二条']);
 assert.deepEqual(core.parseHotWords('<html>login</html>'),[]);
 assert.deepEqual(core.parseHotWords('hotList "word":"Unicode \\u4e2d\\u6587"'),['Unicode 中文']);
});
test('configuration accepts typed and legacy arguments, bounds requests and intervals',()=>{
 assert.equal(core.optionsOf(null).count,30);
 assert.equal(core.optionsOf('searchCount=5&intervalSeconds=2').interval,2000);
 for(const count of [0,31,-1,2.5,NaN])assert.throws(()=>core.optionsOf({searchCount:count}));
 assert.throws(()=>core.optionsOf({intervalSeconds:0}));
});
test('search sends 30 unique requests, then no requests on same-day rerun',async()=>{
 const h=harness({checkInEnabled:false},{[K.web]:web},async(_,o)=>o.url.includes('top.baidu.com')?success(hotHtml):success('<ol id="b_results"></ol>'));
 await h.app().run();
 const searches=h.calls.filter(c=>c.url.includes('/search?'));
 assert.equal(searches.length,30);
 assert.equal(new Set(searches.map(c=>c.url)).size,30);
 assert.equal(h.get(K.state).attempts.length,30);
 assert.equal(h.calls.find(c=>c.url.includes('top.baidu.com')).headers.Cookie,undefined);
 assert.ok(searches.every(c=>c.headers.Cookie===web.cookie&&c['auto-redirect']===false&&c.insecure===false));
 const n=h.calls.length;await h.app().run();assert.equal(h.calls.length,n);
 assert.equal(h.get(K.lock),null);
});
test('network uncertainty counts once and a later run resumes without repeating the term',async()=>{
 let fail=true;
 const h=harness({checkInEnabled:false,searchCount:3},{[K.web]:web},async(_,o)=>{
  if(o.url.includes('top.baidu.com'))return success(hotHtml);
  if(fail){fail=false;throw new Error('secret fixture-token must not appear');}
  return success('<div id="b_results"></div>');
 });
 await h.app().run();assert.equal(h.get(K.state).attempts.length,1);
 await h.app().run();assert.equal(h.get(K.state).attempts.length,3);
 assert.equal(new Set(h.calls.filter(c=>c.url.includes('/search?')).map(c=>c.url)).size,3);
 assert.ok(!h.messages.join('\n').includes('fixture-token'));
});
test('429 stops the batch and same-day reruns perform no more network requests',async()=>{
 const h=harness({checkInEnabled:false},{[K.web]:web},async(_,o)=>o.url.includes('top.baidu.com')?success(hotHtml):{status:429,headers:{},body:''});
 await h.app().run();assert.equal(h.get(K.state).attempts.length,1);assert.equal(h.get(K.state).blocked,true);
 const n=h.calls.length;await h.app().run();assert.equal(h.calls.length,n);
});
test('missing or short hot list does not invent search terms',async()=>{
 const html='hotList "word":"第一条" "word":"第二条"';
 const h=harness({checkInEnabled:false},{[K.web]:web},async(_,o)=>o.url.includes('top.baidu.com')?success(html):success('<div id="b_results"></div>'));
 await h.app().run();assert.equal(h.calls.filter(c=>c.url.includes('/search?')).length,2);
});
test('next local day creates a fresh allowance and leaves a prior block behind',async()=>{
 const h=harness({checkInEnabled:false,searchCount:2},{[K.web]:web,
  [K.state]:{date:core.dateKey(now),attempts:[{term:'previous'}],checkin:'confirmed',blocked:true}},
  async(_,o)=>o.url.includes('top.baidu.com')?success(hotHtml):success('<div id="b_results"></div>'));
 h.advance(86400000);await h.app().run();
 assert.equal(h.get(K.state).date,core.dateKey(now+86400000));
 assert.equal(h.get(K.state).blocked,false);assert.equal(h.get(K.state).attempts.length,2);
 assert.equal(h.calls.filter(c=>c.url.includes('/search?')).length,2);
});
test('anonymous Bing cookie and unrelated hosts are never captured',()=>{
 const h=harness();
 h.app().capture({url:'https://www.bing.com/search?q=x',headers:{cookie:'MUID=fixture'}},null);
 h.app().capture({url:'https://www.bing.com.attacker.invalid/search?q=x',headers:{cookie:'_U=fixture'}},null);
 assert.equal(h.get(K.web),null);
 h.app().capture({url:'https://cn.bing.com/search?q=x',headers:{cookie:'_U=fixture', 'user-agent':'Real Fixture Browser'}},null);
 assert.equal(h.get(K.web).host,'cn.bing.com');
 assert.ok(!h.messages.join().includes('_U='));
});
test('only Rewards-scoped OAuth responses are captured; unrelated tokens are ignored',()=>{
 const h=harness();
 const request={url:tokenUrl,body:'client_id=fixture-client&scope=openid&grant_type=authorization_code',headers:{}};
 h.app().capture(request,{status:200,body:JSON.stringify({access_token:'other-token',refresh_token:'other-refresh'})});
 assert.equal(h.get(K.auth),null);
 request.body='client_id=fixture-client&scope='+encodeURIComponent(scope)+'&grant_type=authorization_code';
 h.app().capture(request,{status:200,body:JSON.stringify({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600})});
 assert.equal(h.get(K.auth).refreshToken,'fixture-refresh');
 assert.ok(!h.messages.join().includes('fixture-refresh'));
});
test('new unpaired app token cannot inherit a different account refresh token',()=>{
 const h=harness({}, {[K.auth]:{accessToken:'account-a',refreshToken:'account-a-refresh',clientId:'fixture'}});
 h.app().capture({url:platform,headers:{Authorization:'Bearer account-b'}},null);
 assert.equal(h.get(K.auth).accessToken,'account-b');assert.equal(h.get(K.auth).refreshToken,undefined);
});
test('new authorization code exchange cannot inherit an old refresh token',()=>{
 const h=harness({}, {[K.auth]:{accessToken:'a',refreshToken:'refresh-a',clientId:'fixture-client'}});
 h.app().capture({url:tokenUrl,headers:{},body:'client_id=fixture-client&grant_type=authorization_code&scope='+encodeURIComponent(scope)},
  {status:200,body:JSON.stringify({access_token:'b',expires_in:3600})});
 assert.equal(h.get(K.auth).refreshToken,'');
});
test('App check-in captures only check-in activities, not article/read tasks',()=>{
 const h=harness();
 h.app().capture({url:platform+'/activities',headers:{Authorization:'Bearer fixture'},body:JSON.stringify({...app.body,type:101,attributes:{offerid:'readarticle'}})},null);
 assert.equal(h.get(K.app),null);
 h.app().capture({url:platform+'/activities',headers:{Authorization:'Bearer fixture',...app.headers},body:JSON.stringify(app.body)},null);
 assert.equal(h.get(K.app).body.type,103);
});
test('expired token refreshes once, rotation is saved, check-in success needs confirmation',async()=>{
 let checked=false;
 const h=harness({searchEnabled:false},{[K.app]:app,[K.auth]:{accessToken:'expired',refreshToken:'fixture-refresh',clientId:'fixture-client',scope,expiresAt:now-1}},async(m,o)=>{
  if(o.url===tokenUrl)return success({access_token:'fresh-access',refresh_token:'rotated-refresh',expires_in:3600});
  if(m==='post'){const data=JSON.parse(o.body);assert.equal(data.type,103);assert.equal(data.channel,'SAIOS');assert.notEqual(data.id,'old-id');checked=true;return success({response:{activity:{p:5}}});}
  assert.equal(o.headers.Authorization,'Bearer fresh-access');return dashboard(checked);
 });
 await h.app().run();
 assert.equal(h.get(K.auth).refreshToken,'rotated-refresh');assert.equal(h.get(K.state).checkin,'confirmed');
 assert.equal(h.calls.filter(c=>c.url===tokenUrl).length,1);
 const n=h.calls.length;await h.app().run();assert.equal(h.calls.length,n);
 assert.ok(!h.logs.concat(h.messages).join().includes('fresh-access'));
});
test('200 without check-in evidence remains unconfirmed and is not resubmitted',async()=>{
 const h=harness({searchEnabled:false},{[K.app]:app,[K.auth]:{accessToken:'fixture'}},async(m)=>m==='post'?success({response:{}}):dashboard(false));
 await h.app().run();await h.app().run();
 assert.equal(h.calls.filter(c=>c.method==='post').length,1);assert.equal(h.get(K.state).checkin,'submitted');
});
test('verification during token refresh prevents subsequent searches',async()=>{
 const h=harness({}, {[K.web]:web,[K.app]:app,[K.auth]:{accessToken:'expired',refreshToken:'fixture',clientId:'fixture',scope,expiresAt:now-1}},async()=>({status:403,headers:{},body:''}));
 await h.app().run();assert.equal(h.calls.length,1);assert.equal(h.get(K.state).blocked,true);
});
test('corrupt state never resets request limits, and existing lock prevents concurrency',async()=>{
 const h=harness({}, {[K.state]:'not-json'});await assert.rejects(h.app().run(),/记录损坏/);assert.equal(h.calls.length,0);
 const locked=harness({}, {[K.lock]:{owner:'other',expires:now+10000}});await locked.app().run();assert.equal(locked.calls.length,0);
});
test('clear removes this plugin credentials while retaining the daily request ledger',async()=>{
 const ledger={date:core.dateKey(now),attempts:[{term:'x'}],checkin:'pending'};
 const h=harness('action=clear',{[K.web]:web,[K.auth]:{accessToken:'fixture'},[K.app]:app,[K.state]:ledger});
 await h.app().run();assert.equal(h.get(K.web),null);assert.equal(h.get(K.auth),null);assert.deepEqual(h.get(K.state),ledger);
});
test('Loon bootstrap calls done once and passes intercepted responses through',async()=>{
 const code=fs.readFileSync(require.resolve('../JS/bing_daily.js'),'utf8');
 let done=0;const h=harness();
 vm.runInNewContext(code,{$argument:{captureEnabled:false},$request:{url:'https://www.bing.com/search?q=x',headers:{}},
  $persistentStore:{read:h.io.read,write:h.io.write},$httpClient:{},$notification:{post:()=>{}},
  $done:()=>done++,console:{log:()=>{}},setTimeout});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(done,1);
});
test('plugin variables and script URL are consistent with the published layout',()=>{
 const plugin=fs.readFileSync(require.resolve('../Plugin/Bing.plugin'),'utf8');
 const args=plugin.split('[Argument]')[1].split('[Script]')[0];
 const declared=new Set([...args.matchAll(/^(\w+)\s*=/gm)].map(m=>m[1]));
 for(const m of plugin.matchAll(/\$\{(\w+)\}/g))assert.ok(declared.has(m[1])||m[1]==='url');
 assert.ok(plugin.includes('cron ${cronExpression}'));
 assert.equal((plugin.match(/script\("https:\/\/raw\.githubusercontent\.com\/Gjf-fff\/RejectAD\/main\/Tool\/Loon\/JS\/bing_daily\.js"/g)||[]).length,7);
 assert.ok(!plugin.includes('?v='));
});
