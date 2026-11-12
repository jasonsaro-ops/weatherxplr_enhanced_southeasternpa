const LAT=40.0759,LON=-75.2996,CYCLE=120;
const GAUGES=[{id:"01472000",name:"Schuylkill @ Reading"},{id:"01473500",name:"Schuylkill @ Pottstown"},{id:"01474500",name:"Schuylkill @ Norriton"},{id:"01474703",name:"Schuylkill @ Conshohocken"},{id:"01474000",name:"Schuylkill @ Fairmount Dam"}];
const WMO={0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",80:"Showers",95:"Thunderstorm"};
let cd=CYCLE,audioOn=false,audioCtx=null,alertCache={},obsCache={},aqiCache={},kphlObs=null,afdFull="";
let prevAlertIds=new Set(),hasBaseline=false,omData=null,charts={};
const feed={nws:true,om:true,aqi:true,hydro:true,tides:true};
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function sevClass(s){s=(s||"").toLowerCase();return ["extreme","severe","moderate","minor"].includes(s)?"sev-"+s:"sev-unknown"}
function sevKey(s){s=(s||"").toLowerCase();return ["extreme","severe","moderate","minor"].includes(s)?s:"unknown"}
function setFeed(id,ok){const el=$("d-"+id);if(el)el.classList.toggle("off",!ok);feed[id]=ok}

function arcGauge(value,min,max,color,label,unit,disp){
  const pct=value==null||isNaN(value)?0:Math.max(0,Math.min(1,(value-min)/(max-min)));
  const start=-135,sweep=270,r=42,cx=50,cy=50,toRad=d=>(d*Math.PI)/180;
  const angle=start+sweep*pct;
  const x1=cx+r*Math.cos(toRad(start)),y1=cy+r*Math.sin(toRad(start));
  const x2=cx+r*Math.cos(toRad(start+sweep)),y2=cy+r*Math.sin(toRad(start+sweep));
  const nx=cx+r*Math.cos(toRad(angle)),ny=cy+r*Math.sin(toRad(angle));
  const large=sweep*pct>180?1:0;
  const track=`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`;
  const fill=value==null?"":`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${nx} ${ny}`;
  const shown=disp!=null?disp:(value==null?"—":Math.round(value));
  return `<div class="g-tile" onclick="openConditions()"><div class="lbl">${esc(label)}</div>
    <svg viewBox="0 0 100 78"><path d="${track}" fill="none" stroke="rgba(148,163,184,.2)" stroke-width="8" stroke-linecap="round"/>
    ${fill?`<path d="${fill}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`:""}
    <text x="50" y="52" text-anchor="middle" fill="#f8fafc" font-size="15" font-family="IBM Plex Mono,monospace" font-weight="600">${esc(String(shown))}</text>
    <text x="50" y="66" text-anchor="middle" fill="#6b7a90" font-size="8" font-family="IBM Plex Mono,monospace">${esc(unit)}</text></svg></div>`;
}

function openModal(title,html,sev){$("modal-title").textContent=title;$("modal-body").innerHTML=html;$("modal").className="modal"+(sev?" "+sevClass(sev):"");$("modal-bg").classList.add("open")}
function closeModal(){$("modal-bg").classList.remove("open");$("modal-body").innerHTML=""}
window.closeModal=closeModal;

function ctx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();return audioCtx}
function tone(f,t0,dur,type,peak){const c=ctx(),o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t0);g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak,t0+.02);g.gain.linearRampToValueAtTime(0,t0+dur);o.connect(g).connect(c.destination);o.start(t0);o.stop(t0+dur+.02)}
function playExtreme(){const n=ctx().currentTime;[880,660,880,660].forEach((f,i)=>tone(f,n+i*.14,.13,"sawtooth",.18))}
function playSevere(){const n=ctx().currentTime;tone(523,n,.3,"sine",.16);tone(784,n+.28,.35,"sine",.16)}
function playAdvisory(){const n=ctx().currentTime;tone(440,n,.1,"triangle",.14);tone(440,n+.16,.1,"triangle",.14)}
const TONES={extreme:playExtreme,severe:playSevere,moderate:playSevere,minor:playAdvisory,unknown:playAdvisory};
function playSevs(set){let d=0;["extreme","severe","moderate","minor","unknown"].forEach(s=>{if(!set.has(s))return;setTimeout(()=>TONES[s](),d);d+=900})}
function initAudio(){try{audioOn=localStorage.getItem("wx_tones")==="1"}catch(e){}syncAudio();$("btn-audio").onclick=()=>{audioOn=!audioOn;try{localStorage.setItem("wx_tones",audioOn?"1":"0")}catch(e){}if(audioOn){ctx();playAdvisory()}syncAudio()}}
function syncAudio(){$("btn-audio").classList.toggle("on",audioOn);$("audio-ico").className=audioOn?"fa-solid fa-volume-high":"fa-solid fa-volume-xmark";$("audio-lbl").textContent=audioOn?"ON":"OFF"}

function windyUrl(layer){const prod=layer==="radar"||layer==="satellite"?layer:"gfs";return`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=in&metricTemp=f&metricWind=mph&zoom=8&overlay=${layer}&product=${prod}&level=surface&lat=${LAT}&lon=${LON}`}
function setLayer(layer){$("radar").src=windyUrl(layer);document.querySelectorAll(".model-chip").forEach(c=>c.classList.toggle("on",c.dataset.model===layer));const r=document.querySelector(`input[name="ly"][value="${layer}"]`);if(r)r.checked=true}
function initRadar(){setLayer("radar");document.querySelectorAll(".model-chip").forEach(c=>c.onclick=()=>setLayer(c.dataset.model));
  document.querySelectorAll('input[name="ly"]').forEach(r=>r.onchange=()=>setLayer(r.value));
  $("btn-layers").onclick=()=>{$("layer-pop").classList.toggle("open");$("btn-layers").classList.toggle("on")};
  $("btn-home").onclick=()=>setLayer(document.querySelector('input[name="ly"]:checked')?.value||"radar");
  document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".seg button").forEach(x=>x.classList.remove("on"));b.classList.add("on");document.querySelectorAll(".pane").forEach(p=>p.classList.remove("on"));$("pane-"+b.dataset.pane).classList.add("on")});
  document.querySelectorAll(".nav-tab").forEach(t=>t.onclick=()=>{document.querySelectorAll(".nav-tab").forEach(x=>x.classList.remove("on"));t.classList.add("on");
    if(t.dataset.view==="alerts"){document.querySelector('.seg button[data-pane="alerts"]').click()}
    if(t.dataset.view==="models"){openModels()}})}

function tickClock(){const n=new Date();$("clock").textContent=n.toLocaleTimeString("en-US",{hour12:false})+" L · "+n.toISOString().substr(11,8)+"Z"}

async function fetchOpenMeteo(){
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;
  try{omData=await fetch(url).then(r=>r.json());setFeed("om",true);renderConditions();renderForecast();renderSparks();renderModelCards()}
  catch(e){setFeed("om",false)}
  // Try HRRR-specific if available
  try{
    const h=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&models=gfs_hrrr&current=temperature_2m&temperature_unit=fahrenheit&timezone=America%2FNew_York`).then(r=>r.json());
    if(h.current&&h.current.temperature_2m!=null){$("mg-hrrr").textContent=Math.round(h.current.temperature_2m)+"°";window.__hrrrT=h.current.temperature_2m}
  }catch(e){}
  try{
    const g=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&models=gfs_seamless&current=temperature_2m&temperature_unit=fahrenheit&timezone=America%2FNew_York`).then(r=>r.json());
    if(g.current&&g.current.temperature_2m!=null)$("mg-gfs").textContent=Math.round(g.current.temperature_2m)+"°";
  }catch(e){}
}
function renderModelCards(){if(!omData||!omData.current)return;$("mg-blend").textContent=Math.round(omData.current.temperature_2m)+"°"}
function renderConditions(){
  const c=omData&&omData.current;if(!c)return;
  $("cond-temp").innerHTML=Math.round(c.temperature_2m)+`<span class="card-unit">°F</span>`;
  $("cond-feels").textContent="Feels "+Math.round(c.apparent_temperature)+"°";
  $("cond-desc").textContent=WMO[c.weather_code]||"—";
  $("m-wind").textContent=Math.round(c.wind_speed_10m)+" mph · "+(c.wind_direction_10m??"—")+"°";
  $("m-gust").textContent=Math.round(c.wind_gusts_10m||0)+" mph";
  $("m-pres").textContent=Math.round(c.pressure_msl)+" hPa";
  $("m-rh").textContent=Math.round(c.relative_humidity_2m)+"%";
  $("m-cloud").textContent=c.cloud_cover+"%";
  $("m-precip").textContent=(c.precipitation||0).toFixed(2)+" in";
  $("gauge-grid").innerHTML=
    arcGauge(c.temperature_2m,-10,110,"#f5a623","Temp","°F",Math.round(c.temperature_2m))+
    arcGauge(c.relative_humidity_2m,0,100,"#3b9eff","RH","%",Math.round(c.relative_humidity_2m))+
    arcGauge(c.pressure_msl,980,1040,"#2ecc71","MSLP","hPa",Math.round(c.pressure_msl))+
    arcGauge(c.wind_speed_10m,0,50,"#06b6d4","Wind","mph",Math.round(c.wind_speed_10m));
}
window.openConditions=function(){const c=omData&&omData.current;if(!c)return;
  openModal("Current Conditions",`<div class="gauge-grid" style="margin-bottom:12px">${arcGauge(c.temperature_2m,-10,110,"#f5a623","Temp","°F",Math.round(c.temperature_2m))}${arcGauge(c.relative_humidity_2m,0,100,"#3b9eff","RH","%",Math.round(c.relative_humidity_2m))}${arcGauge(c.pressure_msl,980,1040,"#2ecc71","MSLP","hPa",Math.round(c.pressure_msl))}${arcGauge(c.wind_speed_10m,0,50,"#06b6d4","Wind","mph",Math.round(c.wind_speed_10m))}</div>
  <div class="metric-row"><span class="k">Feels like</span><span class="v">${Math.round(c.apparent_temperature)}°F</span></div>
  <div class="metric-row"><span class="k">Gusts</span><span class="v">${Math.round(c.wind_gusts_10m||0)} mph</span></div>
  <div class="metric-row"><span class="k">Conditions</span><span class="v">${esc(WMO[c.weather_code]||"—")}</span></div>
  <div class="metric-row"><span class="k">Observed</span><span class="v">${esc(c.time||"—")}</span></div>
  <div style="margin-top:8px;font-size:11px;color:var(--text-dim)">Open-Meteo blend · ${LAT}, ${LON}</div>`)}

function renderForecast(){
  if(!omData||!omData.daily)return;
  const d=omData.daily;let rows="";
  for(let i=0;i<Math.min(7,d.time.length);i++){
    const day=new Date(d.time[i]+"T12:00:00");
    const lab=i===0?"Today":day.toLocaleDateString("en-US",{weekday:"short"});
    rows+=`<tr onclick="openDayDetail(${i})"><td>${lab}</td><td class="hi">${Math.round(d.temperature_2m_max[i])}°</td><td class="lo">${Math.round(d.temperature_2m_min[i])}°</td><td>${d.precipitation_probability_max[i]??"—"}%</td></tr>`;
  }
  $("fc-daily").querySelector("tbody").innerHTML=rows;
}
window.openDayDetail=function(i){if(!omData||!omData.daily)return;const d=omData.daily;
  openModal(`Forecast · ${d.time[i]}`,`<div class="metric-row"><span class="k">High</span><span class="v">${Math.round(d.temperature_2m_max[i])}°F</span></div>
  <div class="metric-row"><span class="k">Low</span><span class="v">${Math.round(d.temperature_2m_min[i])}°F</span></div>
  <div class="metric-row"><span class="k">PoP max</span><span class="v">${d.precipitation_probability_max[i]??"—"}%</span></div>
  <div class="metric-row"><span class="k">Wind max</span><span class="v">${Math.round(d.wind_speed_10m_max[i])} mph</span></div>
  <div class="metric-row"><span class="k">Sky</span><span class="v">${esc(WMO[d.weather_code[i]]||"—")}</span></div>`)}

function sparkChart(id,labels,data,color){
  const canvas=$(id);if(!canvas)return;
  if(charts[id])charts[id].destroy();
  Chart.defaults.color="#6b7a90";Chart.defaults.font.family="IBM Plex Mono";Chart.defaults.font.size=9;
  charts[id]=new Chart(canvas,{type:"line",data:{labels,datasets:[{data,borderColor:color,borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:color+"22",tension:.35}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false,beginAtZero:false}}}});
}
function renderSparks(){
  if(!omData||!omData.hourly)return;
  const h=omData.hourly,now=Date.now();
  const labels=[],temps=[],pops=[],winds=[];
  for(let i=0;i<h.time.length&&labels.length<48;i++){
    const t=new Date(h.time[i]);if(t.getTime()<now-3600000)continue;
    labels.push(t.getHours());temps.push(h.temperature_2m[i]);pops.push(h.precipitation_probability[i]??0);winds.push(h.wind_speed_10m[i]);
  }
  sparkChart("c-temp",labels,temps,"#f5a623");sparkChart("c-pop",labels,pops,"#3b9eff");sparkChart("c-wind",labels,winds,"#06b6d4");
}

async function fetchAlerts(){
  try{
    const urls=["https://api.weather.gov/alerts/active?area=PA","https://api.weather.gov/alerts/active?area=NJ","https://api.weather.gov/alerts/active?area=DE"];
    const results=await Promise.all(urls.map(u=>fetch(u).then(r=>r.json()).catch(()=>({features:[]}))));
    const seen=new Set(),feats=[];
    results.forEach(data=>(data.features||[]).forEach(f=>{const id=f.properties&&f.properties.id;if(id&&!seen.has(id)){seen.add(id);feats.push(f)}}));
    let spcNote=null;
    try{
      const spc=await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson").then(r=>r.json());
      const labels=(spc.features||[]).map(f=>(f.properties&&(f.properties.LABEL||f.properties.label))||"").filter(Boolean);
      const uniq=[...new Set(labels)];
      spcNote=uniq.length?"SPC Day-1: "+uniq.join(", "):"SPC Day-1: no categorical risk";
      window.__spcNote=spcNote;window.__spcDetail={labels:uniq,counts:{}};
      uniq.forEach(l=>{window.__spcDetail.counts[l]=labels.filter(x=>x===l).length});
    }catch(e){}
    feats.sort((a,b)=>{const o={extreme:0,severe:1,moderate:2,minor:3};return(o[(a.properties.severity||"").toLowerCase()]??4)-(o[(b.properties.severity||"").toLowerCase()]??4)});
    alertCache={};const ids=new Set(),newSevs=new Set();let html="";
    if(spcNote)html+=`<div class="alert-item sev-moderate" onclick="openSPC()"><div class="alert-ev" style="color:var(--amber)">SPC Convective Outlook</div><div class="alert-meta">${esc(spcNote)}</div></div>`;
    if(!feats.length)html+=`<div class="empty"><i class="fa-solid fa-check"></i> Clear — no active NWS alerts (PA/NJ/DE)</div>`;
    else feats.forEach(f=>{const p=f.properties;alertCache[p.id]=p;ids.add(p.id);const sk=sevKey(p.severity);if(hasBaseline&&!prevAlertIds.has(p.id))newSevs.add(sk);
      const sender=(p.senderName||"").replace("NWS ","");
      html+=`<div class="alert-item ${sevClass(p.severity)}" onclick="openAlert('${p.id}')"><div class="alert-ev">${esc(p.event)}</div><div class="alert-meta">${esc(p.severity||"—")} · ${esc(sender)} · ${esc((p.areaDesc||"").substring(0,50))}</div></div>`});
    if(hasBaseline&&newSevs.size&&audioOn)playSevs(newSevs);if(!hasBaseline)hasBaseline=true;prevAlertIds=ids;
    $("alerts-list").innerHTML=html;$("chip-alerts").textContent="ALERTS "+feats.length;$("chip-alerts").classList.toggle("alert",feats.length>0);
    setFeed("nws",true);
  }catch(e){setFeed("nws",false);$("alerts-list").innerHTML=`<span class="err">Alert feed down</span>`}
}
window.openSPC=function(){
  const note=window.__spcNote||"SPC Day-1";const d=window.__spcDetail||{labels:[],counts:{}};
  let rows=(d.labels||[]).map(l=>`<div class="metric-row"><span class="k">${esc(l)}</span><span class="v">${d.counts[l]||0} region(s)</span></div>`).join("")||`<div class="empty">No categorical risk</div>`;
  const cycles=["0100","2000","1630","1300","1200"];const utcH=new Date().getUTCHours()*100+new Date().getUTCMinutes();
  const ranked=[{c:"0100",t:100},{c:"2000",t:2000},{c:"1630",t:1630},{c:"1300",t:1300},{c:"1200",t:1200}];
  const order=[...ranked.filter(x=>x.t<=utcH).sort((a,b)=>b.t-a.t),...ranked.filter(x=>x.t>utcH).sort((a,b)=>b.t-a.t)].map(x=>x.c);
  const urls=order.map(c=>`https://www.spc.noaa.gov/products/outlook/day1otlk_${c}.png`);window.__spcImgUrls=urls;
  openModal("SPC Day-1 Outlook",`<div style="color:var(--amber);font-weight:700;margin-bottom:8px">${esc(note)}</div>${rows}
  <div style="margin:12px 0 6px;font-size:10px;color:var(--text-dim);text-transform:uppercase">Outlook graphic</div>
  <div style="background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:6px;text-align:center">
  <img id="spc-img" src="${urls[0]}" data-idx="0" style="max-width:100%" onerror="window.__spcFb&&window.__spcFb(this)">
  </div>
  <button class="btn" style="width:100%" onclick="window.open('https://www.spc.noaa.gov/products/outlook/day1otlk.html','_blank')">Full SPC product ↗</button>`,"moderate");
};
window.__spcFb=function(img){const urls=window.__spcImgUrls||[];let i=parseInt(img.getAttribute("data-idx")||"0",10)+1;if(i<urls.length){img.setAttribute("data-idx",String(i));img.src=urls[i]}else img.style.display="none"};
window.openAlert=function(id){const a=alertCache[id];if(!a)return;
  let body=`<div style="color:var(--red);font-weight:700;margin-bottom:6px">${esc(a.headline||a.event)}</div>
  <div style="color:var(--text-dim);font-size:11px;margin-bottom:8px">${esc(a.severity||"—")} · ${esc(a.urgency||"—")} · ${esc(a.certainty||"—")}</div>
  <div style="margin-bottom:8px"><b>Area:</b> ${esc(a.areaDesc||"")}</div>
  <div style="background:var(--bg);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${esc(a.description||"")}</div>`;
  if(a.instruction)body+=`<div style="margin-top:10px;color:var(--amber);font-weight:600;font-size:11px">ACTIONS</div><div style="background:var(--bg);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;color:var(--cyan);font-family:var(--font-mono)">${esc(a.instruction)}</div>`;
  openModal("NWS Alert",body,a.severity)};

