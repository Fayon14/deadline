/* ---------- active project ---------- */
function P(){ return S.project; }
function acceptOffer(offId){
  const off=S.offers.find(o=>o.id===offId); if(!off) return;
  openNegotiation(off);
}
function startProject(off, quote, depositAgreed, depositPaid){
  const cat=CATEGORIES.find(c=>c.id===off.catId);
  S.offers=S.offers.filter(o=>o.id!==off.id);
  off.client.history.push(off.catId);
  S.project={
    offer:off, client:off.client, quote, depositAgreed, depositPaid,
    features:off.feats.map(f=>({name:f.name, diff:f.seedDiff, prog:0, done:false})),
    hiddenBugs:0, bugs:[], phase:"dev", startedDay:S.day, sessionsToday:0,
    qualityScore:0, late:false,
  };
  // record the task fingerprint so this client can never ask for it again
  if(depositPaid>0){ money(depositPaid,"Deposit: "+off.client.company,"income"); S.incomeQuarter+=depositPaid; S.totalEarned+=depositPaid; off.client.earned+=depositPaid; SFX.cash(); }
  log("Contract signed: "+off.title+" at "+fmt$(quote)+(depositAgreed?" (30% deposit in)":""),"good");
  toast("Contract signed. "+fmt$(quote)+(depositAgreed?", "+fmt$(depositPaid)+" deposited upfront":""));
  switchTab("project");
  renderAll();
}
function skillOf(k){ return S.skills[k]||1; }
function laptopBonus(){ return S.gear.laptop3?0.30:(S.gear.laptop2?0.15:0); }
function bugChance(feat){
  let c=feat.diff*0.045 + S.stress*0.004 + Math.max(0,(feat.diff-skillOf("backend")))*0.03;
  if(S.energy<25) c+=0.08;
  if(S.gear.monitor) c-=0.10;
  return clamp(c,0.04,0.55);
}
function sessionGain(feat, accuracy){
  let g=(16+skillOf("frontend")*2+skillOf("backend")*2+laptopBonus()*100)*accuracy;
  if(S.inspired){ g*=1.25; S.inspired=false; toast("Inspiration spent. Clean work.","good"); }
  return g;
}
/* ---------- typing challenge ---------- */
let TY=null;
function openWorkSession(fi){
  const p=P(); if(!p||p.phase!=="dev") return;
  if(p.sessionsToday>=maxSessionsToday()||S.skipWork){ toast("You're done for today. Sleep.","warn"); return; }
  if(S.energy<SESSION_COST){ toast("Too tired to code. Coffee or sleep.","warn"); SFX.warn(); return; }
  const feat=p.features[fi];
  const snip=pick(SNIPPETS);
  const target=snip.join("\n");
  const secs=Math.round(clamp(34-feat.diff*2.4+(S.gear.keyboard?4:0)+skillOf("frontend")*0.8,14,42));
  TY={fi, target, typed:"", start:Date.now(), secs, done:false, chars:0, correct:0};
  openModal(`
    <h3>Work session: ${esc(feat.name)}</h3>
    <p class="meta">Type the code below. Accuracy builds the feature; sloppiness builds bugs.</p>
    <div class="tybar"><span class="meta">time</span><div id="tyTimer"><i style="width:100%"></i></div><span id="tyStat">0%</span></div>
    <div id="tyTarget">${renderTarget(target,"")}</div>
    <textarea id="tyInput" spellcheck="false" autocomplete="off" placeholder="type here..."></textarea>
    <div class="actions"><button class="btn ghost" id="tyQuit">Give up</button></div>
  `, true);
  const inp=$("#tyInput");
  inp.focus();
  inp.addEventListener("input", onType);
  $("#tyQuit").onclick=()=>{ endType(false); };
  TY.timer=setInterval(tyTick,100);
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
function tyTick(){
  if(!TY||TY.done) return;
  const el=Math.floor((Date.now()-TY.start)/1000);
  const left=Math.max(0,TY.secs-el);
  const ti=$("#tyTimer i"); if(ti) ti.style.width=(left/TY.secs*100)+"%";
  if(left<=0) endType(true);
}
function onType(){
  if(!TY||TY.done) return;
  const inp=$("#tyInput");
  TY.typed=inp.value;
  TY.correct=0;
  for(let i=0;i<TY.typed.length;i++){ if(TY.typed[i]===TY.target[i]) TY.correct++; }
  const pct=Math.round(TY.correct/TY.target.length*100);
  const st=$("#tyStat"); if(st) st.textContent=pct+"%";
  const tt=$("#tyTarget"); if(tt) tt.innerHTML=renderTarget(TY.target,TY.typed);
  // keep view near caret
  tt.scrollTop=tt.scrollHeight*0.6;
  if(chance(.3)) SFX.type();
  if(TY.typed.length>=TY.target.length){ endType(true); }
}
function endType(natural){
  if(!TY||TY.done) return;
  TY.done=true; clearInterval(TY.timer);
  const p=P(), feat=p.features[TY.fi];
  const acc=clamp(TY.correct/Math.max(1,TY.target.length),0,1);
  const elapsed=(Date.now()-TY.start)/1000;
  const speed=clamp(TY.secs/Math.max(elapsed,1),0.4,1.4);
  let gain=Math.round(sessionGain(feat,acc)*speed);
  feat.prog=clamp(feat.prog+gain,0,100);
  spendEnergy(SESSION_COST);
  p.sessionsToday=(p.sessionsToday||0)+1;
  let bugTxt="";
  if(Math.random()<bugChance(feat)*(1.2-acc*0.5)){
    p.hiddenBugs++;
    bugTxt=" ...and you left a bug in there.";
  }
  closeModal();
  SFX.click();
  if(feat.prog>=100){
    feat.done=true;
    log("Feature complete: "+feat.name,"good");
    toast("Feature shipped: "+feat.name,"good");
    gainXp("frontend",8); gainXp(p.offer.catId==="devops"||p.offer.catId==="api"||p.offer.catId==="migration"?"backend":"frontend",4);
    if(p.features.every(f=>f.done)){ p.phase="test"; toast("All features built. Run the tests.","good"); SFX.good(); }
  } else {
    toast("+"+gain+"% on "+feat.name+bugTxt, bugTxt?"warn":"");
  }
  save(); renderAll();
}
/* ---------- testing & bugfixing ---------- */
function runTests(){
  const p=P(); if(!p||p.phase!=="test") return;
  const found=[];
  for(let i=0;i<p.hiddenBugs;i++) found.push(makeBug());
  // tests themselves surface extra issues on bigger builds
  const extra=chance(.35)?1:0;
  for(let i=0;i<extra;i++) found.push(makeBug());
  p.hiddenBugs=0;
  p.bugs=found;
  p.testedDay=S.day;
  log("Test suite finished: "+found.length+" bug(s) found.", found.length?"bad":"good");
  if(found.length){ SFX.bad(); toast("Tests found "+found.length+" bug(s). Fix before shipping.","bad"); }
  else { toast("Tests clean. Ready to deliver.","good"); SFX.good(); }
  save(); renderAll();
}
function makeBug(){
  const q=pick(BUGQUIZ);
  const opts=shuffle(q.o.map((t,i)=>({t,ok:i===0})));
  return {id:nid(), q:q.q, opts};
}
function fixBug(bid, optIdx){
  const p=P(); if(!p) return;
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
  if(!ok) openFixModal(bid); // let them try again
}
/* ---------- delivery ---------- */
function canDeliver(){
  const p=P(); return p && p.phase!=="delivered" && p.features.every(f=>f.done);
}
function qualityNow(){
  const p=P();
  let q=58+p.features.filter(f=>f.done).length*6 - p.bugs.length*9 + avgSkill();
  if(S.gear.desklamp) q+=1;
  const onTime=S.day<=p.offer.createdDay+p.offer.days+1;
  if(!onTime) q-=8;
  return clamp(Math.round(q),5,100);
}
function avgSkill(){ return SKILLS.reduce((a,k)=>a+S.skills[k],0)/SKILLS.length; }
function deliverProject(){
  const p=P(); if(!p) return;
  const q=qualityNow();
  const dueDay=p.offer.createdDay+p.offer.days;
  const onTime=S.day<=dueDay+1;
  const lateDays=Math.max(0,S.day-dueDay);
  // stars
  let stars=1+q/26+(onTime?0.5:-1.1)+(p.client.picky?-(p.bugs.length?0.6:0.1):0)+rnd(-0.25,0.35);
  stars=clamp(Math.round(stars*2)/2,1,5);
  // money
  const rest=p.quote-p.depositPaid;
  const inv=issueInvoice(p.client,rest,p.client.netDays,"Final payment: "+p.offer.title);
  if(p.client.tip&&chance(p.client.tip)){ money(120,"Tip from "+p.client.company,"income"); S.incomeQuarter+=120; S.totalEarned+=120; toast("Bonus from "+p.client.name+": $120. They noticed the effort.","gold"); }
  // review scheduled
  const rtxt = stars>=4.5?pick(REVIEWS_POS):stars>=3?pick(REVIEWS_MID):pick(REVIEWS_NEG);
  S.reviews.push({day:S.day+rndi(1,3), stars, clientId:p.client.id, project:p.offer.title, txt:rtxt});
  // goodwill & stats
  p.client.projects++; p.client.goodwill=clamp(p.client.goodwill+(stars>=4?10:(stars>=3?2:-12)),0,100);
  S.projectsDone++;
  gainXp("comms",12);
  if(lateDays>0) addStress(8);
  log("Delivered "+p.offer.title+" (quality "+q+"/100, "+stars+"★"+(lateDays?", "+lateDays+"d late":"")+")","gold");
  SFX.levelup();
  S.project=null;
  save(); renderAll();
  toast("Shipped. Invoice for "+fmt$(rest)+" is out. Now you wait.","gold");
  maybeMilestone();
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
/* ---------- milestones ---------- */
const MILES=[
  {id:"m1",test:s=>s.projectsDone>=1,txt:"First project shipped. You exist now."},
  {id:"m2",test:s=>s.totalEarned>=10000,txt:"$10k earned. Landlord knows your name (fondly)."},
  {id:"m3",test:s=>s.rep>=4.2,txt:"4.2 stars. Clients ask for you by name."},
  {id:"m4",test:s=>s.totalEarned>=50000,txt:"$50k earned. This is a real business."},
  {id:"m5",test:s=>s.projectsDone>=10,txt:"Ten projects. Portfolio actually impressive."},
  {id:"m6",test:s=>s.totalEarned>=100000,txt:"$100k. Freelance legend."},
];
function maybeMilestone(){
  for(const m of MILES){
    if(!S.flags["m_"+m.id] && m.test(S)){
      S.flags["m_"+m.id]=true;
      toast("MILESTONE: "+m.txt,"gold",6000);
      log("Milestone: "+m.txt,"gold");
    }
  }
}
