// feel.js by 10101: title screen, sound and screen effects. game.js talks to it through window.feel.
// game.js calls feel.on(name, data) for: phase {phase:'title'|'setup'|'run'|'over'}, place {player, shape},
// freewill {player}, flipBurst {count}, winner {winner:1|2|0},
// round {round, of, results:[1|2|0,...], score:[black,white]} at the start of each round, matchWinner {winner:1|2|0}. It sets feel.onStart = mode => ... ('cpu' | 'hotseat').
// accessibility settings (10101): marks puts a dot on 10101's cells so the sides differ by shape, not just colour;
// calm turns off shake, confetti, pops and flashes. calm starts on if the device asks for reduced motion.
window.FW_A11Y=(()=>{let o={};try{o=JSON.parse(localStorage.getItem('fw-a11y')||'{}');}catch(e){}
 if(o.calm===undefined)o.calm=matchMedia('(prefers-reduced-motion: reduce)').matches;o.marks=!!o.marks;return o;})();
(function(){
const css=`
#feel-title{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#202020;font-family:monospace;color:#ddd;transition:opacity .5s}
#feel-title.hide{opacity:0;pointer-events:none}
#feel-bg{position:absolute;inset:0;width:100%;height:100%;opacity:.35;image-rendering:pixelated}
#feel-title h1{position:relative;font-size:clamp(28px,7vw,72px);margin:0 0 6px;letter-spacing:4px}
#feel-title h1 .k{color:#000;text-shadow:0 0 1px #aaa,0 0 12px #777}#feel-title h1 .w{color:#fff;text-shadow:0 0 12px #fff8}
#feel-title p{position:relative;color:#bbb;margin:4px 0 22px;max-width:480px;text-align:center;line-height:1.5;background:rgba(32,32,32,.85);padding:8px 14px}
#feel-title button{position:relative;font:16px monospace;margin:6px;padding:10px 26px;background:#333;color:#eee;border:1px solid #666;cursor:pointer;min-width:300px}
#feel-title button:hover{background:#808080;color:#000}
#feel-title button[data-mode]:not(.big),#feel-title button#feel-lab{width:min(340px,88vw);min-width:0;box-sizing:border-box;padding:10px 12px;display:block;margin:6px auto}
#feel-title button small{white-space:normal}
#feel-mute{position:fixed;top:10px;right:12px;z-index:60;font:13px monospace;background:#333;color:#ddd;border:1px solid #555;padding:4px 8px;cursor:pointer}
#feel-banner{height:30px;line-height:30px;margin:0 0 6px;font:bold 18px monospace;padding:0 18px;border:1px solid #555;opacity:0;pointer-events:none;transition:opacity .35s}
#feel-banner.on{opacity:1}
#feel-round{font:13px monospace;color:#bbb;margin:6px 0 0;letter-spacing:2px;height:20px;line-height:20px;white-space:nowrap;visibility:hidden;max-width:100%;overflow:hidden;text-overflow:ellipsis}@media(max-width:560px){#feel-round{font-size:12px;letter-spacing:0}}
#feel-round .pip{display:inline-block;width:12px;height:12px;margin:0 3px;border:1px solid #666;background:#808080;vertical-align:middle}
#feel-title p.tag{background:none;color:#aaa;font-size:15px;letter-spacing:2px;margin:0 0 20px}
#feel-title button.big{font-size:22px !important;padding:14px 26px;background:#808080;color:#000;border-color:#aaa}
#feel-title button.big:hover{background:#ddd}
#feel-rules{position:relative;margin-top:14px;color:#999;max-width:480px;text-align:center}
#feel-rules summary{cursor:pointer;padding:8px}
#feel-tools{position:relative;display:flex;gap:6px;justify-content:center}
#feel-tools.desk{position:fixed;top:10px;right:12px;z-index:60;align-items:center}
#feel-tools.desk > *{position:static !important;margin:0 !important}
#feel-title #feel-tools button,#feel-title #feel-tools select{min-width:0 !important;width:auto;font-size:14px !important;padding:8px 12px !important;margin:10px 0 !important}
#feel-title{justify-content:center}
#feel-install,#feel-ios{position:absolute !important;left:0;right:0;margin:0 auto !important;width:max-content;max-width:90vw}
#feel-install{bottom:calc(84px + env(safe-area-inset-bottom))}
#feel-ios{bottom:calc(84px + env(safe-area-inset-bottom))}
#feel-title p#feel-credit{position:static;margin:-6px auto 16px;font-size:14px;color:#d8d8d8;letter-spacing:1px;background:rgba(20,20,20,.55);padding:3px 12px;border-radius:8px;width:max-content;max-width:90vw}
#feel-title button.big{background:#ffd84a !important;color:#000 !important;border:2px solid #fff6c8 !important;font-weight:bold}
#feel-title > #feel-tools{position:absolute;left:0;right:0;bottom:calc(10px + env(safe-area-inset-bottom))}
#feel-title small{display:block;color:#999;font-size:12px;margin-top:3px}
.feel-shake{animation:feelshake .25s}
@keyframes feelshake{20%{transform:translate(3px,-2px)}40%{transform:translate(-3px,2px)}60%{transform:translate(2px,1px)}80%{transform:translate(-1px,-2px)}}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

// title screen with a slow two-colour Life running behind it
const t=document.createElement('div');t.id='feel-title';
t.innerHTML=`<canvas id="feel-bg" width="96" height="60"></canvas>
<h1><span class="k">01010</span> vs <span class="w">10101</span></h1>
<p class="tag">plant a seed. start a war.</p>
<button data-mode="campaign" class="big">play</button>
<button data-mode="daily">daily challenge<small>same board for everyone today</small></button>
<button data-mode="arena">arena run<small>win 10 games before you lose 3 lives</small></button>
<button data-mode="cpu">quick match vs computer<small>you play black, top half</small></button><button data-mode="hotseat">two players, one screen<small>01010 is black on top, 10101 is white below</small></button>
<details id="feel-rules"><summary>how it works</summary><p>Spend 20 points building patterns in your half, then watch 500 generations play out. <b style="color:#eee">Most living cells at generation 500 wins.</b> A cell surrounded by more enemy cells than friendly ones switches sides, and you get two free-will gliders to launch while it runs.</p></details>
`;
document.body.appendChild(t);
const bg=t.querySelector('#feel-bg'),bx=bg.getContext('2d'),W=96,H=60;let bgG=new Int8Array(W*H);
for(let i=0;i<W*H;i++)bgG[i]=Math.random()<.18?(i%W<W/2?1:2):0;
function bgStep(){const n=new Int8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let b=0,w=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const v=bgG[((y+dy+H)%H)*W+(x+dx+W)%W];if(v===1)b++;else if(v===2)w++;}
 const i=y*W+x,c=bgG[i],s=b+w;if(c){if(s===2||s===3){const o=c===1?w:b,m=c===1?b:w;n[i]=o>m?3-c:c;}}else if(s===3)n[i]=b>w?1:2;}
 bgG=n;let live=0;for(const v of bgG)if(v)live++;if(live<W*H*.04)for(let k=0;k<200;k++){const i=Math.floor(Math.random()*W*H);bgG[i]=Math.random()<.5?1:2;}
 bx.fillStyle='#808080';bx.fillRect(0,0,W,H);for(let i=0;i<W*H;i++)if(bgG[i]){bx.fillStyle=bgG[i]===1?'#000':'#fff';bx.fillRect(i%W,(i/W)|0,1,1);}}
let bgOn=true;bgStep();(function bgLoop(){if(bgOn&&!(window.FW_A11Y&&FW_A11Y.calm))bgStep();setTimeout(bgLoop,120);})();

// sound: WebAudio only, nothing to download. black is low, white is high.
let ac=null,muted=false;const A=()=>{if(!ac)ac=new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();return ac;};
function tone(f,dur=.08,type='square',vol=.05,slide=0){if(muted)return;const a=A(),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;
 if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f*slide),a.currentTime+dur);g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+dur);}
const pitch=p=>p===1?220:440;
const mute=document.createElement('button');mute.id='feel-mute';mute.textContent='sound on';document.body.appendChild(mute);
const small=()=>matchMedia('(pointer:coarse),(max-width:700px)').matches;
const toggle=()=>{muted=!muted;mute.textContent=small()?(muted?'fx off':'fx on'):(muted?'sound off':'sound on');};if(small())mute.textContent='fx on';mute.onclick=toggle;
document.addEventListener('keydown',e=>{if(e.key==='m')toggle();});

const banner=document.createElement('div');banner.id='feel-banner';
const placeBanner=()=>{const c=document.getElementById('c');if(c&&banner.nextSibling!==c)c.before(banner);else if(!c&&!banner.parentNode)document.body.appendChild(banner);};placeBanner();document.addEventListener('DOMContentLoaded',placeBanner);
function showBanner(text,col,ms=1800){placeBanner();banner.textContent=text;banner.style.background=col===1?'#000':col===2?'#fff':'#808080';banner.style.color=col===1?'#fff':'#000';banner.classList.add('on');clearTimeout(showBanner.t);showBanner.t=setTimeout(()=>banner.classList.remove('on'),ms);}
function shake(){if(FW_A11Y.calm)return;const c=document.getElementById('c');if(!c)return;c.classList.remove('feel-shake');void c.offsetWidth;c.classList.add('feel-shake');}

// round counter for best-of-three: one pip per round, filled with the colour that won it
const roundEl=document.createElement('div');roundEl.id='feel-round';
// the strip keeps its 20px from page load, so showing it never moves the board under your mouse
const placeRound=()=>{if(banner.parentNode&&roundEl.nextSibling!==banner)banner.before(roundEl);};placeRound();document.addEventListener('DOMContentLoaded',placeRound);
function drawRound(d){placeRound();
 roundEl.style.visibility='visible';const res=d.results||[];let pips='';for(let k=0;k<(d.of||3);k++){const w=res[k];pips+=`<span class="pip" style="background:${w===1?'#000':w===2?'#fff':'#808080'}"></span>`;}
 roundEl.innerHTML=`round ${d.round} of ${d.of||3} &nbsp;${pips}&nbsp; ${d.score?d.score[0]+' to '+d.score[1]:''}`;}
// gold or green toast for achievements and level-ups, plus a little burst of cells
function flash(text,col){banner.textContent=text;banner.style.background='#2a2a2a';banner.style.color=col;banner.classList.add('on');clearTimeout(showBanner.t);showBanner.t=setTimeout(()=>banner.classList.remove('on'),3200);}
function confetti(){if(FW_A11Y.calm)return;const c=document.getElementById('c');if(!c)return;const r=c.getBoundingClientRect();for(let k=0;k<28;k++){const e=document.createElement('div');const sz=6+Math.random()*6;
 e.style.cssText=`position:fixed;z-index:70;pointer-events:none;width:${sz}px;height:${sz}px;border-radius:2px;left:${r.left+r.width/2}px;top:${r.top+r.height/3}px;background:${k%2?'#fff':'#000'};border:1px solid #888;transition:transform 1.1s cubic-bezier(.2,.7,.3,1),opacity 1.1s`;
 document.body.appendChild(e);requestAnimationFrame(()=>{e.style.transform=`translate(${(Math.random()-.5)*r.width}px,${(Math.random()-.2)*r.height*.8}px) rotate(${Math.random()*360}deg)`;e.style.opacity='0';});setTimeout(()=>e.remove(),1200);}}
let lastBurst=0;
const feel={onStart:null,muted:()=>muted,
 showTitle(){t.classList.remove('hide');bgOn=true;feel.dockTools&&feel.dockTools();},
 on(name,d={}){switch(name){
  case 'phase': if(d.phase!=='over'){clearTimeout(showBanner.t);banner.classList.remove('on');} if((d.phase==='setup'||d.phase==='title')&&feel.resetBoardFx)feel.resetBoardFx(); if(d.phase==='title'&&feel.setZone){feel.setZone(null);feel.setWrapHint(false);} if(d.phase==='setup'||d.phase==='run'){const top=()=>window.scrollTo({top:0,behavior:'instant'});top();requestAnimationFrame(top);setTimeout(top,120);} if(d.phase==='title')feel.showTitle(); if(d.phase==='run'){tone(330,.15,'triangle',.06);setTimeout(()=>tone(495,.2,'triangle',.06),120);} if(d.phase==='setup')tone(262,.12,'triangle',.05); break;
  case 'place': tone(pitch(d.player)*(d.shape==='gun'?.5:1),.06,'square',.04); break;
  case 'freewill': tone(pitch(d.player)*2,.35,'sawtooth',.05,.25); showBanner('free will',d.player); break;
  case 'flipBurst': { const now=performance.now(); if(d.count>0&&now-lastBurst>90){lastBurst=now;tone(600+Math.min(d.count,40)*20,.03,'square',Math.min(.06,.01+d.count*.002));} if(d.count>=25)shake(); break; }
  case 'achievement': { const n=d.name||d.title||d.id||'achievement'; (feel.celebrate||flash)('achievement: '+n,'#ffd84a');
    [523,659,784].forEach((f,k)=>setTimeout(()=>tone(f,.18,'triangle',.05),k*90)); break; }
  case 'levelUp': { const lv=d.level!=null?d.level:''; (feel.celebrate||flash)('level '+lv+(d.unlock?' \u00b7 unlocked '+d.unlock:''),'#7dff9a');
    [392,523,659,784,1047].forEach((f,k)=>setTimeout(()=>tone(f,.22,k%2?'square':'triangle',.045),k*80)); confetti(); break; }
  case 'arena': { placeRound(); roundEl.style.visibility='visible';
    const hearts='<span style="color:#ff5a6e">'+'\u2665'.repeat(Math.max(0,d.lives))+'</span><span style="color:#888">'+'\u2661'.repeat(Math.max(0,3-d.lives))+'</span>';
    let pips='';for(let k=0;k<10;k++)pips+=`<span class="pip" style="width:8px;height:8px;margin:0 1px;background:${k<d.wins?'#ffd84a':'#555'}"></span>`;
    roundEl.innerHTML=`arena ${d.game} vs ${d.opponent} &nbsp;${pips}&nbsp; ${hearts}`; tone(330,.1,'triangle',.05); break; }
  case 'mode': feel._mode=d.mode; if(!['cpu','hotseat','arena'].includes(d.mode))roundEl.style.visibility='hidden'; break;
  case 'round': if(window.game&&game._state&&game._state().arena)break; if(feel._mode&&!['cpu','hotseat','arena'].includes(feel._mode))break; drawRound(d); tone(330,.1,'triangle',.05); break;
  case 'matchWinner': { const w=d.winner; showBanner(d.label?d.label:w===1?'01010 wins the match':w===2?'10101 wins the match':'match drawn',w,7000);
    const base=w===1?131:w===2?262:196;[0,4,7,12,16,19,24].forEach((s,k)=>setTimeout(()=>tone(base*Math.pow(2,s/12),.5,k%2?'square':'triangle',.05),k*110)); break; }
  case 'winner': { const w=d.winner, md=(window.game&&game._state&&game._state().mode)||'';
    const words={campaign:['mission complete','mission failed'],challenge:['challenge won','challenge lost'],daily:['you win today','not today']}[md];
    showBanner(words?(w===1?words[0]:words[1]):(d.label||(w===1?'01010 wins':w===2?'10101 wins':'draw')),words?(w===1?1:0):w,words?3000:5000);
    const base=w===1?196:w===2?392:294;[0,4,7,12].forEach((s,k)=>setTimeout(()=>tone(base*Math.pow(2,s/12),.4,'triangle',.06),k*140)); break; }
 }}};
