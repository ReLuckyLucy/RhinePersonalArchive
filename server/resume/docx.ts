import {Document,Packer,Paragraph,TextRun,HeadingLevel} from 'docx';
import type {ResumeDocument} from '../../shared/resume-document.ts';

export async function renderDocx(doc:ResumeDocument){
 const profile=doc.profile;
 const text=(value:string,bold=false,size=21)=>new TextRun({text:value,bold,font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size});
 const paragraphs:Paragraph[]=[
  new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:profile.name??'',size:48,bold:true,color:'111111',font:'Microsoft YaHei'})],keepNext:true,spacing:{after:120}}),
  new Paragraph({children:[text([profile.email,profile.phone,profile.location].filter(Boolean).join(' · '))],spacing:{after:120}}),
 ];
 if(profile.headline)paragraphs.push(new Paragraph({children:[text(profile.headline)],spacing:{after:180}}));
 for(const section of doc.sections){
  paragraphs.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[text(section.title,true,24)],keepNext:true,spacing:{before:240,after:120}}));
  for(const item of section.items){
   paragraphs.push(new Paragraph({children:[text(item.title,true),text(item.date?'    '+item.date:'')],keepNext:true,spacing:{before:120,after:60}}));
   if(item.subtitle)paragraphs.push(new Paragraph({children:[text(item.subtitle)],keepNext:true,spacing:{after:80}}));
   for(const bullet of item.bullets){
    const lines=bullet.split('\n');
    const children=lines.flatMap((line,index)=>index?[new TextRun({break:1}),text(line)]:[text(line)]);
    paragraphs.push(new Paragraph({children,bullet:{level:0},widowControl:true,spacing:{after:100,line:330}}));
   }
  }
 }
 return Packer.toBuffer(new Document({styles:{default:{
  document:{run:{font:'Microsoft YaHei',size:21,color:'111111'}},
  title:{run:{color:'111111',size:48}},
  heading1:{run:{color:'111111',size:24}},
 }},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:907,bottom:907,left:907,right:907}}},children:paragraphs}]}));
}
