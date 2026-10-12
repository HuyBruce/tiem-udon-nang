import fs from 'node:fs/promises';
import sharp from 'sharp';
const manifest = JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
const jobs = JSON.parse(await fs.readFile('assets/generation-jobs.json','utf8'));
for (const name of await fs.readdir('assets/jobs').catch(()=>[])) if(name.endsWith('-result.json')) jobs.push(JSON.parse((await fs.readFile('assets/jobs/'+name,'utf8')).replace(/^\uFEFF/,'')));
for (const job of jobs) {
  if (!job.source || manifest.assets[job.id]?.status === 'ready') continue;
  const transparent = job.kind !== 'backgrounds';
  await fs.mkdir(`assets/${job.kind}`,{recursive:true});
  const file = `${job.kind}/${job.id}.webp`;
  let pipeline = sharp(job.source);
  const original = await pipeline.metadata();
  if (transparent && !original.hasAlpha) { console.error(`${job.id}: missing alpha, skipped; needs regeneration`); continue; }
  if (job.kind === 'foreground') pipeline = pipeline.resize({width:1080,height:1920,fit:'inside',withoutEnlargement:true});
  else if (transparent) pipeline = pipeline.trim().resize({width:512,height:512,fit:'inside',withoutEnlargement:true});
  else pipeline = pipeline.resize({width:1024,withoutEnlargement:true});
  await pipeline.webp({quality:86,alphaQuality:100}).toFile(`assets/${file}`);
  const m = await sharp(`assets/${file}`).metadata();
  manifest.assets[job.id] = {file,width:m.width,height:m.height,transparent,anchor:transparent?[.5,1]:[0,0],status:'ready'};
  console.log(`${job.id}: ${m.width}x${m.height}`);
}
manifest.status='v2-approved-integration';
await fs.writeFile('assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
