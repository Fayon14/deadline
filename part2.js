"use strict";
/* ============================== DEADLINE v2 ==============================
   Freelance dev simulator. Single file, no external assets.
   ======================================================================= */

/* ---------- tiny utils ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const rnd=(a,b)=>a+Math.random()*(b-a);
const rndi=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const chance=p=>Math.random()<p;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt$=n=>(n<0?"-$":"$")+Math.abs(Math.round(n)).toLocaleString("en-US");
let uidc=1; const nid=()=>uidc++;
const WEEK=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* ---------- audio ---------- */
let AC=null, MUTED=false;
function ac(){ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}} return AC; }
function beep(f,d,type,vol){
  const c=ac(); if(!c||MUTED) return;
  try{
    const o=c.createOscillator(),g=c.createGain();
    o.type=type||"sine"; o.frequency.value=f;
    g.gain.setValueAtTime(vol||.08,c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+(d||.15));
    o.connect(g);g.connect(c.destination);
    o.start();o.stop(c.currentTime+(d||.15));
  }catch(e){}
}
const SFX={
  click:()=>beep(660,.06,"square",.04),
  type:()=>beep(880+rnd(-120,120),.03,"square",.015),
  err:()=>beep(180,.12,"sawtooth",.05),
  good:()=>{beep(523,.09,"sine",.07);setTimeout(()=>beep(784,.14,"sine",.07),90)},
  cash:()=>{beep(880,.08,"triangle",.08);setTimeout(()=>beep(1318,.18,"triangle",.08),80)},
  bad:()=>beep(160,.25,"sawtooth",.07),
  warn:()=>beep(320,.15,"sine",.06),
  levelup:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.12,"triangle",.06),i*90))},
  ship:()=>{[392,523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.1,"triangle",.07),i*80))},
};

/* ---------- skills & ranks ---------- */
const SKILLS=["frontend","backend","design","devops","comms"];
const SKILL_LABEL={frontend:"Frontend",backend:"Backend",design:"Design",devops:"DevOps",comms:"Communication"};
const xpNeed=l=>l*90;
const RANKS=[
  {name:"Couch Coder",    need:{done:0, earned:0,     rep:0}},
  {name:"Side Hustler",   need:{done:2, earned:4000,  rep:0}},
  {name:"Proper Freelancer", need:{done:5, earned:15000, rep:3.5}},
  {name:"In-Demand Dev",  need:{done:9, earned:40000, rep:4.0}},
  {name:"Studio Grade",   need:{done:15,earned:90000, rep:4.3}},
  {name:"Legend of the Invoice", need:{done:25,earned:200000,rep:4.5}},
];
function rankIndex(){
  let idx=0;
  for(let i=0;i<RANKS.length;i++){
    const n=RANKS[i].need;
    if(S.projectsDone>=n.done && S.totalEarned>=n.earned && S.rep>=n.rep) idx=i;
  }
  return idx;
}
function rankProgress(){
  const i=rankIndex();
  if(i>=RANKS.length-1) return 1;
  const cur=RANKS[i].need, nxt=RANKS[i+1].need;
  const p1=clamp(S.projectsDone/Math.max(1,nxt.done),0,1);
  const p2=clamp(S.totalEarned/Math.max(1,nxt.earned),0,1);
  const p3=nxt.rep>0?clamp((S.rep-3)/Math.max(.01,nxt.rep-3),0,1):1;
  return (p1+p2+p3)/3;
}
function projectSlots(){ return rankIndex()>=2?2:1; }

