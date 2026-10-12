import fs from 'node:fs/promises';
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const write=(p,v)=>fs.writeFile(p,JSON.stringify(v,null,2)+'\n');
const zones={hud:[0,8],wall:[8,42],counter:[42,59],fascia:[59,70],tray:[70,100]};
for(const id of ['front','guests','drinks','kitchen','storage','garden']) {
 const p=`layouts/${id}.json`,l=await read(p);
 if(!l.artVersion)await write(`layouts/${id}.v1-backup.json`,l);
 l.artVersion=2;l.status='v2-integration';l.zones=zones;l.background=id==='guests'?'v2-seating':'v2-'+id;l.foreground=id==='guests'?'v2-foliage':'v2-fg-'+id;
 for(const x of l.layers) {
  const newId={'sample_kettle':'v2-kettle',owner:'v2-owner'}[x.asset]||'v2-'+x.asset;
  if(!['flowers','stool'].includes(x.asset))x.asset=newId;
 }
 if(id==='front') {l.sign={x:25,y:8,width:50,height:5};l.noren={x:19,y:16,width:64,height:9};l.layers[0]={...l.layers[0],x:50,y:59,width:38,height:32};for(const x of l.layers.slice(1)){x.y=57;x.height=14;}l.hotspots=[{x:30,y:28,width:40,height:31,action:'enter-shop',label:'Bước vào tiệm'}];}
 if(id==='guests'){l.layers=[];l.seats=[{x:16,y:26,width:30,height:30},{x:54,y:26,width:30,height:30}];l.decoration={...l.decoration,x:91,y:54,width:12,height:12};}
 if(id==='kitchen') {
 const xy=[[21,48,25,17],[58,27,11,10],[74,27,11,10],[80,48,27,15],[63,58,22,10],[86,58,21,12]];
 l.layers.forEach((x,i)=>{[x.x,x.y,x.width,x.height]=xy[i]});l.noodles={x:36,y:37,width:22,height:11};l.pots={x:13,y:48,width:25,height:10};l.multiplePots={x:10,y:48,width:43,height:10};}
 if(id==='drinks'){
 const xy=[[22,49,27,26],[18,21,11,10],[34,21,11,10],[50,50,24,16],[76,51,24,13],[87,46,10,15],[84,59,12,12],[42,59,12,12],[64,59,13,12]];
 l.layers.forEach((x,i)=>{[x.x,x.y,x.width,x.height]=xy[i]});}
 if(id==='storage')for(const x of l.layers){if(x.asset==='v2-fridge'){x.asset='v2-pantry-fridge';x.x=80;x.y=57;x.width=28;x.height=24;}if(x.asset==='v2-crate'){x.x=32;x.y=56;x.width=35;x.height=18;}}
 if(id==='garden'){l.layers[0]={...l.layers[0],x:83,y:56,width:23,height:17};l.plots={x:22,y:56,width:48,height:17,span:44,anchor:[.5,1],z:3};}
 await write(p,l);
}
console.log('V2 layouts integrated.');
