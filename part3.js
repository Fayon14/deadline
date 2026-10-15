/* ---------- state ---------- */
const SAVE_KEY="deadline_save_v2";
let S=null;

function freshState(){
  return {
    v:2, day:1, cash:3200, energy:100, stress:5,
    rep:3.1, repCount:0,
    skills:{frontend:1,backend:1,design:1,devops:1,comms:1},
    xp:{frontend:0,backend:0,design:0,devops:0,comms:0},
    clients:[], offers:[], project:null,
    invoices:[], ledger:[], log:[], reviews:[],
    gear:{}, incomeQuarter:0, incomeLastQ:0, totalEarned:0, projectsDone:0,
    inspired:false, skipWork:false, machineBroken:false, flags:{}, lastOfferDay:0,
  };
}

function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){ try{ const r=localStorage.getItem(SAVE_KEY); if(!r) return false; S=JSON.parse(r); return !!S; }catch(e){ return false; } }
function hasSave(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } }
function wipeSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

/* ---------- ledger / log ---------- */
function ledger(kind, amount, note){
  S.ledger.push({d:S.day, kind, amount:Math.round(amount), note});
  if(S.ledger.length>400) S.ledger.splice(0,S.ledger.length-400);
}
function log(text, cls){
  S.log.unshift({d:S.day, t:text, c:cls||""});
  if(S.log.length>120) S.log.length=120;
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

/* ---------- date helpers (30 day months, day 1 = Monday Jan 1) ---------- */
function dayParts(d){
  const m=Math.floor((d-1)/30), dom=((d-1)%30)+1, dow=(d-1)%7;
  return {month:MONTHS[m%12], dom, dow:WEEK[dow], year:1+Math.floor(m/12), monthN:m%12};
}
function dateStr(d){ const p=dayParts(d); return p.month+" "+p.dom+", Year "+p.year; }

/* ---------- clients ----------
   Uniqueness rules (Stephen's hard requirements):
   1. No two clients share a name or company, ever.
   2. A client never holds two jobs at once (an active project or an open offer blocks new ones).
   3. A returning client never gets the same task category twice. */
function makeClient(){
  let name="", co="", tries=0;
  do{
    name=pick(FIRST)+" "+pick(LAST);
    const ind=pick(INDUSTRIES);
    const base=chance(.6)?pick(ind.co):pick(COMPANY_PREFIX)+" "+pick(["& Sons","Collective","Works","Group","Studio","Co."]);
    co=base+(chance(.35)?" "+pick(COMPANIES_SUFFIX):"");
    tries++;
  }while(tries<90 && (S.clients.some(c=>c.name===name) || S.clients.some(c=>c.company===co)));
  const pers=pick(PERSONALITIES);
  const ind=INDUSTRIES.find(i=>i.co.some(x=>co.startsWith(x.split(" ")[0])))||pick(INDUSTRIES);
  const c={
    id:nid(), name, company:co, industry:ind.n, pers:pers.id,
    netDays:{generous:7,chill:14,picky:14,micromanager:14,ghosty:30,cheap:30,late:30,vip:45}[pers.id]||14,
    lateMult:pers.late||1, tip:pers.tip||0, picky:pers.picky||0,
    budgetMult:rnd(.85,1.2)*(pers.pay||1),
    goodwill:60, history:[], projects:0, earned:0,
  };
  S.clients.push(c);
  return c;
}
function clientBusy(c){
  if(S.project && S.project.client.id===c.id) return true;
  if(S.offers.some(o=>o.client.id===c.id)) return true;
  return false;
}
function pickOfferClient(){
  // 35% chance a returning client comes back, with a brand new task category
  const roster=S.clients.filter(c=>!clientBusy(c));
  if(roster.length && chance(.35)){
    const c=pick(roster);
    const fresh=CATEGORIES.filter(cat=>!c.history.includes(cat.id));
    if(fresh.length) return {c, cat:weightedCat(fresh)};
  }
  const c=makeClient();
  return {c, cat:weightedCat(CATEGORIES)};
}
function weightedCat(pool){
  // cheap categories show up more early on; big ones need reputation
  const rep=S.rep;
  const w=pool.map(cat=>{
    let x=1;
    if(cat.id==="mobile"||cat.id==="dashboard"||cat.id==="gameproto") x = rep>=3.8?1.2:0.35;
    if(cat.id==="bugfix"||cat.id==="automation"||cat.id==="website") x=1.5;
    return x;
  });
  let total=w.reduce((a,b)=>a+b,0), r=Math.random()*total;
  for(let i=0;i<pool.length;i++){ r-=w[i]; if(r<=0) return pool[i]; }
  return pool[pool.length-1];
}
const CAT_FLAVOR={
  website:["needs a site that doesn't look like 2009","wants a website before their rival launches one","finally agreed they need a real website"],
  store:["wants to sell online instead of the farmers market","is losing orders to a competitor with a shop","needs a store live before the holiday rush"],
  booking:["is tired of scheduling by text message","lost a client to a double-booking","wants clients to book themselves"],
  api:["needs two systems to stop fighting each other","was promised an integration by a vendor who vanished","wants their data flowing between tools"],
  migration:["is migrating off a system held together with duct tape","outgrew their spreadsheet and knows it","needs the old data moved before the license dies"],
  dashboard:["wants charts for a board meeting that keeps getting moved","is drowning in exports and wants one screen","wants their numbers to look as good as they claim"],
  bugfix:["has a production fire and your name came up","lost a weekend to this bug already","needs this fixed before Monday, or else"],
  automation:["wants to stop paying someone to copy-paste","found you on a forum where you fixed something similar","has a spreadsheet nobody loves"],
  redesign:["thinks their app looks dated and they're right","lost customers who said the app felt old","got funding and wants to look the part"],
  gameproto:["needs a playable slice for an investor meeting","has a game idea and no coder","wants to test the concept before committing"],
  mobile:["wants an app because their competitor has one","needs a simple app to test the market","got told by a customer 'there should be an app for this'"],
  devops:["had an outage and never wants another","is paying three humans to deploy by hand","needs someone to own their infrastructure"],
};
function genOffer(silent){
  const {c, cat}=pickOfferClient();
  const diff=rnd(cat.diff[0],cat.diff[1]);
  const skillFit=avgSkillFit(cat);
  const base=rnd(cat.pay[0],cat.pay[1]);
  const ask=Math.round(base*(c.pers==="vip"?1.25+S.rep*0.04:1)*(1+(skillFit-2)*0.04)/10)*10;
  const featCount=clamp(Math.round(rnd(3.4,5.6)+diff*0.4),3,6);
  const feats=shuffle([...cat.feats]).slice(0,featCount).map(nm=>({name:nm,done:0,seedDiff:clamp(Math.round(diff*rnd(.7,1.3)),1,6)}));
  const off={
    id:nid(), client:c, catId:cat.id, catName:cat.name, blurb:cat.blurb,
    title:cat.name+" for "+c.company,
    brief:c.name.split(" ")[0]+" from "+c.company+" ("+c.industry+") "+pick(CAT_FLAVOR[cat.id])+".",
    ask, days:rndi(cat.days[0],cat.days[1]), diff:Math.round(diff*10)/10, feats,
    createdDay:S.day,
    pers:c.pers,
    req:cat.sk,
  };
  S.offers.push(off);
  S.lastOfferDay=S.day;
  if(!silent){ log("New offer: "+cat.name+" from "+c.company+" ("+fmt$(ask)+")","gold"); SFX.warn(); }
  return off;
}
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function avgSkillFit(cat){
  const ks=Object.keys(cat.sk||{});
  if(!ks.length) return 3;
  return ks.reduce((a,k)=>a+S.skills[k],0)/ks.length;
}
function eligible(off){
  // skills gate: hard requirement check with a little slack
  return Object.keys(off.req||{}).every(k=>S.skills[k]>=Math.max(1,off.req[k]-1));
}

/* ---------- negotiation ---------- */
function quoteVerdict(offer, amount){
  const budget=Math.round(offer.ask*(offer.client.budgetMult/ (PERSONALITIES.find(p=>p.id===offer.client.pers).pay||1)));
  const comms=S.skills.comms;
  const flex=1+comms*0.02;
  if(amount<=budget*flex*1.02) return {ok:true, kind:"accept"};
  if(amount<=budget*flex*1.32 && offer.client.pers!=="cheap") return {ok:true, kind:"counter", counter:Math.round(budget*flex/10)*10};
  return {ok:false, kind:"decline"};
}
