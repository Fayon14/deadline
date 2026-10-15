"use strict";
/* ============================== DEADLINE ==============================
   A freelance software developer life simulator.
   Single file. No external assets. localStorage save.
   ===================================================================== */

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

/* ---------- audio ---------- */
let AC=null;
function ac(){ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}} return AC; }
function beep(f,d,type,vol){
  const c=ac(); if(!c) return;
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
  good:()=>{beep(523,.09,"sine",.07);setTimeout(()=>beep(784,.14,"sine",.07),90)},
  cash:()=>{beep(880,.08,"triangle",.08);setTimeout(()=>beep(1318,.18,"triangle",.08),80)},
  bad:()=>beep(160,.25,"sawtooth",.07),
  warn:()=>beep(320,.15,"sine",.06),
  levelup:()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.12,"triangle",.06),i*90))},
};

/* ---------- data tables ---------- */
const SKILLS=["frontend","backend","design","devops","comms"];
const SKILL_LABEL={frontend:"Frontend",backend:"Backend",design:"Design",devops:"DevOps",comms:"Communication"};
const xpNeed=l=>l*90;

const FIRST=["Maya","Dario","Priya","Tom","Elena","Marcus","Yuki","Sofia","Jamal","Ingrid","Ravi","Chloe","Omar","Nadia","Felix","Grace","Hugo","Leila","Ben","Zoe","Andre","Carmen","Pete","Wen","Sasha","Iris","Diego","Maren","Kofi","Rosa"];
const LAST=["Okafor","Lindqvist","Marchetti","Osei","Kowalski","Reyes","Nakamura","Delgado","Bergstrom","Fontaine","Adeyemi","Novak","Silva","Haddad","Keller","Moreau","Tanaka","Weiss","Costa","Iversen","Mensah","Rossi","Vidal","Chen","Bauer","Duarte","Aliyev","Novotna","Laurent","Petrov"];
const INDUSTRIES=[
  {n:"coffee roastery",co:["Beanline","Ember Roast","Foglifter","SlowPour","Crema Lab"]},
  {n:"law firm",co:["Aldrich & Sons","Marlowe Legal","Vance Partners","Corbin Group"]},
  {n:"gym chain",co:["Ironbound","RepHouse","FormCity","Kettle & Co"]},
  {n:"indie game studio",co:["Pixel Wren","Hexlight","Paperwolf","Nine Door Games"]},
  {n:"landscaping company",co:["GreenStride","Mowtown","Verdant Bros","Cloverline"]},
  {n:"bakery",co:["Flour & Ember","Crumbcraft","The Warm Loaf","Doughlight"]},
  {n:"veterinary clinic",co:["Pawpoint","Brightwhisker Vet","Four Paws Clinic","Furwell"]},
  {n:"real estate agency",co:["Keystone Realty","Hearthome","Ridgeview Estates","Lockbox Group"]},
  {n:"yoga studio",co:["Stillpoint","Lotus Rise","Breathline","Studio Nimbus"]},
  {n:"food truck",co:["Curbside Kitchen","The Rolling Stove","Taco Odyssey","Smokewagon"]},
  {n:"dentist office",co:["Molar & Co","Brightbite Dental","Enamel Works","Fairview Dental"]},
  {n:"used bookstore",co:["Dog-Eared","Marginalia","Second Spine","The Read Shelf"]},
  {n:"auto repair shop",co:["Torque Bros","Rustbelt Garage","Precision Motor","Camshaft & Co"]},
  {n:"nonprofits",co:["Bright Futures Fund","Harbor Relief","City Roots","Open Table Org"]},
  {n:"barbershop",co:["Fade Factory","The Sharp Edge","Classic Cuts Co","Blade & Bone"]},
  {n:"photography studio",co:["Aperture North","Golden Hour Co","Frame Nine","Shutterline"]},
  {n:"pest control",co:["BugOut Solutions","Critter Line","SafeNest Pest","Zero Vermin"]},
  {n:"catering company",co:["Plate & Post","Saffron Route","The Long Table","Saltcellar"]},
];
const PERSONALITIES=[
  {id:"chill",label:"Chill",pay:1.0,speed:1.0,picky:0,blurb:"Easy to work with, pays roughly on time."},
  {id:"picky",label:"Picky",pay:1.1,speed:1.05,picky:2,blurb:"High standards. Revisions happen."},
  {id:"micromanager",label:"Micromanager",pay:1.05,speed:0.9,picky:1,blurb:"Messages you constantly. Stressful."},
  {id:"ghosty",label:"Ghosty",pay:1.0,speed:0.85,picky:0,late:1.4,blurb:"Slow to reply, slower to pay."},
  {id:"generous",label:"Generous",pay:1.25,speed:1.0,picky:0,tip:.5,blurb:"Pays well and tips on delivery."},
  {id:"cheap",label:"Cheap",pay:0.72,speed:1.15,picky:1,blurb:"Haggles hard. Work must be fast."},
  {id:"late",label:"Late Payer",pay:1.05,speed:1.0,picky:0,late:1.9,blurb:"Good work, bad bookkeeping."},
  {id:"vip",label:"Serious Client",pay:1.45,speed:0.95,picky:1,blurb:"Big company. Big expectations."},
];
/* job categories: the work you actually get asked to do */
const CATEGORIES=[
  {id:"website",name:"Marketing website",blurb:"A small business site that actually loads fast.",sk:{frontend:1,design:1},pay:[900,2600],days:[5,9],diff:[1,3],
    feats:["Landing page layout","Contact form + validation","Mobile responsiveness","SEO meta + sitemap","Analytics hookup"]},
  {id:"store",name:"Online store",blurb:"Products, cart, checkout, the whole dance.",sk:{frontend:2,backend:1},pay:[1800,5200],days:[8,14],diff:[2,4],
    feats:["Product catalog","Cart system","Checkout flow","Admin order view","Inventory tracking"]},
  {id:"booking",name:"Booking system",blurb:"Clients book appointments, no phone tag.",sk:{backend:2,frontend:1},pay:[1600,4400],days:[7,12],diff:[2,4],
    feats:["Calendar availability engine","Booking form","Email confirmations","Admin dashboard","Cancellation logic"]},
  {id:"api",name:"API integration",blurb:"Wire two systems together and make it stick.",sk:{backend:3},pay:[1200,3800],days:[5,9],diff:[2,5],
    feats:["Auth handshake","Data mapping layer","Retry + error handling","Rate limit backoff","Integration tests"]},
  {id:"migration",name:"Database migration",blurb:"Old data out, new schema in, nothing lost.",sk:{backend:3,devops:1},pay:[2000,5600],days:[6,10],diff:[3,5],
    feats:["Schema mapping plan","Extract + transform script","Dry-run validation","Live cutover","Rollback safety net"]},
  {id:"dashboard",name:"Analytics dashboard",blurb:"Charts executives can nod at.",sk:{frontend:2,backend:2},pay:[2200,6200],days:[8,13],diff:[2,5],
    feats:["Data pipeline","Chart components","Filters + date ranges","CSV export","Auth + roles"]},
  {id:"bugfix",name:"Emergency bugfix",blurb:"Something is on fire and it is not your fault.",sk:{backend:2,devops:1},pay:[500,1600],days:[2,4],diff:[1,3],
    feats:["Reproduce the crash","Find root cause","Ship the patch","Write regression test"]},
  {id:"automation",name:"Automation script",blurb:"Kill a spreadsheet somebody hates.",sk:{backend:2,devops:2},pay:[700,2200],days:[4,7],diff:[1,3],
    feats:["Input parsing","Task engine","Scheduled runs","Failure alerts","Run log"]},
  {id:"redesign",name:"App redesign",blurb:"New skin, same bones. Designers weep quietly.",sk:{design:3,frontend:2},pay:[1800,5000],days:[7,11],diff:[2,4],
    feats:["Design system tokens","Component restyle","Dark mode","Motion polish","Old-route redirects"]},
  {id:"gameproto",name:"Game prototype",blurb:"A playable slice to show investors.",sk:{frontend:3,design:2},pay:[2000,6000],days:[7,12],diff:[3,5],
    feats:["Core loop prototype","Art style pass","Juice + feedback","Menu flow","Build pipeline"]},
  {id:"mobile",name:"Mobile app MVP",blurb:"Tiny app, giant expectations.",sk:{frontend:3,backend:1},pay:[3000,8000],days:[10,16],diff:[3,5],
    feats:["Auth + profiles","Core screens","Push notifications","Offline cache","App store prep"]},
  {id:"devops",name:"Infra rescue",blurb:"Their server is held together with hope.",sk:{devops:3,backend:2},pay:[1600,4800],days:[4,8],diff:[3,5],
    feats:["Server audit","CI/CD setup","Monitoring + alerts","Backup automation","Cost optimization"]},
];
const COMPANIES_SUFFIX=["LLC","Inc","Group","Studio","Collective","Co.","Works","Labs"];
const COMPANY_PREFIX=["North","Bright","Cedar","Atlas","Foxglove","Harbor","Quartz","Lumen","Cobalt","Wren","Anchor","Summit","Willow","Onyx","Fable","Juniper","Kestrel","Marble"];
const PERSONALITY_TITLES={chill:"Chill",picky:"Picky",micromanager:"Micromanager",ghosty:"Ghosty",generous:"Generous",cheap:"Cheap",late:"Late payer",vip:"Serious client"};