/* ---------- name generation (combinatorial, near-unlimited) ---------- */
const FIRST=["Maya","Dario","Priya","Tom","Elena","Marcus","Yuki","Sofia","Jamal","Ingrid","Ravi","Chloe","Omar","Nadia","Felix","Grace","Hugo","Leila","Ben","Zoe","Andre","Carmen","Pete","Wen","Sasha","Iris","Diego","Maren","Kofi","Rosa","Nils","Amara","Jonas","Talia","Bruno","Ines","Milo","Freya","Otto","Lena","Cyrus","Dana","Ezra","Greta","Hana","Idris","June","Kenji","Lola","Mira","Noel","Opal","Pavel","Quinn","Rhea","Sami","Tove","Ula","Vera","Wes","Xio","Yara","Zane"];
const LAST=["Okafor","Lindqvist","Marchetti","Osei","Kowalski","Reyes","Nakamura","Delgado","Bergstrom","Fontaine","Adeyemi","Novak","Silva","Haddad","Keller","Moreau","Tanaka","Weiss","Costa","Iversen","Mensah","Rossi","Vidal","Chen","Bauer","Duarte","Aliyev","Novotna","Laurent","Petrov","Ashworth","Bellamy","Castellan","Dornan","Everhart","Ferreira","Galloway","Hendricks","Ibarra","Jankowski","Kavanagh","Lindgren","Mercer","Nilsen","Oyelaran","Pemberton","Quintero","Rasmussen","Sandoval","Thornbury","Umberton","Vasquez","Whitlock","Xiang","Yamada","Zieliński","Abernathy","Bexley","Calloway","Drummond","Eastwick","Fairbanks","Grieg"];
const MIDDLE_INITIALS="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
function makeUniqueName(){
  for(let t=0;t<400;t++){
    const n=pick(FIRST)+" "+pick(LAST)+(chance(.06)?" "+pick(MIDDLE_INITIALS)+".":"");
    if(!usedNames().has(n)) return n;
  }
  // deterministic fallback: append a roman numeral
  const base=pick(FIRST)+" "+pick(LAST);
  let n=base, k=2;
  while(usedNames().has(n)){ n=base+" "+toRoman(k++); }
  return n;
}
const ROMAN=["","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
function toRoman(n){ return ROMAN[n]||("the "+n+"th"); }
let _usedNamesCache=null;
function usedNames(){
  if(_usedNamesCache && _usedNamesCache.day===S.day && _usedNamesCache.n===S.clients.length) return _usedNamesCache.set;
  const set=new Set(S.clients.map(c=>c.name));
  _usedNamesCache={day:S.day,n:S.clients.length,set};
  return set;
}

/* ---------- industries & companies (combinatorial) ---------- */
const INDUSTRIES=[
  {n:"coffee roastery", cores:["Beanline","Ember Roast","Foglifter","SlowPour","Crema Lab","Crema","Roastyard","Beanline"]},
  {n:"law firm", cores:["Aldrich","Marlowe Legal","Vance","Corbin","Sterling & Marsh","Petrov Legal","Hale & Finch","Blackwood Law"]},
  {n:"gym chain", cores:["Ironbound","RepHouse","FormCity","Kettle Co","Pulse District","Liftworks","Barbell Society","Gritline"]},
  {n:"indie game studio", cores:["Pixel Wren","Hexlight","Paperwolf","Nine Door Games","Loamworks","Copper Fern","Tiny Anvil","Wickfield Games"]},
  {n:"landscaping company", cores:["GreenStride","Mowtown","Verdant Bros","Cloverline","Root & Reed","Thistledown","Sodworks","Hedgeline"]},
  {n:"bakery", cores:["Flour & Ember","Crumbcraft","The Warm Loaf","Doughlight","Rye & Sons","Butterblock","Siftworks","Ovenline"]},
  {n:"veterinary clinic", cores:["Pawpoint","Brightwhisker","Four Paws","Furwell","WhiskerWorks","Dr. Molar's Rival","Kindpaws","Tailspin Vet"]},
  {n:"real estate agency", cores:["Keystone Realty","Hearthome","Ridgeview","Lockbox Group","Gable & Post","Sillworks","Hearthstone Realty","Brownstone Row"]},
  {n:"yoga studio", cores:["Stillpoint","Lotus Rise","Breathline","Studio Nimbus","Mat & Mist","Solace Yoga","Stretchwork","Bendline"]},
  {n:"food truck", cores:["Curbside Kitchen","The Rolling Stove","Taco Odyssey","Smokewagon","Griddle Go","Wandering Wok","Pita Rush","Fryline"]},
  {n:"dentist office", cores:["Molar & Co","Brightbite","Enamel Works","Fairview Dental","Tooth & Truth","Crownpoint","Flossworks","Grinline"]},
  {n:"used bookstore", cores:["Dog-Eared","Marginalia","Second Spine","The Read Shelf","Inkwell Books","Foxtale Books","Spine & Vale","Readline"]},
  {n:"auto repair shop", cores:["Torque Bros","Rustbelt Garage","Precision Motor","Camshaft Co","Gasket & Sons","Idleworks","Axlegrease","Wrenchline"]},
  {n:"nonprofit", cores:["Bright Futures Fund","Harbor Relief","City Roots","Open Table Org","Lantern Aid","Mutual Ground","Civic Sprout","Kindline"]},
  {n:"barbershop", cores:["Fade Factory","The Sharp Edge","Classic Cuts","Blade & Bone","Shear Genius","Clipworks","Trimline","Barber & Sons"]},
  {n:"photography studio", cores:["Aperture North","Golden Hour Co","Frame Nine","Shutterline","Lenscraft","F-Stop Studio","Grainline","Darkroom Bros"]},
  {n:"pest control", cores:["BugOut Solutions","Critter Line","SafeNest","Zero Vermin","Swatworks","Antline","Nestguard","Vermin Vanished"]},
  {n:"catering company", cores:["Plate & Post","Saffron Route","The Long Table","Saltcellar","Canapé Cart","Feastworks","Garnish Bros","Tableline"]},
  {n:"plant nursery", cores:["Fern & Fog","Rootstock","Greenhouse Nine","Potting Shed","Seedline","Chlorophyll Co","Stemworks","Bloomline"]},
  {n:"escape room", cores:["Locked In","The Exit Room","Cipher House","Clockwork Escape","Keymaster","Roomworks","Deadbolt","Puzzline"]},
  {n:"car wash", cores:["Suds City","Bubble Bros","Shine Express","Waxwing Wash","Foamline","Rinseworks","Polish Co","Spotfree"]},
  {n:"tattoo parlor", cores:["Iron Ink","Blackline Studio","Hollow Needle","Steady Hand","Inkworks","Needle & Thread","Skinline","Permanent Co"]},
  {n:"hardware store", cores:["Bolt & Beam","The Tool Crib","Nailworks","Gristmill Hardware","Hexline","Sawdust Co","Latch & Key","Measureline"]},
  {n:"wedding planner", cores:["Ever After Co","The Aisle","Brideworks","Vow & Veil","First Dance","Tulle & Timber","Ringside","Vowline"]},
];
const COMPANY_TAILS=[""," LLC"," Inc"," Group"," Studio"," Collective"," Co."," Works"," Labs"," & Sons"," & Daughters"," Partners"," Society"," Dept."];
function makeUniqueCompany(){
  for(let t=0;t<400;t++){
    const ind=pick(INDUSTRIES);
    let co=pick(ind.cores);
    if(chance(.55)) co+=pick(COMPANY_TAILS);
    if(!usedCompanies().has(co)) return {co, industry:ind.n};
  }
  const ind=pick(INDUSTRIES);
  let co=pick(ind.cores), k=2;
  while(usedCompanies().has(co)){ co=pick(ind.cores)+" "+ROMAN[Math.min(k++,12)]; }
  return {co, industry:ind.n};
}
let _usedCoCache=null;
function usedCompanies(){
  if(_usedCoCache && _usedCoCache.day===S.day && _usedCoCache.n===S.clients.length) return _usedCoCache.set;
  const set=new Set(S.clients.map(c=>c.company));
  _usedCoCache={day:S.day,n:S.clients.length,set};
  return set;
}

/* ---------- personalities ---------- */
const PERSONALITIES=[
  {id:"chill",label:"Chill",pay:1.0,blurb:"Easy to work with, pays roughly on time."},
  {id:"picky",label:"Picky",pay:1.1,picky:2,blurb:"High standards. Revisions happen."},
  {id:"micromanager",label:"Micromanager",pay:1.05,picky:1,blurb:"Messages you constantly. Stressful."},
  {id:"ghosty",label:"Ghosty",pay:1.0,late:1.4,blurb:"Slow to reply, slower to pay."},
  {id:"generous",label:"Generous",pay:1.25,tip:.5,blurb:"Pays well and tips on delivery."},
  {id:"cheap",label:"Cheap",pay:0.72,picky:1,blurb:"Haggles hard. Work must be fast."},
  {id:"late",label:"Late Payer",pay:1.05,late:1.9,blurb:"Good work, bad bookkeeping."},
  {id:"vip",label:"Serious Client",pay:1.45,picky:1,blurb:"Big company. Big expectations."},
  {id:"excited",label:"Excited Newbie",pay:0.95,blurb:"First real project. Enthusiastic, vague."},
  {id:"bureaucrat",label:"Bureaucrat",pay:1.15,picky:2,blurb:"Three forms before any real work."},
];
const PERS_BY_ID={}; PERSONALITIES.forEach(p=>PERS_BY_ID[p.id]=p);
const NET_DAYS={generous:7,chill:14,picky:14,micromanager:14,ghosty:30,cheap:30,late:30,vip:45,excited:10,bureaucrat:21};

/* ---------- job categories with generative briefs ---------- */
const CATEGORIES=[
  {id:"website",name:"Marketing website",sk:{frontend:1,design:1},base:1600,days:[5,9],diff:[1,3],
   briefs:["{C} needs a site that doesn't look like 2009.","{N} wants a website before their rival across town launches one.","{C} finally agreed they need a real website instead of a Facebook page.","{N} got burned by a cheap site builder and wants it done right."],
   feats:["Landing page layout","Contact form + validation","Mobile responsiveness","SEO meta + sitemap","Analytics hookup","Image gallery","Testimonials section","Blog feed"]},
  {id:"store",name:"Online store",sk:{frontend:2,backend:1},base:3200,days:[8,14],diff:[2,4],
   briefs:["{C} wants to sell online instead of the farmers market.","{N} is losing orders to a competitor with a shop.","{C} needs the store live before the holiday rush.","{N} has 200 products in a spreadsheet and a dream."],
   feats:["Product catalog","Cart system","Checkout flow","Admin order view","Inventory tracking","Discount codes","Shipping rules","Customer accounts"]},
  {id:"booking",name:"Booking system",sk:{backend:2,frontend:1},base:2800,days:[7,12],diff:[2,4],
   briefs:["{C} is tired of scheduling by text message.","{N} lost a client to a double-booking and swore off paper calendars.","{C} wants clients to book themselves at 2am.","{N} needs reminders that actually remind."],
   feats:["Calendar availability engine","Booking form","Email confirmations","Admin dashboard","Cancellation logic","SMS reminders","Waitlist handling","Staff schedules"]},
  {id:"api",name:"API integration",sk:{backend:3},base:2400,days:[5,9],diff:[2,5],
   briefs:["{C} needs two systems to stop fighting each other.","{N} was promised an integration by a vendor who vanished.","{C} wants their data flowing between tools by Friday.","{N} is copy-pasting between two apps every single morning."],
   feats:["Auth handshake","Data mapping layer","Retry + error handling","Rate limit backoff","Integration tests","Webhook receiver","Data sync job","Monitoring dashboard"]},
  {id:"migration",name:"Database migration",sk:{backend:3,devops:1},base:3600,days:[6,10],diff:[3,5],
   briefs:["{C} is migrating off a system held together with duct tape.","{N} outgrew their spreadsheet and finally admits it.","{C} needs the old data moved before the license dies.","{N} has fifteen years of records nobody can lose."],
   feats:["Schema mapping plan","Extract + transform script","Dry-run validation","Live cutover","Rollback safety net","Data cleanup pass","Archive export","Post-migration report"]},
  {id:"dashboard",name:"Analytics dashboard",sk:{frontend:2,backend:2},base:4000,days:[8,13],diff:[2,5],
   briefs:["{C} wants charts for a board meeting that keeps getting moved.","{N} is drowning in exports and wants one screen.","{C} wants their numbers to look as good as they claim.","{N} needs yesterday's numbers before tomorrow's meeting."],
   feats:["Data pipeline","Chart components","Filters + date ranges","CSV export","Auth + roles","Realtime updates","Scheduled email reports","Mobile layout"]},
  {id:"bugfix",name:"Emergency bugfix",sk:{backend:2,devops:1},base:1000,days:[2,4],diff:[1,3],
   briefs:["{C} has a production fire and your name came up.","{N} lost a weekend to this bug already.","{C} needs this fixed before Monday, or else.","{N} has customers screenshotting the error at them."],
   feats:["Reproduce the crash","Find root cause","Ship the patch","Write regression test","Post-mortem notes"]},
  {id:"automation",name:"Automation script",sk:{backend:2,devops:2},base:1400,days:[4,7],diff:[1,3],
   briefs:["{C} wants to stop paying someone to copy-paste.","{N} found you on a forum where you fixed something similar.","{C} has a spreadsheet nobody loves.","{N} wants the weekly report to write itself."],
   feats:["Input parsing","Task engine","Scheduled runs","Failure alerts","Run log","Dry-run mode","Email digest","Config file"]},
  {id:"redesign",name:"App redesign",sk:{design:3,frontend:2},base:3200,days:[7,11],diff:[2,4],
   briefs:["{C} thinks their app looks dated, and they're right.","{N} lost customers who said the app felt old.","{C} got funding and wants to look the part.","{N} wants it to feel like 2026, not 2014."],
   feats:["Design system tokens","Component restyle","Dark mode","Motion polish","Old-route redirects","Icon refresh","Empty states","Accessibility pass"]},
  {id:"gameproto",name:"Game prototype",sk:{frontend:3,design:2},base:3800,days:[7,12],diff:[3,5],
   briefs:["{C} needs a playable slice for an investor meeting.","{N} has a game idea and no coder.","{C} wants to test the concept before committing real money.","{N} watched one too many game dev videos at 2am."],
   feats:["Core loop prototype","Art style pass","Juice + feedback","Menu flow","Build pipeline","Save system","Tutorial beat","Playtest hooks"]},
  {id:"mobile",name:"Mobile app MVP",sk:{frontend:3,backend:1},base:5200,days:[10,16],diff:[3,5],
   briefs:["{C} wants an app because their competitor has one.","{N} needs a simple app to test the market.","{C} got told by a customer 'there should be an app for this'.","{N} has a napkin sketch and strong opinions."],
   feats:["Auth + profiles","Core screens","Push notifications","Offline cache","App store prep","Deep links","Crash reporting","Onboarding flow"]},
  {id:"devops",name:"Infra rescue",sk:{devops:3,backend:2},base:3000,days:[4,8],diff:[3,5],
   briefs:["{C} had an outage and never wants another.","{N} is paying three humans to deploy by hand.","{C} needs someone to own their infrastructure.","{N} found their 'server' is a laptop under a desk."],
   feats:["Server audit","CI/CD setup","Monitoring + alerts","Backup automation","Cost optimization","Load testing","Uptime page","Incident runbook"]},
  {id:"crm",name:"Custom internal tool",sk:{backend:2,frontend:2},base:3600,days:[8,13],diff:[2,4],
   briefs:["{C} runs the whole business out of a shared Drive folder.","{N} bought three SaaS tools and uses none of them.","{C} wants one tool that fits instead of five that don't.","{N} has a whiteboard photo as their current system."],
   feats:["Data model + CRUD","Role permissions","Import from spreadsheets","Search + filters","Activity log","Bulk actions","Printable views","Keyboard shortcuts"]},
  {id:"content",name:"Site content engine",sk:{frontend:2,design:2},base:2200,days:[5,9],diff:[1,3],
   briefs:["{C} wants to publish articles without calling a developer each time.","{N} has a blog that updates twice a year, by accident.","{C} wants their menu/prices editable by staff.","{N} keeps emailing edits and paying for each one."],
   feats:["Simple CMS","Draft + publish flow","Image uploads","Scheduled posts","RSS feed","SEO friendly URLs","Tag system","Preview mode"]},
];
const CAT_BY_ID={}; CATEGORIES.forEach(c=>CAT_BY_ID[c.id]=c);

/* ---------- market pulse (rotating demand) ---------- */
function rollMarket(){
  const hot=shuffle(CATEGORIES.map(c=>c.id)).slice(0,3);
  return {week:Math.floor((S.day-1)/7), hot, updated:S.day};
}
function market(){
  if(!S.market||S.market.week!==Math.floor((S.day-1)/7)) S.market=rollMarket();
  return S.market;
}
function isHot(catId){ return market().hot.includes(catId); }

/* ---------- typing snippets (templated, near-unlimited) ---------- */
const SNIPPET_T=[
 ["const {v1} = await db.query('SELECT * FROM {v2} WHERE status = $1', ['open']);","return {v1}.filter(o => o.total > 0).map(o => ({ id: o.id, total: o.total }));"],
 ["function debounce{V2}(fn, ms) {","  let t;  return (...args) => {    clearTimeout(t);    t = setTimeout(() => fn(...args), ms);  };","}"],
 ["app.get('/api/{v2}/:id', auth, async (req, res) => {","  const row = await {V2}.findById(req.params.id);","  if (!row) return res.status(404).json({ error: 'not found' });","  res.json(row);","});"],
 ["export default function {V2}({ children, onClick, variant = 'primary' }) {","  return <button className={`btn ${variant}`} onClick={onClick}>{children}</button>;","}"],
 ["try {","  const {v1} = JSON.parse(fs.readFileSync(path, 'utf8'));","  console.log('loaded', {v1}.length, '{v2} records');","} catch (err) {","  console.error('parse failed:', err.message);","}"],
 ["const [state, setState] = useState({ loading: true, {v1}: [] });","useEffect(() => { fetch('/api/{v2}').then(r => r.json()).then(rows => setState({ loading: false, {v1}: rows })); }, []);"],
 ["CREATE TABLE {v2} (","  id SERIAL PRIMARY KEY,","  name TEXT NOT NULL,","  {v1} INTEGER DEFAULT 0,","  created_at TIMESTAMPTZ DEFAULT now()",");"],
 ["ssh deploy@{v1}-prod 'cd /srv/app && git pull && npm ci --production && pm2 reload all'"],
 ["def reconcile_{v1}(payments, invoices):","    matched = [p for p in payments if p.ref in invoices]","    unmatched = [p for p in payments if p.ref not in invoices]","    return matched, unmatched"],
 ["@media (max-width: {n1}px) {","  .{v2}-sidebar { display: none; }","  .{v2}-content { padding: 12px; }","}"],
 ["const cache_{v1} = new Map();","function memo(key, fn) { if (!cache_{v1}.has(key)) cache_{v1}.set(key, fn()); return cache_{v1}.get(key); }"],
 ["async function retry{V2}(fn, times = 3) {","  for (let i = 0; i < times; i++) {","    try { return await fn(); } catch (e) { if (i === times - 1) throw e; await sleep(300 * 2 ** i); }","  }","}"],
 ["input:focus { outline: none; border-color: #5ef2a0; box-shadow: 0 0 0 3px rgba(94,242,160,.{n1}); }"],
 ["SELECT c.name, COUNT(b.id) AS {v1}","FROM {v2} c LEFT JOIN bookings b ON b.client_id = c.id","GROUP BY c.name ORDER BY {v1} DESC;"],
 ["export const require{V2} = (req, res, next) => {","  if (!req.{v1}) return res.status(401).json({ error: 'unauthorized' });","  next();","};"],
 ["const results = await Promise.all(","  {v1}.map(id => fetch(`/api/{v2}/${id}`).then(r => r.json()))",");"],
 ["git rebase -i HEAD~{n1}  # squash the fixup commits before pushing to {v1}"],
 ["docker compose up -d --build && ./scripts/wait_healthy.sh {v2} 80{N1}"],
 ["let acc = 0;","for (const row of {v1}) {","  if (row.status === 'active') acc += row.amount;","}","console.log(`total active {v2}: ${acc}`);"],
 ["function sort{V2}(items) {","  return items.sort((a, b) => b.priority - a.priority).slice(0, {n1});","}"],
 ["const {v1} = {v2}.reduce((acc, x) => { acc[x.kind] = (acc[x.kind] || 0) + 1; return acc; }, {});","console.log('{v2} breakdown:', {v1});"],
 ["router.delete('/api/{v2}/:id', require{V2}, async (req, res) => {","  await {V2}.destroy(req.params.id);","  res.status(204).end();","});"],
 ["class {V2}Store {","  constructor() { this.{v1} = new Map(); }","  add(item) { this.{v1}.set(item.id, item); return item; }","}"],
 ["const clean = {v1}.filter(x => x.email && x.email.includes('@')).map(x => ({ ...x, source: '{v2}' }));"],
];
const VARS1=["rows","orders","invoices","leads","posts","tasks","events","shifts","jobs","bills","members","listings","tickets","trips","books","rentals"];
const VARS2=["orders","invoices","leads","posts","tasks","events","shifts","jobs","bills","members","listings","tickets","trips","books","rentals","invoices"];
const VARS3=["Order","Invoice","Lead","Post","Task","Event","Shift","Job","Bill","Member","Listing","Ticket","Trip","Book","Rental","Invoice"];
const _recentSnips=[];
function makeSnippet(){
  for(let t=0;t<80;t++){
    const tpl=pick(SNIPPET_T);
    const v1=pick(VARS1), v2=pick(VARS2), V2=pick(VARS3);
    const n1=pick([16,24,32,48,64,80,100,120,200,760]);
    const text=tpl.map(line=>line.replace(/\{v1\}/g,v1).replace(/\{v2\}/g,v2).replace(/\{V2\}/g,V2).replace(/\{n1\}/g,n1).replace(/\{N1\}/g,n1%100)).join("\n");
    if(!_recentSnips.includes(text)){
      _recentSnips.push(text); if(_recentSnips.length>60) _recentSnips.shift();
      return text;
    }
  }
  // guaranteed-unique fallback: stamp a comment the player will never see twice
  const tpl=pick(SNIPPET_T);
  const tag="  // session "+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);
  const n1b=pick([16,24,32,48,64,80,100,120,200,760]);
  return tpl.map(line=>line.replace(/\{v1\}/g,pick(VARS1)).replace(/\{v2\}/g,pick(VARS2)).replace(/\{V2\}/g,pick(VARS3)).replace(/\{n1\}/g,n1b).replace(/\{N1\}/g,n1b%100)).join("\n")+tag;
}
const _recentBriefs=[];
function pickBrief(cat, client){
  for(let t=0;t<40;t++){
    const b=pick(cat.briefs).replace("{C}",client.company).replace("{N}",client.name.split(" ")[0]);
    if(!_recentBriefs.includes(b)){ _recentBriefs.push(b); if(_recentBriefs.length>24) _recentBriefs.shift(); return b; }
  }
  return pick(cat.briefs).replace("{C}",client.company).replace("{N}",client.name.split(" ")[0])+" ("+client.industry+")";
}

