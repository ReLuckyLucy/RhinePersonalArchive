import {mountDataSettings} from './features/settings/page';
import {browseArchived} from './features/archives/organize';
import './styles/base.css';
import './styles/layout.css';
import './styles/theme.css';
import './styles/wave.css';
import '@kitlangton/rolling-number/styles.css';
import { initialView,type Route } from './app/state';
import { rememberRoute } from './app/router';
import {mountWaveArchive,waveData,waveKey} from './features/archives/wave';
import { importLibrary } from './features/archives/import';
import type { Dossier } from '../shared/domain';
import { openModal,hasModal } from './ui/modal';
import { prefs,applyPreferences,savePreferences } from './ui/preferences';
import { playClick } from './ui/audio';
import { logo } from './ui/brand';
import { api } from './api/client';
import { openSearch,type Hit } from './features/search/modal';
import {mountDossierEditor} from './features/archives/editor';
import {mountReview} from './features/review/page';
import {mountResume} from './features/resume/workspace';
export interface AppShell {navigate(route:Route):void;dispose():void}
export function mountShell(root:HTMLElement):AppShell {
  applyPreferences();const state=initialView();
  root.innerHTML=`<header class="app-header"><a class="brand" href="#" aria-label="Rhine 个人档案"><strong>RHINE LAB</strong><span>PERSONAL INFORMATION</span><div>ARCHIVE <b>OS</b></div></a><nav class="main-nav" aria-label="页面导航"><button data-route="archives" aria-label="个人档案"><span>01</span> 个人档案</button><button data-route="review" aria-label="待整理"><span>02</span> 待整理</button><button data-route="resume" aria-label="简历工作台"><span>03</span> 简历工作台</button></nav><nav class="utility-nav" aria-label="系统导航"><button data-action="search" aria-label="检索档案"><i class="search-icon"></i><span>ARCHIVE INDEX</span><kbd>/</kbd></button><button data-action="saved" aria-label="收藏档案">＋<span>SAVED</span><b>00</b></button><button data-action="settings" aria-label="设置">◷ <span>设置</span></button></nav></header><main id="workspace"></main><footer class="app-footer"><span><i class="status-dot"></i><span id="connection-label">LOCAL ARCHIVE / 准备连接</span></span><span>YOUR HISTORY, IN YOUR HANDS.</span><span>PRIVATE SESSION <i>/</i> <time></time></span></footer><div class="toast" role="status" hidden></div>`;
  const main=root.querySelector<HTMLElement>('main')!;
  let dossiers:Dossier[]=[];let disposePage:(()=>void)|undefined;let detailId:string|undefined,editing:Dossier|'new'|undefined,selectedHit:Hit|undefined;
  let wave:ReturnType<typeof mountWaveArchive>|undefined,waveIdentity='';
  const updateCache=(saved:Dossier)=>{dossiers=[...dossiers.filter(d=>d.id!==saved.id),saved];state.selectedId=saved.id;};
  const back=()=>{detailId=undefined;editing=undefined;render();main.querySelector<HTMLElement>('[data-dossier="'+state.selectedId+'"]')?.focus({preventScroll:true});};
  const read=(id:string,hit?:Hit)=>{state.selectedId=id;if(!dossiers.find(d=>d.id===id)?.favorite)state.favoriteOnly=false;void api('dossiers/'+id+'/visit',{}).catch(()=>{});detailId=id;editing=undefined;selectedHit=hit;state.route='archives';render();};
  const refresh=()=>api<Dossier[]>('dossiers').then(data=>{dossiers=data;root.querySelector('#connection-label')!.textContent='LOCAL ARCHIVE / 已连接';render();}).catch(()=>{root.querySelector('#connection-label')!.textContent='LOCAL ARCHIVE / 连接失败，请检查本机服务';});
  const showToast=(message:string)=>{const el=root.querySelector<HTMLElement>('.toast')!;el.textContent=message;el.hidden=false;setTimeout(()=>el.hidden=true,3500);};
  const changed=()=>{void api<Dossier[]>('dossiers').then(data=>{
    dossiers=data;
    if(detailId&&!waveData(data,state).some(d=>d.id===detailId)){detailId=undefined;selectedHit=undefined;}
    if(state.route==='archives'&&!editing)render();
  }).catch(()=>showToast('档案列表刷新失败，请重新打开个人档案。'));};
  const render=()=>{
    root.querySelectorAll<HTMLButtonElement>('.main-nav [data-route]').forEach(b=>{b.classList.toggle('active',b.dataset.route===state.route);b.setAttribute('aria-current',b.dataset.route===state.route?'page':'false');});
    root.querySelector('[data-action="saved"] b')!.textContent=String(dossiers.filter(d=>d.favorite).length).padStart(2,'0');
    if(state.route==='archives'&&!editing){
      const data=waveData(dossiers,state),identity=waveKey(data);
      if(!wave||waveIdentity!==identity){disposePage?.();disposePage=undefined;wave?.dispose();wave=mountWaveArchive(main,data,state,{read,back,edit:d=>{editing=d;render();},changed});waveIdentity=identity;}
      else wave.update(data);
      wave.showDetail(detailId,selectedHit);return;
    }
    wave?.dispose();wave=undefined;disposePage?.();disposePage=undefined;
    if(editing){disposePage=mountDossierEditor(main,editing==='new'?undefined:editing,updateCache,back);return;}
    if(state.route==='review'){disposePage=mountReview(main,read);return;}
    if(state.route==='resume'){disposePage=mountResume(main,(id,factId)=>read(id,{id:factId,entityType:'fact',title:'',snippet:'',status:''}));return;}
  };
  const navigate=(route:Route)=>{detailId=undefined;editing=undefined;state.route=route;rememberRoute(route);render();};
  const showSearch=(trigger:HTMLElement)=>openSearch(trigger,hit=>read(hit.dossierId??hit.id,hit));
  const showSettings=(trigger:HTMLElement)=>{const panel=document.createElement('section');panel.setAttribute('aria-label','设置');panel.innerHTML=`<div class="modal-top"><span>RHINE LAB / PREFERENCES</span><button data-close>CLOSE ×</button></div><h2>SYSTEM SETTINGS <small>本机偏好</small></h2><div class="settings-row"><div><strong>明暗配色</strong><p>沿用 Rhine 的暖灰与石墨配色。</p></div><button class="outline-button" data-setting="theme" aria-label="切换明暗配色">切换配色 ↗</button></div><div class="settings-row"><div><strong>减少动态效果</strong><p>直接显示文字与面板。</p></div><input type="checkbox" aria-label="减少动态效果" data-setting="motion" ${prefs.reduced?'checked':''}></div><div class="settings-row"><div><strong>交互音效</strong><p>轻微的系统提示音，默认关闭。</p></div><input type="checkbox" aria-label="交互音效" data-setting="sound" ${prefs.sound?'checked':''}></div><div class="modal-bottom"><span>MiSans / 小米</span><a href="/fonts/MiSans-license.pdf" target="_blank" rel="noopener">字体许可 ↗</a></div>`;panel.addEventListener('click',e=>{const target=(e.target as HTMLElement).closest<HTMLElement>('[data-setting]');if(!target)return;if(target.dataset.setting==='theme')prefs.dark=!prefs.dark;else if(target.dataset.setting==='motion')prefs.reduced=(target as HTMLInputElement).checked;else prefs.sound=(target as HTMLInputElement).checked;savePreferences();});openModal(panel,trigger);const dataSettings=document.createElement('section');panel.querySelector('.modal-bottom')!.before(dataSettings);mountDataSettings(dataSettings);};
  const click=(event:MouseEvent)=>{const button=(event.target as HTMLElement).closest<HTMLElement>('[data-route],[data-action],[data-read]');if(!button)return;playClick();if(button.dataset.read){read(button.dataset.read);}else if(button.dataset.route)navigate(button.dataset.route as Route);else switch(button.dataset.action){case'archived':void browseArchived(button,refresh);break;case'new-dossier':editing='new';render();break;case'search':showSearch(button);break;case'saved':state.favoriteOnly=!state.favoriteOnly;navigate('archives');break;case'settings':showSettings(button);break;case'import':importLibrary(button,()=>void refresh(),showToast);break;}};
  const key=(e:KeyboardEvent)=>{if(e.key==='/'&&!hasModal()&&!(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]'))){e.preventDefault();showSearch(root.querySelector('[data-action="search"]')!);}};
  root.addEventListener('click',click);document.addEventListener('keydown',key);
  const tick=()=>{root.querySelector('time')!.textContent=new Date().toLocaleTimeString('en-GB',{hour12:false});};tick();const timer=setInterval(tick,1000);render();void refresh();
  if(!prefs.reduced&&!sessionStorage.getItem('rhine:entered')){const boot=document.createElement('button');boot.className='short-boot';boot.setAttribute('aria-label','跳过入场');boot.innerHTML=`${logo}<span>PERSONAL ARCHIVE / READY</span>`;document.body.append(boot);const finish=()=>{boot.remove();sessionStorage.setItem('rhine:entered','1');};boot.onclick=finish;setTimeout(finish,1000);}
  return {navigate,dispose(){wave?.dispose();disposePage?.();clearInterval(timer);root.removeEventListener('click',click);document.removeEventListener('keydown',key);root.replaceChildren();}};
}
mountShell(document.querySelector<HTMLElement>('#app')!);
