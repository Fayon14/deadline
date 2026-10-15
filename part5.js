/* ---------- active projects (up to 2 concurrent, unique clients) ---------- */
function P(id){ return id?S.projects.find(p=>p.id===id):S.projects[0]; }
function acceptOffer(offId){
  const off=S.offers.find(o=>o.id===offId); if(!off) return;
  openNegotiation(off);
}
function startProject(off, quote, depositAgreed, depositPaid){
  if(S.projects.length>=projectSlots()){ toast("You're already at your project limit for your rank.","warn"); return; }
  if(S.projects.some(p=>p.client.id===off.client.id)){ toast("That client is already working with you.","warn"); return; }
  S.offers=S.offers.filter(o=>o.id!==off.id);
  off.client.history.push(off.catId);
  const proj={
    id:nid(), offer:off, client:off.client, quote, depositAgreed, depositPaid,
    features:off.feats.map(f=>({name:f.name, diff:f.diff, prog:0, done:false})),
    hiddenBugs:0, bugs:[], phase:"dev", startedDay:S.day,
    qualityScore:0, late:false, absorbedRevision:false,
  };
  S.projects.push(proj);
  if(depositPaid>0){
    money(depositPaid,"Deposit: "+off.client.company,"income");
    S.totalEarned+=depositPaid; off.client.earned+=depositPaid;
    SFX.cash();
  }
  log("Contract signed: "+off.title+" at "+fmt$(quote)+(depositAgreed?" (30% deposit in)":""),"good");
  toast("Contract signed. "+fmt$(quote)+(depositAgreed?", "+fmt$(depositPaid)+" deposited upfront":""));
  closeModal();
  save(); switchTab("work"); renderAll();
  checkRankUp();
}
function laptopBonus(){ return S.gear.laptop3?0.30:(S.gear.laptop2?0.15:0); }
function keyboardBonus(){ return S.gear.keyboard?1.1:1; }
function bugChance(feat){
  let c=feat.diff*0.045 + S.stress*0.004 + Math.max(0,(feat.diff-skillOf("backend")))*0.03;
  if(S.energy<25) c+=0.08;
  if(S.gear.monitor) c-=0.10;
  return clamp(c,0.04,0.55);
}
function skillOf(k){ return S.skills[k]||1; }
function sessionGain(feat, accuracy){
  let g=(13+skillOf("frontend")*1.8+skillOf("backend")*1.8+laptopBonus()*100)*accuracy*keyboardBonus();
  if(S.inspired){ g*=1.25; S.inspired=false; toast("Inspiration spent. Clean work.","good"); }
  return g;
}
/* ---------- work session: type the code, no timer ---------- */
let TY=null;
function openWorkSession(pid, fi){
  const p=P(pid); if(!p||p.phase!=="dev") return;
  if(S.skipWork){ toast("You're done for today. Sleep.","warn"); return; }
  if(S.energy<SESSION_COST){ toast("Too tired to code. Coffee, an energy drink, or sleep.","warn"); SFX.warn(); return; }
  if(S.energy<SESSION_COST){ toast("Too tired to code. Coffee or sleep.","warn"); SFX.warn(); return; }
  const feat=p.features[fi];
  const target=makeSnippet();
  TY={pid, fi, target, typed:"", done:false, correct:0, mistakes:0};
  openModal(`
    <h3>Work session: ${esc(feat.name)}</h3>
    <p class="meta">No timer. Type the code below at your own pace. Accuracy builds the feature; sloppiness builds bugs.</p>
    <div class="tybar">
      <div id="tyTimer"><i style="width:0%"></i></div>
      <div class="tystat"><span>accuracy <b id="tyAcc">100%</b></span><span>progress <b id="tyProg">0%</b></span></div>
    </div>
    <div id="tyTarget">${renderTarget(target,"")}</div>
    <textarea id="tyInput" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="type here..."></textarea>
    <div class="actions"><button class="btn ghost" id="tyQuit">Give up</button></div>
  `, true);
  const inp=$("#tyInput");
  setTimeout(()=>inp.focus(),50);
  inp.addEventListener("input", onType);
  $("#tyQuit").onclick=()=>{ endType(false); };
}
function renderTarget(target, typed){
  let out="";
  for(let i=0;i<target.length;i++){
    const ch=target[i]==="\n"?"\n":target[i];
    let cls="";
    if(i<typed.length) cls = typed[i]===target[i] ? "done" : "err";
    else if(i===typed.length) cls="cur";
    out+= cls ? `<span class="${cls}">${esc(ch)}</span>` : esc(ch);
  }
  if(typed.length>=target.length) out+='<span class="cur"> </span>';
  return out;
}
function onType(){
  if(!TY||TY.done) return;
  const inp=$("#tyInput");
  TY.typed=inp.value;
  TY.correct=0;
  for(let i=0;i<TY.typed.length;i++){ if(TY.typed[i]===TY.target[i]) TY.correct++; }
  const len=TY.target.length;
  const pct=Math.round(TY.typed.length/len*100);
  const acc=Math.round(TY.correct/Math.max(1,TY.typed.length)*100);
  const st=$("#tyAcc"); if(st) st.textContent=acc+"%";
  const pr=$("#tyProg"); if(pr) pr.textContent=pct+"%";
  const tt=$("#tyTarget"); if(tt){ tt.innerHTML=renderTarget(TY.target,TY.typed); tt.scrollTop=tt.scrollHeight*0.6; }
  const bar=$("#tyTimer i"); if(bar) bar.style.width=pct+"%";
  if(chance(.3)) SFX.type();
  if(TY.typed.length>=len){ endType(true); }
}
function endType(finished){
  if(!TY||TY.done) return;
  TY.done=true;
  const p=P(TY.pid), feat=p.features[TY.fi];
  const acc=clamp(TY.correct/Math.max(1,TY.typed.length||TY.target.length),0,1);
  const gain=Math.round(sessionGain(feat,acc)*(finished?1:0.5));
  feat.prog=clamp(feat.prog+gain,0,100);
  spendEnergy(SESSION_COST);
  S.sessionsToday++;
  let bugTxt="";
  if(Math.random()<bugChance(feat)*(1.2-acc*0.5)){
    p.hiddenBugs++;
    bugTxt=" ...and you left a bug in there.";
  }
  TY=null;
  closeModal();
  SFX.click();
  if(feat.prog>=100){
    feat.done=true;
    log("Feature complete: "+feat.name+" ("+p.offer.title+")","good");
    toast("Feature shipped: "+feat.name,"good");
    gainXp("frontend",8); gainXp("backend",4);
    if(p.features.every(f=>f.done)){ p.phase="test"; toast("All features built on "+p.offer.title+". Run the tests.","good"); SFX.good(); }
  } else {
    toast("+"+gain+"% on "+feat.name+bugTxt, bugTxt?"warn":"");
  }
  save(); renderAll();
}
/* ---------- testing & bugfixing ---------- */
function runTests(pid){
  const p=P(pid); if(!p||p.phase!=="test") return;
  const found=[];
  for(let i=0;i<p.hiddenBugs;i++) found.push(makeBug());
  const extra=chance(.35)?1:0;
  for(let i=0;i<extra;i++) found.push(makeBug());
  p.hiddenBugs=0;
  p.bugs=found;
  p.testedDay=S.day;
  log("Tests finished on "+p.offer.title+": "+found.length+" bug(s).", found.length?"bad":"good");
  if(found.length){ SFX.bad(); toast("Tests found "+found.length+" bug(s) on "+p.offer.title+".","bad"); }
  else { toast("Tests clean. Ready to deliver.","good"); SFX.good(); }
  save(); renderAll();
}
function makeBug(){
  const q=pick(BUGQUIZ);
  const opts=shuffle(q.o.map((t,i)=>({t,ok:i===0})));
  return {id:nid(), q:q.q, opts};
}
function fixBug(pid, bid, optIdx){
  const p=P(pid); if(!p) return;
  const b=p.bugs.find(x=>x.id===bid); if(!b) return;
  const ok=b.opts[optIdx].ok;
  if(ok){
    p.bugs=p.bugs.filter(x=>x.id!==bid);
    gainXp("backend",10);
    SFX.good();
    toast("Fixed.","good");
    log("Bug fixed: "+b.q,"good");
  } else {
    addStress(6);
    SFX.bad();
    toast("That made it worse. Try again.","bad");
  }
  save(); renderAll();
  if(!ok) openFixModal(pid, bid);
}
/* ---------- delivery ---------- */
function qualityNow(p){
  let q=58+p.features.filter(f=>f.done).length*6 - p.bugs.length*9 + avgSkill();
  if(S.gear.desklamp) q+=2;
  const dueDay=p.offer.createdDay+p.offer.days;
  if(S.day>dueDay+1) q-=8;
  return clamp(Math.round(q),5,100);
}
function avgSkill(){ return SKILLS.reduce((a,k)=>a+S.skills[k],0)/SKILLS.length; }
function deliverProject(pid){
  const p=P(pid); if(!p) return;
  const q=qualityNow(p);
  const dueDay=p.offer.createdDay+p.offer.days;
  const onTime=S.day<=dueDay+1;
  const lateDays=Math.max(0,S.day-dueDay);
  let stars=1+q/26+(onTime?0.5:-1.1)+(p.client.picky?-(p.bugs.length?0.6:0.1):0)+rnd(-0.25,0.35);
  stars=clamp(Math.round(stars*2)/2,1,5);
  const rest=p.quote-p.depositPaid;
  issueInvoice(p.client,rest,p.client.netDays,"Final payment: "+p.offer.title);
  if(p.client.tip&&chance(p.client.tip)){
    money(120,"Tip from "+p.client.company,"income");
    S.totalEarned+=120;
    toast("Bonus from "+p.client.name+": $120. They noticed the effort.","gold");
  }
  S.reviews.push({day:S.day+rndi(1,3), stars, clientId:p.client.id, project:p.offer.title, txt:reviewText(stars,p.client)});
  p.client.projects++;
  p.client.goodwill=clamp(p.client.goodwill+(stars>=4?10:(stars>=3?2:-12)),0,100);
  S.projectsDone++;
  gainXp("comms",12);
  if(lateDays>0) addStress(8);
  log("Delivered "+p.offer.title+" (quality "+q+"/100, "+stars+" stars"+(lateDays?", "+lateDays+"d late":"")+")","gold");
  SFX.ship();
  S.projects=S.projects.filter(x=>x.id!==pid);
  save(); renderAll();
  toast("Shipped. Invoice for "+fmt$(rest)+" is out. Now you wait.","gold");
  maybeMilestone(); checkRankUp();
}
/* ---------- xp ---------- */
function gainXp(k,n){
  S.xp[k]=(S.xp[k]||0)+n;
  while(S.xp[k]>=xpNeed(S.skills[k]) && S.skills[k]<10){
    S.xp[k]-=xpNeed(S.skills[k]);
    S.skills[k]++;
    SFX.levelup();
    toast(SKILL_LABEL[k]+" advanced to level "+S.skills[k]+".","gold",5000);
    log(SKILL_LABEL[k]+" is now level "+S.skills[k],"gold");
  }
}
/* ---------- milestones & achievements ---------- */
const ACHS=[
  {id:"a1", ic:"1", t:"First Blood", m:"Ship your first project", test:s=>s.projectsDone>=1},
  {id:"a2", ic:"$", t:"Five Figures", m:"Earn $10,000 lifetime", test:s=>s.totalEarned>=10000},
  {id:"a3", ic:"★", t:"Local Legend", m:"Reach 4.2 stars", test:s=>s.rep>=4.2},
  {id:"a4", ic:"$", t:"Real Business", m:"Earn $50,000 lifetime", test:s=>s.totalEarned>=50000},
  {id:"a5", ic:"10", t:"Double Digits", m:"Ship 10 projects", test:s=>s.projectsDone>=10},
  {id:"a6", ic:"$", t:"Six Figures", m:"Earn $100,000 lifetime", test:s=>s.totalEarned>=100000},
  {id:"a7", ic:"R", t:"Regulars", m:"10 clients in your roster", test:s=>s.clients.length>=10},
  {id:"a8", ic:"x2", t:"Juggler", m:"Run two projects at once", test:s=>s.projects.length>=2},
  {id:"a9", ic:"L5", t:"Specialist", m:"Any skill reaches level 5", test:s=>Object.values(s.skills).some(v=>v>=5)},
  {id:"a10", ic:"S", t:"Full Setup", m:"Own every piece of gear", test:s=>GEAR.every(g=>s.gear[g.id])},
  {id:"a11", ic:"25", t:"Veteran", m:"Ship 25 projects", test:s=>s.projectsDone>=25},
  {id:"a12", ic:"50", t:"Forty Thousand Clients", m:"20 clients in your roster", test:s=>s.clients.length>=20},
];
function maybeMilestone(){
  for(const a of ACHS){
    if(!S.ach[a.id] && a.test(S)){
      S.ach[a.id]=true;
      toast("ACHIEVEMENT: "+a.t+". "+a.m,"gold",6000);
      log("Achievement unlocked: "+a.t,"gold");
      SFX.levelup();
    }
  }
}
function checkRankUp(){
  const idx=rankIndex();
  if(idx>(S.flags.rank||0)){
    S.flags.rank=idx;
    const perks={2:"You can now run two projects at once.",3:"Serious clients (big budgets) appear more often.",4:"Your referral engine keeps the inbox fuller."};
    toast("RANK UP: "+RANKS[idx].name+(perks[idx]?" "+perks[idx]:""),"gold",7000);
    log("Rank up: "+RANKS[idx].name,"gold");
    SFX.levelup();
  }
}