async function fetchObs(){
  try{
    const pts=await fetch(`https://api.weather.gov/points/${LAT},${LON}`).then(r=>r.json());
    const st=await fetch(pts.properties.observationStations).then(r=>r.json());
    const stations=(st.features||[]).slice(0,5);
    const results=await Promise.all(stations.map(s=>fetch(`https://api.weather.gov/stations/${s.properties.stationIdentifier}/observations/latest`).then(r=>r.json()).then(obs=>({id:s.properties.stationIdentifier,name:s.properties.name,obs})).catch(()=>null)));
    obsCache={};let html="";
    results.filter(Boolean).forEach(item=>{const p=item.obs.properties||{};const tC=p.temperature&&p.temperature.value;const tF=tC!=null?Math.round(tC*9/5+32):"—";
      obsCache[item.id]=p;html+=`<div class="obs-row" onclick="openObs('${item.id}')"><div><div class="id">${esc(item.id)}</div><div class="nm">${esc((item.name||"").substring(0,28))}</div></div><div class="tv">${tF}°F</div></div>`});
    $("obs-list").innerHTML=html||`<span class="err">No obs</span>`;
  }catch(e){$("obs-list").innerHTML=`<span class="err">Obs timeout</span>`}
}
window.openObs=function(id){const p=obsCache[id];if(!p)return;
  const tF=p.temperature&&p.temperature.value!=null?((p.temperature.value*9/5)+32).toFixed(1):"—";
  openModal(`Station ${id}`,`<div class="metric-row"><span class="k">Temp</span><span class="v">${tF}°F</span></div>
  <div class="metric-row"><span class="k">Conditions</span><span class="v">${esc(p.textDescription||"—")}</span></div>
  ${p.rawMessage?`<pre style="margin-top:10px;background:var(--bg);padding:8px;font-size:11px;font-family:var(--font-mono);overflow:auto">${esc(p.rawMessage)}</pre>`:""}`)};

