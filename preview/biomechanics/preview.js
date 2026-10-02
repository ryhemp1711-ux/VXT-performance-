document.getElementById('preview-begin').addEventListener('click',()=>{
if(!VXTLocal.snapshot().athletes.length)document.getElementById('demo').click();
document.querySelector('[data-tab="video"]').click();
const select=document.getElementById('video-athlete');
if(!select.value&&select.options.length>1){select.selectedIndex=1;select.dispatchEvent(new Event('change'));}
document.getElementById('video-title').value='Biomechanics test';
document.getElementById('video-file').scrollIntoView({behavior:'smooth',block:'center'});
});
