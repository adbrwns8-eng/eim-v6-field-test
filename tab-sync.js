// EIM Build 18: cross-tab refresh synchronization.
const EIM_SYNC_KEY='eimFieldRefreshSignal';
let eimSyncing=false;
async function eimRefreshThisTab(){if(eimSyncing)return;eimSyncing=true;try{if(typeof refresh==='function'&&user)await refresh();if(typeof morning==='function'&&user&&document.getElementById('morningPanel')&&!document.getElementById('morningPanel').classList.contains('hidden'))await morning();}finally{eimSyncing=false}}
function eimBroadcastRefresh(){localStorage.setItem(EIM_SYNC_KEY,JSON.stringify({at:Date.now(),build:18}));}
window.addEventListener('storage',e=>{if(e.key===EIM_SYNC_KEY)eimRefreshThisTab()});
window.addEventListener('focus',()=>{if(user)eimRefreshThisTab()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&user)eimRefreshThisTab()});
const refreshButton=document.getElementById('refresh');if(refreshButton){refreshButton.onclick=async()=>{refreshButton.disabled=true;refreshButton.textContent='REFRESHING ALL TABS...';try{eimBroadcastRefresh();await eimRefreshThisTab();const old=refreshButton.textContent;refreshButton.textContent='ALL TABS REFRESHED';setTimeout(()=>{refreshButton.textContent='REFRESH ALL EIM TABS';refreshButton.disabled=false},1200)}catch(e){refreshButton.textContent='REFRESH ALL EIM TABS';refreshButton.disabled=false;const m=document.getElementById('homeMsg');if(m)m.textContent='Refresh failed: '+e.message}}}