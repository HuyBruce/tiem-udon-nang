import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
const groups=['noodles','broth','spice','veg','meat','tea','sweets'];
await fs.mkdir('review/gdv/step2/alpha',{recursive:true});
const inventory=[];
for(const [id,a]of Object.entries(manifest.assets).filter(([id])=>id.startsWith('gdv-'))){
 const file=`assets/${a.file}`,m=await sharp(file).metadata();
 assert.equal(m.width,a.width);assert.equal(m.height,a.height);
 if(a.transparent)assert.ok(m.hasAlpha);
 inventory.push({id,file,width:m.width,height:m.height,bytes:(await fs.stat(file)).size,alpha:m.hasAlpha,selected:id.startsWith('gdv-world-')||id.startsWith('gdv-fg-')||id.startsWith('gdv-pantry-')});
}
for(const [name,bg]of [['light','#fff4df'],['dark','#253c32']]){
 const composites=[];
 for(let i=0;i<groups.length;i++){
  const file=`assets/${manifest.assets[`gdv-pantry-${groups[i]}`].file}`;
  composites.push({input:await sharp(file).resize(64,64).png().toBuffer(),top:25,left:15+i*85});
 }
 await sharp({create:{width:groups.length*85+15,height:114,channels:3,background:bg}}).composite(composites).png().toFile(`review/gdv/step2/alpha/pantry-${name}.png`);
}
for(const room of ['front','seating','drinks','kitchen','storage','garden']){
 const a=manifest.assets[`gdv-fg-${room}`];
 const {data,info}=await sharp(`assets/${a.file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let n=0,opaque=0;
 for(let y=0;y<info.height;y++)for(let x=Math.round(info.width*.3);x<info.width*.7;x++){n++;if(data[(y*info.width+x)*4+3]>8)opaque++;}
 assert.ok(opaque/n<.001,`${room} center must be clear`);
}
await fs.writeFile('review/gdv/step2/art-inventory.json',JSON.stringify({inventory,selectedBytes:inventory.filter(a=>a.selected).reduce((n,a)=>n+a.bytes,0),alphaCenter:'central 40% <0.1% alpha>8',spriteQA:'64px on light/dark'},null,2));
console.log('PASS art dimensions, alpha and transparent centers; inventory and composites written.');
