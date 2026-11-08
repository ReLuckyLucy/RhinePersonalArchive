import assert from 'node:assert/strict';
import {saveProfile,readProfile} from '../../server/archive/repository.ts';
export async function run({page,baseURL,ctx}){
 await page.addInitScript(()=>sessionStorage.setItem('rhine:entered','1'));
 const studio=async()=>page.getByRole('button',{name:'简历工作台',exact:true}).click();
 await page.goto(baseURL);await studio();await page.getByRole('button',{name:'新建简历',exact:true}).click();
 await page.getByLabel('目标岗位',{exact:true}).fill('旧窗口恢复');await page.locator('input[name="profile-name"]').fill('旧编辑姓名');
 await page.locator('[data-recovery-status]').filter({hasText:'编辑已自动保存在当前资料库'}).waitFor();
 const before=ctx.db.prepare('SELECT * FROM resume_recoveries').get();
 ctx.db.prepare('UPDATE resume_recoveries SET revision=revision+1 WHERE id=?').run(before.id);
 await page.getByLabel('目标岗位',{exact:true}).fill('冲突窗口的新输入');
 await page.locator('[data-recovery-status]').filter({hasText:'自动保存失败'}).waitFor();
 assert.equal(JSON.parse(ctx.db.prepare('SELECT data FROM resume_recoveries WHERE id=?').get(before.id).data).draft.roleTitle,'旧窗口恢复');
 await page.getByRole('button',{name:'另存恢复副本',exact:true}).click();
 await page.locator('[data-recovery-status]').filter({hasText:'编辑已自动保存在当前资料库'}).waitFor();
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_recoveries').get().n,2);
 const current=readProfile(ctx);saveProfile(ctx,{name:'较新的个人信息',email:'',phone:'',location:'',headline:''},current.revision||null);
 await page.reload();await studio();await page.locator('[data-recovery]').filter({hasText:'冲突窗口的新输入'}).click();
 assert.equal(await page.locator('input[name="profile-name"]').inputValue(),'旧编辑姓名');
 await page.getByRole('button',{name:'保存并预览',exact:true}).click();
 await page.locator('[data-resume-status]').filter({hasText:'个人信息已更新，请刷新'}).waitFor();
 assert.equal(readProfile(ctx).name,'较新的个人信息','recovering an old editor cannot overwrite a newer shared profile');
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM resume_drafts').get().n,0);
}
