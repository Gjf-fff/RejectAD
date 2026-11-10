"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../JS/zhihu_ad_patch.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../Plugin/Zhihu.plugin'), 'utf8');
const FEED = 'https://api.zhihu.com/topstory/recommend?action=down&ad_interval=3&after_id=17';

function run(url, response) {
 let done;
 vm.runInNewContext(source, {$request:{url}, $response:response, $done:r=>{done=r;}, console:{log(){}}});
 return JSON.parse(JSON.stringify(done));
}
const ok = body => ({status:200, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});

// 结构按 HAR 278 简化：data 为 ComponentCard，dataV1 为 sdui 卡片；不含真实内容。
function card(id, extra) {
 return {id:'1919415961875870742', type:'ComponentCard', children:[{type:'Text'}],
  extra:Object.assign({content_id:id, content_type:'answer', promotion:null,
   business_ext_map:{contentId:'n' + id, contentToken:id, deliver_type:'Normal'}}, extra)};
}
function sdui(id, rec, more) {
 return {type:'sdui', match_template_key:'test', unify_content:Object.assign({
  scm:{content_id:'n' + id, content_token:id, content_type:'ANSWER'},
  biz_ext:{feed_request_id:'r', preload:true}, rec:Object.assign({deliver_type:'Normal', source_type:'TS_SOURCE_X'}, rec),
  tags:[{code:'theme', value:'x'}]}, more)};
}
const promo = JSON.stringify({is_card:true, id:'pv', parameters:'plugcb=https%3A%2F%2Fsugar.zhihu.com%2Fplutus_adreaper_callback%3Fadsource%3Dzhi_plus'});
function feed() {
 return {
  dataV1:[sdui('1'), sdui('2', {deliver_type:'ZPlus', source_type:'TS_SOURCE_EXTRA_PROMOTION'}, {biz_ext:{promotion:promo}}), sdui('3', {deliver_type:'Paid'})],
  data:[card('1'), card('2', {promotion:promo, content_type:'pin', business_ext_map:{contentId:'n2', contentToken:'2', deliver_type:'ZPlus'}}), card('3', {business_ext_map:{contentId:'n3', contentToken:'3', deliver_type:'Paid'}})],
  styles:[], feed_request_id:'r', fresh_text:'', paging:{is_end:false, next:'https://api.zhihu.com/topstory/recommend?ad_interval=-10'}, extra:{is_hit_new14_limit:false}
 };
}

test('feed: ZPlus promotion card removed from data and dataV1, everything else kept', () => {
 const input = feed();
 const out = JSON.parse(run(FEED, ok(input)).body);
 assert.deepEqual(out.data.map(x => x.extra.content_id), ['1', '3']);
 assert.deepEqual(out.dataV1.map(x => x.unify_content.scm.content_token), ['1', '3']);
 for (const k of ['styles', 'feed_request_id', 'fresh_text', 'paging', 'extra']) assert.deepEqual(out[k], input[k]);
 assert.deepEqual(out.data[0], input.data[0]);
 assert.deepEqual(out.dataV1[1], input.dataV1[2], 'paid content is not treated as an ad');
});

test('feed: each marker works on its own, and ids link the two lists', () => {
 const onlyPromotion = feed(); onlyPromotion.data[1].extra.business_ext_map.deliver_type = 'Normal';
 onlyPromotion.dataV1.splice(1, 1);
 assert.deepEqual(JSON.parse(run(FEED, ok(onlyPromotion)).body).data.map(x => x.extra.content_id), ['1', '3']);

 const stringBiz = feed(); stringBiz.data[1].extra.promotion = null;
 stringBiz.data[1].extra.business_ext_map = JSON.stringify({contentToken:'2', deliver_type:'ZPlus'});
 assert.deepEqual(JSON.parse(run(FEED, ok(stringBiz)).body).data.map(x => x.extra.content_id), ['1', '3']);

 const tagOnly = feed(); tagOnly.data.splice(1, 1);
 tagOnly.dataV1[1] = sdui('2', {}, {tags:[{code:'commercial_content_plugin_ad_tag', value:'广告'}]});
 assert.equal(JSON.parse(run(FEED, ok(tagOnly)).body).dataV1.length, 2);

 const linked = feed(); linked.data[1] = card('2');
 const out = JSON.parse(run(FEED, ok(linked)).body);
 assert.deepEqual(out.data.map(x => x.extra.content_id), ['1', '3'], 'unmarked twin of a marked sdui ad is removed too');
});

