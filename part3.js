/* ---------- state ---------- */
let S=null;

function freshState(){
  return {
    v:3, day:1, cash:2800, energy:100, stress:5,
    rep:3.1, repCount:0,
    skills:{frontend:1,backend:1,design:1,devops:1,comms:1},
    xp:{frontend:0,backend:0,design:0,devops:0,comms:0},
    clients:[], offers:[], projects:[],
    invoices:[], ledger:[], log:[], reviews:[],
    gear:{}, incomeQuarter:0, incomeTotal:0, totalEarned:0, projectsDone:0,
    inspired:false, skipWork:false, flags:{}, lastOfferDay:0,
    market:null, ach:{}, cashHist:[2800], sessionsToday:0, drinksToday:0, welcomed:false,
    bank:{cardNum:null, subs:[], foodMode:'balanced', autopay:true},
  };
}
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){ try{ const r=localStorage.getItem(SAVE_KEY); if(!r) return false; S=JSON.parse(r); return !!S; }catch(e){ return false; } }
function hasSave(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } }
function wipeSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ---------- ledger / log / toast ---------- */
function ledger(kind, amount, note){
  S.ledger.push({d:S.day, kind, amount:Math.round(amount), note});
  if(S.ledger.length>400) S.ledger.splice(0,S.ledger.length-400);
}
function log(text, cls){
  S.log.unshift({d:S.day, t:text, c:cls||""});
  if(S.log.length>140) S.log.length=140;
}
function toast(text, cls, ms){
  const t=document.createElement("div");
  t.className="toast "+(cls||"");
  t.innerHTML=esc(text);
  $("#toasts").appendChild(t);
  setTimeout(()=>{ t.classList.add("out"); setTimeout(()=>t.remove(),320); }, ms||3800);
}
function money(delta, note, kind){
  S.cash+=delta;
  ledger(kind||(delta>=0?"income":"expense"), delta, note);
}

/* ---------- dates (30-day months, day 1 = Monday Jan 1) ---------- */
function dayParts(d){
  const m=Math.floor((d-1)/30), dom=((d-1)%30)+1, dow=(d-1)%7;
  return {month:MONTHS[m%12], dom, dow:WEEK[dow], dowN:(d-1)%7, year:1+Math.floor(m/12), monthN:m%12};
}
function dateStr(d){ const p=dayParts(d); return p.month+" "+p.dom+", Year "+p.year; }
function isWeekend(d){ const n=(d-1)%7; return n===5||n===6; }

/* ---------- clients ---------- */
function makeClient(){
  const name=makeUniqueName();
  const {co, industry}=makeUniqueCompany();
  const pers=pick(PERSONALITIES);
  const c={
    id:nid(), name, company:co, industry, pers:pers.id,
    netDays:NET_DAYS[pers.id]||14,
    lateMult:pers.late||1, tip:pers.tip||0, picky:pers.picky||0,
    budgetMult:rnd(.85,1.2)*(pers.pay||1),
    goodwill:60, history:[], projects:0, earned:0,
  };
  S.clients.push(c);
  return c;
}
function clientBusy(c){
  if(S.projects.some(p=>p.client.id===c.id)) return true;
  if(S.offers.some(o=>o.client.id===c.id)) return true;
  return false;
}
function pickOfferClient(){
  const roster=S.clients.filter(c=>!clientBusy(c));
  if(roster.length && chance(.4)){
    const c=pick(roster);
    const fresh=CATEGORIES.filter(cat=>!c.history.includes(cat.id));
    if(fresh.length) return {c, cat:weightedCat(fresh)};
  }
  const c=makeClient();
  return {c, cat:weightedCat(CATEGORIES)};
}
function weightedCat(pool){
  const rep=S.rep;
  const w=pool.map(cat=>{
    let x=1;
    const big=["mobile","dashboard","gameproto","crm","devops","migration"];
    if(big.includes(cat.id)) x = rep>=3.8?1.2:0.35;
    if(["bugfix","automation","website"].includes(cat.id)) x=1.4;
    if(isHot(cat.id)) x*=2.2;
    return x;
  });
  let total=w.reduce((a,b)=>a+b,0), r=Math.random()*total;
  for(let i=0;i<pool.length;i++){ r-=w[i]; if(r<=0) return pool[i]; }
  return pool[pool.length-1];
}

/* ---------- offer generation (computed pay, not table ranges) ---------- */
function avgSkillFit(cat){
  const ks=Object.keys(cat.sk||{});
  if(!ks.length) return 3;
  return ks.reduce((a,k)=>a+S.skills[k],0)/ks.length;
}
function computePay(cat, client, diff, skillFit){
  let base=cat.base*(0.8+diff*0.12);
  base*=client.budgetMult;
  base*=isHot(cat.id)?1.2:1;
  base*=1+(skillFit-2)*0.04;
  base*=1+(S.rep-3)*0.06;
  if(client.pers==="vip") base*=1.25;
  if(client.pers==="cheap") base*=0.9;
  return Math.max(300, Math.round(base/10)*10);
}
function genOffer(silent){
  const {c, cat}=pickOfferClient();
  const diff=rnd(cat.diff[0],cat.diff[1]);
  const skillFit=avgSkillFit(cat);
  const ask=computePay(cat,c,diff,skillFit);
  const featCount=clamp(Math.round(rnd(3.4,5.6)+diff*0.4),3,6);
  const feats=shuffle(cat.feats).slice(0,featCount).map(nm=>({name:nm,diff:clamp(Math.round(diff*rnd(.7,1.3)),1,6)}));
  const brief=pickBrief(cat, c);
  const off={
    id:nid(), client:c, catId:cat.id, catName:cat.name, blurb:cat.blurb||"",
    title:cat.name+" for "+c.company,
    brief:c.name.split(" ")[0]+" from "+c.company+" ("+c.industry+") "+brief+".",
    ask, days:rndi(cat.days[0],cat.days[1]), diff:Math.round(diff*10)/10, feats,
    createdDay:S.day, pers:c.pers, req:cat.sk, hot:isHot(cat.id),
  };
  S.offers.push(off);
  S.lastOfferDay=S.day;
  if(!silent){ log("New offer: "+cat.name+" from "+c.company+" ("+fmt$(ask)+")","gold"); SFX.warn(); }
  return off;
}
function eligible(off){
  return Object.keys(off.req||{}).every(k=>S.skills[k]>=Math.max(1,off.req[k]-1));
}
function offerExpire(off){ return S.day-off.createdDay>12; }
