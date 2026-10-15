/* ---------- modal helpers ---------- */
function openModal(html, lock){
  const root=$("#modalRoot"), box=$("#modalBox");
  box.innerHTML=html;
  root.classList.add("open");
  $$("#modalBox [data-close]").forEach(b=>b.onclick=()=>{SFX.click();closeModal()});
  box.dataset.lock=lock?"1":"";
}
function closeModal(){ const root=$("#modalRoot"); root.classList.remove("open"); $("#modalBox").innerHTML=""; }
function openChoiceModal(title,body,opts){
  let h=`<h3>${title}</h3><p style="margin:10px 0">${body}</p><div class="actions">`;
  opts.forEach((o,i)=>{ h+=`<button class="btn ${i===0?"primary":"ghost"}" data-ch="${i}">${esc(o.label)}</button>`; });
  h+=`</div>`;
  openModal(h);
  $$("#modalBox [data-ch]").forEach(b=>b.onclick=()=>{ SFX.click(); const o=opts[+b.dataset.ch]; closeModal(); o.fn(); });
}
/* ---------- negotiation ---------- */
function openNegotiation(off){
  const suggested=Math.round(off.ask/10)*10;
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
      <label>Your quote (their ballpark: ${fmt$(suggested)})</label>
      <input type="range" class="range" id="qRange" min="${Math.max(100,Math.round(suggested*0.4))}" max="${Math.round(suggested*2)}" step="10" value="${suggested}">
      <div style="font-size:22px;font-weight:800;margin-top:4px" id="qVal">${fmt$(suggested)}</div>
      <div class="hint">Communication level ${S.skills.comms} gives you a little leverage. Ask for too much and they walk.</div>
    </div>
    <div class="field">
      <label><input type="checkbox" id="qDeposit" checked> Ask for a 30% deposit (protects against late payment, some clients refuse)</label>
    </div>
    <div class="actions"><button class="btn ghost" data-close>Walk away</button><button class="btn primary" id="qSend">Send quote</button></div>`);
  const range=$("#qRange"), val=$("#qVal");
  range.oninput=()=>{ val.textContent=fmt$(+range.value); };
  $("#qSend").onclick=()=>{
    const amount=+range.value;
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
        {label:"Hold at "+fmt$(amount),fn:()=>{ openNegotiation(off); }},
        {label:"Walk away",fn:()=>{ S.offers=S.offers.filter(o=>o.id!==off.id); log("Walked from negotiation at "+fmt$(amount),"warn"); save(); renderAll(); }},
      ]);
      return;
    }
    closeNegotiate(off,amount,wantDeposit);
  };
}
function closeNegotiate(off,amount,wantDeposit){
  // deposit odds by personality
  const depositRefusers=["cheap","vip","ghosty"];
  let depositOk=wantDeposit&&!depositRefusers.includes(off.pers);
  if(wantDeposit&&!depositOk){
    toast(off.client.name+" refuses deposits. Payment on delivery only.","warn");
  }
  const depositPaid=depositOk?Math.round(amount*0.3):0;
  startProject(off,amount,depositOk,depositPaid);
}
/* ---------- bugfix modal ---------- */
function openFixModal(bid){
  const p=P(); if(!p) return;
  const b=p.bugs.find(x=>x.id===bid); if(!b) return;
  openModal(`<h3>Debugging</h3>
    <div class="tagrow"><span class="tag bad">bug</span></div>
    <p class="mono" style="background:#070a11;border:1px solid var(--line);border-radius:10px;padding:12px;margin:10px 0">${esc(b.q)}</p>
    <p class="meta">What's the right move?</p>
    ${b.opts.map((o,i)=>`<button class="quizopt" data-opt="${i}">${esc(o.t)}</button>`).join("")}
    <div class="actions"><button class="btn ghost" data-close>Step away from the desk</button></div>`);
  $$("#modalBox [data-opt]").forEach(b2=>b2.onclick=()=>{
    const i=+b2.dataset.opt;
    if(b.opts[i].ok){ b2.classList.add("right"); setTimeout(()=>{closeModal();fixBug(bid,i);},350); }
    else{ b2.classList.add("wrong"); b2.disabled=true; fixBug(bid,i); }
  });
}
/* ---------- tabs / screens ---------- */
let curTab="inbox";
function switchTab(id){
  curTab=id;
  $$("#tabs .tab").forEach(t=>t.classList.toggle("on",t.dataset.tab===id));
  ["inbox","project","clients","money","you"].forEach(x=>$("#tab-"+x).classList.toggle("hidden",x!==id));
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
      $("#introStats").textContent="save found: day "+old.day+" · "+fmt$(old.cash)+" · "+old.projectsDone+" project(s) shipped";
    }catch(e){}
  }
  $("#btnNew").onclick=()=>{ ac(); SFX.click(); if(hasSave()&&!confirm("Start over? Your current save will be erased.")) return; wipeSave(); S=freshState(); genOffer(true); genOffer(true); save(); startMain(); };
  $("#btnContinue").onclick=()=>{ ac(); SFX.click(); if(load()) startMain(); else toast("Save was unreadable. Starting fresh.","bad"); };
  $$("#tabs .tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));
  $("#btnSleep").onclick=()=>{ SFX.click(); advanceDay(); };
  $("#btnShop").onclick=()=>openShop();
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&$("#modalBox").dataset.lock!=="1") closeModal();
  });
}
function startMain(){
  showScreen("main");
  if(stopRain){ stopRain(); stopRain=null; }
  switchTab("inbox");
  renderAll();
  if(S.day===1&&!S.flags.welcomed){
    S.flags.welcomed=true;
    openChoiceModal("Day one",
      "You rented a room with a desk, a laptop, and "+fmt$(S.cash)+" to your name. Rent is "+fmt$(RENT)+" on the first of every month. Your inbox already has offers. Pick one, quote it, build it, ship it, invoice it. The money arrives late. It always arrives late.",
      [{label:"Let's get to work",fn:()=>{}}]);
  }
}
document.addEventListener("DOMContentLoaded",init);
