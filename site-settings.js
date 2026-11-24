/* Shared theme preference. Unsupported saved themes fall back to scarlet. */
(()=>{
 const themes=['scarlet','berry','emerald','sapphire','winter'];
 let theme='scarlet';
 try{
   const saved=localStorage.getItem('nika.catalog.theme');
   if(themes.includes(saved))theme=saved;
   else if(saved!==null)localStorage.setItem('nika.catalog.theme',theme);
 }catch{}
 document.documentElement.dataset.theme=theme;
 document.addEventListener('DOMContentLoaded',()=>{
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
