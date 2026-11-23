// Run after every update of remix-ranking.json: node update-remix-history.js
const fs=require('node:fs');
const path=require('node:path');
const ranking=JSON.parse(fs.readFileSync(path.join(__dirname,'remix-ranking.json'),'utf8'));
const file=path.join(__dirname,'remix-history.json');
const history=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{snapshots:[]};
if(!Number.isFinite(Date.parse(ranking.updatedAt)))throw Error('Invalid ranking timestamp');
const snapshot={updatedAt:ranking.updatedAt,views:Object.fromEntries(ranking.videos.filter(v=>Number.isFinite(v.views)&&v.views>=0).map(v=>[v.id,v.views]))};
history.snapshots=history.snapshots.filter(s=>s.updatedAt!==snapshot.updatedAt);
history.snapshots.push(snapshot);
history.snapshots.sort((a,b)=>Date.parse(a.updatedAt)-Date.parse(b.updatedAt));
fs.writeFileSync(file,JSON.stringify(history)+'\n');
console.log(`Saved ${Object.keys(snapshot.views).length} videos at ${snapshot.updatedAt}`);
