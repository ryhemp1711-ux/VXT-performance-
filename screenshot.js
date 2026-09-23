'use strict';
(()=>{
 const el=id=>document.getElementById(id);let file=null,previewURL=null,busy=false;
 const status=(s)=>el('screenshot-status').textContent=s;
 function athletes(){const previous=el('screenshot-athlete').value;el('screenshot-athlete').replaceChildren();
  for(const a of VXTLocal.snapshot().athletes){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;el('screenshot-athlete').append(o);}
  if([...el('screenshot-athlete').options].some(o=>o.value===previous))el('screenshot-athlete').value=previous;
 }
 function draw(rows){el('screenshot-rows').replaceChildren();el('screenshot-reviewed').checked=false;
  rows.forEach(row=>{const card=document.createElement('fieldset');card.className='screenshot-row';
   const source=document.createElement('legend');source.textContent=row.source||'Result';card.append(source);
   function input(label,name,value,type='text'){const l=document.createElement('label');l.textContent=label;const i=document.createElement('input');i.type=type;i.dataset.field=name;i.value=value;if(type==='number'){i.step='0.01';i.min='0.01';}l.append(i);card.append(l);return i;}
   const use=input('Include this result','include','', 'checkbox');use.checked=true;
   const label=document.createElement('label');label.textContent='Event';const select=document.createElement('select');select.dataset.field='event';VXTScreenshot.events.forEach(event=>{const o=document.createElement('option');o.value=o.textContent=event;select.append(o);});select.value=row.event;label.append(select);card.append(label);
   input('Time (seconds)','time',row.time,'number');input('Year or exact date (YYYY or YYYY-MM-DD)','date',row.date);
   const ml=document.createElement('label');ml.textContent='Timing method';const ms=document.createElement('select');ms.dataset.field='method';['Unknown','FAT','Gates','Hand','Video'].forEach(v=>{const o=document.createElement('option');o.value=o.textContent=v;ms.append(o);});ml.append(ms);card.append(ml);
   input('Notes / wind / season','notes',row.notes);el('screenshot-rows').append(card);
  });el('screenshot-review').hidden=!rows.length;
  status(rows.length?`${rows.length} candidate results. Check every value against the screenshot and choose the correct athlete.`:'No season records detected. Correct the extracted text below, then try Review extracted text. Expected: an event heading such as 100 Meters, then 2026 Outdoor 10 10.25.');
 }
 el('screenshot-file').addEventListener('change',()=>{
  file=el('screenshot-file').files[0]||null;if(previewURL)URL.revokeObjectURL(previewURL);
  el('screenshot-review').hidden=true;el('screenshot-text').value='';el('screenshot-image').hidden=!file;
  if(file){previewURL=URL.createObjectURL(file);el('screenshot-image').src=previewURL;}status('');
 });
 async function loadOCR(){if(globalThis.Tesseract)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Could not load image reading tools. Check your connection and retry.'));};document.head.append(s);});}
 el('screenshot-read').addEventListener('click',async()=>{
  if(busy)return;if(!file){status('Choose a screenshot first.');return;}
  if(file.size>15*1024*1024){status('Choose a screenshot smaller than 15 MB.');return;}
  busy=true;el('screenshot-read').disabled=true;el('screenshot-file').disabled=true;el('screenshot-review').hidden=true;let worker;
  try{status('Loading image reader. The first run may take a minute.');await loadOCR();
   worker=await Tesseract.createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',logger:m=>status(m.status+' '+Math.round((m.progress||0)*100)+'%')});
   await worker.setParameters({tessedit_pageseg_mode:'6'});
   const r=await worker.recognize(file);el('screenshot-text').value=r.data.text;athletes();draw(VXTScreenshot.parse(r.data.text));
  }catch(e){status('Could not read screenshot: '+e.message+' You can also paste text copied from your photo below.');}
  finally{if(worker)await worker.terminate().catch(()=>{});busy=false;el('screenshot-read').disabled=false;el('screenshot-file').disabled=false;}
 });
 el('screenshot-parse').addEventListener('click',()=>{try{athletes();draw(VXTScreenshot.parse(el('screenshot-text').value));}catch(e){status(e.message);}});
 el('screenshot-save').addEventListener('click',()=>{
  try{if(!el('screenshot-reviewed').checked)throw Error('Check the review confirmation first.');
   const rows=[...el('screenshot-rows').children].filter(c=>c.querySelector('[data-field="include"]').checked).map(c=>{
    const value=name=>c.querySelector(`[data-field="${name}"]`).value;
    return {event:value('event'),time:Number(value('time')),date:value('date').trim(),method:value('method'),notes:value('notes')};});
   if(!rows.length)throw Error('Select at least one result.');
   const target=el('screenshot-athlete');if(!target.value)throw Error('Add an athlete in Overview first.');
   const merged=VXTScreenshot.merge(VXTLocal.snapshot(),target.value,rows,()=>crypto.randomUUID());VXT.validateData(merged.data);
   if(!confirm(`Add ${merged.added} results to ${target.selectedOptions[0].textContent}? ${merged.duplicates} exact duplicates will be skipped. Existing records are kept.`))return;
   VXTLocal.appendReviewed(merged.data);el('screenshot-review').hidden=true;
   status(`Added ${merged.added} results; skipped ${merged.duplicates} exact duplicates. Upload to cloud when you are ready.`);
  }catch(e){status(e.message);}
 });
 document.querySelector('[data-tab="screenshot"]').addEventListener('click',()=>{try{athletes();}catch(e){status(e.message);}});
})();
