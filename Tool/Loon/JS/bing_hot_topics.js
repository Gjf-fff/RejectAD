/* Bing 热点查询（非 Rewards 签到）
 * Loon 定时脚本。获取 Bing News RSS，随机抽取热点并发起普通搜索请求。
 * 不使用登录 Cookie，不保证 Microsoft Rewards 积分。
 */
const COUNT = 5;
const RSS = 'https://www.bing.com/news/search?q=top+stories&format=rss';
const TIMEOUT = 12000;
const fallback = ['人工智能最新进展','科技热点新闻','全球财经新闻','新能源汽车新闻','互联网技术趋势','今日国际新闻','软件开发新技术'];
function request(url) {
  return $task.fetch({url,method:'GET',timeout:TIMEOUT,headers:{'User-Agent':'Mozilla/5.0 (compatible; LoonBingTopics/1.0)','Accept':'text/html,application/rss+xml,application/xml'}});
}
function decode(s){return s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,'').trim();}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
(async()=>{
  let topics=[];
  try {
    const r=await request(RSS);
    const xml=String(r.body||'');
    const matches=[...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/g)];
    topics=matches.map(m=>decode(m[1])).filter(Boolean);
  }catch(e){console.log('Bing RSS 获取失败: '+e);}
  if(!topics.length) topics=fallback.slice();
  const chosen=shuffle([...new Set(topics)]).slice(0,COUNT);
  let ok=0;
  for(const q of chosen){
    try{
      const r=await request('https://www.bing.com/search?q='+encodeURIComponent(q));
      if(Number(r.statusCode||r.status||0)===200)ok++;
      console.log('Bing 搜索请求: '+q+' | HTTP '+(r.statusCode||r.status||'?'));
    }catch(e){console.log('搜索请求失败: '+q+' '+e);}
  }
  const msg='热点 '+chosen.length+' 个，HTTP 200 '+ok+' 个。仅普通网页请求，非 Rewards 签到或积分确认。';
  console.log(msg);
  if(typeof $notification!=='undefined')$notification.post('Bing 热点搜索',msg,chosen.join('、').slice(0,180));
})().catch(e=>console.log('运行异常: '+e)).finally(()=>$done());
