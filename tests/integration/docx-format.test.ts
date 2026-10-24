import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderDocx} from '../../server/resume/docx.ts';
import type {ResumeDocument} from '../../shared/resume-document.ts';

// Read the actual Word package with the ZIP/XML dependencies owned by docx.
// No Word/LibreOffice installation is required for these format contracts.
const require=createRequire(import.meta.resolve('docx'));
const {unzipSync}=require('fflate'),{xml2js}=require('xml-js');
const many=(value:any):any[]=>value===undefined?[]:Array.isArray(value)?value:[value];
const fixture:ResumeDocument={profile:{name:'合成测试人',email:'sample@example.com'},sections:[{title:'项目经历',items:[{title:'合成项目',subtitle:'开发',date:'2024',bullets:['负责开发。\n编写测试。\n\n整理说明。','完成合成验证。']}]}],templateVersion:1,targetPages:1};
async function word(){const files=unzipSync(await renderDocx(fixture));const xml=(path:string)=>xml2js(new TextDecoder().decode(files[path]),{compact:true});return{paragraphs:many(xml('word/document.xml')['w:document']['w:body']['w:p']),styles:xml('word/styles.xml')['w:styles']};}
const attr=(node:any,key:string)=>node?._attributes?.['w:'+key];
const text=(paragraph:any)=>many(paragraph['w:r']).map(run=>many(run['w:t']).map(t=>t._text??'').join('')).join('');

test('Word headings use the neutral resume colors and section hierarchy',async()=>{
 const {paragraphs,styles}=await word();
 const byId=new Map(many(styles['w:style']).map(style=>[attr(style,'styleId'),style]));
 const defaults=styles['w:docDefaults']['w:rPrDefault']['w:rPr'];
 function properties(id:string):any{const style=byId.get(id);return style?{...properties(attr(style['w:basedOn'],'val')),...style['w:rPr']}:defaults;}
 for(const [label,size] of [['合成测试人','48'],['项目经历','24']]){
  const paragraph=paragraphs.find(p=>text(p)===label)!;assert.ok(paragraph,'missing heading '+label);
  const run=many(paragraph['w:r']).find(r=>r['w:t']?._text===label);
  const resolved={...properties(attr(paragraph['w:pPr']?.['w:pStyle'],'val')),...run['w:rPr']};
  assert.equal(attr(resolved['w:color'],'val'),'111111',label+' must not inherit a blue Office heading color');
  assert.equal(attr(resolved['w:sz'],'val'),size,label+' must retain the resume heading hierarchy');
  assert.ok(paragraph['w:pPr']['w:keepNext']!==undefined,'heading stays with its following content');
 }
});

test('a multiline contribution stays one Word bullet with explicit line breaks',async()=>{
 const {paragraphs}=await word(),bullets=paragraphs.filter(p=>p['w:pPr']?.['w:numPr']);
 assert.equal(bullets.length,2,'line breaks inside one contribution must not create extra achievements');
 const rendered=many(bullets[0]['w:r']).map(run=>many(run['w:br']).map(()=> '\n').join('')+many(run['w:t']).map(t=>t._text??'').join('')).join('');
 assert.equal(rendered,fixture.sections[0].items[0].bullets[0]);
 assert.equal(text(bullets[1]),'完成合成验证。');
});
