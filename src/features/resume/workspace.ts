import type {Dossier,Fact,Profile,ResumeDraft} from '../../../shared/domain';
import type {ResumeRecovery,ResumeRecoverySummary} from '../../../shared/resume-recovery';
import {api} from '../../api/client';
import {escapeHtml as esc} from '../../ui/html';
import {resumePage} from './page';
import {mountResumeEditor} from './editor';
import type {RecoveryHandle} from './recovery';
type Session={draft:ResumeDraft;edits:Profile;pending?:Promise<void>;recovery:RecoveryHandle};
const sessions=new Map<string,Session>();
let activeSession:string|undefined,showEditor=false,sequence=0;

export function mountResume(root:HTMLElement,onReviewFact?:(dossierId:string,factId:string)=>void,onReviewQueue?:()=>void){
 let alive=true,intent=0,cleanup:(()=>void)|undefined;
 const back=()=>{cleanup?.();cleanup=undefined;showEditor=false;void load();};
 const load=async()=>{
  const ticket=++intent;root.onclick=null;root.innerHTML=resumePage();
  try{
   const saving=[...sessions.values()].map(session=>session.pending).filter((pending):pending is Promise<void>=>!!pending);
   if(saving.length){root.insertAdjacentHTML('beforeend','<p role="status">正在完成上次保存，未保存输入会继续保留…</p>');await Promise.all(saving);for(const session of sessions.values())session.pending=undefined;}
   if(!alive||ticket!==intent)return;
   const [profile,dossiers,facts,drafts,recoveries]=await Promise.all([api<Profile>('profile'),api<Dossier[]>('dossiers'),api<Fact[]>('facts'),api<ResumeDraft[]>('resume-drafts'),api<ResumeRecoverySummary[]>('resume-recoveries')]);if(!alive||ticket!==intent)return;
   const edit=(draft?:ResumeDraft,edits?:Profile,key=draft?.id??'new:'+ ++sequence,recovery:RecoveryHandle={})=>{activeSession=key;showEditor=true;root.onclick=null;cleanup=mountResumeEditor(root,draft,profile,dossiers,facts,back,(next,profileEdits,pending,handle)=>sessions.set(key,{draft:next,edits:profileEdits,pending,recovery:handle??recovery}),edits,onReviewFact,onReviewQueue,recovery);};
   const active=activeSession?sessions.get(activeSession):undefined;
   if(showEditor&&active){edit(active.draft,active.edits,activeSession,active.recovery);return;}
   const area=root.querySelector('.resume-empty')!;
   area.insertAdjacentHTML('beforebegin',`<div class="form-actions"><button class="solid-button" data-new-resume>新建简历</button><span class="field-help">${facts.filter(f=>f.status==='confirmed').length} 条已确认事实可供选材</span></div>`);
   const cached=[...sessions],cachedIds=new Set(cached.map(([,session])=>session.draft.id).filter(Boolean)),cachedRecoveries=new Set(cached.map(([,session])=>session.recovery.id)),available=recoveries.filter(r=>!cachedRecoveries.has(r.id));
   const row=(title:string,description:string,attribute:string,label='继续编辑 ↗')=>`<button class="record-row" ${attribute}><div><h3>${esc(title||'未命名简历')}</h3><p>${esc(description)}</p></div><span>${label}</span></button>`;
   if(drafts.length||cached.length||available.length)area.innerHTML='<div class="resume-list">'+cached.map(([key,{draft:d,recovery}])=>row(d.roleTitle,(recovery.dirty?'当前输入尚未自动保存':'保留的编辑')+` · ${d.sections.flatMap(s=>s.factIds).length} 条事实`,`data-resume-session="${key}"`)).join('')+available.map(r=>row(r.roleTitle,`自动保留 · ${new Date(r.updatedAt).toLocaleString()} · ${r.selectedCount} 条事实 · 尚未正式保存`,`data-recovery="${r.id}"`,'恢复编辑 ↗')+`<button class="text-button" data-discard-recovery="${r.id}" aria-label="放弃${esc(r.roleTitle||'未命名简历')}的恢复记录">放弃此恢复记录</button>`).join('')+drafts.filter(d=>!cachedIds.has(d.id)).map(d=>row(d.roleTitle,`已保存草稿 v${d.revision} · ${d.sections.flatMap(s=>s.factIds).length} 条事实`,`data-draft="${d.id}"`)).join('')+'</div>';
   root.onclick=async event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-new-resume],[data-draft],[data-resume-session],[data-recovery],[data-discard-recovery]');if(!button||button.disabled)return;
    try{
     if(button.dataset.discardRecovery){button.disabled=true;const record=available.find(r=>r.id===button.dataset.discardRecovery)!;await api('resume-recoveries/'+record.id+'/discard',{expectedRevision:record.revision});if(alive&&ticket===intent)void load();return;}
     if(button.dataset.recovery){button.disabled=true;const record=await api<ResumeRecovery>('resume-recoveries/'+button.dataset.recovery);if(!alive||ticket!==intent)return;const s=record.snapshot;edit({...s.draft,id:s.draft.id??'',revision:s.baseRevision??0},{...profile,...s.profileEdits,revision:s.profileRevision},'recovery:'+record.id,{id:record.id,revision:record.revision});return;}
     const cached=button.dataset.resumeSession?sessions.get(button.dataset.resumeSession):undefined;if(cached)edit(cached.draft,cached.edits,button.dataset.resumeSession,cached.recovery);else edit(drafts.find(d=>d.id===button.dataset.draft));
    }catch(error){if(alive&&ticket===intent){button.disabled=false;root.insertAdjacentHTML('beforeend',`<p class="issue">${esc((error as Error).message)}</p>`);}}
   };
  }catch(error){if(alive&&ticket===intent)root.insertAdjacentHTML('beforeend',`<p class="issue">${esc((error as Error).message)}</p>`);}
 };
 void load();return()=>{alive=false;intent++;cleanup?.();root.onclick=null;};
}
