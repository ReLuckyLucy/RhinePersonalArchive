import type {Dossier} from '../../../shared/domain';
import {uploadFile} from '../../api/client';
import {escapeHtml as esc} from '../../ui/html';
import {openModal} from '../../ui/modal';

export function addMaterial(trigger:HTMLElement,dossiers:Dossier[],selectedId:string|null,onNew:()=>void,onAdded:(id:string,open:boolean)=>void){
 const panel=document.createElement('section');panel.className='add-material-modal';panel.setAttribute('aria-label','添加材料');
 panel.innerHTML=`<div class="modal-top"><span>MATERIAL / 添加资料</span><button data-close>关闭 ×</button></div><h2>添加材料</h2>
  ${dossiers.length?`<form><label>归属档案<select name="dossierId" aria-label="归属档案" required><option value="">请选择档案</option>${[...dossiers].sort((a,b)=>a.title.localeCompare(b.title,'zh')).map(d=>`<option value="${d.id}" ${d.id===selectedId?'selected':''}>${esc(d.title)}</option>`).join('')}</select></label>
  <label class="material-file-field">选择材料文件<input type="file" name="file" aria-label="选择材料文件" required></label><p class="field-help">文件保存在当前资料库，并关联到上方档案。添加后可预览、提取文字；不会自动确认个人贡献。</p>
  <div class="form-actions"><button class="solid-button" type="submit">添加到档案</button><button class="text-button" type="button" data-new>先新建档案 →</button></div><p role="status"></p></form>`:'<p class="prose">当前没有可用档案。先为这段经历建立一份档案，再添加证明材料。</p><button class="solid-button" data-new>先新建档案 →</button>'}`;
 const handle=openModal(panel,trigger);
 panel.querySelector<HTMLButtonElement>('[data-new]')!.onclick=()=>handle.close(onNew);
 const form=panel.querySelector('form');if(!form)return;
 form.onsubmit=async event=>{
  event.preventDefault();const id=String(new FormData(form).get('dossierId')??''),file=form.querySelector<HTMLInputElement>('[type=file]')!.files?.[0];
  if(!file||!dossiers.some(d=>d.id===id))return;
  const status=form.querySelector<HTMLElement>('[role=status]')!,controls=[...form.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('input,select,button')];
  controls.forEach(el=>el.disabled=true);status.textContent='正在添加材料…';
  try{const report=await uploadFile(file,id);if(report.errors?.length||report.missing||!report.sourceIds?.length)throw new Error('材料未能登记，请检查文件后重试。');
   if(panel.isConnected)handle.close(()=>onAdded(id,true));else onAdded(id,false);
  }catch(error){if(panel.isConnected){status.textContent='添加失败：'+(error as Error).message;controls.forEach(el=>el.disabled=false);}}
 };
}
