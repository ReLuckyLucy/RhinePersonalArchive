import assert from 'node:assert/strict';
import {seedConfirmed} from '../helpers/seed.ts';
import {saveDossier} from '../../server/archive/repository.ts';
import {enqueueExtraction,runPendingJobs} from '../../server/sources/jobs.ts';

export async function run({page,baseURL,ctx}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const {dossier,source}=await seedConfirmed(ctx);
 const {revision,archivedAt,visitedAt,...input}=dossier;
 saveDossier(ctx,{...input,title:'面向复杂场景的个人档案与证明材料整理项目：长标题阅读检查',summary:'梳理项目背景与目标。\n\n负责合成项目开发与测试。',organization:'示例实验室',typedDetails:{technologies:['TypeScript','Three.js']}},revision);
 enqueueExtraction(ctx,source.id);await runPendingJobs(ctx,new AbortController().signal);
 await page.addInitScript(()=>sessionStorage.setItem('rhine:entered','1'));
 await page.goto(baseURL);await page.locator(`[data-dossier="${dossier.id}"]`).click();await page.locator('[data-read]').click();
 await page.locator('.detail-body h1').waitFor();
 assert.equal(await page.locator('.original-pane').isVisible(),false,'overview should not load an unrelated preview');
 assert.equal(await page.locator('.preview-body').count(),0);
 await page.getByRole('button',{name:'个人贡献',exact:true}).click();
 await page.locator('[data-proof]').first().click();
 await page.locator('.text-preview').waitFor();
 assert.equal(await page.locator('.original-pane').isVisible(),true,'proof opens its original in context');
 await page.getByRole('button',{name:'收起原件预览',exact:true}).click();
 assert.equal(await page.locator('.original-pane').isVisible(),false);
 assert.equal(await page.locator('[data-proof]').first().evaluate(el=>document.activeElement===el),true);
 await page.getByRole('button',{name:'证明材料',exact:true}).click();
 await page.locator('.text-preview').waitFor();
 await page.getByRole('button',{name:'概述',exact:true}).click();
 assert.equal(await page.locator('.original-pane').isVisible(),false);
 await page.waitForFunction(()=>document.querySelector('.wave-scene')?.dataset.ready==='true',null,{timeout:60000});
 await page.waitForFunction(()=>Number(document.querySelector('.wave-document').style.opacity)>.99,null,{timeout:15000});
 for(const theme of ['light','dark']){
  if(theme==='dark'){
   await page.getByRole('button',{name:'设置',exact:true}).click();
   await page.getByRole('button',{name:'切换明暗配色'}).click();
   await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  }
  for(const viewport of [{width:1440,height:900},{width:760,height:900},{width:390,height:844},{width:334,height:568}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(250);
   await page.locator('.wave-document').evaluate(el=>el.scrollTop=0);
   assert.equal(await page.locator('.wave-document').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
   await page.screenshot({path:`verification/private/screenshots/detail-${theme}-${viewport.width}.png`});
  }
 }
 assert.deepEqual(errors,[]);
}
