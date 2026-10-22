import {saveDossier} from '../../server/archive/repository.ts';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {seedConfirmed} from '../helpers/seed.ts';
import {withdrawFact} from '../../server/archive/facts.ts';
import {saveResumeDraft} from '../../server/resume/service.ts';
import {importCatalog,importFiles} from '../../server/sources/import.ts';
import {enqueueExtraction,runPendingJobs} from '../../server/sources/jobs.ts';

export async function run({page,baseURL,ctx}) {
 page.setDefaultTimeout(4000);const failures=[];const check=async(name,fn)=>{try{await fn();console.log('PASS regression:',name);}catch(e){failures.push(name+': '+e.message);}};
 await page.addInitScript(()=>sessionStorage.setItem('rhine:entered','1'));
 const {fact,dossier,source}=await seedConfirmed(ctx);
 const draft=saveResumeDraft(ctx,{roleTitle:'可继续的草稿',jobDescription:'',profileSelection:['name'],sections:[{title:'项目经历',factIds:[fact.id]}],selectedFactRevisions:{[fact.id]:fact.revision},editedText:{},targetPages:1},null);
 withdrawFact(ctx,fact.id,fact.revision);
 await check('remove withdrawn selection',async()=>{
  await page.goto(baseURL);await page.getByRole('button',{name:'简历工作台',exact:true}).click();await page.locator('[data-draft]').filter({hasText:'可继续的草稿'}).click();
  const box=page.locator(`[data-select="${fact.id}"]`);await box.waitFor();assert.equal(await box.isEnabled(),true);await box.uncheck();await page.getByRole('button',{name:'保存并预览',exact:true}).click();await page.getByText('草稿已保存',{exact:true}).waitFor();
  assert.equal(JSON.parse(ctx.db.prepare('SELECT data FROM resume_drafts WHERE id=?').get(draft.id).data).sections.flatMap(s=>s.factIds).length,0);await page.getByRole('button',{name:'核对原事实 ↗'}).click();await page.locator(`[data-fact-id="${fact.id}"]`).waitFor();
 });
 await writeFile(join(ctx.libraryRoot,source.relativePath),'新版证明不可冒充旧版');await writeFile(join(ctx.libraryRoot,'version-catalog.json'),JSON.stringify([{id:'version',archiveRel:source.relativePath,subject:'待整理材料',category:'待整理'}]));await importCatalog(ctx,'version-catalog.json');enqueueExtraction(ctx,source.id);await runPendingJobs(ctx,new AbortController().signal);
 await check('proof pins source version',async()=>{
  await page.goto(baseURL);await page.getByRole('button',{name:'个人档案',exact:true}).click();await page.locator(`[data-dossier="${dossier.id}"]`).click();await page.locator('[data-read]').click();await page.getByRole('button',{name:'个人贡献',exact:true}).click();const requests=[];const listener=req=>requests.push(req.url());page.on('request',listener);
  try{await page.locator('[data-proof]').first().click();await page.waitForTimeout(300);assert.ok(requests.some(url=>url.includes(`/sources/${source.id}/`)&&url.includes('version=1')),'must request v1');await page.getByText(/该证明版本已不可用/).waitFor({timeout:1500});assert.equal(await page.locator('.preview-body').getByText('新版证明不可冒充旧版',{exact:true}).count(),0);}finally{page.off('request',listener);}
 });
 await check('fact result focuses exact fact',async()=>{
  await page.goto(baseURL);await page.keyboard.press('/');await page.getByRole('searchbox').fill('负责合成项目开发与测试');await page.getByRole('option').filter({hasText:'个人事实'}).first().click();await page.getByRole('button',{name:'个人贡献',exact:true}).waitFor();assert.equal(await page.locator('[data-tab="facts"]').first().getAttribute('aria-current'),'true');assert.equal(await page.locator(`[data-fact-id="${fact.id}"]`).evaluate(el=>document.activeElement===el),true);
 });
 async function* inputs(){yield{name:'paragraphs.txt',stream:[Buffer.from('首段文字\n\n定位专用第二段\n\n结束段落')]};}const imported=await importFiles(ctx,inputs());enqueueExtraction(ctx,imported.sourceIds[0]);await runPendingJobs(ctx,new AbortController().signal);
 await check('source result locates text paragraph',async()=>{
  await page.goto(baseURL);await page.keyboard.press('/');await page.getByRole('searchbox').fill('定位专用第二段');await page.getByRole('option').filter({hasText:'原始材料'}).first().click();const target=page.locator('[data-paragraph="2"]');await target.waitFor({timeout:1500});assert.equal(await target.evaluate(el=>el.classList.contains('located')),true);
 });
 await check('search return retains filters pagination and scroll',async()=>{
  for(let i=0;i<45;i++)saveDossier(ctx,{kind:'project',title:'返回测试 '+String(i).padStart(2,'0'),aliases:[],organization:'',role:'',summary:'',skills:[],typedDetails:{},favorite:false,dateRange:{start:{value:'2024',precision:'year'},end:{value:null,precision:'unknown'},ongoing:false}},null);
  await page.goto(baseURL);await page.keyboard.press('/');await page.getByRole('searchbox').fill('返回测试');await page.getByLabel('检索分类',{exact:true}).selectOption('project');await page.getByLabel('检索确认状态',{exact:true}).selectOption('draft');await page.getByLabel('发生时间从',{exact:true}).fill('2024');await page.getByLabel('发生时间从',{exact:true}).press('Tab');await page.getByLabel('发生时间到',{exact:true}).fill('2024-12');await page.getByLabel('发生时间到',{exact:true}).press('Tab');await page.getByRole('option').nth(29).waitFor();await page.locator('[data-more]').click();await page.getByRole('option').nth(44).waitFor();await page.getByRole('option').nth(35).scrollIntoViewIfNeeded();const before=await page.locator('.search-results').evaluate(e=>e.scrollTop);assert.ok(before>0);await page.getByRole('option').nth(35).click();await page.getByRole('button',{name:'返回档案目录',exact:true}).click();await page.keyboard.press('/');await page.getByRole('option').nth(44).waitFor();assert.equal(await page.getByRole('searchbox').inputValue(),'返回测试');assert.equal(await page.getByLabel('检索分类',{exact:true}).inputValue(),'project');assert.equal(await page.getByLabel('检索确认状态',{exact:true}).inputValue(),'draft');assert.equal(await page.getByLabel('发生时间从',{exact:true}).inputValue(),'2024');assert.equal(await page.getByLabel('发生时间到',{exact:true}).inputValue(),'2024-12');assert.ok(await page.locator('.search-results').evaluate(e=>e.scrollTop)>0);
 });
 assert.deepEqual(failures,[]);
}
