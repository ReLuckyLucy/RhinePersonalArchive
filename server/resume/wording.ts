import type {Fact} from '../../shared/domain.ts';

// A narrow check for concrete additions; this does not certify semantic truth.
function markers(text:string) {
 const normalized=text.normalize('NFKC');
 const numbers=normalized.match(/\d+(?:[.,]\d+)*(?:%|万|亿)?|[零〇一二两三四五六七八九十百千万亿]+(?=名|人|个|项|次|年|月|日|元|天|周|倍|家|份)/g)??[];
 const names=normalized.match(/[A-Za-z][A-Za-z0-9+#.-]*/g)??[];
 const roles=['独立','主导','负责人','牵头','主管','经理','架构师','精通','管理','带领','领导'].filter(word=>normalized.includes(word));
 return new Set([...numbers,...names.map(s=>s.toLowerCase()),...roles]);
}
export function unconfirmedAdditions(fact:Fact,text:string) {
 const values=(input:unknown):string=>typeof input==='string'?input:Array.isArray(input)?input.map(values).join(' '):input&&typeof input==='object'?Object.values(input).map(values).join(' '):'';
 const confirmed=markers([fact.text,...fact.metrics,values(fact.fieldValues)].join(' '));
 return [...markers(text)].filter(marker=>!confirmed.has(marker));
}
