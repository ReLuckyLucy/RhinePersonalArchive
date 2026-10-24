import type {Dossier,Fact,Profile,ResumeDraft} from '../../../shared/domain';
import {api} from '../../api/client';
import {escapeHtml as esc} from '../../ui/html';
import {resumePage} from './page';
import {mountResumeEditor} from './editor';
type Session={draft:ResumeDraft;edits:Profile;pending?:Promise<void>};
const sessions=new Map<string,Session>();
let activeSession:string|undefined,showEditor=false,sequence=0;

export function mountResume(root:HTMLElement,onReviewFact?:(dossierId:string,factId:string)=>void,onReviewQueue?:()=>void){
 let alive=true,cleanup:(()=>void)|undefined;
 const back=()=>{cleanup?.();cleanup=undefined;showEditor=false;void load();};
 const load=async()=>{
  root.onclick=null;root.innerHTML=resumePage();
  try{
   const saving=[...sessions.values()].map(session=>session.pending).filter((pending):pending is Promise<void>=>!!pending);
   if(saving.length){root.insertAdjacentHTML('beforeend','<p role="status">正在完成上次保存，未保存输入会继续保留…</p>');await Promise.all(saving);for(const session of sessions.values())session.pending=undefined;}
   if(!alive)return;
   const [profile,dossiers,facts,drafts]=await Promise.all([api<Profile>('profile'),api<Dossier[]>('dossiers'),api<Fact[]>('facts'),api<ResumeDraft[]>('resume-drafts')]);if(!alive)return;
   const edit=(draft?:ResumeDraft,edits?:Profile,key=draft?.id??'new:'+ ++sequence)=>{activeSession=key;showEditor=true;root.onclick=null;cleanup=mountResumeEditor(root,draft,profile,dossiers,facts,back,(next,profileEdits,pending)=>sessions.set(key,{draft:next,edits:profileEdits,pending}),edits,onReviewFact,onReviewQueue);};
   const active=activeSession?sessions.get(activeSession):undefined;
   if(showEditor&&active){edit(active.draft,active.edits,activeSession);return;}
   const area=root.querySelector('.resume-empty')!;
   area.insertAdjacentHTML('beforebegin',`<div class="form-actions"><button class="solid-button" data-new-resume>新建简历</button><span class="field-help">${facts.filter(f=>f.status==='confirmed').length} 条已确认事实可供选材</span></div>`);
   const cached=[...sessions],cachedIds=new Set(cached.map(([,session])=>session.draft.id).filter(Boolean));
   if(drafts.length||cached.length)area.innerHTML='<div class="resume-list">'+cached.map(([key,{draft:d}])=>`<button class="record-row" data-resume-session="${key}"><div><h3>${esc(d.roleTitle||'未命名简历')}</h3><p>保留当前会话中的编辑 · ${d.sections.flatMap(s=>s.factIds).length} 条事实</p></div><span>继续编辑 ↗</span></button>`).join('')+drafts.filter(d=>!cachedIds.has(d.id)).map(d=>`<button class="record-row" data-draft="${d.id}"><div><h3>${esc(d.roleTitle||'未命名简历')}</h3><p>草稿 v${d.revision} · ${d.sections.flatMap(s=>s.factIds).length} 条事实</p></div><span>继续编辑 ↗</span></button>`).join('')+'</div>';
   root.onclick=event=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-new-resume],[data-draft],[data-resume-session]');if(!button)return;const cached=button.dataset.resumeSession?sessions.get(button.dataset.resumeSession):undefined;if(cached)edit(cached.draft,cached.edits,button.dataset.resumeSession);else edit(drafts.find(d=>d.id===button.dataset.draft));};
  }catch(error){if(alive)root.insertAdjacentHTML('beforeend',`<p class="issue">${esc((error as Error).message)}</p>`);}
 };
 void load();return()=>{alive=false;cleanup?.();root.onclick=null;};
}