/* ---------- bug quizzes ---------- */
const BUGQUIZ=[
  {q:"TypeError: Cannot read property 'map' of undefined",o:["Guard the data before mapping: rows?.map(...)","Wrap it in try/catch and move on","Delete the map call entirely"]},
  {q:"Checkout button fires twice, double charges appear",o:["Disable the button until the request resolves","Add a second loading spinner to slow users down","Increase the server timeout"]},
  {q:"Memory keeps climbing until the tab crashes",o:["An event listener is being re-added every render; remove it on cleanup","Buy the client more RAM","Restart the server every hour on a cron"]},
  {q:"CSS: the modal renders behind the header on iOS Safari",o:["The stacking context is broken; give the modal a higher z-index in its own layer","Tell users to rotate their phone","Set overflow:hidden on body and hope"]},
  {q:"API returns 500 only for users with more than 100 records",o:["The query has no LIMIT and times out; paginate it","Ban users with more than 100 records","Retry the same request in a loop"]},
  {q:"Form submits on Enter before validation runs",o:["Handle the submit event and validate before the request","Remove Enter key support entirely","Validate after the request finishes"]},
  {q:"Timezone bug: appointments booked for 3pm show at 11am",o:["Store timestamps in UTC and convert on display","Ask every client their timezone by email","Round all times to the hour"]},
  {q:"Images look blurry on the new 4K screens",o:["Serve 2x resolution assets with srcset","Stretch the images with CSS","Tell users their screen is broken"]},
  {q:"Webhook retries create duplicate orders",o:["Make the handler idempotent with a dedupe key on event id","Turn off retries at the provider","Delete duplicate orders manually each morning"]},
  {q:"Build passes locally, fails in CI with missing module",o:["A dev dependency is missing from the lockfile; regenerate and commit it","Add sudo to the CI config","Copy node_modules into the repo"]},
  {q:"Users report the app 'randomly' logs them out",o:["Session cookies expire server-side but the client never refreshes them; add silent renewal","Make passwords shorter so login is easier","Disable sessions entirely"]},
  {q:"Search takes 8 seconds on the products page",o:["Add a database index on the search column","Show a nicer loading animation","Ask users to search less"]},
  {q:"The date picker lets people book appointments in the past",o:["Validate against today's date on both client and server","Trust users not to do that","Delete past bookings every night"]},
  {q:" Emails from the app land in spam",o:["Set up SPF, DKIM and a proper reply-to domain","Write louder subject lines","Send more emails to train the filter"]},
  {q:"Two developers keep overwriting each other's changes",o:["Adopt feature branches with pull requests before merging","Email each other the changed files","Ban one of them from the repo"]},
  {q:"The homepage is fine but every 4th visit shows a 502",o:["One worker in the pool is dead; fix health checks and restart it","Clear the browser cache of everyone's laptop","Upgrade the homepage copy"]},
];

