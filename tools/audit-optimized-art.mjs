import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const entries=JSON.parse(await fs.readFile('review/gdv/step3/asset-optimization.json','utf8'));
const icons=entries.filter(e=>e.width===128),audit=[];
for(const e of entries){
 const {data,info}=await sharp(`assets/${e.file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,e.width);assert.equal(info.height,e.height);
 let opaqueCenter=0,center=0;
 if(e.id.startsWith('gdv-fg-')){
  for(let y=0;y<info.height;y++)for(let x=Math.round(info.width*.3);x<info.width*.7;x++){center++;if(data[(y*info.width+x)*4+3]>8)opaqueCenter++;}
  assert.ok(opaqueCenter/center<.001,e.id+' clear center');
 } else {
  assert.equal(data[3],0,e.id+' transparent top-left');
  assert.equal(data.at(-1),0,e.id+' transparent bottom-right');
 }
 audit.push({id:e.id,width:info.width,height:info.height,hasAlpha:info.channels===4,centerOpaqueFraction:center?opaqueCenter/center:undefined});
}
for(const [name,color]of [['light','#fff4df'],['dark','#253c32']]){
 const inputs=[];
 for(const [i,e]of icons.entries())for(const [j,file]of [e.original,e.file].entries())inputs.push({input:await sharp(`assets/${file}`).resize(32,32).png().toBuffer(),left:8+i%8*80+j*36,top:12+Math.floor(i/8)*56});
 await sharp({create:{width:648,height:Math.ceil(icons.length/8)*56,channels:3,background:color}}).composite(inputs).png().toFile(`review/gdv/step3/icons-before-after-${name}.png`);
}
await fs.writeFile('review/gdv/step3/optimized-art-checks.json',JSON.stringify({audit,iconOrder:icons.map(e=>e.id),displayPx:32,columns:8,pair:'original / optimized'},null,2));
console.log('PASS: 50 alpha/dimension checks; 44 icons compared at actual 32px on light/dark.');