window.feel=feel;feel._flash=flash;
t.querySelectorAll('button').forEach(b=>b.onclick=()=>{A();t.classList.add('hide');bgOn=false;tone(392,.1,'triangle',.06);
 feel.dockTools&&feel.dockTools();let m=b.dataset.mode;if((m==='campaign'||m==='daily'||m==='arena')&&!(feel.modes||[]).includes(m))m='cpu';if(feel.onStart)feel.onStart(m);});
})();

// ---------- board look: themes and cell drawing (10101) ----------
// game.js calls feel.drawCells(ctx,g,flipped,trail,trailC,S,N) instead of its own cell loop.
// themes are cosmetic unlocks: progression calls feel.unlockTheme(id); feel.themes lists them.
(function(){
const feel=window.feel;
const THEMES=[
 {id:'classic',name:'Classic',bg:'#7c7f86',grid:'rgba(0,0,0,.07)',c:[null,{f:'#0d0d10',h:'#3a3a44',e:'#000'},{f:'#f4f4f0',h:'#ffffff',e:'#c9c9c4'}]},
 {id:'paper',name:'Paper',bg:'#e9e2d0',grid:'rgba(80,60,30,.08)',c:[null,{f:'#1d2433',h:'#3c4866',e:'#0a0e18'},{f:'#2f7d5b',h:'#5fb08a',e:'#1b4d37'}]},
 {id:'ember',name:'Ember and ice',bg:'#1c1f26',grid:'rgba(255,255,255,.04)',c:[null,{f:'#ff7a2f',h:'#ffc078',e:'#a83a08'},{f:'#56c8ff',h:'#c4ecff',e:'#1f6fa8'}]},
 {id:'neon',name:'Neon',bg:'#0b0b14',grid:'rgba(120,120,255,.06)',c:[null,{f:'#ff2fb4',h:'#ff9be0',e:'#8a0b5e'},{f:'#2fffd2',h:'#b9fff0',e:'#0b8a6e'}],glow:true},
 {id:'forest',name:'Moss and stone',bg:'#3d4a3a',grid:'rgba(0,0,0,.08)',c:[null,{f:'#1f2a1c',h:'#3d5236',e:'#0d140b'},{f:'#d8d3c0',h:'#f5f1e4',e:'#9e987f'}]},
];
let unlocked=new Set(['classic']);try{JSON.parse(localStorage.getItem('fw-themes')||'[]').forEach(t=>unlocked.add(t));}catch(e){}
let cur=localStorage.getItem('fw-theme')||'classic';if(!unlocked.has(cur))cur='classic';
const theme=()=>THEMES.find(t=>t.id===cur)||THEMES[0];
feel.themes=THEMES.map(t=>({id:t.id,name:t.name}));
feel.theme=()=>theme();
feel.colors=()=>{const t=theme();return {bg:t.bg,black:t.c[1].f,white:t.c[2].f};};
// re-read before writing, so a stale tab adds to the unlocks instead of overwriting another tab's
const readThemes=()=>{try{JSON.parse(localStorage.getItem('fw-themes')||'[]').forEach(t=>unlocked.add(t));}catch(e){}};
addEventListener('storage',e=>{if(e.key==='fw-themes'){const n=unlocked.size;readThemes();if(unlocked.size!==n)buildPicker();}});
feel.unlockTheme=id=>{readThemes();if(!THEMES.some(t=>t.id===id)||unlocked.has(id))return false;unlocked.add(id);localStorage.setItem('fw-themes',JSON.stringify([...unlocked]));buildPicker();
 const t=THEMES.find(t=>t.id===id);document.getElementById('feel-banner')&&(()=>{const b=document.getElementById('feel-banner');b.textContent='new theme: '+t.name;b.style.background='#333';b.style.color='#ffd84a';b.classList.add('on');setTimeout(()=>b.classList.remove('on'),2500);})();return true;};
feel.setTheme=id=>{if(!unlocked.has(id))return;cur=id;localStorage.setItem('fw-theme',id);pick.value=id;if(feel.onTheme)feel.onTheme(id);};
// theme picker next to the sound button
const pick=document.createElement('select');pick.id='feel-theme';pick.title='board theme';
pick.style.cssText='position:fixed;top:10px;right:96px;z-index:60;font:13px monospace;background:#333;color:#ddd;border:1px solid #555;padding:3px 4px';
function buildPicker(){pick.innerHTML=THEMES.map(t=>`<option value="${t.id}" ${unlocked.has(t.id)?'':'disabled'} ${t.id===cur?'selected':''}>${t.name}${unlocked.has(t.id)?'':' (locked)'}</option>`).join('');}
buildPicker();pick.onchange=()=>feel.setTheme(pick.value);document.body.appendChild(pick);
// on phones the sound and theme buttons sit in a row at the bottom of the page instead of floating over it
const tools=document.createElement('div');tools.id='feel-tools';
const phone=()=>matchMedia('(pointer:coarse),(max-width:700px)').matches;
// desktop: theme, music and sound sit in one fixed row at the top right, so they can never overlap each other
const deskTools=()=>{tools.classList.add('desk');tools.append(pick,...['feel-music','feel-mute'].map(i=>document.getElementById(i)).filter(Boolean));document.body.appendChild(tools);};
const dockTools=()=>{if(!phone())return deskTools();tools.classList.remove('desk');tools.append(pick,...['feel-music','feel-mute'].map(i=>document.getElementById(i)).filter(Boolean));const t=document.getElementById('feel-title');(t&&!t.classList.contains('hide')?t:document.body).appendChild(tools);};
feel.dockTools=dockTools;
dockTools();document.addEventListener('DOMContentLoaded',dockTools);addEventListener('load',dockTools);addEventListener('resize',()=>{clearTimeout(dockTools.t);dockTools.t=setTimeout(dockTools,150);});
matchMedia('(pointer:coarse),(max-width:700px)').addEventListener&&matchMedia('(pointer:coarse),(max-width:700px)').addEventListener('change',dockTools);

// per-cell age so births pop and flips spark, counted in generations
let lastG=null,age=null,flipAge=null,flipFrom=null,ripples=[],cache={};
feel.ripple=(x,y,player)=>ripples.push({x,y,p:player,t:0});
// flip rings and ripples only age when generations advance, so without this they'd linger through the next setup
feel.resetBoardFx=()=>{lastG=null;age=null;flipAge=null;flipFrom=null;ripples=[];};
let zone=null,wrap=false;
// game.js: feel.setZone(32,63) tints the rows that count (or null to clear); feel.setWrapHint(true) marks the joined top and bottom edges
feel.setZone=(a,b)=>{zone=a==null?null:[a,b];};feel.setWrapHint=v=>{wrap=!!v;};
function round(ctx,x,y,w,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+w,r);ctx.arcTo(x+w,y+w,x,y+w,r);ctx.arcTo(x,y+w,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
feel.drawCells=function(ctx,g,flipped,trail,trailC,S,N){
 const T=theme(),n=N*N;
 if(!age||age.length!==n){age=new Uint16Array(n).fill(99);flipAge=new Uint8Array(n).fill(99);flipFrom=new Int8Array(n);}
 if(g!==lastG){ // a new generation (or a new board): age every cell
  const fresh=!lastG||lastG.length!==n;
  for(let i=0;i<n;i++){ if(g[i]){ age[i]=fresh||!lastG[i]?0:Math.min(99,age[i]+1);} else age[i]=99;
   if(flipped&&flipped[i]){flipAge[i]=0;flipFrom[i]=flipped[i];} else if(flipAge[i]<99)flipAge[i]++; }
  ripples.forEach(r=>r.t++);ripples=ripples.filter(r=>r.t<12);lastG=g;
 }
 // background and grid are drawn once per theme and size, cells are pre-drawn sprites: far cheaper than paths every frame
 const key=T.id+S+'/'+N+(FW_A11Y.marks?'m':'');
 if(cache.key!==key){cache={key,bg:document.createElement('canvas'),spr:{}};const B=cache.bg;B.width=B.height=N*S;const b=B.getContext('2d');
  b.fillStyle=T.bg;b.fillRect(0,0,N*S,N*S);b.strokeStyle=T.grid;b.lineWidth=1;b.beginPath();for(let k=1;k<N;k++){b.moveTo(k*S+.5,0);b.lineTo(k*S+.5,N*S);b.moveTo(0,k*S+.5);b.lineTo(N*S,k*S+.5);}b.stroke();}
 const P=4,sprite=(c,a)=>{const id=c+'-'+a;if(cache.spr[id])return cache.spr[id];const C=T.c[c],cv=document.createElement('canvas');cv.width=cv.height=S+P*2;const x=cv.getContext('2d');
  const sc=a===0?.62:a===1?.88:1,w=S*sc,o=P+(S-w)/2,r=Math.max(1.5,S*.28);
  if(a===3){x.globalAlpha=.28;x.fillStyle=C.f;round(x,P+2,P+2,S-4,r);x.fill();return cache.spr[id]=cv;}
  if(T.glow){x.shadowColor=C.f;x.shadowBlur=a<2?8:4;}
  x.fillStyle=C.e;round(x,o,o+.8,w,r);x.fill();x.shadowBlur=0;
  x.fillStyle=a===0?C.h:C.f;round(x,o,o,w,r*.95);x.fill();
  if(S>=7&&a>0){x.fillStyle=C.h;x.globalAlpha=.55;x.fillRect(o+w*.22,o+w*.18,w*.3,Math.max(1,w*.14));}
  // marked cells: a dark dot in the centre of every 10101 cell
  if(FW_A11Y.marks&&c===2){x.globalAlpha=1;x.fillStyle=T.c[1].f;x.beginPath();x.arc(P+S/2,P+S/2,Math.max(1.2,w*.2),0,Math.PI*2);x.fill();}
  return cache.spr[id]=cv;};
 ctx.drawImage(cache.bg,0,0);
 for(let i=0;i<n;i++){
  const c=g[i];
  if(!c&&!(trail&&trail[i]>0.05)&&flipAge[i]>=3)continue;
  const x=(i%N)*S,y=((i/N)|0)*S;
  if(!c){ if(trail&&trail[i]>0.05){ctx.globalAlpha=trail[i];ctx.drawImage(sprite(trailC[i]||1,3),x-P,y-P);ctx.globalAlpha=1;} }
  if(flipAge[i]<3&&!FW_A11Y.calm){const C=T.c[flipFrom[i]]||T.c[1],k=flipAge[i];ctx.globalAlpha=.7-k*.22;ctx.strokeStyle=C.f;ctx.lineWidth=2;ctx.strokeRect(x-1-k*2,y-1-k*2,S+2+k*4,S+2+k*4);ctx.globalAlpha=1;}
  if(c) ctx.drawImage(sprite(c,FW_A11Y.calm?2:Math.min(age[i],2)),x-P,y-P);
 }
 // teaching overlays for missions: a gold-tinted target zone, and markers showing the top and bottom edges are joined
 if(zone){ctx.fillStyle='rgba(255,216,74,.10)';ctx.fillRect(0,zone[0]*S,N*S,(zone[1]-zone[0]+1)*S);ctx.strokeStyle='rgba(255,216,74,.55)';ctx.setLineDash([6,4]);ctx.lineWidth=2;ctx.strokeRect(1,zone[0]*S+1,N*S-2,(zone[1]-zone[0]+1)*S-2);ctx.setLineDash([]);}
 if(wrap){const pulse=.45+.35*Math.sin(performance.now()/300);ctx.fillStyle=`rgba(255,216,74,${pulse})`;
  for(let k=4;k<N;k+=12){const x0=k*S;ctx.beginPath();ctx.moveTo(x0,7);ctx.lineTo(x0+S,1);ctx.lineTo(x0+2*S,7);ctx.fill();ctx.beginPath();ctx.moveTo(x0,N*S-7);ctx.lineTo(x0+S,N*S-1);ctx.lineTo(x0+2*S,N*S-7);ctx.fill();}
  ctx.fillRect(0,0,N*S,2);ctx.fillRect(0,N*S-2,N*S,2);}
 if(!FW_A11Y.calm)for(const q of ripples){const C=T.c[q.p]||T.c[1];ctx.globalAlpha=Math.max(0,.6-q.t*.05);ctx.strokeStyle=C.f;ctx.lineWidth=2;ctx.beginPath();ctx.arc((q.x+.5)*S,(q.y+.5)*S,(q.t+1)*S*.9,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
};
})();

// ---------- phone magnifier (10101) ----------
// while a finger is on the board, a round loupe above it shows the cells under the finger at about 2.5x,
// with the target cell outlined. game.js places on finger-up, so you can slide to the right cell before letting go.
(function(){
const L=document.createElement('canvas'),D=150,CELLS=9;L.width=L.height=D*2;
L.style.cssText=`position:fixed;z-index:80;width:${D}px;height:${D}px;border-radius:50%;border:3px solid #ddd;box-shadow:0 6px 18px #000a;pointer-events:none;display:none`;
document.body.appendChild(L);const lx=L.getContext('2d');let active=null,raf=0;
function draw(){raf=0;const c=document.getElementById('c');if(!active||!c)return;const r=c.getBoundingClientRect(),N=64,cs=c.width/N;
 const fx=(active.x-r.left)/r.width,fy=(active.y-r.top)/r.height;if(fx<0||fy<0||fx>1||fy>1){L.style.display='none';return;}
 const cx=Math.floor(fx*N),cy=Math.floor(fy*N),half=CELLS/2;
 lx.imageSmoothingEnabled=false;lx.fillStyle='#202020';lx.fillRect(0,0,L.width,L.height);
 lx.drawImage(c,(cx+.5-half)*cs,(cy+.5-half)*cs,CELLS*cs,CELLS*cs,0,0,L.width,L.height);
 const u=L.width/CELLS;lx.strokeStyle='#ffd84a';lx.lineWidth=4;lx.strokeRect((half-.5)*u,(half-.5)*u,u,u);
 // keep the loupe on screen, above the finger, or below it near the top edge
 let top=active.y-D-50;if(top<4)top=active.y+50;let left=Math.min(innerWidth-D-4,Math.max(4,active.x-D/2));
 L.style.left=left+'px';L.style.top=top+'px';L.style.display='block';}
const sched=()=>{if(!raf)raf=requestAnimationFrame(draw);};
function bind(){const c=document.getElementById('c');if(!c||c.dataset.loupe)return;c.dataset.loupe=1;
 c.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;active={x:e.clientX,y:e.clientY};sched();});
 c.addEventListener('pointermove',e=>{if(!active||e.pointerType==='mouse')return;active={x:e.clientX,y:e.clientY};sched();});
 const end=()=>{active=null;L.style.display='none';};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('pointerleave',end);
 // the board redraws while the finger is down (previews follow it), so refresh the loupe each frame it is open
 (function tick(){if(active)draw();requestAnimationFrame(tick);})();}
bind();document.addEventListener('DOMContentLoaded',bind);
})();

// ---------- install to home screen (10101) ----------
// Android and desktop Chrome offer a real install prompt; iPhone needs Share then "Add to Home Screen", so it gets a hint instead.
(function(){
const t=document.getElementById('feel-title');if(!t)return;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(standalone)return;
const b=document.createElement('button');b.id='feel-install';b.textContent='add to home screen';b.style.display='none';
const hint=document.createElement('p');hint.id='feel-ios';hint.style.cssText='display:none;font-size:12px;color:#aaa;background:none;white-space:normal;max-width:min(88vw,340px);margin-left:auto;margin-right:auto;text-align:center;box-sizing:border-box';hint.textContent='iPhone: tap Share, then "Add to Home Screen" to play offline.';
const rules=document.getElementById('feel-rules');t.insertBefore(b,rules);t.insertBefore(hint,rules);
let ev=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();ev=e;b.style.display='';hint.style.display='none';});
b.onclick=async e=>{e.stopPropagation();if(!ev)return;ev.prompt();await ev.userChoice;ev=null;b.style.display='none';};
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&location.protocol.startsWith('http')&&!ev)hint.style.display='block';
})();

