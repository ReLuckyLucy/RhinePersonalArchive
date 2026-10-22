import assert from 'node:assert/strict';
export async function run({ page, baseURL }) {
  const requests = [];
  page.on('request', req => requests.push(req.url()));
  await page.goto(baseURL);
  await page.getByRole('button', { name:'跳过入场' }).click();
  await page.getByRole('button', { name:'跳过入场' }).waitFor({state:'detached'});
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
