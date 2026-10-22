import assert from 'node:assert/strict';
import {basename} from 'node:path';
export async function run({ page, baseURL,ctx }) {
  const requests = [];
  page.on('request', req => requests.push(req.url()));
  await page.goto(baseURL, { waitUntil:'domcontentloaded' });
  const boot = page.getByRole('button', { name:'跳过入场' });
  // The short entry also ends automatically after one second; a slow page load
  // may finish it before the test can click. Only accept the error if it ended.
  await boot.click({ timeout:1500 }).catch(async error => {
    if (await boot.count()) throw error;
  });
  await boot.waitFor({state:'detached'});
  const library=page.getByRole('button',{name:'查看当前资料库',exact:true});
  assert.equal(await library.count(),1,'current library must have a visible details entry');
  await page.waitForFunction(()=>document.querySelector('[data-action=library]')?.dataset.state==='connected');
  assert.equal(await library.locator('[data-library-name]').textContent(),basename(ctx.libraryRoot));
  assert.equal(await library.getAttribute('title'),null,'identity must not use a floating native tooltip');
  await library.click();
  const libraryDialog=page.getByRole('dialog',{name:'当前资料库',exact:true});
  await libraryDialog.locator('[data-library-directory]').waitFor();
  assert.equal(await libraryDialog.locator('[data-library-directory]').textContent(),ctx.libraryRoot);
  assert.equal(await libraryDialog.locator('[data-library-count=dossiers]').textContent(),'0');
  assert.equal(await libraryDialog.locator('[data-library-count=sources]').textContent(),'0');
  await page.screenshot({path:'verification/private/screenshots/library-desktop.png',fullPage:true});
  await page.keyboard.press('Escape');await libraryDialog.waitFor({state:'detached'});
  assert.equal(await library.evaluate(el=>document.activeElement===el),true);
  let failLibraryRead=true;
  await page.route('**/api/library',route=>failLibraryRead?route.fulfill({status:503,json:{ok:false,error:{code:'TEST_UNAVAILABLE',message:'Synthetic service failure'}}}):route.continue());
  await library.click();await libraryDialog.getByRole('button',{name:'重新读取',exact:true}).waitFor();
  assert.equal(await libraryDialog.locator('[data-library-directory]').count(),0,'failed reads must not show a stale directory');
  assert.equal(await library.getAttribute('data-state'),'error');
  failLibraryRead=false;await libraryDialog.getByRole('button',{name:'重新读取',exact:true}).click();
  await libraryDialog.locator('[data-library-directory]').waitFor();await page.unroute('**/api/library');
  await libraryDialog.getByRole('button',{name:'管理资料位置 ↗',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'设置',exact:true});await settings.waitFor();
  assert.equal(await libraryDialog.count(),0,'management must open after the identity dialog closes');
  await page.keyboard.press('Escape');await settings.waitFor({state:'detached'});
  assert.equal(await library.evaluate(el=>document.activeElement===el),true);
  await page.setViewportSize({width:390,height:844});await library.click();
  await libraryDialog.locator('[data-library-directory]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'verification/private/screenshots/library-mobile.png',fullPage:true});
  await page.keyboard.press('Escape');await libraryDialog.waitFor({state:'detached'});
  await page.route('**/api/library',route=>route.fulfill({json:{ok:true,data:{name:'很长的演示资料库名称_'.repeat(6),directory:ctx.libraryRoot+'/资料位置测试'.repeat(24),dossierCount:0,archivedDossierCount:0,sourceCount:0}}}));
  await page.setViewportSize({width:334,height:568});await library.click();
  await libraryDialog.locator('[data-library-directory]').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'long library names and paths must not widen the page');
  assert.equal(await libraryDialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'verification/private/screenshots/library-long-name.png',fullPage:true});
  await page.keyboard.press('Escape');await libraryDialog.waitFor({state:'detached'});
  await page.unroute('**/api/library');await page.setViewportSize({width:1440,height:900});
  await library.click();await libraryDialog.locator('[data-library-directory]').waitFor();
  await page.keyboard.press('Escape');await libraryDialog.waitFor({state:'detached'});
  assert.equal(await page.getByRole('button', { name: '检索档案', exact: true }).count(), 1, 'archive search entry must be accessible');
  assert.equal(await page.locator('canvas').count(), 0);
  await page.getByRole('button', { name: '检索档案', exact: true }).click();
  await page.getByRole('searchbox', { name: '检索档案' }).waitFor();
  await page.waitForFunction(()=>document.activeElement?.getAttribute('type')==='search',{},{timeout:1500});
  assert.equal(await page.locator('main').evaluate(el => el.inert), true);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: '检索档案', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.getByRole('button', { name: '简历工作台', exact: true }).click();
  await page.getByText('从真实经历，组织下一份简历。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '个人档案', exact: true }).click();
  for (const viewport of [{width:1440,height:900},{width:1920,height:1080},{width:780,height:900}]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'layout must not overflow');
    await page.screenshot({path:`verification/private/screenshots/shell-${viewport.width}.png`,fullPage:true});
  }
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:'切换明暗配色'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(requests.some(url=>/\.glb|three|service-worker/.test(url)),false);
}
