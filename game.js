// game.js by 01010: the playable game. Setup with a budget, blind placement, a 500-generation run,
// two free-will gliders each, and a computer opponent. Talks to feel.js (10101) through window.feel.
(function(){
const N=64,S=10,HALF=32,ROUNDS=3,TWEAK=5; let GENS=500,BUDGET=20,FW=2;
const NAME=['','01010','10101'], COL=['','#000000','#FFFFFF'], BG='#808080';
const GUN=[[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],[11,3],[15,3],[20,3],[21,3],[34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],[10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]];
const SHAPES=[
 {id:'block',  label:'block',       cost:1, cells:[[0,0],[1,0],[0,1],[1,1]], tip:'stable wall'},
 {id:'blinker',label:'blinker',     cost:1, cells:[[0,0],[1,0],[2,0]], tip:'cheap decoy'},
 {id:'glider', label:'glider',      cost:3, cells:[[1,0],[2,1],[0,2],[1,2],[2,2]], tip:'travels, rotate to aim'},
 {id:'rpent',  label:'R-pentomino', cost:5, cells:[[1,0],[2,0],[0,1],[1,1],[1,2]], tip:'explodes into chaos'},
 {id:'gun',    label:'glider gun',  cost:15,cells:GUN, tip:'endless gliders'},
 {id:'lwss',   label:'spaceship',   cost:6, cells:[[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]], tip:'fast, flies in a straight line', lvl:2},
 {id:'eater',  label:'eater',       cost:4, cells:[[0,0],[1,0],[0,1],[2,1],[2,2],[2,3],[3,3]], tip:'swallows gliders that hit it', lvl:3},
 {id:'pulsar', label:'pulsar',      cost:10,cells:[[2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0], [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5], [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7], [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12], [0, 2], [0, 3], [0, 4], [0, 8], [0, 9], [0, 10], [5, 2], [5, 3], [5, 4], [5, 8], [5, 9], [5, 10], [7, 2], [7, 3], [7, 4], [7, 8], [7, 9], [7, 10], [12, 2], [12, 3], [12, 4], [12, 8], [12, 9], [12, 10]], tip:'big pulsing fortress', lvl:4}];
let skipping=false;   // fast-forward: no drawing and no feel.js events until the end screen
const emit=(n,d)=>{ if(skipping) return; try{window.feel&&window.feel.on(n,d);}catch(e){}};
// thresholds in one place, so 11111's "does a lead of N at gen G still flip" data can tune them
// DECIDED: "skip to the end" appears from minGen on when the leader has ratio times the loser's cells and minLead more, and the loser has no free will left
// NUDGE: feel.on('nudge') when a human with free will has lost cells for fallGens gens in a row (3-gen average, so pulsars don't reset it),
//        or has behind x the leader's cells or fewer after afterGen; at most max per run per player, cooldown gens apart
const DECIDED={minGen:200,ratio:15,minLead:50}, DECIDED_HS={minGen:200,ratio:30,minLead:150};   // 11111's 6,620-game data: flips 0.44% / 0.39%
const NUDGE={fallGens:15,behind:0.9,afterGen:50,cooldown:60,max:2};   // 11111's data: +5.0 points of win rate
const pal=()=>{try{if(window.feel&&window.feel.colors)return window.feel.colors();}catch(e){} return {bg:'#808080',black:'#000000',white:'#FFFFFF'};};
const pcol=p=>{const c=pal();return p===1?c.black:c.white;};
// Touch hints: a coarse primary pointer, a touch-only device (no hover, touch points), or simply the last press having been a finger.
// Some phones report pointer:fine, which left "Right-click" in the swap hint, so the last real press wins.
let lastPtr=null; addEventListener('pointerdown',e=>{ const t=e.pointerType==='mouse'?'mouse':(e.pointerType==='touch'||e.pointerType==='pen')?'touch':null; if(t) lastPtr=t; },{capture:true,passive:true});
const isTouch=()=>{ if(lastPtr) return lastPtr==='touch'; try{ return matchMedia('(pointer:coarse)').matches||(matchMedia('(hover:none)').matches&&(navigator.maxTouchPoints||0)>0); }catch(e){ return false; } };
const K=(k,t)=>isTouch()?t:`${k} ${t}`;          // keyboard hints only where there is a keyboard
// remove hint: one wording when only touch or only a mouse is present, both when the device has both (or we've seen both)
const inputs=()=>{ let fine=false, coarse=false; try{ fine=matchMedia('(any-pointer:fine)').matches; coarse=matchMedia('(any-pointer:coarse)').matches||(navigator.maxTouchPoints||0)>0; }catch(e){}
  if(lastPtr==='touch') coarse=true; if(lastPtr==='mouse') fine=true; if(!fine&&!coarse) fine=true; return {fine,coarse}; };
const RC=()=>{ const d=inputs(); return d.fine&&d.coarse?'Long-press or right-click':d.coarse?'Long-press':'Right-click'; };
const meP=()=>mode==='hotseat'?setupP:1;
const idx=(x,y)=>((y+N)%N)*N+((x+N)%N);
const ownsRow=(p,y)=>p===1?(y>=0&&y<HALF):(y>=HALF&&y<N);

// ---------- rules (same as the sandbox: B3/S23, majority birth, outnumbered cells flip) ----------
// live families (01010): every live cell remembers which placed piece it descends from. A survivor keeps its piece;
// a newborn or flipped cell takes the piece most of its same-coloured neighbours came from. Read only by the live counts.
function stepFam(g,n,fam){ const nf=new Int16Array(N*N); let touch=false;
  for(let y=0;y<N;y++){const ys=[((y+N-1)%N)*N,y*N,((y+1)%N)*N];
    for(let x=0;x<N;x++){const i=y*N+x, c=n[i]; if(!c) continue;
      if(g[i]===c&&fam[i]){ nf[i]=fam[i]; } else { const xs=[(x+N-1)%N,x,(x+1)%N]; let best=0,bn=0; const seen={};
        for(const yy of ys) for(const xx of xs){ const j=yy+xx; if(j===i||g[j]!==c||!fam[j]) continue; const k=(seen[fam[j]]=(seen[fam[j]]||0)+1); if(k>bn){bn=k;best=fam[j];} }
        nf[i]=best; }
      if(!touch){ const xs=[(x+N-1)%N,x,(x+1)%N]; for(const yy of ys) for(const xx of xs){ const v=n[yy+xx]; if(v&&v!==c){touch=true;break;} } } }}
  return {nf,touch}; }
function stepGrid(g){
  const n=new Int8Array(N*N), f=new Int8Array(N*N); let fc=0;
  for(let y=0;y<N;y++){const ym=((y+N-1)%N)*N, y0=y*N, yp=((y+1)%N)*N;
    for(let x=0;x<N;x++){const xm=(x+N-1)%N, xp=(x+1)%N; let b=0,w=0,v;
      v=g[ym+xm];if(v===1)b++;else if(v===2)w++; v=g[ym+x];if(v===1)b++;else if(v===2)w++; v=g[ym+xp];if(v===1)b++;else if(v===2)w++;
      v=g[y0+xm];if(v===1)b++;else if(v===2)w++;                                              v=g[y0+xp];if(v===1)b++;else if(v===2)w++;
      v=g[yp+xm];if(v===1)b++;else if(v===2)w++; v=g[yp+x];if(v===1)b++;else if(v===2)w++; v=g[yp+xp];if(v===1)b++;else if(v===2)w++;
      const t=b+w,i=y0+x,c=g[i];
      if(c){ if(t===2||t===3){ const own=c===1?b:w, oth=c===1?w:b; if(oth>own){n[i]=3-c;f[i]=c;fc++;} else n[i]=c; } }
      else if(t===3) n[i]=b>w?1:2;
  }}
  return {n,f,fc};
}
const count=g=>{let b=0,w=0;for(const v of g){if(v===1)b++;else if(v===2)w++;}return [b,w];};

// ---------- shape transforms ----------
function transform(cells,rot,mir){
  let c=cells.map(([x,y])=>[mir?-x:x,y]);
  for(let r=0;r<rot;r++) c=c.map(([x,y])=>[-y,x]);
  const mx=Math.min(...c.map(p=>p[0])), my=Math.min(...c.map(p=>p[1]));
  return c.map(([x,y])=>[x-mx,y-my]);
}
function cellsAt(shape,rot,mir,cx,cy,p){
  if(shape.id==='gun') rot=(rot%2)*2;   // the gun is 36 wide, so it only fits lying down
  const c=transform(shape.cells,rot,mir), w=Math.max(...c.map(p=>p[0]))+1, h=Math.max(...c.map(p=>p[1]))+1;
  let ox=cx-Math.floor(w/2), oy=cy-Math.floor(h/2);
  if(p){ const lo=p===1?0:HALF; ox=Math.max(0,Math.min(N-w,ox)); oy=Math.max(lo,Math.min(lo+HALF-h,oy)); }  // snap inside your half
  return c.map(([x,y])=>[ox+x,oy+y]);
}
function validPlace(g,p,cells,cost,left){
  if(cost>left) return false;
  for(const [x,y] of cells){ if(x<0||x>=N||!ownsRow(p,y)) return false; if(g[idx(x,y)]) return false; }
  return true;
}

// ---------- page setup: reuse canvas #c and #hud if index.html has them ----------
let cv=document.getElementById('c');
if(!cv){cv=document.createElement('canvas');cv.id='c';document.body.appendChild(cv);}
cv.width=N*S; cv.height=N*S; const ctx=cv.getContext('2d');
let hud=document.getElementById('hud'); if(!hud){hud=document.createElement('div');hud.id='hud';cv.before(hud);}
hud.style.minHeight='4.8em'; hud.style.boxSizing='border-box';
if('scrollRestoration' in history) history.scrollRestoration='manual'; window.scrollTo(0,0);
let graph=document.getElementById('graph'); if(!graph){graph=document.createElement('canvas');graph.id='graph';graph.width=640;graph.height=70;graph.style.marginTop='6px';cv.after(graph);}
const panel=document.createElement('div'); panel.id='game-panel'; graph.after(panel);
// render() runs often (hover, timers). Rebuilding the buttons every time swallowed taps that landed mid-rebuild,
// so the panel only touches the DOM when its HTML actually changes.
{ const d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML'); let last=null;
  Object.defineProperty(panel,'innerHTML',{get(){return d.get.call(panel);},set(h){ if(h===last) return; last=h; const t0=panel.querySelector('#g-tray'), sl=t0?t0.scrollLeft:0; d.set.call(panel,h);
    const t=panel.querySelector('#g-tray'); if(t){ t.scrollLeft=sl; const sb=t.querySelector('button.sel'); if(sb){ const a=sb.offsetLeft-t.offsetLeft, z=a+sb.offsetWidth; if(a<t.scrollLeft||z>t.scrollLeft+t.clientWidth) t.scrollLeft=Math.max(0,z-t.clientWidth+24); } } } /* keep the tray where it was, with the selected piece in view */}); }
const st=document.createElement('style'); st.textContent=`
#game-panel{font-family:monospace;color:#ddd;text-align:center;margin:6px;max-width:660px;line-height:1.6}
#game-panel button{font:13px monospace;margin:3px;background:#333;color:#ddd;border:1px solid #555;padding:5px 10px;cursor:pointer}
#game-panel button.sel{background:#808080;color:#000;border-color:#ddd}
#game-panel button:disabled{opacity:.35;cursor:default}
#game-panel .tip{font-size:12px;color:#999}`;
document.head.appendChild(st);

// ---------- state ----------
let mode='cpu', phase='idle', g, flipped, trail, trailC, gen=0, hist=[], fwLeft=[0,FW,FW], fwLog=[];
let setupP=1, spent=[0,0,0], placed={1:[],2:[]}, sel=2, rot=0, mir=false, hover=null, cover=null, running=true, speed=20, thinking=false, warn=false, og, pieces=[null], lossMap={1:null,2:null}, reviewMap=0, review=null, g0=null, og0=null, launches=[], fwDir={1:1,2:-1}, scrolled=false;
let match={round:1,results:[],score:[0,0]}, tweak={1:{rm:0,add:0},2:{rm:0,add:0}}, removedGhost={1:[],2:[]}, prevBlack=null, fragile='', matchOver=false;

function newGame(m,ar){   // ar: a fresh arena run, set before the first round so game 1 isn't picked as a quick-match rival
  try{ window.feel&&window.feel.setZone&&window.feel.setZone(null); window.feel&&window.feel.setWrapHint&&window.feel.setWrapHint(false); }catch(e){}
  arena=ar||null; mode=m; if(m==='cpu') tier=arena?arenaTier():defaultTier();
  if(m==='cpu'&&!arena){ save.quickN=(save.quickN||0)+1; persist(); }   // the first 3 quick matches offer the starter layout
  match={round:1,results:[],score:[0,0]}; placed={1:[],2:[]}; matchOver=false; peek=false; startRound();
}
// ---------- arena: win 10 games before you lose 3 lives. You keep your layout (5-point swap between games),
// and each new opponent is a fresh computer that gets tougher every 3 wins.
let turningGen=null, arena=null, rivalLine='';
// ---------- named rivals from opponents.json (11111's hand-built layouts, easiest first) ----------
// Used above Rookie: Normal, Hard and Master pick from the lower, middle and upper third, and the arena climbs the list.
let RIVALS=[], rival=null;
function cellsOfRival(rv){ const out=[]; for(const pc of rv.pieces){ const sh=SHAPES.find(x=>x.id===pc.shape); out.push(...cellsAt(sh,pc.r||0,!!pc.m,pc.cx,pc.cy,2)); } return out; }
// 10101: the single-file bundle has no opponents.json next to it, so it carries the rivals inline as window.FW_RIVALS
try{ (window.FW_RIVALS?Promise.resolve(window.FW_RIVALS):fetch('opponents.json').then(r=>r.ok?r.json():[])).then(list=>{
  RIVALS=(Array.isArray(list)?list:[]).filter(rv=>rv&&rv.id&&rv.name&&Array.isArray(rv.pieces)&&rv.pieces.length&&
    rv.pieces.every(pc=>SHAPES.some(x=>x.id===pc.shape))&&rv.pieces.reduce((a,pc)=>a+SHAPES.find(x=>x.id===pc.shape).cost,0)<=20);
}).catch(()=>{}); }catch(e){}
function pickRival(){
  if(!RIVALS.length||mode!=='cpu') return null; const n=RIVALS.length;
  if(arena){ if(arenaStep(arena.wins)===0) return null; return RIVALS[Math.min(n-1,Math.round((arena.wins-3)/6*(n-1)))]; }
  if(tier===0) return null; const lo=Math.floor((tier-1)*n/3), hi=Math.max(lo+1,Math.floor(tier*n/3));
  return RIVALS[lo+Math.floor(Math.random()*(hi-lo))]; }
const recOf=rv=>{ save.rivals=save.rivals||{}; return save.rivals[rv.id]||(save.rivals[rv.id]={wins:0,losses:0}); };
// Arena opponents by wins so far: 3 Rookies, 2 Rookie+ (a stepping stone 11111 asked for), 2 Normal, 2 Hard, then Master.
const RPLUS={name:'Rookie+',cands:3,foes:1,gens:120,budget:16,ban:['pulsar'],maxR:2};
const ARENA=[0,0,0,'plus','plus',1,1,2,2,3];
const arenaStep=w=>ARENA[Math.min(9,w)];
const arenaTier=()=>{ const a=arenaStep(arena.wins); return a==='plus'?0:a; };
const winsT=p=>(p=>mode==='hotseat'?NAME[p]+' wins':Pn(p)+(p===1?' win':' wins'))(p);
const pn=p=>mode==='hotseat'?NAME[p]:p===1?'you':(mode==='cpu'?(rival?rival.name:curT().name):'the computer'), Pn=p=>{const n=pn(p);return n[0].toUpperCase()+n.slice(1);};
const arenaOpp=w=>{ const a=arenaStep(w); return a==='plus'?RPLUS:TIERS[a]; };
const curT=()=>arena?arenaOpp(arena.wins):TIERS[tier];
function startArena(){ newGame('cpu',{wins:0,lives:3});
  emit('arena',{game:match.round,wins:0,lives:3,opponent:curT().name}); render(); } // 10101: game 1 also gets the arena strip (newGame had already sent a round event)
function arenaNext(){ placed[2]=[]; tier=arenaTier(); match.round++; startRound(); }
function resetBoard(){
  runId++;
  g=new Int8Array(N*N); flipped=new Int8Array(N*N); trail=new Float32Array(N*N); trailC=new Int8Array(N*N);
  gen=0; hist=[]; fwLeft=[0,FW,FW]; fwLog=[]; spent=[0,0,0]; sel=2; rot=0; mir=false; running=true;
  og=new Int16Array(N*N); pieces=[null]; lossMap={1:new Uint16Array(N*N),2:new Uint16Array(N*N)}; reviewMap=0; review=null; warn=false; launches=[]; fwDir={1:1,2:-1}; scrolled=false;
  tweak={1:{rm:0,add:0},2:{rm:0,add:0}}; removedGhost={1:[],2:[]}; fragile=''; flashMsg=''; toasts=[]; showReview=false; gv++; sameNudge=false;
  stopTest();
}
function startRound(){
  GENS=500; BUDGET=20; FW=2; resetBoard();
  // round 2 and 3 start from last round's layouts; each side may then change up to TWEAK points
  for(const p of [1,2]){ const prev=placed[p]; placed[p]=[]; for(const sp of prev) place(p,SHAPES[sp.si],sp.r,sp.m,sp.cx,sp.cy,true,true); }
  prevBlack=g.slice();
  if(mode==='cpu'){ const r=SHAPES.findIndex(x=>x.id==='rpent'); if(r>=0&&allowedShape(SHAPES[r])) sel=r; }   // four gliders lost 428-0 to the Rookie: start on the R-pentomino
  setupP=1; cover=null; phase='setup'; window.scrollTo(0,0);
  emit('mode',{mode:arena?'arena':mode});
  if(mode==='cpu'&&(arena||match.round===1)) rival=pickGhost()||pickRival(); else if(mode!=='cpu') rival=null;
  if(rival) emit('opponent',{name:rival.name,blurb:rival.blurb||'',cells:cellsOfRival(rival),record:{...recOf(rival)}});
  if(mode==='cpu'&&(arena||match.round===1)) planCpu(); else cpuPlan=null;   // decided now, so the peek shows exactly what it will play
  if(arena) emit('arena',{game:match.round,wins:arena.wins,lives:arena.lives,opponent:rival?rival.name:curT().name});
  else emit('round',{round:match.round,of:ROUNDS,results:match.results.slice(),score:match.score.slice()});
  emit('phase',{phase:'setup'}); render();
}
function leftFor(p){ return Math.min(BUDGET-spent[p], match.round>1?TWEAK-tweak[p].add:Infinity); }

// ---------- progression: XP, levels, achievements, opponent ladder (saved on this device) ----------
const SAVE_KEY='fw-save';
const blankSave=()=>({xp:0,done:{},ach:{},tier:0,wins:0,stars:{}});
let save=(()=>{try{return Object.assign(blankSave(),JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));}catch(e){return blankSave();}})();
// ---------- merging saves: a stale tab must never make progress go backwards ----------
// Counters take the max, maps of done things are unioned, stars and rival records take the max per entry, the daily
// result keeps an existing entry for its day, and dstreak follows whichever side has the newer day. Preferences
// (pickTier and anything unknown) keep this tab's value only if this tab changed it since it last synced.
const SAVE_MAX=['xp','tier','wins','arenaBest','quickN'], SAVE_UNION=['done','ach','beatTier','beatChal'];
let saveBase={};   // preference values as of this tab's last sync with storage
const readSave=()=>{ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{}; }catch(e){ return {}; } };
function mergeSave(mem,st){
  const out={...st,...mem}, num=v=>typeof v==='number'&&isFinite(v)?v:0;
  for(const k of SAVE_MAX) if(k in mem||k in st) out[k]=Math.max(num(mem[k]),num(st[k]));
  for(const k of SAVE_UNION){ const a=mem[k]||{}, b=st[k]||{}, u={};
    for(const id of new Set([...Object.keys(a),...Object.keys(b)])){ const x=a[id], y=b[id];
      u[id] = typeof x==='number'&&typeof y==='number' ? Math.min(x,y) : (x||y); }   // achievements keep the earliest time
    out[k]=u; }
  { const a=mem.stars||{}, b=st.stars||{}, u={}; for(const id of new Set([...Object.keys(a),...Object.keys(b)])) u[id]=Math.max(num(a[id]),num(b[id])); out.stars=u; }
  { const a=mem.mbest||{}, b=st.mbest||{}, u={}; for(const id of new Set([...Object.keys(a),...Object.keys(b)])) u[id]=Math.max(num(a[id]),num(b[id])); if(Object.keys(u).length) out.mbest=u; else delete out.mbest; }   // best score per mission: max per entry
  { const a=mem.rivals||{}, b=st.rivals||{}, u={};
    for(const id of new Set([...Object.keys(a),...Object.keys(b)])){ const x=a[id]||{}, y=b[id]||{}, r={};
      for(const f of new Set([...Object.keys(x),...Object.keys(y)])) r[f]=Math.max(num(x[f]),num(y[f])); u[id]=r; }
    out.rivals=u; }
  { const a=mem.daily, b=st.daily, ka=a&&a.key||'', kb=b&&b.key||'';
    out.daily = kb&&kb>=ka ? b : a||b||undefined;   // same day: the stored entry was there first, so it stays
    out.dstreak = ka>kb ? num(mem.dstreak) : kb>ka ? num(st.dstreak) : Math.max(num(mem.dstreak),num(st.dstreak));
    if(out.daily===undefined) delete out.daily;
    const pa=mem.dprac||'', pb=st.dprac||''; if(pa||pb) out.dprac=pa>pb?pa:pb; }
  { const u={}; for(const x of [...(st.ghosts||[]),...(mem.ghosts||[])]) if(x&&x.c&&(!u[x.c]||x.t>u[x.c].t)) u[x.c]=x;   // ghosts: union by code, newest 30
    const list=Object.values(u).sort((a,b)=>b.t-a.t).slice(0,30); if(list.length) out.ghosts=list; else delete out.ghosts; }
  { const a=mem.rating, b=st.rating; if(a||b) out.rating=!b?a:!a?b:(a.t||0)>=(b.t||0)?a:b; }   // rating: the newest write wins
  const handled=new Set([...SAVE_MAX,...SAVE_UNION,'stars','mbest','rivals','daily','dstreak','dprac','ghosts','rating']);
  for(const k of new Set([...Object.keys(mem),...Object.keys(st)])){ if(handled.has(k)) continue;
    const changedHere = JSON.stringify(mem[k])!==JSON.stringify(saveBase[k]);
    out[k] = changedHere||!(k in st) ? mem[k] : st[k]; }
  return out;
}
function adoptSave(m){ for(const k of Object.keys(save)) if(!(k in m)) delete save[k]; Object.assign(save,m);
  saveBase={}; for(const k of Object.keys(save)) saveBase[k]=JSON.parse(JSON.stringify(save[k]===undefined?null:save[k])); }
