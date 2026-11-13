const LAT=40.0759,LON=-75.2996,CYCLE=120;
let sampleLat=40.0759,sampleLon=-75.2996,sampleMode=false,mapZoom=8;
const PRESETS={
  sepa:{lat:40.0759,lon:-75.2996,label:"SE-PA"},
  z19428:{lat:40.0685,lon:-75.3045,label:"19428"},
  phl:{lat:39.8721,lon:-75.2411,label:"KPHL"},
  nyc:{lat:40.7789,lon:-73.9692,label:"KNYC"},
  abe:{lat:40.6524,lon:-75.4404,label:"KABE"},
  acy:{lat:39.4576,lon:-74.5772,label:"KACY"},
  ilg:{lat:39.6784,lon:-75.6060,label:"KILG"},
  rdg:{lat:40.3785,lon:-75.9653,label:"KRDG"}
};
const GAUGES=[{id:"01472000",name:"Schuylkill @ Reading"},{id:"01473500",name:"Schuylkill @ Pottstown"},{id:"01474500",name:"Schuylkill @ Norriton"},{id:"01474703",name:"Schuylkill @ Conshohocken"},{id:"01474000",name:"Schuylkill @ Fairmount Dam"}];
const WMO={0:"Clear",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Light drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",80:"Showers",95:"Thunderstorm"};
let cd=CYCLE,audioOn=false,audioCtx=null,alertCache={},obsCache={},aqiCache={},kphlObs=null,afdFull="";
let prevAlertIds=new Set(),hasBaseline=false,omData=null,charts={};
const feed={nws:true,om:true,aqi:true,hydro:true,tides:true};
function $(id){return document.getElementById(id)}
function fetchT(url, opts={}, ms=12000){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {...opts, signal:ctrl.signal}).finally(()=>clearTimeout(t));
}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function sevClass(s){s=(s||"").toLowerCase();return ["extreme","severe","moderate","minor"].includes(s)?"sev-"+s:"sev-unknown"}
function sevKey(s){s=(s||"").toLowerCase();return ["extreme","severe","moderate","minor"].includes(s)?s:"unknown"}
function setFeed(id,ok){const el=$("d-"+id);if(el)el.classList.toggle("off",!ok);feed[id]=ok}

function tickClock(){
  const now = new Date();
  const local = now.toLocaleTimeString("en-US",{hour12:false,timeZone:"America/New_York"});
  const zulu = now.toISOString().slice(11,19);
  const el = $("clock");
  if(el) el.textContent = local + " L · " + zulu + "Z";
  // optional separate elements
  const l = $("clock-local"), z = $("clock-zulu");
  if(l) l.textContent = local + " L";
  if(z) z.textContent = zulu + "Z";
}



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
function playTone(sev){const s=(sev||"").toLowerCase();if(s==="extreme")playExtreme();else if(s==="severe")playSevere();else playAdvisory();}
const TONES={extreme:playExtreme,severe:playSevere,moderate:playSevere,minor:playAdvisory,unknown:playAdvisory};
function playSevs(set){let d=0;["extreme","severe","moderate","minor","unknown"].forEach(s=>{if(!set.has(s))return;setTimeout(()=>TONES[s](),d);d+=900})}
function initAudio(){try{audioOn=localStorage.getItem("wx_tones")==="1"}catch(e){}syncAudio();$("btn-audio").onclick=()=>{audioOn=!audioOn;try{localStorage.setItem("wx_tones",audioOn?"1":"0")}catch(e){}if(audioOn){ctx();playAdvisory()}syncAudio()}}
function syncAudio(){$("btn-audio").classList.toggle("on",audioOn);$("audio-ico").className=audioOn?"fa-solid fa-volume-high":"fa-solid fa-volume-xmark";$("audio-lbl").textContent=audioOn?"ON":"OFF"}


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

