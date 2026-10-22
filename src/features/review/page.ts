import {api} from '../../api/client';import {escapeHtml as esc} from '../../ui/html';import type {Dossier} from '../../../shared/domain';
import {mountExtractionProgress} from '../extraction/progress';
import type {ReviewAction} from '../archives/navigation';
const actions:Record<string,{action:ReviewAction;label:string}>={'个人角色待补充':{action:'role',label:'补充角色'},'开始时间不明确':{action:'date',label:'补充日期'},'尚无确认事实':{action:'facts',label:'核对贡献'},'材料提取失败':{action:'sources',label:'处理材料'}};
export function mountReview(root:HTMLElement,onOpen:(id:string,action:ReviewAction)=>void,restoreScroll=0,returnFocus?:{id:string;action:ReviewAction}){
 let alive=true,loading=false,again=false,lastProgress='';const controller=new AbortController();
 let restored=false;
 root.innerHTML='<section class="page-heading"><div><span class="eyebrow">REVIEW QUEUE / 材料整理</span><h1>让事实，逐渐清晰.</h1><p>每一项待补信息，都能回到材料核对。</p></div></section><section data-extraction></section><p role="status" data-review-status>正在读取…</p><div class="review-list"></div>';
 async function refreshReview(){
  if(loading){again=true;return;}loading=true;
  try{const items=await api<{dossier:Dossier;reasons:string[]}[]>('review',undefined,controller.signal);if(!alive)return;
   root.querySelector('[data-review-status]')!.textContent=items.length?`${items.length} 份档案需要核对`:'当前没有待整理档案';
   const list=root.querySelector<HTMLElement>('.review-list')!,current=new Map([...list.querySelectorAll<HTMLElement>('[data-review-id]')].map(row=>[row.dataset.reviewId!,row]));
   for(const {dossier:d,reasons} of items){let row=current.get(d.id);if(!row){row=document.createElement('article');row.className='review-item';row.dataset.reviewId=d.id;list.append(row);}current.delete(d.id);const html=`<button class="review-title" data-open="${d.id}" data-default-action="${actions[reasons[0]]?.action??'facts'}"><h3>${esc(d.title)}</h3></button><p>${reasons.map(esc).join(' · ')}</p><div class="review-actions">${reasons.map(reason=>actions[reason]).filter(Boolean).map(({action,label})=>`<button class="outline-button" data-review-action="${action}" aria-label="${label}">${label} <span aria-hidden="true">→</span></button>`).join('')}</div>`;if(row.innerHTML!==html)row.innerHTML=html;}
   for(const row of current.values())row.remove();
   if(!restored){restored=true;if(returnFocus){const row=list.querySelector<HTMLElement>(`[data-review-id="${returnFocus.id}"]`);(row?.querySelector<HTMLElement>(`[data-review-action="${returnFocus.action}"]`)??row?.querySelector<HTMLElement>('.review-title'))?.focus({preventScroll:true});}window.scrollTo({top:restoreScroll,behavior:'instant'});}
  }catch(error){if(alive)root.querySelector('[data-review-status]')!.textContent=(error as Error).message;}
  finally{loading=false;if(alive&&again){again=false;void refreshReview();}}
 }
 const disposeProgress=mountExtractionProgress(root.querySelector('[data-extraction]')!,{onUpdate({total,counts}){const key=`${total}:${counts.ready}:${counts.failed}:${counts.unsupported}`;if(lastProgress&&key!==lastProgress)void refreshReview();lastProgress=key;}});
 void refreshReview();
 root.onclick=e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-open],[data-review-action]');if(!el)return;const id=el.dataset.open??el.closest<HTMLElement>('[data-review-id]')?.dataset.reviewId;if(id)onOpen(id,(el.dataset.reviewAction??el.dataset.defaultAction??'facts') as ReviewAction);};
 return()=>{alive=false;controller.abort();disposeProgress();root.onclick=null;};
}