function persist(){ try{ const m=mergeSave(save,readSave()); adoptSave(m); localStorage.setItem(SAVE_KEY,JSON.stringify(save)); }catch(e){} }
adoptSave({...save});
// another tab saved: fold its progress in (no write back), and refresh the screen if nothing is in play here
addEventListener('storage',e=>{ if(e.key!==SAVE_KEY) return; let st={}; try{ st=JSON.parse(e.newValue||'{}')||{}; }catch(_){ return; }
  adoptSave(mergeSave(save,st)); try{ if(phase==='idle'||phase==='menu') render(); }catch(_){} });
const XPL=200, level=()=>1+Math.floor(save.xp/XPL);
const unlockedShape=s=>!s.lvl||level()>=s.lvl;
const unlockTheme=id=>{try{window.feel&&window.feel.unlockTheme&&window.feel.unlockTheme(id);}catch(e){}};
const celeb=(t,c)=>{ if(skipping) return; try{ window.feel&&window.feel.celebrate&&window.feel.celebrate(t,c); }catch(e){} };   // queued with the star strip and guide notes
function gainXP(n,why){
  const before=level(); save.xp+=n; toasts.push(`+${n} XP ${why}`);
  if(level()>before){ toasts.push(`Level ${level()}!`); SHAPES.filter(s=>s.lvl===level()).forEach(s=>toasts.push(`New piece unlocked: the ${s.label} (${s.tip})`));
    if(level()>=5) unlockTheme('forest'); { const u=SHAPES.filter(s=>s.lvl===level()).map(s=>s.label.toLowerCase()).join(', '); emit('levelUp',u?{level:level(),unlock:u}:{level:level()}); } }
  persist();
}
const ACH={first:['First contact','Finish mission 1'],comeback:['Comeback','Win a match after losing round 1'],wipe:['Wipeout','Wipe out the other colour completely'],
  hero:['Free will hero','Launch a free-will glider worth +50 or more'],penny:['Penny pincher','Win a round using only 1-point pieces'],
  campaign:['Campaign complete','Finish every mission'],hard:['Veteran','Beat the Hard computer'],master:['Master','Beat the Master computer'],arena:['Arena champion','Win 10 arena games before losing 3 lives'],allstars:['Star collector','Earn all three stars on every mission']};
const ACH_THEME={first:'paper',campaign:'ember',hard:'neon'};
function achieve(id){ if(save.ach[id]) return; save.ach[id]=Date.now(); toasts.push(`Achievement: ${ACH[id][0]}`);
  emit('achievement',{id,name:ACH[id][0],desc:ACH[id][1]}); gainXP(50,`for ${ACH[id][0]}`); if(ACH_THEME[id]) unlockTheme(ACH_THEME[id]); persist(); }
const TIERS=[{name:'Rookie',cands:1,foes:1,gens:60,budget:12,ban:['gun','pulsar'],maxR:1},{name:'Normal',cands:10,foes:3,gens:220},{name:'Hard',cands:22,foes:4,gens:220},{name:'Master',cands:34,foes:5,gens:200}];
// Quick-match opponent: the tier the player last chose (saved, so every tab agrees), capped at what's unlocked; Rookie if never chosen.
// Re-read from storage each time, because another tab may have unlocked or picked a tier since this one loaded.
function defaultTier(){ let st={}; try{ st=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{}; }catch(e){}
  save.tier=Math.max(save.tier||0,st.tier||0); const pick=st.pickTier!=null?st.pickTier:save.pickTier!=null?save.pickTier:0; save.pickTier=pick; saveBase.pickTier=pick;
  return Math.max(0,Math.min(pick,save.tier,3)); }
const chooseTier=t=>{ tier=t; save.pickTier=t; persist(); };
let tier=defaultTier();
const rankName=()=>save.tier>=4?'Master':save.tier>0?`${TIERS[save.tier-1].name} beaten`:'unranked';

// ---------- campaign: short missions that teach one thing each ----------
function preset(p,shapeId,x,y,label,r){
  const sh=SHAPES.find(s=>s.id===shapeId), cells=transform(sh.cells,r||0,false).map(([a,b])=>[x+a,y+b]);
  const id=newPiece(p,label||sh.label,cells); pieces[id].cost=p===1?sh.cost:0;
  for(const [a,b] of cells){ g[idx(a,b)]=p; og[idx(a,b)]=id; } gv++;
}
const MISSIONS=[
 {id:'m1',title:'Plant a seed',hint:'Tap anywhere in your half to plant a glider.',goalText:'hit the wall',budget:3,shapes:['glider'],gens:240,goal:'hit',auto:true,fw:0,tip:'Aim further down, toward their side.',
  build(){ for(let x=0;x<N;x+=4) preset(2,'block',x,42,'wall'); for(let x=2;x<N;x+=4) preset(2,'block',x,48,'wall'); }},
 {id:'m2',title:'Chaos',hint:'This one explodes. Plant it and outgrow them.',goalText:'more cells than them at the end',budget:5,shapes:['rpent'],gens:300,goal:'most',auto:true,fw:0,tip:'Give it lots of empty space to grow into.',
  build(){ for(const [x,y] of [[10,44],[30,40],[50,46],[20,54]]) preset(2,'blinker',x,y); for(const [x,y] of [[40,52],[5,58]]) preset(2,'block',x,y); }},
 {id:'m3',title:'Hold the line',hint:'A gun is firing at your base. Spend 6 points on blocks and blinkers as shields, and end with at least 45 cells.',goalText:'end with at least 45 cells',budget:6,shapes:['block','blinker'],gens:300,goal:'survive',need:45,fw:0,tip:'Shield a few cells in front of your base, facing the gun.',
  build(){ preset(2,'gun',24,52,'glider gun',2); for(const [x,y] of [[4,4],[10,4],[4,10],[10,10],[16,4],[4,16],[16,16],[10,16]]) preset(1,'block',x,y,'base block'); }},
 {id:'m4',title:'Free will',hint:"You can't build this time. Tap the board to launch free-will gliders at their side, early, before they grow.",goalText:'more cells than them at generation 300',intro:"Left alone, you lose this one. You have 3 free-will gliders: tap the board to launch one at their side.",budget:0,gens:300,goal:'most',fw:3,speed:9,tip:'Launch all three early, at their biggest blob, before it spreads.',
  build(){ preset(1,'rpent',30,20); preset(1,'block',10,10); preset(1,'block',50,10);
    preset(2,'rpent',20,44); preset(2,'rpent',42,46); preset(2,'rpent',32,56); preset(2,'blinker',8,52); preset(2,'blinker',54,54); }},
 {id:'m5',title:'Fortress',hint:'Break the fortress: have more cells than them at generation 400, with 10 points.',goalText:'more cells than them at generation 400',budget:10,shapes:['block','blinker','glider','rpent'],gens:400,goal:'most',fw:1,tip:'Blocks break when something grows beside them. Plant close to the wall.',
  build(){ for(let x=18;x<46;x+=4) for(const y of [40,46]) preset(2,'block',x,y,'fortress wall'); for(const [x,y] of [[20,52],[30,52],[40,52],[25,58],[35,58]]) preset(2,'blinker',x,y); preset(2,'rpent',31,49); }},
 {id:'m6',title:'The gun',hint:'Their gun never stops. Have more cells than them at generation 500, with 20 points.',goalText:'more cells than them at generation 500',budget:20,shapes:null,gens:500,goal:'most',fw:2,tip:'Blocks stop gliders. Shield the line of fire, and grow away from it.',
  build(){ preset(2,'gun',26,50,'glider gun',2); preset(2,'rpent',10,40); preset(2,'rpent',50,40); }},
 {id:'m7',title:'The back door',hint:'Get 19 of your cells into their gold half by generation 100. Their front is a wall.',goalText:'19 of your cells inside their half at generation 100',budget:5,shapes:['rpent'],gens:100,goal:'invade',need:19,fw:0,wrap:true,
  tip:'Their front is solid. Plant on your top rows: the board wraps, so you bloom into their open back.',
  build(){ /* 11111's fortress: 63 blocks in 3 staggered rows over white's rows 32-39, back left open */ preset(2,'block',0,32,undefined,0);preset(2,'block',3,32,undefined,0);preset(2,'block',6,32,undefined,0);preset(2,'block',9,32,undefined,0);preset(2,'block',12,32,undefined,0);preset(2,'block',15,32,undefined,0);preset(2,'block',18,32,undefined,0);preset(2,'block',21,32,undefined,0);preset(2,'block',24,32,undefined,0);preset(2,'block',27,32,undefined,0);preset(2,'block',30,32,undefined,0);preset(2,'block',33,32,undefined,0);preset(2,'block',36,32,undefined,0);preset(2,'block',39,32,undefined,0);preset(2,'block',42,32,undefined,0);preset(2,'block',45,32,undefined,0);preset(2,'block',48,32,undefined,0);preset(2,'block',51,32,undefined,0);preset(2,'block',54,32,undefined,0);preset(2,'block',57,32,undefined,0);preset(2,'block',60,32,undefined,0);preset(2,'block',2,35,undefined,0);preset(2,'block',5,35,undefined,0);preset(2,'block',8,35,undefined,0);preset(2,'block',11,35,undefined,0);preset(2,'block',14,35,undefined,0);preset(2,'block',17,35,undefined,0);preset(2,'block',20,35,undefined,0);preset(2,'block',23,35,undefined,0);preset(2,'block',26,35,undefined,0);preset(2,'block',29,35,undefined,0);preset(2,'block',32,35,undefined,0);preset(2,'block',35,35,undefined,0);preset(2,'block',38,35,undefined,0);preset(2,'block',41,35,undefined,0);preset(2,'block',44,35,undefined,0);preset(2,'block',47,35,undefined,0);preset(2,'block',50,35,undefined,0);preset(2,'block',53,35,undefined,0);preset(2,'block',56,35,undefined,0);preset(2,'block',59,35,undefined,0);preset(2,'block',62,35,undefined,0);preset(2,'block',1,38,undefined,0);preset(2,'block',4,38,undefined,0);preset(2,'block',7,38,undefined,0);preset(2,'block',10,38,undefined,0);preset(2,'block',13,38,undefined,0);preset(2,'block',16,38,undefined,0);preset(2,'block',19,38,undefined,0);preset(2,'block',22,38,undefined,0);preset(2,'block',25,38,undefined,0);preset(2,'block',28,38,undefined,0);preset(2,'block',31,38,undefined,0);preset(2,'block',34,38,undefined,0);preset(2,'block',37,38,undefined,0);preset(2,'block',40,38,undefined,0);preset(2,'block',43,38,undefined,0);preset(2,'block',46,38,undefined,0);preset(2,'block',49,38,undefined,0);preset(2,'block',52,38,undefined,0);preset(2,'block',55,38,undefined,0);preset(2,'block',58,38,undefined,0);preset(2,'block',61,38,undefined,0); }},
 // 11111's edge trick (border-4R, set C #5 shifted 12 to the right): two R-pentominoes on each of white's edge bands, so they bloom
 // through the wrap into black's back rows. Headless: the edge shield wins 71-83% of the time, a random 20-point build 19-23%.
 {id:'m8',title:'Stop the wraparound',hint:"Their R-pentominoes sit on the edge rows and invade through the wrap. Blocks on your outer rows can't be flipped: build the edge shield.",
  goalText:'more cells than them at generation 500',budget:20,shapes:['block','blinker','glider','rpent','gun'],gens:500,goal:'most',fw:0,wrap:true,
  tip:'The edge shield: about ten blocks along your top and bottom rows, and two R-pentominoes in the middle of your half.',
  build(){ buildMirrored(decLayout(EDGE_TRICK),'edge R-pentomino'); }},
];
// Stars: winning a mission is star 1, and each mission has two extra goals you can earn on any winning run.
const DBL=(b,w)=>b>=2*w, HALFUP=(b,w)=>2*b>=3*w, STARS={
 m1:[['hit the wall before generation 100',()=>hitAt!==null&&hitAt<100],['hit it before generation 50',()=>hitAt!==null&&hitAt<50]],
 m2:[['end with twice their cells',DBL],['end with four times their cells',(b,w)=>b>=4*w]],
 m3:[['end with at least 50 cells',b=>b>=50],['use only 4 points',(b,w,u)=>u.pts<=4]],
 m4:[['win using only 2 free-will gliders',(b,w,u)=>u.fw<=2],['end with 1.5 times their cells',HALFUP]],
 m5:[['use only 7 points',(b,w,u)=>u.pts<=7],['end with 1.5 times their cells',HALFUP]],
 m7:[['get 45 cells into their half',(b,w)=>g.reduce((a,v,i)=>a+(v===1&&i>=HALF*N?1:0),0)>=45],['get 60 cells into their half',(b,w)=>g.reduce((a,v,i)=>a+(v===1&&i>=HALF*N?1:0),0)>=60]],
 m6:[['use only 14 points',(b,w,u)=>u.pts<=14],['end with 1.5 times their cells',HALFUP]],
 // thresholds from 400 headless edge-shield builds vs this board: win 71%, by 50+ 57%, by 100+ (with both edge bands blocked) 41%; random 20-point builds: 19-23%, 11-12% and 6%
 m8:[['win by 50 or more',(b,w)=>b-w>=50],['win by 100 or more with blocks on both of your edge bands',(b,w)=>b-w>=100&&edgeBlocks()]]};
