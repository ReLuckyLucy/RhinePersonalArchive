import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const scripts=import.meta.dirname;
export function systemOpenCommand(target,kind='source',platform=process.platform,env=process.env){
 if(env.RHINE_CONTAINER==='1')throw Object.assign(new Error('容器无法在宿主机打开文件，请使用下载；浏览器请手动访问显示的网址'),{code:'OPEN_UNAVAILABLE'});
 if(platform==='win32')return {command:'powershell.exe',args:['-NoProfile','-NonInteractive','-File',resolve(scripts,kind==='browser'?'open-browser.ps1':'open-source.ps1'),kind==='browser'?'-Url':'-SourceFile',target]};
 if(platform==='darwin')return {command:'open',args:[target]};
 if(platform==='linux'&&(env.DISPLAY||env.WAYLAND_DISPLAY))return {command:'xdg-open',args:[target]};
 throw Object.assign(new Error('当前环境没有桌面打开功能，请使用下载，或手动访问显示的网址'),{code:'OPEN_UNAVAILABLE'});
}
export async function openSourceFile(target,kind='source'){
 const {command,args}=systemOpenCommand(target,kind);
 await new Promise((done,reject)=>{const child=spawn(command,args,{windowsHide:true,stdio:'ignore'});child.once('error',reject);child.once('exit',code=>code===0?done():reject(Object.assign(new Error('无法打开，请使用下载或手动访问网址'),{code:'OPEN_FAILED'})));});
}
