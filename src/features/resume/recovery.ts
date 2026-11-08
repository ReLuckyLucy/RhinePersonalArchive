import type {ResumeRecovery,ResumeRecoveryInput} from '../../../shared/resume-recovery';
import {api} from '../../api/client';

export type RecoveryHandle={id?:string;revision?:number;dirty?:boolean;releaseGuard?:()=>void};

export function resumeRecovery(handle:RecoveryHandle,read:()=>ResumeRecoveryInput,report:(message:string)=>void){
 let desired=handle.dirty?1:0,persisted=0,tail=Promise.resolve(),timer:ReturnType<typeof setTimeout>|undefined,detached=false;
 handle.releaseGuard?.();
 const guard=(event:BeforeUnloadEvent)=>{if(desired>persisted){event.preventDefault();event.returnValue='';}};
 window.addEventListener('beforeunload',guard);
 const release=()=>{window.removeEventListener('beforeunload',guard);if(handle.releaseGuard===release)handle.releaseGuard=undefined;};handle.releaseGuard=release;
 const notify=(message:string)=>{if(!detached)report(message);};
 const complete=()=>{handle.dirty=desired>persisted;if(detached&&!handle.dirty)release();};
 function flush(){
  clearTimeout(timer);
  const task=tail.then(async()=>{
   while(persisted<desired){
    const captured=desired,snapshot=read();
    const saved=await api<ResumeRecovery>('resume-recoveries',{id:handle.id,input:snapshot,expectedRevision:handle.revision??null});
    handle.id=saved.id;handle.revision=saved.revision;persisted=captured;
   }
   if(handle.id)notify('编辑已自动保存在当前资料库；保存并预览后才成为正式草稿。');complete();
  });
  tail=task.catch(error=>{handle.dirty=true;notify('自动保存失败：'+(error as Error).message+'。当前输入仍保留，请勿刷新。');});
  return tail;
 }
 function changed(){desired++;handle.dirty=true;notify('正在保留编辑…');clearTimeout(timer);timer=setTimeout(()=>void flush(),450);}
 // Serialize cleanup with checkpoint writes. A newer edit must survive a formal save.
 function saved(isCurrent:()=>boolean){
  clearTimeout(timer);
  const task=tail.then(async()=>{
   if(!isCurrent()){changed();return;}
   const captured=desired;
   if(handle.id)await api('resume-recoveries/'+handle.id+'/discard',{expectedRevision:handle.revision});
   handle.id=undefined;handle.revision=undefined;persisted=captured;complete();
   if(desired===captured)notify('已正式保存；后续编辑会继续自动保留。');
  });
  tail=task.catch(error=>{handle.dirty=true;notify('恢复记录整理失败：'+(error as Error).message+'。请保留当前页面。');});
  return tail.then(()=>desired>persisted?flush():undefined);
 }
 function suspend(pending?:Promise<void>){detached=true;clearTimeout(timer);return Promise.resolve(pending).then(()=>flush()).finally(complete);}
 function saveCopy(){const task=tail.then(()=>{handle.id=undefined;handle.revision=undefined;changed();});tail=task;return task.then(flush);}
 if(handle.dirty){notify('正在保留编辑…');timer=setTimeout(()=>void flush(),450);}
 else notify(handle.id?'已恢复当前资料库中的编辑；尚未正式保存。':'编辑会自动保留在当前资料库。');
 return{changed,flush,saved,suspend,saveCopy};
}
