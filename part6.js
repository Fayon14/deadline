/* ---------- day advance ---------- */
function advanceDay(){
  if(checkBroke()) return;
  S.day++;
  S.cashHist.push(S.cash); if(S.cashHist.length>140) S.cashHist.shift();
  sleepNight();
  if(S.machineBroken) S.machineBroken=false;
  tickInvoices();
  tickBills();
  weeklyTick();
  rollEvents();
  rollOffers();
  rollReviews();
  checkBroke();
  save();
  renderAll();
}
function rollOffers(){
  const gap=S.day-S.lastOfferDay;
  let p=clamp(0.28+gap*0.18+(S.rep-3)*0.08,0.15,0.95);
  if(isWeekend(S.day)) p*=0.45;
  if(S.projects.length && S.day-Math.min(...S.projects.map(x=>x.startedDay))<2) p*=0.7;
  if(S.projects.length>=projectSlots()) p*=0.35;
  if(chance(p)){
    genOffer();
    if(chance(.25)) genOffer();
  }
  const before=S.offers.length;
  S.offers=S.offers.filter(o=>!offerExpire(o));
  if(S.offers.length<before) log("An old offer expired. Clients move on fast.","warn");
  if(S.offers.length>6) S.offers=S.offers.slice(-6);
}
function rollReviews(){
  const due=S.reviews.filter(r=>r.day<=S.day);
  S.reviews=S.reviews.filter(r=>r.day>S.day);
  for(const r of due){
    const c=clientById(r.clientId);
    S.repCount++;
    S.rep=clamp(((S.rep*Math.max(1,S.repCount-1))+r.stars)/(Math.max(1,S.repCount)),1,5);
    const name=c?c.name:"a client";
    toast("New review ("+r.stars+" stars): \""+r.txt+"\"", r.stars>=3.5?"gold":"bad",5000);
    log("Review from "+name+": "+r.stars+" stars. "+r.txt, r.stars>=3.5?"gold":"bad");
    maybeMilestone();
  }
  S.rep=Math.round(S.rep*100)/100;
}
function rollEvents(){
  const n=chance(.55)?1:(chance(.5)?2:0);
  for(let i=0;i<n;i++) fireRandomEvent();
}
function fireRandomEvent(){
  const pool=[];
  if(S.projects.length) pool.push("scope","scope","revise");
  if(S.invoices.some(i=>i.status==="due"&&i.due>=S.day-6)) pool.push("ghost");
  pool.push("referral","recruiter","inspired","portfoliolove","windfall","mentor");
  if(!S.gear.ups) pool.push("laptop");
  if(S.gear.coffeemachine) pool.push("coffee");
  if(chance(.4)) pool.push("sick");
  if(chance(.3)) pool.push("competitor");
  if(S.rep>=4&&chance(.3)) pool.push("reviewbomb");
  const ev=pick(pool);
  switch(ev){
    case "scope":{
      const p=pick(S.projects); if(!p) break;
      const featName=pick(["a dark mode","an admin page nobody asked for","a print-this-report button","a Stripe integration","an email newsletter","multi-language support","a mobile version","a settings page"]);
      const extra=Math.round(p.quote*0.12/10)*10;
      openChoiceModal("Scope creep",
        esc(p.client.name)+" calls: \""+esc(featName)+". Just one more thing. It's small, right?\" It is not small.",
        [
          {label:"Take it (+"+fmt$(extra)+", more work, more stress)",fn:()=>{
            p.features.push({name:"Extra: "+featName,diff:rndi(2,4),prog:0,done:false});
            p.phase="dev"; p.quote+=extra;
            addStress(7);
            toast("Scope grew. So did the invoice.","warn");
            log("Scope creep on "+p.offer.title+": "+featName+" (+"+fmt$(extra)+")","warn");
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
      const p=pick(S.projects); if(!p) break;
      if(p.phase==="test"||p.phase==="delivered") break;
      const done=p.features.filter(x=>x.done);
      const f=done.length?pick(done):null;
      if(!f) break;
      if(S.gear.whiteboard&&!p.absorbedRevision){
        p.absorbedRevision=true;
        toast("Your whiteboard caught the revision early. Free fix.","good");
        log("Whiteboard absorbed a revision on "+p.offer.title,"acc2");
        break;
      }
      f.done=false; f.prog=Math.round(f.prog*0.45);
      p.phase="dev";
      addStress(5);
      if(p.client.picky) addStress(3);
      toast(p.client.name+" wants changes to "+f.name+". Revision cycle.","warn");
      log("Revision request on "+p.offer.title+": "+f.name,"warn");
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
      addRep(+0.08);
      genOffer();
      toast("A past client referred you. Rep up, new offer in your inbox.","gold");
      log("Referral came in. Rep rising.","gold");
      break;}
    case "recruiter":{
      money(200,"Recruiter referral fee","income"); S.totalEarned+=200;
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
      addRep(+0.15);
      toast("Someone shared your portfolio online. Rep is climbing.","gold");
      log("Portfolio got shared. Rep up.","gold");
      break;}
    case "portfoliolove":{
      addRep(+0.06);
      toast("A dev blog linked your work. Nice.","good");
      break;}
    case "windfall":{
      const amt=rndi(60,240);
      money(amt,"Found money (old expense refund)","income"); S.totalEarned+=amt;
      toast("A late expense refund landed: "+fmt$(amt)+".","good");
      log("Expense refund: +"+fmt$(amt),"good");
      break;}
    case "mentor":{
      gainXp(pick(SKILLS),12);
      toast("A senior dev reviewed your code over coffee. Free XP.","good");
      log("Mentor session. XP gained.","acc2");
      break;}
    case "competitor":{
      addRep(-0.06);
      toast("A rival freelancer undercut your rates somewhere. Rep dips a hair.","warn");
      log("Competitive pressure. Rep -0.06.","warn");
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
  const stats={day:S.day, earned:S.totalEarned, done:S.projectsDone, rep:S.rep, rank:RANKS[rankIndex()].name};
  openModal(`<h3 style="color:var(--bad)">Game over</h3>
    <p>${esc(reason)}</p>
    <p class="meta">Day ${stats.day}. ${fmt$(stats.earned)} earned lifetime. ${stats.done} project(s) shipped. Final rep: ${stats.rep} stars. Rank reached: ${esc(stats.rank)}.</p>
    <div class="actions"><button class="btn primary" id="goRestart">Start over</button></div>`,true);
  $("#goRestart").onclick=()=>{ closeModal(); S=freshState(); genOffer(true); genOffer(true); save(); showScreen("main"); switchTab("inbox"); renderAll(); };
}
