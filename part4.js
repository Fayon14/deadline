/* ---------- economy: invoices, bills, taxes ---------- */
function issueInvoice(client, amount, netDays, note){
  const inv={id:nid(), clientId:client.id, clientName:client.name, company:client.company,
    amount:Math.round(amount), issued:S.day, due:S.day+netDays, status:"due", paid:0, nags:0, ghost:false, note:note||""};
  S.invoices.push(inv);
  log("Invoice sent to "+client.company+": "+fmt$(amount)+" (net "+netDays+")","acc2");
  return inv;
}
function clientById(id){ return S.clients.find(c=>c.id===id); }
function invoicePayChance(inv){
  const c=clientById(inv.clientId); if(!c) return .6;
  let base=.42;
  if(c.pers==="generous") base=.75;
  if(c.pers==="vip") base=.6;
  if(c.pers==="ghosty") base=.22;
  if(c.pers==="late") base=.25;
  base*=c.lateMult>1.5?0.8:1;
  if(inv.nags>0) base+=.18*inv.nags;
  if(c.goodwill>75) base+=.08;
  if(c.goodwill<35) base-=.1;
  return clamp(base,0.08,0.95);
}
function tickInvoices(){
  for(const inv of S.invoices){
    if(inv.status!=="due") continue;
    if(inv.due>S.day) continue;
    const c=clientById(inv.clientId);
    const payP=invoicePayChance(inv)*(inv.ghost?(inv.nags>0?0.5:0):1);
    if(Math.random()<payP){
      const late=inv.due<S.day;
      inv.status="paid"; inv.paid=S.day;
      money(inv.amount, "Payment: "+inv.company, "income");
      S.incomeQuarter+=inv.amount; S.totalEarned+=inv.amount;
      if(c){ c.earned+=inv.amount; c.goodwill=clamp(c.goodwill+4,0,100); }
      SFX.cash();
      toast("Payment received: "+fmt$(inv.amount)+" from "+inv.company+(late?" (late)":""),"gold");
      log("PAID "+fmt$(inv.amount)+" <- "+inv.company+(late?" (late)":""),"gold");
    } else if(!inv.ghost && chance(.03)){
      inv.ghost=true;
      log(inv.company+" has gone quiet about their invoice...","bad");
      toast("Ghosted: "+inv.company+" stopped responding about "+fmt$(inv.amount),"bad");
    } else {
      if(inv.due===S.day){ log("Invoice past due: "+inv.company+" ("+fmt$(inv.amount)+")","warn"); }
    }
  }
}
function nagInvoice(id){
  const inv=S.invoices.find(i=>i.id===id); if(!inv||inv.status!=="due") return;
  const c=clientById(inv.clientId);
  inv.nags++;
  SFX.click();
  if(c && (c.pers==="picky"||c.pers==="vip") && chance(.3)){
    c.goodwill=clamp(c.goodwill-8,0,100);
    toast(c.name+" seemed annoyed by the reminder.","warn");
    log("Nagged "+inv.company+". They did not love it.","warn");
  } else {
    toast("Reminder sent to "+inv.company+".","good");
    log("Nagged "+inv.company+" about "+fmt$(inv.amount),"acc2");
  }
}
function writeOffInvoice(id){
  const inv=S.invoices.find(i=>i.id===id); if(!inv||inv.status!=="due") return;
  inv.status="written";
  const c=clientById(inv.clientId);
  if(c) c.goodwill=clamp(c.goodwill-15,0,100);
  log("Wrote off "+fmt$(inv.amount)+" from "+inv.company+". Painful lesson.","bad");
  toast("Wrote off "+fmt$(inv.amount)+". Some clients teach expensive lessons.","bad");
}
function monthStartDay(d){ return (d-1)%MONTH_DAYS===0; }
function tickBills(){
  const p=dayParts(S.day);
  if(p.dom===1){
    money(-RENT,"Rent","expense"); log("Rent paid: "+fmt$(-RENT),"bad");
    money(-UTILITIES,"Utilities","expense");
    money(-INTERNET,"Internet","expense");
    if(S.gear.laptop2||S.gear.laptop3) money(-25,"Gear insurance","expense");
    toast("Bills paid: rent, utilities, internet ("+fmt$(-(RENT+UTILITIES+INTERNET))+")","warn");
  }
  if(p.dom===15){
    money(-INSURANCE,"Health insurance premium","expense");
    log("Health insurance: "+fmt$(-INSURANCE),"bad");
  }
  if((S.day-1)%QUARTER_DAYS===0 && S.day>1){
    const tax=Math.round(S.incomeQuarter*TAX_RATE);
    S.incomeLastQ=S.incomeQuarter; S.incomeQuarter=0;
    if(tax>0){
      money(-tax,"Quarterly taxes","expense");
      log("Quarterly taxes paid: "+fmt$(-tax),"bad");
      toast("Quarterly tax bill: "+fmt$(tax)+" gone.","warn");
    }
  }
}
/* ---------- energy / daily rhythm ---------- */
const SESSION_COST=22;
function maxSessionsToday(){ return S.skipWork?0:3; }
function sessionsLeftToday(){ return S.project?clamp(maxSessionsToday()-(S.project.sessionsToday||0),0,3):0; }
function sleepNight(){
  let rec=58+(S.gear.chair?15:0);
  S.energy=clamp(S.energy+rec,0,100);
  S.stress=clamp(S.stress-9,0,100);
  S.skipWork=false;
  if(S.inspired){ /* inspiration carries into the next day's first session */ }
}
function spendEnergy(n){ S.energy=clamp(S.energy-n,0,100); }
function addStress(n){ S.stress=clamp(S.stress+n,0,100); }
function buyCoffee(){
  const cost=S.gear.coffeemachine?3:6;
  if(S.cash<cost){ toast("Not enough cash for coffee.","bad"); SFX.bad(); return; }
  money(-cost,"Coffee","expense");
  S.energy=clamp(S.energy+14,0,100);
  addStress(2);
  SFX.good();
  toast("Coffee. Energy up, nerves slightly worse.","good");
  renderTop();
}
function checkBroke(){
  if(S.cash<-2000){ gameOver("Your landlord finally ran out of patience. Evicted, laptop sold, career on pause."); return true; }
  if(S.cash<0 && (S.day-1)%MONTH_DAYS===0 && !S.flags.overdraftWarned){
    S.flags.overdraftWarned=true;
    toast("Your account is negative. The bank charges $35 for the privilege.","bad");
    money(-35,"Overdraft fee","expense");
  }
  return false;
}
