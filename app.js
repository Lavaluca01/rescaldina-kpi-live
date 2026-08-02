let state={};
const euro=n=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n)||0);
const num=n=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(Number(n)||0);
const pct=n=>`${num(n)}%`;
const keyToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const status=(real,target)=>!target?'neutral':real>=target?'good':real>=target*.8?'warn':'bad';
const gapText=(real,target,unit='€')=>{const g=(real||0)-(target||0);return `${g>=0?'+':''}${unit==='pz'?num(g)+' pz':euro(g)}`};
async function load(){
 const cfg=await fetch('config.json?'+Date.now(),{cache:'no-store'}).then(r=>r.json());
 const d=await fetch(cfg.dataUrl+'?'+Date.now(),{cache:'no-store'}).then(r=>r.json());
 const previous=state; state=d; render(); notifyChange(previous,d); localStorage.setItem('lastKpi',JSON.stringify(d));
 clearTimeout(window.refreshTimer); window.refreshTimer=setTimeout(load,(cfg.refreshMinutes||5)*60000);
}
function currentBudget(){
 const key=keyToday(); return state.budgets.find(x=>x.date===key)||state.budgets.find(x=>!state.actuals?.[x.date])||state.budgets.at(-1);
}
function render(){
 const key=keyToday(), b=currentBudget(), a=state.actuals?.[key]||state.lastAvailableSnapshot||{};
 document.querySelector('#date').textContent=new Date(b.date+'T12:00').toLocaleDateString('it-IT',{weekday:'long',day:'2-digit',month:'long'});
 document.querySelector('#updated').textContent=`Fonte aggiornata: ${formatDate(state.sourceUpdatedAt)} · App: ${formatDate(state.generatedAt)}`;
 const metrics=[['SALES','sales','€'],['PROTECTION','protection','€'],['MW SERVICE','mwService','€'],['MCAFEE','mcafeePieces','pz'],['OFFICE','officePieces','pz'],['UNDER 300','under300Pieces','pz']];
 document.querySelector('#cards').innerHTML=metrics.map(([label,k,u])=>card(label,a[k]||0,b[k]||0,u)).join('');
 document.querySelector('#protectionAreas').innerHTML=pills([['Telefonia · 8%',b.protectionAreas.telefonia],['PC · 6%',b.protectionAreas.pc],['GE · 10%',b.protectionAreas.ge],['Under 300',b.under300Pieces,'pz']]);
 document.querySelector('#serviceAreas').innerHTML=pills([['Screen · 60%',b.mwServiceAreas.screen],['RTU · 20%',b.mwServiceAreas.rtu],['Calibrazione · 20%',b.mwServiceAreas.calibrazione]]);
 document.querySelector('#extraAreas').innerHTML=pills([['Findomestic · 15%',b.findomestic],['Gold Plus mese',state.goldPlus.monthlyTargetValue],['Gold Plus mese',state.goldPlus.monthlyTargetPieces,'pz'],['Valore unitario',state.goldPlus.unitValue]]);
 const elapsed=state.budgets.filter(x=>x.date<=key), budgetMTD=elapsed.reduce((s,x)=>s+x.sales,0), actualMTD=Object.entries(state.actuals||{}).filter(([d])=>d<=key).reduce((s,[,x])=>s+(x.sales||0),0), monthGap=actualMTD-budgetMTD;
 document.querySelector('#monthGap').textContent=(monthGap>=0?'+':'')+euro(monthGap); document.querySelector('#monthGap').className=status(actualMTD,budgetMTD);
 document.querySelector('#forecast').textContent=euro(forecastMonth(key));
 document.querySelector('#history').innerHTML=state.budgets.filter(x=>x.date<=key).reverse().map(x=>{const z=state.actuals?.[x.date]||{},g=(z.sales||0)-x.sales;return `<div class="row"><span>${x.date.slice(8,10)}/08</span><span>${euro(z.sales||0)} / ${euro(x.sales)}</span><b class="${status(z.sales||0,x.sales)}">${g>=0?'+':''}${euro(g)}</b></div>`}).join('')||'<p>Nessun consuntivo disponibile.</p>';
 document.querySelector('#coach').innerHTML=coach(a,b,actualMTD,budgetMTD).map(x=>`<li>${x}</li>`).join('');
}
function card(label,real,target,unit){const p=target?Math.min(120,real/target*100):0,s=status(real,target);return `<article class="card ${s}"><div class="cardtop"><h3>${label}</h3><span>${pct(target?real/target*100:0)}</span></div><div class="value">${unit==='pz'?num(real)+' pz':euro(real)}</div><div class="meta"><span>Budget ${unit==='pz'?num(target)+' pz':euro(target)}</span><b>${gapText(real,target,unit)}</b></div><div class="bar"><i style="width:${Math.min(100,p)}%"></i></div></article>`}
function pills(arr){return arr.map(([name,v,u])=>`<div class="pill"><span>${name}</span><b>${u==='pz'?num(v)+' pz':euro(v)}</b></div>`).join('')}
function coach(a,b,actualMTD,budgetMTD){
 const out=[]; const salesRate=b.sales?(a.sales||0)/b.sales:0;
 if(salesRate>=1) out.push(`Sales sopra il budget di <strong>${gapText(a.sales,b.sales)}</strong>. Proteggere il vantaggio nelle ultime ore.`);
 else out.push(`Per chiudere il budget Sales mancano <strong>${euro(Math.max(0,b.sales-(a.sales||0)))}</strong>.`);
 [['Protection','protection'],['MW Service','mwService'],['McAfee','mcafeePieces'],['Office','officePieces']].forEach(([name,k])=>{const r=b[k]?(a[k]||0)/b[k]:0;if(r<.8)out.push(`<strong>${name}</strong> sotto l’80% del target: gap ${gapText(a[k],b[k],k.includes('Pieces')?'pz':'€')}.`)});
 const mg=actualMTD-budgetMTD; out.push(`Gap progressivo mese: <strong class="${mg>=0?'good':'bad'}">${mg>=0?'+':''}${euro(mg)}</strong>.`); return out.slice(0,5);
}
function forecastMonth(key){const actualEntries=Object.entries(state.actuals||{}).filter(([d,x])=>d<=key&&(x.sales||0)>0);if(!actualEntries.length)return 0;const avg=actualEntries.reduce((s,[,x])=>s+(x.sales||0),0)/actualEntries.length;const remaining=state.budgets.filter(x=>x.date>key).length;return actualEntries.reduce((s,[,x])=>s+(x.sales||0),0)+avg*remaining}
function formatDate(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?v:d.toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function notifyChange(oldData,newData){if(!oldData?.generatedAt||oldData.generatedAt===newData.generatedAt||Notification.permission!=='granted')return;const b=currentBudget(),a=newData.actuals?.[keyToday()]||newData.lastAvailableSnapshot||{};new Notification('KPI Rescaldina aggiornati',{body:`Sales ${euro(a.sales||0)} · gap ${gapText(a.sales,b.sales)}`,icon:'icon.svg',tag:'kpi-update'})}
document.querySelector('#notify').onclick=async()=>{const p=await Notification.requestPermission();document.querySelector('#notify').textContent=p==='granted'?'Pop-up attivi':'Pop-up non attivi'};
document.querySelector('#refresh').onclick=load;
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
load().catch(e=>document.querySelector('#updated').textContent='Errore dati: '+e.message);
