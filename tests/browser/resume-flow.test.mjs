import assert from 'node:assert/strict';
import {seedConfirmed} from '../helpers/seed.ts';
import {saveDossier} from '../../server/archive/repository.ts';
import {withdrawFact} from '../../server/archive/facts.ts';

export async function run({page,baseURL,ctx}){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const {fact}=await seedConfirmed(ctx),unknown={value:null,precision:'unknown'};
 saveDossier(ctx,{kind:'education',title:'合成教育档案',aliases:[],dateRange:{start:unknown,end:unknown,ongoing:false},organization:'',role:'',summary:'',skills:[],typedDetails:{},favorite:false},null);
 await page.addInitScript(()=>{sessionStorage.setItem('rhine:entered','1');localStorage.setItem('rhine:last-page','resume');});
 await page.goto(baseURL);await page.getByRole('button',{name:'简历工作台',exact:true}).click();await page.getByRole('button',{name:'新建简历',exact:true}).click();
 const stages=page.getByRole('navigation',{name:'简历制作步骤'});
 await stages.waitFor({timeout:2000});
 const actions=page.getByRole('region',{name:'简历操作'});
 for(const name of ['保存并预览','保存为版本','导出 PDF','导出 Word'])assert.equal(await actions.getByRole('button',{name,exact:true}).isVisible(),true);
 await page.getByText('选择内容后点击“保存并预览”，这里会显示已保存草稿。',{exact:true}).waitFor();
 const empty=page.locator('.resume-section').filter({hasText:'教育背景'}).locator('details');assert.equal(await empty.evaluate(el=>el.open),false);
 await page.getByLabel('目标岗位',{exact:true}).fill('第一份岗位');
 await page.getByLabel('选择事实：'+fact.text,{exact:true}).check();
 await stages.getByRole('button',{name:'编辑与预览'}).click();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'第一份岗位');
 const downloadWord=async()=>{const received=page.waitForEvent('download');await actions.getByRole('button',{name:'导出 Word',exact:true}).click();assert.match((await received).suggestedFilename(),/\.docx$/);};
 const exports=()=>ctx.db.prepare('SELECT data FROM exports ORDER BY rowid').all().map(row=>JSON.parse(row.data));
 const version=id=>JSON.parse(ctx.db.prepare('SELECT data FROM resume_versions WHERE id=?').get(id).data);
 await downloadWord();const first=exports().at(-1).versionId;assert.equal(version(first).roleTitle,'第一份岗位');
 await page.getByLabel('目标岗位',{exact:true}).fill('第二份岗位');
 await page.getByText('预览未更新，请保存并预览。',{exact:true}).waitFor();
 await downloadWord();const second=exports().at(-1).versionId;assert.notEqual(second,first);assert.equal(version(second).roleTitle,'第二份岗位');assert.equal(version(first).roleTitle,'第一份岗位');
 await page.getByRole('button',{name:'历史版本',exact:true}).click();await page.locator(`[data-version="${first}"]`).click();
 await page.locator('[data-export-target]').getByText(/历史版本.*第一份岗位/).waitFor();
 await downloadWord();assert.equal(exports().at(-1).versionId,first,'history export must retain the explicitly selected version');
 await page.getByRole('button',{name:'返回当前草稿',exact:true}).click();assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'第二份岗位');
 await actions.getByRole('button',{name:'保存并预览',exact:true}).click();await page.getByText('草稿已保存',{exact:true}).waitFor();
 await page.route('**/api/resume-drafts',route=>route.request().method()==='POST'?route.fulfill({status:503,json:{ok:false,error:{message:'合成保存故障'}}}):route.continue());
 await page.getByLabel('目标岗位',{exact:true}).fill('保留失败后的输入');await actions.getByRole('button',{name:'保存并预览',exact:true}).click();
 await page.getByText(/合成保存故障/).waitFor();assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'保留失败后的输入');assert.equal(await actions.getByRole('button',{name:'导出 PDF',exact:true}).isEnabled(),true);
 await page.unroute('**/api/resume-drafts');
 let release,started;const gate=new Promise(resolve=>release=resolve),received=new Promise(resolve=>started=resolve);
 await page.route('**/api/resume-drafts',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();started();await gate;await route.fulfill({response});});
 const before=ctx.db.prepare('SELECT count(*) n FROM resume_versions').get().n;
 await actions.getByRole('button',{name:'导出 PDF',exact:true}).click();await received;
 await page.getByLabel('目标岗位',{exact:true}).fill('保存途中继续输入');release();
 await page.getByText('保存期间内容已改变，请再次保存后导出。',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'保存途中继续输入');assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_versions').get().n,before);
 await page.unroute('**/api/resume-drafts');
 // A save which commits while the editor is suspended must carry its new revision back.
 let releaseSave,saveStarted;const saveGate=new Promise(resolve=>releaseSave=resolve),saving=new Promise(resolve=>saveStarted=resolve);
 await page.route('**/api/resume-drafts',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();saveStarted();await saveGate;await route.fulfill({response});});
 await actions.getByRole('button',{name:'保存并预览',exact:true}).click();await saving;
 await page.getByLabel('目标岗位',{exact:true}).fill('离开时未保存的输入');await page.getByRole('button',{name:'待整理',exact:true}).click();await page.getByRole('button',{name:'简历工作台',exact:true}).click();
 await page.getByText('正在完成上次保存，未保存输入会继续保留…',{exact:true}).waitFor();releaseSave();
 await page.getByLabel('目标岗位',{exact:true}).waitFor();assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'离开时未保存的输入');
 await page.unroute('**/api/resume-drafts');await actions.getByRole('button',{name:'保存并预览',exact:true}).click();await page.getByText('草稿已保存',{exact:true}).waitFor();
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_drafts').get().n,1);
 assert.equal(JSON.parse(ctx.db.prepare('SELECT data FROM resume_drafts').get().data).roleTitle,'离开时未保存的输入');
 // A late historical preview cannot replace the intent established by further typing.
 await page.getByRole('button',{name:'历史版本',exact:true}).click();
 let releaseHistory,historyStarted;const historyGate=new Promise(resolve=>releaseHistory=resolve),historyReceived=new Promise(resolve=>historyStarted=resolve);
 await page.route(`**/api/resume-versions/${first}`,async route=>{const response=await route.fetch();historyStarted();await historyGate;await route.fulfill({response});});
 await page.locator(`[data-version="${first}"]`).click();await historyReceived;await page.getByLabel('目标岗位',{exact:true}).fill('保留当前草稿意图');releaseHistory();
 await page.waitForTimeout(100);assert.equal(await page.locator('[data-export-target]').innerText(),'当前草稿');
 await page.unroute(`**/api/resume-versions/${first}`);
 // Export transport failures leave the validated version and inputs available for retry.
 await page.route('**/api/exports',route=>route.fulfill({status:503,json:{ok:false,error:{message:'合成导出故障'}}}));
 await actions.getByRole('button',{name:'导出 PDF',exact:true}).click();await page.getByText('合成导出故障',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'保留当前草稿意图');assert.equal(await actions.getByRole('button',{name:'导出 Word',exact:true}).isEnabled(),true);
 await page.unroute('**/api/exports');
 await page.getByLabel('目标岗位',{exact:true}).fill('软件开发岗位');await actions.getByRole('button',{name:'保存并预览',exact:true}).click();await page.getByText('草稿已保存',{exact:true}).waitFor();
 for(const theme of ['light','dark']){
  if(theme==='dark'){await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'切换明暗配色'}).click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});}
  for(const width of [1440,760,390,334]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const name of ['保存并预览','导出 PDF','导出 Word']){const box=await actions.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=900,'actions stay in the viewport');}
   await page.screenshot({path:`verification/private/screenshots/resume-flow-${theme}-${width}.png`});
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.getByLabel('目标岗位',{exact:true}).fill('列表内未保存岗位');await page.getByRole('button',{name:'← 返回简历列表',exact:true}).click();
 await page.getByRole('button',{name:/列表内未保存岗位/}).click({timeout:2000});assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'列表内未保存岗位');
 await page.getByRole('button',{name:'← 返回简历列表',exact:true}).click();
 await page.getByRole('button',{name:'新建简历',exact:true}).click();await page.getByLabel('目标岗位',{exact:true}).fill('新建未保存甲');await page.getByRole('button',{name:'← 返回简历列表',exact:true}).click();
 await page.getByRole('button',{name:'新建简历',exact:true}).click();await page.getByLabel('目标岗位',{exact:true}).fill('新建未保存乙');await page.getByRole('button',{name:'← 返回简历列表',exact:true}).click();
 await page.getByRole('button',{name:/新建未保存甲/}).click();assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'新建未保存甲');await page.getByRole('button',{name:'← 返回简历列表',exact:true}).click();
 await page.getByRole('button',{name:/新建未保存乙/}).waitFor();assert.equal(await page.getByRole('button',{name:/新建未保存乙/}).count(),1);assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_drafts').get().n,1,'session-only draft switching must not autosave');
 await page.getByRole('button',{name:/列表内未保存岗位/}).click();
 withdrawFact(ctx,fact.id,fact.revision);await actions.getByRole('button',{name:'保存并预览',exact:true}).click();
 await page.getByText('所选事实已修订或撤回，请重新核对并选取',{exact:true}).waitFor();
 await page.frameLocator('iframe[title="A4 简历预览"]').getByText(fact.text,{exact:true}).waitFor({state:'detached',timeout:2000});
 await page.reload();await page.getByRole('button',{name:/列表内未保存岗位/}).click();
 await page.getByText('所选事实已修订或撤回，请重新核对并选取',{exact:true}).waitFor({timeout:2000});
 await page.getByText('预览存在待处理问题，请查看简历检查。',{exact:true}).waitFor();
 await page.locator('.resume-section').filter({hasText:'教育背景'}).locator('summary').click();
 await page.locator('.resume-section').filter({hasText:'教育背景'}).getByRole('button',{name:'去核对档案',exact:true}).click();
 await page.getByRole('heading',{name:/待整理/}).waitFor();
 assert.deepEqual(errors,[]);
}