// blocks on both of black's edge bands (rows 0-2, which wrap onto white's back row, and rows 29-31)
const edgeBlocks=()=>{ const bl=placed[1].filter(sp=>SHAPES[sp.si].id==='block'); return bl.some(sp=>sp.cells.every(([,y])=>y<=2))&&bl.some(sp=>sp.cells.every(([,y])=>y>=29)); };
// ---------- mission yardstick: what computer-built layouts score on each scored mission ----------
// Measured headless (fw-60, real stepGrid and mission boards, no free will on either side): the player's cells at the mission's
// last generation (m7: cells inside their half) for random layouts in the top half using the mission's pieces and budget.
// beginner = median of 41 single random layouts with the Rookie's limits (no gun or pulsar, at most 1 R-pentomino);
// good = median of 9 runs of best-of-10 random layouts; expert = median of 9 runs of best-of-34 (Master's candidate count).
// Skipped: m1 (hit), m3 (survive a threshold), m4 (no layout to build: free will only).
// Final numbers are 11111's (freewill-opponents/yardstick/): m2 and m7 exact over all 16,384 layouts; m5, m6, m8 from 2,400 beginner
// layouts and a 3,000-layout pool for good/expert, disallowed pieces banned, m6 with every piece, full budget for beginner.
const REF={m2:[120,239,287],m5:[45,220,282],m6:[35,187,249],m7:[5,47,66],m8:[33,168,232]};
const mScore=(m,b,inv)=>!REF[m.id]?null:m.goal==='invade'?inv:b;
const yardstick=m=>{ const r=REF[m.id]; if(!r) return ''; const v=(save.mbest||{})[m.id], has=typeof v==='number';   // fixed markup: 10101 styles it in feel.js
  return `<div class="fw-yardstick" data-mission="${m.id}" data-best="${has?v:''}" data-beginner="${r[0]}" data-good="${r[1]}" data-expert="${r[2]}" data-unit="${m.goal==='invade'?'invade':'cells'}">your best ${has?v:'&ndash;'} &middot; beginner ${r[0]} &middot; good ${r[1]} &middot; expert ${r[2]}</div>`; };
const starTxt=n=>'&#9733;'.repeat(n)+'&#9734;'.repeat(3-n);
let lastStars=null;
let mi=0, e0=0, hitAt=null, missionOK=false, fails=0, failMi=-1, runId=0, flashT=null;
// ---------- daily challenge: the same visible enemy board for everyone on a given date ----------
// Seeded from the local date, so every player's game.js builds the identical layout with no server.
// No free will and only the basic pieces, so results are comparable: win, and use as few points as you can.
const dayKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const dayNo=k=>{const [y,m,d]=k.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(2026,9,10))/864e5)+1;};
function seeded(str){ let h=1779033703^str.length; for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}
  let a=h>>>0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
let dailyKey=dayKey();
const DAILY={id:'daily',title:'Daily',hint:'Same board for everyone today. Beat it using as few points as you can.',goalText:'more cells than them at generation 400',
  budget:20,shapes:['block','blinker','glider','rpent','gun'],gens:400,goal:'most',fw:0,
  build(){ const rand=seeded('freewill-'+dailyKey), T={ban:['lwss','eater','pulsar']};
    const cands=Array.from({length:4},()=>randomLayout(2,rand,T)), foes=Array.from({length:2},()=>randomLayout(1,rand,T).grid);
    let bi=0, bs=-1e9;
    cands.forEach((c,ci)=>{ let sc=0; for(const f of foes){ let x=new Int8Array(N*N); for(let i=0;i<N*N;i++) x[i]=f[i]||c.grid[i]; for(let t=0;t<120;t++) x=stepGrid(x).n; const [b,w]=count(x); sc+=w-b; } if(sc>bs){bs=sc;bi=ci;} });
    for(const o of cands[bi].out) place(2,o.s,o.r,o.m,o.cx,o.cy,true,true); }};
const dailyStage=()=>save.daily&&save.daily.key===dailyKey?'practice':save.dprac===dailyKey?'official go':'practice go first';
const dailyName=()=>`FreeWill daily #${dayNo(dailyKey)}`;
const dailyLine=d=>`${d.win?'won':'lost'} ${d.b} to ${d.w} using ${d.pts} point${d.pts===1?'':'s'}`;
function startDaily(keep){ dailyKey=dayKey(); startMission(-1,keep); }
function dailyFinish(b,w){
  missionOK=b>w; const off=save.daily&&save.daily.key===dailyKey, prac=!off&&save.dprac!==dailyKey;
  if(prac){ save.dprac=dailyKey; persist(); }
  else if(!off){ const y=new Date(); y.setDate(y.getDate()-1); const yk=`${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,'0')}-${String(y.getDate()).padStart(2,'0')}`;
    save.dstreak = save.daily&&save.daily.key===yk ? (save.dstreak||0)+1 : 1;
    save.daily={key:dailyKey,b,w,pts:spent[1],win:missionOK,grid:Array.from(g).join('')}; persist(); if(missionOK){ gainXP(30,'for the daily challenge'); recordGhost(placed[1]); } }
  overText = `${prac?'Practice go: ':''}${missionOK?'You beat':'Not this time on'} today's board: you ${b}, them ${w}${off?' (practice)':''}.`;
  emit('winner',{winner:missionOK?1:2});
}
function shareDaily(){ const d=save.daily; if(!d||d.key!==dailyKey) return;
  const board=Int8Array.from(d.grid,ch=>+ch), url=location.href.split('#')[0]+'#daily';
  try{ window.feel&&window.feel.share&&window.feel.share({title:dailyName(),line:dailyLine(d)+(save.dstreak>1?`, ${save.dstreak}-day streak`:''),board,N,url}); }catch(e){ console.warn(e); } }
// ---------- challenge links: your layout travels in the address after #c= ----------
// Each piece is 7 characters (shape, rotation, mirror, x and y in base 36). The friend who opens it gets your
// layout mirrored into the bottom half as white, and tries to beat it with 20 points of their own. Nobody gets
// free will, so it's layout against layout.
const encLayout=pl=>pl.map(sp=>`${sp.si}${sp.r}${sp.m?1:0}${sp.cx.toString(36).padStart(2,'0')}${sp.cy.toString(36).padStart(2,'0')}`).join('');
function decLayout(str){ const out=[]; if(!/^[0-9a-z]*$/.test(str)||str.length%7) return null;
  for(let i=0;i<str.length;i+=7){ const t=str.slice(i,i+7), si=+t[0]; if(!SHAPES[si]) return null; out.push({si,r:+t[1]%4,m:t[2]==='1',cx:parseInt(t.slice(3,5),36),cy:parseInt(t.slice(5,7),36)}); }
  return out.length?out:null; }
const chalURL=pl=>location.href.split('#')[0]+'#c='+encLayout(pl);
const EDGE_TRICK='3301q0t3200y0u30111013100r01';   // mission 8's enemy, in black-half coordinates like a challenge code
// a black-half piece flipped top to bottom into white's half (y -> 63-y), as a spec cellsAt(...,2) takes. Checked for every shape,
// rotation, mirror and position: the cells match. The gun only lies flat, so its rotation flips between 0 and 1 instead.
function mirrorSpec(sp){ const sh=SHAPES[sp.si], c=cellsAt(sh,sp.r,sp.m,sp.cx,sp.cy,1), h=Math.max(...c.map(p=>p[1]))-Math.min(...c.map(p=>p[1]))+1;
  return {si:sp.si,r:sh.id==='gun'?((sp.r%2)?0:1):(6-sp.r)%4,m:!sp.m,cx:sp.cx,cy:N-1-sp.cy+(h%2?0:1)}; }
// preset white pieces for a mission from black-half specs (free for white, like preset())
function buildMirrored(pl,label){ for(const sp of pl||[]){ const sh=SHAPES[sp.si], cells=cellsAt(sh,sp.r,sp.m,sp.cx,sp.cy,1).map(([x,y])=>[x,N-1-y]);
    if(cells.some(([x,y])=>g[idx(x,y)])) continue; const id=newPiece(2,label||sh.label,cells); pieces[id].cost=0; for(const [x,y] of cells){ g[idx(x,y)]=2; og[idx(x,y)]=id; } } gv++; }
// ---------- ghosts: layouts you won with come back as opponents ----------
// style: 'edge' if half the cost or more is R-pentominoes centred on an edge band (rows 0-2 or 29-31), 'wall' with 8+ blocks, else 'spread'
function ghostStyle(pl){ let cost=0, edge=0, blocks=0;
  for(const sp of pl){ const sh=SHAPES[sp.si]; cost+=sh.cost; if(sh.id==='block') blocks++;
    if(sh.id==='rpent'){ const c=cellsAt(sh,sp.r,sp.m,sp.cx,sp.cy,1), mid=(Math.min(...c.map(p=>p[1]))+Math.max(...c.map(p=>p[1])))/2; if(mid<=2||(mid>=29&&mid<=31)) edge+=sh.cost; } }
  return cost&&edge*2>=cost?'edge':blocks>=8?'wall':'spread'; }
function recordGhost(pl,rating){ if(!pl||!pl.length) return; const spec=pl.map(sp=>({si:sp.si,r:sp.r,m:!!sp.m,cx:sp.cx,cy:sp.cy}));
  if(spec.reduce((a,sp)=>a+SHAPES[sp.si].cost,0)>20) return; const c=encLayout(spec);
  save.ghosts=[{c,s:ghostStyle(spec),t:Date.now(),...(rating?{r:rating}:{})},...(save.ghosts||[]).filter(x=>x.c!==c)].slice(0,30); persist(); }
