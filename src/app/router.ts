import type { Route } from './state';
export function rememberRoute(route:Route) { localStorage.setItem('rhine:last-page',route); }
