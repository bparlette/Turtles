const fs=require('fs');const vm=require('vm');
function P(){const f=function(){return P()};return new Proxy(f,{get:(t,k)=>k===Symbol.toPrimitive?(()=>0):k==='length'?0:P(),apply:()=>P()});}
const out={};
for(let n=2;n<=15;n++){const src=fs.readFileSync(process.argv[2]+'/levels/level'+n+'.js','utf8');
 const win={};win.SS={api:P(),registerLevel:(d)=>{out[n]=d}};
 const ctx={window:win,Math,console,document:P(),Image:function(){},JSON,Object,Array,Set,Map,String,Number};
 try{vm.runInNewContext(src,ctx)}catch(e){console.log('ERR',n,e.message)}
 const d=out[n];if(!d){console.log(n,'no def');continue}
 console.log('L'+n,d.name,'boss:',d.boss&&Object.keys(d.boss).join(','),'final',!!d.final,'outro',!!d.outro);
 (d.sections||[]).forEach((s,i)=>console.log('  sec',i,JSON.stringify({bg:s.bg,len:s.length,auto:s.auto,arena:s.arena,locks:s.locks,waves:s.waves,floor:s.floor,haz:(s.hazards||[]).length,keys:Object.keys(s).join(',')})));
 console.log('  lvhaz',(d.hazards||[]).length, 'keys',Object.keys(d).join(','));
}
