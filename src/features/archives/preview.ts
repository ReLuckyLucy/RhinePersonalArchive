import type {Source,EvidenceLink} from '../../../shared/domain';
import {api} from '../../api/client';
import {escapeHtml} from '../../ui/html';

export function renderPreview(root:HTMLElement,source:Source) {
 let disposed=false,zoom=1,locator:EvidenceLink['locator']|undefined;
 const controller=new AbortController();
 const url=`/api/sources/${source.id}/file?version=${source.version}`;
 root.innerHTML=`<div class="preview-toolbar"><span>${escapeHtml(source.name)} · 版本 ${source.version}</span><button data-zoom="-" aria-label="缩小原件">−</button><button data-zoom="+" aria-label="放大原件">＋</button><a href="${url}&download=1">下载原件 ↗</a></div><div class="preview-body"><p>正在核对原件版本…</p></div>`;
 const body=root.querySelector<HTMLElement>('.preview-body')!;
 const isText=source.kind!=='pdf'&&!['png','jpg','jpeg','webp'].includes(source.kind);
 async function refreshText(){
  if(!isText||disposed)return;
  try{
   const doc=await api<{text:string;paragraphs?:string[]}>(`sources/${source.id}/text?version=${source.version}`,undefined,controller.signal);
   if(disposed)return;
   const text=document.createElement('div');text.className='text-preview';text.style.zoom=String(zoom);
   (doc.paragraphs??doc.text.split(/\n\s*\n/)).forEach((value,index)=>{const paragraph=document.createElement('pre');paragraph.dataset.paragraph=String(index+1);paragraph.textContent=value;text.append(paragraph);});
   body.replaceChildren(text);locate();
  }catch(error){if(!disposed)body.textContent=error instanceof Error?error.message:'暂不能预览，请打开原件。';}
 }
 function locate() {
  if(!locator||disposed)return;
  const frame=body.querySelector('iframe');
  if(frame&&locator.type==='page'){const target=`${url}#page=${locator.index??1}`;if(frame.getAttribute('src')!==target)frame.src=target;}
  if(locator.type==='paragraph') {
   body.querySelectorAll('.located').forEach(el=>el.classList.remove('located'));
   const paragraph=body.querySelector<HTMLElement>(`[data-paragraph="${Math.max(1,locator.index??1)}"]`);
   paragraph?.classList.add('located');paragraph?.scrollIntoView({block:'nearest'});
  }
 }
 void(async()=>{
  try {
   const response=await fetch(url,{method:'HEAD',signal:controller.signal});
   if(!response.ok)throw new Error('该证明版本已不可用，请核对来源或重新导入。不会用新版替代旧版。');
   if(disposed)return;
   if(source.kind==='pdf')body.innerHTML=`<iframe title="PDF 原件" src="${url}#toolbar=1"></iframe>`;
   else if(['png','jpg','jpeg','webp'].includes(source.kind))body.innerHTML=`<img alt="原始材料" src="${url}">`;
   else await refreshText();
   locate();
  }catch(error){if(!disposed)body.textContent=error instanceof Error?error.message:'暂不能预览，请打开原件。';}
 })();
 root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.max(.5,Math.min(3,zoom+(b.dataset.zoom==='+'?.2:-.2)));const el=body.querySelector<HTMLElement>('img,.text-preview');if(el)el.style.zoom=String(zoom);});
 return {goTo(value:EvidenceLink['locator']){locator=value;locate();},refreshText,dispose(){disposed=true;controller.abort();root.replaceChildren();}};
}