// ---------- music by ShadesoN (10101) ----------
// drop audio files into music/ with these names. A track can be one file or a list of stems
// (for example drums, bass, melody); stems after the first fade in as the fight gets busier.
// missing files are skipped quietly, so the game works before the music arrives.
(function(){
const feel=window.feel;
// ShadesoN's music (picked by 01010 with 𝕊𝕙𝕒𝕕𝕠𝕨). the title is a short loop cut on the beat: it plays from a
// decoded buffer so the join is seamless (<audio loop> leaves a gap with MP3s). the full battle, finale and win songs stream
// through <audio>, which keeps phone memory low (a decoded 3-minute song is about 70 MB).
const MUSIC_READY=true;
const TRACKS={
 title:  ['music/weave-me-thru-the-veil-loop.mp3'],
 battle: ['music/dystopias-kingdom.mp3'],   // the whole song (𝕊𝕙𝕒𝕕𝕠𝕨's wish); it fades out, so a plain <audio loop> restart is fine
 finale: ['music/burning-sky.mp3'],
 win:    ['music/mtbfree.mp3'],
};
// exact loop lengths at 44.1 kHz (measured by 11111). browsers that honour the MP3 gapless header hand us exactly this
// many samples; Safari may not, and then 1,105 samples of encoder delay sit in front, so the cut is skipped explicitly.
const LOOPED={'music/weave-me-thru-the-veil-loop.mp3':3750144};
const WIN_FROM=35,WIN_LEN=20; // mtbfree's quiet intro reaches full level around 0:35, so the win jingle plays 0:35 to 0:55 (fading in, then out)
feel.music={tracks:TRACKS};
let on=localStorage.getItem('fw-music')!=='off',ctx=null,master=null,cur=null,curName=null,heat=0,started=false;
const VOL=.55,FADE=1.6;
function audioCtx(){if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=on?VOL:0;master.connect(ctx.destination);}if(ctx.state==='suspended')ctx.resume();return ctx;}
const loaded={};
// MP3 encoders pad the start and end with silence; skip it so the loop points meet exactly
function bounds(buf,n){const len=n/44100,pad=buf.duration-len>0.015?1105/44100:0;return[pad,pad+len];}
function mediaLayer(src,k,name){const el=new Audio();el.src=src;el.loop=name!=='win';el.preload=name==='win'||name==='finale'?'none':'auto';el.crossOrigin='anonymous';
 const g=ctx.createGain();g.gain.value=0;try{ctx.createMediaElementSource(el).connect(g);g.connect(master);}catch(e){}
 // looping full songs get our own 1.5 s fade-out before the restart and a short fade-in after it, so the jump is soft
 const lg=ctx.createGain();try{g.disconnect();g.connect(lg);lg.connect(master);}catch(e){}let dipped=false;
 if(el.loop)el.addEventListener('timeupdate',()=>{const t=ctx.currentTime,left=el.duration-el.currentTime;
  if(!dipped&&left<1.6&&left>0){dipped=true;lg.gain.cancelScheduledValues(t);lg.gain.setValueAtTime(lg.gain.value,t);lg.gain.linearRampToValueAtTime(0,t+Math.max(.2,left-.1));}
  else if(dipped&&el.currentTime<1){dipped=false;lg.gain.cancelScheduledValues(t);lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(1,t+.5);}});
 return{kind:'el',el,g,k,start(){if(name==='win'){if(el.readyState>=1)el.currentTime=WIN_FROM;else el.addEventListener('loadedmetadata',()=>{el.currentTime=WIN_FROM;},{once:true});}const p=el.play();p&&p.catch(()=>{});},stop(){el.pause();}};}
function bufferLayer(src,k,n){const g=ctx.createGain();g.gain.value=0;g.connect(master);
 const L={kind:'buf',g,k,buf:null,src:null,pos:0,t0:0,want:false,fallback:null,
  start(){L.want=true;if(L.fallback)return L.fallback.start();if(!L.buf||L.src)return;const s=ctx.createBufferSource();s.buffer=L.buf;s.loop=true;
   [s.loopStart,s.loopEnd]=L.lp;s.connect(g);const off=L.lp[0]+(L.pos%(L.lp[1]-L.lp[0]));s.start(0,off);L.src=s;L.t0=ctx.currentTime-(off-L.lp[0]);},
  stop(){L.want=false;if(L.fallback)return L.fallback.stop();if(!L.src)return;L.pos=ctx.currentTime-L.t0;try{L.src.stop();}catch(e){}L.src=null;}};
 // fetch and decode; on file:// (the single-file bundle) or any failure, fall back to plain <audio loop>
 fetch(src).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer();}).then(a=>new Promise((res,rej)=>ctx.decodeAudioData(a,res,rej)))
  .then(b=>{L.buf=b;L.lp=bounds(b,n);if(L.want)L.start();})
  .catch(()=>{const m=mediaLayer(src,k,'loop');m.g.disconnect();L.g.disconnect();m.g.connect(g);g.connect(master);L.fallback=m;if(L.want)m.start();});
 return L;}
function load(name){if(loaded[name])return loaded[name];const files=TRACKS[name]||[];
 const layers=files.map((src,k)=>LOOPED[src]?bufferLayer(src,k,LOOPED[src]):mediaLayer(src,k,name));return loaded[name]={name,layers};}
function target(layer,n){ // first layer always full, extra stems follow the heat of the fight
 if(layer.k===0)return 1; const step=1/n; return Math.max(0,Math.min(1,(heat-layer.k*step*.8)/step));}
let winTimer=null;
function play(name){if(!MUSIC_READY||!started||name===curName)return;audioCtx();const t=ctx.currentTime,old=cur;clearTimeout(winTimer);
 if(old)old.layers.forEach(l=>{l.g.gain.cancelScheduledValues(t);l.g.gain.setValueAtTime(l.g.gain.value,t);l.g.gain.linearRampToValueAtTime(0,t+FADE);setTimeout(()=>{if(cur!==old)l.stop();},FADE*1000+100);});
 curName=name;cur=TRACKS[name]?load(name):null;if(!cur)return;
 cur.layers.forEach(l=>{l.start();l.g.gain.cancelScheduledValues(t);l.g.gain.setValueAtTime(l.g.gain.value,t);l.g.gain.linearRampToValueAtTime(target(l,cur.layers.length),t+FADE);});
 if(name==='win')winTimer=setTimeout(()=>{if(curName==='win'){curName=null;play('title');}},WIN_LEN*1000);
 // after the first song starts, let the offline cache fetch the long songs in the background
 if(!play.cached&&navigator.serviceWorker&&navigator.serviceWorker.controller){play.cached=true;navigator.serviceWorker.controller.postMessage({type:'cache-music'});}}
// one song carries through setup and the run, and each song picks up where it paused, so players hear whole tracks
// heat rises with flips and cools down slowly, and only matters when stems are present
setInterval(()=>{heat*=.96;if(!cur||!ctx||cur.layers.length<2)return;const t=ctx.currentTime;cur.layers.forEach(l=>{if(l.k)l.g.gain.setTargetAtTime(target(l,cur.layers.length),t,.8);});},250);
// phones block audio until the first tap, so music starts on the first touch or click anywhere
const kick=()=>{if(started)return;started=true;audioCtx();play(want);};
let want='title';addEventListener('pointerdown',kick,{capture:true});addEventListener('keydown',kick,{capture:true});
const go=n=>{want=n;play(n);};
const prevOn=feel.on;feel.on=function(name,d={}){prevOn.call(feel,name,d);
 if(name==='flipBurst')heat=Math.min(1,heat+(d.count||0)/120);
 if(name==='phase'){if(d.phase==='title')go('title');if(d.phase==='setup')go(d.finale?'finale':'battle');if(d.phase==='run')go(d.finale?'finale':'battle');}
 if(name==='matchWinner'||(name==='winner'&&d.final))go('win');};
feel.playMusic=go; // game.js can call feel.playMusic('finale') for the gun mission or a deciding round
// music button next to the sound button, and the credit on the title screen
const b=document.createElement('button');b.id='feel-music';const small=()=>matchMedia('(pointer:coarse),(max-width:700px)').matches;const lab=()=>b.textContent=small()?(on?'\u266a on':'\u266a off'):(on?'music on':'music off');lab();
b.style.cssText='position:fixed;top:10px;right:228px;z-index:60;font:13px monospace;background:#333;color:#ddd;border:1px solid #555;padding:4px 8px;cursor:pointer';
b.onclick=e=>{e.stopPropagation();on=!on;localStorage.setItem('fw-music',on?'on':'off');lab();if(ctx){const t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(master.gain.value,t);master.gain.linearRampToValueAtTime(on?VOL:0,t+.4);}};
b.style.display='none';document.body.appendChild(b);feel.dockTools&&feel.dockTools();
const t=document.getElementById('feel-title');if(t){const c=document.createElement('p');c.id='feel-credit';c.textContent='\u266a music by ShadesoN';c.style.visibility='hidden';const tag=t.querySelector('p.tag');tag?tag.after(c):t.appendChild(c);}
// probe the title track: until a real file loads, the game shows no music button and no credit
if(MUSIC_READY){const probe=new Audio();probe.preload='metadata';probe.addEventListener('loadedmetadata',()=>{b.style.display='';const c=document.getElementById('feel-credit');if(c)c.style.visibility='';feel.music.available=true;});probe.src=TRACKS.title[0];}
})();

