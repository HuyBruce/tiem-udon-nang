// One-time, lossless catalog migration. Does not read or change player saves.
import fs from 'node:fs/promises';
import * as catalog from '../src/data.js';
const files={INGREDIENTS:'ingredients',RECIPES:'recipes',DRINKS:'drinks',CUSTOMERS:'customers',EVENTS:'events',DECOR:'decor',EMPLOYEES:'staff',PLANTS:'plants',UPGRADES:'upgrades',RIDDLES:'riddles',SEASONS:'seasons'};
await fs.mkdir('data',{recursive:true});await fs.mkdir('config',{recursive:true});
let entry='// Stable exports retained for save compatibility; content lives in data/*.json.\n';
const balance={clock:{morningMinute:510,openingMinute:600,minutesPerSecond:1,eveningMinute:1080},billing:{utilitiesEvery:7,utilitiesPerDay:80,wagesEvery:30},prices:{},staff:{},ingredients:{},upgrades:{},plants:{},customers:{},cooking:{noodleSeconds:9,stoveReduction:2,powerNoodleSeconds:16,liftWindowSeconds:5,waterSeconds:5,brothSeconds:7,brothServings:5,fryMinSeconds:5,fryMaxSeconds:12},pendingDecisions:{eggPreparation:'morning-only',tastePerVisit:true}};
const numeric={INGREDIENTS:['cost','life'],RECIPES:['price','unlock'],DRINKS:['price'],CUSTOMERS:['patience','tip'],EMPLOYEES:['cost','wage'],UPGRADES:['base','max'],PLANTS:['cost','days','yield','level'],DECOR:['cost','bonus']};
const group={INGREDIENTS:'ingredients',RECIPES:'recipes',DRINKS:'drinks',CUSTOMERS:'customers',EMPLOYEES:'staff',UPGRADES:'upgrades',PLANTS:'plants',DECOR:'decor'};
for(const [key,file]of Object.entries(files)){
 const value=structuredClone(catalog[key]);
 if(!value)throw Error('Missing catalog '+key);
 if(numeric[key]){
  balance.prices[group[key]]={};
  for(const [id,item]of Object.entries(value)){
   const actualId=Array.isArray(value)?item.id:id;
   balance.prices[group[key]][actualId]={};
   for(const prop of numeric[key])if(typeof item[prop]==='number'){balance.prices[group[key]][actualId][prop]=item[prop];delete item[prop]}
  }
 }
 await fs.writeFile(`data/${file}.json`,JSON.stringify(value,null,2)+'\n');
 entry+=`import ${key}_DATA from "../data/${file}.json" with { type: "json" };\n`;
}
entry+='import BALANCE from "../config/balance.json" with { type: "json" };\n';
for(const key of Object.keys(files)){
 const type=group[key];
 entry+=`export const ${key} = ${numeric[key]?Array.isArray(catalog[key])?`${key}_DATA.map(item=>({...item,...BALANCE.prices.${type}[item.id]}))`:`Object.fromEntries(Object.entries(${key}_DATA).map(([id,item])=>[id,{...item,...BALANCE.prices.${type}[id]}]))`:`${key}_DATA`};\n`;
}
await fs.writeFile('config/balance.json',JSON.stringify(balance,null,2)+'\n');
await fs.writeFile('src/data.js',entry);
console.log('Catalog migrated without changing exported values or IDs.');
