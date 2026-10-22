import {api} from '../../api/client';
import {openModal} from '../../ui/modal';
import {escapeHtml as esc} from '../../ui/html';
export type Hit={entityType:string;id:string;dossierId?:string;sourceId?:string;title:string;snippet:string;status:string;locator?:{type:'page'|'paragraph';index:number}};
type Page={hits:Hit[];nextCursor:string|null;unindexedSourceCount:number};
let remembered={text:'',kind:'',fileType:'',status:'',from:'',to:'',favorite:false,scroll:0,loaded:0};
export function openSearch(trigger:HTMLElement,onSelect:(hit:Hit)=>void){
 const panel=document.createElement('section');panel.setAttribute('aria-label','档案检索');
 panel.innerHTML=`<div class="modal-top"><span>RHINE LAB / ARCHIVE DIRECTORY</span><button data-close>CLOSE ×</button></div><h2>ARCHIVE INDEX <small>个人档案检索</small></h2><label class="search-field"><i class="search-icon"></i><input type="search" aria-label="检索档案" placeholder="项目、经历、技能或原件中的文字" autocomplete="off" value="${esc(remembered.text)}"><kbd>ESC</kbd></label><div class="search-filters"><label>分类<select data-filter="kind" aria-label="检索分类">${[['','全部'],['education','教育'],['work','实习工作'],['project','项目'],['award','荣誉'],['research','科研'],['volunteer','组织志愿'],['portfolio','作品集'],['reference','参考']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>文件类型<select data-filter="fileType" aria-label="检索文件类型">${[['','全部'],['pdf','PDF'],['docx','Word'],['jpg','JPG'],['png','PNG'],['txt','文本'],['xlsx','Excel'],['pptx','PowerPoint']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>事实状态<select data-filter="status" aria-label="检索确认状态">${[['','全部'],['confirmed','已确认'],['draft','草稿'],['review','待重新确认'],['withdrawn','已撤回']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><label>发生时间从<input data-filter="from" aria-label="发生时间从" placeholder="2024 或 2024-06" value="${esc(remembered.from)}"></label><label>到<input data-filter="to" aria-label="发生时间到" placeholder="年、年月或年月日" value="${esc(remembered.to)}"></label><label><input type="checkbox" aria-label="仅检索收藏" ${remembered.favorite?'checked':''}>仅收藏</label></div><div class="search-results" role="listbox" aria-label="检索结果"></div><button class="text-button" data-more hidden>加载更多 ↓</button><div class="modal-bottom"><span role="status">正在检索…</span><span>LOCAL DATABASE</span></div>`;
 const handle=openModal(panel,trigger);
 if(!panel.isConnected)return handle;
 const input=panel.querySelector<HTMLInputElement>('input[type=search]')!,results=panel.querySelector<HTMLElement>('.search-results')!,status=panel.querySelector<HTMLElement>('[role=status]')!,more=panel.querySelector<HTMLButtonElement>('[data-more]')!;
 const field=(name:string)=>panel.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-filter="${name}"]`)!;
 for(const key of ['kind','fileType','status']as const)field(key).value=remembered[key];
 let revision=0,controller:AbortController|undefined,composing=false,selected=-1,hits:Hit[]=[],cursor:string|null=null;
 function remember(reset=false){remembered={text:input.value,kind:field('kind').value,fileType:field('fileType').value,status:field('status').value,from:field('from').value,to:field('to').value,favorite:panel.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,scroll:reset?0:results.scrollTop,loaded:reset?0:hits.length};}
 async function search(append=false,restore=false){
  const seq=++revision;controller?.abort();controller=new AbortController();
  const targetCount=restore?remembered.loaded:0,targetScroll=restore?remembered.scroll:append?results.scrollTop:0;
  const query=new URLSearchParams({text:input.value});for(const key of ['kind','fileType','status','from','to'])if(field(key).value)query.set(key,field(key).value);
  if(panel.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked)query.set('favorite','true');
  if(append&&cursor)query.set('cursor',cursor);status.textContent='正在检索…';
  try{
   let page=await api<Page>('search?'+query,undefined,controller.signal);let nextHits=append?[...hits,...page.hits]:page.hits;
   while(restore&&page.nextCursor&&nextHits.length<targetCount){query.set('cursor',page.nextCursor);page=await api<Page>('search?'+query,undefined,controller.signal);nextHits.push(...page.hits);}
   if(seq!==revision||!panel.isConnected)return;hits=nextHits;cursor=page.nextCursor;selected=-1;
   results.innerHTML=hits.length?hits.map((h,i)=>`<button role="option" aria-selected="false" data-hit="${i}" class="search-hit"><span class="eyebrow">${h.entityType==='source'?'原始材料':h.entityType==='fact'?'个人事实':'经历档案'} / ${esc(h.status)}</span><strong>${esc(h.title)}</strong><p>${esc(h.snippet)}</p></button>`).join(''):'<p class="empty-message">没有匹配结果，可换一个关键词。</p>';
   status.textContent=`${hits.length} 条结果 · ${page.unindexedSourceCount} 份材料正文尚未识别`;more.hidden=!cursor;results.scrollTop=targetScroll;remember();
  }catch(e){if(seq===revision&&(e as Error).name!=='AbortError')status.textContent=(e as Error).message;}
 }
 input.addEventListener('compositionstart',()=>{composing=true;controller?.abort();revision++;});input.addEventListener('compositionend',()=>{composing=false;remember(true);void search();});input.addEventListener('input',()=>{if(!composing){remember(true);void search();}});
 panel.querySelectorAll('select,input[type=checkbox],input[data-filter]').forEach(el=>el.addEventListener('change',()=>{remember(true);void search();}));
 results.addEventListener('scroll',()=>{remembered.scroll=results.scrollTop;});more.onclick=()=>void search(true);
 function choose(index:number){const hit=hits[index];if(!hit)return;remember();controller?.abort();revision++;handle.close(()=>onSelect(hit));}
 results.addEventListener('click',e=>{const hit=(e.target as HTMLElement).closest<HTMLElement>('[data-hit]');if(hit)choose(Number(hit.dataset.hit));});
 input.addEventListener('keydown',e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();selected=Math.max(0,Math.min(hits.length-1,selected+(e.key==='ArrowDown'?1:-1)));results.querySelectorAll<HTMLElement>('[data-hit]').forEach((b,i)=>{b.setAttribute('aria-selected',String(i===selected));if(i===selected)b.scrollIntoView({block:'nearest'});});}else if(e.key==='Enter')choose(selected<0?0:selected);});
 void search(false,true);return handle;
}