function sparkChart(id,labels,data,color,yLabel){
  const canvas=$(id);if(!canvas)return;
  if(charts[id])charts[id].destroy();
  Chart.defaults.color="#6b7a90";Chart.defaults.font.family="IBM Plex Mono";Chart.defaults.font.size=9;
  const nums=(data||[]).filter(v=>v!=null&&!isNaN(v));
  const ymin=nums.length?Math.floor(Math.min(...nums)):0;
  const ymax=nums.length?Math.ceil(Math.max(...nums)):1;
  // sparse x labels: every ~6 hours among hourly labels
  const xLabels=labels.map((h,i)=> (i%6===0 ? (String(h).padStart?String(h).padStart(2,"0"):h)+":00" : ""));
  charts[id]=new Chart(canvas,{
    type:"line",
    data:{labels:xLabels,datasets:[{data,borderColor:color,borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:color+"22",tension:.35}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.parsed.y}${yLabel?(" "+yLabel):""}`}}},
      scales:{
        x:{display:true,ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:6,color:"#6b7a90",font:{size:8}},grid:{color:"rgba(42,49,64,.5)"}},
        y:{display:true,min:ymin,max:ymax===ymin?ymax+1:ymax,ticks:{maxTicksLimit:4,color:"#6b7a90",font:{size:8},callback:v=>v+(yLabel?"":"")},grid:{color:"rgba(42,49,64,.45)"}}
      }
    }
  });
}
function renderSparks(){
  if(!omData||!omData.hourly)return;
  const h=omData.hourly,now=Date.now();
  const labels=[],temps=[],pops=[],winds=[];
  for(let i=0;i<h.time.length&&labels.length<48;i++){
    const t=new Date(h.time[i]);if(t.getTime()<now-3600000)continue;
    labels.push(t.getHours());temps.push(h.temperature_2m[i]);pops.push(h.precipitation_probability[i]??0);winds.push(h.wind_speed_10m[i]);
  }
  sparkChart("c-temp",labels,temps,"#f5a623","°F");sparkChart("c-pop",labels,pops,"#3b9eff","%");sparkChart("c-wind",labels,winds,"#06b6d4","mph");
}


async function fetchOpenMeteo(){
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`+
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`+
      `&hourly=temperature_2m,precipitation_probability,wind_speed_10m`+
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`+
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;
    const r=await fetchT(u,{},15000);
    if(!r.ok) throw new Error("OM HTTP "+r.status);
    omData=await r.json();
    setFeed("om",true);
    renderConditions();
    renderForecast();
    renderSparks();
    renderModelCards();
  }catch(e){
    console.warn("Open-Meteo",e);
    setFeed("om",false);
  }
}

async function fetchAlerts(){
  try{
    const headers={Accept:"application/geo+json,application/json","User-Agent":"WeatherXplr/2.0 (github.com/jasonsaro-ops)"};
    const urls=["https://api.weather.gov/alerts/active?area=PA","https://api.weather.gov/alerts/active?area=NJ","https://api.weather.gov/alerts/active?area=DE"];
    const results=await Promise.all(urls.map(u=>fetchT(u,{headers},12000).then(r=>r.json()).catch(()=>({features:[]}))));
    const seen=new Set(); const all=[];
    results.forEach(j=>(j.features||[]).forEach(f=>{
      const id=f.id||f.properties?.id; if(id&&seen.has(id))return; if(id)seen.add(id); all.push(f);
    }));
    const sevRank={extreme:0,severe:1,moderate:2,minor:3,unknown:4};
    all.sort((a,b)=>(sevRank[sevKey(a.properties?.severity)]??4)-(sevRank[sevKey(b.properties?.severity)]??4));
    alertCache={features:all};
    all.forEach(f=>{ if(f.id) alertCache[f.id]=f.properties||{}; });
    const n=all.length;
    $("chip-alerts").textContent="ALERTS "+n;
    $("chip-alerts").classList.toggle("hot",n>0);
    const list=$("alerts-list");
    if(list){
      if(!all.length) list.innerHTML='<span class="err" style="color:var(--text-dim)">No active alerts (PA/NJ/DE)</span>';
      else list.innerHTML=all.slice(0,40).map(f=>{
        const p=f.properties||{};
        return `<div class="alert-row ${sevClass(p.severity)}" onclick='openAlert(${JSON.stringify(String(f.id||"")).replace(/'/g,"")})'><div class="ev">${esc(p.event||"Alert")}</div><div class="hd">${esc(p.headline||p.areaDesc||"")}</div></div>`;
      }).join("");
    }
    // audio for new severe
    const ids=new Set(all.map(f=>f.id));
    if(hasBaseline&&audioOn){
      all.forEach(f=>{
        if(!prevAlertIds.has(f.id)){
          const s=sevKey(f.properties?.severity);
          if(s==="extreme"||s==="severe") try{playTone(s)}catch(e){}
        }
      });
    }
    prevAlertIds=ids; hasBaseline=true;
    setFeed("nws",true);
  }catch(e){console.warn(e);setFeed("nws",false);if($("alerts-list"))$("alerts-list").innerHTML=`<span class="err">Alert feed down</span>`}
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
window.openAlert=function(id){
  const feats=alertCache.features||[];
  let a=alertCache[id];
  if(!a){const f=feats.find(x=>x.id===id); a=f&&(f.properties||f)}
  if(!a){openModal("Alert","<span class='err'>Not found</span>");return;}
  let body=`<div style="color:var(--red);font-weight:700;margin-bottom:6px">${esc(a.headline||a.event)}</div>
  <div style="color:var(--text-dim);font-size:11px;margin-bottom:8px">${esc(a.severity||"—")} · ${esc(a.urgency||"—")} · ${esc(a.certainty||"—")}</div>
  <div style="margin-bottom:8px"><b>Area:</b> ${esc(a.areaDesc||"")}</div>
  <div style="background:var(--bg);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;font-family:var(--font-mono)">${esc(a.description||"")}</div>`;
  if(a.instruction)body+=`<div style="margin-top:10px;color:var(--amber);font-weight:600;font-size:11px">ACTIONS</div><div style="background:var(--bg);padding:10px;border:1px solid var(--line);white-space:pre-wrap;font-size:12px;color:var(--cyan);font-family:var(--font-mono)">${esc(a.instruction)}</div>`;
  openModal("NWS Alert",body,a.severity);
};

async function fetchObs(){
  try{
    const headers={Accept:"application/geo+json,application/ld+json","User-Agent":"WeatherXplr/2.0 (github.com/jasonsaro-ops)"};
    const pts=await fetchT(`https://api.weather.gov/points/${LAT},${LON}`,{headers},12000).then(r=>r.json());
    const stUrl=pts.properties&&pts.properties.observationStations;
    if(!stUrl) throw new Error("no stations");
    const st=await fetchT(stUrl,{headers},12000).then(r=>r.json());
    const stations=(st.features||[]).slice(0,8);
    const results=await Promise.all(stations.map(s=>{
      const id=s.properties.stationIdentifier;
      return fetchT(`https://api.weather.gov/stations/${id}/observations/latest`,{headers},10000)
        .then(r=>r.json()).then(obs=>({id,name:s.properties.name,obs})).catch(()=>null);
    }));
    obsCache=results.filter(Boolean);
    const box=$("obs-list");
    if(box){
      box.innerHTML=obsCache.map(o=>{
        const p=o.obs.properties||{};
        const tC=p.temperature&&p.temperature.value;
        const tF=tC!=null?Math.round(tC*9/5+32):"—";
        return `<div class="obs-row"><div><div class="id">${esc(o.id)}</div><div class="nm">${esc(o.name||"")}</div></div><div class="tv">${tF}°</div></div>`;
      }).join("")||'<span class="err">No obs</span>';
    }
    setFeed("nws",true);
  }catch(e){console.warn("obs",e);setFeed("nws",false)}
}
window.openObs=function(id){const p=obsCache[id];if(!p)return;
  const tF=p.temperature&&p.temperature.value!=null?((p.temperature.value*9/5)+32).toFixed(1):"—";
  openModal(`Station ${id}`,`<div class="metric-row"><span class="k">Temp</span><span class="v">${tF}°F</span></div>
  <div class="metric-row"><span class="k">Conditions</span><span class="v">${esc(p.textDescription||"—")}</span></div>
  ${p.rawMessage?`<pre style="margin-top:10px;background:var(--bg);padding:8px;font-size:11px;font-family:var(--font-mono);overflow:auto">${esc(p.rawMessage)}</pre>`:""}`)};

async function fetchAQI(){
  try{
    const data=await fetchT(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide&timezone=America%2FNew_York`,{},12000).then(r=>r.json());
    setFeed("aqi",true);
    const c=data.current||{};
    aqiCache={current:c};
    const aqi=c.us_aqi;
    $("aqi-val").textContent=aqi!=null?aqi:"—";
    let cat="—";
    if(aqi!=null){
      if(aqi<=50)cat="Good"; else if(aqi<=100)cat="Moderate"; else if(aqi<=150)cat="USG"; else if(aqi<=200)cat="Unhealthy"; else cat="Very Unhealthy";
    }
    $("aqi-cat").textContent=cat;
    $("aqi-cat").style.color=aqi!=null&&aqi>100?"var(--red)":aqi>50?"var(--amber)":"var(--green)";
  }catch(e){console.warn("AQI",e);setFeed("aqi",false)}
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
  try{
    const station="8545240";
    const [wl,air]=await Promise.all([
      fetchT(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${station}&product=water_level&datum=MLLW&units=english&time_zone=lst_ldt&format=json`,{},12000).then(r=>r.json()),
      fetchT(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${station}&product=air_temperature&units=english&time_zone=lst_ldt&format=json`,{},12000).then(r=>r.json()),
    ]);
    setFeed("tides",true);
    const last=wl.data&&wl.data[wl.data.length-1];
    const la=air.data&&air.data[air.data.length-1];
    $("tide-mllw").textContent=last?last.v+" ft":"—";
    $("tide-air").textContent=la?la.v+"°F":"—";
    window.__tide={last,la,wl};
  }catch(e){console.warn("tides",e);setFeed("tides",false)}
}
window.openTides=function(){const t=window.__tide||{};openModal("Tides · 8545240",`<div class="metric-row"><span class="k">MLLW</span><span class="v">${t.last?t.last.v+" ft":"—"}</span></div><div class="metric-row"><span class="k">Air</span><span class="v">${t.la?t.la.v+"°F":"—"}</span></div><div style="margin-top:8px;font-size:11px;color:var(--text-dim)">NOAA CO-OPS · Delaware River</div>`)};

async function fetchKPHL(){
  try{
    const headers={Accept:"application/geo+json,application/ld+json","User-Agent":"WeatherXplr/2.0 (github.com/jasonsaro-ops)"};
    const obs=await fetchT("https://api.weather.gov/stations/KPHL/observations/latest",{headers},12000).then(r=>r.json());
    kphlObs=obs.properties||{};
    const p=kphlObs;
    const tC=p.temperature&&p.temperature.value;
    $("kphl-temp").innerHTML=(tC!=null?Math.round(tC*9/5+32):"—")+`<span class="card-unit">°F</span>`;
    $("kphl-desc").textContent=p.textDescription||"Philadelphia Intl";
    try{
      const list=await fetchT("https://api.weather.gov/products/types/AFD/locations/PHI",{headers},12000).then(r=>r.json());
      const g=list["@graph"]||[];
      if(g.length){
        const prod=await fetchT(g[0]["@id"]||`https://api.weather.gov/products/${g[0].id}`,{headers},12000).then(r=>r.json());
        afdFull=prod.productText||"";
      }
    }catch(e){}
  }catch(e){console.warn("KPHL",e)}
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
  await Promise.allSettled([
    fetchOpenMeteo().catch(e=>console.warn(e)),
    fetchAlerts().catch(e=>console.warn(e)),
    fetchObs().catch(e=>console.warn(e)),
    fetchAQI().catch(e=>console.warn(e)),
    fetchTides().catch(e=>console.warn(e)),
    fetchKPHL().catch(e=>console.warn(e)),
  ]);
  try{ fetchHydro(); }catch(e){}
  $("chip-sync") && ($("chip-sync").textContent="SYNC "+new Date().toLocaleTimeString("en-US",{hour12:false}));
}

/* ========== Leaflet + Mesonet NEXRAD (clickable) ========== */

/* ========== Radar loop (Mesonet frames) ========== */
const RADAR_FRAMES = ["m50m","m45m","m40m","m35m","m30m","m25m","m20m","m15m","m10m","m05m",""];
let radarFrameIdx = RADAR_FRAMES.length - 1;
let radarPlaying = false;
let radarTimer = null;

function radarUrl(product, frame){
  // product: radar | velocity
  if(product === "velocity"){
    return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0v${frame ? "-" + frame : ""}-900913/{z}/{x}/{y}.png`;
  }
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q${frame ? "-" + frame : ""}-900913/{z}/{x}/{y}.png`;
}

function setRadarFrame(idx){
  radarFrameIdx = Math.max(0, Math.min(RADAR_FRAMES.length - 1, idx));
  const frame = RADAR_FRAMES[radarFrameIdx];
  if(wxLayers.radar){
    const next = L.tileLayer(radarUrl("radar", frame), { opacity: 0.7, maxZoom: 12, maxNativeZoom: 10 });
    if(wxMap.hasLayer(wxLayers.radar)){
      wxMap.removeLayer(wxLayers.radar);
      next.addTo(wxMap);
    }
    wxLayers.radar = next;
  }
  const lab = $("radar-age");
  if(lab) lab.textContent = frame ? frame.replace("m","") + " ago" : "LIVE";
}

function playRadar(on){
  radarPlaying = !!on;
  const btn = $("btn-radar-play");
  if(btn){
    btn.classList.toggle("on", radarPlaying);
    btn.innerHTML = radarPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  }
  if(radarTimer){ clearInterval(radarTimer); radarTimer = null; }
  if(!radarPlaying) return;
  radarTimer = setInterval(()=>{
    let n = radarFrameIdx + 1;
    if(n >= RADAR_FRAMES.length) n = 0;
    setRadarFrame(n);
  }, 700);
}

function refreshRadarTiles(){
  // Bust cache / pull latest live frame
  if(radarPlaying) return; // don't interrupt loop mid-play with live snap every time
  setRadarFrame(RADAR_FRAMES.length - 1);
}

function initRadarAnimControls(){
  $("btn-radar-play")?.addEventListener("click", ()=> playRadar(!radarPlaying));
  $("btn-radar-live")?.addEventListener("click", ()=>{
    playRadar(false);
    setRadarFrame(RADAR_FRAMES.length - 1);
  });
  // 2-minute radar refresh
  setInterval(refreshRadarTiles, 120000);
}

const RADAR_TILES = {
  radar: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
  velocity: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0v-900913/{z}/{x}/{y}.png",
  satellite: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-ir-4km-900913/{z}/{x}/{y}.png",
  qpe: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/q2-n1p-900913/{z}/{x}/{y}.png",
};
let wxMap = null;
let wxLayers = {};
let sampleMarker = null;

function initWxMap(){
  if(typeof L === "undefined"){ console.error("Leaflet missing"); return; }
  const el = $("wx-map");
  if(!el){ console.error("#wx-map missing"); return; }
  if(wxMap){ wxMap.invalidateSize(true); return; }
  wxMap = L.map(el, {
    center: [sampleLat, sampleLon],
    zoom: mapZoom || 8,
    minZoom: 4,
    maxZoom: 12,
    zoomControl: false,
    preferCanvas: true,
  });
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, maxNativeZoom: 16, attribution: "Esri · NWS · Iowa State Mesonet" }
  ).addTo(wxMap);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, maxNativeZoom: 16, opacity: 0.85 }
  ).addTo(wxMap);

  wxLayers.radar = L.tileLayer(RADAR_TILES.radar, { opacity: 0.7, maxZoom: 12, maxNativeZoom: 10, attribution: "NEXRAD" });
  wxLayers.velocity = L.tileLayer(RADAR_TILES.velocity, { opacity: 0.55, maxZoom: 12, maxNativeZoom: 10 });
  wxLayers.satellite = L.tileLayer(RADAR_TILES.satellite, { opacity: 0.5, maxZoom: 12, maxNativeZoom: 10 });
  wxLayers.qpe = L.tileLayer(RADAR_TILES.qpe, { opacity: 0.55, maxZoom: 12, maxNativeZoom: 10 });
  wxLayers.radar.addTo(wxMap);
  L.control.zoom({ position: "bottomleft" }).addTo(wxMap);

  sampleMarker = L.circleMarker([sampleLat, sampleLon], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#3b9eff", fillOpacity: 0.95
  }).addTo(wxMap);
  sampleMarker.bindTooltip("Storm 3D sample", { permanent: false });

  wxMap.on("click", (e) => {
    setSample(e.latlng.lat, e.latlng.lng, null);
  });
  wxMap.on("moveend", () => { mapZoom = wxMap.getZoom(); });

  document.querySelectorAll(".model-chip[data-layer]").forEach(chip => {
    chip.addEventListener("click", () => {
      const key = chip.dataset.layer;
      document.querySelectorAll(".model-chip[data-layer]").forEach(c => c.classList.remove("on"));
      chip.classList.add("on");
      ["radar","velocity","satellite","qpe"].forEach(k => {
        if(wxLayers[k] && wxMap.hasLayer(wxLayers[k])) wxMap.removeLayer(wxLayers[k]);
      });
      if(wxLayers[key]) wxLayers[key].addTo(wxMap);
    });
  });
  const bindLy = (id, key) => {
    $(id)?.addEventListener("change", (e) => {
      if(!wxLayers[key]) return;
      if(e.target.checked) wxLayers[key].addTo(wxMap);
      else if(wxMap.hasLayer(wxLayers[key])) wxMap.removeLayer(wxLayers[key]);
    });
  };
  bindLy("ly-radar", "radar");
  bindLy("ly-velocity", "velocity");
  bindLy("ly-sat", "satellite");
  bindLy("ly-qpe", "qpe");

  $("btn-layers")?.addEventListener("click", () => {
    $("layer-pop")?.classList.toggle("open");
    $("btn-layers")?.classList.toggle("on");
  });
  $("btn-home")?.addEventListener("click", () => {
    setSample(PRESETS.sepa.lat, PRESETS.sepa.lon, "sepa");
  });

  setTimeout(() => wxMap.invalidateSize(true), 250);
  window.addEventListener("resize", () => wxMap && wxMap.invalidateSize(true));
  document.addEventListener("fullscreenchange", () => setTimeout(() => wxMap && wxMap.invalidateSize(true), 150));
}

