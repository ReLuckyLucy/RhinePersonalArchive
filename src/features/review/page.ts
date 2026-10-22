import {api} from '../../api/client';import {escapeHtml as esc} from '../../ui/html';import type {Dossier} from '../../../shared/domain';
import {mountExtractionProgress} from '../extraction/progress';
export function mountReview(root:HTMLElement,onOpen:(id:string)=>void){
 let alive=true,loading=false,again=false,lastProgress='';const controller=new AbortController();
 root.innerHTML='<section class="page-heading"><div><span class="eyebrow">REVIEW QUEUE / 材料整理</span><h1>让事实，逐渐清晰.</h1><p>每一项待补信息，都能回到材料核对。</p></div></section><section data-extraction></section><p role="status" data-review-status>正在读取…</p><div class="review-list"></div>';
 async function refreshReview(){
  if(loading){again=true;return;}loading=true;
  try{const items=await api<{dossier:Dossier;reasons:string[]}[]>('review',undefined,controller.signal);if(!alive)return;
   root.querySelector('[data-review-status]')!.textContent=items.length?`${items.length} 份档案需要核对`:'当前没有待整理档案';
   const list=root.querySelector<HTMLElement>('.review-list')!,current=new Map([...list.querySelectorAll<HTMLButtonElement>('[data-open]')].map(row=>[row.dataset.open!,row]));
   for(const {dossier:d,reasons} of items){let row=current.get(d.id);if(!row){row=document.createElement('button');row.className='record-row';row.dataset.open=d.id;list.append(row);}current.delete(d.id);const html=`<div><h3>${esc(d.title)}</h3><p>${reasons.map(esc).join(' · ')}</p></div><span>核对 →</span>`;if(row.innerHTML!==html)row.innerHTML=html;}
   for(const row of current.values())row.remove();
  }catch(error){if(alive)root.querySelector('[data-review-status]')!.textContent=(error as Error).message;}
  finally{loading=false;if(alive&&again){again=false;void refreshReview();}}
 }
 const disposeProgress=mountExtractionProgress(root.querySelector('[data-extraction]')!,{onUpdate({total,counts}){const key=`${total}:${counts.ready}:${counts.failed}:${counts.unsupported}`;if(lastProgress&&key!==lastProgress)void refreshReview();lastProgress=key;}});
 void refreshReview();
 root.onclick=e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-open]');if(el?.dataset.open)onOpen(el.dataset.open);};
 return()=>{alive=false;controller.abort();disposeProgress();root.onclick=null;};
}
