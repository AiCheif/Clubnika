// Run after updating a project's ranking: node update-remix-history.js [project-id]
const fs=require('node:fs');
const path=require('node:path');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'remixes','projects.json'),'utf8'));
const project=registry.projects.find(p=>p.id===(process.argv[2]||registry.defaultUpdateProject||registry.defaultProject));
if(!project)throw Error('Unknown remix project');
const ranking=JSON.parse(fs.readFileSync(path.join(__dirname,project.ranking),'utf8'));
const file=path.join(__dirname,project.history);
const history=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{snapshots:[]};
if(!Number.isFinite(Date.parse(ranking.updatedAt)))throw Error('Invalid ranking timestamp');
const snapshot={updatedAt:ranking.updatedAt,views:Object.fromEntries(ranking.videos.filter(v=>Number.isFinite(v.views)&&v.views>=0).map(v=>[v.id,v.views]))};
history.snapshots=history.snapshots.filter(s=>s.updatedAt!==snapshot.updatedAt);
history.snapshots.push(snapshot);
history.snapshots.sort((a,b)=>Date.parse(a.updatedAt)-Date.parse(b.updatedAt));
fs.writeFileSync(file,JSON.stringify(history)+'\n');
console.log(`Saved ${Object.keys(snapshot.views).length} videos at ${snapshot.updatedAt}`);
