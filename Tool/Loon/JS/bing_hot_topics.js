/* Bing 热点搜索：通过 Loon 定时任务 argument 配置次数和间隔。
 * 示例 argument=count=5&interval=15；interval 单位为秒。
 * 仅发送普通网页搜索请求，不执行 Rewards 签到或保证积分。
 */
const args = typeof $argument === 'object' && $argument !== null ? $argument : {};
const manual = args.manual === true || String(args.manual) === 'true';
const scheduledTime = String(args.runTime ?? '09:00').trim();
const validTime = /^([01]\\d|2[0-3]):[0-5]\\d$/.test(scheduledTime);
const now = new Date();
const currentTime = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
const raw = typeof $argument === 'string' ? $argument : '';
function option(key, def, min, max) {
  const match = raw.match(new RegExp('(?:^|&)'+key+'=(\\d+)(?:&|$)'));
  const value = match ? Number(match[1]) : def;
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : def;
}
const COUNT = Math.min(30, Math.max(1, Math.floor(Number(args.searchCount ?? option('count', 5, 1, 30)) || 5)));
const INTERVAL = Math.min(120, Math.max(1, Math.floor(Number(args.searchInterval ?? option('interval', 15, 1, 120)) || 15)));
const SHOW_NOTIFY = args.showNotify !== false && String(args.showNotify) !== 'false';
const RSS = 'https://www.bing.com/news/search?q=top+stories&format=rss';
const fallback = ['人工智能最新进展','科技热点新闻','全球财经新闻','新能源汽车新闻','互联网技术趋势','今日国际新闻','软件开发新技术'];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function request(url) {
  return $task.fetch({url,method:'GET',timeout:12000,headers:{'User-Agent':'Mozilla/5.0 (compatible; LoonBingTopics/1.1)','Accept':'text/html,application/rss+xml,application/xml'}});
}
function decode(s){return s.replace(/<!\\[CDATA\\[|\\]\\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
(async()=>{
  if(!manual && (args.taskEnabled === false || String(args.taskEnabled) === 'false')) return;
  if(!manual && !validTime){console.log('无效的执行时间，请填写 HH:mm，例如 09:00');return;}
  if(!manual && currentTime !== scheduledTime) return;
  let topics=[];
  try {
    const r=await request(RSS);
    const xml=String(r.body||'');
    const matches=[...xml.matchAll(/<item>[\\s\\S]*?<title>([\\s\\S]*?)<\\/title>[\\s\\S]*?<\\/item>/g)];
    topics=matches.map(m=>decode(m[1])).filter(Boolean);
  } catch(e){console.log('热点 RSS 获取失败: '+e);}
  if(!topics.length) topics=fallback.slice();
  const chosen=shuffle([...new Set(topics.concat(fallback))]).slice(0,COUNT);
  let ok=0;
  for(let i=0;i<chosen.length;i++){
    if(i>0) await wait(INTERVAL*1000);
    const q=chosen[i];
    try {
      const r=await request('https://www.bing.com/search?q='+encodeURIComponent(q));
      const status=Number(r.statusCode||r.status||0);
      if(status===200)ok++;
      console.log('搜索 '+(i+1)+'/'+chosen.length+': '+q+' | HTTP '+status);
    } catch(e){console.log('搜索失败: '+q+' '+e);}
  }
  const msg='搜索 '+chosen.length+' 次，间隔 '+INTERVAL+' 秒，HTTP 200 '+ok+' 次；非 Rewards 签到。';
  console.log(msg);
  if(SHOW_NOTIFY && typeof $notification!=='undefined') $notification.post('Bing 热点搜索',msg,'');
})().catch(e=>console.log('运行异常: '+e)).finally(()=>$done());