function setLayer(layer){
  if(!wxMap) return;
  wxMap.setView([sampleLat, sampleLon], mapZoom || 8, { animate: true });
  if(sampleMarker) sampleMarker.setLatLng([sampleLat, sampleLon]);
}

function initRadar(){
  initWxMap();
  initRadarAnimControls();
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    document.querySelectorAll(".seg button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    document.querySelectorAll(".pane").forEach(pn => pn.classList.remove("on"));
    $("pane-" + b.dataset.pane)?.classList.add("on");
  });
  document.querySelectorAll(".nav-tab").forEach(t => t.onclick = () => {
    document.querySelectorAll(".nav-tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    if(t.dataset.view === "alerts") document.querySelector('.seg button[data-pane="alerts"]')?.click();
    if(t.dataset.view === "models" && typeof openModels === "function") openModels();
  });
}


async function boot(){
  const bar=$("boot-prog"),st=$("boot-st");
  const steps=[[15,"CONNECTING NWS…"],[35,"OPEN-METEO · HRRR…"],[55,"ALERTS · SPC…"],[75,"OBS · AQ · TIDES…"],[90,"RADAR ARRAY…"],[100,"DISPATCH ONLINE"]];
  let i=0;const t=setInterval(()=>{if(i<steps.length){bar.style.width=steps[i][0]+"%";st.textContent=steps[i][1];i++}},280);
  const dismiss=()=>{
    clearInterval(t);
    if(bar) bar.style.width="100%";
    if(st) st.textContent="ONLINE";
    $("boot")?.classList.add("out");
    $("app")?.classList.add("on");
    setTimeout(()=>$("boot")?.remove(),600);
  };
  try{
    initRadar();
  }catch(e){ console.error("initRadar", e); }
  try{ initAudio(); }catch(e){}
  try{ if(typeof tickClock==='function'){ tickClock(); setInterval(tickClock,1000);} }catch(e){console.warn(e);}
  try{
    await Promise.race([
      refreshAll(),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("boot timeout")), 15000))
    ]);
  }catch(e){ console.warn("refreshAll boot", e); }
  try{ initStorm3DControls(); }catch(e){ console.error(e); }
  setTimeout(()=>{ try{ refreshStorm3DPane(); }catch(e){} }, 500);
  dismiss();
  setInterval(()=>{cd--;if(cd<=0){cd=CYCLE;refreshAll().catch(()=>{})}$("cd").textContent=cd},1000);
  // Leaflet needs size after app visible
  setTimeout(()=>{ try{ wxMap && wxMap.invalidateSize(true); }catch(e){} }, 700);
}
document.addEventListener("DOMContentLoaded",boot);

