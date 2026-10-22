import {editExtracted} from './text-editor';
import {organizeDossier} from './organize';
import type {Dossier,Fact,Source} from '../../../shared/domain';
import {categories} from '../../app/state';
import {api,uploadFile} from '../../api/client';import {escapeHtml as esc} from '../../ui/html';import {renderPreview} from './preview';import {editFact} from '../review/editor';import type {Hit} from '../search/modal';import {detailFields} from './editor';
export function mountDetail(root:HTMLElement,id:string,onBack:()=>void,onEdit:(d:Dossier)=>void,onChanged:()=>void,hit?:Hit){
 let alive=true,preview:ReturnType<typeof renderPreview>|undefined,previewTrigger:HTMLElement|undefined;
 let tab=hit?.entityType==='fact'?'facts':hit?.sourceId?'sources':'overview';
 const load=async()=>{preview?.dispose();root.innerHTML='<p role="status">正在读取档案…</p>';try{
 const {dossier:d,sources,facts}=await api<{dossier:Dossier;sources:Source[];facts:Fact[]}>(`dossiers/${id}`);if(!alive)return;
 const start=d.dateRange.start.value,end=d.dateRange.end.value;
 const period=d.dateRange.ongoing?`${start??'开始时间待补充'} — 至今`:start&&end?(start===end?start:`${start} — ${end}`):start?`${start} · 结束时间待补充`:end?`截至 ${end} · 开始时间待补充`:'时间待补充';
 const kind=categories.find(([key])=>key===d.kind)?.[1]??'参考资料';
 const confirmed=facts.filter(f=>f.status==='confirmed').length;
 root.innerHTML=`<div class="detail-top">
  <button class="text-button" data-back aria-label="返回档案目录">← 返回档案</button>
  <div class="detail-tools"><button class="text-button" data-favorite aria-pressed="${d.favorite}">${d.favorite?'取消收藏':'收藏档案'}</button><button class="text-button" data-organize>归档或合并</button><button class="outline-button" data-edit>编辑档案</button></div>
 </div><div class="detail-workspace"><section class="detail-body">
  <header class="dossier-heading"><span class="eyebrow">DOSSIER / ${esc(kind)}</span><h1>${esc(d.title)}</h1>
   ${d.organization||d.role?`<p class="detail-role">${[d.organization,d.role].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('')}</p>`:''}
   <p class="detail-period">${esc(period)}</p>
   <div class="detail-counts"><span><b>${sources.length}</b> 份材料</span><span><b>${facts.length}</b> 条事实</span><span><b>${confirmed}</b> 条已确认</span></div>
  </header>
  <nav class="detail-tabs" aria-label="档案内容">${[['overview','概述'],['facts','个人贡献'],['sources','证明材料'],['usage','使用记录']].map(([v,l])=>`<button data-tab="${v}" aria-controls="dossier-content">${l}</button>`).join('')}</nav>
  <div id="dossier-content" data-content></div><p class="detail-status" role="status"></p>
  <section class="original-pane" hidden aria-label="原件预览"><div class="preview-heading"><h2 tabindex="-1">原件预览</h2><button class="text-button" data-close-preview>收起原件预览</button></div><p class="proof-excerpt" hidden></p>
   <label>当前材料<select aria-label="预览材料">${sources.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label><div data-preview></div>
  </section>
 </section></div>`;
 const content=root.querySelector<HTMLElement>('[data-content]')!,status=root.querySelector<HTMLElement>('[role=status]')!,select=root.querySelector<HTMLSelectElement>('select')!;
 const pane=root.querySelector<HTMLElement>('.original-pane')!,excerpt=root.querySelector<HTMLElement>('.proof-excerpt')!;
 function hideSource(){preview?.dispose();preview=undefined;pane.hidden=true;excerpt.hidden=true;excerpt.textContent='';}
 function showSource(sourceId?:string,version?:number,trigger?:HTMLElement){
  preview?.dispose();previewTrigger=trigger;pane.hidden=false;excerpt.hidden=true;excerpt.textContent='';
  const source=sources.find(s=>s.id===sourceId)??sources[0];
  if(source){select.value=source.id;preview=renderPreview(root.querySelector('[data-preview]')!,version?{...source,version}:source);}
  else root.querySelector('[data-preview]')!.innerHTML='<p class="empty-message">暂无原件，请添加文件或本人陈述。</p>';
  if(trigger){pane.querySelector<HTMLElement>('h2')!.focus({preventScroll:true});pane.scrollIntoView({block:'start'});}
 }
 function drawTab(){
 hideSource();status.textContent='';
 root.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===tab)));
 if(tab==='overview'){
  const fields=Object.entries(d.typedDetails).map(([k,v])=>[detailFields[d.kind].find(([key])=>key===k)?.[1].replace('（用逗号分隔）','')??k,Array.isArray(v)?v.join('、'):String(v??'')]).filter(([,v])=>v.trim());
  content.innerHTML=`<section class="detail-section"><h2>经历概述</h2>${d.summary?`<p class="prose">${esc(d.summary)}</p>`:'<p class="detail-empty">还没有填写这段经历的概述。可以从背景、负责的事情与结果开始整理。</p><button class="text-button" data-edit>补充经历概述 →</button>'}</section>
   ${fields.length?`<section class="detail-section"><h2>档案信息</h2><dl class="details-list">${fields.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>`:''}
   ${d.skills.length?`<section class="detail-section"><h2>相关技能</h2><ul class="detail-skills">${d.skills.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section>`:''}
   <div class="detail-next"><p>${confirmed?`${confirmed} 条事实已确认，可在简历工作台选用。`:'个人贡献核对后，可用于生成简历。'}</p><button class="text-button" data-tab="facts">核对个人贡献 →</button></div>`;
 }
 else if(tab==='facts')content.innerHTML=`<div class="detail-section-bar"><div><h2>个人贡献</h2><p>区分本人贡献与团队成果，保留每条事实的来源。</p></div><button class="outline-button" data-new-fact>新增事实</button></div>${facts.length?facts.map(f=>`<article class="fact-card" data-fact-id="${f.id}" tabindex="-1"><div class="fact-meta"><span class="fact-state" data-state="${f.status}">${f.status==='confirmed'?'已确认':f.status==='withdrawn'?'已撤回':f.status==='review'?'待重新确认':'待核对'}</span><span>${f.ownership==='personal'?'本人贡献':'团队成果'}</span><span>修订 ${f.revision}</span></div><p>${esc(f.text)}</p><div class="evidence-links">${f.evidenceLinks.map((e,i)=>`<button class="text-button" data-proof="${f.id}:${i}">来源 ${i+1} · ${esc(e.locator.label??`第 ${e.locator.index??1} 页/段`)} ↗</button>`).join('')}</div><div class="fact-actions"><button data-edit-fact="${f.id}">修订文字</button><button data-history="${f.id}">历史修订</button>${f.status==='confirmed'?`<button data-withdraw="${f.id}">撤回确认</button>`:`<button data-confirm="${f.id}">已核对来源，确认此事实</button>`}</div></article>`).join(''):'<p class="detail-empty">尚未整理个人贡献。添加事实时，可关联已有材料并注明本人负责的部分。</p>'}`;
 else if(tab==='sources'){
  const availability={available:'原件可用',missing:'原件缺失',changed:'原件已变化'};
  const extraction={pending:'待提取文字',queued:'等待提取',running:'正在提取',ready:'文字已提取',failed:'文字提取失败',unsupported:'暂不支持文字提取'};
  content.innerHTML=`<div class="detail-section-bar"><div><h2>证明材料</h2><p>共 ${sources.length} 份材料，点击名称查看原件。</p></div><label class="outline-button upload-label">添加材料<input type="file" data-upload></label></div>
   <div class="source-list">${sources.length?sources.map(s=>`<div class="source-row"><button class="text-button source-name" data-source="${s.id}">${esc(s.name)}</button><span>${availability[s.availability]} · ${extraction[s.extractionState]} · 版本 ${s.version}</span><button class="text-button source-open" data-open-original="${s.id}">打开原件 ↗</button></div>`).join(''):'<p class="detail-empty">尚未关联证明材料。可以添加证书、项目文档或本人陈述。</p>'}</div>
   ${sources.length?'<div class="source-tools"><button class="text-button" data-extract>提取文字</button><button class="text-button" data-correct>校对提取文字</button></div>':''}
   <details class="statement-disclosure"><summary>补充本人陈述</summary><form class="statement-form"><label>陈述内容<textarea name="statement" rows="4" placeholder="说明本人负责的部分、时间及需要补充核实之处。"></textarea></label><button class="outline-button" type="submit">保存为本人陈述材料</button></form></details>`;
  if(sources.length)showSource(select.value);
 }
 else{content.innerHTML='<p>正在读取使用记录…</p>';void api<any[]>(`facts-usage?dossierId=${id}`).then(items=>{if(alive&&tab==='usage')content.innerHTML=items.length?items.map(v=>`<p class="prose">${esc(v.roleTitle)} · ${esc(v.createdAt)}</p>`).join(''):'<p class="prose">尚未被简历版本引用。</p>';}).catch(()=>{if(alive&&tab==='usage')content.textContent='无法读取使用记录，请稍后重试。';});}}
 select.onchange=()=>showSource(select.value);drawTab();
 if(hit?.sourceId&&tab==='sources'){showSource(hit.sourceId);if(hit.locator)preview?.goTo(hit.locator);}
 if(hit?.entityType==='fact'){const match=content.querySelector<HTMLElement>(`[data-fact-id="${hit.id}"]`);match?.classList.add('located');match?.focus();match?.scrollIntoView({block:'nearest'});}
 root.onclick=async e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;try{if(b.hasAttribute('data-back'))onBack();else if(b.hasAttribute('data-close-preview')){hideSource();if(previewTrigger?.isConnected)previewTrigger.focus();else root.querySelector<HTMLElement>('.detail-tabs [aria-current=true]')?.focus();}else if(b.hasAttribute('data-edit'))onEdit(d);else if(b.hasAttribute('data-organize'))void organizeDossier(b,d,()=>{onChanged();onBack();});else if(b.hasAttribute('data-favorite')){const {revision,archivedAt,visitedAt,...input}=d;await api('dossiers',{input:{...input,favorite:!d.favorite},expectedRevision:revision});onChanged();await load();}else if(b.dataset.tab){if(tab===b.dataset.tab)return;tab=b.dataset.tab;drawTab();root.querySelector<HTMLElement>(`.detail-tabs [data-tab="${tab}"]`)?.focus({preventScroll:true});if(!b.closest('.detail-tabs'))root.querySelector<HTMLElement>('.detail-tabs')?.scrollIntoView({block:'nearest'});}else if(b.hasAttribute('data-new-fact'))editFact(b,d,sources,undefined,()=>void load());else if(b.dataset.editFact)editFact(b,d,sources,facts.find(f=>f.id===b.dataset.editFact),()=>void load());else if(b.dataset.confirm||b.dataset.withdraw){const f=facts.find(f=>f.id===(b.dataset.confirm??b.dataset.withdraw))!;status.textContent='正在保存…';await api(`facts/${f.id}/${b.dataset.confirm?'confirm':'withdraw'}`,{expectedRevision:f.revision});await load();}else if(b.dataset.history){const history=await api<Fact[]>(`facts/${b.dataset.history}/history`);status.textContent=history.map(f=>`v${f.revision} ${f.status}：${f.text}`).join('\n');status.scrollIntoView({block:'nearest'});}else if(b.dataset.proof){const[fid,index]=b.dataset.proof.split(':');const proof=facts.find(f=>f.id===fid)!.evidenceLinks[Number(index)];showSource(proof.sourceId,proof.sourceVersion,b);excerpt.hidden=false;excerpt.textContent=`原文摘录 · 证据等级 ${proof.grade}\n${proof.excerpt}`;preview?.goTo(proof.locator);}else if(b.dataset.source)showSource(b.dataset.source,undefined,b);else if(b.dataset.openOriginal)await api(`sources/${b.dataset.openOriginal}/open`,{});else if(b.hasAttribute('data-correct')){const source=sources.find(s=>s.id===select.value);if(source)await editExtracted(b,source);}else if(b.hasAttribute('data-extract')){await api('jobs',{sourceIds:sources.map(s=>s.id)});status.textContent='提取已加入队列，请稍后重新打开材料。';}}catch(error){status.textContent=(error as Error).message;}};
 root.onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{await uploadFile(file,id);await load();}catch(error){status.textContent=(error as Error).message;}};
 root.onsubmit=async e=>{const form=e.target as HTMLFormElement;if(!form.matches('.statement-form'))return;e.preventDefault();const text=String(new FormData(form).get('statement')??'');if(!text.trim())return;try{await uploadFile(new File([text],'本人陈述.txt',{type:'text/plain'}),id);await load();}catch(error){status.textContent=(error as Error).message;}};
 }catch(e){if(alive)root.textContent=(e as Error).message;}};void load();return()=>{alive=false;preview?.dispose();root.onclick=null;root.onchange=null;root.onsubmit=null;};
}