/* ---------- review generation (templated) ---------- */
const REV_POS=["Shipped early and it just works. Hiring {N} again.","Best contractor we've worked with, period.","Clean code, clear updates, no surprises.","Fixed stuff we didn't even know was broken.","Under budget and over delivered. {C} approves."];
const REV_MID=["Solid work. A few rough edges.","Got the job done, mostly on time.","Fine overall. Communication could be tighter.","Delivered. The deadline was more of a suggestion."];
const REV_NEG=["Missed the deadline and it cost us a launch.","Buggy on delivery. Had to chase fixes.","Disappeared for days mid-project.","Overpromised and underdelivered. {C} is not amused."];
function reviewText(stars, client){
  const pool=stars>=4.5?REV_POS:stars>=3?REV_MID:REV_NEG;
  return pick(pool).replace("{N}",client?client.name.split(" ")[0]:"they").replace("{C}",client?client.company:"the client");
}

/* ---------- gear ---------- */
const GEAR=[
  {id:"laptop2",name:"Refurb laptop",cost:1400,desc:"+15% progress per work session."},
  {id:"laptop3",name:"Beefy laptop",cost:3600,desc:"+30% progress per session. Needs the refurb first.",req:"laptop2"},
  {id:"monitor",name:"Second monitor",cost:450,desc:"Fewer bugs per session."},
  {id:"chair",name:"Ergonomic chair",cost:700,desc:"Sleep restores +15 extra energy."},
  {id:"desklamp",name:"Proper desk lamp",cost:120,desc:"+2 quality on delivery."},
  {id:"keyboard",name:"Mechanical keyboard",cost:250,desc:"Typing counts a little faster."},
  {id:"coffeemachine",name:"Espresso machine",cost:900,desc:"Coffee costs half as much."},
  {id:"ups",name:"Battery backup",cost:600,desc:"Laptop failure events can't take a whole day."},
  {id:"whiteboard",name:"Whiteboard wall",cost:380,desc:"One free revision absorbed per project."},
  {id:"plants",name:"Desk plants",cost:90,desc:"Stress decays a little faster overnight."},
];

/* ---------- economy constants ---------- */
const RENT=1150, UTILITIES=180, INTERNET=80, INSURANCE=240, TAX_RATE=0.18, QUARTER_DAYS=90, MONTH_DAYS=30;
const SAVE_KEY="deadline_save_v3";