/* ========== STORM 3D (always-on pane + click-to-sample) ========== */
// Worker URL is set in index.html → window.STORM3D_WORKER_URL (no manual button needed)
const STORM3D_WORKER = (typeof window !== "undefined" && window.STORM3D_WORKER_URL) ||
  localStorage.getItem("wx_storm3d_worker") || "";

let s3d = { renderer:null, scene:null, camera:null, cloud:null, anim:null, data:null, _ro:null };

function setSample(lat, lon, presetKey){
  sampleLat = +lat; sampleLon = +lon;
  const el = $("s3d-loc");
  if(el) el.textContent = sampleLat.toFixed(4) + "°N " + Math.abs(sampleLon).toFixed(4) + "°W · sample";
  const la=$("s3d-lat"), lo=$("s3d-lon");
  if(la) la.value = sampleLat.toFixed(4);
  if(lo) lo.value = sampleLon.toFixed(4);
  document.querySelectorAll("#s3d-presets button").forEach(b=>{
    b.classList.toggle("active", presetKey && b.dataset.preset===presetKey);
  });
  if(wxMap){
    wxMap.setView([sampleLat, sampleLon], mapZoom || wxMap.getZoom() || 8, { animate: true });
    if(sampleMarker) sampleMarker.setLatLng([sampleLat, sampleLon]);
    else sampleMarker = L.circleMarker([sampleLat, sampleLon], { radius:7, color:"#fff", weight:2, fillColor:"#3b9eff", fillOpacity:0.95 }).addTo(wxMap);
  }
  const m=$("s3d-mode"); if(m) m.textContent="LOADING…";
  refreshStorm3DPane();
}




