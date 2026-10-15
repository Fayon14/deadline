/* ---------- rendering ---------- */
function starStr(n){
  const full=Math.floor(n), half=n-full>=0.5;
  let s="";
  for(let i=0;i<full;i++) s+="★";
  if(half) s+="⯨";
  for(let i=full+(half?1:0);i<5;i++) s+="<span class='off'>★</span>";
  return s;
}
function renderTop(){
  $("#stCash").textContent=fmt$(S.cash);
  $("#stCash").style.color=S.cash<0?"var(--bad)":"";
  $("#energyFill").style.width=S.energy+"%";
  $("#stEnergy").textContent=Math.round(S.energy);
  $("#stressFill").style.width=S.stress+"%";
  $("#stStress").textContent=Math.round(S.stress);
  $("#stRep").innerHTML=starStr(S.rep);
  $("#stRepN").textContent=S.rep.toFixed(1);
  const p=dayParts(S.day);
  $("#stDay").textContent="Day "+S.day;
  $("#stWk").textContent=p.dow;
  $("#stDate").textContent=dateStr(S.day);
}
function dots(){
  $("#dotInbox").classList.toggle("hidden",!S.offers.some(o=>eligible(o)));
  $("#dotProject").classList.toggle("hidden",!S.project);
  $("#dotMoney").classList.toggle("hidden",S.invoices.some(i=>i.status==="paid"&&S.day-i.paid<=0)||S.invoices.some(i=>i.status==="due"&&i.due<=S.day));
}
function persTag(id){
  const p=PERSONALITIES.find(x=>x.id===id)||PERSONALITIES[0];
  const cls={generous:"good",vip:"info",cheap:"bad",ghosty:"warn",late:"warn",picky:"warn"}[id]||"";
  return `<span class="tag ${cls}">${esc(p.label)}</span>`;
}
function renderInbox(){
  const el=$("#tab-inbox");
  if(!S.offers.length){
    el.innerHTML=`<h2 class="ph">Inbox <small>offers land here</small></h2><div class="empty">No offers right now. Sleep and check back.<br><span class="faint">Freelancing has a lot of this.</span></div>`;
    return;
  }
  let h=`<h2 class="ph">Inbox <small>${S.offers.length} open offer(s)</small></h2>`;
  for(const o of S.offers){
    const ok=eligible(o);
    const c=o.client;
    const p=PERSONALITIES.find(x=>x.id===o.pers)||PERSONALITIES[0];
    h+=`<div class="card offer">
      <div class="row" style="margin-bottom:6px">
        <div class="avat" style="background:linear-gradient(135deg,#8f7bff,#5ef2a0)">${esc(c.name.split(" ").map(x=>x[0]).join(""))}</div>
        <div style="flex:1"><h3>${esc(o.title)}</h3>
          <div class="meta">${esc(c.name)} · ${esc(c.company)} · ${esc(c.industry)}</div></div>
        <div class="pay">${fmt$(o.ask)}</div>
      </div>
      <p style="margin:4px 0 8px">${esc(o.brief)}</p>
      <div class="tagrow">
        ${persTag(o.pers)}
        <span class="tag info">difficulty ${o.diff}</span>
        <span class="tag">deadline ${o.days}d</span>
        <span class="tag">${esc(p.blurb)}</span>
        <span class="tag warn">pays net ${c.netDays}</span>
      </div>
      <div class="row">
        <button class="btn primary sm" data-accept="${o.id}" ${ok?"":"disabled"}>Accept & negotiate</button>
        <button class="btn ghost sm" data-decline="${o.id}">Pass</button>
        ${ok?"":`<span class="meta red">needs ${Object.keys(o.req).map(k=>SKILL_LABEL[k]+" "+Math.max(1,o.req[k]-1)).join(", ")}</span>`}
      </div>
    </div>`;
  }
  el.innerHTML=h;
  $$("#tab-inbox [data-accept]").forEach(b=>b.onclick=()=>{SFX.click();acceptOffer(+b.dataset.accept)});
  $$("#tab-inbox [data-decline]").forEach(b=>b.onclick=()=>{
    S.offers=S.offers.filter(o=>o.id!==+b.dataset.decline);
    log("Passed on an offer.","");
    save(); renderAll();
  });
}
function featRow(f,i,p){
  return `<div class="feat ${f.done?"done":""}">
    <div class="ic">${f.done?"✓":i+1}</div>
    <div style="flex:1">
      <div class="nm">${esc(f.name)} ${f.done?'<span class="tag good">done</span>':`<span class="tag">diff ${f.diff}</span>`}</div>
      <div class="bar" style="margin-top:4px"><i class="fill-acc" style="width:${f.prog}%"></i></div>
    </div>
    ${!f.done&&p.phase==="dev"?`<button class="btn sm ${S.energy>=SESSION_COST&&p.sessionsToday<maxSessionsToday()&&!S.skipWork?"primary":""}" data-work="${i}" ${S.energy<SESSION_COST||p.sessionsToday>=maxSessionsToday()||S.skipWork?"disabled":""}>Work</button>`:""}
  </div>`;
}
function renderProject(){
  const el=$("#tab-project");
  const p=P();
  if(!p){
    el.innerHTML=`<h2 class="ph">Project <small>what you're building</small></h2><div class="empty">No active project. Take an offer from the inbox.<br><span class="faint">The rent does not accept "between projects" as an excuse.</span></div>`;
    return;
  }
  const due=p.offer.createdDay+p.offer.days;
  const left=due-S.day+1;
  const totalProg=Math.round(p.features.reduce((a,f)=>a+f.prog,0)/p.features.length);
  let h=`<h2 class="ph">Project <small>${esc(p.offer.catName)}</small></h2>
  <div class="card">
    <div class="spread"><div><h3>${esc(p.offer.title)}</h3>
      <div class="meta">${esc(p.client.name)} · ${esc(p.client.company)} · ${esc(p.offer.blurb)}</div></div>
      <div style="text-align:right"><div class="pay">${fmt$(p.quote)}</div>
      <div class="meta">${p.depositPaid?fmt$(p.depositPaid)+" deposit in · ":""}${fmt$(p.quote-p.depositPaid)} on delivery</div></div>
    </div>
    <div class="row" style="margin-top:10px">
      <span class="tag ${left<=2?"bad":left<=4?"warn":"info"}">${left<=0?"deadline blown":left+" day"+(left===1?"":"s")+" to deadline"}</span>
      <span class="tag">phase: ${p.phase}</span>
      <span class="tag">sessions left today: ${sessionsLeftToday()}</span>
      ${S.inspired?'<span class="tag gold">inspired: next session +25%</span>':""}
    </div>
    <div class="bar" style="margin:12px 0"><i class="fill-acc2" style="width:${totalProg}%"></i></div>
    <div>${p.features.map((f,i)=>featRow(f,i,p)).join("")}</div>
  </div>`;
  if(p.phase==="test"||p.bugs.length){
    h+=`<div class="card"><h3>Quality control</h3>`;
    if(!p.testedDay) h+=`<p class="meta">Run the test suite before you ship. Clients notice bugs; reviewers really notice bugs.</p><div class="row" style="margin-top:8px"><button class="btn primary" data-test>Run tests</button></div>`;
    else{
      h+=`<p class="meta">Tests run on day ${p.testedDay}. ${p.bugs.length} open bug(s).</p>`;
      if(p.bugs.length) h+=p.bugs.map(b=>`<div class="row" style="margin-top:8px"><span class="tag bad">bug</span><span class="meta" style="flex:1">${esc(b.q)}</span><button class="btn sm" data-fix="${b.id}">Fix</button></div>`).join("");
      h+=`<div class="row" style="margin-top:12px"><button class="btn sm" data-retest>Run tests again</button>${p.bugs.length?"":`<button class="btn primary" data-deliver>Deliver to client</button>`}</div>`;
      if(p.bugs.length) h+=`<div class="row" style="margin-top:8px"><button class="btn sm danger" data-deliver>Ship it broken anyway</button><span class="meta faint">they will find out</span></div>`;
    }
    h+=`</div>`;
  }
  if(p.phase==="dev"&&p.features.every(f=>f.done)){
    h+=`<div class="row" style="margin-top:4px"><button class="btn primary" data-testforce>Move to testing</button></div>`;
  }
  el.innerHTML=h;
  $$("#tab-project [data-work]").forEach(b=>b.onclick=()=>{SFX.click();openWorkSession(+b.dataset.work)});
  const tb=$("#tab-project [data-test]"); if(tb) tb.onclick=()=>{SFX.click();p.testedDay=p.testedDay||S.day;runTests()};
  const rf=$("#tab-project [data-testforce]"); if(rf) rf.onclick=()=>{SFX.click();p.phase="test";save();renderAll()};
  const rt=$("#tab-project [data-retest]"); if(rt) rt.onclick=()=>{SFX.click();runTests()};
  $$("#tab-project [data-fix]").forEach(b=>b.onclick=()=>{SFX.click();openFixModal(+b.dataset.fix)});
  $$("#tab-project [data-deliver]").forEach(b=>b.onclick=()=>{SFX.click();openDeliverModal()});
}
function openDeliverModal(){
  const p=P(); if(!p) return;
  const q=qualityNow();
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
  $("#doDeliver").onclick=()=>{ closeModal(); deliverProject(); };
}
function renderClients(){
  const el=$("#tab-clients");
  let h=`<h2 class="ph">Clients <small>${S.clients.length} in your roster, no repeats ever</small></h2>`;
  if(!S.clients.length){ el.innerHTML=h+`<div class="empty">Nobody yet.</div>`; return; }
  const sorted=[...S.clients].sort((a,b)=>b.projects-a.projects||b.goodwill-a.goodwill);
  h+=sorted.map(c=>{
    const pers=PERSONALITIES.find(x=>x.id===c.pers);
    const busy=clientBusy(c);
    const hist=c.history.map(id=>{const cat=CATEGORIES.find(x=>x.id===id);return cat?cat.name:id;});
    return `<div class="card">
      <div class="row" style="margin-bottom:6px">
        <div class="avat" style="background:linear-gradient(135deg,${c.projects?"#5ef2a0,#8f7bff":"#3b4a68,#55688f"})">${esc(c.name.split(" ").map(x=>x[0]).join(""))}</div>
        <div style="flex:1"><h3>${esc(c.name)}</h3><div class="meta">${esc(c.company)} · ${esc(c.industry)}</div></div>
        <div style="text-align:right">${busy?'<span class="tag warn">working with you</span>':(c.projects?'<span class="tag good">past client</span>':'<span class="tag">lead</span>')}</div>
      </div>
      <div class="tagrow">
        ${persTag(c.pers)}
        <span class="tag">goodwill ${Math.round(c.goodwill)}/100</span>
        <span class="tag warn">pays net ${c.netDays}</span>
        <span class="tag">${c.projects} project(s)</span>
        <span class="tag gold">${fmt$(c.earned)} earned</span>
      </div>
      ${hist.length?`<div class="meta faint" style="margin-top:4px">past work: ${esc(hist.join(", "))} — ${c.projects?"next job will be something new":""}</div>`:""}
    </div>`;
  }).join("");
  el.innerHTML=h;
}
function renderMoney(){
  const el=$("#tab-money");
  const p=dayParts(S.day);
  const nextRentDay=(Math.floor((S.day-1)/30)+1)*30+1;
  let h=`<h2 class="ph">Money <small>the part that keeps score</small></h2>
  <div class="grid3" style="margin-bottom:14px">
    <div class="kpi"><div class="v" style="color:${S.cash<0?"var(--bad)":"var(--acc)"}">${fmt$(S.cash)}</div><div class="k">cash</div></div>
    <div class="kpi"><div class="v">${fmt$(S.totalEarned)}</div><div class="k">earned lifetime</div></div>
    <div class="kpi"><div class="v">${fmt$(Math.round(S.incomeQuarter*TAX_RATE))}</div><div class="k">taxes owed next quarter</div></div>
  </div>
  <div class="card"><h3>Recurring</h3>
    <table><tr><th>bill</th><th class="num">monthly</th><th>next due</th></tr>
    <tr><td>Rent</td><td class="num">${fmt$(RENT)}</td><td>day ${nextRentDay}</td></tr>
    <tr><td>Utilities + internet</td><td class="num">${fmt$(UTILITIES+INTERNET)}</td><td>day ${nextRentDay}</td></tr>
    <tr><td>Health insurance</td><td class="num">${fmt$(INSURANCE)}</td><td>day ${Math.floor((S.day-1)/30)*30+15}</td></tr>
    <tr><td>Quarterly taxes (${Math.round(TAX_RATE*100)}%)</td><td class="num">on profit</td><td>every ${QUARTER_DAYS} days</td></tr></table>
  </div>
  <div class="card"><h3>Invoices</h3>`;
  const open=S.invoices.filter(i=>i.status==="due");
  const done=S.invoices.filter(i=>i.status!=="due");
  if(!open.length) h+=`<p class="meta">Nothing outstanding. Weird feeling, isn't it.</p>`;
  else h+=`<table><tr><th>client</th><th>note</th><th class="num">amount</th><th>due</th><th></th></tr>`+
    open.map(i=>`<tr><td>${esc(i.company)}</td><td class="meta">${esc(i.note||"")}</td><td class="num pay">${fmt$(i.amount)}</td>
      <td class="${i.due<S.day?"red":"meta"}">day ${i.due}${i.due<S.day?" (late)":""}</td>
      <td><button class="btn sm ghost" data-nag="${i.id}">Nag</button> <button class="btn sm danger" data-write="${i.id}" title="give up on it">Write off</button></td></tr>`).join("")+`</table>`;
  h+=`</div>`;
  if(done.length){
    h+=`<div class="card"><h3>History</h3><div class="scrollY"><table><tr><th>client</th><th class="num">amount</th><th>status</th></tr>`+
      done.map(i=>`<tr><td>${esc(i.company)}</td><td class="num">${fmt$(i.amount)}</td><td class="meta">${i.status}</td></tr>`).join("")+`</table></div></div>`;
  }
  h+=`<div class="card"><h3>Ledger <span class="meta faint">(last 12 entries)</span></h3><table>`+
    [...S.ledger].slice(-12).reverse().map(l=>`<tr><td class="meta">day ${l.d}</td><td>${esc(l.note||l.kind)}</td><td class="num ${l.amount>=0?"green":"red"}">${fmt$(l.amount)}</td></tr>`).join("")+`</table></div>`;
  el.innerHTML=h;
  $$("#tab-money [data-nag]").forEach(b=>b.onclick=()=>{nagInvoice(+b.dataset.nag);renderAll()});
  $$("#tab-money [data-write]").forEach(b=>b.onclick=()=>{openChoiceModal("Write off "+esc(fmt$(S.invoices.find(i=>i.id===+b.dataset.write).amount))+"?","No payment is coming. Writing it off clears the books and stings a little.",[
    {label:"Write it off",fn:()=>{writeOffInvoice(+b.dataset.write);renderAll()}},
    {label:"Keep chasing",fn:()=>{}},
  ])});
}
function renderYou(){
  const el=$("#tab-you");
  let h=`<h2 class="ph">You <small>skills, gear, stats</small></h2>
  <div class="grid2">
  <div class="card"><h3>Skills</h3>`;
  h+=SKILLS.map(k=>{
    const lv=S.skills[k], x=S.xp[k], need=xpNeed(lv);
    return `<div style="margin:10px 0"><div class="spread"><span class="nm">${SKILL_LABEL[k]} <span class="tag info">lv ${lv}</span></span><span class="meta faint">${x}/${need} xp</span></div>
    <div class="bar" style="margin-top:4px"><i class="fill-acc2" style="width:${Math.min(100,x/need*100)}%"></i></div></div>`;
  }).join("");
  h+=`<p class="meta faint" style="margin-top:8px">Skills gate which offers you can take and how fast you build.</p></div>
  <div class="card"><h3>Gear</h3>`;
  h+=GEAR.map(g=>`<div class="row" style="margin:7px 0"><span class="tag ${S.gear[g.id]?"good":""}">${S.gear[g.id]?"✓":"✗"}</span><span class="nm" style="flex:1">${esc(g.name)}</span><span class="meta faint">${S.gear[g.id]?"owned":fmt$(g.cost)}</span></div>`).join("");
  h+=`<div class="row" style="margin-top:10px"><button class="btn sm primary" id="btnShop2">Open gear shop</button>
  <button class="btn sm" id="btnCoffee">Coffee (${fmt$(S.gear.coffeemachine?3:6)})</button></div></div>
  </div>
  <div class="grid3" style="margin-top:14px">
    <div class="kpi"><div class="v">${S.projectsDone}</div><div class="k">projects shipped</div></div>
    <div class="kpi"><div class="v">${S.rep.toFixed(1)}★</div><div class="k">reputation (${S.repCount} reviews)</div></div>
    <div class="kpi"><div class="v">${S.clients.length}</div><div class="k">clients in roster</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Reviews</h3>`;
  const rv=[...S.reviews];
  h+= rv.length? rv.map(r=>{const c=clientById(r.clientId);return `<div class="row" style="margin:6px 0"><span class="stars">${starStr(r.stars)}</span><span class="meta" style="flex:1">"${esc(r.txt||"")}"</span><span class="meta faint">${esc(c?c.company:"")}</span></div>`;}).join(""):`<p class="meta">No reviews yet. Ship something.</p>`;
  h+=`</div>`;
  el.innerHTML=h;
  $("#btnShop2").onclick=()=>openShop();
  $("#btnCoffee").onclick=()=>buyCoffee();
}
function renderAll(){
  renderTop(); dots();
  renderInbox(); renderProject(); renderClients(); renderMoney(); renderYou();
  $("#log").innerHTML=S.log.map(l=>`<div><span class="d">d${l.d}</span><span class="${l.c}">${esc(l.t)}</span></div>`).join("");
}
