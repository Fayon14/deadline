import quickjs
logic = "\n".join(open(f'part{i}.js').read() for i in (2,3))
stubs = r'''
var _fakeEl=function(){return {style:{},dataset:{},classList:{add:function(){},remove:function(){},toggle:function(){},contains:function(){return false}},innerHTML:"",textContent:"",value:"",appendChild:function(){},addEventListener:function(){},onclick:null,getContext:function(){return {}}}};
var document={querySelector:function(){return _fakeEl();},querySelectorAll:function(){return [];},addEventListener:function(){},createElement:function(){return _fakeEl();}};
var window={addEventListener:function(){}};
var localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
var setTimeout=function(){};
'''
test = r'''
S=freshState();
for(var i=0;i<300;i++) makeClient();
var names={}, dups=[];
for(var j=0;j<S.clients.length;j++){ var n=S.clients[j].name; if(names[n]) dups.push(n); names[n]=1; }
var cos={}, dups2=[];
for(var k=0;k<S.clients.length;k++){ var c=S.clients[k].company; if(cos[c]) dups2.push(c); cos[c]=1; }
JSON.stringify({clients:S.clients.length, dupNames:dups.slice(0,5), dupCompanies:dups2.slice(0,5)});
'''
ctx=quickjs.Context()
print(ctx.eval(stubs+logic+test))
