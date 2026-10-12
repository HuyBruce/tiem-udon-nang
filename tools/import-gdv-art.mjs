import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Explicit inputs, repeatable imports; original generated files are retained.
const [source, id, kind = 'sprite'] = process.argv.slice(2);
if (!source || !/^[a-z0-9-]+$/.test(id) || !['background','foreground','sprite'].includes(kind))
  throw new Error('Usage: node tools/import-gdv-art.mjs SOURCE ID background|foreground|sprite');
const manifest = JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
const folder = kind === 'background' ? 'backgrounds' : kind === 'foreground' ? 'foreground' : 'sprites';
const width = kind === 'sprite' ? 128 : 1000;
const height = kind === 'sprite' ? 128 : 1778;
const file = `${folder}/${id}.webp`;
await fs.mkdir(`assets/${folder}`,{recursive:true});
const metadata = await sharp(source).metadata();
if (kind !== 'background' && !metadata.hasAlpha) throw new Error('Transparent art requires a real alpha channel');
await sharp(source).resize(width,height,{fit:kind==='sprite'?'contain':'fill',background:{r:0,g:0,b:0,alpha:0}})
  .webp({quality:88,alphaQuality:100,effort:6}).toFile(`assets/${file}`);
const {data,info} = await sharp(`assets/${file}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let clear=0; for(let i=3;i<data.length;i+=4) if(data[i]===0)clear++;
if(kind!=='background' && clear/(info.width*info.height)<0.1) throw new Error('Insufficient genuinely transparent pixels');
manifest.assets[id]={file,width,height,transparent:kind!=='background',anchor:kind==='sprite'?[0.5,1]:[0,0],status:'ready',provenance:'image_gen, GD-V'};
await fs.writeFile('assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({id,file,width,height,source,clearRatio:clear/(info.width*info.height),bytes:(await fs.stat(`assets/${file}`)).size}));