// eligible ghosts: the newest one of each style, so one style can't crowd out the rest
const ghostPool=()=>{ const by={}; for(const x of (save.ghosts||[]).slice().sort((a,b)=>b.t-a.t)) if(!by[x.s]&&decLayout(x.c)) by[x.s]=x; return Object.values(by); };
// quick match vs Normal or harder (round 1, then kept for the match), arena game 4 on: a ghost about 30% of the time. Never Rookie, missions, daily or challenges.
function pickGhost(){ if(mode!=='cpu') return null; if(arena?match.round<4:(tier<1||match.round!==1)) return null;
  const pool=ghostPool(); if(!pool.length||Math.random()>=0.3) return null; const x=pool[Math.floor(Math.random()*pool.length)];
  const day=new Date(x.t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
  return {id:'ghost',ghost:true,style:x.s,code:x.c,rating:x.r||1000,name:'your ghost',blurb:`a layout you won with on ${day}`,
    pieces:decLayout(x.c).map(mirrorSpec).map(sp=>({shape:SHAPES[sp.si].id,r:sp.r,m:sp.m,cx:sp.cx,cy:sp.cy}))}; }
// ---------- rating: Elo, K=24, start 1000; each computer tier (and its rivals and ghosts) has a fixed rating ----------
const TIER_RATING={'Rookie':800,'Rookie+':900,'Normal':1000,'Hard':1150,'Master':1300};
const rating=()=>save.rating&&isFinite(save.rating.v)?save.rating.v:1000;
// a ghost plays at the rating of the opponent it beat (1000 for ghosts saved before that was stored); rivals and the plain computer at their tier's
const oppRating=()=>rival&&rival.ghost?(rival.rating||1000):(TIER_RATING[curT().name]||1000);
function rate(score){ const R=rating(), Ro=oppRating(), E=1/(1+Math.pow(10,(Ro-R)/400)), v=Math.round(R+24*(score-E));
  save.rating={v,t:Date.now()}; if(v!==R) toasts.push(`Rating ${R} &rarr; ${v}`); persist(); }
let chalLayout=null;
const CHALLENGE={id:'challenge',title:'Challenge',hint:"A friend built the bottom half. Beat their layout: have more cells at generation 500.",goalText:'more cells than their layout at generation 500',
  budget:20,shapes:null,gens:500,goal:'most',fw:0,
  build(){ let used=0; for(const o of chalLayout){ const sh=SHAPES[o.si]; if(used+sh.cost>20) break;
      const cells=cellsAt(sh,o.r,o.m,o.cx,o.cy,1).map(([x,y])=>[x,N-1-y]); if(!validPlace(g,2,cells,sh.cost,20-used)) continue;
      const id=newPiece(2,sh.label,cells); pieces[id].cost=sh.cost; for(const [x,y] of cells){ g[idx(x,y)]=2; og[idx(x,y)]=id; } used+=sh.cost; spent[2]+=sh.cost; } gv++; }};
function startChallenge(pl){ chalLayout=pl; startMission(-2); }
function chalFinish(b,w){ missionOK=b>w;
  if(missionOK){ const k=encLayout(chalLayout||[]); save.beatChal=save.beatChal||{};   // 30 XP the first time per friend layout, 5 for beating it again
    if(save.beatChal[k]) gainXP(5,'for another win vs this layout'); else { save.beatChal[k]=true; gainXP(30,'for beating a friend'); } recordGhost(placed[1]); }
  overText=`${missionOK?"You beat your friend's layout":"Your friend's layout wins"}: you ${b}, them ${w}.`; emit('winner',{winner:missionOK?1:2}); }
function shareChallenge(line){ const url=chalURL(placed[1]);
  try{ window.feel&&window.feel.share&&window.feel.share({title:'FreeWill challenge',line,board:g.slice(),N,url}); }catch(e){ console.warn(e); } }
const M=()=>mi===-2?CHALLENGE:mi<0?DAILY:MISSIONS[mi];
const arenaHead=()=>`Arena game ${match.round} vs ${rival?rival.name:curT().name} &middot; ${arena.wins} of 10 wins &middot; <span style="white-space:nowrap">lives <span style="color:#f66">${'&#9829;'.repeat(arena.lives)}</span><span style="color:#ccc">${'&#9825;'.repeat(3-arena.lives)}</span></span>`;
const mName=()=>mi===-2?'Challenge from a friend':mi<0?`${dailyName().replace('FreeWill d','D')} (${dailyStage()})`:`Mission ${mi+1}: ${M().title}`;
const allowedShape=s=>mode==='campaign'?(M().shapes?M().shapes.includes(s.id):unlockedShape(s)):unlockedShape(s);
const missionOpen=i=>i===0||!!save.done[MISSIONS[i-1].id];
function startCampaign(){ const i=MISSIONS.findIndex(m=>!save.done[m.id]); if(i<0) return showMenu(); startMission(i); }
// "start empty" sits next to "try again" after a mission loss; the first retry's setup line says the layout was kept
const retries={}; let keptSig=null;
const freshOK=()=>mode==='campaign'&&mi>=0&&!missionOK&&!M().auto&&M().budget>0&&placed[1].length>0;
const keptNote=()=>keptSig!==null&&phase==='setup'&&keptSig===placed[1].length+':'+spent[1];
// phones: feel.js pins the gold "try again" bottom-right; "start empty" takes the rest of that row, to its left
{ const st=document.createElement('style'); st.textContent=`@media (pointer:coarse),(max-width:700px){#game-panel button[data-a=retry][data-pair]{width:42vw}
 #game-panel button[data-a=fresh]{position:fixed;left:10px;right:calc(42vw + 20px);bottom:calc(10px + env(safe-area-inset-bottom));z-index:31;margin:0 !important;min-height:44px;font-size:14px !important;white-space:normal;line-height:1.15}}`; document.head.appendChild(st); }
function startMission(i,keep){ // keep: re-place these pieces (try again keeps your layout so you can tweak it)
  if(i!==failMi){ fails=0; failMi=i; } mode='campaign'; mi=i; match={round:1,results:[],score:[0,0]}; placed={1:[],2:[]}; matchOver=false;
  const m=M(); GENS=m.gens; BUDGET=m.budget; FW=m.fw; resetBoard(); fwLeft=[0,FW,0];
  m.build(); e0=count(g)[1]; hitAt=null; missionOK=false;
  const first=SHAPES.findIndex(s=>allowedShape(s)); sel=first<0?0:first; rot=0;
  if(keep&&!m.auto) for(const sp of keep) place(1,SHAPES[sp.si],sp.r,sp.m,sp.cx,sp.cy,true);
  keptSig= i>=0&&keep&&keep.length&&!m.auto&&retries[i]===1&&placed[1].length ? placed[1].length+':'+spent[1] : null;   // only the first retry, until you change something
  setupP=1; cover=null; phase='setup'; speed=m.speed||20; window.scrollTo(0,0);
  emit('mode',{mode:mi===-2?'challenge':mi===-1?'daily':'mission'}); emit('phase',{phase:'setup'});
  try{ const F=window.feel; if(F&&F.setZone) F.setZone(m.goal==='invade'?32:null,63); if(F&&F.setWrapHint) F.setWrapHint(!!m.wrap||m.goal==='invade'); }catch(e){}   // 10101's gold target zone and edge markers
  if(m.budget===0){ cover={text:`Mission ${mi+1}: ${m.title}`,sub:m.intro||m.hint,lines:[`Goal: ${m.goalText}.`,...(fails&&m.tip?[`Hint: ${m.tip}`]:[]),`${isTouch()?'Tap':'Click'} to start.`],then:()=>{cover=null;startRun();}}; render(); }
  else render();
}
function showMenu(){ phase='menu'; flashMsg=''; cv.style.display='none';   // no empty board above the mission list
  cover=null; g=new Int8Array(N*N); flipped=new Int8Array(N*N); trail=new Float32Array(N*N); hist=[]; render(); window.scrollTo(0,0); }
function missionFinish(b,w){
  if(mi===-2) return chalFinish(b,w);
  if(mi<0) return dailyFinish(b,w);
  const m=M();
  // 'invade': only your cells inside their half (rows 32 to 63) count, so blooming at home doesn't win it
  const inv=g.reduce((a,v,i)=>a+(v===1&&i>=HALF*N?1:0),0);
  missionOK = m.goal==='hit'?hitAt!==null : m.goal==='survive'?b>=m.need : m.goal==='invade'?inv>=m.need : b>w;
  if(missionOK) fails=0; else { failMi=mi; fails++; }
  lastStars=null;
  { const sc=mScore(m,b,inv); if(sc!==null){ save.mbest=save.mbest||{}; if(!(sc<=(save.mbest[m.id]??-1))){ save.mbest[m.id]=sc; persist(); } } }
  if(missionOK){ const u={pts:spent[1],fw:FW-fwLeft[1]}, got=[true,...STARS[m.id].map(([,f])=>!!f(b,w,u))], n=got.filter(Boolean).length, prev=save.stars[m.id]||0;
    lastStars={got,n,prev}; if(n>prev){ save.stars[m.id]=n; persist(); }
    if(MISSIONS.every(x=>(save.stars[x.id]||0)===3)) achieve('allstars');
    emit('stars',{mission:m.id,stars:n,best:Math.max(n,prev),improved:n>prev}); }
  if(missionOK){ const first=!save.done[m.id]; save.done[m.id]=true; persist(); gainXP(first?100:20, first?`for ${m.title}`:'for a replay');
    if(m.id==='m1') achieve('first'); if(MISSIONS.every(x=>save.done[x.id])) achieve('campaign'); if(w===0&&b>0) achieve('wipe'); }
  overText = missionOK ? (m.goal==='hit'?'Direct hit! Mission complete.':m.goal==='survive'?`Mission complete: you kept ${b} cells, and you needed ${m.need}.`:m.goal==='invade'?`Mission complete: ${inv} of your cells made it into their half, and you needed ${m.need}.`:`Mission complete: you ${b}, them ${w}.`)
    : m.goal==='hit' ? 'Missed! Try another spot.' : m.goal==='survive' ? `Not this time: you kept ${b} cells and needed ${m.need}.` : m.goal==='invade' ? `Not this time: ${inv} of your cells got into their half, and you needed ${m.need}.` : `Not this time: you ${b}, them ${w}.`;
  emit('winner',{winner:missionOK?1:2});
}
// ---------- where things are, in words ----------
function where(cells){
  const x=cells.reduce((a,c)=>a+((c[0]+N)%N),0)/cells.length, y=cells.reduce((a,c)=>a+((c[1]+N)%N),0)/cells.length;
  const v=y<16?'top':y<32?'upper middle':y<48?'lower middle':'bottom', h=x<22?'left':x>41?'right':'centre';
  return `${v}, ${h}`;
}
function newPiece(p,label,cells){ pieces.push({p,label,cells:cells.map(([x,y])=>[(x+N)%N,(y+N)%N]),where:where(cells),final:0,peak:cells.length,flips:0,born:gen,gone:null}); return pieces.length-1; }
// ---------- setup ----------
function place(p,shape,r,m,cx,cy,silent,orig){
  stopTest();
  const cells=cellsAt(shape,r,m,cx,cy,p);
  if(!validPlace(g,p,cells,shape.cost,orig?BUDGET-spent[p]:leftFor(p))) return false;
  if(match.round>1&&!orig) tweak[p].add+=shape.cost;
  const id=newPiece(p,shape.label,cells);
  pieces[id].cost=shape.cost;
  for(const [x,y] of cells){ g[idx(x,y)]=p; og[idx(x,y)]=id; }
  gv++; spent[p]+=shape.cost; placed[p].push({cells,cost:shape.cost,si:SHAPES.indexOf(shape),r,m,cx,cy,id,orig:!!orig}); warn=false; hover=null;
  if(!silent) emit('place',{player:p,shape:shape.id});
  if(mode==='campaign'&&M().auto&&!SHAPES.some(s=>allowedShape(s)&&s.cost<=leftFor(1))) setTimeout(()=>{ if(phase==='setup') startRun(); },350);
  return true;
}
function removeSpec(p,k){
  const sp=placed[p][k]; if(!sp) return false; stopTest();
  if(match.round>1){ if(sp.orig){ if(tweak[p].rm+sp.cost>TWEAK) return false; tweak[p].rm+=sp.cost; removedGhost[p].push(sp.cells); } else tweak[p].add-=sp.cost; }
  for(const [x,y] of sp.cells){ const j=idx(x,y); g[j]=0; og[j]=0; }
  gv++; pieces[sp.id]=null; spent[p]-=sp.cost; placed[p].splice(k,1); return true;
}
function undo(p){ for(let k=placed[p].length-1;k>=0;k--) if(!placed[p][k].orig){ removeSpec(p,k); break; } render(); }
function removeAt(p,x,y){ // the piece under the cursor, or failing that the nearest one within 2 cells
  let k=-1, bd=9;
  placed[p].forEach((sp,i)=>{ for(const [a,b] of sp.cells){ const d=Math.max(Math.abs(a-x),Math.abs(b-y)); if(d<bd){bd=d;k=i;} } });
  if(k<0||bd>2){ flashMsg=`${RC()} on one of your own pieces to remove it.`; render(); return; }
  const sp=placed[p][k];
  if(!removeSpec(p,k)) flashMsg=`You can't remove the ${SHAPES[sp.si].label}: it costs ${sp.cost} points and you can only remove ${TWEAK-tweak[p].rm} more this round.`;
  render(); }
const peekOn=()=>peek&&mode==='cpu'&&phase==='setup';
// round 1 (or a fresh arena opponent): the planned layout; round 2+ of a quick match: their actual cells
const peekCells=()=>{ if(match.round>1&&!arena){ const a=new Int8Array(N*N); for(let i=0;i<N*N;i++) if(g[i]===2) a[i]=2; return a; } return cpuPlan&&cpuPlan.cells; };
const nudgeOn=()=>sameNudge&&mode==='cpu'&&!arena&&match.round>1&&!tweak[1].add&&!tweak[1].rm;
let sameNudge=false, maskC=null, flashMsg='', toasts=[], showReview=false, gv=0, launchP=1;
// ---------- test run: the builder's own half alone, 80 generations, as a ghost overlay ----------
// Works on a copy only: g, spent, placed, hist and the phase are never touched. testId works like runId,
// so a cancelled or stale animation can't keep drawing.
const TEST_GENS=80, TEST_FPS=25; let test=null, testId=0, testDone='';   // testDone: the closing line, kept until the player's next action
const canTest=()=>phase==='setup'&&!thinking&&!cover&&BUDGET>0&&placed[meP()].length>0;
// The closing numbers average gens 78-80: pulsars cycle every 3 generations, so one frame overstates them (11111's 331-layout check).
const testScore=t=>{ const tl=t.tail.length?t.tail:[[t.n,t.nf]], av=k=>Math.round(tl.reduce((a,c)=>a+c[k],0)/tl.length), you=av(0), them=av(1), d=you-them;
  return t.foe?`you ${you}, them ${them} (${d>0?'+'+d:d<0?d:'even'}). They'll adapt, so change something.`
    :`you have ${you} cells at gen ${TEST_GENS}`; };
const testLine=()=>test?(test.gen>=TEST_GENS?testDone:(test.foe?`${test.label}, gen ${test.gen}/${TEST_GENS}: you ${test.n}, them ${test.nf}`:`${test.label}, gen ${test.gen} of ${TEST_GENS}`)):testDone;
// Who the test run plays against. Round 2+ against the computer (not arena): its last layout, which is already shown
// to you as a faded ghost. Everywhere else: nobody yet (the other side is hidden). One place to switch round 1 to a stock rival later.
function testFoe(me){
  if(mode==='cpu'&&match.round>1&&!arena&&me===1){ const f=new Int8Array(N*N); let n=0; for(let i=HALF*N;i<N*N;i++) if(g[i]===2){ f[i]=2; n++; }
    if(n) return {cells:f,label:'vs their old layout'}; }   // short: on a 390 px phone the closing line has to fit in two lines
  return {cells:null,label:'test run: your half alone'};
}
function stopTest(){ testDone=''; if(!test) return false; test=null; testId++; return true; }   // true if a run was playing
function startTest(){
  stopTest(); if(!canTest()) return;
  const me=meP(), foe=testFoe(me), x=new Int8Array(N*N); let n=0;
  for(let i=0;i<N*N;i++){ if(g[i]===me){ x[i]=me; n++; } else if(foe.cells&&foe.cells[i]) x[i]=foe.cells[i]; }   // without a foe the other side stays empty: it's hidden anyway
  const my=++testId, rid=runId; test={id:my,p:me,grid:x,gen:0,n,nf:count(x)[2-me],foe:!!foe.cells,label:foe.label,tail:[]};
  const alive=()=>test&&test.id===my&&testId===my&&runId===rid&&phase==='setup'&&!cover&&!thinking&&meP()===me;
  (function frame(){
    if(!alive()){ if(test&&test.id===my){ test=null; testId++; render(); } return; }
    if(test.gen>=TEST_GENS){ setTimeout(()=>{ if(alive()){ test=null; testId++; render(); } },1200); return; }   // the ghost clears after a moment; testDone stays in the HUD
    test.grid=stepGrid(test.grid).n; test.gen++; const c=count(test.grid); test.n=c[test.p-1]; test.nf=c[2-test.p]; if(test.gen>TEST_GENS-3) test.tail.push([test.n,test.nf]);
    if(test.gen>=TEST_GENS) testDone=`${test.label}: ${testScore(test)}`;
    render();
    setTimeout(frame,1000/TEST_FPS);
  })();
  render();
}
function ready(){
  const me=meP();
  if(!(mode==='campaign'&&mi===-1)&&(match.round>1?tweak[me].add<tweak[me].rm&&leftFor(me)>0:spent[me]<BUDGET)&&!warn){ warn=true; { const n=match.round>1?leftFor(me):BUDGET-spent[me]; flashMsg=`You still have ${n} point${n===1?'':'s'}.`; }; flashMsg+=` Press again to start anyway.`; render(); return; }
  warn=false;
  // round 2+ against the computer: it has just swapped against this exact layout, so nudge once before keeping it
  if(mode==='cpu'&&!arena&&match.round>1&&!tweak[me].add&&!tweak[me].rm&&!sameNudge){ sameNudge=true; flashMsg=''; render(); return; }   // shown in the header only (nudgeOn), not as a toast over the buttons
  if(mode==='campaign'){ startRun(); return; }
  if(mode==='cpu'){ match.round>1&&!arena?cpuTweak():cpuSetup(); return; }
  if(setupP===1){ setupP=2; sel=2; rot=0; mir=false; cover={text:`Pass the screen to ${NAME[2]}.`,sub:`${NAME[1]}, look away. ${NAME[2]}, click to start placing.`,then:()=>{cover=null;render();}}; }
  else cover={text:'Both sides are ready.',sub:`${isTouch()?'Tap':'Click'} to reveal the board and start the run.`,then:()=>{cover=null;startRun();}};
  render();
}

// ---------- computer opponent ----------
// It never reads black's cells. It makes random layouts for white, plays each against a few imagined
// black layouts it also made up, and keeps the one that did best.
function randomLayout(p,rand,T){ // T (optional) limits a weak computer: fewer points, banned shapes, at most maxR R-pentominoes
  const grid=new Int8Array(N*N); let left=T&&T.budget?Math.min(T.budget,BUDGET):BUDGET, tries=0, nR=0; const out=[];
  while(left>0&&tries++<60){
    const pool=SHAPES.filter(s=>s.cost<=left&&!(T&&T.ban&&T.ban.includes(s.id))&&!(T&&T.maxR!==undefined&&s.id==='rpent'&&nR>=T.maxR)); if(!pool.length) break;
    const s=pool[Math.floor(rand()*pool.length)], r=Math.floor(rand()*4), m=rand()<.5;
    const cx=Math.floor(rand()*N), cy=p===1?Math.floor(rand()*HALF):HALF+Math.floor(rand()*HALF);
    const cells=cellsAt(s,r,m,cx,cy,p);
    if(validPlace(grid,p,cells,s.cost,left)){ for(const [x,y] of cells) grid[idx(x,y)]=p; left-=s.cost; if(s.id==='rpent') nR++; out.push({s,r,m,cx,cy}); }
  }
  return {grid,out};
}
// ---------- Rookie: a fixed pool of measured layouts ----------
// A fresh random 12-point layout swung from a 4% to a 54% Rookie win rate depending on what it rolled, and since the
// computer keeps its layout between rounds, a weak roll meant 240-0 blowouts all match. These 6 layouts (10 to 16 points,
// no gun or pulsar) were picked from 84 generated ones and re-measured headless with the real rules against two kinds of
// beginner: a careless one (random starter pieces until all 20 points are spent, random spots in the top half) and a
// planned one (1-2 R-pentominoes plus gliders). Over 1000 games each the Rookie wins 39% and 37.5%
// (the fw-28 pool won 32% and 28%). A random sideways shift (the board wraps left to right) keeps them from looking
// the same twice. It still never reads black's cells.
const ROOKIE_POOL=[
 [['blinker',2,0,36,32],['lwss',0,0,60,34],['rpent',1,1,42,35]],
 [['glider',1,1,33,63],['rpent',2,0,18,52],['block',0,0,40,53],['blinker',0,1,13,47],['block',0,1,15,57],['blinker',2,1,38,49]],
 [['rpent',1,1,9,38],['lwss',1,1,9,44],['blinker',1,0,3,53],['block',1,1,18,50],['block',1,0,38,60],['blinker',0,1,16,48],['blinker',1,0,21,34]],
 [['lwss',1,1,2,45],['blinker',1,1,60,37],['block',1,1,34,36],['block',2,0,32,35],['rpent',3,1,45,35],['blinker',3,0,5,46],['blinker',3,0,62,33]],
 [['eater',3,0,1,47],['block',1,1,15,42],['blinker',0,1,49,55],['blinker',3,0,45,39],['block',1,0,44,38],['glider',1,0,60,35],['block',2,1,44,49]],
 [['rpent',0,0,45,33],['lwss',3,1,53,38],['block',1,1,29,33]]];
function rookieLayout(rand){
  const pick=ROOKIE_POOL[Math.floor(rand()*ROOKIE_POOL.length)], dx=Math.floor(rand()*N), grid=new Int8Array(N*N), out=[];
  for(const [id,r,m,cx0,cy] of pick){ const sh=SHAPES.find(x=>x.id===id), cx=(cx0+dx)%N, cells=cellsAt(sh,r,!!m,cx,cy,2);
    if(validPlace(grid,2,cells,sh.cost,99)){ for(const [x,y] of cells) grid[idx(x,y)]=2; out.push({s:sh,r,m:!!m,cx,cy}); } }
  return {grid,out};
}
// ---------- end rookie
// starter layout for a player's first quick matches: STARTER_CODE is filled in from the headless search (see the report)
// two R-pentominoes, three gliders and a block (20 points). Headless, round 1: beats the Rookie in 66.7% of all 384
// pool layout x sideways shift pairings (median margin +30), and Normal's three rivals in 38% of 192 games.
const STARTER_CODE='3010l0v3201n0j2000l0r210020v2301r0v0100800';
const starterOK=()=>mode==='cpu'&&!arena&&match.round===1&&(save.quickN||0)<=3&&phase==='setup'&&!!decLayout(STARTER_CODE);
function placeStarter(){ while(placed[1].length) removeSpec(1,0); const pl=decLayout(STARTER_CODE);
  // the board wraps sideways, so a random shift is the same layout; skip the few shifts where a piece wouldn't fit whole
  const fits=dx=>{ const t=new Int8Array(N*N); for(const sp of pl){ const sh=SHAPES[sp.si], c=cellsAt(sh,sp.r,sp.m,(sp.cx+dx)%N,sp.cy,1); if(!validPlace(t,1,c,sh.cost,99)) return false; for(const [x,y] of c) t[idx(x,y)]=1; } return true; };
  let dx=0; for(let k=0;k<64;k++){ const d=Math.floor(Math.random()*N); if(fits(d)){ dx=d; break; } }
  for(const sp of pl) place(1,SHAPES[sp.si],sp.r,sp.m,(sp.cx+dx)%N,sp.cy); emit('place',{player:1,shape:'starter'}); }
// The computer's fresh layout (round 1, or each arena game) is decided when setup starts, not on 'ready', so the
// "peek at their layout" toggle shows exactly what it will play. It still never reads black's cells: the search only
// uses made-up black layouts. cpuPlan.out is a list of {s,r,m,cx,cy}; cpuPlan.cells marks them on a white-only grid.
let peek=false, cpuPlan=null, planId=0, rulesOpen=false;
function planCpu(){
  const id=++planId, plan={id,out:null,cells:null,waiting:false}; cpuPlan=plan;
  const done=out=>{ if(cpuPlan!==plan) return; const c=new Int8Array(N*N);
    for(const o of out) for(const [x,y] of cellsAt(o.s,o.r,o.m,o.cx,o.cy,2)) c[idx(x,y)]=2;
    plan.out=out; plan.cells=c; if(plan.waiting) applyPlan(); else if(phase==='setup'&&peek) render(); };
  if(rival) return done(rival.pieces.map(pc=>({s:SHAPES.find(x=>x.id===pc.shape),r:pc.r||0,m:!!pc.m,cx:pc.cx,cy:pc.cy,rv:true})));
  if(curT()===TIERS[0]) return done(rookieLayout(Math.random).out);
  const T=curT(), cands=Array.from({length:T.cands},()=>randomLayout(2,Math.random,T));
  const foes=Array.from({length:T.foes},()=>randomLayout(1,Math.random).grid);
  const scores=cands.map(()=>0); let k=0;
  (function work(){ if(cpuPlan!==plan) return;
    const ci=Math.floor(k/foes.length), fi=k%foes.length;
    let sim=new Int8Array(N*N); for(let i=0;i<N*N;i++) sim[i]=foes[fi][i]||cands[ci].grid[i];
    for(let t=0;t<T.gens;t++) sim=stepGrid(sim).n;
    const [b,w]=count(sim); scores[ci]+=w-b; k++;
    if(k<cands.length*foes.length){ setTimeout(work,0); return; }
    done(cands[scores.indexOf(Math.max(...scores))].out); })();
}
function applyPlan(){ const out=cpuPlan.out; cpuPlan.waiting=false;
  for(const o of out) place(2,o.s,o.r,o.m,o.cx,o.cy,true,o.rv?true:match.round>1);   // a fresh arena opponent gets its full budget
  emit('place',{player:2,shape:'cpu'}); thinking=false; startRun(); }   // no extra reveal tap against the computer
function cpuSetup(){
  if(!cpuPlan) planCpu();
  if(cpuPlan.out) return applyPlan();
  cpuPlan.waiting=true; thinking=true; render();   // still searching: wait for it
}
// Between rounds the computer may also change up to 5 points. It tests a dozen small changes against
// black's layout from the start of this round (what it saw in the breakdown, not black's new changes).
function cpuTweak(){
  thinking=true; render();
  const base=g.slice(); for(let i=0;i<N*N;i++) if(base[i]===1) base[i]=0;
  const foe=prevBlack;
  const cands=[{rm:-1,adds:[]}];
  for(let c=0;c<(tier===0?2:Math.max(4,TIERS[tier].cands));c++){   // the Rookie only tries two random swaps, so it changes a little but doesn't optimise much
    const rmOk=placed[2].map((sp,k)=>sp.cost<=TWEAK?k:-1).filter(k=>k>=0);
    const rm=Math.random()<.6&&rmOk.length?rmOk[Math.floor(Math.random()*rmOk.length)]:-1;
    const grid=base.slice(); let tl=TWEAK, bl=BUDGET-spent[2];
    if(rm>=0){ const sp=placed[2][rm]; for(const [x,y] of sp.cells) grid[idx(x,y)]=0; bl+=sp.cost; }
    const adds=[]; let tries=0;
    while(tries++<40){ const pool=SHAPES.filter(s=>s.cost<=Math.min(tl,bl)); if(!pool.length) break;
      const sh=pool[Math.floor(Math.random()*pool.length)], r=Math.floor(Math.random()*4), m=Math.random()<.5;
      const cx=Math.floor(Math.random()*N), cy=HALF+Math.floor(Math.random()*HALF), cells=cellsAt(sh,r,m,cx,cy,2);
      if(validPlace(grid,2,cells,sh.cost,Math.min(tl,bl))){ for(const [x,y] of cells) grid[idx(x,y)]=2; tl-=sh.cost; bl-=sh.cost; adds.push({sh,r,m,cx,cy}); } }
    cands.push({rm,adds,grid});
  }
  cands[0].grid=base;
  const scores=[]; let k=0;
  (function work(){
    let sim=new Int8Array(N*N); for(let i=0;i<N*N;i++) sim[i]=foe[i]===1?1:cands[k].grid[i];
    for(let t=0;t<260;t++) sim=stepGrid(sim).n;
    const [b,w]=count(sim); scores.push(w-b); k++;
    if(k<cands.length){ setTimeout(work,0); return; }
    const best=cands[scores.indexOf(Math.max(...scores))];
    if(best.rm>=0) removeSpec(2,best.rm);
    for(const a of best.adds) place(2,a.sh,a.r,a.m,a.cx,a.cy,true);
    emit('place',{player:2,shape:'cpu'});
    const what=best.rm<0&&!best.adds.length?'kept its layout':`swapped ${Math.max(tweak[2].rm,tweak[2].add)} points`;
    thinking=false; void what; startRun();
  })();
}
// the computer's free-will aim comes from a per-run seeded generator, not Math.random, so feel.js's effects (which draw from
// Math.random every frame) can't change it: a skipped run ends on exactly the board the full run would have
let fwRand=Math.random, nextRunSeed=null;
const runRng=a=>()=>{ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
function cpuFreeWill(){
  if(mode!=='cpu'||fwLeft[2]<=0||tier===0) return;   // the Rookie never uses free will
  const [b,w]=count(g);
  const due=(gen===460&&w<=b)||(gen>=200&&gen%60===0&&w<b*0.85);
  if(!due) return;
  const blacks=[]; for(let i=0;i<N*N;i++) if(g[i]===1) blacks.push(i);
  if(!blacks.length) return;
  const t=blacks[Math.floor(fwRand()*blacks.length)];
  const sx=fwRand()<.5?1:-1, sy=fwRand()<.5?1:-1;
  launch(2,(t%N)-sx*7,Math.floor(t/N)-sy*7,sx,sy);
}

// ---------- run ----------
function startRun(){ flashMsg=''; g0=g.slice(); og0=og.slice(); phase='run'; gen=0; hist=[count(g)]; nud={1:{streak:0,last:-1e9,n:0},2:{streak:0,last:-1e9,n:0}};
  runSeed=nextRunSeed!=null?nextRunSeed:Math.floor(Math.random()*2147483647); nextRunSeed=null; fwRand=runRng(runSeed); fam=og.slice(); contactGen=null; slowUntil=0; emit('phase',{phase:'run'});
  // Burning Sky for the gun mission and for a round that decides the match (1 to 1 going into it)
  const finale = mode==='campaign' ? M().id==='m6' : match.score[0]===ROUNDS>>1 && match.score[1]===ROUNDS>>1;
  if(finale) try{ window.feel&&window.feel.playMusic&&window.feel.playMusic('finale'); }catch(e){}
  render(); }
function launch(p,x,y,sx,sy){
  if(phase!=='run'||fwLeft[p]<=0) return;
  const gc=[[1,0],[2,1],[0,2],[1,2],[2,2]].map(([a,b])=>[x+sx*(a-1),y+sy*(b-1)]);
  const id=newPiece(p,`free-will glider (gen ${gen})`,gc);
  const js=gc.map(([cx,cy])=>idx(cx,cy)); for(const j of js){ g[j]=p; flipped[j]=0; if(fam) fam[j]=id; }
  launches.push({gen,p,id,cells:js}); gv++; try{window.feel&&window.feel.ripple&&window.feel.ripple(x,y,p);}catch(e){}
  fwLeft[p]--; fwLog.push({gen,p}); emit('freewill',{player:p}); render();
}
function playerLaunch(p,x,y){ // always heads toward the other side; q / p switches left or right
  launch(p,x,y,fwDir[p],p===1?1:-1);
}
let nud=null, runSeed=0, fam=null, contactGen=null, slowUntil=0, slowMul=1;
// the Rookie and every mission/daily/challenge enemy never launch free will, so their unused gliders don't keep a result open
const fwUsable=p=>p===2&&(mode==='campaign'||(mode==='cpu'&&tier===0))?0:fwLeft[p];
function nudgeTick(){ if(!nud) return; const ps=mode==='hotseat'?[1,2]:[1];
  for(const p of ps){ const q=nud[p]; if(fwLeft[p]<=0) continue; const L=hist.length, av=k=>(hist[k][p-1]+hist[Math.max(0,k-1)][p-1]+hist[Math.max(0,k-2)][p-1])/3;
    if(L>=2){ const a=av(L-1), b=av(L-2); if(a<b) q.streak++; else if(a>b) q.streak=0; }
    const mine=hist[L-1][p-1], theirs=hist[L-1][2-p];
    if((q.streak>=NUDGE.fallGens||(gen>=NUDGE.afterGen&&mine<=NUDGE.behind*theirs))&&q.n<NUDGE.max&&gen-q.last>=NUDGE.cooldown){
      q.last=gen; q.n++; q.streak=0; emit('nudge',{player:p,left:fwLeft[p]}); } } }
// the result can't change any more: shown as a "skip to the end" button. Missions checked mid-run ('hit') or against a
// fixed target ('survive', 'invade') don't get it, since a cell lead says nothing about those goals.
function decided(){ if(phase!=='run'||gen>=GENS) return false; if(mode==='campaign'&&M().goal!=='most') return false;
  const [b,w]=count(g), lead=b>=w?1:2, hi=Math.max(b,w), lo=Math.min(b,w);
  const D=mode==='hotseat'?DECIDED_HS:DECIDED; return gen>=D.minGen&&hi>=D.ratio*lo&&hi-lo>=D.minLead&&fwUsable(3-lead)<=0; }
// fast-forward with the very same tick() (same rules, same computer free-will timing and random draws), just without drawing or events
function skipToEnd(){ if(!decided()) return; const id=runId; skipping=true;
  try{ while(phase==='run'&&runId===id) tick(true); } finally{ skipping=false; } render(); }
function tick(fast){
  const {n,f,fc}=stepGrid(g);
  if(fam){ const r=stepFam(g,n,fam); fam=r.nf; if(r.touch&&contactGen===null){ contactGen=gen+1; emit('contact',{gen:contactGen}); } }
  for(let i=0;i<N*N;i++) if(f[i]) lossMap[f[i]][i]++;
  for(let i=0;i<N*N;i++){ trail[i]*=0.82; if(g[i]&&!n[i]){trail[i]=1;trailC[i]=g[i];} }
  g=n; flipped=f; gen++; hist.push(count(g)); emit('flipBurst',{count:fc});
  if(skipping){ try{ window.feel&&window.feel.recordFrame&&window.feel.recordFrame(gen,g); }catch(e){} }   // replay/share/field guide still see skipped generations
  cpuFreeWill();
  if(!fast) nudgeTick();
  const [b,w]=count(g);
  if(mode==='campaign'&&M().goal==='hit'){ if(hitAt===null&&(w!==e0||b===0)) hitAt=gen; /* the wall is still blocks, so any change means contact */ if(hitAt!==null&&gen>=hitAt+50) return finish(b,w), render(); }
  if(gen>=GENS||b===0||w===0){ skipping=false; finish(b,w); }
  if(!fast) render();
}
function finish(b,w){
  phase='over'; flashMsg=''; const win=b>w?1:w>b?2:0;
  if(mode==='campaign'){ missionFinish(b,w); emit('phase',{phase:'over'}); }
  else { emit('winner',{winner:win,label:win?winsT(win):''}); emit('phase',{phase:'over'});
  overText = win ? `${Pn(win)} ${win===1&&mode!=='hotseat'?'win':'wins'}, ${Math.max(b,w)} cells to ${Math.min(b,w)}` : `Draw, ${b} cells each`;
  if(gen<GENS) overText+=` (wiped out at generation ${gen})`;
  match.results.push(win); if(win) match.score[win-1]++;
  rivalLine=''; if(rival&&mode==='cpu'){ const r=recOf(rival); if(win===1){ r.wins++; if(rival.counter) rivalLine=`You beat ${rival.name}. Its counter: ${rival.counter}`; } else if(win===2) r.losses++; persist(); }
  if(mode==='cpu'&&win===1) recordGhost(placed[1],oppRating());   // the ghost is as strong as what it beat
  if(arena){ rate(win===1?1:win===2?0:.5);   // each arena game counts as a result, rated against this game's opponent
    if(win===1) arena.wins++; else if(win===2) arena.lives--; emit('arena',{game:match.round,wins:arena.wins,lives:arena.lives,opponent:rival?rival.name:curT().name});
    matchOver = arena.wins>=10 || arena.lives<=0;
    if(matchOver){ const champ=arena.wins>=10, prevBest=save.arenaBest||0; if(arena.wins>(save.arenaBest||0)){ save.arenaBest=arena.wins; toasts.push(`New best arena run: ${arena.wins} wins`); }
      // 15 XP per win past your previous best, 5 per win otherwise, so three quick Rookie wins can't be farmed run after run
      { const nb=Math.max(0,arena.wins-prevBest), old=arena.wins-nb, xp=15*nb+5*old; if(xp) gainXP(xp,nb?`for ${arena.wins} arena win${arena.wins===1?'':'s'} (${nb} past your best)`:`for another arena run (${arena.wins} win${arena.wins===1?'':'s'})`); } if(champ) achieve('arena'); persist();
      setTimeout(()=>emit('matchWinner',{winner:champ?1:2,label:winsT(champ?1:2)+' the arena'}),1200); } }
  else matchOver = match.score[0]*2>ROUNDS || match.score[1]*2>ROUNDS || match.results.length>=ROUNDS;
  if(matchOver&&!arena){ const mw=match.score[0]>match.score[1]?1:match.score[1]>match.score[0]?2:0; setTimeout(()=>emit('matchWinner',{winner:mw,label:mw?winsT(mw)+' the match':''}),1200);
    if(mode==='cpu') rate(mw===1?1:mw===2?0:.5);
    if(mode==='cpu'&&mw===1){ save.wins++; const tn=TIERS[tier].name; save.beatTier=save.beatTier||{};
      // the big tier bonus is paid once per tier (a tier below your rank was beaten before beatTier existed); repeat wins get a small one
      if(!save.beatTier[tn]&&tier>=save.tier) gainXP(60*(tier+1),`for beating the ${tn} computer`); else gainXP(20,`for another win vs ${tn}`); save.beatTier[tn]=true; if(match.results[0]===2) achieve('comeback');
      if(tier+1>save.tier){ save.tier=tier+1; toasts.push(`New rank: ${rankName()}`); if(tier<3) toasts.push(`The ${TIERS[tier+1].name} computer is now open.`); celeb(`new rank: ${rankName()}${tier<3?` \u00b7 ${TIERS[tier+1].name} open`:''}`,'#ffd84a'); }
      if(tier===2) achieve('hard'); if(tier===3) achieve('master'); persist(); } }
  if(mode==='cpu'&&win===1){ gainXP(20,'for winning the round'); if(w===0) achieve('wipe');
    const pp=placed[1]; if(pp.length&&pp.every(sp=>sp.cost===1)) achieve('penny'); }
  }
  { let tp=null; for(let i=1;i<hist.length;i++){ const d0=Math.sign(hist[i-1][0]-hist[i-1][1]), d1=Math.sign(hist[i][0]-hist[i][1]); if(d1&&d1!==d0) tp=i; }
    turningGen=tp; emit('turningPoint',{gen:tp,leader:tp===null?0:(hist[tp][0]>hist[tp][1]?1:2)}); }   // for feel.js's replay button
  // What was each piece worth? Replay the whole game without it (same free-will launches, same rules)
  // and compare the final margin. That is honest credit: a block only gets credit if the game changes without it.
  review=null; reviewMap=0; scrolled=false; const myRun=++runId, gvAt=gv;
  const endGen=gen, actual=[b,w], ids=pieces.map((pc,k)=>pc?k:0).filter(k=>k);
  const res={}; let k=0;
  const check=replay(0,endGen); if(check[0]!==b||check[1]!==w) console.warn('replay mismatch',check,actual);
  (function work(){
    if(myRun!==runId||phase!=='over') return; // a new game started: drop this review
    if(k<ids.length){ const id=ids[k++]; res[id]=replay(id,endGen); if(k%4===0) render(); setTimeout(work,0); return; }
    review={};
    for(const p of [1,2]){
      const own=p-1, opp=2-p;
      const mine=ids.filter(id=>pieces[id].p===p).map(id=>{ const cf=res[id], pc=pieces[id];
        const ownD=actual[own]-cf[own], oppD=actual[opp]-cf[opp], worth=ownD-oppD; return {...pc,cfOwn:cf[own],cfOpp:cf[opp],ownD,oppD,worth}; })
        .sort((a,b)=>b.worth-a.worth);
      let lost=0, hot=null, hv=0; const L=lossMap[p];
      for(let i=0;i<N*N;i++) lost+=L[i];
      for(let by=0;by<N;by+=8)for(let bx=0;bx<N;bx+=8){ let v=0; for(let y=by;y<by+8;y++)for(let x=bx;x<bx+8;x++) v+=L[y*N+x]; if(v>hv){hv=v;hot=[[bx+4,by+4]];} }
      review[p]={mine,lost,hot:hot?where(hot):null};
    }
    // fragile win: only when exactly one of the winner's pieces decided it. In our tests 35 of 40 wins could be
    // flipped by removing some piece (Life is chaotic), so 'any piece' would label almost every win; 'exactly one' is about 1 in 3.
    const win=b>w?1:w>b?2:0;
    if(mode!=='hotseat'&&review[1].mine.some(pc=>/free-will/.test(pc.label)&&pc.worth>=50)) achieve('hero');
    if(win&&mode!=='campaign'){ const flips=review[win].mine.filter(pc=>pc.cfOwn<=pc.cfOpp).sort((x,y)=>(x.cfOwn-x.cfOpp)-(y.cfOwn-y.cfOpp));
      if(flips.length===1){ const pc=flips[0], blow=Math.abs(b-w)>(b+w)/2; fragile=`${blow?'Key piece':'Fragile win'}: without ${NAME[win]}'s ${pc.label} (${pc.where}) ${pc.cfOwn===pc.cfOpp?`it would have been a draw, ${pc.cfOwn} each`:`${NAME[3-win]} would have won, ${pc.cfOpp} to ${pc.cfOwn}`}.`; } }
    render();
  })();
}
function replay(skip,end){
  let s=new Int8Array(N*N); for(let i=0;i<N*N;i++) if(g0[i]&&og0[i]!==skip) s[i]=g0[i];
  let li=0;
  for(let t=0;t<=end;t++){
    while(li<launches.length&&launches[li].gen===t){ const L=launches[li++]; if(L.id!==skip) for(const j of L.cells) s[j]=L.p; }
    if(t<end) s=stepGrid(s).n;
  }
  return count(s);
}
function summary(){
  // One plain line per human player: the result, the piece that mattered, and one thing to try. Details stay folded.
  const humans=mode==='hotseat'?[1,2]:[1], [B,W]=count(g);
  return humans.map(p=>{ const m=review[p].mine.filter(pc=>pc.cost>0), who=mode==='hotseat'?NAME[p]:'You', mine=p===1?B:W, theirs=p===1?W:B;
    // lost with points left over: that comes first, and replaces the "no single piece" tip
    const unspent=BUDGET-spent[p], when=matchOver||mode==='campaign'?'next time':'next round';
    const leftLine = mine<theirs&&unspent>=3 ? `${who} lost by ${theirs-mine} and left ${unspent} point${unspent===1?'':'s'} unspent, so spend them ${when}.` : '';
    if(!m.length) return leftLine?`<div style="font-size:15px;margin:6px">${leftLine}</div>`:'';
    const best=m[0], worst=m[m.length-1];
    const mx=pc=>pc.cells.reduce((a,c)=>a+c[0],0)/pc.cells.length, twin=best!==worst&&best.label===worst.label;
    const nm=pc=>`${twin?(mx(pc)<mx(pc===best?worst:best)?'left ':'right '):''}${pc.label}`;
    const res = leftLine || (mine>theirs?`${who} won by ${mine-theirs}.`:mine<theirs?`${who} lost by ${theirs-mine}.`:`A draw.`);
    const star = best.worth>=10?` ${mode==='hotseat'?NAME[p]+"'s":'Your'} ${nm(best)} did the most (solid green).`:'';
    const tip = m.length>1&&worst.worth<=-10&&worst.cost<=TWEAK ? `Try swapping out the ${nm(worst)} (dashed red).`
      : best.worth>=10 ? `Try backing up the ${nm(best)} with another piece.` : leftLine ? '' : 'No single piece decided it, so try something new.';
    return `<div style="font-size:15px;margin:6px">${res}${star} ${tip}</div>`;
  }).join('');
}
// Always worded for the viewer (the human reading it; in hotseat, the player whose column it is).
// ownD/oppD/worth are stored from the piece owner's side, so an opponent's piece is flipped round:
// a piece that was worth +30 to them reads "-30: hurt you, it fed them 30 cells".
function why(pc,viewer){
  const v=viewer||1, mine=pc.p===v, sign=x=>x>0?`+${x}`:`${x}`, parts=[];
  const youD=mine?pc.ownD:pc.oppD, themD=mine?pc.oppD:pc.ownD, worth=mine?pc.worth:-pc.worth, youCf=mine?pc.cfOwn:pc.cfOpp, themCf=mine?pc.cfOpp:pc.cfOwn;
  if(mine){ if(youD>=5) parts.push(`grew ${youD} of your cells`); else if(youD<=-5) parts.push(`crowded out ${-youD} of your own cells`); }
  else { if(themD>=5) parts.push(`fed them ${themD} cells`); else if(themD<=-5) parts.push(`crowded out ${-themD} of their own cells`); }
  if(mine){ if(themD<=-5) parts.push(`cost them ${-themD} cells`); else if(themD>=5) parts.push(`fed them ${themD} cells`); }
  else { if(youD<=-5) parts.push(`cost you ${-youD} cells`); else if(youD>=5) parts.push(`fed you ${youD} cells`); }
  const verdict=Math.abs(worth)<5?'made almost no difference':worth>0?'helped you':'hurt you';
  return `<b>${sign(worth)}</b>: ${verdict}${parts.length?`, it ${parts.join(' and ')}`:''}. Without it: you ${youCf}, them ${themCf}.`;
}
let overText='';

// ---------- drawing ----------
const bin=v=>v.toString(2).padStart(10,'0');
let flashSeen='';
function render(){ if(skipping) return;
  // every flash message times out, whoever set it, and none survives into another phase
  if(flashMsg!==flashSeen){ flashSeen=flashMsg; clearTimeout(flashT); if(flashMsg){ const m=flashMsg; flashT=setTimeout(()=>{ if(flashMsg===m){ flashMsg=''; render(); } },3000); } }
  cv.style.display=phase==='menu'?'none':'';
  const PC=pal(); ctx.fillStyle=PC.bg; ctx.fillRect(0,0,cv.width,cv.height);
  const hideP = phase==='setup' ? (mode==='cpu'?2:mode==='hotseat'?3-setupP:0) : 0;
  if(window.feel&&window.feel.drawCells){
    // during blind setup the hidden side is masked out; the masked copy is reused until the board changes
    let shown=g; if(hideP){ if(!maskC||maskC.v!==gv||maskC.h!==hideP||maskC.src!==g){ const a=new Int8Array(N*N); for(let i=0;i<N*N;i++) a[i]=g[i]===hideP?0:g[i]; maskC={v:gv,h:hideP,src:g,a}; } shown=maskC.a; }
    window.feel.drawCells(ctx,shown,flipped,trail,trailC,S,N);
  } else for(let i=0;i<N*N;i++){
    const x=(i%N)*S, y=Math.floor(i/N)*S, c=g[i];
    if(hideP&&c===hideP) continue;
    if(trail[i]>0.05&&!c){ ctx.fillStyle=trailC[i]===1?`rgba(0,0,0,${0.3*trail[i]})`:`rgba(255,255,255,${0.35*trail[i]})`; ctx.fillRect(x+1,y+1,S-2,S-2); }
    if(flipped[i]){ ctx.fillStyle=flipped[i]===1?'rgba(0,0,0,.45)':'rgba(255,255,255,.55)'; ctx.fillRect(x-2,y-2,S+4,S+4); }
    if(c){ ctx.fillStyle=pcol(c); ctx.fillRect(x,y,S,S); }
  }
  if(phase==='setup'){
    const me=meP(), fogTop=me===2;
    if(mode==='campaign'){ ctx.fillStyle='rgba(255,255,255,.06)'; ctx.fillRect(0,0,cv.width,HALF*S); }
    else { ctx.fillStyle='rgba(32,32,32,.82)'; ctx.fillRect(0,fogTop?0:HALF*S,cv.width,HALF*S);
    ctx.fillStyle='#777'; ctx.font='16px monospace'; ctx.textAlign='center';
    const ghost=mode==='cpu'&&match.round>1&&!arena&&!thinking;
    if(ghost){ ctx.globalAlpha=.38; ctx.fillStyle=pcol(2); for(let i=HALF*N;i<N*N;i++) if(g[i]===2) ctx.fillRect((i%N)*S+1,((i/N)|0)*S+1,S-2,S-2); ctx.globalAlpha=1; }
    if(!thinking) if(ghost){ ctx.save(); ctx.font='bold 20px sans-serif'; ctx.fillStyle='#ddd'; ctx.fillText('their last layout',cv.width/2,HALF*S+26); ctx.restore(); } else ctx.fillText(mode==='cpu'?`the computer builds here after you`:`${NAME[3-me]} builds here, out of sight`,cv.width/2,(fogTop?HALF/2:HALF*1.5)*S);
    ctx.font='12px monospace'; if(!thinking&&!ghost) ctx.fillText('your half is outlined',cv.width/2,(fogTop?HALF/2:HALF*1.5)*S+20); }
    ctx.strokeStyle=pcol(me); ctx.lineWidth=2; ctx.strokeRect(1,fogTop?HALF*S+1:1,cv.width-2,HALF*S-2);
    if(match.round>1&&!thinking&&!cover){
      ctx.setLineDash([3,2]); ctx.strokeStyle='#fff'; ctx.lineWidth=2;
      for(const cells of removedGhost[me]) for(const [x,y] of cells) ctx.strokeRect(x*S+1.5,y*S+1.5,S-3,S-3);
      ctx.setLineDash([]); ctx.strokeStyle='#fc3'; ctx.lineWidth=2;
      for(const sp of placed[me]) if(!sp.orig) for(const [x,y] of sp.cells) ctx.strokeRect(x*S+1,y*S+1,S-2,S-2);
    }
    if(hover&&!thinking){
      const s=SHAPES[sel], cells=cellsAt(s,rot,mir,hover[0],hover[1],me), ok=validPlace(g,me,cells,s.cost,leftFor(me));
      ctx.globalAlpha=.55; ctx.fillStyle=ok?pcol(me):'rgb(220,40,40)';
      for(const [x,y] of cells) ctx.fillRect(((x+N)%N)*S,((y+N)%N)*S,S,S); ctx.globalAlpha=1;
    }
    if(peekOn()&&!thinking&&!cover){   // faint outlines of the computer's layout, over the fog
      const pc=peekCells(); ctx.save(); ctx.globalAlpha=.45; ctx.strokeStyle=pcol(2); ctx.lineWidth=1.5;
      if(pc) for(let i=HALF*N;i<N*N;i++) if(pc[i]===2) ctx.strokeRect((i%N)*S+1.5,((i/N)|0)*S+1.5,S-3,S-3);
      else { ctx.globalAlpha=.8; ctx.fillStyle='#ddd'; ctx.font='14px monospace'; ctx.textAlign='center'; ctx.fillText('they are still deciding...',cv.width/2,HALF*S+48); }
      ctx.restore(); }
    if(thinking){ ctx.fillStyle='#ddd'; ctx.font='18px monospace'; ctx.textAlign='center'; ctx.fillText('the computer is building its side...',cv.width/2,HALF*1.5*S); }
    if(test&&!cover&&!thinking){   // test run ghost, on top of everything else; only the builder's own cells are in it
      let drawn=false; if(window.feel&&window.feel.drawTestRun){ try{ ctx.save(); window.feel.drawTestRun(ctx,test.grid,S,N); drawn=true; }catch(e){ console.warn(e); } ctx.restore(); }   // feel.js may draw it in its own style
      if(!drawn){ ctx.globalAlpha=.35; ctx.fillStyle=PC.bg; ctx.fillRect(0,0,cv.width,cv.height);
        ctx.globalAlpha=.7; const tg=test.grid;
        for(const p of [1,2]){ ctx.fillStyle=pcol(p); for(let i=0;i<N*N;i++) if(tg[i]===p) ctx.fillRect((i%N)*S+1,((i/N)|0)*S+1,S-2,S-2); } }
      ctx.globalAlpha=1; ctx.fillStyle='#fc6'; ctx.font='bold 14px monospace'; ctx.textAlign='left'; ctx.fillText(`test gen ${test.gen}/${TEST_GENS}`,6,test.p===1?HALF*S-8:HALF*S+18); }
  }
  if(phase==='run'&&hover){
    const ps=mode==='hotseat'?[1,2]:[1];
    for(const p of ps){ if(fwLeft[p]<=0) continue; const sx=fwDir[p], sy=p===1?1:-1;
      ctx.globalAlpha=.5; ctx.fillStyle=pcol(p);
      for(const [a,b] of [[1,0],[2,1],[0,2],[1,2],[2,2]]) ctx.fillRect(((hover[0]+sx*(a-1)+N)%N)*S,((hover[1]+sy*(b-1)+N)%N)*S,S,S); ctx.globalAlpha=1;
      const x0=hover[0]*S+S/2, y0=hover[1]*S+S/2, x1=x0+sx*70, y1=y0+sy*70;
      ctx.strokeStyle='#fc3'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x1-sx*12,y1); ctx.moveTo(x1,y1); ctx.lineTo(x1,y1-sy*12); ctx.stroke(); }
  }
  if(phase==='over'&&review&&(mode!=='campaign'||showReview)){
    // outline where your best (green) and worst (red) pieces were placed, to match the hint text
    for(const p of (mode==='hotseat'?[1,2]:[1])){ const m=review[p].mine.filter(pc=>pc.cost>0); if(m.length<1) continue;
      const mark=(pc,col)=>{ ctx.strokeStyle=col; ctx.lineWidth=2; ctx.setLineDash(col==='#f44'?[3,2]:[]); for(const [x,y] of pc.cells) ctx.strokeRect(x*S+1,y*S+1,S-2,S-2); ctx.setLineDash([]); };   // worst is dashed, so it doesn't rely on red vs green
      mark(m[0],'#4f4'); if(m.length>1&&m[m.length-1].worth<0) mark(m[m.length-1],'#f44'); }
  }
  if(phase==='over'&&reviewMap){ const L=lossMap[reviewMap]; let m=1; for(const v of L) m=Math.max(m,v);
    for(let i=0;i<N*N;i++) if(L[i]){ ctx.fillStyle=`rgba(230,40,40,${0.25+0.7*L[i]/m})`; ctx.fillRect((i%N)*S,((i/N)|0)*S,S,S); } }
  if(cover){ ctx.fillStyle='#202020'; ctx.fillRect(0,0,cv.width,cv.height); ctx.fillStyle='#ddd'; ctx.textAlign='center';
    // 10101: cover text is sized in screen pixels, so it stays readable when the board is shrunk onto a phone
    const k=Math.max(1,cv.width/(cv.getBoundingClientRect().width||cv.width)), lh=Math.round(23*k);
    const wrap=(t,y)=>{ const words=t.split(' '); let line='', yy=y; for(const w of words){ if(line&&ctx.measureText(line+w).width>cv.width-40*k){ ctx.fillText(line.trim(),cv.width/2,yy); line=''; yy+=lh; } line+=w+' '; } ctx.fillText(line.trim(),cv.width/2,yy); return yy+lh; };
    ctx.font=`bold ${Math.round(22*k)}px monospace`; let yy=wrap(cover.text,cv.height/2-lh*2);
    ctx.font=`${Math.round(16*k)}px monospace`; ctx.fillStyle='#d8d8d8'; yy=wrap(cover.sub,yy+lh*.4); ctx.fillStyle='#ffd84a'; for(const l of cover.lines||[]) yy=wrap(l,yy+6*k); }
  renderHud(); renderGraph(); renderPanel();
}
// #hud is a flex column, so wrap everything in one block or each bold number lands on its own line
function renderHud(){ renderHud0(); hud.innerHTML='<div>'+hud.innerHTML+'</div>'; }
function renderHud0(){
  const [b,w]=count(g);
  if(phase==='setup'){ const me=meP();
    if(thinking){ hud.innerHTML='The computer is building its half.'; return; }
    if(cover){ hud.innerHTML=cover.text; return; }
    if(mode==='campaign'){ const m=M(); hud.innerHTML=`<b>${mName()}</b>${m.auto?'':` <span style="white-space:nowrap">&middot; points left: <b>${leftFor(1)}</b></span>`}<br>${testLine()?`<span style="color:#fc6">${testLine()}</span>`:flashMsg&&!warn?`<span style="color:#fc6">${flashMsg}</span>`:keptNote()?`<span style="color:#ffd84a">Your last layout is kept, ${isTouch()?'tap':'click'} start empty to rebuild.</span>`:fails&&m.tip?`<span style="color:#ffd84a">Hint: ${m.tip}</span>`:m.hint.replace(/^Tap/,isTouch()?'Tap':'Click')}`; return; }
    // the round and match score live in feel.js's round strip, so the setup line no longer repeats them
    const tl=testLine()?`<span style="color:#fc6">${testLine()}</span><br>`:'';
    if(tl){ hud.innerHTML=tl.replace(/<br>$/,''); return; }   // a test-run line stands alone, so the header stays at two lines on a 390 px phone; the next action brings the build line back
    hud.innerHTML= match.round===1 ? `${tl}<b>${mode==='hotseat'?NAME[me]:'Your turn'}</b>, build your half. Points left: <b>${BUDGET-spent[me]}</b> of ${BUDGET}`
      : `${tl||(nudgeOn()?`<span style="color:#fc6">Same layout as last round, and they've adapted to it. Press ready again to keep it anyway.</span><br>`:'')||(flashMsg&&!warn?`<span style="color:#fc6">${flashMsg}</span><br>`:'')}<b>${mode==='hotseat'?NAME[me]:'Your turn'}</b>, change your layout. Free to place now: <b>${leftFor(me)}</b>`; return; }
  const fw=p=>'&#9679;'.repeat(fwLeft[p])+'&#9675;'.repeat(FW-fwLeft[p]);
  if(phase==='menu'){ hud.innerHTML=`<b>Missions and progress</b>`; return; }   // level and XP are shown once, in the panel below
  const head=mode==='campaign'?`${mName()} &middot; goal: ${M().goalText} &middot; gen ${gen} of ${GENS}`:(arena?`${arenaHead()} &middot; gen ${gen} of ${GENS}`:`round ${match.round} of ${ROUNDS} &middot; generation ${gen} of ${GENS} &middot; most cells at the end wins`);
  hud.innerHTML=`${head}<br><span style="color:#000;background:#aaa;padding:0 4px">${pn(1)}: ${b} cells</span> &nbsp; <span style="color:#fff">${pn(2)}: ${w} cells</span><br>`+
    (mode==='campaign'?(FW?`<small>free will left: ${fw(1)}</small>`:''):`<small>free will left: ${pn(1)} ${fw(1)} &nbsp; ${pn(2)} ${fw(2)}</small>`);
}
function renderGraph(){
  graph.style.display=(phase==='setup'||phase==='idle'||phase==='menu'||(phase==='over'&&mode==='campaign'))?'none':'';   // a mission's result doesn't need the strip
  const gc=graph.getContext('2d'), H=graph.height, PC=pal(); gc.fillStyle=PC.bg; gc.fillRect(0,0,graph.width,H);
  if(!hist.length) return; const m=Math.max(1,...hist.map(h=>Math.max(h[0],h[1]))), sx=graph.width/GENS;
  for(const [c,k] of [[PC.black,0],[PC.white,1]]){ gc.strokeStyle=c; gc.beginPath(); hist.forEach((h,i)=>{const y=H-2-(h[k]/m)*(H-6); i?gc.lineTo(i*sx,y):gc.moveTo(0,y);}); gc.stroke(); }
  for(const e of fwLog){ gc.fillStyle=pcol(e.p); gc.fillRect(e.gen*sx,0,2,H); }
}
function renderPanel(){
  if(phase==='setup'&&!thinking&&!cover){ const me=meP();
    const shapeBtns=SHAPES.map((s,i)=>allowedShape(s)?`<button data-s="${i}" class="${i===sel?'sel':''}" aria-pressed="${i===sel}" ${s.cost>leftFor(me)?'disabled':''} title="${s.tip}">${i===sel?'&#10003; ':''}${K(i+1,s.label)} (${s.cost})</button>`:'').join('');
    const tools=`<button data-a="rot">${K('r','rotate')}</button><button data-a="mir">${K('e','mirror')}</button><button data-a="undo">${K('z','undo')}</button>`;
    if(mode==='campaign'){ const m=M();
      panel.innerHTML=`<div id="g-tray">${shapeBtns}</div>`+`${tools}${canTest()||test?`<button data-a="test" class="${test?'sel':''}">${test?K('t','stop test'):K('t','test run')}</button>`:''}${m.auto?'':`${placed[1].length?`<button data-a="clear">${keptNote()?'start empty':'clear'}</button>`:''}<button data-a="ready">${warn?`start anyway (${leftFor(1)} left)`:'start'}</button>`}`+
        `<div class="tip">${SHAPES[sel].label}: ${SHAPES[sel].tip}. ${RC()} a piece to remove it.</div><div><button data-a="menu">missions</button></div>`; return; }
    const tierRow = mode==='cpu'&&match.round===1&&!arena ? `<div style="margin:4px">opponent: ${TIERS.map((t,i)=>`<button data-tier="${i}" class="${i===tier?'sel':''}" ${i>save.tier?'disabled':''}>${t.name}${i>save.tier?' (locked)':''}</button>`).join('')}</div>` : '';
    panel.innerHTML=`<div id="g-tray">${shapeBtns}</div>`+   // pieces first: on phones this row sits right under the board
      `${tools}${canTest()||test?`<button data-a="test" class="${test?'sel':''}">${test?K('t','stop test'):K('t','test run')}</button>`:''}${starterOK()?'<button data-a="starter">starter layout</button>':''}${mode==='cpu'?`<button data-a="peek" class="${peek?'sel':''}" aria-pressed="${peek}">${peek?'&#10003; ':''}peek at their layout</button>`:''}<button data-a="ready">${warn?`ready anyway (${match.round>1?leftFor(me):BUDGET-spent[me]} left)`:(nudgeOn()?'keep it anyway':'ready')}</button>`+
      
      (flashMsg?`<div${warn?' class="fw-toast"':''} style="color:#fc6;margin:4px;pointer-events:none">${flashMsg}</div>`:'')+   // feel.js pins only .fw-toast: the "You still have N points" warning
      (match.round>1?`<div style="margin:4px"><b>Swap ${Math.max(tweak[me].rm,tweak[me].add)} of ${TWEAK}</b>: removed ${tweak[me].rm}, added ${tweak[me].add}. ${RC()} a piece to free its points, then place new ones.</div>`:'')+
      // round 1: a one-line goal and the rest folded away; round 2+ only the swap line above. Free will belongs to the run's panel.
      (match.round===1?`<div class="tip"><b>Goal:</b> more cells than the other colour after ${GENS} generations, best of ${ROUNDS}.</div>`+
        `<details class="tip"${rulesOpen?' open':''}><summary>how it works</summary>Cells outnumbered by the other colour switch sides. ${SHAPES[sel].label}: ${SHAPES[sel].tip}. A dark preview fits, a red one doesn't. ${RC()} a piece to remove it.</details>`:'')+tierRow;   // opponent picker below the pieces, out of the thumb zone
  } else if(phase==='run'){
    const tap=isTouch()?'Tap':'Click', hs=mode==='hotseat', arrow=p=>(p===1?(fwDir[1]>0?'&#8600;':'&#8601;'):(fwDir[2]>0?'&#8599;':'&#8598;'));
    const aim=p=>`<button data-a="aim${p}">${hs?NAME[p]+' ':''}aim ${arrow(p)}${isTouch()?'':` (${p===1?'q':'p'})`}</button>`;
    const noFW = mode==='campaign'&&!FW;
    let how;
    if(noFW) how='Watch what your seed does.';
    else if(!hs) how=`${tap} the board to launch a free-will glider.`;
    else if(isTouch()) how=`Tap the board to launch for <button data-a="lp">${NAME[launchP]}</button> (tap the name to switch player).`;
    else how='<b style="background:#aaa;color:#000;padding:0 4px">01010 left-clicks</b> and <b style="color:#fff">10101 right-clicks</b> to launch a free-will glider.';
    panel.innerHTML=`<button data-a="pause">${running?'pause':'play'}</button> speed <input id="g-spd" type="range" min="2" max="60" value="${speed}">`+
      `<div style="font-size:14px;margin:4px">${how}</div>`+(decided()?'<button data-a="skip">skip to the end</button>':'')+(noFW?'':`<div>${aim(1)}${hs?aim(2):''}</div><div class="tip">Your glider always flies toward the other side; the aim button switches it left or right.${isTouch()?'':' Space pauses.'}</div>`);
    const sp=panel.querySelector('#g-spd'); sp.oninput=()=>{speed=+sp.value;};
  } else if(phase==='over'&&mode==='campaign'&&mi===-2){
    const big=`<div style="font-size:22px;margin:8px;padding:10px;${missionOK?'background:#1d3a1d':'background:#3a1d1d'}">${overText}</div>`;
    let rev=''; if(review){ rev = showReview ? summary()+`<ul style="text-align:left;font-size:12px">${review[1].mine.map(pc=>`<li>${pc.label} (${pc.where}) ${why(pc)}</li>`).join('')}</ul><button data-a="rev">hide</button>` : `<button data-a="rev">what did each piece do?</button>`; }
    panel.innerHTML=big+`<button data-a="chalback" style="font-size:16px">send my layout back as a challenge</button><button data-a="chalagain">try their layout again</button><button data-a="menu">missions and progress</button><div>${rev}</div>`;
    if(!scrolled){ scrolled=true; window.scrollTo({top:Math.max(0,panel.getBoundingClientRect().top+window.scrollY-90),behavior:'smooth'}); }
  } else if(phase==='over'&&mode==='campaign'&&mi<0){
    const d=save.daily, big=`<div style="font-size:22px;margin:8px;padding:10px;${missionOK?'background:#1d3a1d':'background:#3a1d1d'}">${overText}</div>`;
    const off=d&&d.key===dailyKey?`<div style="margin:6px;font-size:16px"><b>${dailyName()}</b>: ${dailyLine(d)}${save.dstreak>1?` &middot; <span style="color:#ffd84a">${save.dstreak}-day streak</span>`:''}<br><small>Each day you get one practice go, and the go after it is the one that counts. Fewer points is the better win.</small></div>`:'';
    let rev=''; if(review){ rev = showReview ? summary()+`<ul style="text-align:left;font-size:12px">${review[1].mine.map(pc=>`<li>${pc.label} (${pc.where}) ${why(pc)}</li>`).join('')}</ul><button data-a="rev">hide</button>` : `<button data-a="rev">what did each piece do?</button>`; }
    panel.innerHTML=big+off+(off?`<button data-a="share" style="font-size:16px">share today's result</button><button data-a="daily">practice again</button>`:`<div style="margin:6px">That was your practice go. The next one counts.</div><button data-a="daily" style="font-size:16px">play your official go</button>`)+`<button data-a="menu">missions and progress</button><div>${rev}</div>`;
    if(!scrolled){ scrolled=true; window.scrollTo({top:Math.max(0,panel.getBoundingClientRect().top+window.scrollY-90),behavior:'smooth'}); }
  } else if(phase==='over'&&mode==='campaign'){
    const m=M(), nxt=mi+1<MISSIONS.length;
    const toastH=toasts.length?`<div style="margin:6px;color:#ffd84a">${toasts.join('<br>')}</div>`:'';
    const big=`<div style="font-size:24px;margin:8px;padding:10px;${missionOK?'background:#1d3a1d':'background:#3a1d1d'}">${overText}</div>`;
    const btns=(missionOK&&nxt?`<button data-a="nextm" style="font-size:16px">next mission: ${MISSIONS[mi+1].title}</button>`:'')+
      (missionOK&&!nxt?`<div style="margin:6px">That was the last mission. Quick matches against tougher computers are next.</div><button data-a="quick">quick match</button>`:'')+
      // after a loss "try again" leads its own span, so feel.js makes it the gold pinned button, with "start empty" in the same row
      (missionOK?`<button data-a="retry">play again</button>`:`<span><button data-a="retry"${freshOK()?' data-pair="1"':''}>try again</button>${freshOK()?'<button data-a="fresh">start empty</button>':''}</span>`)+`<button data-a="menu">missions and progress</button>`+
      (!missionOK&&m.id==='m8'&&window.feel&&window.feel.guide&&window.feel.guide.open?'<button data-a="guide">field guide: the edge shield</button>':'');
    let rev='';
    if(review&&mi>=2){ rev = showReview ? summary()+`<ul style="text-align:left;font-size:12px">${review[1].mine.map(pc=>`<li>${pc.label} (${pc.where}) ${why(pc)}</li>`).join('')}</ul><button data-a="rev">hide</button>`
      : `<button data-a="rev">what did each piece do?</button>`; }
    const goals=STARS[m.id].map(([t])=>t), sl=lastStars;
    const starH=`<div style="margin:6px;font-size:15px">`+
      `${sl&&sl.n>sl.prev&&sl.prev?`<br><span style="color:#ffd84a">New best for this mission!</span>`:''}`+
      `<table style="font-size:13px;margin:4px auto 0;border-collapse:collapse">${['win the mission',...goals].map((t,k)=>`<tr><td style="width:1.6em;text-align:center;color:#ffd84a;vertical-align:top">${sl&&sl.got[k]?'&#9733;':'&#9734;'}</td><td style="text-align:left">${t}</td></tr>`).join('')}</table></div>`;
    panel.innerHTML=big+starH+yardstick(m)+toastH+btns+`<div>${rev}</div>`;
    scrolled=true;   // missions keep the board in view: the result strip and stars sit just under it
  } else if(phase==='menu'){
    const nextLvl=SHAPES.find(s=>s.lvl&&s.lvl>level());
    const mis=MISSIONS.map((m,i)=>`<button data-m="${i}" ${missionOpen(i)?'':'disabled'} style="min-width:220px">${missionOpen(i)?'':'&#128274; '}${i+1}. ${m.title}${save.done[m.id]?` <span style="color:#ffd84a">${starTxt(save.stars[m.id]||1)}</span>`:''}</button>`).join('<br>');
    const ach=Object.entries(ACH).map(([id,[n,d]])=>`<div style="display:inline-block;width:180px;margin:3px;padding:4px;border:1px solid ${save.ach[id]?'#ffd84a':'#444'};color:${save.ach[id]?'#ffd84a':'#777'};font-size:12px;vertical-align:top"><b>${save.ach[id]?'&#9733; ':''}${n}</b><br>${d}</div>`).join('');
    panel.innerHTML=`<div style="margin:6px">Level ${level()}: ${save.xp%XPL} of ${XPL} XP to level ${level()+1}${nextLvl?`, which unlocks the ${SHAPES.find(s=>s.lvl===level()+1)?SHAPES.find(s=>s.lvl===level()+1).label:nextLvl.label}`:''}.<br>Rank: ${rankName()}. Rating: ${rating()}. Matches won: ${save.wins}.</div>`+
      `<div style="margin:8px"><b>Missions</b> &middot; ${MISSIONS.reduce((a,m)=>a+(save.stars[m.id]||(save.done[m.id]?1:0)),0)} of ${MISSIONS.length*3} stars<br>${mis}</div><div><button data-a="daily" style="font-size:16px">${dailyName().replace('FreeWill d','D')}${save.daily&&save.daily.key===dayKey()?` &middot; ${dailyLine(save.daily)}`:''}</button><br><button data-a="arena">arena: win 10 before you lose 3 lives${save.arenaBest?` &middot; best ${save.arenaBest}`:''}</button><br><button data-a="quick">quick match</button><button data-a="title">title screen</button></div>`+
      `<div style="margin:8px"><b>Achievements</b><br>${ach}</div><div class="tip">Progress is saved in this browser on this device.</div>`;
  } else if(phase==='over'){
    const toastH=toasts.length?`<div style="margin:6px;color:#ffd84a">${toasts.join('<br>')}</div>`:'';
    let ms=toastH+(matchOver?`<div style="font-size:26px;margin:8px;padding:8px;${match.score[0]>match.score[1]?'background:#000;color:#fff':match.score[1]>match.score[0]?'background:#fff;color:#000':'background:#808080;color:#000'}">${match.score[0]>match.score[1]?winsT(1)+' the match':match.score[1]>match.score[0]?winsT(2)+' the match':'The match is a draw'}, ${Math.max(...match.score)} to ${Math.min(...match.score)}</div>`:'')+`<div style="margin:4px">Match score: ${pn(1)} ${mode==='hotseat'?'has':'have'} won ${match.score[0]}, ${pn(2)} has won ${match.score[1]}, after round ${match.round} of ${ROUNDS}${matchOver?` &middot; <b>${match.score[0]>match.score[1]?winsT(1)+' the match':match.score[1]>match.score[0]?winsT(2)+' the match':'the match is a draw'}</b>`:''}</div>`;
    if(arena){ ms=toastH+(matchOver?`<div style="font-size:24px;margin:8px;padding:8px;background:${arena.wins>=10?'#1d3a1d':'#3a1d1d'}">${arena.wins>=10?'Arena champion: 10 wins!':`Arena run over: ${arena.wins} win${arena.wins===1?'':'s'}`} &middot; best ${save.arenaBest||0}</div>`:`<div style="margin:6px">${arenaHead()}</div>`); }
    const btns=ms+(rivalLine?`<div style="color:#9f9;margin:4px">${rivalLine}</div>`:'')+(fragile?`<div style="color:#fc6;margin:4px">${fragile}</div>`:'')+(mode==='cpu'&&placed[1].length?`<button data-a="chal">challenge a friend with this layout</button>`:'')+(matchOver
      ? `<button data-a="again">${arena?'new arena run':'new match'}</button>${mode==='cpu'&&!arena&&save.tier>tier&&tier<3?`<button data-a="harder">next match vs ${TIERS[tier+1].name}</button>`:''}<button data-a="menu">progress</button><button data-a="title">back to title</button>`
      : `<button data-a="next" ${review?'':'disabled'}>${arena?`next opponent: ${arenaOpp(arena.wins).name} (swap up to ${TWEAK} points)`:`next round (change up to ${TWEAK} points)`}</button><button data-a="title">quit to title</button>`);
    if(!review){ panel.innerHTML=`<div style="font-size:18px;margin:6px">${overText}</div>${btns}<div class="tip">Replaying the game without each piece to see what it was worth...</div>`; return; }
    const col=p=>{ const r=review[p];
      const placedOnly=r.mine.filter(pc=>pc.cost>0), bst=placedOnly[0], wst=placedOnly[placedOnly.length-1];
      const rows=r.mine.map(pc=>`<li${pc===bst?' style="outline:1px solid #6c6"':pc===wst&&placedOnly.length>1?' style="outline:1px solid #c66"':''}>${pc.label} (${pc.where}) ${why(pc,mode==='hotseat'?p:1)}</li>`).join('');
      return `<div style="flex:1;text-align:left;padding:6px 10px;${p===1?'background:#111':'background:#3a3a3a'}"><b>${NAME[p]}</b><ul style="margin:4px 0;padding-left:18px">${rows}</ul>`+
        `<div class="tip">${r.lost} of ${NAME[p]}'s cells got flipped${r.hot?`, most around the ${r.hot}`:''}.</div>`+
        `<button data-a="map${p}" class="${reviewMap===p?'sel':''}">show where ${NAME[p]} lost cells</button></div>`; };
    panel.innerHTML=`<div style="font-size:18px;margin:6px">${overText}</div>`+summary()+btns+(showReview?   // advice before the next-round button, so you read it before you swap
      `<div style="font-size:12px;margin:4px;color:#aaa">Green and red outlines on the board show where your best and worst pieces were placed. Each number is how much that piece changed this round's final margin: we replayed this exact round without it. The same piece can score very differently next round, because Life is chaotic.</div>`+
      `<div style="display:flex;gap:8px;font-size:12px">${col(1)}${col(2)}</div><button data-a="rev">hide the piece list</button>`
      : `<div><button data-a="rev">what did each piece do?</button> <small style="color:#aaa">solid green outline: your best piece, dashed red: your worst</small></div>`);   // folded by default: a phone shouldn't open on screens of text
    if(!scrolled){ scrolled=true; window.scrollTo({top:Math.max(0,panel.getBoundingClientRect().top+window.scrollY-90),behavior:'smooth'}); }
  } else panel.innerHTML='';
}
panel.addEventListener('toggle',e=>{ if(e.target.tagName==='DETAILS') rulesOpen=e.target.open; },true);   // the panel redraws on every hover, so keep 'how it works' open
panel.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const me=meP();
  if(b.dataset.s!==undefined){ sel=+b.dataset.s; }
  if(b.dataset.tier!==undefined){ chooseTier(+b.dataset.tier); rival=pickGhost()||pickRival(); if(rival) emit('opponent',{name:rival.name,blurb:rival.blurb||'',cells:cellsOfRival(rival),record:{...recOf(rival)}}); if(mode==='cpu') planCpu(); }
  if(b.dataset.m!==undefined) return startMission(+b.dataset.m);
  const a=b.dataset.a;
  if(a==='test'){ if(!stopTest()) startTest(); render(); return; }   // a second press stops it
  stopTest();   // any other button cancels a test run
  if(a==='rot') rot=(rot+1)%4; if(a==='mir') mir=!mir; if(a==='undo') undo(me); if(a==='ready') return ready();
  if(a==='pause') running=!running; if(a==='map1') reviewMap=reviewMap===1?0:1; if(a==='map2') reviewMap=reviewMap===2?0:2; if(a==='again') return arena?startArena():newGame(mode); if(a==='next'){ if(arena) return arenaNext(); match.round++; return startRound(); }
  if(a==='arena') return startArena();
  if(a==='title'){ phase='idle'; emit('phase',{phase:'title'}); }
  if(a==='chal'){ const [b,w]=count(g); return shareChallenge(`Can you beat my layout? It ${b>w?'won':'lost'} ${b} to ${w} against the computer.`); }
  if(a==='chalback'){ const [b,w]=count(g); return shareChallenge(`${missionOK?'I beat your layout':'Your layout beat me'}, ${count(g).join(' to ')}. Now try mine.`); }
  if(a==='chalagain'){ const k=placed[1].map(sp=>({...sp})); chalLayout&&startMission(-2,k); return; }
  if(a==='skip') return skipToEnd();
  if(a==='peek'){ peek=!peek; render(); return; }
  if(a==='starter'){ if(starterOK()) placeStarter(); render(); return; }
  if(a==='clear'){ while(placed[me].some(sp=>!sp.orig)){ const k=placed[me].findIndex(sp=>!sp.orig); removeSpec(me,k); } }
  if(a==='daily') return startDaily(phase==='over'&&mi===-1?placed[1].map(sp=>({...sp})):undefined); if(a==='share') return shareDaily(); if(a==='nextm') return startMission(mi+1); if(a==='retry'){ const k=placed[1].map(sp=>({...sp})); retries[mi]=(retries[mi]||0)+1; return startMission(mi,k); } if(a==='fresh') return startMission(mi); if(a==='menu') return showMenu();
  if(a==='guide'){ try{ window.feel&&window.feel.guide&&window.feel.guide.open&&window.feel.guide.open(); }catch(e){ console.warn(e); } return; }
  if(a==='quick') return newGame('cpu'); if(a==='harder'){ chooseTier(Math.min(3,tier+1)); return newGame('cpu'); }
  if(a==='rev') showReview=!showReview; if(a==='lp') launchP=3-launchP;
  if(a==='aim1') fwDir[1]=-fwDir[1]; if(a==='aim2') fwDir[2]=-fwDir[2];
  render();
});

