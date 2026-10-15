import json, quickjs, re

logic = "\n".join(open(f'part{i}.js').read() for i in range(2,9))

stubs = r'''
var _fakeEl=function(){return {style:{},dataset:{},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false}},innerHTML:"",textContent:"",value:"",width:0,height:0,appendChild:function(){},addEventListener:function(){},onclick:null,focus:function(){},scrollTop:0,scrollHeight:0,offsetWidth:100,getContext:function(){return {clearRect:function(){},beginPath:function(){},moveTo:function(){},lineTo:function(){},stroke:function(){},closePath:function(){},fill:function(){},fillStyle:"",strokeStyle:"",lineWidth:1,fillRect:function(){},fillText:function(){},font:""};}};};
var document={querySelector:function(){return _fakeEl();},querySelectorAll:function(){return [];},addEventListener:function(){},createElement:function(){return _fakeEl();}};
var window={addEventListener:function(){},AudioContext:undefined,webkitAudioContext:undefined};
var localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
var confirm=function(){return true;};
var requestAnimationFrame=function(){return 0;};
var setTimeout=function(){};
var innerWidth=1200, innerHeight=800;
'''

sim = r'''
var openChoiceModal=function(t,b,opts){ if(opts&&opts.length) opts[0].fn(); };
var openModal=function(){}, closeModal=function(){}, modalIsOpen=function(){return false;};
var switchTab=function(){}, renderAll=function(){}, renderTop=function(){}, drawSpark=function(){};
var openNegotiation=function(off){ closeNegotiate(off, off.ask, true); };

var seenNames={}, seenCos={}, seenIds={}, problems=[], lastScanLen=0;
function checkInvariants(tag){
  for(var i=lastScanLen;i<S.clients.length;i++){
    if(seenIds[S.clients[i].id]!==undefined) problems.push(tag+" dup id "+S.clients[i].id);
    seenIds[S.clients[i].id]=1;
    var c=S.clients[i];
    if(seenNames[c.name]!==undefined) problems.push(tag+" dup name: "+c.name+" ids="+seenNames[c.name]+","+c.id+" lens="+S.clients.length+" co="+c.company);
    if(seenNames[c.name]===undefined) seenNames[c.name]=c.id; else seenNames[c.name]=seenNames[c.name]+"|"+c.id;
    if(seenCos[c.company]!==undefined) problems.push(tag+" dup company: "+c.company+" ids="+seenCos[c.company]+","+c.id);
    if(seenCos[c.company]===undefined) seenCos[c.company]=c.id; else seenCos[c.company]=seenCos[c.company]+"|"+c.id;
    var hs={}; for(var j=0;j<c.history.length;j++){ if(hs[c.history[j]]) problems.push(tag+" repeat category for "+c.name+": "+c.history[j]); hs[c.history[j]]=1; }
  }
  var ids=S.projects.map(function(p){return p.client.id;});
  if(new Set(ids).size!==ids.length) problems.push(tag+" same client on 2 active projects");
  for(var k=0;k<S.offers.length;k++){ if(ids.indexOf(S.offers[k].client.id)>=0) problems.push(tag+" offer client also active"); }
  if(!isFinite(S.cash)||!isFinite(S.energy)||!isFinite(S.stress)) problems.push(tag+" NaN state");
  if(S.rep<1||S.rep>5) problems.push(tag+" rep out of range: "+S.rep);
}

S=freshState(); genOffer(true); genOffer(true);
var startDay=S.day, sessions=0, deliveries=0, accepted=0;
for(var step=0; step<220; step++){
  if(S.projects.length<projectSlots()){
    var off=null;
    for(var q=0;q<S.offers.length;q++){ if(eligible(S.offers[q])){ off=S.offers[q]; break; } }
    if(off){ closeNegotiate(off, off.ask, true); accepted++; }
  }
  var plist=S.projects.slice();
  for(var pi=0;pi<plist.length;pi++){
    var p=plist[pi], guard=0;
    while(p.phase==="dev" && S.energy>=SESSION_COST && !S.skipWork && guard<40){
      var feat=null; for(var f=0;f<p.features.length;f++){ if(!p.features[f].done){ feat=p.features[f]; break; } }
      if(!feat) break;
      feat.prog=100; feat.done=true; S.sessionsToday++; sessions++; spendEnergy(SESSION_COST);
      if(Math.random()<bugChance(feat)) p.hiddenBugs++;
      var allDone=true; for(var f2=0;f2<p.features.length;f2++){ if(!p.features[f2].done) allDone=false; }
      if(allDone) p.phase="test";
      guard++;
    }
    if(p.phase==="test" && !S.skipWork){
      runTests(p.id);
      var g2=0;
      while(p.bugs.length && g2<20){ var b=p.bugs[0]; var oi=b.opts.findIndex(function(o){return o.ok;}); fixBug(p.id,b.id,oi<0?0:oi); g2++; }
      if(!p.bugs.length){ deliverProject(p.id); deliveries++; }
    }
  }
  while(S.energy<SESSION_COST && !S.skipWork && S.cash>50){ if(S.drinksToday<3) buyDrink(); else buyCoffee(); if(S.energy<20) break; }
  advanceDay();
  checkInvariants("day "+S.day); lastScanLen=S.clients.length;
  if(S.cash<-2000) break;
}
var diag=[];
(function(){
  var seen={};
  for(var i=0;i<S.clients.length;i++){
    var c=S.clients[i];
    if(seen[c.name]!==undefined){
      var first=S.clients[seen[c.name]];
      diag.push("DUP name="+c.name+" ids="+first.id+","+c.id+" companies="+first.company+","+c.company+" projects="+first.projects+","+c.projects+" history1="+first.history.join("|")+" history2="+c.history.join("|"));
    }
    if(seen[c.name]===undefined) seen[c.name]=i;
  }
})();
var snips=new Set(); for(var i2=0;i2<600;i2++) snips.add(makeSnippet());
JSON.stringify({
  days:S.day-startDay, accepted:accepted, projectsDone:S.projectsDone, deliveries:deliveries, sessions:sessions,
  cash:Math.round(S.cash), totalEarned:Math.round(S.totalEarned), rep:S.rep, repCount:S.repCount,
  clients:S.clients.length, offersOpen:S.offers.length, rank:RANKS[rankIndex()].name,
  snippets:"600 draws, "+snips.size+" unique",
  achievements:Object.keys(S.ach).length, invoicesPaid:S.invoices.filter(function(i){return i.status==="paid";}).length,
  invoicesWritten:S.invoices.filter(function(i){return i.status==="written";}).length,
  problems:problems.slice(0,10), problemCount:problems.length, diag:diag.slice(0,8)
});
'''

ctx = quickjs.Context()
res = ctx.eval(stubs + logic + sim)
print(res)
