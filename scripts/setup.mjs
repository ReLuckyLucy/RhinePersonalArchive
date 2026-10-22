import{prepareLocalAssets}from'./prepare-local-assets.mjs';
await prepareLocalAssets({installBrowser:true,withDeps:process.argv.includes('--with-deps')});
console.log('Local resources ready. Run npm run build, then npm start.');