// ---------- input ----------
const cellOf=e=>{const r=cv.getBoundingClientRect(); return [Math.floor((e.clientX-r.left)/r.width*N),Math.floor((e.clientY-r.top)/r.height*N)];};
cv.addEventListener('mousemove',e=>{ hover=cellOf(e); if(phase==='setup'||phase==='run') render(); });
cv.addEventListener('mouseleave',()=>{ hover=null; render(); });
cv.addEventListener('contextmenu',e=>e.preventDefault());
// mouse acts on press; touch acts on release (so you can slide to adjust), and a long press removes a piece
let press=null;
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse') return act(e,e.button===2,false);
  e.preventDefault(); stopTest(); hover=cellOf(e); render();
  const cell=cellOf(e);
  press={long:false,t:setTimeout(()=>{ if(!press) return; press.long=true;
    if(phase==='setup'&&!thinking&&!cover){ flashMsg=''; removeAt(meP(),cell[0],cell[1]); try{navigator.vibrate&&navigator.vibrate(25);}catch(_){} } },450)};
});
cv.addEventListener('pointermove',e=>{ if(e.pointerType!=='mouse'){ hover=cellOf(e); if(phase==='setup'||phase==='run') render(); } });
cv.addEventListener('pointerup',e=>{ if(e.pointerType==='mouse'||!press) return; clearTimeout(press.t); const was=press; press=null; if(!was.long) act(e,false,true); });
cv.addEventListener('pointercancel',()=>{ if(press){ clearTimeout(press.t); press=null; } });
function act(e,right,touch){
  stopTest();   // any tap on the board cancels a test run
  if(cover){ const t=cover.then; t(); return; }
  const [x,y]=cellOf(e);
  if(phase==='setup'&&!thinking){ const me=meP();
    flashMsg=''; if(!right&&(me===1?y>=HALF:y<HALF)){ flashMsg='Tap inside your outlined half.'; render(); return; }   // a stray tap over the line shouldn't snap a piece onto your edge
    if(right) removeAt(me,x,y); else { const sh=SHAPES[sel];
      if(!place(me,sh,rot,mir,x,y)) flashMsg = sh.cost<=leftFor(me) ? "That spot is taken or doesn't fit." : match.round>1&&tweak[me].add+sh.cost>TWEAK ? `You've already added ${tweak[me].add} of ${TWEAK} points this round.` : match.round>1&&BUDGET-spent[me]<sh.cost ? `Remove one of your pieces first to free ${sh.cost} point${sh.cost===1?'':'s'}.` : `The ${sh.label} costs ${sh.cost} and you only have ${leftFor(me)} free.`;
      else { const sh2=SHAPES[sel]; if(sh2.cost>leftFor(me)){ let bi=-1; SHAPES.forEach((s2,i)=>{ if(allowedShape(s2)&&s2.cost<=leftFor(me)&&(bi<0||s2.cost>SHAPES[bi].cost)) bi=i; }); if(bi>=0) sel=bi; } }
      clearTimeout(flashT); if(flashMsg) flashT=setTimeout(()=>{ flashMsg=''; if(phase==='setup') render(); },2500);
      render(); } }
  else if(phase==='run'){ const p=touch?(mode==='hotseat'?launchP:1):(right?2:1); if(mode!=='hotseat'&&p===2) return; playerLaunch(p,x,y); }
}
document.addEventListener('keydown',e=>{
  if(phase==='setup'&&!cover&&!thinking){ const me=meP();
    if(e.key!=='t'&&!['Shift','Control','Alt','Meta'].includes(e.key)&&(test||testDone)){ stopTest(); render(); }   // any other key is the player's next action
    if(e.key==='t'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){ if(!stopTest()) startTest(); render(); return; }
    if(e.key==='r') rot=(rot+1)%4; else if(e.key==='e') mir=!mir; else if(e.key==='z') undo(me);
    else if(e.key>='1'&&e.key<='8'){ const k=+e.key-1; if(SHAPES[k]&&allowedShape(SHAPES[k])) sel=k; } else if(e.key==='Enter'&&!(mode==='campaign'&&M().auto)) return ready(); else return; render(); }
  else if(phase==='run'&&e.code==='Space'){ e.preventDefault(); running=!running; render(); }
  else if(phase==='run'&&(e.key==='q'||(e.key==='p'&&mode==='hotseat'))){ const p=e.key==='q'?1:2; fwDir[p]=-fwDir[p]; render(); }
});

