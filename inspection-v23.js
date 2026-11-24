'use strict';
(() => {
 const $=id=>document.getElementById(id),api=BOSWorkflow.api;
 const mode=new URLSearchParams(location.search).get('mode')||'vehicle';
 const labels=['Lights / Reflectors','Steps / Access Points','Handrails / Grab Handles','Fenders / Body Condition','Mirrors / Windows / Visibility','Tires / Wheels / Tracks','Fluid Levels / Leaks','Hydraulic Hoses / Lines','Brakes / Parking Brake','Steering / Controls','Horn / Backup Alarm','Seat Belt / Operator Restraint','Fire Extinguisher','Guards / Shields','Attachments / Couplers','General Housekeeping / Cab'];
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let assets=[],answers={},inspection,requestId=crypto.randomUUID(),busy=false;
 $('title').textContent=mode==='vehicle'?'Equipment / Vehicle Inspection':'Plant / Area Deficiency';
 async function start(){try{
  if(!BOSWorkflow.hasSession())await BOSWorkflow.signIn($('pin').value.trim());
  $('pin').value='';assets=(await api('assets')).filter(a=>a.kind===(mode==='vehicle'?'vehicle':'plant'));
  $('equipment').innerHTML='<option value="">Select...</option>'+assets.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.code)+' — '+esc(a.description)+'</option>').join('');
  $('login').classList.add('hidden');$('selectCard').classList.remove('hidden');
 }catch(error){$('msg').textContent=error.message;}}
 $('go').onclick=start;
 $('begin').onclick=()=>{
  if(!$('equipment').value)return $('selectMsg').textContent='Select equipment in your facility.';
  $('selectCard').classList.add('hidden');
  if(mode!=='vehicle')return $('findingForm').classList.remove('hidden');
  $('vehicleName').textContent=assets.find(a=>a.id===$('equipment').value).code;
  $('checklist').innerHTML=labels.map((label,i)=>'<div class="item" data-i="'+i+'"><h3>'+label+'</h3><div class="choices">'+['pass','deficient','na'].map(value=>'<button data-value="'+value+'">'+value.toUpperCase()+'</button>').join('')+'</div><div class="def hidden"><label>Deficiency description<textarea class="dtext"></textarea></label><label>Required photo<input type="file" class="dphoto" accept="image/png,image/jpeg"></label></div></div>').join('');
  document.querySelectorAll('.item').forEach((row,i)=>row.querySelectorAll('button').forEach(button=>button.onclick=()=>{
   answers[i]=button.dataset.value;row.querySelectorAll('button').forEach(b=>b.classList.toggle('selected',b===button));row.querySelector('.def').classList.toggle('hidden',answers[i]!=='deficient');
  }));$('vehicleChecklist').classList.remove('hidden');
 };
 async function submit(vehicle){if(busy)return;busy=true;const message=vehicle?$('vehicleMsg'):$('submitMsg'),button=vehicle?$('finishVehicle'):$('submit');button.disabled=true;
  try {
   const rows=[];
   if(vehicle){for(let i=0;i<labels.length;i++){
    if(!answers[i])throw Error('Complete every checklist item.');
    const row={status:answers[i]};
    if(row.status==='deficient'){
     const element=document.querySelector('.item[data-i="'+i+'"]');
     const description=element.querySelector('.dtext').value.trim();if(!description)throw Error('Describe each deficiency.');
     Object.assign(row,{description:labels[i]+': '+description},await BOSWorkflow.photo(element.querySelector('.dphoto').files[0]));
    }rows.push(row);
   }}else{
    if(!$('description').value.trim())throw Error('Describe the deficiency.');
    rows.push({status:'deficient',description:$('description').value.trim(),...await BOSWorkflow.photo($('photo').files[0])});
   }
   const result=await api('submit',{asset_id:$('equipment').value,request_id:requestId,answers:rows});inspection=result.inspection_id;
   $('vehicleChecklist').classList.add('hidden');$('findingForm').classList.add('hidden');
   if(result.findings.length){$('result').classList.remove('hidden');$('severity').textContent='RED — DO NOT OPERATE';$('instruction').textContent='Deficiencies recorded. Keep equipment out of service until corrective work and independent verification. Acknowledge these instructions.';}
   else{$('done').classList.remove('hidden');$('doneText').textContent='All-pass / N/A inspection saved.';}
  }catch(error){message.textContent=error.message;}finally{busy=false;button.disabled=false;}
 }
 $('finishVehicle').onclick=()=>submit(true);$('submit').onclick=()=>submit(false);
 $('ack').onclick=async()=>{if(busy)return;busy=true;try{await api('acknowledge',{inspection_id:inspection});$('result').classList.add('hidden');$('done').classList.remove('hidden');$('doneText').textContent='Inspection and acknowledgment saved.';}catch(error){$('instruction').textContent=error.message;}finally{busy=false;}};
 if(BOSWorkflow.hasSession())start();
})();
