'use strict';
(() => {
 const $=id=>document.getElementById(id),api=BOSWorkflow.api;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let home,record,busy=false;
 const iso=id=>$(id).value?new Date($(id).value).toISOString():null;
 const local=value=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
 function status(text){$('status').textContent=text;}
 async function run(work){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await work();}catch(error){status(error.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 async function load(){
  try{home=await api('home');}catch(error){$('count').textContent='—';if(!BOSWorkflow.hasSession()){$('workspace').hidden=true;$('detail').hidden=true;$('login').hidden=false;}throw error;}
  if(!home.user.can_manage){$('workspace').hidden=true;$('detail').hidden=true;record=null;throw Error('Plant Manager or Rotation Manager authorization required.');}
  $('login').hidden=true;$('workspace').hidden=false;$('who').textContent=home.user.name+' · '+home.user.role;
  $('count').textContent=home.action_required===null?'—':home.action_required;
  $('legacy-warning').textContent=home.legacy_reconciliation_required?'Some historical corrective actions require reviewed reconciliation before they can be edited here.':'';
  $('inspections').innerHTML=home.inspections.length?home.inspections.map(i=>'<p>'+esc(i.asset_code)+' · '+esc(i.submitted_at)+' · '+esc(i.finding_count)+' deficiency finding(s)</p>').join(''):'<p>No submitted Build 23 inspections in your authorized facilities.</p>';
  $('queue').innerHTML=home.findings.length?home.findings.map(f=>'<article><button class="open" data-id="'+esc(f.id)+'">Finding #'+esc(f.number)+' · '+esc(f.asset_code)+' · '+esc(f.state)+'</button></article>').join(''):'<p>No findings in your authorized facilities.</p>';
  document.querySelectorAll('.open').forEach(button=>button.onclick=()=>run(()=>open(button.dataset.id)));
 }
 async function open(id){record=await api('get',{id});render();}
 function render(){
  $('detail').hidden=false;$('finding-title').textContent='Finding #'+record.number;
  $('finding-text').textContent=record.description;
  $('restriction').textContent=record.restriction;
  $('facility').textContent=record.asset.mine_name||record.asset.mine_id;
  $('state').textContent=record.state;
  $('plan').value=record.plan||'';$('controls').value=record.controls||'';
  $('starts').value=local(record.starts_at);$('due').value=local(record.due_at);
  $('assignee').innerHTML=home.assignees.filter(a=>a.mine_id===record.asset.mine_id).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('');
  if(record.assigned_to)$('assignee').value=record.assigned_to;
  for(const [id,cap] of [['ack','ack'],['assignment','assign'],['planning','plan'],['completion','complete'],['verification','verify'],['commenting','comment']])$(id).hidden=!record.capabilities[cap];
  $('history').innerHTML=record.history.map(e=>'<li>'+esc(e.event)+' · '+esc(e.actor_id)+' · '+esc(e.created_at)+'</li>').join('');
  $('comments').innerHTML=record.comments.map(c=>'<p>'+esc(c.body)+' <small>'+esc(c.actor_id)+'</small></p>').join('');
  $('photos').innerHTML=record.evidence.map(p=>'<figure><img width="200" alt="'+esc(p.kind)+' repair evidence" src="data:'+esc(p.mime)+';base64,'+esc(p.data_base64.replace(/\s/g,''))+'"><figcaption>'+esc(p.kind)+' · Taken by '+esc(p.taken_by)+' · '+esc(p.note)+'</figcaption></figure>').join('');
 }
 async function change(action,data={}){
  const id=record.id;
  record=await api(action,{id,revision:record.revision,...data});
  try{await load();render();status('Saved: '+action+'.');}catch(error){render();status('Saved: '+action+'. Queue refresh failed: '+error.message);}
 }
 async function initial(){await load();const id=new URLSearchParams(location.search).get('finding');if(id)await open(id);}
 $('signin').onclick=()=>run(async()=>{await BOSWorkflow.signIn($('pin').value);$('pin').value='';await initial();status('Authorized facility queues loaded.');});
 $('refresh').onclick=()=>run(async()=>{await load();if(record)await open(record.id);status('Queues refreshed.');});
 $('logout').onclick=()=>run(async()=>{await BOSWorkflow.signOut();record=null;$('detail').hidden=true;$('workspace').hidden=true;$('login').hidden=false;status('Signed out.');});
 $('ack').onclick=()=>run(()=>change('ack'));
 $('comment-save').onclick=()=>run(async()=>{await change('comment',{body:$('comment').value.trim()});$('comment').value='';});
 $('assign').onclick=()=>run(()=>change('assign',{assignee_id:$('assignee').value,starts_at:iso('starts'),due_at:iso('due')}));
 $('save-plan').onclick=()=>run(()=>change('plan',{plan:$('plan').value.trim(),controls:$('controls').value.trim(),starts_at:iso('starts'),due_at:iso('due')}));
 $('upload').onclick=()=>run(async()=>{await change('evidence',{...await BOSWorkflow.photo($('photo').files[0]),kind:'after',taken_by:$('taken-by').value.trim(),note:$('photo-note').value.trim()});$('photo').value='';});
 $('complete').onclick=()=>run(()=>change('complete',{completion:$('completion-text').value.trim()}));
 for(const [id,decision] of [['approve','approved'],['reject','rejected']])$(id).onclick=()=>run(()=>change('verify',{decision,body:$('verification-comment').value.trim()}));
 if(BOSWorkflow.hasSession())run(initial);
})();
