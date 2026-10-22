export type Route = 'archives' | 'review' | 'resume';
export const categories = [
  ['all','全部档案'],['education','教育背景'],['work','工作与实习'],['project','项目作品'],
  ['award','竞赛与荣誉'],['research','科研与知识产权'],['volunteer','组织与志愿'],['portfolio','个人作品集'],
] as const;
export type ViewState = { route:Route; category:string; selectedId:string|null; favoriteOnly:boolean };
export function initialView():ViewState {
  const route = localStorage.getItem('rhine:last-page');
  return { route: route==='resume'||route==='review' ? route:'archives',category:'all',selectedId:null,favoriteOnly:false };
}
