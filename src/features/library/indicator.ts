import type {LibraryInfo} from '../../../shared/api';
import {api} from '../../api/client';
import {escapeHtml as esc} from '../../ui/html';
import {openModal} from '../../ui/modal';

export function mountLibraryIndicator(button:HTMLButtonElement,onManage:(trigger:HTMLElement)=>void){
 const name=button.querySelector<HTMLElement>('[data-library-name]')!;
 const controller=new AbortController();
 let alive=true,pending:Promise<LibraryInfo>|undefined;

 function refresh():Promise<LibraryInfo>{
  if(pending)return pending;
  button.dataset.state='loading';name.textContent='正在读取…';
  pending=api<LibraryInfo>('library',undefined,controller.signal).then(info=>{
   if(alive){name.textContent=info.name;button.dataset.state='connected';}
   return info;
  }).catch(error=>{
   if(alive){name.textContent='连接失败，点击重试';button.dataset.state='error';}
   throw error;
  }).finally(()=>{pending=undefined;});
  return pending;
 }

 function open(){
  const panel=document.createElement('section');
  panel.className='library-modal';panel.setAttribute('aria-label','当前资料库');
  panel.innerHTML=`<div class="modal-top"><span>LIBRARY / 本机资料库</span><button data-close>关闭 ×</button></div>
   <h2>当前资料库</h2><div data-library-details></div><p class="field-help" role="status"></p>
   <div class="modal-bottom"><span>资料保存在本机</span><button class="text-button" data-library-manage>管理资料位置 ↗</button></div>`;
  const handle=openModal(panel,button);if(!panel.isConnected)return;
  const details=panel.querySelector<HTMLElement>('[data-library-details]')!,status=panel.querySelector<HTMLElement>('[role=status]')!;
  const load=async()=>{
   status.textContent='正在读取当前资料库…';details.replaceChildren();
   try{
    const info=await refresh();if(!panel.isConnected)return;
    const active=info.dossierCount-info.archivedDossierCount;
    details.innerHTML=`<p class="library-title">${esc(info.name)}</p><p class="library-state">已连接 · 本机目录</p>
     <dl class="library-location"><dt>资料库位置</dt><dd data-library-directory>${esc(info.directory)}</dd></dl>
     <div class="library-counts"><div><span>在用档案</span><b data-library-count="dossiers">${active}</b><small>份</small></div>
      <div><span>已归档</span><b data-library-count="archived">${info.archivedDossierCount}</b><small>份</small></div>
      <div><span>材料</span><b data-library-count="sources">${info.sourceCount}</b><small>份</small></div></div>
     <p class="field-help">${info.dossierCount===0?'这是一个空资料库。新建档案或添加材料后，内容会保存在这个目录。':'当前页面读取此目录中的档案与材料。'}</p>
     <p class="field-help">发行包不附带你的本机资料。更换资料库需要在设置中主动选择。</p>`;
    status.textContent='';
   }catch(error){
    if(!panel.isConnected)return;
    status.textContent='暂时无法读取资料库，请检查本机服务后重试。';
    details.innerHTML='<button class="outline-button" data-library-retry>重新读取</button>';
   }
  };
  panel.addEventListener('click',event=>{
   const target=(event.target as HTMLElement).closest<HTMLElement>('button');
   if(target?.hasAttribute('data-library-retry'))void load();
   else if(target?.hasAttribute('data-library-manage'))handle.close(()=>onManage(button));
  });
  void load();
 }
 return {refresh,open,dispose(){alive=false;controller.abort();}};
}
