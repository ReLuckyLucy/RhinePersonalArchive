import assert from 'node:assert/strict';
export async function run({page,baseURL,ctx}){
 await page.addInitScript(()=>sessionStorage.setItem('rhine:entered','1'));
 const studio=async()=>page.getByRole('button',{name:'简历工作台',exact:true}).click();
 await page.goto(baseURL);await studio();await page.getByRole('button',{name:'新建简历',exact:true}).click();
 await page.getByLabel('目标岗位',{exact:true}).fill('刷新恢复岗位');
 await page.locator('input[name="profile-email"]').fill('unfinished@');
 await page.locator('[data-recovery-status]').filter({hasText:'编辑已自动保存在当前资料库'}).waitFor();
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_drafts').get().n,0);
 await page.reload();await studio();await page.locator('[data-recovery]').filter({hasText:'刷新恢复岗位'}).click();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'刷新恢复岗位');
 assert.equal(await page.locator('input[name="profile-email"]').inputValue(),'unfinished@');
 await page.locator('input[name="profile-email"]').fill('');
 await page.getByRole('button',{name:'保存并预览',exact:true}).click();await page.getByText('草稿已保存',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-recovery-status]')?.textContent.includes('已正式保存'));
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_recoveries').get().n,0);
 // Navigating immediately after typing must flush the newest form, without waiting for debounce.
 await page.getByLabel('目标岗位',{exact:true}).fill('立即离开岗位');
 await page.getByRole('button',{name:'返回简历列表',exact:false}).click();
 await page.locator('[data-resume-session]').filter({hasText:'立即离开岗位'}).waitFor();
 await page.reload();await studio();await page.locator('[data-recovery]').filter({hasText:'立即离开岗位'}).click();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'立即离开岗位');
 // Failed checkpoints remain visibly unsaved; a later edit can safely save the latest input.
 await page.route('**/api/resume-recoveries',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'TEST_OFFLINE',message:'合成保存故障'}})}):route.continue());
 await page.getByLabel('目标岗位',{exact:true}).fill('故障保留岗位');await page.locator('[data-recovery-status]').filter({hasText:'自动保存失败'}).waitFor();
 const hasGuard=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});assert.equal(hasGuard,true);
 await page.unroute('**/api/resume-recoveries');await page.getByLabel('目标岗位',{exact:true}).fill('恢复后岗位');await page.locator('[data-recovery-status]').filter({hasText:'编辑已自动保存在当前资料库'}).waitFor();
 // Saving an earlier form must not discard text entered while that request is in flight.
 let release;const hold=new Promise(done=>release=done);let started;const start=new Promise(done=>started=done);
 await page.route('**/api/resume-drafts',async route=>{if(route.request().method()!=='POST')return route.continue();started();await hold;return route.continue();});
 await page.getByRole('button',{name:'保存并预览',exact:true}).click();await start;
 await page.getByLabel('目标岗位',{exact:true}).fill('保存期间的新输入');release();await page.getByText('已保存先前输入，当前内容仍有未保存修改。',{exact:true}).waitFor();
 await page.locator('[data-recovery-status]').filter({hasText:'编辑已自动保存在当前资料库'}).waitFor();
 await page.reload();await studio();await page.locator('[data-recovery]').filter({hasText:'保存期间的新输入'}).click();
 assert.equal(await page.getByLabel('目标岗位',{exact:true}).inputValue(),'保存期间的新输入');
 await page.screenshot({path:'verification/private/screenshots/resume-recovery.png',fullPage:true});
}
