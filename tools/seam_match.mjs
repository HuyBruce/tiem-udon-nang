import fs from 'node:fs/promises';
import sharp from 'sharp';
import world from '../layouts/world.json' with {type:'json'};

const rooms=world.order;
const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
const W=1000,H=1778,edge=40;
const images=[];
for(const room of rooms){
  const layout=JSON.parse(await fs.readFile(`layouts/${room}.json`,'utf8'));
  const previous=manifest.assets[layout.background]?.sourceId || layout.background;
  const asset=manifest.assets[previous];
  const input=await sharp(`assets/${asset.file}`).resize(W,H).removeAlpha().raw().toBuffer();
  const source=world.composition.sourceByRoom?.[room]||world.composition.source;
  const target=world.composition.target;
  let pixels=input;
  if(room!=='garden' && asset.composition!=='world-baked'){
    const parts=[];
    for(let i=0;i<source.length-1;i++){
      const top=Math.round(source[i]*H/100),end=Math.round(source[i+1]*H/100);
      const outTop=Math.round(target[i]*H/100),outEnd=Math.round(target[i+1]*H/100);
      parts.push({input:await sharp(input,{raw:{width:W,height:H,channels:3}}).extract({left:0,top,width:W,height:end-top}).resize(W,outEnd-outTop).png().toBuffer(),left:0,top:outTop});
    }
    pixels=await sharp({create:{width:W,height:H,channels:3,background:'#f5ebdd'}}).composite(parts).removeAlpha().raw().toBuffer();
  }
  images.push({room,pixels,original:Buffer.from(pixels),previous,layout});
}
// Share only the 4% edge. The rest of each painting is byte-for-byte untouched.
// Also match repeated guest pages; use one shared guest border on both sides.
const profiles=[];
for(let i=0;i<images.length-1;i++){
  const a=images[i].original,b=images[i+1].original,profile=Buffer.alloc(H*3);
  for(let y=0;y<H;y++)for(let c=0;c<3;c++){
    let sum=0;for(let x=0;x<10;x++)sum+=a[(y*W+W-1-x)*3+c]+b[(y*W+x)*3+c];
    profile[y*3+c]=Math.round(sum/20);
  }
  profiles.push(profile);
}
// Repeated seating pages must meet the same border on either side.
for(let y=0;y<H;y++)for(let c=0;c<3;c++){
  const v=Math.round((profiles[0][y*3+c]+profiles[1][y*3+c])/2);
  profiles[0][y*3+c]=profiles[1][y*3+c]=v;
}
for(let i=0;i<profiles.length;i++)for(let y=0;y<H;y++)for(let x=0;x<edge;x++)for(let c=0;c<3;c++){
  const weight=(1-x/(edge-1))**2;
  for(const [image,col] of [[images[i],W-1-x],[images[i+1],x]]){
    const p=(y*W+col)*3+c;
    image.pixels[p]=Math.round(image.original[p]*(1-weight)+profiles[i][y*3+c]*weight);
  }
}
await fs.mkdir('review/gdv/seams',{recursive:true});
for(const image of images){
  const id=`gdv-world-${image.room}`,file=`backgrounds/${id}.webp`;
  await sharp(image.pixels,{raw:{width:W,height:H,channels:3}}).webp({quality:90,effort:6}).toFile(`assets/${file}`);
  manifest.assets[id]={file,width:W,height:H,transparent:false,anchor:[0,0],status:'ready',sourceId:image.previous,composition:image.room==='garden'?'field':'world-baked',provenance:`GD-V, source ${image.previous}, localized 4% seam match`};
  image.layout.background=id;
  await fs.writeFile(`layouts/${image.room}.json`,JSON.stringify(image.layout,null,2)+'\n');
}
await fs.writeFile('assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile('review/gdv/seams/processing.json',JSON.stringify({width:W,height:H,edgePercent:4,source:images.map(({room,previous})=>({room,previous})),projection:world.composition.target},null,2));
console.log('Baked world bands; matched six-room edges and repeated seating border, localized 4% only.');
