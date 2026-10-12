import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='C:/Users/Legion/.codex/generated_images/01a0ecda-18d8-7e20-8933-f8408dea965c';
const jobs=JSON.parse(await fs.readFile('assets/generation-jobs.json','utf8'));
const known=new Set(jobs.map(j=>j.source?.split(/[\\/]/).at(-1)));
const names=(await fs.readdir(dir)).filter(n=>n.endsWith('.png')&&!known.has(n));
const images=[];
for(let i=0;i<names.length;i++){
 const input=await sharp(dir+'/'+names[i]).resize(180,220,{fit:'contain',background:'#eee3cc'}).png().toBuffer();
 images.push({input,left:(i%5)*200,top:Math.floor(i/5)*250});
 images.push({input:Buffer.from(`<svg width="200" height="25"><text x="5" y="18" font-size="16">${i}</text></svg>`),left:(i%5)*200,top:Math.floor(i/5)*250+220});
}
await sharp({create:{width:1000,height:Math.ceil(names.length/5)*250,channels:4,background:'#eee3cc'}}).composite(images).png().toFile('docs/review/recovered-assets.png');
await fs.writeFile('docs/review/recovered-paths.json',JSON.stringify(names.map((n,i)=>({i,source:dir+'/'+n})),null,2));
console.log(names.length+' unregistered images');
