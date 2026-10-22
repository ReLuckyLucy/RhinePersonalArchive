import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {importFiles} from '../../server/sources/import.ts';
import {getSource,updateSource} from '../../server/sources/repository.ts';

export async function run({page,baseURL,ctx}){
 const {sourceIds:[pending,failed,ready]}=await importFiles(ctx,[{name:'pending.txt',stream:[Buffer.from('pending browser proof')]},{name:'retry.txt',stream:[Buffer.from('retry browser proof')]},{name:'ready.txt',stream:[Buffer.from('ready browser proof')]}]);
 updateSource(ctx,{...getSource(ctx,failed),extractionState:'failed'});updateSource(ctx,{...getSource(ctx,ready),extractionState:'ready'});
 const j={id:randomUUID(),sourceId:failed,version:1,state:'failed',error:'TIMEOUT'};ctx.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(j.id,failed,1,'failed',JSON.stringify(j));
 await page.addInitScript(()=>{sessionStorage.setItem('rhine:entered','1');localStorage.setItem('rhine:last-page','review');});
 await page.goto(baseURL);
 const panel=page.getByRole('region',{name:'全库文字提取',exact:true});await panel.waitFor({timeout:5000});
 await page.waitForFunction(()=>document.querySelector('[data-extraction-count=pending]')?.textContent==='1');
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM jobs').get().n,1,'opening progress must not start work');
 await panel.getByText('提取超时，可重试。',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'提取待处理材料文字',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-extraction-count=ready]')?.textContent==='2');
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM jobs WHERE source_id=?').get(failed).n,1,'start pending must not implicitly retry failures');
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM jobs WHERE source_id=?').get(ready).n,0,'ready text must not be requeued');
 await panel.getByRole('button',{name:`重试 ${getSource(ctx,failed).name}`,exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-extraction-count=ready]')?.textContent==='3');
 await page.waitForFunction(()=>!document.querySelector('.review-list')?.textContent.includes('材料提取失败'),{},{timeout:10000});
 assert.equal(ctx.db.prepare('SELECT count(*) n FROM facts').get().n,0);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'progress fits narrow screens');
 await page.screenshot({path:'verification/private/screenshots/extraction-mobile.png',fullPage:true});
 let fail=true;await page.route('**/api/extraction-status',route=>fail?route.fulfill({status:503,json:{ok:false,error:{message:'合成读取故障'}}}):route.continue());
 await panel.getByRole('button',{name:'重新读取进度',exact:true}).waitFor();
 assert.equal(await panel.getByRole('button',{name:'提取待处理材料文字',exact:true}).isDisabled(),true);
 fail=false;await panel.getByRole('button',{name:'重新读取进度',exact:true}).click();
 await panel.getByText('全部可提取材料已完成。',{exact:true}).waitFor();await page.unroute('**/api/extraction-status');
 await page.getByRole('button',{name:'简历工作台',exact:true}).click();
 let polls=0;page.on('request',req=>{if(req.url().includes('/api/extraction-status'))polls++;});
 await page.waitForTimeout(4500);assert.equal(polls,0,'leaving page disposes polling');
}
