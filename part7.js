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
  const ri=rankIndex();
  $("#rankName").textContent=RANKS[ri].name;
  $("#rankFill").style.width=Math.round(rankProgress()*100)+"%";
}
function dots(){
  $("#dotInbox").classList.toggle("hidden",!S.offers.some(o=>eligible(o)));
  $("#dotWork").classList.toggle("hidden",!S.projects.length);
  $("#dotMoney").classList.toggle("hidden",S.invoices.some(i=>i.status==="due"&&i.due<=S.day));
}
function persTag(id){
  const p=PERS_BY_ID[id]||PERSONALITIES[0];
  const cls={generous:"good",vip:"info",cheap:"bad",ghosty:"warn",late:"warn",picky:"warn",bureaucrat:"info"}[id]||"";
  return `<span class="tag ${cls}">${esc(p.label)}</span>`;
}
function renderInbox(){
  const el=$("#tab-inbox");
  const m=market();
  const hotNames=m.hot.map(id=>CAT_BY_ID[id]?CAT_BY_ID[id].name:id).join(" · ");
  if(!S.offers.length){
    el.innerHTML=`<h2 class="ph">Inbox <small>offers land here</small></h2>
    <div class="card"><div class="meta">Market pulse this week: <span class="tag hot">hot: ${esc(hotNames)}</span> <span class="faint">hot categories pay 20% more and show up twice as often.</span></div></div>
    <div class="empty">No offers right now. Sleep and check back.<br><span class="faint">Freelancing has a lot of this.</span></div>`;
    return;
  }
  let h=`<h2 class="ph">Inbox <small>${S.offers.length} open offer(s) · expired in ${Math.max(0,12-(S.day-(S.offers[0]?S.offers[0].createdDay:S.day)))}d+ · ${projectSlots()-S.projects.length} project slot(s) free</small></h2>
  <div class="card"><div class="meta">Market pulse this week: <span class="tag hot">hot: ${esc(hotNames)}</span> <span class="faint">hot categories pay 20% more and show up twice as often.</span></div></div>`;
  for(const o of S.offers){
    const ok=eligible(o);
    const c=o.client;
    const p=PERS_BY_ID[o.pers]||PERSONALITIES[0];
    const exp=o.createdDay+12-S.day;
    h+=`<div class="card offer">
      <div class="row" style="margin-bottom:6px">
        <div class="avat" style="background:linear-gradient(135deg,#8f7bff,#5ef2a0)">${esc(c.name.split(" ").map(x=>x[0]).join("").slice(0,2))}</div>
        <div style="flex:1"><h3>${esc(o.title)}</h3>
          <div class="meta">${esc(c.name)} · ${esc(c.company)} · ${esc(c.industry)}</div></div>
        <div style="text-align:right"><div class="pay">${fmt$(o.ask)}</div>${o.hot?'<span class="tag hot">hot market</span>':''}</div>
      </div>
      <p style="margin:4px 0 8px">${esc(o.brief)}</p>
      <div class="tagrow">
        ${persTag(o.pers)}
        <span class="tag info">difficulty ${o.diff}</span>
        <span class="tag">deadline ${o.days}d</span>
        <span class="tag warn">pays net ${c.netDays}</span>
        <span class="tag ${exp<=3?"bad":""}">expires in ${exp}d</span>
      </div>
      <div class="meta faint" style="margin-bottom:8px">${o.feats.map(f=>f.name).join(" · ")}</div>
      <div class="row">
        <button class="btn primary sm" data-accept="${o.id}" ${ok?"":"disabled"}>Accept &amp; negotiate</button>
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
  const canWork=p.phase==="dev"&&canWorkNow();
  return `<div class="feat ${f.done?"done":""}">
    <div class="ic">${f.done?"✓":(i+1)}</div>
    <div style="flex:1">
      <div class="nm">${esc(f.name)} ${f.done?'<span class="tag good">done</span>':`<span class="tag">diff ${f.diff}</span>`}</div>
      <div class="bar" style="margin-top:4px"><i class="fill-acc" style="width:${f.prog}%"></i></div>
    </div>
    ${!f.done&&p.phase==="dev"?`<button class="btn sm ${canWork?"primary":""}" data-work="${p.id}:${i}" ${canWork?"":"disabled"}>Work</button>`:""}
  </div>`;
}
function projectCard(p){
  const due=p.offer.createdDay+p.offer.days;
  const left=due-S.day+1;
  const totalProg=Math.round(p.features.reduce((a,f)=>a+f.prog,0)/p.features.length);
  let h=`<div class="card">
    <div class="spread"><div><h3>${esc(p.offer.title)}</h3>
      <div class="meta">${esc(p.client.name)} · ${esc(p.client.company)} · ${esc(p.offer.blurb||p.offer.catName)}</div></div>
      <div style="text-align:right"><div class="pay">${fmt$(p.quote)}</div>
      <div class="meta">${p.depositPaid?fmt$(p.depositPaid)+" deposit in · ":""}${fmt$(p.quote-p.depositPaid)} on delivery</div></div>
    </div>
    <div class="row" style="margin-top:10px">
      <span class="tag ${left<=2?"bad":left<=4?"warn":"info"}">${left<=0?"deadline blown":left+" day"+(left===1?"":"s")+" to deadline"}</span>
      <span class="tag">phase: ${p.phase}</span>
      <span class="tag">energy ${Math.round(S.energy)}/100</span>
      ${S.inspired?'<span class="tag gold">inspired: next session +25%</span>':""}
    </div>
    <div class="bar" style="margin:12px 0"><i class="fill-acc2" style="width:${totalProg}%"></i></div>
    <div>${p.features.map((f,i)=>featRow(f,i,p)).join("")}</div>`;
  if(p.phase==="test"||p.bugs.length){
    h+=`<div style="margin-top:12px;border-top:1px solid var(--line);padding-top:10px"><h3>Quality control</h3>`;
    if(!p.testedDay) h+=`<p class="meta">Run the test suite before you ship. Clients notice bugs; reviewers really notice bugs.</p><div class="row" style="margin-top:8px"><button class="btn primary sm" data-test="${p.id}">Run tests</button></div>`;
    else{
      h+=`<p class="meta">Tests run on day ${p.testedDay}. ${p.bugs.length} open bug(s).</p>`;
      if(p.bugs.length) h+=p.bugs.map(b=>`<div class="row" style="margin-top:8px"><span class="tag bad">bug</span><span class="meta" style="flex:1">${esc(b.q)}</span><button class="btn sm" data-fix="${p.id}:${b.id}">Fix</button></div>`).join("");
      h+=`<div class="row" style="margin-top:12px"><button class="btn sm" data-retest="${p.id}">Run tests again</button>${p.bugs.length?"":`<button class="btn primary sm" data-deliver="${p.id}">Deliver to client</button>`}</div>`;
      if(p.bugs.length) h+=`<div class="row" style="margin-top:8px"><button class="btn sm danger" data-deliver="${p.id}">Ship it broken anyway</button><span class="meta faint">they will find out</span></div>`;
    }
    h+=`</div>`;
  }
  if(p.phase==="dev"&&p.features.every(f=>f.done)){
    h+=`<div class="row" style="margin-top:10px"><button class="btn primary sm" data-testforce="${p.id}">Move to testing</button></div>`;
  }
  h+=`</div>`;
  return h;
}
function renderWork(){
  const el=$("#tab-work");
  let h=`<h2 class="ph">Work <small>${S.projects.length}/${projectSlots()} project slot(s) · work as long as your energy holds</small></h2>`;
  if(!S.projects.length){
    el.innerHTML=h+`<div class="empty">No active project. Take an offer from the inbox.<br><span class="faint">The rent does not accept "between projects" as an excuse.</span></div>`;
    return;
  }
  h+=S.projects.map(projectCard).join("");
  el.innerHTML=h;
  $$("#tab-work [data-work]").forEach(b=>b.onclick=()=>{SFX.click();const [pid,fi]=b.dataset.work.split(":");openWorkSession(+pid,+fi)});
  $$("#tab-work [data-test]").forEach(b=>b.onclick=()=>{SFX.click();runTests(+b.dataset.test)});
  $$("#tab-work [data-testforce]").forEach(b=>b.onclick=()=>{SFX.click();const p=P(+b.dataset.testforce);p.phase="test";save();renderAll()});
  $$("#tab-work [data-retest]").forEach(b=>b.onclick=()=>{SFX.click();runTests(+b.dataset.retest)});
  $$("#tab-work [data-fix]").forEach(b=>b.onclick=()=>{SFX.click();const [pid,bid]=b.dataset.fix.split(":");openFixModal(+pid,+bid)});
  $$("#tab-work [data-deliver]").forEach(b=>b.onclick=()=>{SFX.click();openDeliverModal(+b.dataset.deliver)});
}
function renderClients(){
  const el=$("#tab-clients");
  let h=`<h2 class="ph">Clients <small>${S.clients.length} in your roster, no repeats ever</small></h2>`;
  if(!S.clients.length){ el.innerHTML=h+`<div class="empty">Nobody yet.</div>`; return; }
  const sorted=[...S.clients].sort((a,b)=>b.projects-a.projects||b.goodwill-a.goodwill);
  h+=sorted.map(c=>{
    const busy=clientBusy(c);
    const hist=c.history.map(id=>CAT_BY_ID[id]?CAT_BY_ID[id].name:id);
    const gw=Math.round(c.goodwill);
    return `<div class="card">
      <div class="row" style="margin-bottom:6px">
        <div class="avat" style="background:linear-gradient(135deg,${c.projects?"#5ef2a0,#8f7bff":"#3b4a68,#55688f"})">${esc(c.name.split(" ").map(x=>x[0]).join("").slice(0,2))}</div>
        <div style="flex:1"><h3>${esc(c.name)}</h3><div class="meta">${esc(c.company)} · ${esc(c.industry)}</div></div>
        <div style="text-align:right">${busy?'<span class="tag warn">working with you</span>':(c.projects?'<span class="tag good">past client</span>':'<span class="tag">lead</span>')}</div>
      </div>
      <div class="tagrow">
        ${persTag(c.pers)}
        <span class="tag ${gw<35?"bad":gw>75?"good":""}">goodwill ${gw}/100</span>
        <span class="tag warn">pays net ${c.netDays}</span>
        <span class="tag">${c.projects} project(s)</span>
        <span class="tag gold">${fmt$(c.earned)} earned</span>
      </div>
      ${hist.length?`<div class="meta faint" style="margin-top:4px">past work: ${esc(hist.join(", "))}</div>`:""}
    </div>`;
  }).join("");
  el.innerHTML=h;
}
function drawSpark(){
  const cv=$("#spark"); if(!cv) return;
  const ctx=cv.getContext("2d");
  const w=cv.width=cv.offsetWidth*2, hgt=cv.height=140;
  const data=S.cashHist.slice(-120);
  ctx.clearRect(0,0,w,hgt);
  if(data.length<2) return;
  const min=Math.min(...data,0), max=Math.max(...data,1);
  const px=i=>i/(data.length-1)*w, py=v=>hgt-8-(v-min)/(max-min||1)*(hgt-16);
  ctx.strokeStyle="#243049"; ctx.beginPath(); ctx.moveTo(0,py(0)); ctx.lineTo(w,py(0)); ctx.stroke();
  ctx.beginPath();
  data.forEach((v,i)=>{ i?ctx.lineTo(px(i),py(v)):ctx.moveTo(px(i),py(v)); });
  ctx.strokeStyle=S.cash<0?"#ff6b6b":"#5ef2a0"; ctx.lineWidth=3; ctx.stroke();
  ctx.lineTo(w,py(0)); ctx.lineTo(0,py(0)); ctx.closePath();
  ctx.fillStyle=S.cash<0?"rgba(255,107,107,.08)":"rgba(94,242,160,.08)"; ctx.fill();
}
function renderMoney(){
  const el=$("#tab-money");
  const nextRentDay=(Math.floor((S.day-1)/30)+1)*30+1;
  ensureBank();
  let h=`<h2 class="ph">Money <small>the part that keeps score</small></h2>
  <div class="row" style="margin-bottom:14px">
    <div class="bankcard" id="bankCard" style="cursor:pointer">
      <div class="bc-top"><span>DAYLIGHT DEBIT</span><span>${esc(S.bank.exp||"--/--")}</span></div>
      <div class="bc-num">${esc(S.bank.cardNum||"")}</div>
      <div class="bc-bot"><span>${esc((S.rep>0?"STEPHEN FEHON":"CARDHOLDER"))}</span><span>debit</span></div>
    </div>
    <button class="btn primary sm" id="btnBank">Open bank app</button>
  </div>
  <div class="grid3" style="margin-bottom:14px">
    <div class="kpi"><div class="v" style="color:${S.cash<0?"var(--bad)":"var(--acc)"}">${fmt$(S.cash)}</div><div class="k">cash</div></div>
    <div class="kpi"><div class="v">${fmt$(S.totalEarned)}</div><div class="k">earned lifetime</div></div>
    <div class="kpi"><div class="v">${fmt$(Math.round(S.incomeQuarter*TAX_RATE))}</div><div class="k">taxes owed next quarter</div></div>
  </div>
  <div class="card"><h3>Cash over time</h3><canvas id="spark"></canvas></div>
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
    S.ledger.slice(-12).reverse().map(l=>`<tr><td class="meta">day ${l.d}</td><td>${esc(l.note||l.kind)}</td><td class="num ${l.amount>=0?"green":"red"}">${fmt$(l.amount)}</td></tr>`).join("")+`</table></div>`;
  el.innerHTML=h;
  $("#btnBank").onclick=()=>{SFX.click();openBank();};
  $("#bankCard").onclick=()=>{SFX.click();openBank();};
  $$("#tab-money [data-nag]").forEach(b=>b.onclick=()=>{nagInvoice(+b.dataset.nag);});
  $$("#tab-money [data-write]").forEach(b=>b.onclick=()=>{
    openChoiceModal("Write off "+esc(fmt$(S.invoices.find(i=>i.id===+b.dataset.write).amount))+"?","No payment is coming. Writing it off clears the books and stings a little.",[
      {label:"Write it off",fn:()=>{writeOffInvoice(+b.dataset.write);}},
      {label:"Keep chasing",fn:()=>{}},
    ]);
  });
  requestAnimationFrame(drawSpark);
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
  <button class="btn sm" id="btnCoffee2">Coffee (${fmt$(S.gear.coffeemachine?3:6)})</button></div></div>
  </div>
  <div class="grid4" style="margin-top:14px">
    <div class="kpi"><div class="v">${S.projectsDone}</div><div class="k">projects shipped</div></div>
    <div class="kpi"><div class="v">${S.rep.toFixed(1)}★</div><div class="k">reputation (${S.repCount})</div></div>
    <div class="kpi"><div class="v">${S.clients.length}</div><div class="k">clients in roster</div></div>
    <div class="kpi"><div class="v">${RANKS[rankIndex()].name}</div><div class="k">current rank</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Achievements <span class="meta faint">${Object.keys(S.ach).length}/${ACHS.length}</span></h3>
  <div class="grid4">`;
  h+=ACHS.map(a=>`<div class="ach ${S.ach[a.id]?"got":""}"><div class="ic">${a.ic}</div><div><div class="t">${esc(a.t)}</div><div class="m">${esc(a.m)}</div></div></div>`).join("");
  h+=`</div></div>
  <div class="card" style="margin-top:14px"><h3>Reviews</h3>`;
  const rv=[...S.reviews].slice(-8).reverse();
  h+= rv.length? rv.map(r=>{const c=clientById(r.clientId);return `<div class="row" style="margin:6px 0"><span class="stars">${starStr(r.stars)}</span><span class="meta" style="flex:1">"${esc(r.txt||"")}"</span><span class="meta faint">${esc(c?c.company:"")}</span></div>`;}).join(""):`<p class="meta">No reviews yet. Ship something.</p>`;
  h+=`</div>`;
  el.innerHTML=h;
  $("#btnShop2").onclick=()=>openShop();
  $("#btnCoffee2").onclick=()=>buyCoffee();
}
function renderAll(){
  renderTop(); dots();
  renderInbox(); renderWork(); renderClients(); renderMoney(); renderYou();
  $("#log").innerHTML=S.log.map(l=>`<div><span class="d">d${l.d}</span><span class="${l.c}">${esc(l.t)}</span></div>`).join("");
}
