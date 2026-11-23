/* Metrics use the collection timestamp, not the visitor's current time. */
(function(root){
  const day=86400000;
  function calculate(video, updatedAt, snapshots=[]){
    const end=Date.parse(updatedAt), published=Date.parse(video.publishedAt);
    const age=(end-published)/day;
    const views=Number.isFinite(video.views)&&video.views>=0?video.views:null;
    const target=end-7*day;
    const baseline=snapshots.filter(s=>Math.abs(Date.parse(s.updatedAt)-target)<=day/2&&Number.isFinite(s.views?.[video.id]))
      .sort((a,b)=>Math.abs(Date.parse(a.updatedAt)-target)-Math.abs(Date.parse(b.updatedAt)-target))[0];
    const previous=baseline?.views[video.id];
    return {
      viewsPerDay:views!==null&&age>=0?views/Math.max(1,age):null,
      likeRate:views>0&&Number.isFinite(video.likes)&&video.likes>=0?100*video.likes/views:null,
      views7d:views===null?null:age>=0&&age<=7?views:Number.isFinite(previous)&&previous<=views?views-previous:null
    };
  }
  if(typeof module==='object'&&module.exports)module.exports={calculate};else root.remixMetrics={calculate};
})(globalThis);
