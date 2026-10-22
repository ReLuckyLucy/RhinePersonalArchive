import assert from 'node:assert/strict';
import {saveDossier} from '../../server/archive/repository.ts';
export async function run({page,baseURL,ctx}){
 for(const title of ['收藏档案甲','收藏档案乙'])saveDossier(ctx,{kind:'project',title,aliases:[],dateRange:{start:{value:null,precision:'unknown'},end:{value:null,precision:'unknown'},ongoing:false},organization:'',role:'',summary:'',skills:[],typedDetails:{},favorite:true},null);
 await page.addInitScript(()=>{
  sessionStorage.setItem('rhine:entered','1');
  window.glCounts={created:0,lost:0};const seen=new WeakSet(),original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){const ctx=original.apply(this,args);if(ctx&&String(args[0]).startsWith('webgl')&&!seen.has(ctx)){seen.add(ctx);window.glCounts.created++;const get=ctx.getExtension.bind(ctx);ctx.getExtension=name=>{const ext=get(name);return name==='WEBGL_lose_context'&&ext?{loseContext(){window.glCounts.lost++;ext.loseContext();},restoreContext(){ext.restoreContext();}}:ext;};}return ctx;};
 });
 await page.goto(baseURL);await page.locator('[data-action=saved]').click();await page.locator('[data-dossier]').filter({hasText:'收藏档案甲'}).click();
 await page.getByRole('button',{name:'读取档案',exact:true}).click();await page.getByRole('button',{name:'取消收藏',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-action=saved] b').textContent==='01');
 assert.equal(await page.locator('.wave-stage').getAttribute('data-mode'),'archive','removing the open favorite must close its detail');
 assert.equal(await page.locator('[data-dossier]').filter({hasText:'收藏档案甲'}).count(),0);
 await page.getByRole('button',{name:'简历工作台',exact:true}).click();
 await page.route('**/archive-cassette.glb',async route=>{await new Promise(resolve=>setTimeout(resolve,2500));await route.continue().catch(()=>{});});
 await page.getByRole('button',{name:'个人档案',exact:true}).click();
 await page.locator('.wave-scene canvas').waitFor();await page.getByRole('button',{name:'简历工作台',exact:true}).click();
 const counts=await page.evaluate(()=>window.glCounts);
 assert.equal(counts.lost,counts.created,'all contexts must release immediately even while GLB loading is pending');
 await page.waitForTimeout(2700);assert.equal(await page.locator('canvas').count(),0,'late completion must not remount');
 await page.unroute('**/archive-cassette.glb');let fail=true;
 await page.route('**/archive-cassette.glb',route=>fail?route.fulfill({status:503,body:'Test loading failure'}):route.continue());
 await page.getByRole('button',{name:'个人档案',exact:true}).click();await page.getByRole('button',{name:'重新载入',exact:true}).waitFor();
 fail=false;await page.getByRole('button',{name:'重新载入',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.wave-scene')?.dataset.ready==='true',null,{timeout:60000});
 assert.equal(await page.locator('.wave-scene canvas').count(),1,'retry creates exactly one live canvas');
}