test('feed: clean, empty, failed and malformed responses are passed through untouched', () => {
 const clean = feed(); clean.data.splice(1, 1); clean.dataV1.splice(1, 1);
 for (const v of [null, '', 'null', '{}', {}]) {
  const f = feed(); f.data = [card('9', {promotion:v})]; f.dataV1 = [];
  assert.deepEqual(run(FEED, ok(f)), {}, 'promotion=' + JSON.stringify(v));
 }
 assert.deepEqual(run(FEED, ok(clean)), {});
 assert.deepEqual(run(FEED, ok({dataV1:[], data:[], paging:{}})), {});
 assert.deepEqual(run(FEED, {status:500, headers:{}, body:JSON.stringify(feed())}), {});
 assert.deepEqual(run(FEED, {status:200, headers:{}, body:'{"data":[oops'}), {});
 assert.deepEqual(run(FEED, {status:200, headers:{}, body:'[]'}), {});
 const once = run(FEED, ok(feed())).body;
 assert.deepEqual(run(FEED, {status:200, headers:{}, body:once}), {}, 'idempotent');
});

test('next-render and video playlist behaviour is unchanged', () => {
 const nr = {paging:{next:'x'}, data:[{type:'answer', id:1, ad_info:{data:''}}, {type:'ad', adjson:'{}'}, {type:'answer', id:2}]};
 const out = JSON.parse(run('https://api.zhihu.com/next-render?id=1&type=answer', ok(nr)).body);
 assert.deepEqual(out, {paging:{next:'x'}, data:[nr.data[0], nr.data[2]]});
 assert.deepEqual(run('https://api.zhihu.com/next-render?id=1', ok({data:[nr.data[0]]})), {});

 const ad = {id:'v', playlist:{hd:{play_url:'https://vdn3.vzuu.com/HD/ad_bidding/a.mp4'}}, playlist_v2:{sd:{play_url:'https://vdn3.vzuu.com/SD/b.mp4'}}, cover:'c'};
 assert.deepEqual(JSON.parse(run('https://lens.zhihu.com/api/v4/videos/123', ok(ad)).body), {id:'v', playlist:{}, playlist_v2:{}, cover:'c'});
 const normal = {id:'v', playlist:{hd:{play_url:'https://vdn3.vzuu.com/HD/normal.mp4'}}};
 assert.deepEqual(run('https://lens.zhihu.com/api/v4/videos/123', ok(normal)), {});
});

test('plugin routes the feed into the script and rejects the splash/float-corner endpoints', () => {
 const scripts = plugin.split('\n').filter(l => l.startsWith('http-response'));
 assert.equal(scripts.length, 5);
 for (const l of scripts) assert.ok(l.includes('zhihu_ad_patch.js?v=1.3.0'), l);
 const feedRe = new RegExp(scripts.find(l => l.includes('topstory')).split(' ')[1]);
 assert.ok(feedRe.test(FEED) && feedRe.test('https://api.zhihu.com/topstory/recommend'));
 for (const u of ['https://api.zhihu.com/topstory/recommend_v2', 'https://api.zhihu.com/topstory/hot-lists', 'https://api.zhihu.com.evil.com/topstory/recommend'])
  assert.ok(!feedRe.test(u), u);

 const rewrites = plugin.split('[Rewrite]')[1].split('[Script]')[0].split('\n').filter(l => l.startsWith('^'))
  .map(l => ({re:new RegExp(l.split(/\s+/)[0]), act:l.split(/\s+/)[1]}));
 const action = u => (rewrites.find(r => r.re.test(u)) || {}).act;
 assert.equal(action('https://api.zhihu.com/commercial_api/real_time_launch_v2?app=zhihu&start_type=warm'), 'reject-dict');
 assert.equal(action('https://api.zhihu.com/commercial_api/launch_v2?app=zhihu'), 'reject-dict');
 assert.equal(action('https://api.zhihu.com/commercial_api/banners_v3/app_float_corner?token=1&type=answer'), 'reject-dict');
 for (const u of ['https://api.zhihu.com/commercial_api/launch_v3', 'https://api.zhihu.com/commercial_api/real_time_launch_v2x',
  'https://api.zhihu.com/ad-style-service/request', 'https://api.zhihu.com/commercial_api/sdk/prefetchx', 'https://api.zhihu.com/topstory/recommend', 'https://api.zhihu.com/next-render?id=1'])
  assert.equal(action(u), undefined, u);
});

