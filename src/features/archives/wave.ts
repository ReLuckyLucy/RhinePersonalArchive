import type {Dossier} from '../../../shared/domain';
import type {ViewState} from '../../app/state';
import {categories} from '../../app/state';
import {prefs} from '../../ui/preferences';
import {hasModal} from '../../ui/modal';
import {escapeHtml as esc} from '../../ui/html';
import {createRollingText} from '@kitlangton/rolling-number';
import type {ArchiveScene} from '../../rhine/scene';
import {setDossiers,records,archiveColumns,columnFiles,fileLocation} from '../../rhine/data';
import {wrap,type ArchiveNavigation} from '../../rhine/archive-loop';
import {mountDetail} from './detail';
import type {Hit} from '../search/modal';

type Actions={read(id:string):void;back():void;edit(d:Dossier):void;changed():void};
const label=(kind:string)=>categories.find(([key])=>key===kind)?.[1]??'参考资料';
export const waveData=(dossiers:Dossier[],state:ViewState)=>dossiers.filter(d=>!state.favoriteOnly||d.favorite).sort((a,b)=>a.id.localeCompare(b.id));
export const waveKey=(data:Dossier[])=>data.map(d=>`${d.id}:${d.kind}`).join('|');

export function mountWaveArchive(root:HTMLElement,data:Dossier[],state:ViewState,actions:Actions){
 setDossiers(data);
 root.innerHTML=`<section class="wave-stage" data-mode="archive" aria-label="动态个人档案阵列"><div class="wave-scene"></div><div class="wave-heading"><span class="eyebrow">PERSONAL ARCHIVE / 私人资料库</span><h1>个人档案<span> / </span><small>${String(data.length).padStart(2,'0')}</small></h1><p>每一份经历，都有迹可循。</p></div><div class="wave-tools"><button class="text-button" data-action="import" aria-label="导入清单">导入清单</button><button class="text-button" data-action="archived">已归档</button><button class="text-button" data-action="new-dossier" aria-label="新建档案">新建档案 ＋</button></div><div class="wave-loading" role="status">正在载入档案阵列…</div><section class="wave-selection" aria-label="当前档案"><div class="wave-meta"></div><h2></h2><p></p><button class="solid-button" aria-label="读取档案" data-wave-read data-read="current">读取档案 <span>↗</span></button></section><div class="wave-bottom"><div class="wave-navigation"><button aria-label="上一份档案" data-wave-step="-1">↑</button><div class="wave-index" aria-label="当前分类档案"></div><button aria-label="下一份档案" data-wave-step="1">↓</button><span class="wave-count"></span></div><nav class="wave-categories" aria-label="档案分类"></nav><p class="wave-help">拖动浏览 · 滚轮切档 · 方向键切换 · Enter 读取</p></div><section class="wave-document" aria-label="个人档案详情" hidden tabindex="-1"></section></section>`;
 const stage=root.querySelector<HTMLElement>('.wave-stage')!,host=root.querySelector<HTMLElement>('.wave-scene')!,panel=root.querySelector<HTMLElement>('.wave-document')!,loading=root.querySelector<HTMLElement>('.wave-loading')!;
 const heading=root.querySelector<HTMLElement>('.wave-selection h2')!,selection=root.querySelector<HTMLElement>('.wave-selection')!;
 let scene:ArchiveScene|undefined,alive=true,frame=0,detailId:string|undefined,detailDispose:(()=>void)|undefined,closeTimer:ReturnType<typeof setTimeout>|undefined;
 let loadAbort:AbortController|undefined;
 let index=Math.max(0,data.findIndex(d=>d.id===state.selectedId)),lastStats=0,detailHitKey='';
 const memory=new Map<string,string>();
 let title:ReturnType<typeof createRollingText>|undefined;
 const layout=()=>{stage.dataset.layout=innerWidth/innerHeight<1.05?'portrait':innerWidth<1100?'compact':'desktop';scene?.resize();};
 const paint=()=>{
  const d=records[index];if(!d)return;
  state.selectedId=d.id;state.category=d.kind;stage.dataset.selectedId=d.id;memory.set(d.kind,d.id);
  root.querySelector<HTMLElement>('[data-wave-read]')!.dataset.read=d.id;
  root.querySelector('.wave-help')!.textContent=prefs.reduced?'减少动态效果已开启 · 可在设置中恢复波浪与惯性':'拖动浏览 · 滚轮切档 · 方向键切换 · Enter 读取';
  root.querySelector('.wave-meta')!.textContent=`${label(d.kind)} / ${d.dateRange.start.value??'日期待核对'}`;
  if(!title)title=createRollingText(heading,{text:d.title,duration:460,animated:!prefs.reduced,mode:'roll',direction:'up',stagger:'none'});
  else title.update({text:d.title,animated:!prefs.reduced});
  selection.querySelector('p')!.textContent=d.role||d.organization||'个人角色与材料待核对';
  const files=columnFiles(fileLocation(index).lane);
  root.querySelector('.wave-index')!.innerHTML=files.map((i,n)=>`<button data-dossier="${records[i].id}" data-wave-index="${i}" aria-label="${esc(records[i].title)}" aria-pressed="${i===index}" title="${esc(records[i].title)}"><span>${String(n+1).padStart(2,'0')}</span><span class="visually-hidden">${esc(records[i].title)}</span></button>`).join('');
  root.querySelector('.wave-count')!.textContent=`${String(files.indexOf(index)+1).padStart(2,'0')} / ${String(files.length).padStart(2,'0')}`;
  root.querySelector('.wave-categories')!.innerHTML=archiveColumns.map((kind,n)=>`<button data-wave-category="${kind}" aria-current="${d.kind===kind}"><span>${String(n+1).padStart(2,'0')}</span>${label(kind)}</button>`).join('');
 };
 const select=(next:number,navigation?:ArchiveNavigation)=>{
  if(!records[next])return;index=next;scene?.select(index,navigation);paint();
 };
 const step=(axis:'row'|'lane',direction:number)=>{
  if(!records.length)return;
  const pos=fileLocation(index);
  if(axis==='row'){const files=columnFiles(pos.lane);select(files[wrap(files.indexOf(index)+direction,files.length)],{axis,direction});}
  else{const lane=wrap(pos.lane+direction,archiveColumns.length),files=columnFiles(lane);select(files.find(i=>records[i].id===memory.get(archiveColumns[lane]))??files[0],{axis,direction});}
 };
 const showDetail=(id?:string,hit?:Hit)=>{
  const hitKey=JSON.stringify(hit??null);
  if(detailId===id&&(!id||detailHitKey===hitKey))return;
  detailHitKey=hitKey;
  if(closeTimer)clearTimeout(closeTimer);
  detailDispose?.();detailDispose=undefined;detailId=id;
  stage.dataset.mode=id?'detail':'archive';
  selection.inert=!!id;root.querySelector<HTMLElement>('.wave-bottom')!.inert=!!id;
  if(id){
   const next=records.findIndex(d=>d.id===id);if(next>=0&&next!==index)select(next);
   scene?.setMode('detail');panel.hidden=false;panel.inert=false;
   detailDispose=mountDetail(panel,id,actions.back,actions.edit,actions.changed,hit);
   panel.focus({preventScroll:true});
  }else{
   scene?.setMode('archive');panel.inert=true;
   closeTimer=setTimeout(()=>{panel.hidden=true;panel.replaceChildren();},prefs.reduced?0:180);
   root.querySelector<HTMLButtonElement>('[data-wave-read]')?.focus({preventScroll:true});
  }
 };
 const start=async()=>{
  loading.hidden=false;loading.textContent='正在载入档案阵列…';
  let pending:ArchiveScene|undefined;
  try{
   const {ArchiveScene}=await import('../../rhine/scene');if(!alive)return;
   pending=new ArchiveScene(host);scene=pending;
   scene.setTheme(prefs.dark,true);scene.setReduced(prefs.reduced);layout();
   loadAbort=new AbortController();
   await scene.load(undefined,loadAbort.signal);
   if(!alive){pending.dispose();return;}
   scene.select(index);scene.setMode(detailId?'detail':'archive');scene.select(index);scene.resize();
   scene.onSelect=(i,physicalCell)=>{if(!detailId&&!hasModal())select(i,physicalCell?{cell:physicalCell}:undefined);};
   scene.onNavigate=(axis,direction)=>{if(!detailId&&!hasModal())step(axis,direction);};
   host.dataset.ready='true';loading.hidden=true;
   const tick=(ms:number)=>{
    if(!alive)return;
    if(!document.hidden){
     scene!.update(ms/1000);
     stage.style.setProperty('--detail-shade',String(scene!.detailVisibility));
     if(detailId){panel.style.opacity=String(scene!.detailVisibility);panel.style.translate=`0 ${(1-scene!.detailVisibility)*18}px`;}
     if(ms-lastStats>150){host.dataset.stats=JSON.stringify(scene!.getStats());lastStats=ms;}
    }
    frame=requestAnimationFrame(tick);
   };
   frame=requestAnimationFrame(tick);
  }catch(error){
   pending?.dispose();scene=undefined;
   if(alive){loading.replaceChildren();loading.append(document.createTextNode('档案阵列载入失败。'));const retry=document.createElement('button');retry.className='outline-button';retry.textContent='重新载入';retry.onclick=()=>void start();loading.append(retry);console.error(error);}
  }
 };
 const click=(event:MouseEvent)=>{
  const b=(event.target as HTMLElement).closest<HTMLElement>('[data-wave-index],[data-wave-category],[data-wave-step],[data-wave-read]');if(!b)return;
  event.stopPropagation();
  if(b.dataset.waveIndex!==undefined)select(Number(b.dataset.waveIndex));
  else if(b.dataset.waveCategory){const files=columnFiles(archiveColumns.indexOf(b.dataset.waveCategory));select(files.find(i=>records[i].id===memory.get(b.dataset.waveCategory!))??files[0]);}
  else if(b.dataset.waveStep)step('row',Number(b.dataset.waveStep));
  else actions.read(records[index].id);
 };
 const key=(e:KeyboardEvent)=>{
  if(hasModal()||root.inert||(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]')))return;
  if(detailId){if(e.key==='Escape'){e.preventDefault();actions.back();}return;}
  const moves:Record<string,['row'|'lane',number]>={ArrowUp:['row',-1],ArrowDown:['row',1],ArrowLeft:['lane',-1],ArrowRight:['lane',1]};
  if(moves[e.key]){e.preventDefault();step(...moves[e.key]);}
  else if(e.key==='Enter'&&!(e.target instanceof HTMLElement&&e.target.closest('button,a'))&&records[index]){e.preventDefault();actions.read(records[index].id);}
 };
 const doubleClick=()=>{if(!detailId&&!hasModal()&&records[index])actions.read(records[index].id);};
 root.addEventListener('click',click);host.addEventListener('dblclick',doubleClick);document.addEventListener('keydown',key);window.addEventListener('resize',layout);
 const preferences=new MutationObserver(()=>{scene?.setTheme(prefs.dark,prefs.reduced);scene?.setReduced(prefs.reduced);paint();});
 preferences.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-motion']});
 if(records.length){paint();void start();}
 else{
  loading.innerHTML=`<h2>${state.favoriteOnly?'还没有收藏档案':'让经历，有迹可循。'}</h2><p>${state.favoriteOnly?'打开一份档案后，可以将它加入收藏。':'新建一份档案，再添加项目文档或证明材料，即可开始整理。'}</p>${state.favoriteOnly?'':'<button class="solid-button" data-action="new-dossier" aria-label="创建第一份档案">创建第一份档案 ↗</button><button class="text-button" data-action="import">导入已有清单</button>'}`;
  selection.hidden=true;root.querySelector<HTMLElement>('.wave-bottom')!.hidden=true;
 }
 return {
  showDetail,
  update(next:Dossier[]){setDossiers(next);const selected=records.findIndex(d=>d.id===state.selectedId);if(selected>=0&&selected!==index)select(selected);else paint();},
  dispose(){alive=false;loadAbort?.abort();cancelAnimationFrame(frame);if(closeTimer)clearTimeout(closeTimer);detailDispose?.();title?.destroy();preferences.disconnect();scene?.dispose();root.removeEventListener('click',click);host.removeEventListener('dblclick',doubleClick);document.removeEventListener('keydown',key);window.removeEventListener('resize',layout);},
 };
}
