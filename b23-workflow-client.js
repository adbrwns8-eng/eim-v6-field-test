'use strict';
window.BOSWorkflow = (() => {
 const endpoint='https://abnydnnafyosrakkgajy.supabase.co/functions/v1/b23-manager-workflow';
 const key='bosB23WorkflowSession';
 async function api(action,data={}) {
  const token=sessionStorage.getItem(key)||'';
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,data})});
  let result;try{result=await response.json();}catch{throw Error('Workflow service did not return a valid response.');}
  if(response.status===401)sessionStorage.removeItem(key);
  if(!response.ok||result.error)throw Error(result.error||'Workflow request failed');
  return result;
 }
 async function signIn(pin){const result=await api('login',{pin});sessionStorage.setItem(key,result.token);return result;}
 async function signOut(){try{await api('logout');}finally{sessionStorage.removeItem(key);}}
 const photo=file=>new Promise((resolve,reject)=>{
  if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>2097152)return reject(Error('Select a PNG or JPEG photo up to 2 MB.'));
  const reader=new FileReader();reader.onerror=()=>reject(Error('Could not read photo'));
  reader.onload=()=>resolve({mime:file.type,data_base64:String(reader.result).split(',')[1]});reader.readAsDataURL(file);
 });
 return {api,signIn,signOut,photo,hasSession:()=>!!sessionStorage.getItem(key)};
})();