// ---------- mission stars (10101) ----------
// game.js sends feel.on('stars',{mission,stars,best,improved}) after a mission win.
// three stars pop in one by one over the board: gold if earned, outlined if not, with a rising chime per star.
(function(){
const feel=window.feel;
const css=`#feel-stars{position:fixed;z-index:75;display:flex;gap:14px;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;flex-direction:column;opacity:0;transition:opacity .3s}
#feel-stars .tap{font:bold 14px monospace;color:#fff}
#feel-stars.on{opacity:1}
#feel-stars{flex-direction:row !important;gap:10px !important}
#feel-stars .row{display:flex;gap:8px;align-items:center;background:rgba(20,20,20,.78);padding:14px 22px 10px;border-radius:18px;border:1px solid #555}
#feel-stars .st{flex:none;width:min(38px,10vw);height:min(38px,10vw);transform:scale(0) rotate(-40deg);transition:transform .45s cubic-bezier(.3,1.7,.5,1)}
#feel-stars .st.in{transform:scale(1) rotate(0)}
#feel-stars .st:nth-child(2){width:min(46px,12vw);height:min(46px,12vw);margin-top:-8px}
#feel-stars .row{padding:6px 14px !important}
#feel-stars .side{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
#feel-stars .best{font:bold 16px monospace;color:#ffd84a;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .4s}
#feel-stars .best.in{opacity:1}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const star=(on)=>`<svg viewBox="0 0 24 24" class="st"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="${on?'#ffd84a':'rgba(0,0,0,.35)'}" stroke="${on?'#fff6c8':'#bbb'}" stroke-width="1.2" stroke-linejoin="round" style="filter:drop-shadow(0 3px 6px #000a)"/></svg>`;
let box=null,timers=[];
function tone(f,d,v){if(feel.muted&&feel.muted())return;try{const a=window.__fwac||(window.__fwac=new (window.AudioContext||window.webkitAudioContext)());const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(v,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+d);}catch(e){}}
function show(d){const c=document.getElementById('c');if(!c)return;timers.forEach(clearTimeout);timers=[];if(box)box.remove();
 const r=c.getBoundingClientRect();box=document.createElement('div');box.id='feel-stars';
 box.style.left='0';box.style.right='0';box.style.visibility='hidden';
 const n=d.stars||0;box.innerHTML=`<div class="row">${[0,1,2].map(k=>star(k<n)).join('')}<div class="side"><div class="best">${d.improved&&n>0?'new best!':''}</div><div class="tap">tap to close</div></div></div>`;
 const close=()=>{timers.forEach(clearTimeout);timers=[];if(!box)return;const b=box;b.classList.remove('on');setTimeout(()=>b.remove(),400);box=null;};box.onclick=close;
 const nb=()=>{const bn=document.getElementById('feel-banner');if(bn)bn.classList.remove('on');};nb();[60,400,1200].forEach(ms=>timers.push(setTimeout(nb,ms)));
 document.body.appendChild(box);
 // sit in the band above the board, its bottom edge on the board's top edge (never above the screen top)
 const park=()=>{if(!box)return;const R=c.getBoundingClientRect();box.style.top=Math.max(6,R.top-box.offsetHeight-2)+'px';box.style.visibility='visible';};park();
 timers.push(setTimeout(park,60));requestAnimationFrame(()=>box.classList.add('on'));
 const els=box.querySelectorAll('.st');
 els.forEach((e,k)=>timers.push(setTimeout(()=>{e.classList.add('in');if(k<n)tone([659,784,1047][k],.35,.06);else tone(196,.2,.03);},350+k*380)));
 timers.push(setTimeout(()=>box.querySelector('.best').classList.add('in'),350+3*380));
 timers.push(setTimeout(close,15000));feel._closeStars=close;}
const prev=feel.on;feel.on=function(name,d={}){prev.call(feel,name,d);if(name==='stars')show(d);
 if(name==='phase'&&d.phase!=='over'&&box&&feel._closeStars)feel._closeStars();};
})();

// ---------- share card (10101) ----------
// feel.share({title, line, board, N, url}) makes a square image of the final board with the result written on it,
// plus a short text result. Phones get the system share sheet (image and text); elsewhere the text goes to the
// clipboard and the image downloads. board is the final cell array (0 empty, 1 black, 2 white).
(function(){
const feel=window.feel;
function card(o){const W=1080,cv=document.createElement('canvas');cv.width=cv.height=W;const x=cv.getContext('2d'),T=feel.theme?feel.theme():null;
 x.fillStyle='#202020';x.fillRect(0,0,W,W);
 x.textAlign='center';x.fillStyle='#ddd';x.font='bold 64px monospace';
 x.shadowColor='#bbb';x.shadowBlur=18;x.fillStyle='#000';x.fillText('01010',W/2-220,110);x.shadowBlur=0;x.fillStyle='#bbb';x.fillText('vs',W/2,110);x.fillStyle='#fff';x.fillText('10101',W/2+220,110);
 x.fillStyle='#aaa';x.font='34px monospace';x.fillText(o.title||'',W/2,165);
 const N=o.N||64,B=720,ox=(W-B)/2,oy=195,S=B/N;
 x.fillStyle=T?T.bg:'#7c7f86';x.fillRect(ox,oy,B,B);
 if(o.board){for(let i=0;i<N*N;i++){const c=o.board[i];if(!c)continue;x.fillStyle=T?T.c[c].f:(c===1?'#0d0d10':'#f4f4f0');
  const px=ox+(i%N)*S,py=oy+((i/N)|0)*S;x.beginPath();x.roundRect?x.roundRect(px+.6,py+.6,S-1.2,S-1.2,S*.28):x.rect(px+.6,py+.6,S-1.2,S-1.2);x.fill();}}
 x.strokeStyle='#555';x.lineWidth=3;x.strokeRect(ox,oy,B,B);
 x.fillStyle='#ffd84a';x.font='bold 44px monospace';x.fillText(o.line||'',W/2,oy+B+82);
 x.fillStyle='#888';x.font='26px monospace';x.fillText(o.url?o.url.replace(/^https?:\/\//,'').replace(/#.*/,''):'plant a seed. start a war.',W/2,W-28);
 return cv;}
feel.shareCard=card;
// an 8x8 emoji map of the final board for pasting anywhere: each square shows whichever side has more cells in that 8x8 patch
feel.shareGrid=function(b,N){if(!b||!N)return '';const k=N/8|0;if(k<1)return '';let out=[];for(let Y=0;Y<8;Y++){let r='';for(let X=0;X<8;X++){let a=0,c=0;for(let y=Y*k;y<Y*k+k;y++)for(let x=X*k;x<X*k+k;x++){const v=b[y*N+x];if(v===1)a++;else if(v===2)c++;}r+=a+c===0?'\u2B1C':a>=c?'\u2B1B':'\uD83D\uDFE9';}out.push(r);}return out.join('\n');};
feel.share=async function(o){const text=[o.title,o.line,feel.shareGrid(o.board,o.N),o.url].filter(Boolean).join('\n');
 // the clipboard only accepts writes during the tap itself, so copy before any awaiting
 let copied=false;const cp=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(text).then(()=>copied=true,()=>{}):Promise.resolve();
 const cv=card(o);const blob=await new Promise(r=>cv.toBlob(r,'image/png'));const file=new File([blob],'freewill.png',{type:'image/png'});
 try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return 'shared';}
  if(navigator.share&&matchMedia('(pointer:coarse)').matches){await navigator.share({text});return 'shared';}}catch(e){if(e&&e.name==='AbortError')return 'cancelled';}
 await cp;
 // desktop: a small panel with the image and the text, with copy and save buttons that always work
 const old=document.getElementById('feel-share');if(old)old.remove();
 const url=URL.createObjectURL(blob),m=document.createElement('div');m.id='feel-share';
 m.style.cssText='position:fixed;inset:0;z-index:90;background:#000c;display:flex;align-items:center;justify-content:center;font-family:monospace';
 m.innerHTML=`<div style="background:#262626;border:1px solid #555;border-radius:12px;padding:16px;max-width:min(92vw,420px);text-align:center;color:#ddd">
  <img src="${url}" style="width:100%;border-radius:8px" alt="share card">
  <textarea readonly style="width:100%;box-sizing:border-box;margin:10px 0;height:72px;background:#1b1b1b;color:#eee;border:1px solid #444;font:13px monospace;padding:6px">${text.replace(/</g,'&lt;')}</textarea>
  <div style="font-size:12px;color:#ffd84a;min-height:1.2em" id="feel-share-msg">${copied?'text copied':''}</div>
  <button data-x="copy">copy text</button> <a download="freewill.png" href="${url}"><button>save image</button></a> <button data-x="close">close</button></div>`;
 document.body.appendChild(m);const ta=m.querySelector('textarea');ta.focus();ta.select();
 m.querySelectorAll('button').forEach(b=>b.style.cssText='font:14px monospace;margin:4px;padding:8px 12px;background:#333;color:#eee;border:1px solid #666;border-radius:6px;cursor:pointer');
 m.onclick=async e=>{const x=e.target.dataset&&e.target.dataset.x;if(e.target===m||x==='close'){m.remove();URL.revokeObjectURL(url);}
  if(x==='copy'){ta.select();let ok=false;try{await navigator.clipboard.writeText(text);ok=true;}catch(err){try{ok=document.execCommand('copy');}catch(e2){}}m.querySelector('#feel-share-msg').textContent=ok?'text copied':'select the text and copy it';}};
 return copied?'copied':'shown';};
})();

// ---------- living piece buttons (10101) ----------
// each shape button gets a tiny looping animation of what that piece does on its own over 24 generations,
// drawn from game.preview(), so players see a glider glide and an R-pentomino bloom before they spend points.
(function(){
const cache={},FR=24,PX=34;
function frames(i){if(cache[i])return cache[i];try{return cache[i]=window.game.preview(i,0,false,FR);}catch(e){return cache[i]=null;}}
function attach(btn){if(btn.querySelector('canvas.feel-pv'))return;const i=+btn.dataset.s,f=frames(i);if(!f)return;
 const c=document.createElement('canvas');c.className='feel-pv';c.width=c.height=PX*2;c.style.cssText=`width:${PX}px;height:${PX}px;vertical-align:middle;margin-right:6px;border-radius:5px;background:rgba(0,0,0,.25)`;
 c._f=f;c._k=0;btn.prepend(c);}
function draw(c){const f=c._f,fr=f[c._k%f.length],x=c.getContext('2d'),W=c.width;x.clearRect(0,0,W,W);
  if(!c._s){let m=2;for(const [a,b] of f[0])m=Math.max(m,Math.abs(a)+1,Math.abs(b)+1);c._s=Math.max(3,Math.floor(W/(2*m*(c.className==='feel-big'?3.5:1.5)+1)));} // sized to the starting piece; growth past the edge just runs off
 const s=c._s;const sel=c.parentNode&&c.parentNode.tagName==='BUTTON'&&c.parentNode.classList.contains('sel');
 x.fillStyle=sel?'#000':'#e8e8e8';
 // the view follows the piece's centre, so a glider stays in frame while you watch it wriggle
 let mx=0,my=0;for(const [a,b] of fr){mx+=a;my+=b;}if(fr.length){mx/=fr.length;my/=fr.length;}
 for(const [a,b] of fr)x.fillRect(W/2+(a-mx)*s-s/2,W/2+(b-my)*s-s/2,s-1,s-1);}
// a bigger loop of the selected piece sits at the start of its description line, where the eye already is
function big(){const tip=document.querySelector('#game-panel .tip'),selb=document.querySelector('#game-panel button.sel[data-s]');if(!tip||!selb)return;
 let c=tip.querySelector('canvas.feel-big');const i=+selb.dataset.s;
 if(!c||c._i!==i){if(c)c.remove();const f=frames(i);if(!f)return;c=document.createElement('canvas');c.className='feel-big';c.width=c.height=160;
  c.style.cssText='display:block;margin:6px auto 4px;width:80px;height:80px;border-radius:8px;background:rgba(0,0,0,.3);border:1px solid #444';c._f=f;c._k=0;c._i=i;tip.prepend(c);}
 return c;}
let t=0;(function loop(ts){requestAnimationFrame(loop);if(ts-t<110)return;t=ts;
 document.querySelectorAll('#game-panel button[data-s]').forEach(b=>{attach(b);const c=b.querySelector('canvas.feel-pv');if(!c)return;
  if(b.disabled){c._k=0;c.style.opacity=.35;draw(c);return;}c.style.opacity=1;c._k=(c._k+1)%c._f.length;draw(c);});
 const g=big();if(g){g._k=(g._k+1)%g._f.length;draw(g,true);}
})(0);
})();

// ---------- rival cards (10101) ----------
// game.js sends feel.on('opponent',{name, blurb, cells, record}) before a game against a named rival.
// cells: [[x,y],...] on the 64x64 board (the rival's own half). record (optional): {wins, losses} against this rival.
// a card slides in over the board with the rival's name, a mini picture of its layout and its personality line.
(function(){
const feel=window.feel;
const css=`#feel-rival{position:fixed;z-index:76;left:50%;top:50%;transform:translate(-50%,-50%) scale(.85);opacity:0;transition:all .35s cubic-bezier(.3,1.4,.5,1);
 background:#262626;border:1px solid #666;border-radius:14px;padding:16px 18px 14px;width:min(86vw,340px);text-align:center;font-family:monospace;color:#ddd;box-shadow:0 10px 40px #000c;cursor:pointer}
#feel-rival.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
#feel-rival .vs{font-size:12px;letter-spacing:3px;color:#999}
#feel-rival .nm{font:bold 24px monospace;color:#fff;margin:4px 0 8px}
#feel-rival canvas{width:100%;border-radius:8px;border:1px solid #444;display:block}
#feel-rival .bl{font-size:13px;color:#ccc;margin:10px 0 4px;line-height:1.4}
#feel-rival .rc{font-size:12px;color:#ffd84a}
#feel-rival .go{font-size:11px;color:#888;margin-top:8px}`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
let el=null,tm=0;
function hide(){if(!el)return;el.classList.remove('on');const e=el;el=null;setTimeout(()=>e.remove(),350);}
function show(d){hide();clearTimeout(tm);el=document.createElement('div');el.id='feel-rival';
 const rec=d.record&&(d.record.wins||d.record.losses)?`against them you've won ${d.record.wins||0} and lost ${d.record.losses||0}`:'first meeting';
 el.innerHTML=`<div class="vs">YOUR RIVAL</div><div class="nm"></div><canvas width="640" height="320"></canvas><div class="bl"></div><div class="rc">${rec}</div><div class="go">tap to start building</div>`;
 el.querySelector('.nm').textContent=d.name||'Unknown';el.querySelector('.bl').textContent=d.blurb||'';
 document.body.appendChild(el);
 // mini picture of the rival's half, drawn with the current theme
 const cv=el.querySelector('canvas'),x=cv.getContext('2d'),T=feel.theme?feel.theme():null,S=10;
 const cells=d.cells||[];let minY=64;for(const [,y] of cells)minY=Math.min(minY,y);const oy=minY>=32?32:0;
 x.fillStyle=T?T.bg:'#7c7f86';x.fillRect(0,0,640,320);
 x.fillStyle=T?T.c[2].f:'#f4f4f0';for(const [cx,cy] of cells){const yy=cy-oy;if(yy<0||yy>=32)continue;x.beginPath();x.roundRect?x.roundRect(cx*S+1,yy*S+1,S-2,S-2,3):x.rect(cx*S+1,yy*S+1,S-2,S-2);x.fill();}
 requestAnimationFrame(()=>el&&el.classList.add('on'));
 tm=setTimeout(hide,4500);
 if(!(feel.muted&&feel.muted()))try{const a=window.__fwac||(window.__fwac=new (window.AudioContext||window.webkitAudioContext)());[196,233,294].forEach((f,k)=>{const o=a.createOscillator(),g=a.createGain();o.type='sawtooth';o.frequency.value=f;g.gain.setValueAtTime(.035,a.currentTime+k*.12);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+k*.12+.3);o.connect(g).connect(a.destination);o.start(a.currentTime+k*.12);o.stop(a.currentTime+k*.12+.32);});}catch(e){}}
// while the card is up, any tap anywhere just closes it: the tap is swallowed in the capture phase, before the board or tray
// sees it, and so are the rest of that tap's events (pointerup, touchend, the click that follows) for a moment after
let swallowUntil=0;
// buttons in the game panel (ready, starter layout, rotate...) still work: the tap closes the card and goes through. tray pieces don't
const passes=e=>{const t=e.target&&e.target.closest&&e.target.closest('#game-panel button');return !!t&&!t.closest('#g-tray');};
const eat=e=>{const now=performance.now();if(el){hide();clearTimeout(tm);if(passes(e)){swallowUntil=0;return;}swallowUntil=now+600;}else if(now>swallowUntil||passes(e))return;
 if(e.cancelable)e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();};
['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click','contextmenu'].forEach(t=>window.addEventListener(t,eat,{capture:true,passive:false}));
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);if(n==='opponent')show(d);if(n==='phase'&&d.phase==='run')hide();};
})();

