import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{inspectRelease}from'./release-files.mjs';
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=process.argv[2];if(!root)throw Error('Usage: node scripts/check-release.mjs <staging-directory> [--portable]');
 console.log(JSON.stringify(await inspectRelease(resolve(root),{portable:process.argv.includes('--portable')})));
}
