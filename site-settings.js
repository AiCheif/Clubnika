/* Shared theme preference. Unsupported saved themes fall back to scarlet. */
(()=>{
 const themes=['scarlet','berry','emerald','sapphire','winter', 'lavender', 'honey', 'lime', 'coral', 'turquoise'];
 let theme='scarlet';
 try{
   const saved=localStorage.getItem('nika.catalog.theme');
   if(themes.includes(saved))theme=saved;
   else if(saved!==null)localStorage.setItem('nika.catalog.theme',theme);
 }catch{}
 document.documentElement.dataset.theme=theme;
 document.addEventListener('DOMContentLoaded',()=>{
   if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
     const observer=new IntersectionObserver(entries=>{
       for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('site-entered');observer.unobserve(entry.target);}
     },{threshold:0.08});
     document.querySelectorAll('body.site-unified-panels main :is(.home-feature-pair,.about-feature-pair,.site-platform-pair,.shorts-section,#gallery,#social)').forEach(el=>{
       if(el.getBoundingClientRect().top>=window.innerHeight)observer.observe(el);
     });
   }
   const picker=document.getElementById('theme-picker');
   if(!picker)return;
   picker.value=theme;
   picker.addEventListener('change',()=>{
     if(!themes.includes(picker.value))return;
     theme=picker.value;
     document.documentElement.dataset.theme=theme;
     try{localStorage.setItem('nika.catalog.theme',theme)}catch{}
   });
 });
})();
