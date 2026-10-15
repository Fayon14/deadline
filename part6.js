/* ---------- day advance ---------- */
function advanceDay(){
  if(checkBroke()) return;
  S.day++;
  sleepNight();
  if(S.machineBroken){ S.machineBroken=false; }
  tickInvoices();
  tickBills();
  rollEvents();
  rollOffers();
  rollReviews();
  checkBroke();
  save();
  renderAll();
}
function rollOffers(){
  const gap=S.day-S.lastOfferDay;
  let chanceToday=clamp(0.25+gap*0.18+(S.rep-3)*0.05,0.15,0.95);
  if(S.project&&S.day-S.project.startedDay<2) chanceToday*=0.6;
  if(chance(chanceToday)){
    genOffer();
    if(chance(.25)) genOffer();
  }
  S.offers=S.offers.filter(o=>S.day-o.createdDay<=10);
  if(S.offers.length>5) S.offers.splice(0,S.offers.length-5);
}
function rollReviews(){
  const due=S.reviews.filter(r=>r.day<=S.day);
  S.reviews=S.reviews.filter(r=>r.day>S.day);
  for(const r of due){
    const c=clientById(r.clientId);
    S.repCount++;
    S.rep=Math.round(((S.rep*Math.max(1,S.repCount-1))+r.stars)/(Math.max(1,S.repCount))*100)/100;
    const txt = r.stars>=4.5?pick(REVIEWS_POS):r.stars>=3?pick(REVIEWS_MID):pick(REVIEWS_NEG);
    const name=c?c.name:"a client";
    toast("New review ("+r.stars+"★): \""+txt+"\"","gold"=== "gold"&&r.stars>=3.5?(r.stars>=3.5?"gold":"warn"):"bad",5000);
    log("Review from "+name+": "+r.stars+"★ "+txt, r.stars>=3.5?"gold":"bad");
  }
  S.rep=Math.round(S.rep*100)/100;
}
function rollEvents(){
  const n=chance(.55)?1:(chance(.5)?2:0);
  for(let i=0;i<n;i++) fireRandomEvent();
}
function fireRandomEvent(){
  const p=P();
  const pool=[];
  if(p) pool.push("scope","scope","revise");
  if(S.invoices.some(i=>i.status==="due"&&i.due>=S.day-6)) pool.push("ghost");
  pool.push("referral","recruiter","inspired","coffee","portfoliolove");
  if(!S.gear.ups) pool.push("laptop");
  if(chance(.4)) pool.push("sick");
  if(S.rep>=4&&chance(.3)) pool.push("reviewbomb");
  const ev=pick(pool);
  switch(ev){
    case "scope":{
      const featName=pick(["a dark mode","an admin page nobody asked for","a print-this-report button","Stripe integration","an email newsletter","multi-language support","a mobile version","a settings page"]);
      const extra=Math.round(p.quote*0.12/10)*10;
      openChoiceModal("Scope creep",
        esc(p.client.name)+" calls: \""+esc(featName)+"\". Just one more thing. It's small, right? It is not small.",
        [
          {label:"Take it (+"+fmt$(extra)+", more work, more stress)",fn:()=>{
            p.features.push({name:"Extra: "+featName,diff:rndi(2,4),prog:0,done:false});
            p.phase="dev"; p.quote+=extra;
            addStress(7);
            toast("Scope grew. So did the invoice.","warn");
            log("Scope creep: "+featName+" (+"+fmt$(extra)+")","warn");
            save(); renderAll();
          }},
          {label:"Politely decline",fn:()=>{
            p.client.goodwill=clamp(p.client.goodwill-4,0,100);
            toast("You held the line on scope.","good");
            log("Declined scope creep: "+featName,"acc2");
            save(); renderAll();
          }},
        ]);
      break;}
    case "revise":{
      if(p.phase==="delivered") break;
      const f=pick(p.features.filter(x=>x.done))||p.features[0];
      if(!f) break;
      f.done=false; f.prog=Math.round(f.prog*0.45);
      p.phase="dev";
      addStress(5);
      if(p.client.picky) addStress(3);
      toast(p.client.name+" wants changes to "+f.name+". Revision cycle.","warn");
      log("Revision request: "+f.name,"warn");
      break;}
    case "ghost":{
      const inv=pick(S.invoices.filter(i=>i.status==="due"));
      if(!inv) break;
      inv.due+=rndi(1,3);
      toast(inv.company+" said the check is 'in process'. It is not.","warn");
      log("Payment delayed: "+inv.company,"warn");
      break;}
    case "laptop":{
      const cost=S.gear.ups?rndi(40,90):rndi(180,420);
      money(-cost,"Laptop repair","expense");
      if(!S.gear.ups){ S.skipWork=true; toast("Laptop died mid-build. Repair: "+fmt$(cost)+". The day is written off.","bad"); log("Laptop failure. No work today.","bad"); }
      else { toast("Power flicker. The battery backup saved you; "+fmt$(cost)+" for a new fuse.","warn"); log("Minor laptop scare: "+fmt$(cost),"warn"); }
      SFX.bad();
      break;}
    case "referral":{
      S.rep=Math.round((S.rep+0.08)*100)/100;
      genOffer();
      toast("A past client referred you. Rep up, new offer in your inbox.","gold");
      log("Referral came in. Rep rising.","gold");
      break;}
    case "recruiter":{
      money(200,"Recruiter referral fee","income"); S.incomeQuarter+=200; S.totalEarned+=200;
      toast("A recruiter paid you $200 for referring a friend. Weird system, take the money.","good");
      log("Recruiter referral fee: +$200","good");
      break;}
    case "inspired":{
      S.inspired=true;
      toast("3am idea. It's actually good. Next session +25%.","good");
      log("Inspiration struck.","acc2");
      break;}
    case "sick":{
      S.skipWork=true;
      S.energy=clamp(S.energy-15,0,100);
      toast("You caught something. No work today, no matter the deadline.","bad");
      log("Sick day.","bad");
      break;}
    case "coffee":{
      if(S.gear.coffeemachine&&!S.machineBroken){ S.machineBroken=true; money(-80,"Espresso machine repair","expense"); toast("Espresso machine died. "+fmt$(80)+" to revive it.","warn"); }
      break;}
    case "reviewbomb":{
      S.rep=Math.round((S.rep+0.15)*100)/100;
      toast("Someone tweeted your portfolio. Rep is climbing.","gold");
      log("Portfolio got shared online. Rep up.","gold");
      break;}
    case "portfoliolove":{
      S.rep=Math.round((S.rep+0.06)*100)/100;
      toast("A dev blog linked your work. Nice.","good");
      break;}
  }
}
/* ---------- gear shop ---------- */
function openShop(){
  const rows=GEAR.map(g=>{
    const owned=!!S.gear[g.id];
    const locked=g.req&&!S.gear[g.req];
    return `<div class="card"><div class="spread">
      <div><h3>${esc(g.name)}</h3><div class="meta">${esc(g.desc)}</div></div>
      <div style="text-align:right">${owned?'<span class="tag good">owned</span>':`<button class="btn sm ${locked?"":"primary"}" data-buy="${g.id}" ${locked||S.cash<g.cost?"disabled":""}>${fmt$(g.cost)}</button>`}</div>
    </div></div>`;
  }).join("");
  openModal(`<h3>Gear</h3><p class="meta">Cash: ${fmt$(S.cash)}</p>${rows}<div class="actions"><button class="btn" data-close>Close</button></div>`);
  $$("#modalBox [data-buy]").forEach(b=>b.onclick=()=>{
    const g=GEAR.find(x=>x.id===b.dataset.buy); if(!g||S.cash<g.cost) return;
    money(-g.cost,"Bought "+g.name,"expense");
    S.gear[g.id]=true;
    SFX.cash();
    toast("Bought "+g.name+".","good");
    save(); openShop(); renderTop();
  });
}
/* ---------- game over ---------- */
function gameOver(reason){
  wipeSave();
  openModal(`<h3 style="color:var(--bad)">Game over</h3>
    <p>${esc(reason)}</p>
    <p class="meta">Day ${S.day}. ${fmt$(S.totalEarned)} earned lifetime. ${S.projectsDone} project(s) shipped. Final rep: ${S.rep}★.</p>
    <div class="actions"><button class="btn primary" id="goRestart">Start over</button></div>`,true);
  $("#goRestart").onclick=()=>{ closeModal(); S=freshState(); genOffer(true); genOffer(true); save(); showScreen("main"); renderAll(); };
}