test('feed: feed_advert third-party ad cards are removed from both lists', () => {
 const f = feed();
 f.data.splice(1, 0, {type:'feed_advert', ad:{brand:{name:'x'}}});
 f.dataV1.splice(1, 0, {type:'feed_advert', ad:{}});
 const out = JSON.parse(run(FEED, ok(f)).body);
 assert.deepEqual(out.data.map(x => x.type + x.extra.content_id), ['ComponentCard1', 'ComponentCard3']);
 assert.equal(out.dataV1.length, 2);
});

test('related waterfall: ZPlus cards removed, normal cards and paging kept', () => {
 const URL = 'https://api.zhihu.com/related_recommend/feed/waterfall?id=1&type=pin&scenes=recommend';
 const normal = id => ({id, type:'single_card', feedDeliveryType:'Normal', content:{deliver_type:'Normal'}});
 const body = {paging:{next:'n'}, data:[normal('a'),
  {id:'b', type:'single_card', feedDeliveryType:'ZPlus', is_zplus:true, extra:{}, content:{deliver_type:'ZPlus', is_zplus:true}},
  {id:'c', type:'single_card', content:{deliver_type:'ZPlus'}}, normal('d')]};
 assert.deepEqual(JSON.parse(run(URL, ok(body)).body), {paging:{next:'n'}, data:[normal('a'), normal('d')]});
 assert.deepEqual(run(URL, ok({paging:{}, data:[normal('a')]})), {});
 assert.deepEqual(run(URL, {status:200, headers:{}, body:'not json'}), {});
 const re = new RegExp(plugin.split('\n').find(l => l.startsWith('http-response') && l.includes('waterfall')).split(' ')[1]);
 assert.ok(re.test(URL) && !re.test('https://api.zhihu.com/related_recommend/feed/waterfallx'));
});

test('comments: commercial plugin card removed, comments kept; sdk prefetch rejected', () => {
 const URL = 'https://api.zhihu.com/comment_v5/pins/2097677635732222565/root_comment?order_by=score&limit=20';
 const c = [{type:'comment', id:1, content:'a'}];
 const body = {data:c, paging:{}, ad_plugin_infos:[{x:1}], plugin_info:{comment_ids:['1'], plugin_asset:{cardType:'normal', deeplinkUrl:'x'}}};
 assert.deepEqual(JSON.parse(run(URL, ok(body)).body), {data:c, paging:{}, ad_plugin_infos:[]});
 assert.deepEqual(run(URL, ok({data:c, paging:{}, ad_plugin_infos:[]})), {});
 assert.deepEqual(run('https://api.zhihu.com/comment_v5/answers/1/root_comment', {status:200, headers:{}, body:'x'}), {});
 const re = new RegExp(plugin.split('\n').find(l => l.startsWith('http-response') && l.includes('root_comment')).split(' ')[1]);
 assert.ok(re.test(URL) && re.test('https://api.zhihu.com/comment_v5/answers/1/root_comment'));
 assert.ok(!re.test('https://api.zhihu.com/comment_v5/comment/1/child_comment'));
 const rw = plugin.split('\n').find(l => l.startsWith('^') && l.includes('prefetch'));
 assert.ok(new RegExp(rw.split(/\s+/)[0]).test('https://api.zhihu.com/commercial_api/sdk/prefetch') && rw.endsWith('reject-dict'));
});