// ---------- accessibility toggles on the title screen (10101) ----------
(function(){
const st=document.createElement('style');st.textContent=`html.fw-calm #feel-stars .st,html.fw-calm #feel-rival,html.fw-calm #feel-banner,html.fw-calm #feel-title{transition:none !important}
html.fw-calm #feel-stars .st{transform:none !important}
#feel-a11y{position:relative;margin-top:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#feel-title #feel-a11y button{min-width:0 !important;font-size:12px !important;padding:6px 10px !important;margin:0 !important;background:#2a2a2a;color:#bbb}`;
document.head.appendChild(st);
const apply=()=>{document.documentElement.classList.toggle('fw-calm',FW_A11Y.calm);localStorage.setItem('fw-a11y',JSON.stringify(FW_A11Y));};apply();
const t=document.getElementById('feel-title'),rules=document.getElementById('feel-rules');if(!t||!rules)return;
const row=document.createElement('div');row.id='feel-a11y';
const mk=(key,label)=>{const b=document.createElement('button');const lab=()=>b.textContent=`${label}: ${FW_A11Y[key]?'on':'off'}`;lab();
 b.onclick=e=>{e.stopPropagation();FW_A11Y[key]=!FW_A11Y[key];apply();lab();};return b;};
row.append(mk('marks','marked cells'),mk('calm','calm mode'));rules.after(row);
})();

// ---------- replays and looping share clips (10101) ----------
// every generation drawn during a run is kept (64x64 bytes each, about 4 KB). after the run, a bar under the board offers
// "watch the turning point" (an overlay replay, so the real board is never touched) and "share clip" (a looping GIF).
(function(){
let frames=[],rec=false,tp=null,lastRec=null;
const draw0=feel.drawCells;
feel.drawCells=function(ctx,g,...r){
 if(rec&&g!==lastRec&&window.game){lastRec=g;try{frames[game._state().gen]=g.slice();}catch(e){}}
 return draw0.call(this,ctx,g,...r);};
const fr=k=>{for(let j=k;j>=0;j--)if(frames[j])return frames[j];return frames.find(Boolean);};
const lastGen=()=>frames.length-1;
const cols=()=>{const T=feel.theme?feel.theme():null;return{bg:T?T.bg:'#7f8189',a:T?T.c[1].f:'#2a2a2a',b:T?T.c[2].f:'#f4f4f4'};};
function paint(x,g,S,ox,oy,N){const C=cols();x.fillStyle=C.bg;x.fillRect(ox,oy,N*S,N*S);
 for(const [c,f] of [[1,C.a],[2,C.b]]){x.fillStyle=f;for(let i=0;i<g.length;i++)if(g[i]===c)x.fillRect(ox+(i%N)*S+1,oy+((i/N)|0)*S+1,S-1,S-1);}
 if(FW_A11Y.marks){x.fillStyle=C.a;for(let i=0;i<g.length;i++)if(g[i]===2)x.fillRect(ox+(i%N)*S+S/2-1,oy+((i/N)|0)*S+S/2-1,2,2);}}
const count=g=>{let a=0,b=0;for(const v of g){if(v===1)a++;else if(v===2)b++;}return[a,b];};
const span=()=>{const L=lastGen();if(tp==null)return[Math.max(0,L-48),L];return[Math.max(0,tp-24),Math.min(L,tp+24)];};

// --- the bar under the board ---
const st=document.createElement('style');st.textContent=`#feel-replay{display:none;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0}
#feel-replay.on{display:flex}#feel-replay button{font:14px monospace;padding:8px 12px;background:#333;color:#eee;border:1px solid #666;border-radius:8px;cursor:pointer}
#feel-rp{position:absolute;z-index:40;border-radius:6px;cursor:pointer;touch-action:manipulation}
#feel-rp-lab{position:absolute;z-index:41;pointer-events:none;font:bold 14px monospace;color:#fff;background:#000b;padding:4px 10px;border-radius:6px;transform:translateX(-50%);white-space:nowrap}`;
document.head.appendChild(st);
const bar=document.createElement('div');bar.id='feel-replay';
bar.innerHTML='<button data-r="watch">▶ watch the turning point</button><button data-r="clip">share clip</button>';
const place=()=>{const c=document.getElementById('c');if(c&&bar.parentNode!==c.parentNode)c.after(bar);};
bar.onclick=e=>{const k=e.target.dataset&&e.target.dataset.r;if(k==='watch')watch();if(k==='clip')clip(e.target);};

// --- replay overlay ---
let rpTimer=null;
function stop(){clearTimeout(rpTimer);['feel-rp','feel-rp-lab'].forEach(id=>{const e=document.getElementById(id);if(e)e.remove();});}
function watch(){stop();const c=document.getElementById('c');if(!c||!frames.length)return;const R=c.getBoundingClientRect(),N=Math.round(Math.sqrt(fr(0).length)),S=8;
 const o=document.createElement('canvas');o.id='feel-rp';o.width=o.height=N*S;o.title='tap to close';
 Object.assign(o.style,{left:R.left+scrollX+'px',top:R.top+scrollY+'px',width:R.width+'px',height:R.height+'px'});
 const lab=document.createElement('div');lab.id='feel-rp-lab';Object.assign(lab.style,{left:R.left+scrollX+R.width/2+'px',top:R.top+scrollY+8+'px'});
 document.body.append(o,lab);o.onclick=stop;const x=o.getContext('2d');let [k,end]=span();
 const tick=()=>{const g=fr(k);paint(x,g,S,0,0,N);const [a,b]=count(g);const at=tp!=null&&k===tp;
  lab.textContent=at?`generation ${k}: the lead changes here`:`generation ${k}   black ${a} : white ${b}`;lab.style.color=at?'#ffd84a':'#fff';
  if(at&&!FW_A11Y.calm){x.strokeStyle='#ffd84a';x.lineWidth=6;x.strokeRect(3,3,N*S-6,N*S-6);}
  if(k>=end){rpTimer=setTimeout(stop,1800);return;}
  const near=tp!=null&&Math.abs(k-tp)<=4;k++;rpTimer=setTimeout(tick,at?1400:near?320:110);};
 tick();}

// --- GIF encoder: flat palette, LZW, looping ---
function gif(w,h,frs,pal,delays){const out=[];const b=v=>out.push(v&255),w16=v=>{b(v);b(v>>8);};
 'GIF89a'.split('').forEach(ch=>b(ch.charCodeAt(0)));w16(w);w16(h);b(0xF2);b(0);b(0); // global table of 8 colours
 for(let i=0;i<8;i++){const p=pal[i]||[0,0,0];b(p[0]);b(p[1]);b(p[2]);}
 b(0x21);b(0xFF);b(11);'NETSCAPE2.0'.split('').forEach(ch=>b(ch.charCodeAt(0)));b(3);b(1);w16(0);b(0); // loop forever
 frs.forEach((px,fi)=>{b(0x21);b(0xF9);b(4);b(0);w16(delays[fi]);b(0);b(0);
  b(0x2C);w16(0);w16(0);w16(w);w16(h);b(0);const min=3;b(min);
  const data=[];let cur=0,bits=0,size=min+1;const clear=1<<min,eoi=clear+1;let next=eoi+1,dict=new Map();
  const put=c=>{cur|=c<<bits;bits+=size;while(bits>=8){data.push(cur&255);cur>>=8;bits-=8;}};
  put(clear);let pre=px[0];
  for(let i=1;i<px.length;i++){const k=px[i],key=pre*256+k,v=dict.get(key);
   if(v!==undefined){pre=v;continue;}put(pre);
   if(next<4096){if(next>=(1<<size))size++;dict.set(key,next++);}else{put(clear);dict.clear();size=min+1;next=eoi+1;}
   pre=k;}
  put(pre);put(eoi);if(bits>0)data.push(cur&255);
  for(let i=0;i<data.length;i+=255){const n=Math.min(255,data.length-i);b(n);for(let j=0;j<n;j++)out.push(data[i+j]);}b(0);});
 b(0x3B);return new Uint8Array(out);}
feel._gif=gif;
const hex=s=>{const m=/^#?([0-9a-f]{6})/i.exec(s||'');const n=m?parseInt(m[1],16):0;return[n>>16,(n>>8)&255,n&255];};
function makeClip(){const N=Math.round(Math.sqrt(fr(0).length)),S=5,W=N*S,H=W+28,C=cols();
 const pal=[hex(C.bg),hex(C.a),hex(C.b),[255,216,74],[24,24,24],[255,255,255],[136,136,136],[60,60,60]];
 const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
 const near=(r,g,bl)=>{let bi=0,bd=1e9;for(let i=0;i<pal.length;i++){const p=pal[i],d=(p[0]-r)**2+(p[1]-g)**2+(p[2]-bl)**2;if(d<bd){bd=d;bi=i;}}return bi;};
 const [s,e]=span(),out=[],dl=[];
 for(let k=s;k<=e;k++){const g=fr(k),[a,b2]=count(g),tot=Math.max(1,a+b2);
  x.fillStyle='#181818';x.fillRect(0,0,W,28);x.fillStyle=C.a;x.fillRect(0,22,W*a/tot,6);x.fillStyle=C.b;x.fillRect(W*a/tot,22,W,6);
  x.font='bold 13px monospace';x.textBaseline='top';x.fillStyle=k===tp?'#ffd84a':'#ffffff';x.textAlign='left';
  x.fillText(k===tp?'the lead changes!':`01010 ${a}`,6,4);x.textAlign='right';x.fillText(k===tp?`gen ${k}`:`${b2} 10101`,W-6,4);
  paint(x,g,S,0,28,N);if(k===tp){x.strokeStyle='#ffd84a';x.lineWidth=3;x.strokeRect(1.5,29.5,W-3,W-3);}
  const d=x.getImageData(0,0,W,H).data,px=new Uint8Array(W*H),memo=new Map();
  for(let i=0;i<px.length;i++){const key=(d[i*4]<<16)|(d[i*4+1]<<8)|d[i*4+2];let v=memo.get(key);if(v===undefined){v=near(d[i*4],d[i*4+1],d[i*4+2]);memo.set(key,v);}px[i]=v;}
  out.push(px);dl.push(k===tp?120:k===e?160:Math.abs(k-(tp??-99))<=3?20:8);}
 return new Blob([gif(W,H,out,pal,dl)],{type:'image/gif'});}
feel.makeClip=makeClip;
async function clip(btn){if(!frames.length)return;const old=btn.textContent;btn.textContent='making clip…';await new Promise(r=>setTimeout(r,30));
 let blob;try{blob=makeClip();}catch(e){console.warn(e);btn.textContent=old;return;}btn.textContent=old;
 const text='FreeWill: watch the lead change hands'+(location.protocol.startsWith('http')?'\n'+location.origin+location.pathname:'');
 const file=new File([blob],'freewill.gif',{type:'image/gif'});
 try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],text});return;}}catch(e){if(e&&e.name==='AbortError')return;}
 const url=URL.createObjectURL(blob),m=document.createElement('div');m.id='feel-share';
 m.style.cssText='position:fixed;inset:0;z-index:90;background:#000c;display:flex;align-items:center;justify-content:center;font-family:monospace';
 m.innerHTML=`<div style="background:#262626;border:1px solid #555;border-radius:12px;padding:16px;max-width:min(92vw,420px);text-align:center;color:#ddd">
  <img src="${url}" style="width:100%;border-radius:8px;image-rendering:pixelated" alt="looping replay of the game"><div style="margin:8px 0;font-size:12px;color:#aaa">a looping clip of the turning point</div>
  <a download="freewill.gif" href="${url}"><button>save clip</button></a> <button data-x="close">close</button></div>`;
 document.body.appendChild(m);m.querySelectorAll('button').forEach(b=>b.style.cssText='font:14px monospace;margin:4px;padding:8px 12px;background:#333;color:#eee;border:1px solid #666;border-radius:6px;cursor:pointer');
 m.onclick=e=>{if(e.target===m||(e.target.dataset&&e.target.dataset.x==='close')){m.remove();URL.revokeObjectURL(url);}};}

const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);
 if(n==='phase'){if(d.phase==='run'){frames=[];tp=null;lastRec=null;rec=true;stop();bar.classList.remove('on');}
  else{rec=false;if(d.phase!=='over'){bar.classList.remove('on');stop();}}}
 if(n==='turningPoint'){rec=false;tp=d.gen;place();bar.querySelector('[data-r=watch]').textContent=tp==null?'▶ watch the ending':'▶ watch the turning point';if(frames.length>5)bar.classList.add('on');}
};
feel._replay={frames:()=>frames,tp:()=>tp};
// generations computed without being drawn (skip to the end) can still be recorded, so the replay, clip and field guide see them
feel.recordFrame=(gen,g)=>{if(rec&&g)frames[gen]=g.slice?g.slice():g;};
})();