(function loop(){ if(phase==='run'&&running) tick(); setTimeout(loop,1000/(speed*(Date.now()<slowUntil?slowMul:1))); })();

// ---------- hook into feel.js ----------
g=new Int8Array(N*N); flipped=new Int8Array(N*N); trail=new Float32Array(N*N); trailC=new Int8Array(N*N); render();
function hook(){ if(window.feel){ window.feel.onStart=m=>m==='menu'?showMenu():m==='campaign'?startCampaign():m==='daily'?startDaily():m==='arena'?startArena():newGame(m); window.feel.modes=['campaign','daily','arena','cpu','hotseat']; return true; } return false; }
if(!hook()) window.addEventListener('load',()=>{ if(!hook()) newGame('cpu'); });
// a shared daily link (…/index.html#daily) opens straight into today's board
if(location.hash==='#daily') window.addEventListener('load',()=>setTimeout(startDaily,50));
else if(location.hash.startsWith('#c=')){ const pl=decLayout(location.hash.slice(3)); if(pl) window.addEventListener('load',()=>setTimeout(()=>startChallenge(pl),50)); }
// preview for feel.js: the selected piece alone on an empty board, frame by frame, as [[x,y],...] relative to its centre
function preview(si,r,m,gens){ const sh=SHAPES[si]; if(!sh) return []; let x=new Int8Array(N*N); const c=HALF;
  for(const [a,b] of cellsAt(sh,r||0,!!m,c,c)) x[idx(a,b)]=1; const out=[];
  for(let t=0;t<=(gens||20);t++){ const f=[]; for(let i=0;i<N*N;i++) if(x[i]) f.push([i%N-c,((i/N)|0)-c]); out.push(f); x=stepGrid(x).n; } return out; }
