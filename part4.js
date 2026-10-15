/* ---------- economy: invoices, bills, taxes ---------- */
function issueInvoice(client, amount, netDays, note){
  const inv={id:nid(), clientId:client.id, clientName:client.name, company:client.company,
    amount:Math.round(amount), issued:S.day, due:S.day+netDays, status:"due", paid:0, nags:0, ghost:false, note:note||""};
  S.invoices.push(inv);
  log("Invoice sent to "+client.company+": "+fmt$(amount)+" (net "+netDays+")","acc2");
  return inv;
}
function clientById(id){ return S.clients.find(c=>c.id===id); }
function addRep(n){ S.rep=clamp(Math.round((S.rep+n)*100)/100,1,5); }
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
      S.totalEarned+=inv.amount;
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
  if(c && (c.pers==="picky"||c.pers==="vip"||c.pers==="bureaucrat") && chance(.3)){
    c.goodwill=clamp(c.goodwill-8,0,100);
    toast(c.name+" seemed annoyed by the reminder.","warn");
    log("Nagged "+inv.company+". They did not love it.","warn");
  } else {
    toast("Reminder sent to "+inv.company+".","good");
    log("Nagged "+inv.company+" about "+fmt$(inv.amount),"acc2");
  }
  save(); renderAll();
}
function writeOffInvoice(id){
  const inv=S.invoices.find(i=>i.id===id); if(!inv||inv.status!=="due") return;
  inv.status="written";
  const c=clientById(inv.clientId);
  if(c) c.goodwill=clamp(c.goodwill-15,0,100);
  log("Wrote off "+fmt$(inv.amount)+" from "+inv.company+". Painful lesson.","bad");
  toast("Wrote off "+fmt$(inv.amount)+". Some clients teach expensive lessons.","bad");
  save(); renderAll();
}
function tickBills(){
  const p=dayParts(S.day);
  if(p.dom===1){
    money(-RENT,"Rent","expense");
    money(-UTILITIES,"Utilities","expense");
    money(-INTERNET,"Internet","expense");
    log("Bills paid: rent, utilities, internet ("+fmt$(-(RENT+UTILITIES+INTERNET))+")","bad");
    toast("Bills paid: rent, utilities, internet ("+fmt$(-(RENT+UTILITIES+INTERNET))+")","warn");
  }
  if(p.dom===15){
    money(-INSURANCE,"Health insurance premium","expense");
    log("Health insurance: "+fmt$(-INSURANCE),"bad");
  }
  if((S.day-1)%QUARTER_DAYS===0 && S.day>1){
    const tax=Math.round(S.incomeQuarter*TAX_RATE);
    S.incomeTotal=S.incomeQuarter; S.incomeQuarter=0;
    if(tax>0){
      money(-tax,"Quarterly taxes","expense");
      log("Quarterly taxes paid: "+fmt$(-tax),"bad");
      toast("Quarterly tax bill: "+fmt$(tax)+" gone.","warn");
    }
  }
}
/* ---------- energy / daily rhythm ---------- */
const SESSION_COST=22;
const DRINK_DAILY_CAP=3, DRINK_COST=8;
function canWorkNow(){ return !S.skipWork && S.energy>=SESSION_COST; }
function sleepNight(){
  let rec=58+(S.gear.chair?15:0);
  if(isWeekend(S.day+1)) rec+=10;
  S.energy=clamp(S.energy+rec,0,100);
  let stressDrop=9+(S.gear.plants?4:0);
  S.stress=clamp(S.stress-stressDrop,0,100);
  S.skipWork=false;
  S.sessionsToday=0;
  S.drinksToday=0;
}
function spendEnergy(n){ S.energy=clamp(S.energy-n,0,100); }
function addStress(n){ S.stress=clamp(S.stress+n,0,100); }
function buyDrink(){
  if(S.drinksToday>=DRINK_DAILY_CAP){ toast("That's your "+DRINK_DAILY_CAP+" energy drinks for today. Your heart has opinions.","warn"); SFX.warn(); return; }
  if(S.cash<DRINK_COST){ toast("Not enough cash for an energy drink.","bad"); SFX.bad(); return; }
  money(-DRINK_COST,"Energy drink","expense");
  S.drinksToday++;
  S.energy=clamp(S.energy+30,0,100);
  addStress(5);
  SFX.good();
  toast("Energy drink. +30 energy, "+(DRINK_DAILY_CAP-S.drinksToday)+" left today. Your hands are slightly shaky.","good");
  save(); renderTop();
}
function buyCoffee(){
  const cost=S.gear.coffeemachine?3:6;
  if(S.gear.coffeemachine&&S.machineBroken){ toast("The espresso machine is still broken.","bad"); SFX.bad(); return; }
  if(S.energy>=100){ toast("You're already vibrating. No coffee needed.","warn"); return; }
  if(S.cash<cost){ toast("Not enough cash for coffee.","bad"); SFX.bad(); return; }
  money(-cost,"Coffee","expense");
  S.energy=clamp(S.energy+14,0,100);
  addStress(2);
  SFX.good();
  toast("Coffee. Energy up, nerves slightly worse.","good");
  save(); renderTop();
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

/* ---------- bank app, debit card, subscriptions, food modes ---------- */
const SUBSCRIPTIONS=[
  {id:"stream",name:"Streamflix",cost:16,desc:"Movies and shows. Classic wind-down."},
  {id:"music",name:"Waveform",cost:11,desc:"Music while you code."},
  {id:"cloud",name:"CloudDrive 2TB",cost:10,desc:"Backups. Cheap insurance for your livelihood."},
  {id:"gym",name:"IronHouse Gym",cost:38,desc:"-3 stress every week. Body needs maintenance too."},
  {id:"news",name:"The Dev Daily",cost:8,desc:"Industry news. Small comms XP weekly."},
  {id:"meal",name:"MealPrep Box",cost:62,desc:"Weekly food handled. Less stress, less flavor."},
];
const FOOD_MODES={
  takeout:{label:"Takeout life",cost:165,stress:2,blurb:"Never cook. Wallet notices, evenings are free."},
  balanced:{label:"Balanced",cost:85,stress:0,blurb:"Cooking most nights. Reasonable."},
  ramen:{label:"Ramen mode",cost:35,stress:5,blurb:"Survival groceries. Cheap, grim."},
};
function ensureBank(){
  if(!S.bank) S.bank={cardNum:null,subs:[],foodMode:"balanced",autopay:true};
  if(!S.bank.cardNum){
    let n="4";
    for(let i=0;i<15;i++) n+=rndi(0,9);
    S.bank.cardNum=n.replace(/(\d{4})(?=\d)/g,"$1 ");
    S.bank.cvv=String(rndi(100,999));
    S.bank.exp=(rndi(1,12)<10?"0":"")+rndi(1,12)+"/2"+rndi(7,9);
    save();
  }
}
function weeklyTick(){
  const p=dayParts(S.day);
  if(p.dowN===6){ // Sunday evening: groceries for the week
    const fm=FOOD_MODES[S.bank.foodMode]||FOOD_MODES.balanced;
    money(-fm.cost,"Groceries ("+fm.label+")","expense");
    if(fm.stress) addStress(fm.stress);
  }
  if(S.bank.subs.includes("gym")) addStress(-3);
  if(S.bank.subs.includes("news") && chance(.5)) gainXp("comms",2);
  if(p.dowN===6){ // weekly sub billing
    for(const id of S.bank.subs){
      const sub=SUBSCRIPTIONS.find(x=>x.id===id);
      if(sub && id!=="gym" && id!=="news"){ money(-sub.cost,"Subscription: "+sub.name,"expense"); }
    }
  }
}
const LIFE_BUYS=[
  {id:"nightout",name:"Night out with friends",cost:60,fx:()=>{addStress(-14);},note:"Stress down a lot. Worth it."},
  {id:"takeout_tonight",name:"Order takeout tonight",cost:26,fx:()=>{S.energy=clamp(S.energy+10,0,100);addStress(-4);},note:"Energy up, stress down."},
  {id:"games",name:"Buy that game on your wishlist",cost:45,fx:()=>{addStress(-9);},note:"You earned it. Stress down."},
  {id:"gym_day",name:"Climbing session",cost:22,fx:()=>{addStress(-8);S.energy=clamp(S.energy-5,0,100);},note:"Stress down, a little tired."},
  {id:"course",name:"Online course",cost:120,fx:()=>{gainXp(pick(SKILLS),16);},note:"XP in a random skill."},
  {id:"newphone",name:"New phone (finally)",cost:800,fx:()=>{addStress(-6);toast("It's so fast. Rep +0.05 (clients notice punctuality).","good");addRep(0.05);},note:"Stress down, tiny rep bump."},
];
function buyLife(id){
  const b=LIFE_BUYS.find(x=>x.id===id); if(!b) return;
  if(S.cash<b.cost){ toast("Your card declines. Not enough cash.","bad"); SFX.bad(); return; }
  money(-b.cost,"Self: "+b.name,"expense");
  b.fx();
  SFX.good();
  toast(b.name+": "+b.note,"good");
  save(); renderAll();
}
