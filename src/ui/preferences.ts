export const prefs = {
  dark: localStorage.getItem('rhine:theme')==='dark',
  reduced: localStorage.getItem('rhine:motion')==='reduce' || (localStorage.getItem('rhine:motion')===null && matchMedia('(prefers-reduced-motion: reduce)').matches),
  sound: localStorage.getItem('rhine:sound')==='on',
};
export function applyPreferences() { document.documentElement.dataset.theme=prefs.dark?'dark':'light'; document.documentElement.dataset.motion=prefs.reduced?'reduce':'full'; }
export function savePreferences() { for(const [key,value] of Object.entries({theme:prefs.dark?'dark':'light',motion:prefs.reduced?'reduce':'full',sound:prefs.sound?'on':'off'})) localStorage.setItem(`rhine:${key}`,value); applyPreferences(); }
