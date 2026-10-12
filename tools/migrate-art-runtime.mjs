import fs from 'node:fs/promises';
import {ingredientArt,bowl} from '../src/ui/food-art.js';
import {icon,person,foodIcon} from '../src/ui/art.js';
import {CUSTOMERS,EMPLOYEES,INGREDIENTS} from '../src/data.js';
await fs.mkdir('tools/legacy-art',{recursive:true});
await fs.mkdir('assets/legacy',{recursive:true});
// Keep original sources solely as an offline migration reference.
for(const f of ['art.js','food-art.js']) await fs.copyFile('src/ui/'+f,'tools/legacy-art/'+f);
const manifest=JSON.parse(await fs.readFile('assets/manifest.json','utf8'));
async function write(id,svg,width,height){
  const file=`legacy/${id}.svg`;
  await fs.writeFile('assets/'+file,svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
  manifest.assets[id]={file,width,height,transparent:true,anchor:[.5,1],status:'legacy-export'};
}
for(const c of [...CUSTOMERS,...Object.entries(EMPLOYEES).map(([id,c])=>({...c,id}))])
  for(const happy of [true,false]) await write(`character-${c.id}${happy?'':'-sad'}`,`<svg viewBox="0 0 120 200">${person({...c,happy})}</svg>`,120,200);
for(const id of new Set([...Object.keys(INGREDIENTS),'tempura'])) await write('ingredient-'+id,foodIcon(id),60,45);
for(const [id,d] of Object.entries({empty:{empty:true},noodles:{},soup:{poured:true},miso:{poured:true,broth:['miso']},curry:{poured:true,broth:['curry']}})) await write('bowl-'+id,bowl(d),160,110);
for(const id of ['egg','beef','tofu','seaweed','onion','tempura']) await write('topping-'+id,`<svg viewBox="0 0 160 110">${ingredientArt(id,80,43)}</svg>`,160,110);
await fs.writeFile('assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');
const original=await fs.readFile('src/ui/art.js','utf8');
const icons=original.slice(original.indexOf('export const icon ='),original.indexOf('const defs ='));
await fs.writeFile('src/ui/art.js',`// UI icons remain vectors; scene and food art load from asset files.\nimport {sceneImage,sprite} from './assets.js';\nexport {bowl} from './food-art.js';\n${icons}\nexport const sceneArt = sceneImage;\nexport const person = (c={}) => sprite('character-'+(c.personId || c.id || 'mai')+(c.happy===false?'-sad':''),'','character-art');\nexport const portrait = c => '<span class="portrait-art">'+person(c)+'</span>';\nexport const foodIcon = id => sprite(id==='noodles'?'noodles':'ingredient-'+id,'','food-icon');\n`);
await fs.writeFile('src/ui/food-art.js',`import {sprite} from './assets.js';\nexport function bowl(dish={},color='',small=false){\n const base=dish.empty?'bowl-empty':!dish.poured?'bowl-noodles':dish.broth?.includes('curry')?'bowl-curry':dish.broth?.includes('miso')?'bowl-miso':'bowl-soup';\n return '<span class="bowl-art food-layers">'+sprite(base)+(dish.empty?'':(dish.tops||[]).map((id,i)=>'<span class="food-topping" style="transform:translate('+([-18,15,0,-10,20,3][i%6])+'%,'+([-4,0,9,9,7,-8][i%6])+'%)">'+sprite('topping-'+id)+'</span>').join(''))+'</span>';\n}\n`);
let main=await fs.readFile('src/main.js','utf8');
main=main.replace('import { artPreview, sceneHotspots }','import { artPreview, sceneHotspots, sprite, layoutFor }');
main=main.replaceAll('<svg viewBox="0 0 120 195">${person(c)}</svg>','${person(c)}');
main=main.replace('<svg viewBox="0 0 120 195">${person({ ...EMPLOYEES[id], id, hair: "#584a3e" })}</svg>','${person({ ...EMPLOYEES[id], id, hair: "#584a3e" })}');
main=main.replace('${sceneControls()}${staffVisual()}','${sceneControls()}');
main=main.replace('class="noodle-basket ${ui.noodleSelected ? "selected" : ""}"','class="noodle-basket ${ui.noodleSelected ? "selected" : ""}" style="${boxStyle(layoutFor("kitchen").noodles)}"');
main=main.replace('class="pots ${s.upgrades.stove ? "multiple" : ""}"','class="pots ${s.upgrades.stove ? "multiple" : ""}" style="${boxStyle(s.upgrades.stove?layoutFor("kitchen").multiplePots:layoutFor("kitchen").pots)}"');
main=main.replace(': p ? \'<span class="mini-steam">∿ ∿ ∿</span>\' : ""}', ': sprite("noodle-pot", "", "pot-sprite")}');
main=main.replace('function sceneControls() {','function boxStyle(b) { return `left:${b.x}%;top:${b.y}%;width:${b.width}%;height:${b.height}%`; }\nfunction sceneControls() {');
await fs.writeFile('src/main.js',main);