// ---------- end-screen clarity (10101): gold primary button, tray scroll hint, replay bar cleanup ----------
(function(){
const st=document.createElement('style');st.textContent=`#game-panel button[data-a=nextm],#game-panel button[data-a=next]:not([disabled]),#game-panel button[data-a=again],#game-panel button[data-a=retry]:first-child{background:#ffd84a !important;color:#000 !important;font-weight:bold;border:2px solid #fff6c8 !important}
#feel-more{position:fixed;z-index:29;width:30px;height:30px;border-radius:50%;background:#ffd84a;color:#000;font:bold 20px/28px monospace;text-align:center;box-shadow:0 2px 8px #000a;cursor:pointer;display:none;user-select:none}
@media (pointer:coarse),(max-width:700px){
 body > #feel-tools{padding-right:calc(10px + 44vw) !important}
 body > #feel-tools > *{min-width:0 !important;flex:0 1 auto}
 #game-panel button[data-a=ready]{max-width:42vw;min-width:110px;white-space:normal;line-height:1.15}
}`;document.head.appendChild(st);
const more=document.createElement('div');more.id='feel-more';more.textContent='›';more.title='more pieces';document.body.appendChild(more);
more.onclick=()=>{const t=document.getElementById('g-tray');if(t)t.scrollBy({left:t.clientWidth*.7,behavior:'smooth'});};
let peeked=false;
setInterval(()=>{const t=document.getElementById('g-tray');let show=false;
 if(t&&t.offsetParent){const over=t.scrollWidth>t.clientWidth+4,end=t.scrollLeft+t.clientWidth>=t.scrollWidth-4;show=over&&!end;
  if(show){const R=t.getBoundingClientRect();more.style.left=(R.right-34)+'px';more.style.top=(R.top+R.height/2-15)+'px';
   // the first time the tray overflows, nudge it so the row visibly moves
   if(!peeked&&!(window.FW_A11Y&&FW_A11Y.calm)){peeked=true;t.scrollBy({left:60,behavior:'smooth'});setTimeout(()=>t.scrollBy({left:-60,behavior:'smooth'}),550);}}}
 more.style.display=show?'block':'none';
 // the 'round 1 of 3' strip only belongs to quick matches, two-player matches and arena runs
 const rs=document.getElementById('feel-round');
 if(rs&&rs.style.visibility!=='hidden'&&window.game){let S;try{S=game._state();}catch(e){}if(S&&!S.arena&&((feel._mode&&!['cpu','hotseat','arena'].includes(feel._mode))||S.mode==='campaign'||S.phase==='menu'||S.phase==='idle'))rs.style.visibility='hidden';}
 // the replay bar only belongs on the result screen of a run
 const bar=document.getElementById('feel-replay');
 if(bar&&bar.classList.contains('on')&&window.game){let ph;try{ph=game._state().phase;}catch(e){}if(ph&&ph!=='over')bar.classList.remove('on');}
},300);
})();

// ---------- pinned next step and gated title modes (10101) ----------
(function(){
const st=document.createElement('style');st.textContent=`
/* the next step lives where "ready" lives: pinned bottom-right on phones, sticky at the bottom edge on desktop */
@media (pointer:coarse),(max-width:700px){
 :root{--fw-bar:80px}
 #game-panel button[data-a=nextm],#game-panel button[data-a=next]:not([disabled]),#game-panel button[data-a=retry]:first-child,#game-panel button[data-a=again]{position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:31;margin:0 !important;max-width:42vw;min-width:110px;white-space:normal;line-height:1.15;font-size:14px !important}
}
@media (pointer:fine) and (min-width:701px){
 #game-panel button[data-a=nextm],#game-panel button[data-a=next]:not([disabled]),#game-panel button[data-a=again]{position:sticky;bottom:12px;z-index:31;box-shadow:0 4px 18px #000c}
}
#feel-title button.fw-locked{display:none !important}
/* after a match win, moving up a tier takes the gold pinned slot and "new match" steps back to an ordinary button */
html.fw-won #game-panel button[data-a=harder]{background:#ffd84a !important;color:#000 !important;font-weight:bold;border:2px solid #fff6c8 !important}
html.fw-won #game-panel:has(button[data-a=harder]) button[data-a=again]{position:static !important;background:#333 !important;color:#eee !important;font-weight:normal;border:1px solid #666 !important;box-shadow:none;max-width:none}
@media (pointer:coarse),(max-width:700px){html.fw-won #game-panel button[data-a=harder]{position:fixed;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:31;margin:0 !important;max-width:42vw;min-width:110px;white-space:normal;line-height:1.15;font-size:14px !important}}
@media (pointer:fine) and (min-width:701px){html.fw-won #game-panel button[data-a=harder]{position:sticky;bottom:12px;z-index:31;box-shadow:0 4px 18px #000c}}
#feel-unlock-note{font:12px monospace;color:#ccc;margin:6px auto 0;text-align:center;background:rgba(20,20,20,.8);padding:4px 10px;border-radius:8px;width:max-content;max-width:86vw}`;
document.head.appendChild(st);
function gate(){const t=document.getElementById('feel-title');if(!t||!window.game||!game.unlocked)return false;
 let open;try{open=game.unlocked();}catch(e){return false;}if(!Array.isArray(open))return false;
 let hidden=0;t.querySelectorAll('button[data-mode]').forEach(b=>{const lock=!open.includes(b.dataset.mode);b.classList.toggle('fw-locked',lock);if(lock)hidden++;});
 let note=document.getElementById('feel-unlock-note');
 if(hidden){if(!note){note=document.createElement('div');note.id='feel-unlock-note';const last=[...t.querySelectorAll('button[data-mode]')].pop();last&&last.after(note);}
  note.textContent='🔒 daily, arena and quick match: finish mission 2';}
 else if(note)note.remove();
 return true;}
// game.js may load after this file, so retry until it answers, then re-check whenever we return to the title
let tries=0;const iv=setInterval(()=>{if(gate()||++tries>50)clearInterval(iv);},100);
document.addEventListener('DOMContentLoaded',()=>{if(gate())clearInterval(iv);});
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);if(n==='phase'&&d.phase==='title')gate();
 if(n==='matchWinner')document.documentElement.classList.toggle('fw-won',d.winner===1);if(n==='phase'&&d.phase==='setup')document.documentElement.classList.remove('fw-won');if(n==='stars')setTimeout(gate,0);};
feel.gateModes=gate;
// the lab (free build, sandbox.html) gets a quiet link once game.unlocked() includes 'lab'
const LAB_READY=true; // lab.html: free build with the game's own rules
function lab(){const t=document.getElementById('feel-title');if(!LAB_READY||!t||!window.game||!game.unlocked)return;let open=[];try{open=game.unlocked()||[];}catch(e){}
 let b=document.getElementById('feel-lab');if(!open.includes('lab')){if(b)b.remove();return;}
 if(!b){b=document.createElement('button');b.id='feel-lab';b.innerHTML='lab<small>free build: no point limit, step by step</small>';b.onclick=e=>{e.stopPropagation();location.href='lab.html';};
  const hs=t.querySelector('button[data-mode=hotseat]');hs&&hs.after(b);}}
document.addEventListener('DOMContentLoaded',lab);setTimeout(lab,300);
{const p2=feel.on;feel.on=function(n,d={}){p2.call(feel,n,d);if(n==='phase'&&d.phase==='title')lab();};}
})();

// ---------- the gold slot is decided as the end screen is drawn (10101) ----------
// a MutationObserver runs before the next paint, so there is never a moment where the wrong button is gold
(function(){const mark=()=>{const p=document.getElementById('game-panel');if(!p||!p.querySelector('button[data-a=harder]'))return;
 let won=false;try{const m=game._state().match;won=!!(m&&m.score&&m.score[0]>m.score[1]);}catch(e){}
 document.documentElement.classList.toggle('fw-won',won);};
 new MutationObserver(mark).observe(document.body,{childList:true,subtree:true});})();

// ---------- one-time setup tip over the board (10101) ----------
// the long goal paragraph under the pieces ran under the phone bar; on phones it becomes a short card over the board,
// shown the first time you build in a match and gone after your first piece
(function(){
const st=document.createElement('style');st.textContent=`@media (pointer:coarse),(max-width:700px){#game-panel .tip{display:none}body{padding-bottom:calc(96px + env(safe-area-inset-bottom)) !important}}
#feel-tip{position:fixed;z-index:45;left:50%;transform:translateX(-50%);width:min(88vw,420px);box-sizing:border-box;background:rgba(20,20,20,.92);border:1px solid #ffd84a88;border-radius:12px;padding:10px 14px;font:13px/1.45 monospace;color:#eee;pointer-events:none}
#feel-tip b{color:#ffd84a}`;document.head.appendChild(st);
const phone=()=>matchMedia('(pointer:coarse),(max-width:700px)').matches;
let tip=null;const hide=()=>{if(tip){tip.remove();tip=null;}};
function show(){if(!phone()||localStorage.getItem('fw-tip-setup'))return;try{const m=game._state().match;if(m&&m.round>1)return;}catch(e){}const c=document.getElementById('c');if(!c)return;hide();
 const R=c.getBoundingClientRect(),tap=matchMedia('(pointer:coarse)').matches?'tap':'click';
 // same wording as game.js's own hints: game.rc() when it exists, otherwise the same pointer check
 let rc;try{rc=game.rc();}catch(e){}if(!rc){const f=matchMedia('(any-pointer:fine)').matches,co=matchMedia('(any-pointer:coarse)').matches;rc=f&&co?'Long-press or right-click':co?'Long-press':'Right-click';}
 tip=document.createElement('div');tip.id='feel-tip';
 tip.innerHTML=`<b>Goal:</b> have more cells than the other colour when the run ends. Outnumbered cells switch sides. Best of 3 rounds.<br><b>Build:</b> ${tap} your outlined half to place the piece picked in gold below. ${rc} a piece to remove it.<br><b>During the run:</b> ${tap} the board to launch your free-will gliders.`;
 tip.style.top=(R.top+R.height*0.55)+'px';document.body.appendChild(tip);}
let mode=null;
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);
 if(n==='mode')mode=d.mode;
 if(n==='phase'){if(d.phase==='setup'&&['cpu','hotseat','arena','daily','challenge'].includes(mode))setTimeout(show,50);else hide();}
 if(n==='place'&&tip){localStorage.setItem('fw-tip-setup','1');hide();}};
addEventListener('pointerdown',e=>{if(tip&&e.target&&e.target.id==='c'){localStorage.setItem('fw-tip-setup','1');hide();}},{capture:true});
})();

// ---------- test-run overlay (10101) ----------
// game.js calls feel.drawTestRun(ctx, cells, S, N) while the test run plays: hollow outlines in each side's colour,
// so the simulated cells never look like real ones (and marked cells keep their dot)
feel.drawTestRun=function(ctx,cells,S,N){const T=feel.theme?feel.theme():null,col=c=>T?T.c[c].f:(c===1?'#2a2a2a':'#f4f4f4');
 ctx.save();
 // veil the real layout first, so the outlines read as 'what would happen' rather than mixing with the cells you placed
 ctx.globalAlpha=.86;ctx.fillStyle=T?T.bg:'#7f8189';ctx.fillRect(0,0,N*S,N*S);
 ctx.lineWidth=Math.max(1,S*.16);ctx.globalAlpha=.9;
 for(const c of [1,2]){ctx.strokeStyle=col(c);ctx.beginPath();
  for(let i=0;i<cells.length;i++)if(cells[i]===c){const x=(i%N)*S,y=((i/N)|0)*S,p=ctx.lineWidth/2+S*.12;ctx.rect(x+p,y+p,S-2*p,S-2*p);}
  ctx.stroke();}
 if(window.FW_A11Y&&FW_A11Y.marks){ctx.fillStyle=col(1);for(let i=0;i<cells.length;i++)if(cells[i]===2)ctx.fillRect((i%N)*S+S/2-1,((i/N)|0)*S+S/2-1,2,2);}
 ctx.restore();};

// ---------- leftovers from the last screen (10101) ----------
(function(){
const st=document.createElement('style');st.textContent=`@media (pointer:coarse),(max-width:700px){
 /* toasts game.js tags with .fw-toast (like "You still have N points") sit right above the pinned ready button */
 #game-panel .fw-toast{position:fixed;left:8px;right:calc(42vw + 22px);bottom:calc(6px + env(safe-area-inset-bottom));z-index:32;min-height:44px;box-sizing:border-box;display:flex;align-items:center;margin:0 !important;background:#1e1e1e;border:1px solid #fc6;border-radius:8px;padding:4px 8px;font-size:12px;line-height:1.25;text-align:left}}`;
document.head.appendChild(st);
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);
 // a new setup starts clean: no achievement or level banner carried over from the last run
 if(n==='phase'&&d.phase==='setup'){const b=document.getElementById('feel-banner');if(b&&!b.dataset.keep)b.classList.remove('on');}};
// the star strip belongs to the mission result: close it once you leave for the missions screen or anywhere else
setInterval(()=>{if(!feel._closeStars||!document.getElementById('feel-stars')||!window.game)return;let ph;try{ph=game._state().phase;}catch(e){}if(ph&&ph!=='over')feel._closeStars();},300);
})();

// ---------- match-end: keep "what did each piece do?" clear of the phone bar (10101) ----------
// if that row lands half under the bottom bar, nudge the page just enough to show it whole (at most 200 px, once per screen)
(function(){let done=false;
const fit=()=>{if(done||!matchMedia('(pointer:coarse),(max-width:700px)').matches)return;let S;try{S=game._state();}catch(e){return;}
 if(!S||S.phase!=='over'||S.mode==='campaign')return;const b=document.querySelector('#game-panel button[data-a=rev]'),bar=document.getElementById('feel-tools');if(!b||!bar)return;
 const line=bar.getBoundingClientRect().top-8,R=b.getBoundingClientRect();
 if(R.top<line&&R.bottom>line){const d=R.bottom-line;if(d<=200){done=true;scrollBy({top:d,behavior:'smooth'});}}
 else if(R.bottom<=line)done=true;};
new MutationObserver(()=>setTimeout(fit,50)).observe(document.body,{childList:true,subtree:true});
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);if(n==='phase'&&d.phase!=='over')done=false;};
})();