/* typing snippets: what you "write" in work sessions */
const SNIPPETS=[
 ["const orders = await db.query('SELECT * FROM orders WHERE status = $1', ['open']);","return orders.filter(o => o.total > 0).map(o => ({ id: o.id, total: o.total }));"],
 ["function debounce(fn, ms) {","  let t;  return (...args) => {    clearTimeout(t);    t = setTimeout(() => fn(...args), ms);  };","}"],
 ["app.get('/api/invoices/:id', auth, async (req, res) => {","  const inv = await Invoice.findById(req.params.id);","  if (!inv) return res.status(404).json({ error: 'not found' });","  res.json(inv);","});"],
 ["export default function Button({ children, onClick, variant = 'primary' }) {","  return <button className={`btn ${variant}`} onClick={onClick}>{children}</button>;","}"],
 ["try {","  const data = JSON.parse(fs.readFileSync(path, 'utf8'));","  console.log('loaded', data.length, 'records');","} catch (err) {","  console.error('parse failed:', err.message);","}"],
 ["const [state, setState] = useState({ loading: true, rows: [] });","useEffect(() => { fetch('/api/rows').then(r => r.json()).then(rows => setState({ loading: false, rows })); }, []);"],
 ["CREATE TABLE clients (","  id SERIAL PRIMARY KEY,","  name TEXT NOT NULL,","  email TEXT UNIQUE,","  created_at TIMESTAMPTZ DEFAULT now()",");"],
 ["ssh deploy@prod 'cd /srv/app && git pull && npm ci --production && pm2 reload all'"],
 ["def reconcile(payments, invoices):","    matched = [p for p in payments if p.ref in invoices]","    unmatched = [p for p in payments if p.ref not in invoices]","    return matched, unmatched"],
 ["@media (max-width: 760px) {","  .sidebar { display: none; }","  .content { padding: 12px; }","}"],
 ["git rebase -i HEAD~3  # squash the fixup commits before pushing"],
 ["docker compose up -d --build && ./scripts/wait_healthy.sh api 8080"],
 ["async function retry(fn, times = 3) {","  for (let i = 0; i < times; i++) {","    try { return await fn(); } catch (e) { if (i === times - 1) throw e; await sleep(300 * 2 ** i); }","  }","}"],
 ["input:focus { outline: none; border-color: #5ef2a0; box-shadow: 0 0 0 3px rgba(94,242,160,.2); }"],
 ["SELECT c.name, COUNT(b.id) AS bookings","FROM clients c LEFT JOIN bookings b ON b.client_id = c.id","GROUP BY c.name ORDER BY bookings DESC;"],
 ["const cache = new Map();","function memo(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }"],
 ["page.on('console', msg => { if (msg.type() === 'error') failures.push(msg.text()); });"],
];
/* bugfix quizzes: pick the right fix */
const BUGQUIZ=[
  {q:"TypeError: Cannot read property 'map' of undefined",o:["Guard the data before mapping: rows?.map(...)","Wrap it in try/catch and move on","Delete the map call entirely"]},
  {q:"Checkout button fires twice, double charges appear",o:["Disable the button until the request resolves","Add a second loading spinner to slow users down","Increase the server timeout"]},
  {q:"Memory keeps climbing until the tab crashes",o:["An event listener is being re-added every render; remove it on cleanup","Buy the client more RAM","Restart the server every hour on a cron"]},
  {q:"CSS: the modal renders behind the header on iOS Safari",o:["The stacking context is broken; give the modal a higher z-index in its own layer","Tell users to rotate their phone","Set overflow:hidden on body and hope"]},
  {q:"API returns 500 only for users with more than 100 records",o:["The query has no LIMIT and times out; paginate it","Ban users with more than 100 records","Retry the same request in a loop"]},
  {q:"Form submits on Enter before validation runs",o:["Handle the submit event and validate before the request","Remove the Enter key support","Validate after the request finishes"]},
  {q:"Timezone bug: appointments booked for 3pm show at 11am",o:["Store timestamps in UTC and convert on display","Ask every client their timezone by email","Round all times to the hour"]},
  {q:"Images look blurry on the new 4K screens",o:["Serve 2x resolution assets with srcset","Stretch the images with CSS","Tell users their screen is broken"]},
  {q:"Webhook retries create duplicate orders",o:["Make the handler idempotent with a dedupe key on event id","Turn off retries at the provider","Delete duplicate orders manually each morning"]},
  {q:"Build passes locally, fails in CI with missing module",o:["A dev dependency is missing from the lockfile; regenerate and commit it","Add sudo to the CI config","Copy node_modules into the repo"]},
];
const REVIEWS_POS=["Shipped early and it just works. Hiring again.","Best contractor we've worked with, period.","Clean code, clear updates, no surprises.","Fixed stuff we didn't even know was broken.","Under budget and over delivered."];
const REVIEWS_MID=["Solid work. A few rough edges.","Got the job done.","Fine overall. Communication could be tighter.","Delivered. Mostly on time."];
const REVIEWS_NEG=["Missed the deadline and it cost us a launch.","Buggy on delivery. Had to chase fixes.","Disappeared for days mid-project.","Overpromised and underdelivered."];
const EVENTS_POOL=["scope","ghost","laptop","referral","recruiter","inspired","sick","coffee","taxnote","reviewbomb","discountseeker","portfoliolove"];

/* gear shop */
const GEAR=[
  {id:"laptop2",name:"Refurb laptop",cost:1400,desc:"+15% progress per session.",req:null},
  {id:"laptop3",name:"Beefy laptop",cost:3600,desc:"+30% progress per session. Requires refurb laptop.",req:"laptop2"},
  {id:"monitor",name:"Second monitor",cost:450,desc:"-10% bug chance.",req:null},
  {id:"chair",name:"Ergonomic chair",cost:700,desc:"Sleep restores +15 extra energy.",req:null},
  {id:"desklamp",name:"Proper desk lamp",cost:120,desc:"+1 quality on delivery.",req:null},
  {id:"keyboard",name:"Mechanical keyboard",cost:250,desc:"Typing challenges get 4 more seconds.",req:null},
  {id:"coffeemachine",name:"Espresso machine",cost:900,desc:"Coffee costs half as much.",req:null},
  {id:"ups",name:"Battery backup",cost:600,desc:"Laptop failure events can't take a whole day.",req:null},
];
const RENT=1150, UTILITIES=180, INTERNET=80, INSURANCE=240, TAX_RATE=0.18, QUARTER_DAYS=90, MONTH_DAYS=30;
