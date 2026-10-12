import fs from 'node:fs/promises';import {webkit,expect} from '@playwright/test';
import {Engine} from '../src/systems/engine.js';import {INGREDIENTS} from '../src/data.js';import {addStock} from '../src/systems/inventory.js';import {tapAction} from './ui-actions.mjs';import {validState} from '../src/systems/validation.js';
const output=process.env.GDW_TRAY_OUTPUT||'review/gdw/step1/e';await fs.mkdir(output,{recursive:true});
const e=new Engine();e.s.day=20;e.s.money=200000;e.s.upgrades.storage=3;e.s.inventory={};for(const id of Object.keys(INGREDIENTS))addStock(e.s,id,40);e.open();e.close();const c=e.s.customers[0];e.accept(c.id);
const advance=(seconds)=>{for(let t=0;t<seconds;t+=.25)e.tick(Math.min(.25,seconds-t));};
for(const id of ['dashi','dashi','soy','mirin'])e.brothAdd(id);e.brothCook();advance(7.2);e.burnerStep(0);e.burnerStep(0);advance(5.1);
for(let i=0;i<5;i++){expect(e.noodles(0,c.id)).toBe(true);advance(e.s.pots[0].duration+.2);e.liftNoodles(0);e.pour(0);e.topping(0,'onion');expect(e.tray(0)).toBe(true);}
e.drinkStart('tea');for(const a of ['tea','water','pour'])e.drinkStep(a);e.drinkChill();e.attachDrink(e.s.tray[0].id);expect(validState(e.s)).toBe(true);
const b=await webkit.launch();const reports=[];
try{for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[440,956],[412,915]]){
 const p=await b.newPage({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const errors=[];p.on('pageerror',x=>errors.push(x.message));await p.clock.install();
 await p.addInitScript(s=>localStorage.setItem('debug-udon-nang-v1',JSON.stringify({state:s})),e.s);await p.goto('http://localhost:5173/?debug=1');await p.addStyleTag({content:':root{--safe-top:47px;--safe-bottom:34px}.debug-tools,.clock-diagnostics{display:none!important}'});
 await tapAction(p,'start');await tapAction(p,'goto','guests0');await p.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
 await expect(p.locator('.food-trash')).toBeHidden();expect(await p.locator('.tray-slot.filled').count()).toBe(5);
 const tray=await p.locator('.wooden-tray').boundingBox(),slot=await p.locator('.tray-slot.filled').first().boundingBox(),bowl=await p.locator('.tray-slot.filled .food-layers').first().boundingBox();
 expect(tray.width).toBeGreaterThan(width*.93);expect(tray.height).toBeGreaterThanOrEqual(110);expect(tray.height).toBeLessThanOrEqual(130);expect(bowl.width/slot.width).toBeGreaterThanOrEqual(.85);
 const label=await p.locator('.tray-slot.filled .dish-name').first().boundingBox();expect(label.y+label.height).toBeLessThanOrEqual(bowl.y+1);
 await p.screenshot({path:`${output}/${width}x${height}-filled.png`});
 await tapAction(p,'dish',e.s.tray[0].id);await expect(p.locator('.food-trash')).toBeVisible();const trash=await p.locator('.food-trash').boundingBox();expect(trash.width).toBe(44);expect(trash.height).toBe(44);
 await p.screenshot({path:`${output}/${width}x${height}-selected.png`});
 await tapAction(p,'goto','drinks');const controls=await p.locator('.drink-workbench .work-controls button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));const drinksTrash=await p.locator('.food-trash').boundingBox();const drinksTray=await p.locator('.wooden-tray').boundingBox();for(const r of controls){expect(r.x < drinksTrash.x+drinksTrash.width && r.x+r.width > drinksTrash.x && r.y < drinksTrash.y+drinksTrash.height && r.y+r.height > drinksTrash.y).toBe(false);expect(r.y+r.height).toBeLessThanOrEqual(drinksTray.y);}await p.screenshot({path:`${output}/${width}x${height}-drink-controls.png`});await tapAction(p,'goto','guests0');
 const x=slot.x+slot.width/2,y=slot.y+slot.height/2;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+20,y-65,{steps:6});
 const picked=await p.locator('.tray-slot.filled .food-layers').first().boundingBox();
 const ghost=await p.locator('.drag-ghost').boundingBox();expect(ghost.width).toBeCloseTo(picked.width,0);expect(ghost.height).toBeCloseTo(picked.height,0);
 await p.screenshot({path:`${output}/${width}x${height}-ghost.png`});await p.mouse.up();await p.clock.runFor(80);
 // A deliberate trash action removes exactly one dish, never raw stock.
 if(!await p.locator('.food-trash').isVisible())await tapAction(p,'dish',e.s.tray[0].id);const stock=await p.evaluate(()=>JSON.parse(localStorage.getItem('debug-udon-nang-v1')).state.inventory);await tapAction(p,'work-trash');const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('debug-udon-nang-v1')).state);expect(saved.tray.length).toBe(4);expect(saved.inventory).toEqual(stock);expect(validState(saved)).toBe(true);
 // The trash must remain a drop target until pointerup has resolved the hitbox.
 const remaining=saved.tray[0].id;await tapAction(p,'dish',remaining);await tapAction(p,'dish',remaining);await expect(p.locator('.food-trash')).toBeHidden();
 const next=await p.locator(`[data-drag="dish:${remaining}"]`).boundingBox();await p.mouse.move(next.x+next.width/2,next.y+next.height/2);await p.mouse.down();await p.mouse.move(next.x+next.width/2,next.y-20,{steps:4});await expect(p.locator('.food-trash')).toBeVisible();await p.mouse.move(trash.x+trash.width/2,trash.y+trash.height/2,{steps:8});await p.mouse.up();await p.clock.runFor(100);expect((await p.evaluate(()=>JSON.parse(localStorage.getItem('debug-udon-nang-v1')).state)).tray.length).toBe(3);
 reports.push({width,height,tray,slot,bowl,label,trash,ghost});expect(errors).toEqual([]);await p.close();
}}finally{await b.close();}await fs.writeFile(`${output}/geometry.json`,JSON.stringify(reports,null,2));console.log('GDW tray: 6 WebKit sizes (including 320px), full tray, bowl >=85%, ghost parity, conditional trash, drink controls and stock PASS');
