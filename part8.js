/* ---------- modal helpers ---------- */
function openModal(html, lock){
  const root=$("#modalRoot"), box=$("#modalBox");
  box.innerHTML=html;
  root.classList.add("open");
  $$("#modalBox [data-close]").forEach(b=>b.onclick=()=>{SFX.click();closeModal()});
  box.dataset.lock=lock?"1":"";
}
function closeModal(){ const root=$("#modalRoot"); root.classList.remove("open"); $("#modalBox").innerHTML=""; }
function modalIsOpen(){ return $("#modalRoot").classList.contains("open"); }
function openChoiceModal(title,body,opts){
  let h=`<h3>${title}</h3><p style="margin:10px 0">${body}</p><div class="actions">`;
  opts.forEach((o,i)=>{ h+=`<button class="btn ${i===0?"primary":"ghost"}" data-ch="${i}">${esc(o.label)}</button>`; });
  h+=`</div>`;
  openModal(h);
  $$("#modalBox [data-ch]").forEach(b=>b.onclick=()=>{ SFX.click(); const o=opts[+b.dataset.ch]; closeModal(); o.fn(); });
}
/* ---------- negotiation (slider + typeable amount, single-fire) ---------- */
function openNegotiation(off){
  const suggested=Math.round(off.ask/10)*10;
  const lo=Math.max(100,Math.round(suggested*0.4)), hi=Math.round(suggested*2);
  openModal(`<h3>Negotiate: ${esc(off.title)}</h3>
    <p style="margin:8px 0">${esc(off.brief)}</p>
    <div class="tagrow">
      ${persTag(off.pers)}
      <span class="tag info">difficulty ${off.diff}</span>
      <span class="tag">deadline ${off.days}d</span>
      <span class="tag warn">pays net ${off.client.netDays}</span>
      <span class="tag">${off.feats.length} features</span>
    </div>
    <div class="field">
      <label>Your quote (their ballpark: about ${fmt$(suggested)})</label>
      <input type="range" class="range" id="qRange" min="${lo}" max="${hi}" step="10" value="${suggested}">
      <input type="number" id="qNum" min="0" step="10" value="${suggested}" style="margin-top:8px;font-size:20px;font-weight:800;width:180px">
      <div class="hint">Type an exact amount or drag the slider. Communication level ${S.skills.comms} gives you a little leverage. Ask for too much and they walk.</div>
    </div>
    <div class="field">
      <label><input type="checkbox" id="qDeposit" checked> Ask for a 30% deposit (protects against late payment, some clients refuse)</label>
    </div>
    <div class="actions"><button class="btn ghost" data-close>Walk away</button><button class="btn primary" id="qSend">Send quote</button></div>`);
  const range=$("#qRange"), num=$("#qNum");
  let syncing=false;
  range.oninput=()=>{ if(syncing) return; syncing=true; num.value=range.value; syncing=false; };
  num.oninput=()=>{ if(syncing) return; syncing=true; const v=clamp(parseInt(num.value,10)||0,lo,hi); range.value=v; syncing=false; };
  const send=$("#qSend");
  send.onclick=()=>{
    if(send.dataset.sent==="1") return;   // guard: a quote can only be sent once
    send.dataset.sent="1";
    const amount=clamp(parseInt(num.value,10)||suggested,100,999999);
    const wantDeposit=$("#qDeposit").checked;
    const v=quoteVerdict(off,amount);
    SFX.click();
    if(v.kind==="decline"){
      closeModal();
      openChoiceModal("They walked",esc(off.client.name)+" says the budget doesn't come close. Silence follows. You get nothing this time.",[
        {label:"Oh well",fn:()=>{ S.offers=S.offers.filter(o=>o.id!==off.id); log("Quote of "+fmt$(amount)+" got rejected outright.","warn"); save(); renderAll(); }},
      ]);
      return;
    }
    if(v.kind==="counter"){
      openChoiceModal("Counter-offer",esc(off.client.name)+" winces at the number. \"We can do "+fmt$(v.counter)+". Final.\"",[
        {label:"Take "+fmt$(v.counter),fn:()=>{ closeNegotiate(off,v.counter,wantDeposit); }},
        {label:"Hold at "+fmt$(amount),fn:()=>{ S.offers=S.offers.filter(o=>o.id!==off.id); log("Held firm at "+fmt$(amount)+" and they moved on.","warn"); toast("They respected the spine but not the number. Offer gone.","warn"); save(); renderAll(); }},
        {label:"Walk away",fn:()=>{ S.offers=S.offers.filter(o=>o.id!==off.id); log("Walked from negotiation at "+fmt$(amount),"warn"); save(); renderAll(); }},
      ]);
      return;
    }
    closeNegotiate(off,amount,wantDeposit);
  };
}
function closeNegotiate(off,amount,wantDeposit){
  const depositRefusers=["cheap","vip","ghosty"];
  let depositOk=wantDeposit&&!depositRefusers.includes(off.pers);
  if(wantDeposit&&!depositOk){
    toast(off.client.name+" refuses deposits. Payment on delivery only.","warn");
  }
  const depositPaid=depositOk?Math.round(amount*0.3):0;
  closeModal();
  startProject(off,amount,depositOk,depositPaid);
}
/* ---------- bank app ---------- */
function openBank(){
  ensureBank();
  const subRows=SUBSCRIPTIONS.map(sub=>{
    const on=S.bank.subs.includes(sub.id);
    return `<div class="subrow"><span style="flex:1"><span class="nm">${esc(sub.name)}</span> <span class="meta faint">${fmt$(sub.cost)}/mo · ${esc(sub.desc)}</span></span>
      <button class="btn sm ${on?"danger":"primary"}" data-sub="${sub.id}">${on?"Cancel":"Subscribe"}</button></div>`;
  }).join("");
  const foodRows=Object.keys(FOOD_MODES).map(id=>{
    const fm=FOOD_MODES[id];
    return `<button class="lifebtn ${S.bank.foodMode===id?"":""}" data-food="${id}" style="${S.bank.foodMode===id?"border-color:var(--acc);color:var(--acc)":""}"><b>${esc(fm.label)}</b> <span class="c">${fmt$(fm.cost)}/wk</span><div class="d">${esc(fm.blurb)}</div></button>`;
  }).join("");
  const lifeRows=LIFE_BUYS.map(b=>`<button class="lifebtn" data-life="${b.id}">${esc(b.name)}<div class="c">${fmt$(b.cost)}</div><div class="d">${esc(b.note)}</div></button>`).join("");
  const tx=S.ledger.slice(-14).reverse().map(l=>`<tr><td class="meta">day ${l.d}</td><td>${esc(l.note||l.kind)}</td><td class="num ${l.amount>=0?"green":"red"}">${fmt$(l.amount)}</td></tr>`).join("");
  openModal(`<h3>Bank app</h3>
    <div class="bankcard" style="margin:10px auto">
      <div class="bc-top"><span>DAYLIGHT DEBIT</span><span>${esc(S.bank.exp)}</span></div>
      <div class="bc-num">${esc(S.bank.cardNum)}</div>
      <div class="bc-bot"><span>STEPHEN FEHON</span><span>cvv ${esc(S.bank.cvv||"***")}</span></div>
    </div>
    <p class="meta" style="text-align:center">Balance: <b class="${S.cash<0?"red":"green"}">${fmt$(S.cash)}</b> · the card works everywhere in this town and nowhere else.</p>
    <h3 style="margin-top:16px">Subscriptions</h3>${subRows}
    <h3 style="margin-top:16px">Groceries plan <span class="meta faint">(bills every Sunday)</span></h3>
    <div class="lifegrid">${foodRows}</div>
    <h3 style="margin-top:16px">Treat yourself <span class="meta faint">(debit card, instant)</span></h3>
    <div class="lifegrid">${lifeRows}</div>
    <h3 style="margin-top:16px">Recent transactions</h3>
    <div class="scrollY" style="max-height:180px"><table>${tx}</table></div>
    <div class="actions"><button class="btn" data-close>Close</button></div>`);
  $$("#modalBox [data-sub]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.sub;
    if(S.bank.subs.includes(id)){ S.bank.subs=S.bank.subs.filter(x=>x!==id); toast("Cancelled. One less drain.","good"); }
    else { const sub=SUBSCRIPTIONS.find(x=>x.id===id); if(S.cash<sub.cost){ toast("Card declines. Not enough cash.","bad"); SFX.bad(); return; } S.bank.subs.push(id); toast("Subscribed to "+sub.name+".","good"); }
    SFX.click(); save(); openBank(); renderAll();
  });
  $$("#modalBox [data-food]").forEach(b=>b.onclick=()=>{
    S.bank.foodMode=b.dataset.food;
    toast("Groceries plan set to "+FOOD_MODES[S.bank.foodMode].label+".","good");
    SFX.click(); save(); openBank();
  });
  $$("#modalBox [data-life]").forEach(b=>b.onclick=()=>{ buyLife(b.dataset.life); openBank(); });
}
/* ---------- bugfix modal ---------- */
function openFixModal(pid, bid){
  const p=P(pid); if(!p) return;
  const b=p.bugs.find(x=>x.id===bid); if(!b) return;
  openModal(`<h3>Debugging</h3>
    <div class="tagrow"><span class="tag bad">bug</span><span class="meta faint">${esc(p.offer.title)}</span></div>
    <p class="mono" style="background:#070a11;border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0">${esc(b.q)}</p>
    <p class="meta">What's the right move?</p>
    ${b.opts.map((o,i)=>`<button class="chopt" data-opt="${i}">${esc(o.t)}</button>`).join("")}
    <div class="actions"><button class="btn ghost" data-close>Step away from the desk</button></div>`);
  $$("#modalBox [data-opt]").forEach(b2=>b2.onclick=()=>{
    const i=+b2.dataset.opt;
    if(b.opts[i].ok){ b2.classList.add("right"); setTimeout(()=>{closeModal();fixBug(pid,bid,i);},350); }
    else{ b2.classList.add("wrong"); b2.disabled=true; fixBug(pid,bid,i); }
  });
}
function openDeliverModal(pid){
  const p=P(pid); if(!p) return;
  const q=qualityNow(p);
  const due=p.offer.createdDay+p.offer.days;
  const onTime=S.day<=due+1;
  openModal(`<h3>Ship it?</h3>
    <p>Delivering <b>${esc(p.offer.title)}</b> to ${esc(p.client.company)}.</p>
    <div class="tagrow">
      <span class="tag ${q>=75?"good":q>=50?"warn":"bad"}">estimated quality ${q}/100</span>
      <span class="tag ${onTime?"good":"bad"}">${onTime?"on time":(S.day-due)+" day(s) late"}</span>
      ${p.bugs.length?`<span class="tag bad">${p.bugs.length} known bug(s)</span>`:`<span class="tag good">tests clean</span>`}
    </div>
    <p class="meta">You invoiced ${fmt$(p.quote-p.depositPaid)} (net ${p.client.netDays} days). The review lands a few days later. Quality drives it.</p>
    <div class="actions"><button class="btn ghost" data-close>Not yet</button><button class="btn primary" id="doDeliver">Ship it</button></div>`);
  $("#doDeliver").onclick=()=>{ closeModal(); deliverProject(pid); };
}
/* ---------- tabs / screens ---------- */
let curTab="inbox";
function switchTab(id){
  curTab=id;
  $$("#tabs .tab").forEach(t=>t.classList.toggle("on",t.dataset.tab===id));
  ["inbox","work","clients","money","you"].forEach(x=>$("#tab-"+x).classList.toggle("hidden",x!==id));
  SFX.click();
}
function showScreen(which){
  $("#intro").classList.toggle("hidden",which!=="intro");
  $("#game").classList.toggle("hidden",which!=="main");
}
/* ---------- intro code rain ---------- */
function introRain(){
  const cv=$("#introCanvas"), ctx=cv.getContext("2d");
  let cols,drops;
  function size(){ cv.width=innerWidth; cv.height=innerHeight; cols=Math.floor(cv.width/16); drops=Array(cols).fill(0).map(()=>rnd(-30,0)); }
  size(); addEventListener("resize",size);
  const glyphs="01{}<>=;/$fnconstletreturnif".split("");
  let raf;
  function frame(){
    ctx.fillStyle="rgba(10,13,20,0.12)";
    ctx.fillRect(0,0,cv.width,cv.height);
    ctx.font="13px ui-monospace,Menlo,Consolas,monospace";
    for(let i=0;i<cols;i++){
      const x=i*16, y=drops[i]*16;
      ctx.fillStyle=chance(.06)?"rgba(143,123,255,.8)":"rgba(94,242,160,"+(chance(.5)?.55:.28)+")";
      ctx.fillText(pick(glyphs),x,y);
      drops[i]+=rnd(.2,.7);
      if(y>cv.height&&chance(.03)) drops[i]=rnd(-20,0);
    }
    raf=requestAnimationFrame(frame);
  }
  frame();
  return ()=>cancelAnimationFrame(raf);
}
/* ---------- boot ---------- */
let stopRain=null;
function init(){
  stopRain=introRain();
  if(hasSave()){
    $("#btnContinue").classList.remove("hidden");
    try{
      const old=JSON.parse(localStorage.getItem(SAVE_KEY));
      $("#introStats").textContent="save found: day "+old.day+" · "+fmt$(old.cash)+" · "+old.projectsDone+" project(s) shipped · rank "+RANKS[old.flags&&old.flags.rank||0].name;
    }catch(e){}
  }
  $("#btnNew").onclick=()=>{ ac(); SFX.click(); if(hasSave()&&!confirm("Start over? Your current save will be erased.")) return; wipeSave(); S=freshState(); genOffer(true); genOffer(true); save(); startMain(); };
  $("#btnContinue").onclick=()=>{ ac(); SFX.click(); if(load()) startMain(); else toast("Save was unreadable. Starting fresh.","bad"); };
  $$("#tabs .tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
  $("#btnSleep").onclick=()=>{ SFX.click(); advanceDay(); };
  $("#btnShop").onclick=()=>openShop();
  $("#btnCoffee").onclick=()=>buyCoffee();
  $("#btnDrink").onclick=()=>buyDrink();
  $("#btnBankTop").onclick=()=>openBank();
  $("#logo").onclick=()=>switchTab("inbox");
  document.addEventListener("keydown",e=>{
    if(!$("#game")||$("#game").classList.contains("hidden")) return;
    if(e.key==="Escape"&&$("#modalBox").dataset.lock!=="1") closeModal();
    if(modalIsOpen()) return;
    if(e.target&&["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
    const tabs=["inbox","work","clients","money","you"];
    if(e.key>="1"&&e.key<="5") switchTab(tabs[+e.key-1]);
    if(e.code==="Space"&&!e.repeat){ e.preventDefault(); advanceDay(); }
  });
}
function startMain(){
  showScreen("main");
  if(stopRain){ stopRain(); stopRain=null; }
  switchTab("inbox");
  renderAll();
  if(!S.welcomed){
    S.welcomed=true;
    openChoiceModal("Day one",
      "You rented a room with a desk, a laptop, and "+fmt$(S.cash)+" to your name. Rent is "+fmt$(RENT)+" on the first of every month. Your inbox already has offers. Pick one, quote it, build it, ship it, invoice it. The money arrives late. It always arrives late.",
      [{label:"Let's get to work",fn:()=>{}}]);
    save();
  }
}
document.addEventListener("DOMContentLoaded",init);
