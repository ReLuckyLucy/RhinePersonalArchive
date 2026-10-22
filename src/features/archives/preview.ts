import type {Source,EvidenceLink} from '../../../shared/domain';
import {api} from '../../api/client';
import {escapeHtml} from '../../ui/html';

export function renderPreview(root:HTMLElement,source:Source) {
 let disposed=false,zoom=1,locator:EvidenceLink['locator']|undefined,generation=0;
 const controller=new AbortController();
 const url=`/api/sources/${source.id}/file?version=${source.version}`;
 const visual=source.kind==='pdf'||['png','jpg','jpeg','webp','bmp'].includes(source.kind);
 let mode:'file'|'text'=visual?'file':'text';
 root.innerHTML=`<div class="preview-toolbar"><span>${escapeHtml(source.name)} · 版本 ${source.version}</span><a href="${url}&download=1">下载原件 ↗</a></div>
  <div class="preview-controls"><div class="preview-modes" role="tablist" aria-label="材料阅读方式">${visual?'<button role="tab" data-preview-mode="file">原件</button>':''}<button role="tab" data-preview-mode="text">提取文字</button></div><div class="preview-zoom"><button data-zoom="-" aria-label="缩小原件">−</button><button data-zoom="+" aria-label="放大原件">＋</button></div></div><p class="preview-note" data-preview-note></p><div class="preview-body"><p>正在核对原件版本…</p></div>`;
 const body=root.querySelector<HTMLElement>('.preview-body')!;
 const note=root.querySelector<HTMLElement>('[data-preview-note]')!;
 const checked=fetch(url,{method:'HEAD',signal:controller.signal}).then(response=>response.ok).catch(()=>false);
 function controls(){
  root.querySelectorAll<HTMLElement>('[data-preview-mode]').forEach(button=>{const selected=button.dataset.previewMode===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  root.querySelector<HTMLElement>('.preview-zoom')!.hidden=mode==='file'&&source.kind==='pdf';
 }
 async function draw(){
  const current=++generation;controls();body.innerHTML='<p>正在读取材料…</p>';
  try{
   if(!await checked)throw new Error('该证明版本已不可用，请核对来源或重新导入。不会用新版替代旧版。');
   if(disposed||current!==generation)return;
   if(mode==='file'){
    note.textContent=source.kind==='pdf'?'使用 PDF 原件工具栏翻页和缩放。':'当前显示原始图片。';
    body.innerHTML=source.kind==='pdf'?`<iframe title="PDF 原件" src="${url}#toolbar=1"></iframe>`:`<img alt="原始材料" src="${url}">`;
    const img=body.querySelector<HTMLElement>('img');if(img)img.style.zoom=String(zoom);locate();return;
   }
   const doc=await api<{text:string;paragraphs?:string[];revision:number}>(`sources/${source.id}/text?version=${source.version}`,undefined,controller.signal);
   if(disposed||current!==generation)return;
   note.textContent=doc.revision>1?'校对后的文字，原始文件保持原样。':'提取文字用于阅读与核对，排版以原件为准。';
   const text=document.createElement('div');text.className='text-preview';text.style.zoom=String(zoom);
   (doc.paragraphs??doc.text.split(/\n\s*\n/)).forEach((value,index)=>{const paragraph=document.createElement('pre');paragraph.dataset.paragraph=String(index+1);paragraph.textContent=value;text.append(paragraph);});
   body.replaceChildren(text);locate();
  }catch(error){if(!disposed&&current===generation){note.textContent='';body.textContent=error instanceof Error?error.message:'暂不能预览，请打开原件。';}}
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
 function switchMode(next:'file'|'text'){mode=next;void draw();}
 root.querySelectorAll<HTMLButtonElement>('[data-preview-mode]').forEach(button=>{
  button.onclick=()=>switchMode(button.dataset.previewMode as 'file'|'text');
  button.onkeydown=event=>{const buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-preview-mode]')];if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=buttons.indexOf(button),next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1)!:buttons[(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length];next.focus();switchMode(next.dataset.previewMode as 'file'|'text');};
 });
 void draw();
 root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.max(.5,Math.min(3,zoom+(b.dataset.zoom==='+'?.2:-.2)));const el=body.querySelector<HTMLElement>('img,.text-preview');if(el)el.style.zoom=String(zoom);});
 return {goTo(value:EvidenceLink['locator']){locator=value;if(value.type==='paragraph'&&mode!=='text')switchMode('text');else locate();},refreshText(){if(mode==='text')void draw();},dispose(){disposed=true;generation++;controller.abort();root.replaceChildren();}};
}
