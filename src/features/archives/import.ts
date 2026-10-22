import { api } from '../../api/client';
import {openModal} from '../../ui/modal';

export function importLibrary(trigger:HTMLElement,onImported:()=>void,onState:(message:string)=>void){
 const panel=document.createElement('section');panel.setAttribute('aria-label','导入已有资料');
 panel.innerHTML=`<div class="modal-top"><span>RHINE / IMPORT</span><button data-close>关闭 ×</button></div>
  <h2>导入已有资料</h2><p class="field-help">从空库开始，可直接新建档案并添加材料。已有整理好的文件时，将 JSON 清单放在当前资料库中，再填写它的相对路径。</p>
  <form class="catalog-form"><label>清单相对路径<input name="manifestPath" value="资料库清单.json" required placeholder="例如 索引/catalog.json"></label>
  <p class="field-help">清单记录文件的相对路径、所属档案和分类。可参考发行包 examples/catalog.json。资料库位置可在设置中查看和更换。</p>
  <div class="form-actions"><button class="outline-button" type="submit">开始导入</button><span role="status"></span></div></form>`;
 const handle=openModal(panel,trigger),form=panel.querySelector('form')!,status=panel.querySelector<HTMLElement>('[role=status]')!;
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!;button.disabled=true;status.textContent='正在核对清单与原件…';
  try{const report=await api<{sourceCount:number;originCount:number;errors:unknown[];missing:number}>('sources/import',{manifestPath:String(new FormData(form).get('manifestPath')??'')});
   const message=`已登记 ${report.sourceCount} 份材料、${report.originCount} 条来源；缺失 ${report.missing}，错误 ${report.errors.length}。`;
   if(report.missing||report.errors.length){status.textContent=message;onImported();}
   else handle.close(()=>{onImported();onState(message);});
  }catch(error){status.textContent=(error as Error).message;}finally{button.disabled=false;}
 };
 return handle;
}