// Override earlier setLayer if defined later — we redefine after init; patch at end of boot

async function fetchStorm3D(){
  const lat = sampleLat, lon = sampleLon;
  if(STORM3D_WORKER){
    try{
      const r = await fetch(`${STORM3D_WORKER.replace(/\/$/,"")}?lat=${lat}&lon=${lon}`);
      if(r.ok) return await r.json();
    }catch(e){ console.warn("Storm3D worker failed", e); }
  }
  return buildStormClient(lat, lon);
}

async function buildStormClient(lat, lon){
  let cape=0, precip=0, code=0, gust=0, severe=[];
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,weather_code,wind_gusts_10m,cape&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`;
    const j=await fetch(u).then(r=>r.json());
    const c=j.current||{};
    precip=c.precipitation||0; code=c.weather_code||0; gust=c.wind_gusts_10m||0; cape=c.cape||0;
  }catch(e){}
  try{
    const j=await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`,{headers:{Accept:"application/geo+json","User-Agent":"WeatherXplr/1.0"}}).then(r=>r.json());
    severe=(j.features||[]).map(f=>f.properties||{}).filter(p=>{
      const s=(p.severity||"").toLowerCase();
      return s==="extreme"||s==="severe"||/thunder|tornado|funnel|severe/i.test(p.event||"");
    }).slice(0,5).map(p=>({event:p.event,severity:p.severity,headline:p.headline}));
  }catch(e){}

  let echoTop=0,maxDbz=0,maxDbzHt=0,coreTop=0,intensity="none";
  const hasTstorm=code>=95||severe.length>0;
  const raining=precip>=0.01||(code>=51&&code<90)||code===61||code===63||code===65||code===80||code===81||code===82;
  // Stratiform / light rain — still show a volume (CAPE often low in cool-season rain)
  if(raining||cape>200){
    intensity="weak";
    maxDbz=28+Math.min(20, precip*40+cape/100);
    echoTop=12000+Math.min(18000, precip*8000+cape*8);
    maxDbzHt=3000+Math.min(6000,cape*2);
    coreTop=echoTop*0.45;
  }
  if(hasTstorm||cape>500||precip>0.15||code>=80){
    intensity="weak";
    maxDbz=Math.max(maxDbz, 35+Math.min(25,cape/80+precip*30));
    echoTop=Math.max(echoTop, 18000+Math.min(28000,cape*12));
    maxDbzHt=Math.max(maxDbzHt, 4000+Math.min(8000,cape*2));
    coreTop=echoTop*0.55;
  }
  if(cape>1500||code>=95||severe.some(a=>/tornado|severe thunder/i.test(a.event||""))){
    intensity="moderate";
    maxDbz=50+Math.min(15,cape/200);
    echoTop=30000+Math.min(20000,cape*8);
    maxDbzHt=6000+Math.min(12000,cape*3);
    coreTop=echoTop*0.65;
  }
  if(cape>2500||severe.some(a=>/tornado/i.test(a.event||""))){
    intensity="strong";
    maxDbz=Math.min(72,58+cape/500);
    echoTop=Math.min(60000,40000+cape*6);
    maxDbzHt=8000+Math.min(15000,cape*2);
    coreTop=echoTop*0.72;
  }
  if(precip>0.3) maxDbz=Math.min(75, maxDbz+8);
  if(gust>40) coreTop=Math.min(echoTop*0.85,coreTop+3000);
  if(!raining&&!hasTstorm&&cape<200&&precip<0.01){echoTop=0;maxDbz=0;maxDbzHt=0;coreTop=0;intensity="none"}

  return{
    ok:true,
    mode:intensity==="none"?"clear":"estimated",
    disclaimer:"Estimated from Open-Meteo + NWS at sample point — not Level-II volume.",
    location:{lat,lon},
    time:new Date().toISOString(),
    timeLocal:new Date().toLocaleString("en-US",{timeZone:"America/New_York"}),
    metrics:{echoTopFt:Math.round(echoTop),maxDbz:Math.round(maxDbz*10)/10,maxDbzHeightFt:Math.round(maxDbzHt),coreTopFt:Math.round(coreTop),intensity,cape:Math.round(cape),precipIn:Math.round(precip*100)/100,weatherCode:code,gustMph:Math.round(gust)},
    alerts:severe,
    source:{meteo:"Open-Meteo",alerts:"api.weather.gov",path:STORM3D_WORKER?"worker":"client"}
  };
}

