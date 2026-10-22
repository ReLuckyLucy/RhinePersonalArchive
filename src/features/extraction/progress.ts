import type {ExtractionSnapshot,ExtractionState} from '../../../shared/api';
import {api} from '../../api/client';
import {escapeHtml as esc} from '../../ui/html';

export const extractionLabels:Record<ExtractionState,string>={pending:'待提取文字',queued:'等待提取',running:'正在提取',ready:'文字已提取',failed:'文字提取失败',unsupported:'暂不支持文字提取'};
const reasons:Record<string,string>={TIMEOUT:'提取超时，可重试。',SOURCE_UNAVAILABLE:'原件缺失，请先重新定位原件。',SOURCE_CHANGED:'原件已变化，请先重新导入。',STALE_VERSION:'材料版本已变化，请重新打开档案。',LIMIT:'超过自动提取上限，请拆分材料或补充本人陈述。',WORKER_EXIT:'提取进程中断，可重试。'};

export function mountExtractionProgress(root:HTMLElement,options:{dossierId?:string;compact?:boolean;onUpdate?:(snapshot:ExtractionSnapshot)=>void}={}){
 let alive=true,inFlight=false,again=false,sending=false,stale=true,snapshot:ExtractionSnapshot|undefined,timer:ReturnType<typeof setTimeout>|undefined,failuresKey='';
 const controller=new AbortController(),labels:Record<ExtractionState,string>={pending:'待提取',queued:'排队中',running:'处理中',ready:'已提取',failed:'失败',unsupported:'不支持'};
 root.classList.add('extraction-progress');root.classList.toggle('is-compact',!!options.compact);root.setAttribute('role','region');root.setAttribute('aria-label',options.dossierId?'当前档案文字提取':'全库文字提取');
 const statistics=`<dl class="extraction-counts">${Object.entries(labels).map(([state,label])=>`<div><dt>${label}</dt><dd data-extraction-count="${state}">—</dd></div>`).join('')}</dl><p class="extraction-activity" data-extraction-activity></p>`;
 root.innerHTML=`<div class="extraction-heading"><div>${options.compact?'':'<span class="eyebrow">TEXT EXTRACTION</span>'}<h2>${options.dossierId?'当前档案':'全库'}文字提取</h2></div><button class="outline-button" data-extraction-start disabled>${options.dossierId?'提取文字':'提取待处理材料文字'}</button></div><p class="extraction-summary" data-extraction-summary>正在读取进度…</p>${options.compact?`<details data-extraction-details><summary>提取详情</summary>${statistics}</details>`:statistics}<div class="extraction-failures"></div><p class="extraction-message" role="status" data-extraction-message></p><button class="text-button" data-extraction-reload hidden>重新读取进度</button>`;
 const query=<T extends HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
 const start=query<HTMLButtonElement>('[data-extraction-start]'),reload=query<HTMLButtonElement>('[data-extraction-reload]'),message=query('[data-extraction-message]');
 function buttons(){start.disabled=stale||sending||!snapshot?.counts.pending;root.querySelectorAll<HTMLButtonElement>('[data-extraction-retry]').forEach(b=>b.disabled=stale||sending);}
 function draw(next:ExtractionSnapshot){
  snapshot=next;stale=false;root.dataset.state='current';reload.hidden=true;
  query('[data-extraction-summary]').textContent=next.total?`已提取 ${next.counts.ready} / ${next.total} 份材料的文字`+(options.compact?(['queued','running','failed','unsupported'] as const).filter(state=>next.counts[state]).map(state=>` · ${labels[state]} ${next.counts[state]}`).join(''):''):'尚无材料，添加材料后可提取文字。';
  for(const [state,value] of Object.entries(next.counts))query(`[data-extraction-count=${state}]`).textContent=String(value);
  const running=next.materials.find(m=>m.state==='running');
  query('[data-extraction-activity]').textContent=running?`正在处理：${running.name}`:next.counts.queued?`${next.counts.queued} 份材料正在排队，可继续整理档案。`:next.counts.pending?'点击提取后在本机处理，完成状态会自动更新。':next.counts.failed?'部分材料提取失败，请查看原因后重试。':next.counts.unsupported?'其余材料暂不支持自动提取，可打开原件或补充本人陈述。':next.total?'全部可提取材料已完成。':'';
  const failures=next.materials.filter(m=>m.state==='failed'),key=JSON.stringify(failures);
  if(key!==failuresKey){failuresKey=key;query('.extraction-failures').innerHTML=failures.map(m=>`<div class="extraction-failure"><div><strong>${esc(m.name)}</strong><p>${esc(reasons[m.errorCode??'']??'文字提取未完成，可重试或打开原件核对。')}</p></div><button class="text-button" data-extraction-retry="${m.id}" aria-label="重试 ${esc(m.name)}">重试 ↻</button></div>`).join('');}
  buttons();options.onUpdate?.(next);
 }
 function schedule(){clearTimeout(timer);if(alive&&!document.hidden)timer=setTimeout(()=>void refresh(),snapshot&&(snapshot.counts.queued||snapshot.counts.running)?1200:4000);}
 async function refresh(){
  clearTimeout(timer);if(!alive||document.hidden)return;if(inFlight){again=true;return;}inFlight=true;
  try{const next=await api<ExtractionSnapshot>(`extraction-status${options.dossierId?`?dossierId=${encodeURIComponent(options.dossierId)}`:''}`,undefined,controller.signal);if(alive){if(stale)message.textContent='';draw(next);}}
  catch{if(alive){stale=true;root.dataset.state='stale';message.textContent=snapshot?'无法更新提取进度，以上为上次读取的状态。请重新读取。':'无法读取提取进度，请重新读取。';reload.hidden=false;buttons();}}
  finally{inFlight=false;if(alive){if(again){again=false;void refresh();}else schedule();}}
 }
 async function enqueue(state:'pending'|'failed',id?:string){
  if(!snapshot||stale||sending)return;
  const ids=snapshot.materials.filter(m=>m.state===state&&(!id||m.id===id)).slice(0,1000).map(m=>m.id);if(!ids.length)return;
  sending=true;buttons();message.textContent='正在加入本机提取队列…';
  try{const jobs=await api<unknown[]>('jobs',{sourceIds:ids,onlyStates:[state]},controller.signal);if(alive)message.textContent=jobs.length?`已将 ${jobs.length} 份材料加入队列，可继续整理档案。`:'材料状态已更新，无需重复提取。';}
  catch(error){if(alive)message.textContent=(error as Error).message;}
  finally{sending=false;if(alive){buttons();void refresh();}}
 }
 const click=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(button===start)void enqueue('pending');else if(button===reload)void refresh();else if(button?.dataset.extractionRetry)void enqueue('failed',button.dataset.extractionRetry);};
 const visibility=()=>{clearTimeout(timer);if(!document.hidden)void refresh();};
 root.addEventListener('click',click);document.addEventListener('visibilitychange',visibility);void refresh();
 return()=>{alive=false;clearTimeout(timer);controller.abort();root.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);};
}
