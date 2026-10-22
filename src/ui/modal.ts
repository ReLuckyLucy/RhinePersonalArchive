import { SurfaceTransition } from './transitions';
import { prefs } from './preferences';
export type ModalHandle = { close(after?:()=>void):void };
let current:ModalHandle|undefined;
export function openModal(panel:HTMLElement,trigger:HTMLElement):ModalHandle {
  if(current)return current;
  const overlay=document.createElement('div');overlay.className='modal-overlay';overlay.append(panel);
  panel.classList.add('terminal-modal');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  const siblings=[...document.querySelectorAll<HTMLElement>('#app header,#app main,#app footer')].map(el=>({el,inert:el.inert}));
  siblings.forEach(({el})=>el.inert=true);document.body.append(overlay);
  const motion=new SurfaceTransition(overlay,panel);motion.show(prefs.reduced);
  let closing=false;
  const focusables=()=>[...panel.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href]')].filter(el=>!el.hidden);
  const key=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();handle.close();}
    if(event.key==='Tab'){const list=focusables(),first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  };
  const handle:ModalHandle={close(after){if(closing)return;closing=true;motion.hide(prefs.reduced,()=>{motion.dispose();overlay.remove();siblings.forEach(({el,inert})=>el.inert=inert);document.removeEventListener('keydown',key,true);trigger.isConnected&&trigger.focus();if(current===handle)current=undefined;after?.();});}};
  document.addEventListener('keydown',key,true);overlay.addEventListener('click',e=>{if(e.target===overlay || (e.target as HTMLElement).closest('[data-close]'))handle.close();});
  requestAnimationFrame(()=>{const list=focusables();(list.find(el=>el.tagName==='INPUT')??list[0])?.focus();});
  current=handle;return handle;
}
export function hasModal(){return Boolean(current);}