function dbzColor(dbz){
  // Match common NEXRAD reflectivity palette (approx)
  if(dbz < 5)  return 0x0a2f1a;
  if(dbz < 10) return 0x00e400; // light green
  if(dbz < 20) return 0x00c000;
  if(dbz < 25) return 0x90f090;
  if(dbz < 30) return 0xffff00; // yellow
  if(dbz < 35) return 0xe0e000;
  if(dbz < 40) return 0xffb000; // orange
  if(dbz < 45) return 0xff7000;
  if(dbz < 50) return 0xff0000; // red
  if(dbz < 55) return 0xd00000;
  if(dbz < 60) return 0xff00ff; // magenta
  if(dbz < 65) return 0xcc00cc;
  return 0xffffff;
}
function dbzOpacity(dbz){
  return Math.min(0.85, 0.12 + (dbz / 70) * 0.7);
}

function disposeStorm3D(){
  if(s3d.anim){cancelAnimationFrame(s3d.anim);s3d.anim=null}
  if(s3d._ro){try{s3d._ro.disconnect()}catch(e){} s3d._ro=null}
  if(s3d.cloud){
    s3d.scene&&s3d.scene.remove(s3d.cloud);
    s3d.cloud.geometry?.dispose?.();
    if(s3d.cloud.material){
      if(Array.isArray(s3d.cloud.material)) s3d.cloud.material.forEach(m=>m.dispose?.());
      else s3d.cloud.material.dispose?.();
    }
    // group children
    s3d.cloud.traverse?.(obj=>{
      obj.geometry?.dispose?.();
      if(obj.material){ if(Array.isArray(obj.material)) obj.material.forEach(m=>m.dispose?.()); else obj.material.dispose?.(); }
    });
    s3d.cloud=null;
  }
  if(s3d.renderer){
    s3d.renderer.dispose();
    const el=s3d.renderer.domElement;
    el?.parentNode?.removeChild(el);
    s3d.renderer=null;
  }
  s3d.scene=null;s3d.camera=null;
}

