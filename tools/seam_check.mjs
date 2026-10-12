import fs from 'node:fs/promises';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {deltaE} from './seam-color.mjs';
import world from '../layouts/world.json' with {type:'json'};
import manifest from '../assets/manifest.json' with {type:'json'};
const meanLimit=3,p95Limit=8;
const rooms=world.order,images=[];
for(const room of rooms){
 const l=JSON.parse(await fs.readFile(`layouts/${room}.json`,'utf8'));
 const file=`assets/${manifest.assets[l.background].file}`;
 const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
 images.push({room,file,data,info});
}
const pairs=images.slice(0,-1).map((a,i)=>[a,images[i+1]]);
pairs.push([images[1],images[1]]);
const results=[];
for(const [a,b]of pairs){
 assert.equal(a.info.height,b.info.height);
 const values=[];
 for(let y=0;y<a.info.height;y++){
  const x=(y*a.info.width+a.info.width-1)*3,z=y*b.info.width*3;
  values.push(deltaE([...a.data.subarray(x,x+3)],[...b.data.subarray(z,z+3)]));
 }
 values.sort((a,b)=>a-b);
 const mean=values.reduce((a,b)=>a+b)/values.length,p95=values[Math.floor(values.length*.95)];
 const file=`review/gdv/seams/${a.room}-${b.room}.png`;
 await sharp({create:{width:780,height:694,channels:3,background:'#f5ebdd'}}).composite([
  {input:await sharp(a.file).resize(390,694).png().toBuffer(),left:0,top:0},
  {input:await sharp(b.file).resize(390,694).png().toBuffer(),left:390,top:0}
 ]).png().toFile(file);
 results.push({pair:`${a.room}-${b.room}`,mean,p95,file,pass:mean<=meanLimit&&p95<=p95Limit});
}
await fs.writeFile('review/gdv/seams/checks.json',JSON.stringify({method:'CIE76 D65, actual compressed WebP border columns',meanLimit,p95Limit,results},null,2));
console.log(JSON.stringify(results,null,2));
assert.ok(results.every(r=>r.pass),'Compressed borders exceed Delta E limits');
