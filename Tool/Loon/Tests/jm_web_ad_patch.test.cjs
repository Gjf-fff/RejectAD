"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../JS/jm_web_ad_patch.js'), 'utf8');
const plugin = fs.readFileSync(path.join(__dirname, '../Plugin/JM.plugin'), 'utf8');

function run(url, response) {
 let done;
 vm.runInNewContext(source, {$request:{url}, $response:response, $done:r=>{done=r;}, console:{log(){}}});
 return JSON.parse(JSON.stringify(done));
}

const adPage = '<!doctype html><html><head><title>t</title></head><body>' +
 '<div class="c835e-33_e" data-group="list1"><span class="group-notice">AD</span><ins data-zoneid="1"></ins></div>' +
 '<div class="content">正常内容</div></body></html>';
const cleanPage = '<!doctype html><html><head></head><body><div class="content">正常内容</div></body></html>';

test('rewritten HTML drops stale length, encoding and validator headers', () => {
 const headers = {'Content-Type':'text/html; charset=UTF-8','Content-Length':String(Buffer.byteLength(adPage)),
  'Content-Encoding':'br','ETag':'"abc"','Content-MD5':'x','Cache-Control':'no-cache','Set-Cookie':'a=1'};
 const result = run('https://18comic.vip/albums', {status:200, headers, body:adPage});
 assert.ok(result.body && !result.body.includes('group-notice'), 'ad container removed');
 assert.ok(result.body.includes('正常内容'), 'normal content kept');
 assert.deepEqual(Object.keys(result.headers).sort(), ['Cache-Control','Content-Type','Set-Cookie']);
});

test('lower-case header names are handled the same way', () => {
 const result = run('https://www.jmcomic-zzz.one/album/1/', {status:200,
  headers:{'content-type':'text/html','content-length':'999','content-encoding':'gzip'}, body:adPage});
 assert.deepEqual(Object.keys(result.headers), ['content-type']);
});

test('unchanged pages and non-HTML responses are passed through untouched', () => {
 assert.deepEqual(run('https://18comic.vip/', {status:200, headers:{'Content-Type':'text/html','Content-Length':'10'}, body:cleanPage}), {});
 assert.deepEqual(run('https://18comic.vip/', {status:200, headers:{'Content-Type':'application/json'}, body:adPage}), {});
 assert.deepEqual(run('https://18comic.vip/', {status:403, headers:{'Content-Type':'text/html'}, body:adPage}), {});
});

test('plugin uses the new script version and only routes page URLs into the script', () => {
 const line = plugin.split('\n').find(l => l.startsWith('http-response') && l.includes('jm_web_ad_patch.js'));
 assert.ok(line.includes('jm_web_ad_patch.js?v=1.1.5'));
 const pattern = new RegExp(line.split(' ')[1]);
 for (const url of ['https://18comic.vip/', 'https://www.18comic.vip/albums?o=mv', 'https://jmcomic-zzz.one/album/123/',
  'https://www.jmcomic-zzz.one/photo/123/?page=2', 'https://18comic.vip/search/photos?search_query=a.js', 'https://18comic.vip/templates-list'])
  assert.ok(pattern.test(url), 'page should match: ' + url);
 for (const url of ['https://18comic.vip/cdn-cgi/challenge-platform/h/b/orchestrate', 'https://18comic.vip/templates/frontend/airav/js/jquery.photo-0.3.js',
  'https://18comic.vip/static/x', 'https://www.18comic.vip/ajax/album_pagination', 'https://18comic.vip/media/photos/1/00001.webp',
  'https://jmcomic-zzz.one/favicon.ico', 'https://jmcomic-zzz.one/x/app.css?v=3', 'https://18comic.vip.evil.com/'])
  assert.ok(!pattern.test(url), 'should not match: ' + url);
});
