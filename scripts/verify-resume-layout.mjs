import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {renderDocx} from '../server/resume/docx.ts';
import {renderPdf} from '../server/resume/pdf.ts';

// Synthetic documents only. Uses the application's renderers without opening a library.
const profile={name:'合成测试人',email:'sample@example.com',phone:'',location:'示例市',headline:'软件开发'};
const item={title:'离线资料整理项目',subtitle:'示例实验室 · 开发',date:'2024',bullets:['负责合成项目的开发与测试。','编写使用说明，整理验证记录。']};
const cases=[
 {name:'compact',document:{profile,sections:[{title:'教育背景',items:[{title:'示例大学',subtitle:'软件工程',date:'2020 — 2024',bullets:['完成合成课程项目。']}]},{title:'项目经历',items:[item]}],templateVersion:1,targetPages:1}},
 {name:'multiline',document:{profile,sections:[{title:'项目经历',items:[{...item,title:'面向离线材料的档案检索与证据整理项目'.repeat(4),date:'2024 — 2025',bullets:['第一行描述本人负责的工作。\n第二行补充验证方式。\n\n空行后保留同一条贡献的说明。','材料地址 https://example.com/'+('verylongpath'.repeat(20))]}]}],templateVersion:1,targetPages:1}},
 {name:'overflow',document:{profile,sections:[{title:'项目经历',items:[{...item,bullets:['这是合成的长篇中文经历，完整文字必须保留。'.repeat(130)+'\n罕见汉字：龘。\nhttps://example.com/'+('verylongpath'.repeat(20))]}]}],templateVersion:1,targetPages:1}},
];
const parent=resolve('verification/private/resume-layout');await mkdir(parent,{recursive:true});
const output=await mkdtemp(join(parent,'run-')),manifest={synthetic:true,renderer:'application',cases:[]};
for(const sample of cases){
 const pdf=await renderPdf(sample.document),docx=await renderDocx(sample.document);
 if(sample.name==='overflow'&&pdf.pages<=1)throw Error('Overflow fixture must exercise multiple pages');
 await writeFile(join(output,sample.name+'.pdf'),pdf.bytes,{flag:'wx'});
 await writeFile(join(output,sample.name+'.docx'),docx,{flag:'wx'});
 manifest.cases.push({name:sample.name,targetPages:sample.document.targetPages,pdfPages:pdf.pages,exceedsTarget:pdf.pages>sample.document.targetPages,pdfSHA256:createHash('sha256').update(pdf.bytes).digest('hex'),docxSHA256:createHash('sha256').update(docx).digest('hex')});
}
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,...manifest},null,2));