function buildStormCloud(metrics){
  const group = new THREE.Group();
  const echo = Math.max(metrics.echoTopFt || 0, 1);
  const core = metrics.coreTopFt || echo * 0.5;
  const maxDbz = metrics.maxDbz || 0;
  const maxHt = metrics.maxDbzHeightFt || core * 0.4;
  const intensity = metrics.intensity || "none";
  const rng = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

  if (maxDbz < 5 || echo < 1000) {
    const geo = new THREE.SphereGeometry(0.1, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a9850, transparent: true, opacity: 0.1 });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 0.04;
    group.add(m);
    return group;
  }

  // Dense stacked lobes — radar-colored by height / strength
  const layers = 22;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const hFt = echo * t;
    let dbz = maxDbz * (1 - Math.abs(hFt - maxHt) / Math.max(echo, 1));
    dbz = Math.max(8, dbz);
    if (hFt > core) dbz *= 0.82;
    if (hFt > echo * 0.9) dbz *= 0.5;
    const baseW = 0.1 + 0.58 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.6 + 0.4 * (maxDbz / 70));
    const geo = new THREE.SphereGeometry(Math.max(0.05, baseW), 14, 12);
    geo.scale(0.9 + 0.7 * rng(i), 0.3 + 0.5 * rng(i + 1), 0.9 + 0.6 * rng(i + 2));
    const mat = new THREE.MeshBasicMaterial({
      color: dbzColor(dbz),
      transparent: true,
      opacity: dbzOpacity(dbz),
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((rng(i + 11) - 0.5) * 0.4, t * 2.25, (rng(i + 13) - 0.5) * 0.4);
    mesh.userData = { baseY: mesh.position.y, phase: rng(i) * Math.PI * 2, amp: 0.02 + 0.04 * rng(i + 4), spin: 0.2 + rng(i + 5) };
    group.add(mesh);
  }

  // Vertical rods / updraft towers (color by strength)
  const rods = Math.max(5, Math.round(maxDbz / 6));
  for (let s = 0; s < rods; s++) {
    const h = 0.5 + 1.7 * rng(s + 20) * (maxDbz / 65);
    const r = 0.04 + 0.07 * rng(s);
    const geo = new THREE.CylinderGeometry(r * 0.35, r, h, 8);
    const dbz = maxDbz * (0.65 + 0.35 * rng(s + 2));
    const mat = new THREE.MeshBasicMaterial({
      color: dbzColor(dbz),
      transparent: true,
      opacity: 0.35 + 0.4 * (dbz / 70),
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((rng(s + 30) - 0.5) * 0.55, h * 0.5 + 0.08, (rng(s + 31) - 0.5) * 0.55);
    mesh.userData = { baseY: mesh.position.y, phase: rng(s + 7) * 6, amp: 0.03 + 0.05 * rng(s), pulse: true };
    group.add(mesh);
  }

  // Pointed cones (peaks)
  const spikes = Math.max(4, Math.round(maxDbz / 10));
  for (let s = 0; s < spikes; s++) {
    const h = 0.35 + 1.4 * rng(s + 40) * (maxDbz / 70);
    const cone = new THREE.ConeGeometry(0.05 + 0.1 * rng(s), h, 7);
    const dbz = maxDbz * (0.75 + 0.25 * rng(s + 2));
    const mat = new THREE.MeshBasicMaterial({
      color: dbzColor(Math.min(75, dbz + 5)),
      transparent: true,
      opacity: 0.5 + 0.3 * (dbz / 70),
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(cone, mat);
    mesh.position.set((rng(s + 50) - 0.5) * 0.5, h * 0.5 + 0.12, (rng(s + 51) - 0.5) * 0.5);
    mesh.userData = { baseY: mesh.position.y, phase: rng(s + 9) * 4, amp: 0.04, pulse: true };
    group.add(mesh);
  }

  // Hot core(s)
  for (let c = 0; c < 4; c++) {
    const coreGeo = new THREE.SphereGeometry(0.12 + 0.14 * (maxDbz / 70) * rng(c + 60), 12, 10);
    coreGeo.scale(1.3, 0.65, 1.15);
    const coreMat = new THREE.MeshBasicMaterial({
      color: dbzColor(Math.min(75, maxDbz + 5)),
      transparent: true,
      opacity: 0.55 + 0.25 * (maxDbz / 70),
      depthWrite: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(
      (rng(c + 70) - 0.5) * 0.22,
      Math.max(0.25, (maxHt / echo) * 2.2 * (0.65 + 0.35 * rng(c))),
      (rng(c + 71) - 0.5) * 0.22
    );
    coreMesh.userData = { baseY: coreMesh.position.y, phase: c, amp: 0.05, pulse: true, core: true };
    group.add(coreMesh);
  }

  // Anvil / overhang when strong
  if (maxDbz >= 40 && echo > 20000) {
    const anvil = new THREE.SphereGeometry(0.65, 16, 10);
    anvil.scale(1.85, 0.18, 1.6);
    const amat = new THREE.MeshBasicMaterial({
      color: dbzColor(maxDbz * 0.55),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const am = new THREE.Mesh(anvil, amat);
    am.position.y = 2.1;
    am.userData = { baseY: 2.1, phase: 1.2, amp: 0.02 };
    group.add(am);
  }

  // Outer rain shield (greener, lower)
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.SphereGeometry(0.2 + 0.25 * rng(i + 90), 10, 8);
    geo.scale(1.6, 0.35, 1.5);
    const mat = new THREE.MeshBasicMaterial({
      color: dbzColor(15 + 10 * rng(i)),
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set((rng(i + 100) - 0.5) * 1.1, 0.15 + 0.3 * rng(i), (rng(i + 101) - 0.5) * 1.1);
    m.userData = { baseY: m.position.y, phase: rng(i), amp: 0.03 };
    group.add(m);
  }

  group.userData.intensity = intensity;
  group.userData.maxDbz = maxDbz;
  return group;
}


function initStormScene(container, metrics){
  if(!window.THREE || !container) return;
  disposeStorm3D();
  const w=Math.max(container.clientWidth||300, 120);
  const h=Math.max(container.clientHeight||200, 160);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x05070c);
  const camera=new THREE.PerspectiveCamera(42, w/h, 0.1, 100);
  camera.position.set(3.2, 1.8, 3.2);
  camera.lookAt(0, 1.0, 0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setSize(w,h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  container.appendChild(renderer.domElement);
  renderer.domElement.id="s3d-canvas";
  renderer.domElement.style.width="100%";
  renderer.domElement.style.height="100%";
  renderer.domElement.style.display="block";

  const boxH=2.4, boxW=1.6;
  const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(boxW, boxH, boxW));
  const line=new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color:0x3a4458}));
  line.position.y=boxH/2;
  scene.add(line);
  const floor=new THREE.GridHelper(boxW, 6, 0x2a3140, 0x1e2430);
  floor.position.y=0.01;
  scene.add(floor);

  const cloud=buildStormCloud(metrics||{});
  scene.add(cloud);
  s3d={renderer,scene,camera,cloud,anim:null,data:metrics,_ro:null};
  let t0=performance.now();
  function tick(now){
    s3d.anim=requestAnimationFrame(tick);
    const t=(now-t0)/1000;
    if(s3d.cloud){
      s3d.cloud.rotation.y = t * 0.18;
      // Fluxuating peaks / rods / cores
      s3d.cloud.children.forEach((ch, i) => {
        const u = ch.userData || {};
        if (u.baseY != null) {
          const amp = u.amp || 0.03;
          const phase = u.phase || i;
          ch.position.y = u.baseY + Math.sin(t * (u.pulse ? 2.2 : 1.4) + phase) * amp;
          if (u.pulse) {
            const s = 1 + 0.08 * Math.sin(t * 3.1 + phase);
            ch.scale.y = s;
          }
          if (u.spin) ch.rotation.y = t * u.spin;
        }
        // Subtle opacity shimmer on materials
        if (ch.material && ch.material.opacity != null && !u.core) {
          const base = ch.material.userData?.baseOp ?? (ch.material.userData = { baseOp: ch.material.opacity }, ch.material.userData.baseOp);
          ch.material.opacity = Math.min(0.9, base * (0.85 + 0.2 * Math.sin(t * 2 + i)));
        }
      });
    }
    const r = 4.3;
    camera.position.x = Math.sin(t * 0.14) * r;
    camera.position.z = Math.cos(t * 0.14) * r;
    camera.position.y = 1.65 + Math.sin(t * 0.22) * 0.2;
    camera.lookAt(0, 1.05, 0);
    renderer.render(scene, camera);
  }
  tick(t0);
  const ro=new ResizeObserver(()=>{
    if(!s3d.renderer) return;
    const nw=container.clientWidth, nh=container.clientHeight;
    if(nw<10||nh<10) return;
    s3d.camera.aspect=nw/Math.max(nh,1);
    s3d.camera.updateProjectionMatrix();
    s3d.renderer.setSize(nw,nh);
  });
  ro.observe(container);
  s3d._ro=ro;
}

function updateStormMetricsUI(data){
  const m=(data&&data.metrics)||{};
  const mode=(data&&data.mode)||"—";
  const set=(id,v)=>{const e=$(id); if(e) e.textContent=v};
  set("s3d-mode", String(mode).toUpperCase());
  set("s3d-echo", m.echoTopFt ? m.echoTopFt.toLocaleString()+" ft" : "—");
  set("s3d-dbz", m.maxDbz!=null ? m.maxDbz+" dBZ" : "—");
  set("s3d-core", m.coreTopFt ? m.coreTopFt.toLocaleString()+" ft" : "—");
  set("s3d-cape", m.cape!=null ? m.cape+" J/kg" : "—");
  set("s3d-pg", `${m.precipIn??"—"} in · ${m.gustMph??"—"} mph`);
}

async function refreshStorm3DPane(){
  const box=$("s3d-container");
  if(!box) return;
  try{
    const data=await fetchStorm3D();
    s3d.data=data;
    updateStormMetricsUI(data);
    initStormScene(box, data.metrics||{});
  }catch(e){
    updateStormMetricsUI({mode:"error",metrics:{}});
    console.warn(e);
  }
}
window.refreshStorm3D=refreshStorm3DPane;

// Click-to-sample: approximate lat/lon from pixel over Windy iframe (Web Mercator)
function initStorm3DControls(){
  document.querySelectorAll("#s3d-presets button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key=btn.dataset.preset;
      const p=PRESETS[key];
      if(p) setSample(p.lat, p.lon, key);
    });
  });
  $("btn-s3d-go")?.addEventListener("click", ()=>{
    const lat=parseFloat($("s3d-lat")?.value);
    const lon=parseFloat($("s3d-lon")?.value);
    if(Number.isFinite(lat)&&Number.isFinite(lon)) setSample(lat, lon, null);
  });
  ["s3d-lat","s3d-lon"].forEach(id=>{
    $(id)?.addEventListener("keydown", e=>{ if(e.key==="Enter") $("btn-s3d-go")?.click(); });
  });
  document.querySelectorAll(".nudge button[data-nudge]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const d=0.25;
      const n=btn.dataset.nudge;
      if(n==="n") setSample(sampleLat+d, sampleLon, null);
      if(n==="s") setSample(sampleLat-d, sampleLon, null);
      if(n==="e") setSample(sampleLat, sampleLon+d, null);
      if(n==="w") setSample(sampleLat, sampleLon-d, null);
      if(n==="0") refreshStorm3DPane();
    });
  });
  $("btn-s3d-refresh")?.addEventListener("click", ()=>refreshStorm3DPane());
  $("chip-storm3d")?.addEventListener("click", ()=>refreshStorm3DPane());

  // Fullscreen / window resize → force 3D canvas resize
  const forceS3dResize=()=>{
    const box=$("s3d-container");
    if(!box||!s3d.renderer||!s3d.camera) return;
    const nw=box.clientWidth, nh=box.clientHeight;
    if(nw<20||nh<20) return;
    s3d.camera.aspect=nw/nh;
    s3d.camera.updateProjectionMatrix();
    s3d.renderer.setSize(nw, nh, false);
    s3d.renderer.render(s3d.scene, s3d.camera);
  };
  window.addEventListener("resize", forceS3dResize);
  document.addEventListener("fullscreenchange", ()=>setTimeout(forceS3dResize, 100));
  // Observe the pane itself
  const pane=$("s3d-pane");
  if(pane && window.ResizeObserver){
    new ResizeObserver(()=>forceS3dResize()).observe(pane);
  }
}