async function fetchAQI(){
  try{
    const data=await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide&timezone=America%2FNew_York`).then(r=>r.json());
    setFeed("aqi",true);const c=data.current||{};aqiCache={current:c};
    const aqi=c.us_aqi;let cat="—",col="#6b7a90";
    if(aqi!=null){if(aqi<=50){cat="Good";col="#2ecc71"}else if(aqi<=100){cat="Moderate";col="#eab308"}else if(aqi<=150){cat="USG";col="#f97316"}else{cat="Unhealthy";col="#ef4444"}}
    $("aqi-val").innerHTML=`<span style="color:${col}">${aqi??"—"}</span>`;$("aqi-cat").textContent=cat;$("aqi-cat").style.color=col;
  }catch(e){setFeed("aqi",false)}
}
window.openAQI=function(){const c=aqiCache.current;if(!c)return;
  openModal(`Air Quality · US AQI ${c.us_aqi??"—"}`,`<div class="metric-row"><span class="k">US AQI</span><span class="v">${c.us_aqi??"—"}</span></div>
  <div class="metric-row"><span class="k">PM2.5</span><span class="v">${c.pm2_5??"—"}</span></div>
  <div class="metric-row"><span class="k">PM10</span><span class="v">${c.pm10??"—"}</span></div>
  <div class="metric-row"><span class="k">Ozone</span><span class="v">${c.ozone??"—"}</span></div>
  <div class="metric-row"><span class="k">NO₂</span><span class="v">${c.nitrogen_dioxide??"—"}</span></div>`)};

function fetchHydro(){setFeed("hydro",true);$("hydro-list").innerHTML=GAUGES.map(g=>`<div class="obs-row" onclick="openHydro('${g.id}','${g.name.replace(/'/g,"\\'")}')"><div><div class="id">${esc(g.name)}</div><div class="nm">USGS ${g.id}</div></div><div class="tv" style="font-size:10px">GRAPH</div></div>`).join("")}
window.openHydro=function(id,name){openModal(`USGS · ${name}`,`<div style="height:400px"><iframe src="https://dashboard.waterdata.usgs.gov/api/gwis/2.1/service/site?agencyCode=USGS&siteNumber=${id}&open=plots&banner=false&pad=false" style="width:100%;height:100%;border:none;background:#fff;border-radius:4px"></iframe></div>`)};

async function fetchTides(){
  const st="8545240",base=`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st}&time_zone=lst_ldt&units=english&format=json&date=today`;
  try{
    const[wl,air]=await Promise.all([fetch(`${base}&product=water_level&datum=MLLW`).then(r=>r.json()),fetch(`${base}&product=air_temperature`).then(r=>r.json())]);
    setFeed("tides",true);const last=wl.data&&wl.data[wl.data.length-1];const la=air.data&&air.data[air.data.length-1];
    $("tide-mllw").textContent=last?last.v+" ft":"—";$("tide-air").textContent=la?la.v+"°F":"—";
    window.__tide={last,la,wl};
  }catch(e){setFeed("tides",false)}
}
window.openTides=function(){const t=window.__tide||{};openModal("Tides · 8545240",`<div class="metric-row"><span class="k">MLLW</span><span class="v">${t.last?t.last.v+" ft":"—"}</span></div><div class="metric-row"><span class="k">Air</span><span class="v">${t.la?t.la.v+"°F":"—"}</span></div><div style="margin-top:8px;font-size:11px;color:var(--text-dim)">NOAA CO-OPS · Delaware River</div>`)};

async function fetchKPHL(){
  try{
    const obs=await fetch("https://api.weather.gov/stations/KPHL/observations/latest").then(r=>r.json());
    kphlObs=obs.properties||{};const p=kphlObs;const tC=p.temperature&&p.temperature.value;
    $("kphl-temp").innerHTML=(tC!=null?Math.round(tC*9/5+32):"—")+`<span class="card-unit">°F</span>`;
    $("kphl-desc").textContent=p.textDescription||"Philadelphia Intl";
    try{const list=await fetch("https://api.weather.gov/products/types/AFD/locations/PHI").then(r=>r.json());const g=list["@graph"]||[];if(g.length){const prod=await fetch(g[0]["@id"]||`https://api.weather.gov/products/${g[0].id}`).then(r=>r.json());afdFull=prod.productText||""}}catch(e){}
  }catch(e){}
}
window.openKPHL=function(){const p=kphlObs||{};const tF=p.temperature&&p.temperature.value!=null?((p.temperature.value*9/5)+32).toFixed(1):"—";
  openModal("KPHL · Philadelphia Intl",`<div style="font-size:28px;font-weight:700;font-family:var(--font-mono);margin-bottom:4px">${tF}°F</div>
  <div style="color:var(--text-mid);margin-bottom:10px">${esc(p.textDescription||"—")}</div>
  ${p.rawMessage?`<pre style="background:var(--bg);padding:8px;font-size:11px;font-family:var(--font-mono);overflow:auto">${esc(p.rawMessage)}</pre>`:""}
  <button class="btn" style="width:100%" onclick="openAFD()">PHI Area Forecast Discussion</button>`)};
window.openAFD=function(){if(!afdFull){openModal("PHI AFD",`<span class="err">Not loaded yet</span>`);return}openModal("PHI AFD",`<pre style="white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${esc(afdFull)}</pre>`)};

window.openModels=function(){
  openModal("Model Guidance · SE-PA",`
  <div class="model-grid" style="margin-bottom:12px">
    <div class="model-cell"><div class="m-name">BLEND / OM</div><div class="m-val">${$("mg-blend").textContent}</div></div>
    <div class="model-cell"><div class="m-name">HRRR</div><div class="m-val">${$("mg-hrrr").textContent}</div></div>
    <div class="model-cell"><div class="m-name">GFS</div><div class="m-val">${$("mg-gfs").textContent}</div></div>
    <div class="model-cell"><div class="m-name">REFS</div><div class="m-val">NOMADS</div></div>
  </div>
  <p style="font-size:12px;color:var(--text-mid);line-height:1.5;margin-bottom:10px">
    <b>HRRR</b> remains operational (3 km, hourly, radar-aware). Point values shown when Open-Meteo exposes a regional HRRR series for this location.
  </p>
  <p style="font-size:12px;color:var(--text-mid);line-height:1.5;margin-bottom:10px">
    <b>RRFS / REFS</b> are NOAA’s new operational short-range deterministic and ensemble systems (live since Nov 2026). Full fields are GRIB2 on NOMADS and AWS <code>s3://noaa-rrfs-ops-pds</code>. Browser apps use point APIs or a thin worker for subsets.
  </p>
  <button class="btn" style="width:100%;margin-bottom:6px" onclick="window.open('https://nomads.ncep.noaa.gov/','_blank')">NOMADS model inventory ↗</button>
  <button class="btn" style="width:100%;margin-bottom:6px" onclick="window.open('https://registry.opendata.aws/noaa-rrfs-ops/','_blank')">AWS RRFS / REFS open data ↗</button>
  <button class="btn" style="width:100%" onclick="window.open('https://registry.opendata.aws/noaa-hrrr-pds/','_blank')">AWS HRRR archive ↗</button>
  `);
};

async function refreshAll(){
  await Promise.all([fetchOpenMeteo(),fetchAlerts(),fetchObs(),fetchAQI(),fetchTides(),fetchKPHL()]);
  fetchHydro();$("chip-sync").textContent="SYNC "+new Date().toLocaleTimeString("en-US",{hour12:false});
}
async function boot(){
  const bar=$("boot-prog"),st=$("boot-st");
  const steps=[[15,"CONNECTING NWS…"],[35,"OPEN-METEO · HRRR…"],[55,"ALERTS · SPC…"],[75,"OBS · AQ · TIDES…"],[90,"RADAR ARRAY…"],[100,"DISPATCH ONLINE"]];
  let i=0;const t=setInterval(()=>{if(i<steps.length){bar.style.width=steps[i][0]+"%";st.textContent=steps[i][1];i++}},280);
  initRadar();initAudio();tickClock();setInterval(tickClock,1000);
  await refreshAll();clearInterval(t);bar.style.width="100%";st.textContent="ONLINE";
  setTimeout(()=>{$("boot").classList.add("out");$("app").classList.add("on");setTimeout(()=>$("boot")?.remove(),600)},350);
  setInterval(()=>{cd--;if(cd<=0){cd=CYCLE;refreshAll()}$("cd").textContent=cd},1000);
}
document.addEventListener("DOMContentLoaded",boot);
