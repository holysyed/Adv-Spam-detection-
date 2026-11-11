const screenshotInput=document.querySelector('#screenshot-input');
const screenshotStatus=document.querySelector('#screenshot-status');
let ocrWorker;
screenshotInput.addEventListener('change',async()=>{
  const file=screenshotInput.files[0];
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){screenshotStatus.textContent='Choose a PNG, JPG, or WebP screenshot under 8 MB.';screenshotInput.value='';return}
  screenshotInput.disabled=true;
  screenshotStatus.textContent='Reading screenshot… The first use downloads the English text model.';
  try{
    if(!window.Tesseract)throw new Error('The text reader could not load. Check your connection.');
    if(!ocrWorker)ocrWorker=await Tesseract.createWorker('eng');
    const result=await ocrWorker.recognize(file);
    const extracted=result.data.text.trim();
    if(!extracted){screenshotStatus.textContent='No text found. Try a clearer, uncropped screenshot.';return}
    const message=document.querySelector('#message');
    message.value=extracted.slice(0,5000);
    message.dispatchEvent(new Event('input',{bubbles:true}));
    screenshotStatus.textContent=extracted.length>5000?'Text added (first 5,000 characters). Review it, then select Check the vibe.':'Text added. Review it, then select Check the vibe.';
    message.focus();
  }catch(error){screenshotStatus.textContent=error.message||'Could not read the screenshot. Try again.';if(ocrWorker){await ocrWorker.terminate();ocrWorker=null}}
  finally{screenshotInput.disabled=false;screenshotInput.value=''}
});