// Keep modal openStorm3D as optional deep-dive without Worker URL button
window.openStorm3D=async function(){
  await refreshStorm3DPane();
  const data=s3d.data||{};
  const m=data.metrics||{};
  openModal("Storm 3D · sample", `
    <div class="metric-row"><span class="k">Point</span><span class="v">${sampleLat.toFixed(4)}, ${sampleLon.toFixed(4)}</span></div>
    <div class="metric-row"><span class="k">Mode</span><span class="v">${esc((data.mode||"—").toUpperCase())}</span></div>
    <div class="metric-row"><span class="k">Echo top</span><span class="v">${m.echoTopFt?m.echoTopFt.toLocaleString()+" ft":"—"}</span></div>
    <div class="metric-row"><span class="k">Max dBZ</span><span class="v">${m.maxDbz!=null?m.maxDbz+" dBZ":"—"}</span></div>
    <div class="metric-row"><span class="k">Core top</span><span class="v">${m.coreTopFt?m.coreTopFt.toLocaleString()+" ft":"—"}</span></div>
    <div class="metric-row"><span class="k">CAPE</span><span class="v">${m.cape!=null?m.cape+" J/kg":"—"}</span></div>
    <p style="margin-top:10px;font-size:11px;color:var(--text-dim)">${esc(data.disclaimer||"")}</p>
    <p style="font-size:11px;color:var(--text-dim)">Worker: ${STORM3D_WORKER?esc(STORM3D_WORKER):"client heuristics"}</p>
  `);
};