// ---------- level line on the title (10101) ----------
// returning players see their progress first thing, and it doubles as the way into the missions list
(function(){
const st=document.createElement('style');st.textContent=`#feel-title button#feel-level{min-width:0 !important;background:rgba(20,20,20,.75);color:#ffd84a;border:1px solid #ffd84a55;font-size:13px !important;padding:6px 14px !important;margin:6px auto 4px !important;display:block}`;
document.head.appendChild(st);
function put(){const t=document.getElementById('feel-title');if(!t||!window.game||!game.progress)return false;let p;try{p=game.progress();}catch(e){return false;}
 let b=document.getElementById('feel-level');
 if(!p||!p.total){if(b)b.remove();return true;}
 if(!b){b=document.createElement('button');b.id='feel-level';const play=t.querySelector('button[data-mode=campaign]');if(!play)return false;play.after(b);
  b.onclick=e=>{e.stopPropagation();t.classList.add('hide');feel.dockTools&&feel.dockTools();if(feel.onStart)feel.onStart('menu');};}
 const rt=p.rating&&p.rating!==1000;b.title='missions and progress';
 b.textContent=rt?`Level ${p.level} \u00b7 ${p.xp}/${p.next} \u00b7 ${p.stars}\u2605 \u00b7 rating ${Math.round(p.rating)} \u203a`:`Level ${p.level} \u00b7 ${p.xp}/${p.next} XP \u00b7 ${p.stars}\u2605 \u00b7 missions \u203a`;return true;}
document.addEventListener('DOMContentLoaded',put);addEventListener('load',()=>setTimeout(put,200));let k=0;const iv=setInterval(()=>{if(put()||++k>50)clearInterval(iv);},100);
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);if(n==='phase'&&d.phase==='title')put();};
addEventListener('storage',()=>put());
})();

// ---------- pattern field guide (10101) ----------
// when a run ends, the recorded generations are scanned for separate shapes; known ones (in any rotation, mirror or
// phase) are named, first sightings go into a collection saved in fw-seen (merged across tabs like the themes)
(function(){
const LIB=[
 ['block','Block','still life','The smallest thing that never changes. Four cells holding each other up.',['XX','XX']],
 ['beehive','Beehive','still life','A six-cell ring. One of the most common leftovers of any fight.',['.XX.','X..X','.XX.']],
 ['loaf','Loaf','still life','A beehive with a bite taken out. Stable forever.',['.XX.','X..X','.X.X','..X.']],
 ['boat','Boat','still life','Five cells. Add a glider to it and things get interesting.',['XX.','X.X','.X.']],
 ['tub','Tub','still life','Four cells in a diamond, an empty heart in the middle.',['.X.','X.X','.X.']],
 ['ship','Ship','still life','A boat with an extra cell. Still going nowhere.',['XX.','X.X','.XX']],
 ['pond','Pond','still life','A bigger ring of eight. Rarer than a beehive.',['.XX.','X..X','X..X','.XX.']],
 ['blinker','Blinker','oscillator','Three in a row, flipping between flat and tall every generation.',['XXX']],
 ['toad','Toad','oscillator','Two offset rows that breathe in and out, period 2.',['.XXX','XXX.']],
 ['beacon','Beacon','oscillator','Two blocks touching at a corner, blinking their inner cells.',['XX..','XX..','..XX','..XX']],
 ['pulsar','Pulsar','oscillator','The famous period-3 flower. 48 cells at its biggest.',['..XXX...XXX..','.............','X....X.X....X','X....X.X....X','X....X.X....X','..XXX...XXX..','.............','..XXX...XXX..','X....X.X....X','X....X.X....X','X....X.X....X','.............','..XXX...XXX..']],
 ['glider','Glider','spaceship','Five cells that walk diagonally forever. Your free will is one.',['.X.','..X','XXX']],
 ['lwss','Lightweight spaceship','spaceship','Flies straight across the board, period 4.',['.X..X','X....','X...X','XXXX.']],
 ['wraparound','The wraparound','strategy','R-pentominoes on both edge rows of your half. The top and bottom edges are joined, so they invade from two sides at once. Strong, but not free: see the edge shield.',null],
 ['shield','The edge shield','strategy','Blocks lining your outer rows with two R-pentominoes in the middle. Blocks on the contact line never flip and win the births there, so invaders turn into your cells. Beats the wraparound about 3 times in 4.',null],
];
// --- strategies, read from the opening board (frame 0) of either side ---
let RKEY,BKEY;
function strategies(g0,N){if(!g0)return[];if(!RKEY){RKEY=canon([[1,0],[2,0],[0,1],[1,1],[1,2]]);BKEY=canon([[0,0],[1,0],[0,1],[1,1]]);}const half=N/2,out=new Set();
 for(const side of [1,2]){const sub=new Int8Array(g0.length);for(let i=0;i<g0.length;i++)if(g0[i]===side)sub[i]=1;
  // rows counted from the side's own outer edge: 0 = the wrapped edge, half-1 = the contact line
  const rel=y=>side===1?y:N-1-y;let rEdgeOut=0,rEdgeIn=0,rMid=0,bEdge=0;
  for(const pts of shapes(sub,N)){const k=canon(pts),ys=pts.map(p=>rel(((p[1]%N)+N)%N)),lo=Math.min(...ys),hi=Math.max(...ys);
   if(hi>=half)continue;
   if(k===RKEY){if(lo<=2)rEdgeOut++;else if(hi>=half-3)rEdgeIn++;else rMid++;}
   if(k===BKEY&&(lo<=2||hi>=half-3))bEdge++;}
  if(rEdgeOut>=1&&rEdgeIn>=1)out.add('wraparound');
  if(bEdge>=6&&rMid>=1)out.add('shield');}
 return[...out];}
const canon=pts=>{let best=null;for(let s=0;s<8;s++){const q=pts.map(([x,y])=>{let a=s&1?y:x,b=s&1?x:y;if(s&2)a=-a;if(s&4)b=-b;return[a,b];});
 const mx=Math.min(...q.map(p=>p[0])),my=Math.min(...q.map(p=>p[1]));const k=q.map(([a,b])=>(b-my)*64+(a-mx)).sort((u,v)=>u-v).join(',');if(best===null||k<best)best=k;}return best;};
// every phase of every library pattern, simulated once on an open plane
const step=set=>{const n=new Map();for(const k of set){const [x,y]=k.split(',').map(Number);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const kk=(x+dx)+','+(y+dy);n.set(kk,(n.get(kk)||0)+1);}}
 const out=new Set();for(const [k,c] of n)if(c===3||(c===2&&set.has(k)))out.add(k);return out;};
const KEYS=new Map();
for(const [id,,,,rows] of LIB){if(!rows)continue;let set=new Set();rows.forEach((r,y)=>[...r].forEach((ch,x)=>{if(ch==='X')set.add(x+','+y);}));
 for(let p=0;p<4;p++){KEYS.set(canon([...set].map(k=>k.split(',').map(Number))),id);set=step(set);}}
// separate shapes on the wrapping board: cells within 2 of each other belong together
function shapes(g,N){const seen=new Uint8Array(g.length),out=[];
 for(let i=0;i<g.length;i++){if(!g[i]||seen[i])continue;const pts=[],q=[[i%N,(i/N)|0]];seen[i]=1;let big=false;
  while(q.length){const [x,y]=q.pop();pts.push([x,y]);if(pts.length>60){big=true;}
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy,j=((yy%N+N)%N)*N+((xx%N+N)%N);if(g[j]&&!seen[j]){seen[j]=1;q.push([xx,yy]);}}}
  if(!big)out.push(pts);}
 return out;}
let seen={};const read=()=>{try{const o=JSON.parse(localStorage.getItem('fw-seen')||'{}');for(const k in o)seen[k]=Math.max(seen[k]||0,o[k]);}catch(e){}};read();
const write=()=>{read();localStorage.setItem('fw-seen',JSON.stringify(seen));};
// scan every 10th recorded generation plus the last one
function scan(frames){if(!frames||!frames.length)return{};const N=Math.round(Math.sqrt((frames.find(Boolean)||[]).length));if(!N)return{};
 const found={};for(let k=0;k<frames.length;k++){if(!frames[k]||(k%10&&k!==frames.length-1))continue;
  for(const pts of shapes(frames[k],N)){const id=KEYS.get(canon(pts));if(id)found[id]=Math.max(found[id]||0,1)+(k===frames.length-1?0:0);}}
 return found;}
feel.guide={LIB,scan,strategies,seen:()=>({...seen}),open:()=>open()};
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);
 if(n==='turningPoint'){setTimeout(()=>{let fr;try{fr=feel._replay.frames();}catch(e){}const f=scan(fr);try{const N0=Math.round(Math.sqrt(fr[0].length));strategies(fr[0],N0).forEach(id=>f[id]=1);}catch(e){}read();const fresh=[];
  for(const id in f){if(!seen[id])fresh.push(id);seen[id]=(seen[id]||0)+1;}write();
  if(fresh.length&&feel.celebrate){const names=fresh.map(id=>LIB.find(p=>p[0]===id)[1].toLowerCase());feel.celebrate(`guide ${Object.keys(seen).length}/${LIB.length} \u00b7 new: ${names.join(', ')}`,'#7dd3ff');}},1600);}};
addEventListener('storage',e=>{if(e.key==='fw-seen')read();});

// --- the guide screen ---
const st=document.createElement('style');st.textContent=`#feel-guide{position:fixed;inset:0;z-index:95;background:#181818;overflow:auto;font-family:monospace;color:#ddd;padding:calc(14px + env(safe-area-inset-top)) 12px calc(20px + env(safe-area-inset-bottom))}
#feel-guide h2{text-align:center;margin:4px 0 2px;font-size:20px}#feel-guide .sub{text-align:center;color:#999;font-size:12px;margin-bottom:12px}
#feel-guide .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;max-width:760px;margin:0 auto}
#feel-guide .card{background:#262626;border:1px solid #444;border-radius:10px;padding:10px;text-align:center}#feel-guide .card.no{opacity:.55}
#feel-guide canvas{width:96px;height:96px;image-rendering:pixelated}#feel-guide .nm{font-weight:bold;margin:6px 0 2px}#feel-guide .kind{font-size:11px;color:#7dd3ff}
#feel-guide .tx{font-size:11px;color:#aaa;margin-top:4px;line-height:1.35}#feel-guide .x{display:block;margin:14px auto 0;font:15px monospace;padding:10px 22px;background:#ffd84a;color:#000;border:0;border-radius:8px;cursor:pointer}
#feel-title button#feel-guide-btn{min-width:0 !important;background:rgba(20,20,20,.75);color:#7dd3ff;border:1px solid #7dd3ff55;font-size:13px !important;padding:6px 14px !important;margin:0 auto 4px !important;display:block}`;
document.head.appendChild(st);
function open(){read();const old=document.getElementById('feel-guide');if(old)old.remove();const T=feel.theme?feel.theme():null;
 const m=document.createElement('div');m.id='feel-guide';const n=Object.keys(seen).length;
 m.innerHTML=`<h2>Field guide</h2><div class="sub">${n} of ${LIB.length} found. Patterns are spotted on the board after a run; strategies when you use one or face one.</div><div class="grid">${LIB.map(([id,name,kind,text])=>{const got=seen[id];
  return `<div class="card ${got?'':'no'}"><canvas data-id="${id}" width="96" height="96"></canvas><div class="nm">${got?name:'???'}</div><div class="kind">${kind}${got?` \u00b7 seen in ${got} run${got>1?'s':''}`:''}</div><div class="tx">${got?text:'Not found yet.'}</div></div>`;}).join('')}</div><button class="x">close</button>`;
 document.body.appendChild(m);m.querySelector('.x').onclick=()=>m.remove();m.onclick=e=>{if(e.target===m)m.remove();};
 m.querySelectorAll('canvas').forEach(cv=>{const p=LIB.find(q=>q[0]===cv.dataset.id),rows=p[4]||sketch(p[0]),got=seen[p[0]],x=cv.getContext('2d');const H=rows.length,W=rows[0].length,S=Math.floor(84/Math.max(W,H,5));
  const ox=(96-W*S)/2,oy=(96-H*S)/2;x.fillStyle=T?T.bg:'#7f8189';x.fillRect(0,0,96,96);x.fillStyle=got?(T?T.c[2].f:'#f4f4f4'):'#3a3a3a';
  rows.forEach((r,y)=>[...r].forEach((ch,xx)=>{if(ch==='X')x.fillRect(ox+xx*S+1,oy+y*S+1,S-1,S-1);}));});}
function sketch(id){const W=32,H=16,a=Array.from({length:H},()=>Array(W).fill('.'));const R=[[1,0],[2,0],[0,1],[1,1],[1,2]],B=[[0,0],[1,0],[0,1],[1,1]];
 const stamp=(sh,x,y)=>sh.forEach(([dx,dy])=>{if(a[y+dy]&&x+dx<W)a[y+dy][x+dx]='X';});
 if(id==='wraparound'){[3,13,23].forEach(x=>{stamp(R,x,0);stamp(R,x+4,H-3);});}
 else{for(let x=1;x<W-1;x+=6){stamp(B,x,0);stamp(B,x+3,H-2);}stamp(R,9,6);stamp(R,21,7);}
 return a.map(r=>r.join(''));}
feel.openGuide=open;
// a button on the title, under the level line, once anything has been found
function put(){const t=document.getElementById('feel-title');if(!t)return;read();let b=document.getElementById('feel-guide-btn');const n=Object.keys(seen).length;
 if(!n){if(b)b.remove();return;}
 if(!b){b=document.createElement('button');b.id='feel-guide-btn';b.onclick=e=>{e.stopPropagation();open();};const anchor=document.getElementById('feel-level')||t.querySelector('button[data-mode=campaign]');if(!anchor)return;anchor.after(b);}
 b.textContent=`field guide ${n}/${LIB.length} \u203a`;}