window.game={progress:()=>({rating:rating(),level:level(),xp:save.xp%XPL,next:XPL,total:save.xp,stars:Object.values(save.stars||{}).reduce((a,b)=>a+b,0)}),rc:RC,unlocked:()=>(save.done.m2?['campaign','daily','arena','cpu','hotseat']:['campaign','hotseat']).concat(save.done.m5?['lab']:[]),turningPoint:()=>turningGen,history:()=>hist.slice(),_setRivals:l=>{RIVALS=l;},preview,testRun:()=>test?{gen:test.gen,of:TEST_GENS,cells:test.grid.slice(),label:test.label}:null,startArena,newGame,startDaily,startChallenge,decLayout,encLayout,startMission,startCampaign,showMenu,stepGrid,count,_state:()=>({rival,RIVALS,arena,match,phase,gen,g,spent,fwLeft,mode,mi,missionOK,save,tier,placed,hist,test,testId,flashMsg,matchOver}),_ghostPool:()=>ghostPool(),_ghostStyle:pl=>ghostStyle(pl),_mirrorSpec:sp=>mirrorSpec(sp),_rival:()=>rival,_oppRating:()=>oppRating(),skipToEnd,decided:()=>decided(),
  // live per-piece counts for the tray during a run: [{id,label,player,cells,peak}] for every piece that ever existed
  families:()=>{ if(!fam) return []; const c={}; for(let i=0;i<N*N;i++) if(g[i]&&fam[i]) c[fam[i]]=(c[fam[i]]||0)+1; return pieces.map((pc,id)=>pc&&{id,label:pc.label,player:pc.p,cells:c[id]||0}).filter(Boolean); },
  familyCells:id=>{ const out=[]; if(fam) for(let i=0;i<N*N;i++) if(g[i]&&fam[i]===id) out.push(i); return out; },
  contactGen:()=>contactGen,
  slowMo:(mul,ms)=>{ if(phase!=='run') return; slowMul=Math.max(0.05,Math.min(1,+mul||1)); slowUntil=Date.now()+(+ms||0); },
DECIDED,NUDGE,STARTER_CODE,_seedNextRun:n=>{nextRunSeed=n;},_runSeed:()=>runSeed};
})();

