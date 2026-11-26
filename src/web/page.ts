/** Single-file web chat used for the live demo. Inlined so it ships inside `dist` with no extra files. */
export const DEMO_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Elsa | تجربة حجز المواعيد على واتساب</title>
<style>
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{font-family:system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;background:#e9e4dc;display:flex;align-items:center;justify-content:center;color:#111}
.phone{width:100%;max-width:430px;height:100dvh;max-height:820px;background:#efeae2;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden}
@media(min-width:520px){.phone{border-radius:28px;height:92dvh}}
header{background:#075e54;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}
.avatar{width:40px;height:40px;border-radius:50%;background:#d9c7a8;display:flex;align-items:center;justify-content:center;font-size:20px}
.title{flex:1;line-height:1.25}.title b{display:block;font-size:16px}.title small{opacity:.8;font-size:12px}
#lang{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:14px;padding:6px 12px;font-size:13px;cursor:pointer}
.note{background:#fff8d6;color:#6b5a1a;font-size:12px;padding:6px 12px;text-align:center}
#log{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:82%;padding:8px 11px;border-radius:10px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.12)}
.me{align-self:flex-start;background:#d9fdd3;border-top-right-radius:2px}
.bot{align-self:flex-end;background:#fff;border-top-left-radius:2px}
[dir=ltr] .me{align-self:flex-end;border-top-right-radius:10px;border-top-left-radius:2px}
[dir=ltr] .bot{align-self:flex-start;border-top-left-radius:10px;border-top-right-radius:2px}
.sys{align-self:center;background:#fdecea;color:#8a1c12;font-size:13px}
.typing{color:#777}
#chips{display:flex;gap:6px;padding:6px 10px;overflow-x:auto;background:#efeae2}
#chips button{white-space:nowrap;background:#fff;border:1px solid #cfc8bb;border-radius:16px;padding:6px 12px;font-size:13px;cursor:pointer}
form{display:flex;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:#f0f0f0}
input{flex:1;border:0;border-radius:22px;padding:11px 15px;font-size:16px;outline:none;font-family:inherit}
#send{width:44px;height:44px;border:0;border-radius:50%;background:#128c7e;color:#fff;font-size:18px;cursor:pointer}
[dir=rtl] #send{transform:scaleX(-1)}
</style>
</head>
<body>
<div class="phone">
  <header>
    <div class="avatar">💇‍♀️</div>
    <div class="title"><b id="name"></b><small id="status"></small></div>
    <button id="lang" type="button"></button>
  </header>
  <div class="note" id="note"></div>
  <div id="log" aria-live="polite"></div>
  <div id="chips"></div>
  <form id="form" autocomplete="off">
    <input id="text" maxlength="300" enterkeyhint="send">
    <button id="send" type="submit" aria-label="send">➤</button>
  </form>
</div>
<script>
(function(){
var T={
 ar:{dir:'rtl',name:'صالون تجريبي',status:'متصل الآن',note:'ده عرض تجريبي: الخدمات والأسعار للتوضيح فقط.',ph:'اكتب رسالتك...',lang:'English',
  chips:['أهلاً','احجز موعد','عايز أحجز قص شعر بكرة الساعة 2 العصر','حجوزاتي'],
  wait:'جاري الرد...',cold:'السيرفر بيصحى من النوم، ممكن ياخد حوالي دقيقة. جرّب تبعت تاني.',err:'حصلت مشكلة في الاتصال. جرّب تاني.',limit:'رسائل كتير في وقت قصير. استنى شوية وجرّب تاني.'},
 en:{dir:'ltr',name:'Demo Salon',status:'online',note:'Demo only: services and prices are for illustration.',ph:'Type a message...',lang:'عربي',
  chips:['Hi','Book an appointment','Haircut tomorrow at 2pm','My bookings'],
  wait:'Typing...',cold:'The server is waking up, this can take about a minute. Please send again.',err:'Connection problem. Please try again.',limit:'Too many messages. Please wait a moment.'}
};
var lang=localStorage.getItem('elsa_lang')||'ar';
var id=localStorage.getItem('elsa_visitor');
if(!id){id='web'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem('elsa_visitor',id);}
var log=document.getElementById('log'),input=document.getElementById('text'),chips=document.getElementById('chips');
function add(cls,t){var d=document.createElement('div');d.className='msg '+cls;d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;return d;}
function apply(){var t=T[lang];document.documentElement.lang=lang;document.documentElement.dir=t.dir;
 document.getElementById('name').textContent=t.name;document.getElementById('status').textContent=t.status;
 document.getElementById('note').textContent=t.note;input.placeholder=t.ph;document.getElementById('lang').textContent=t.lang;
 chips.innerHTML='';t.chips.forEach(function(c){var b=document.createElement('button');b.type='button';b.textContent=c;b.onclick=function(){send(c);};chips.appendChild(b);});}
var busy=false;
function send(text){text=(text||'').trim();if(!text||busy)return;busy=true;add('me',text);input.value='';
 var t=T[lang],w=add('bot typing',t.wait),ctl=new AbortController(),to=setTimeout(function(){ctl.abort();},70000);
 fetch('/dev/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({from:id,text:text}),signal:ctl.signal})
 .then(function(r){if(r.status===429)throw new Error('limit');if(!r.ok)throw new Error('http');return r.json();})
 .then(function(j){w.className='msg bot';w.textContent=j.reply||'';})
 .catch(function(e){w.className='msg sys';w.textContent=e.message==='limit'?t.limit:(e.name==='AbortError'?t.cold:t.err);})
 .finally(function(){clearTimeout(to);busy=false;log.scrollTop=log.scrollHeight;});}
document.getElementById('form').onsubmit=function(e){e.preventDefault();send(input.value);};
document.getElementById('lang').onclick=function(){lang=lang==='ar'?'en':'ar';localStorage.setItem('elsa_lang',lang);apply();};
apply();
send(T[lang].chips[0]);
})();
</script>
</body>
</html>`;