document.addEventListener('DOMContentLoaded',()=>setTimeout(put,0));setTimeout(put,300);
const prev2=feel.on;feel.on=function(n,d={}){prev2.call(feel,n,d);if(n==='phase'&&d.phase==='title')setTimeout(put,0);};
})();

(function(){const st=document.createElement('style');st.textContent=`#g-tray{margin:0 !important;scroll-padding:0 8px;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent) !important;mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent) !important}
@media (pointer:coarse),(max-width:700px){html,body{overflow-x:clip}}`;document.head.appendChild(st);})();

// ---------- title layout that can't overlap (10101) ----------
// everything in the title is in one column that centres when it fits and scrolls when it doesn't; the install button
// and iPhone hint join that column under the settings toggles instead of floating over them; the tool row stays pinned
(function(){const st=document.createElement('style');st.textContent=`#feel-title{justify-content:flex-start !important;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;padding-bottom:calc(72px + env(safe-area-inset-bottom))}
#feel-title::before,#feel-title::after{content:'';flex:1 0 10px}
#feel-title #feel-install,#feel-title #feel-ios{position:static !important;margin:12px auto 0 !important}
#feel-title > #feel-tools{position:fixed !important;z-index:52}`;document.head.appendChild(st);
const move=()=>{const t=document.getElementById('feel-title'),row=document.getElementById('feel-a11y');if(!t||!row)return false;let last=row;
 ['feel-install','feel-ios'].forEach(id=>{const e=document.getElementById(id);if(e&&e.parentNode===t&&e.previousElementSibling!==last){last.after(e);}if(e)last=e;});return true;};
document.addEventListener('DOMContentLoaded',move);let k=0;const iv=setInterval(()=>{move();if(++k>30)clearInterval(iv);},200);
addEventListener('beforeinstallprompt',()=>setTimeout(move,0));})();

// ---------- one celebration at a time, and a free-will nudge (10101) ----------
(function(){
// celebrate(text): waits until the star strip is gone, then shows one short line in the banner strip
const q=[];let busy=false;
const st=document.createElement('style');st.textContent=`#feel-banner.fw-one{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:94vw}
#feel-nudge{position:fixed;z-index:44;transform:translateX(-50%);background:#ffd84a;color:#000;font:bold 14px monospace;padding:7px 14px;border-radius:18px;box-shadow:0 3px 12px #000a;pointer-events:none;white-space:normal;text-align:center;max-width:min(88vw,420px);box-sizing:border-box;line-height:1.25}
#feel-nudge.pulse{animation:fwpulse 1s ease-in-out infinite}@keyframes fwpulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.08)}}`;document.head.appendChild(st);
function next(){if(busy||!q.length)return;if(document.getElementById('feel-stars')){setTimeout(next,300);return;}
 busy=true;const [t,c]=q.shift();const bn=document.getElementById('feel-banner');if(bn)bn.classList.add('fw-one');feel._flash&&feel._flash(t,c);
 setTimeout(()=>{busy=false;if(bn)bn.classList.remove('fw-one');next();},3400);}
feel.celebrate=(t,c)=>{q.push([t,c]);next();};
// nudge: game.js sends feel.on('nudge',{player}) when your count starts falling and you still have free will
let nz=null,nt=null;const hide=()=>{clearTimeout(nt);if(nz){nz.remove();nz=null;}};
function nudge(d){if(d&&d.player===2&&window.game){try{if(game._state().mode!=='hotseat')return;}catch(e){}}hide();const c=document.getElementById('c');if(!c)return;const R=c.getBoundingClientRect();
 nz=document.createElement('div');nz.id='feel-nudge';const tap=matchMedia('(pointer:coarse)').matches?'tap':'click';nz.textContent=`behind: ${tap} to launch free will`;
 nz.style.left=(R.left+R.width/2)+'px';nz.style.top=Math.max(4,R.top-34)+'px';if(!(window.FW_A11Y&&FW_A11Y.calm))nz.classList.add('pulse');document.body.appendChild(nz);nt=setTimeout(hide,5000);}
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);if(n==='nudge')nudge(d);if(n==='freewill'||(n==='phase'&&d.phase!=='run'))hide();};
})();

// ---------- live piece counts during the run, hold to outline, first-contact slow-mo (10101) ----------
// reads 01010's game.families(): a row under the board with each of your pieces and how many live cells descend from it,
// the biggest in gold, an arrow for the last second's trend. press and hold a chip to outline that family in gold on the board.
(function(){
const st=document.createElement('style');st.textContent=`#fw-live{display:none;flex-wrap:nowrap;gap:6px;overflow-x:auto;scrollbar-width:none;max-width:min(96vw,640px);margin:6px auto 0;padding:0 4px;box-sizing:border-box;-webkit-overflow-scrolling:touch}
#fw-live::-webkit-scrollbar{display:none}#fw-live.on{display:flex}
#fw-live .ch{flex:none;font:12px monospace;padding:6px 9px;border-radius:14px;background:#2c2c2c;color:#ddd;border:1px solid #555;white-space:nowrap;user-select:none;-webkit-user-select:none;touch-action:pan-x;cursor:pointer}
#fw-live .ch.top{background:#ffd84a;color:#000;border-color:#fff6c8;font-weight:bold}#fw-live .ch.dead{opacity:.45}
#fw-live.more{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)}
#fw-live .ch.held{outline:2px solid #ffd84a;outline-offset:1px}#fw-live .lb{flex:none;font:11px monospace;color:#888;align-self:center}
#fw-hl{position:fixed;pointer-events:none;z-index:20}`;document.head.appendChild(st);
let row=null,hl=null,held=null,hist={},timer=0,lastSig='',lastPhase='';
function ensure(){const c=document.getElementById('c');if(!c)return null;if(!row){row=document.createElement('div');row.id='fw-live';c.insertAdjacentElement('afterend',row);
  row.addEventListener('pointerdown',e=>{const b=e.target.closest('.ch');if(!b)return;held=+b.dataset.id;b.classList.add('held');outline();});
  const up=()=>{if(held==null)return;held=null;row.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));if(hl)hl.style.display='none';};
  ['pointerup','pointercancel','pointerleave'].forEach(t=>row.addEventListener(t,up));['pointerup','pointercancel','touchend','touchcancel','blur','scroll'].forEach(t=>window.addEventListener(t,up,{passive:true,capture:true}));{const po=feel.on;feel.on=function(n,d){if(n==='phase')up();return po.apply(this,arguments);};}row.addEventListener('contextmenu',e=>e.preventDefault());}
 return row;}
function outline(){if(held==null||!window.game||!game.familyCells)return;const c=document.getElementById('c');if(!c)return;
 if(!hl){hl=document.createElement('canvas');hl.id='fw-hl';document.body.appendChild(hl);}
 const R=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1,N=64,bw=c.clientLeft||2;
 Object.assign(hl.style,{display:'block',left:(R.left+bw)+'px',top:(R.top+bw)+'px',width:(R.width-2*bw)+'px',height:(R.height-2*bw)+'px'});
 const W=Math.round((R.width-2*bw)*dpr);if(hl.width!==W){hl.width=hl.height=W;}const x=hl.getContext('2d'),S=W/N;x.clearRect(0,0,W,W);
 const set=new Set(game.familyCells(held)||[]);x.fillStyle='rgba(255,216,74,.35)';x.strokeStyle='#ffd84a';x.lineWidth=Math.max(1.5,S*.28);x.beginPath();
 for(const i of set){const cx=i%N,cy=(i/N)|0;x.fillRect(cx*S,cy*S,S,S);
  if(!set.has(cy*N+(cx+N-1)%N)){x.moveTo(cx*S,cy*S);x.lineTo(cx*S,cy*S+S);}if(!set.has(cy*N+(cx+1)%N)){x.moveTo(cx*S+S,cy*S);x.lineTo(cx*S+S,cy*S+S);}
  if(!set.has(((cy+N-1)%N)*N+cx)){x.moveTo(cx*S,cy*S);x.lineTo(cx*S+S,cy*S);}if(!set.has(((cy+1)%N)*N+cx)){x.moveTo(cx*S,cy*S+S);x.lineTo(cx*S+S,cy*S+S);}}
 x.stroke();}
function update(){let s;try{s=window.game&&game.families&&game._state();}catch(e){}const r=ensure();if(!r)return;
 if(!s||(s.phase!=='run'&&s.phase!=='over')){r.classList.remove('on');hist={};lastSig='';lastPhase='';if(hl)hl.style.display='none';return;}
 // a new phase starts the row at its left edge, so "yours" and the top chip are never left scrolled off
 if(s.phase!==lastPhase){lastPhase=s.phase;r.scrollLeft=0;}
 const hs=s.mode==='hotseat',fams=game.families().filter(f=>hs||f.player===1),now=performance.now();
 if(!fams.length){r.classList.remove('on');return;}
 for(const f of fams){const h=hist[f.id]||(hist[f.id]=[]);h.push([now,f.cells]);while(h.length>2&&now-h[1][0]>1000)h.shift();}
 const live=fams.filter(f=>f.cells>0).sort((a,b)=>b.cells-a.cells),dead=fams.filter(f=>!f.cells);
 const tops=new Set();for(const p of [1,2]){const t=live.find(f=>f.player===p);if(t)tops.add(t.id);}
 const tr=f=>{if(s.phase!=='run')return'';const h=hist[f.id];if(!h||h.length<2)return'';const d=f.cells-h[0][1];return d>2?' \u2191':d<-2?' \u2193':'';};
 const nm=f=>(hs?(f.player===1?'01010 ':'10101 '):'')+String(f.label||'piece').toLowerCase();
 const html=(hs?'':'<span class="lb">yours</span>')+live.map(f=>`<span class="ch${tops.has(f.id)?' top':''}${held===f.id?' held':''}" data-id="${f.id}">${nm(f)} ${f.cells}${tr(f)}</span>`).join('')
  +(()=>{const g={};for(const f of dead){const k=nm(f);(g[k]=g[k]||[]).push(f);}   // dead pieces of one kind share a chip: "glider \u2715\u00d73"
   return Object.entries(g).map(([k,l])=>`<span class="ch dead" data-id="${l[0].id}">${k} \u2715${l.length>1?'\u00d7'+l.length:''}</span>`).join('');})();
 if(html!==lastSig){lastSig=html;r.innerHTML=html;}r.classList.add('on');
 r.classList.toggle('more',r.scrollWidth>r.clientWidth+2&&r.scrollLeft+r.clientWidth<r.scrollWidth-4);if(held!=null)outline();}
setInterval(update,250);
// first contact: in a player's first three quick matches, slow to a quarter for two seconds and say what's happening. calm mode skips it
const prev=feel.on;feel.on=function(n,d={}){prev.call(feel,n,d);
 if(n==='contact'){let s;try{s=game._state();}catch(e){return;}
  if(s.mode==='cpu'&&!s.arena&&((s.save&&s.save.quickN)||0)<=3&&!(window.FW_A11Y&&FW_A11Y.calm)){game.slowMo&&game.slowMo(.25,2000);feel._flash&&feel._flash(innerWidth<560?'contact! majority colour wins':'contact! a new cell takes the colour most of its parents had','#ffd84a');}}};
})();

// ---------- yardstick bars on mission results (10101) ----------
// 01010's panel renders <div class="fw-yardstick" data-best data-beginner data-good data-expert data-unit> with a text fallback.
// it becomes four bars on one scale: three grey reference bars and your best in gold. bigger is always better.
(function(){
const st=document.createElement('style');st.textContent=`.fw-yardstick.fw-ys{max-width:min(92vw,420px);margin:8px auto;font:12px monospace;color:#bbb;text-align:left}
.fw-ys .r{display:flex;align-items:center;gap:6px;margin:3px 0}.fw-ys .l{width:68px;flex:none;text-align:right}
.fw-ys .t{flex:1;height:12px;background:#2a2a2a;border-radius:6px;overflow:hidden}.fw-ys .b{height:100%;background:#777;border-radius:6px}
.fw-ys .r.you .b{background:#ffd84a}.fw-ys .r.you .l{color:#ffd84a;font-weight:bold}.fw-ys .v{width:40px;flex:none}
.fw-ys .cap{text-align:center;color:#999;margin-bottom:2px}`;document.head.appendChild(st);
const num=v=>v===''||v==null?null:(isFinite(+v)?+v:null);
function build(el){const d=el.dataset;let st0=0;try{st0=(game._state().save.stars||{})[d.mission]||0;}catch(e){}const key=[d.best,d.beginner,d.good,d.expert,d.unit,st0].join('|');if(d.fwDone===key)return;
 const best=num(d.best),rows=[['beginner',num(d.beginner)],['good',num(d.good)],['expert',num(d.expert)]].filter(r=>r[1]!=null);if(!rows.length)return;
 const max=Math.max(1,best||0,...rows.map(r=>r[1])),u=({invade:'cells in their half'})[d.unit]||d.unit||'';
 let stars=0;try{stars=(game._state().save.stars||{})[d.mission]||0;}catch(e){}
 const beat=best==null?'':rows.filter(r=>best>=r[1]).map(r=>r[0]).pop();
 const row=(l,v,you)=>`<div class="r${you?' you':''}"><span class="l">${l}</span><span class="t"><span class="b" style="display:block;width:${v==null?0:Math.max(2,v/max*100)}%"></span></span><span class="v">${v==null?'\u2013':v}</span></div>`;
 el.classList.add('fw-ys');
 el.innerHTML=`<div class="cap">${best==null?'how others score'+(u?' ('+u+')':''):beat?'your best beats the '+beat+' layout':(stars>=3?'3 stars! ':'')+`layouts here reach ${rows[0][1]}\u2013${rows[rows.length-1][1]}`}</div>`+row('you',best,true)+rows.map(r=>row(r[0],r[1])).join('');
 d.fwDone=key;}
const scan=()=>document.querySelectorAll('.fw-yardstick').forEach(build);
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});scan();
})();
