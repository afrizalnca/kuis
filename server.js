const fs=require("fs"),http=require("http"),path=require("path"),{WebSocketServer}=require("ws");
const PIN=process.env.GURU_PIN||"1234",PORT=process.env.PORT||3000,DB=path.join(__dirname,"data.json");
let bank=[{q:"1/2 + 1/4 = ...",o:["3/4","2/6","1/6","2/4"],a:0},{q:"Pecahan yang senilai dengan 2/3 adalah ...",o:["4/5","4/6","3/6","6/8"],a:1},{q:"Perangkat untuk mengetik pada komputer adalah ...",o:["mouse","keyboard","monitor","speaker"],a:1}],cfg={t:10,r:false};
try{const d=JSON.parse(fs.readFileSync(DB));if(d.bank&&d.cfg){bank=d.bank;cfg=d.cfg}}catch(e){}
const srv=http.createServer((q,r)=>{try{const h=fs.readFileSync(path.join(__dirname,"public","index.html"));r.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});r.end(h)}catch(e){r.writeHead(500);r.end("error")}});
const wss=new WebSocketServer({server:srv});
const P=new Map();let nid=1,G={phase:"lobby",st:"",qi:0,t:0,order:[]};
const tx=(w,o)=>{if(w.readyState===1)w.send(JSON.stringify(o))},all=o=>{const s=JSON.stringify(o);wss.clients.forEach(w=>{if(w.readyState===1)w.send(s)})};
const valid=b=>(Array.isArray(b)?b:[]).filter(x=>x&&String(x.q).trim()&&Array.isArray(x.o)&&x.o.length===4&&x.o.every(o=>String(o).trim())&&[0,1,2,3].includes(x.a)).map(x=>({q:String(x.q).slice(0,200),o:x.o.map(o=>String(o).slice(0,60)),a:x.a}));
const tile=p=>(p.z<0?0:2)+(p.x<0?0:1);
function sendQ(w){const x=G.order[G.qi],m={t:"q",i:G.qi,n:G.order.length,q:x.q,o:x.o,time:cfg.t,left:Math.ceil(G.t)};if(w)tx(w,m);else all(m)}
function reveal(){G.st="rev";G.t=3;const a=G.order[G.qi].a,res=[];
 P.forEach(p=>{if(p.guru)return;const ok=tile(p)===a;if(ok){p.s++;p.f++}else p.f=Math.max(1,p.f-1);res.push({i:p.id,ok,f:p.f,s:p.s})});
 all({t:"rev",a,res})}
function endGame(){G.phase="end";G.st="";const rank=[...P.values()].filter(p=>!p.guru).sort((a,b)=>b.f-a.f||b.s-a.s).slice(0,5).map(p=>({n:p.name,f:p.f,s:p.s}));all({t:"end",rank,n:G.order.length})}
function step(){if(G.st==="intro"){G.st="ask";G.t=cfg.t;sendQ()}else if(G.st==="ask")reveal();else{G.qi++;if(G.qi>=G.order.length)endGame();else{G.st="ask";G.t=cfg.t;sendQ()}}}
setInterval(()=>{if(G.phase==="play"){G.t-=.1;if(G.t<=0)step()}
 if(P.size)all({t:"snap",p:[...P.values()].map(p=>({i:p.id,n:p.name,x:+p.x.toFixed(2),z:+p.z.toFixed(2),g:p.guru?1:0}))})},100);
wss.on("connection",w=>{
 w.on("message",m=>{let d;try{d=JSON.parse(m)}catch(e){return}
  const p=P.get(w);
  if(d.t==="join"&&!p){const g=!!d.pin;if(g&&d.pin!==PIN){tx(w,{t:"err",m:"PIN salah"});return w.close()}
   const q={id:nid++,name:String(d.name||"Siswa").slice(0,12),guru:g,x:0,z:0,f:1,s:0};P.set(w,q);
   tx(w,{t:"hello",id:q.id,guru:g,bank:g?bank:undefined,cfg,phase:G.phase});
   if(G.phase==="play"&&G.st==="ask")sendQ(w);return}
  if(!p)return;
  if(d.t==="pos"){p.x=Math.max(-22,Math.min(22,+d.x||0));p.z=Math.max(-22,Math.min(22,+d.z||0))}
  else if(p.guru&&d.t==="save"&&G.phase!=="play"){const c=d.cfg||{};bank=valid(d.bank);cfg={t:Math.max(5,Math.min(60,+c.t||10)),r:!!c.r};fs.writeFile(DB,JSON.stringify({bank,cfg}),()=>{})}
  else if(p.guru&&d.t==="start"&&G.phase!=="play"){const b=valid(bank);if(!b.length)return;G.order=cfg.r?b.sort(()=>Math.random()-.5):b;G.phase="play";G.st="intro";G.qi=0;G.t=3;P.forEach(q=>{q.f=1;q.s=0});all({t:"start",n:G.order.length})}
  else if(p.guru&&d.t==="lobby"&&G.phase!=="play"){G.phase="lobby";all({t:"lobby"})}
 });
 w.on("close",()=>P.delete(w));
});
srv.listen(PORT,()=>console.log("Server berjalan di port "+PORT));
