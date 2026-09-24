/* Lot Profiler 1.4 — all client logic.
   Each PLUTO release is one gzipped binary pack (tools/build.py) decoded straight into typed arrays.
   Subway data comes from data/transit.json (tools/transit.py) or, failing that, live from
   MTA Open Data and OpenStreetMap. Nothing here needs an API key. */
"use strict";

/* ═══ palette & vocab (order matches tools/build.py) ═══════════════════ */
const LU_COLORS = ["#F7E08A","#F2A93B","#C4692A","#EC7B62","#C8323B","#9A6FAA",
                   "#B8B2CC","#5B93C4","#77B36B","#C9C9C0","#80807A","#DEDBD2"];
const FC_COLORS = ["#0B5D3B","#4E9C55","#AFC97E","#E7C463","#BE3E32","#95A0AE","#D9D6CB"];
const UB_RAMP   = ["#DCE8F5","#B7D2EC","#8FB9E2","#639CD4","#3D7EC0","#2763A4","#174C86","#0C3765","#062647"];
const UB_RANGE  = [[1,1],[2,2],[3,3],[4,4],[5,9],[10,19],[20,49],[50,99],[100,null]];
const UB_STARTS = [1,2,3,4,5,10,20,50,100];
const YB_CLASSES = [["Before 1900",0,1900,"#243A73"],["1900–1929",1900,1930,"#2F78B0"],
  ["1930–1960",1930,1961,"#4FB3BF"],["1961–1989",1961,1990,"#A6D8A8"],["1990 or later",1990,9999,"#EEDC5B"]];
const DECADES = ["<1900","1900s","1910s","1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];
const RAMPS = {blues:["#EEF4FA","#C3DAEE","#86B6DC","#4A8CC6","#1F5E9E","#0B3566"],
  greens:["#F1F8EC","#C8E6B5","#8FCB7F","#4EA65A","#20793A","#0B4A24"],
  viridis:["#440154","#414487","#2A788E","#22A884","#7AD151","#FDE725"],
  magma:["#FCFDBF","#FE9F6D","#DE4968","#8C2981","#3B0F70","#000004"]};
const RANGE_DEFAULT = {bf:[0,4], mf:[0,6], fd:[-1,3]};
const VIEW_LABEL = {lu:"Land use",ub:"Units per building",zn:"Zoning district",fc:"FAR capacity category",
  bf:"Built FAR",mf:"Maximum usable FAR (modeled)",fd:"Unused FAR (maximum minus built)",yb:"Year built"};
const CAT_VIEWS = new Set(["lu","ub","fc","zn"]);
const NODATA = "#D5D9DD";
const SIZES = {s:["24px","118px"], m:["38px","168px"], l:["56px","228px"]};
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";          // keyless vector basemap
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NYC_BOX = [-74.27, 40.49, -73.68, 40.92];
const SEL_COLORS = ["#14263B","#D1495B","#1B62A5","#2A9D8F","#E08A1E","#7B4FA0","#3C8D2F","#C45BAA"];
const TRUNKS = ["#EE352E","#00933C","#B933AD","#0039A6","#FF6319","#6CBE45","#996633","#A7A9AC","#FCCC0A","#808183","#1D2F6F"];
const BORO = {1:"Manhattan",2:"Bronx",3:"Brooklyn",4:"Queens",5:"Staten Island"};
const BORO_WORD = {manhattan:1,mn:1,bronx:2,bx:2,brooklyn:3,bk:3,queens:4,qn:4,"staten island":5,si:5,statenisland:5};
const MTA = {A:"#0039A6",C:"#0039A6",E:"#0039A6",B:"#FF6319",D:"#FF6319",F:"#FF6319",M:"#FF6319",G:"#6CBE45",
  J:"#996633",Z:"#996633",L:"#A7A9AC",N:"#FCCC0A",Q:"#FCCC0A",R:"#FCCC0A",W:"#FCCC0A","1":"#EE352E","2":"#EE352E",
  "3":"#EE352E","4":"#00933C","5":"#00933C","6":"#00933C","7":"#B933AD",S:"#808183",SIR:"#1D2F6F"};
const ROUTE_ORDER = "1234567ACEBDFMGJZLNQRWS".split("").concat(["SIR"]);
const ENT_COLOR = {elevator:"#1B62A5", stair:"#14263B", escalator:"#7B4FA0", ramp:"#1B62A5", other:"#7A8794"};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = (v,d=0) => v==null||Number.isNaN(v)||v===""? "—" : (+v).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt1 = v => v==null||v===""? "—" : (+v).toLocaleString("en-US",{maximumFractionDigits:1});
const pct = (a,b) => b ? a/b*100 : 0;
const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const bullet = r => `<span class="rb${MTA[r]==="#FCCC0A"?" dark":""}" style="background:${MTA[r]||"#808183"}">${esc(r)}</span>`;

/* ═══ state ════════════════════════════════════════════════════════════ */
const st = {
  releases:[], packs:new Map(), P:null, C:null, T:null, sels:[], view:"all", addMode:false, prevSel:null, pending:null,
  mode:"area", colorBy:"lu", radiusPreset:0, base:null, curIdx:null,
  opts:{style:"bars", size:"s", luExcl:new Set(), div:Array(8).fill(true),
        order:["lu","ub","fc","access","age","zone","list"]},
  map:{opacity:0.85, lotLines:true, labels:true, basemap:"map", ntas:true, tracts:false, dim:true,
       hidden:{lu:new Set(),ub:new Set(),fc:new Set(),zn:new Set()}, range:{...RANGE_DEFAULT}, ramp:"blues",
       sub:{lines:true, stations:true, names:true, entrances:true, platforms:true}, rings:0},
  specs:{},
};
/* The profile shows one "current" selection: a single entry, one entry picked from several,
   or all of them combined ({type:"multi"}). */
Object.defineProperty(st,"sel",{get(){ const S=st.sels; if (!S.length) return null; if (S.length===1) return S[0].sel;
  if (typeof st.view==="number" && S[st.view]) return S[st.view].sel; return {type:"multi",parts:S.map(e=>e.sel)}; }});
let map, markers=[], stMarkers=new Map();

/* ═══ release packs ════════════════════════════════════════════════════ */
async function packBytes(rel){
  if (window.__LP__){ const bin=atob(window.__LP__.packs[rel.id]), u=new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
  const r = await fetch("data/"+rel.file);
  if (!r.ok) throw new Error(`Couldn't load data/${rel.file} (HTTP ${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
}
async function gunzip(u){
  if (u[0]!==0x1f || u[1]!==0x8b) return u;
  if (!("DecompressionStream" in window)) throw new Error("This browser can't unpack the data. Use a current Chrome, Safari (16.4+), Firefox or Edge.");
  return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
}
const DT = {i4:Int32Array,u4:Uint32Array,u2:Uint16Array,u1:Uint8Array,f4:Float32Array,f8:Float64Array};
function decode(u){
  if (String.fromCharCode(u[0],u[1],u[2],u[3])!=="LPK2") throw new Error("Unrecognized data file.");
  const hl = u[4]|u[5]<<8|u[6]<<16|u[7]<<24;
  const H = JSON.parse(new TextDecoder().decode(u.subarray(8,8+hl)));
  const base = Math.ceil((8+hl)/8)*8, buf = u.buffer.slice(u.byteOffset, u.byteOffset+u.byteLength);
  const P = {id:H.release, n:H.n, dict:H.dict, areas:H.areas, blocks:H.blocks||[], addr:H.addr, origin:H.origin, q:H.q};
  for (const [name,[t,off,count]] of Object.entries(H.sections)) P[name] = new DT[t](buf, base+off, count);
  const [ox,oy]=H.origin; P.lng=new Float64Array(P.n); P.lat=new Float64Array(P.n);
  let x0=180,y0=90,x1=-180,y1=-90;
  for (let i=0;i<P.n;i++){ const x=P.lng[i]=ox+P.cx[i]/H.q, y=P.lat[i]=oy+P.cy[i]/H.q;
    if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  P.bbox=[[x0,y0],[x1,y1]];
  P.areaIdx=new Map(P.areas.map((a,i)=>[a.kind+":"+a.code,i]));
  P.blockIdx=new Map(P.blocks.map((b,j)=>[b.key,j]));
  P.bblIdx=new Map(); for (let i=0;i<P.n;i++) P.bblIdx.set(Math.round(P.bbl[i]),i);
  P.addrLower=P.addr.map(s=>s.toLowerCase());
  P.blkCount=new Uint32Array(P.blocks.length); for (let i=0;i<P.n;i++) if (P.blk[i]<P.blocks.length) P.blkCount[P.blk[i]]++;
  return P;
}
function rec(P){ if (!P.recObj) P.recObj = P.rec ? JSON.parse(new TextDecoder().decode(P.rec)) : {}; return P.recObj; }
async function getPack(id){
  if (!st.packs.has(id)){ const rel=st.releases.find(r=>r.id===id); st.packs.set(id, gunzip(await packBytes(rel)).then(decode)); }
  return st.packs.get(id);
}
const nz = v => Number.isNaN(v) ? -999 : Math.round(v*100)/100;
function lotsGeoJSON(P){
  if (P.geo) return P.geo;
  const [ox,oy]=P.origin, q=P.q, V=P.verts, feats=[];
  P.geom = new Array(P.n);
  for (let i=0;i<P.n;i++){
    const polys=[];
    for (let p=P.polyOff[i]; p<P.polyOff[i+1]; p++){
      const rings=[];
      for (let r=P.ringOff[p]; r<P.ringOff[p+1]; r++){
        const v0=P.vertOff[r], v1=P.vertOff[r+1], ring=new Array(v1-v0+1); let x=0,y=0;
        for (let v=v0; v<v1; v++){ x+=V[2*v]; y+=V[2*v+1]; ring[v-v0]=[ox+x/q, oy+y/q]; }
        ring[v1-v0]=ring[0]; rings.push(ring);
      }
      polys.push(rings);
    }
    if (!polys.length) continue;
    const geometry = polys.length===1 ? {type:"Polygon",coordinates:polys[0]} : {type:"MultiPolygon",coordinates:polys};
    P.geom[i] = polys;
    feats.push({type:"Feature", id:i, geometry, properties:{lu:P.lu[i], ub:P.ub[i], fc:P.fc[i], zn:P.zone[i], yb:P.year[i],
      fd:nz(P.fdiff[i]), bf:nz(P.bfar[i]), mf:nz(P.mfar[i])}});
  }
  return P.geo = {type:"FeatureCollection", features:feats};
}
function areasGeoJSON(P, kind){
  return {type:"FeatureCollection", features:P.areas.map((a,i)=>a.kind!==kind?null:({type:"Feature",id:i,
    properties:{i,name:a.name}, geometry:{type:"MultiPolygon",coordinates:a.polys}})).filter(Boolean)};
}
const bblParts = bbl => { const b=Math.round(bbl); return {boro:Math.floor(b/1e9), block:Math.floor(b/1e4)%1e5, lot:b%1e4}; };
const blockName = key => `${BORO[Math.floor(key/1e5)]||"Borough "+Math.floor(key/1e5)} block ${key%1e5}`;

/* ═══ geometry ═════════════════════════════════════════════════════════ */
const MLAT=110574, mlng=lat=>111320*Math.cos(lat*Math.PI/180);
const distM=(a,b)=>Math.hypot((a[0]-b[0])*mlng((a[1]+b[1])/2),(a[1]-b[1])*MLAT);
function circle(c,m,n=96){ const kx=mlng(c[1]),o=[]; for(let i=0;i<=n;i++){const t=i/n*2*Math.PI; o.push([c[0]+Math.cos(t)*m/kx,c[1]+Math.sin(t)*m/MLAT]);} return o; }
function inRing(x,y,ring){ let s=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){ const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) s=!s; } return s; }
/* Union of equal circles around several points. Every circle contains the points' center
   in practice (entrances sit a few hundred feet apart), so the union is star-shaped from it. */
function starUnion(pts, m, n=180){
  const c=[pts.reduce((a,p)=>a+p[0],0)/pts.length, pts.reduce((a,p)=>a+p[1],0)/pts.length], kx=mlng(c[1]);
  const Q=pts.map(([x,y])=>[(x-c[0])*kx,(y-c[1])*MLAT]), ring=[];
  for (let k=0;k<=n;k++){ const t=k/n*2*Math.PI, ux=Math.cos(t), uy=Math.sin(t); let best=0;
    for (const [px,py] of Q){ const b=ux*px+uy*py, d=m*m-(px*px+py*py)+b*b; if (d>=0){ const te=b+Math.sqrt(d); if(te>best) best=te; } }
    ring.push([c[0]+ux*best/kx, c[1]+uy*best/MLAT]); }
  return ring;
}

/* ═══ selections ═══════════════════════════════════════════════════════
   area {kind,code} · radius {c,m,label} · poly {ring} · lots {bbls} · blocks {keys} · walk {sid,m} */
function walkPts(sid){ const T=st.T; if(!T) return []; const s=T.byId.get(sid); if(!s) return [];
  const e=T.entrances.filter(x=>x.sid===sid).map(x=>[x.lng,x.lat]); return e.length?e:[[s.lng,s.lat]]; }
function selIndices(P, sel){
  if (sel.type==="multi"){ const hit=new Uint8Array(P.n); for (const s of sel.parts) for (const i of selIndices(P,s)) hit[i]=1;
    const o=[]; for (let i=0;i<P.n;i++) if (hit[i]) o.push(i); return Uint32Array.from(o); }
  const out=[];
  if (sel.type==="area"){ const ai=P.areaIdx.get(sel.kind+":"+sel.code); if(ai==null) return new Uint32Array(0);
    const col=sel.kind==="nta"?P.nta:P.tract; for(let i=0;i<P.n;i++) if(col[i]===ai) out.push(i); }
  else if (sel.type==="lots"){ for (const b of sel.bbls){ const i=P.bblIdx.get(b); if(i!=null) out.push(i); } }
  else if (sel.type==="blocks"){ const want=new Set(sel.keys.map(k=>P.blockIdx.get(k)).filter(v=>v!=null));
    for (let i=0;i<P.n;i++) if (want.has(P.blk[i])) out.push(i); }
  else if (sel.type==="radius" || sel.type==="walk"){
    const pts = sel.type==="radius" ? [sel.c] : walkPts(sel.sid); if(!pts.length) return new Uint32Array(0);
    const kx=mlng(pts[0][1]), r2=sel.m*sel.m;
    for (let i=0;i<P.n;i++){ for (const [cx,cy] of pts){ const dx=(P.lng[i]-cx)*kx, dy=(P.lat[i]-cy)*MLAT; if(dx*dx+dy*dy<=r2){ out.push(i); break; } } } }
  else { const ring=sel.ring; let x0=180,y0=90,x1=-180,y1=-90;
    for (const [x,y] of ring){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
    for (let i=0;i<P.n;i++){ const x=P.lng[i],y=P.lat[i]; if(x>=x0&&x<=x1&&y>=y0&&y<=y1&&inRing(x,y,ring)) out.push(i); } }
  return Uint32Array.from(out);
}
function selRings(P, sel){
  if (sel.type==="multi") return sel.parts.flatMap(s=>selRings(P,s));
  if (sel.type==="radius") return [circle(sel.c,sel.m)];
  if (sel.type==="poly") return [sel.ring];
  if (sel.type==="walk"){ const pts=walkPts(sel.sid); return pts.length?[starUnion(pts,sel.m)]:[]; }
  if (sel.type==="lots"){ lotsGeoJSON(P); return sel.bbls.map(b=>P.bblIdx.get(b)).filter(i=>i!=null&&P.geom[i]).flatMap(i=>P.geom[i].map(p=>p[0])); }
  if (sel.type==="blocks") return sel.keys.map(k=>P.blocks[P.blockIdx.get(k)]).filter(Boolean).flatMap(b=>b.polys.map(p=>p[0]));
  const ai=P.areaIdx.get(sel.kind+":"+sel.code); return ai==null?[]:P.areas[ai].polys.map(p=>p[0]);
}
const miles = m => { const mi=m/1609.344; return mi>=0.1 ? (Math.round(mi*100)/100)+" mi" : Math.round(m*3.28084)+" ft"; };
function selTitle(P, sel, count){
  if (sel.type==="multi"){ const tot=sel.parts.reduce((a,s)=>a+selIndices(P,s).length,0);
    return [`${sel.parts.length} selections combined`, `${fmt(count)} lots in total`+(tot>count?`; ${fmt(tot-count)} fall in more than one selection and count once`:"")]; }
  if (sel.type==="area"){ const a=P.areas[P.areaIdx.get(sel.kind+":"+sel.code)];
    return [a?a.name:sel.code,(sel.kind==="nta"?"Neighborhood tabulation area":"2020 census tract")+`, ${fmt(count)} lots`]; }
  if (sel.type==="lots"){ if (sel.bbls.length===1){ const i=P.bblIdx.get(sel.bbls[0]), p=bblParts(sel.bbls[0]);
      return [i!=null&&P.addr[i]?P.addr[i]:`BBL ${sel.bbls[0]}`, `${BORO[p.boro]} block ${p.block}, lot ${p.lot}  ·  BBL ${sel.bbls[0]}`]; }
    return [`${fmt(count)} selected lots`, "Shift-click lots to add or remove them"]; }
  if (sel.type==="blocks") return [sel.keys.length===1?blockName(sel.keys[0]):`${sel.keys.length} tax blocks`, `${fmt(count)} lots`+(sel.keys.length>1?"; shift-click blocks to add or remove":"")];
  if (sel.type==="walk"){ const s=st.T&&st.T.byId.get(sel.sid), ne=walkPts(sel.sid).length;
    return [`${miles(sel.m)} around ${s?s.name:"station"}`, `${fmt(count)} lots within ${miles(sel.m)} of any of its ${ne} entrance${ne===1?"":"s"}, straight-line`]; }
  if (sel.type==="radius") return [sel.label||`Within ${miles(sel.m)} of a point`, `${fmt(count)} lots whose center falls inside the circle`];
  return ["Drawn area", `${fmt(count)} lots whose center falls inside the boundary`];
}

/* ═══ building-size groups ═════════════════════════════════════════════ */
function groupsFrom(div){ const g=[[0]]; for(let i=1;i<9;i++) div[i-1]?g.push([i]):g[g.length-1].push(i); return g; }
function groupLabel(g){ const lo=UB_RANGE[g[0]][0], hi=UB_RANGE[g[g.length-1]][1];
  return hi==null?`${lo}+ units`:lo===hi?`${lo} unit${lo>1?"s":""}`:`${lo}–${hi} units`; }
const groupColors = n => n===1?[UB_RAMP[4]]:Array.from({length:n},(_,i)=>UB_RAMP[Math.round(i*8/(n-1))]);
function parseGroups(text){
  const toks=text.split(/[,;|·]/).map(t=>t.trim()).filter(Boolean);
  if (!toks.length) return {err:"Type groups such as 1, 2, 3-4, 5+"};
  const ENDS=new Set([1,2,3,4,9,19,49,99]); let expect=1; const starts=[];
  for (let t=0;t<toks.length;t++){ const tok=toks[t]; let m,a,b;
    if ((m=tok.match(/^(\d+)\s*\+$/))){a=+m[1];b=null;} else if((m=tok.match(/^(\d+)\s*[-–—]\s*(\d+)$/))){a=+m[1];b=+m[2];}
    else if((m=tok.match(/^(\d+)$/))){a=b=+m[1];} else return {err:`"${tok}" isn't a group. Use a number (2), a range (3-4) or an open group (5+).`};
    if (a!==expect) return {err:`Groups need to run in order without gaps: the next group should start at ${expect}, not "${tok}".`};
    if (!UB_STARTS.includes(a)) return {err:`A group can't start at ${a}. The data's size bands start at ${UB_STARTS.join(", ")}.`};
    starts.push(a); const last=t===toks.length-1;
    if (b==null||b>=100){ if(!last) return {err:`"${tok}" covers every larger size, so it has to be the last group.`}; expect=Infinity; }
    else { if(b<a) return {err:`"${tok}" runs backwards.`};
      if(!ENDS.has(b)) return {err:`A group can't end at ${b}. Groups can end at 1, 2, 3, 4, 9, 19, 49 or 99 because the data comes in bands of 5–9, 10–19, 20–49 and 50–99.`};
      expect=b+1; } }
  if (expect!==Infinity) return {err:`Finish with an open group such as ${expect}+ so every building size is counted.`};
  return {div:UB_STARTS.slice(1).map(s=>starts.includes(s))};
}
const divText = div => groupsFrom(div).map(g=>{ const lo=UB_RANGE[g[0]][0], hi=UB_RANGE[g[g.length-1]][1]; return hi==null?lo+"+":lo===hi?""+lo:lo+"-"+hi; }).join(", ");

/* ═══ subway access (nearest entrance per lot, grid-bucketed) ══════════ */
function access(P){
  if (!st.T) return null;
  if (P.acc && P.accT===st.T) return P.acc;
  const E=st.T.entrances.length?st.T.entrances:st.T.stations.map(s=>({lng:s.lng,lat:s.lat,sid:s.id}));
  const G=0.004, grid=new Map(), key=(x,y)=>Math.floor(x/G)+":"+Math.floor(y/G);
  E.forEach((e,k)=>{ const kk=key(e.lng,e.lat); if(!grid.has(kk)) grid.set(kk,[]); grid.get(kk).push(k); });
  const d=new Float32Array(P.n), who=new Int32Array(P.n), kx=mlng(P.lat[0]||40.7);
  for (let i=0;i<P.n;i++){
    const gx=Math.floor(P.lng[i]/G), gy=Math.floor(P.lat[i]/G); let best=Infinity, bk=-1;
    for (let r=0;r<=8 && (bk<0 || best>((r-1)*G*MLAT*0.75)**2);r++){
      for (let a=-r;a<=r;a++) for (let b=-r;b<=r;b++){ if (Math.max(Math.abs(a),Math.abs(b))!==r) continue;
        const cell=grid.get((gx+a)+":"+(gy+b)); if(!cell) continue;
        for (const k of cell){ const dx=(E[k].lng-P.lng[i])*kx, dy=(E[k].lat-P.lat[i])*MLAT, dd=dx*dx+dy*dy; if(dd<best){best=dd;bk=k;} } }
    }
    d[i]=bk<0?Infinity:Math.sqrt(best); who[i]=bk<0?-1:k2sid(E[bk]);
  }
  function k2sid(e){ return st.T.stIndex.get(e.sid) ?? -1; }
  P.acc={d,who}; P.accT=st.T; return P.acc;
}

/* ═══ statistics ═══════════════════════════════════════════════════════ */
function median(arr){ if(!arr.length) return null; const a=Float64Array.from(arr).sort(), m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2; }
const ACC_BINS = [["Within ¼ mile",0,402.3],["¼ to ½ mile",402.3,804.7],["½ to 1 mile",804.7,1609.3],["Over 1 mile",1609.3,Infinity]];
function computeStats(P, idx, o){
  const groups=groupsFrom(o.div), G=groups.length, b2g=new Int16Array(256).fill(-1);
  groups.forEach((g,gi)=>g.forEach(b=>b2g[b]=gi));
  const acc=access(P);
  const S={lots:0,area:0,units:0,resLots:0,groups, luL:new Float64Array(12),luA:new Float64Array(12),luU:new Float64Array(12),
    ubL:new Float64Array(G),ubA:new Float64Array(G),ubU:new Float64Array(G), fcL:new Float64Array(7), zone:new Map(),
    dec:new Float64Array(DECADES.length), filtered:0, accL:new Float64Array(4),accA:new Float64Array(4),accU:new Float64Array(4), hasAcc:!!acc, ids:[]};
  const areas=[],built=[],years=[]; let sm=0,sd=0,nd=0,over=0,under=0,bfa=0,mfa=0;
  for (const i of idx){
    const lu=P.lu[i]; if (o.luExcl.has(lu)) continue;
    const a=P.area[i], u=P.units[i]; S.ids.push(i);
    S.lots++; S.area+=a; S.units+=u; areas.push(a);
    S.luL[lu]++; S.luA[lu]+=a; S.luU[lu]+=u;
    const g=b2g[P.ub[i]]; if(g>=0){ S.ubL[g]++; S.ubA[g]+=a; S.ubU[g]+=u; if(u>0) S.resLots++; }
    const z=P.zone[i]; let zr=S.zone.get(z); if(!zr) S.zone.set(z,zr=[0,0,0]); zr[0]++; zr[1]+=a; zr[2]+=u;
    if (acc){ const dd=acc.d[i], k=dd<=402.3?0:dd<=804.7?1:dd<=1609.3?2:3; S.accL[k]++; S.accA[k]+=a; S.accU[k]+=u; }
    const fc=P.fc[i], mx=P.mfar[i];
    if (fc<6 && mx>0){ S.filtered++; S.fcL[fc]++; sm+=mx; mfa+=mx*a;
      const b=P.bfar[i]; if(!Number.isNaN(b)){ built.push(b); bfa+=b*a; }
      const d=P.fdiff[i]; if(!Number.isNaN(d)){ sd+=d; nd++; if(d<0)over++; else if(d>0)under++; }
      const y=P.year[i]; if(y>1800&&y<2030){ years.push(y); S.dec[y<1900?0:Math.min(13,Math.floor((y-1900)/10)+1)]++; } }
  }
  S.acres=S.area/43560; S.upa=S.acres?S.units/S.acres:null; S.medLot=median(areas);
  S.meanBuilt=built.length?built.reduce((x,y)=>x+y,0)/built.length:null; S.medBuilt=median(built);
  S.meanMax=S.filtered?sm/S.filtered:null; S.meanDiff=nd?sd/nd:null;
  S.builtFA=bfa; S.maxFA=mfa;                         // floor area (sq ft) built vs allowed on analyzed lots
  S.pctUnder=S.filtered?under/S.filtered*100:null; S.pctOver=S.filtered?over/S.filtered*100:null;
  S.years=years.length; S.medYear=median(years); S.meanYear=years.length?years.reduce((x,y)=>x+y,0)/years.length:null;
  S.pre61=years.length?years.filter(y=>y<1961).length/years.length*100:null;
  return S;
}

/* ═══ zoning colours ═══════════════════════════════════════════════════ */
function mix(a,b,t){ const p=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)); const A=p(a),B=p(b);
  return "#"+A.map((v,k)=>Math.round(v+(B[k]-v)*t).toString(16).padStart(2,"0")).join(""); }
function zoneColor(z){ const m=/^([A-Z]+)(\d+)?/.exec(z||""); if(!m) return NODATA; const t=Math.min(1,((+m[2]||1)-1)/9);
  if (m[1]==="R") return mix("#F5E3A0","#B97A12",t); if (m[1]==="C") return mix("#F0A898","#A8272B",t);
  if (m[1]==="M") return mix("#CDB8E2","#5E3F8F",t); if ((z||"").startsWith("PARK")) return "#7FB36E"; return "#B7BEC6"; }

/* ═══ profile: area statistics ═════════════════════════════════════════ */
const seg=(k,c,v,tot,metric,val)=>({k,c,pct:pct(v,tot),val,metric});
const barHTML=segs=>`<div class="core">${segs.filter(s=>s.pct>0).map(s=>`<i style="width:${s.pct.toFixed(3)}%;background:${s.c}" data-k="${esc(s.k)}" data-p="${s.pct.toFixed(1)}" data-v="${esc(s.val)}" data-m="${esc(s.metric)}"></i>`).join("")}</div>`;
function pieCSS(segs){ let acc=0; const stops=[]; for (const s of segs){ if(!s.pct) continue; stops.push(`${s.c} ${(acc*3.6).toFixed(2)}deg ${((acc+s.pct)*3.6).toFixed(2)}deg`); acc+=s.pct; }
  return `conic-gradient(${stops.join(",")||"#eee 0deg 360deg"})`; }
const piesHTML=charts=>`<div class="pies">${charts.map(ch=>`<div class="pieBox"><div class="pie" style="background:${pieCSS(ch.segs)}" data-seg="${esc(JSON.stringify(ch.segs.filter(s=>s.pct>0).map(s=>[s.k,+s.pct.toFixed(2),s.val,s.metric])))}"></div><small>${ch.cap}</small></div>`).join("")}</div>`;
function tableHTML(headers, rows){
  const cols=`grid-template-columns:11px minmax(0,1fr) repeat(${headers.length-1},58px)`;
  return `<div class="rows"><div class="r hd" style="${cols}"><span></span><span class="nm">${headers[0]}</span>${headers.slice(1).map(h=>`<span class="val">${h}</span>`).join("")}</div>`+
    rows.map(r=>`<div class="r" style="${cols}" data-k="${esc(r[1])}" data-p="${r[2]==null?"":r[2].toFixed(1)}" data-v="" data-m="${esc(headers[1]).toLowerCase().replace("%","of")}"><span class="sw" style="background:${r[0]}"></span><span class="nm">${esc(r[1])}</span>${r.slice(2).map(v=>`<span class="val">${v==null?"":fmt(v,1)+"%"}</span>`).join("")}</div>`).join("")+`</div>`;
}
const kvHTML=pairs=>`<div class="kv">${pairs.map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join("")}</div>`;
function sectionSpecs(S, B){
  const P=st.P, acres=v=>fmt(v/43560,1)+" acres", specs={};
  const luRows=[]; let oL=0,oA=0,oU=0; const order=[...Array(12).keys()].sort((a,b)=>S.luA[b]-S.luA[a]);
  for (const k of order){ if(!S.luL[k]) continue; const pl=pct(S.luL[k],S.lots),pa=pct(S.luA[k],S.area),pu=pct(S.luU[k],S.units);
    if (pl<0.1&&pa<0.1){oL+=S.luL[k];oA+=S.luA[k];oU+=S.luU[k];continue;} luRows.push([LU_COLORS[k],P.dict.lu[k],pl,pa,pu]); }
  if (oL) luRows.push([NODATA,"All other (under 0.1%)",pct(oL,S.lots),pct(oA,S.area),pct(oU,S.units)]);
  const luSeg=(arr,tot,metric,vf)=>order.filter(k=>arr[k]).map(k=>seg(P.dict.lu[k],LU_COLORS[k],arr[k],tot,metric,vf(arr[k])));
  specs.lu={title:"Land use",barCap:"Share of land area",
    charts:[{cap:"Lots",segs:luSeg(S.luL,S.lots,"of lots",v=>fmt(v)+" lots")},{cap:"Land area",segs:luSeg(S.luA,S.area,"of land area",acres)},
            {cap:"Housing units",segs:luSeg(S.luU,S.units,"of housing units",v=>fmt(v)+" units")}],
    bar:1, headers:["Land use","% lots","% area","% units"], rows:luRows};
  const gl=S.groups.map(groupLabel), gc=groupColors(S.groups.length);
  const tL=S.ubL.reduce((a,b)=>a+b,0),tA=S.ubA.reduce((a,b)=>a+b,0),tU=S.ubU.reduce((a,b)=>a+b,0);
  const ubSeg=(arr,tot,metric,vf)=>gl.map((k,i)=>seg(k,gc[i],arr[i],tot,metric,vf(arr[i])));
  specs.ub={title:"Housing by building size",barCap:"Share of housing units",
    charts:[{cap:"Residential lots",segs:ubSeg(S.ubL,tL,"of residential lots",v=>fmt(v)+" lots")},{cap:"Land area",segs:ubSeg(S.ubA,tA,"of residential land",acres)},
            {cap:"Housing units",segs:ubSeg(S.ubU,tU,"of housing units",v=>fmt(v)+" units")}],
    bar:2, headers:["Building size","% lots","% area","% units"], rows:gl.map((k,i)=>[gc[i],k,pct(S.ubL[i],tL),pct(S.ubA[i],tA),pct(S.ubU[i],tU)]).filter(r=>r[2]||r[4])};
  specs.fc={title:"Zoning capacity (FAR)",soft:`${fmt(S.filtered)} lots analyzed`,barCap:"Share of analyzed lots",
    charts:[{cap:"Analyzed lots",segs:P.dict.fc.map((k,i)=>seg(k,FC_COLORS[i],S.fcL[i],S.filtered,"of analyzed lots",fmt(S.fcL[i])+" lots"))}],
    bar:0, headers:["Capacity","% lots"], rows:P.dict.fc.map((k,i)=>[FC_COLORS[i],k,pct(S.fcL[i],S.filtered)]).filter(r=>r[2]),
    kv:[["Mean built FAR",fmt(S.meanBuilt,2)],["Median built FAR",fmt(S.medBuilt,2)],["Mean maximum usable FAR (modeled)",fmt(S.meanMax,2)],
        ["Mean unused FAR",fmt(S.meanDiff,2)],["Floor area built",fmt(S.builtFA)+" sq ft"],["Floor area allowed (modeled)",fmt(S.maxFA)+" sq ft"],
        ["Share of allowed floor area built",S.maxFA?fmt(S.builtFA/S.maxFA*100,1)+"%":"—"],["Underbuilt lots",fmt(S.pctUnder,1)+"%"],["Overbuilt lots",fmt(S.pctOver,1)+"%"]]};
  if (S.hasAcc){ const aL=S.accL.reduce((a,b)=>a+b,0)||1;
    specs.access={title:"Subway access",soft:"straight-line distance to the nearest entrance",barCap:"Share of housing units",
      charts:[{cap:"Lots",segs:ACC_BINS.map((b,k)=>seg(b[0],["#1B62A5","#6FA3D2","#BDD5EA","#E4E8EC"][k],S.accL[k],aL,"of lots",fmt(S.accL[k])+" lots"))},
              {cap:"Housing units",segs:ACC_BINS.map((b,k)=>seg(b[0],["#1B62A5","#6FA3D2","#BDD5EA","#E4E8EC"][k],S.accU[k],S.units,"of housing units",fmt(S.accU[k])+" units"))}],
      bar:1, headers:["Distance","% lots","% area","% units"],
      rows:ACC_BINS.map((b,k)=>[["#1B62A5","#6FA3D2","#BDD5EA","#E4E8EC"][k],b[0],pct(S.accL[k],S.lots),pct(S.accA[k],S.area),pct(S.accU[k],S.units)])}; }
  specs.age={title:"Building age",soft:`${fmt(S.years)} lots with a year`,hist:DECADES.map((d,i)=>[d,pct(S.dec[i],S.years),S.dec[i]]),
    kv:[["Median year built",S.medYear?Math.round(S.medYear):"—"],["Mean year built",S.meanYear?Math.round(S.meanYear):"—"],["Built before the 1961 Zoning Resolution",fmt(S.pre61,1)+"%"]]};
  const zs=[...S.zone.entries()].map(([z,v])=>[P.dict.zone[z]||"None",v]).sort((a,b)=>b[1][1]-a[1][1]);
  const top=zs.slice(0,8), rest=zs.slice(8).reduce((a,[,v])=>[a[0]+v[0],a[1]+v[1],a[2]+v[2]],[0,0,0]);
  const zrows=top.map(([z,v])=>[zoneColor(z),z,pct(v[0],S.lots),pct(v[1],S.area),pct(v[2],S.units)]);
  if (rest[0]) zrows.push([NODATA,`${zs.length-8} other districts`,pct(rest[0],S.lots),pct(rest[1],S.area),pct(rest[2],S.units)]);
  specs.zone={title:"Zoning districts",soft:`${zs.length} district${zs.length===1?"":"s"}`,barCap:"Share of land area",
    charts:[{cap:"Land area",segs:top.map(([z,v])=>seg(z,zoneColor(z),v[1],S.area,"of land area",acres(v[1]))).concat(rest[1]?[seg("Other districts",NODATA,rest[1],S.area,"of land area",acres(rest[1]))]:[])}],
    bar:0, headers:["District","% lots","% area","% units"], rows:zrows};
  if (S.ids.length>1 && S.ids.length<=500 && st.sel.type!=="area")
    specs.list={title:"Lots",soft:`${fmt(S.ids.length)} lots, click one for its record`,
      lots:S.ids.slice().sort((a,b)=>(P.addr[a]||"~").localeCompare(P.addr[b]||"~",undefined,{numeric:true}))};
  if (B){ const d=(a,b,dg=0,sfx="")=>{const x=a-b; return (x>0?"+":"")+fmt(x,dg)+sfx;};
    const lu12=pct(S.luU[0],S.units)-pct(B.luU[0],B.units);
    specs.cmp={title:`Change since ${st.C.id}`,soft:"same boundary",
      cmpRows:[["Tax lots",fmt(B.lots),fmt(S.lots),d(S.lots,B.lots)],["Housing units",fmt(B.units),fmt(S.units),d(S.units,B.units)],
        ["Residential lots",fmt(B.resLots),fmt(S.resLots),d(S.resLots,B.resLots)],["Units per acre",fmt(B.upa,1),fmt(S.upa,1),d(S.upa,B.upa,1)],
        ["Mean built FAR",fmt(B.meanBuilt,2),fmt(S.meanBuilt,2),d(S.meanBuilt,B.meanBuilt,2)],
        ["Underbuilt lots",fmt(B.pctUnder,1)+"%",fmt(S.pctUnder,1)+"%",d(S.pctUnder,B.pctUnder,1," pts")],
        ["Units in 1-2 family homes",fmt(pct(B.luU[0],B.units),1)+"%",fmt(pct(S.luU[0],S.units),1)+"%",(lu12>0?"+":"")+fmt(lu12,1)+" pts"]]}; }
  return specs;
}
function sectionHTML(key, sp){
  const pies=st.opts.style==="pies";
  let h=`<section class="blk" data-key="${key}"><h2><span class="grip" title="Drag to reorder">⋮⋮</span>${sp.title}${sp.soft?` <span class="soft">${sp.soft}</span>`:""}${sp.lots?"":`<button class="xbtn" data-export="${key}" title="Download this section as an image">PNG</button>`}</h2>`;
  if (sp.charts) h+=pies?piesHTML(sp.charts):barHTML(sp.charts[sp.bar].segs);
  if (sp.hist){ const mx=Math.max(1,...sp.hist.map(b=>b[1]));
    h+=`<div class="hist">${sp.hist.map(([d,p,c])=>`<i style="height:${(p/mx*100).toFixed(1)}%" data-k="Built ${d}" data-p="${p.toFixed(1)}" data-v="${fmt(c)} lots" data-m="of lots with a year"></i>`).join("")}</div><div class="histx">${DECADES.map((d,k)=>`<span>${k%3===0?esc(d):""}</span>`).join("")}</div>`; }
  if (sp.rows) h+=tableHTML(sp.headers,sp.rows);
  if (sp.lots){ const P=st.P, cols="grid-template-columns:minmax(0,1fr) 44px 92px";
    h+=`<div class="rows lotlist"><div class="r hd" style="${cols}"><span class="nm">Address</span><span class="val">Units</span><span class="val">FAR built/max</span></div>${sp.lots.map(i=>`<div class="r" style="${cols}" data-lot="${Math.round(P.bbl[i])}"><span class="nm">${esc(P.addr[i]||"BBL "+Math.round(P.bbl[i]))}</span><span class="val">${fmt(P.units[i])}</span><span class="val">${fmt(P.bfar[i],2)} / ${fmt(P.mfar[i],2)}</span></div>`).join("")}</div>`; }
  if (sp.cmpRows){ const g="grid-template-columns:minmax(0,1fr) 70px 70px 76px";
    h+=`<div class="rows"><div class="r hd" style="${g}"><span class="nm">Measure</span><span class="val">${st.C.id}</span><span class="val">${st.P.id}</span><span class="val">Change</span></div>${sp.cmpRows.map(r=>`<div class="r" style="${g}"><span class="nm">${r[0]}</span><span class="val">${r[1]}</span><span class="val">${r[2]}</span><span class="val ${/^\+(?!0(\.0+)?( |$))/.test(r[3])?"up":r[3].startsWith("-")?"dn":"eq"}">${r[3]}</span></div>`).join("")}</div>`; }
  if (sp.mrows) h+=`<div class="mt"><table><thead><tr><th>Measure</th>${sp.mcols.map(c=>`<th data-pick="${c.pick}" title="Open ${esc(c.name)}"><i style="background:${c.color}"></i>${esc(c.name.length>14?c.name.slice(0,13)+"…":c.name)}${typeof c.pick==="number"?`<b class="rmx" data-x="${c.pick}" title="Remove this selection">×</b>`:""}</th>`).join("")}</tr></thead><tbody>${sp.mrows.map(r=>`<tr><td>${r[0]}</td>${r.slice(1).map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  if (sp.bars) h+=sp.bars.map(b=>`<div class="sbar"><div class="sbh"><button class="link" data-pick="${b.pick}"><i style="background:${b.color}"></i>${esc(b.name)}</button>${typeof b.pick==="number"?`<b class="rmx" data-x="${b.pick}" title="Remove this selection">×</b>`:""}</div>${barHTML(b.segs)}</div>`).join("");
  if (sp.kv) h+=kvHTML(sp.kv);
  return h+`</section>`;
}

/* ═══ profile: single-lot record (ZoLa-style) ══════════════════════════ */
const OWNER_TYPE={C:"City",M:"Mixed city and private",O:"Other public (state or federal)",P:"Private",X:"Tax-exempt"};
const nonEmpty=(...v)=>v.filter(x=>x!=null&&x!==""&&x!==0&&x!=="0").join(", ")||"None";
function lotSpecs(i){
  const P=st.P, R=rec(P), g=f=>R[f]?R[f][i]:null, {boro,block,lot}=bblParts(P.bbl[i]);
  const sqft=v=>v?fmt(v)+" sq ft":"—", money=v=>v?"$"+fmt(v):"—", cd=g("CD");
  const specs={}, fd=P.fdiff[i], la=P.area[i];
  specs.lotinfo={title:"Lot", kv:[["Owner",esc(g("OwnerName")||"—")],["Owner type",OWNER_TYPE[g("OwnerType")]||"Private or unknown"],
    ["Land use",P.dict.lu[P.lu[i]]],["Building class",esc(g("BldgClass")||"—")],["Lot area",sqft(la)],
    ["Lot frontage × depth",`${fmt1(g("LotFront"))} × ${fmt1(g("LotDepth"))} ft`],["Buildings on lot",fmt(g("NumBldgs"))],
    ["Condo number",g("CondoNo")?fmt(g("CondoNo")):"None"]]};
  specs.bldg={title:"Building", kv:[["Year built",P.year[i]||"—"],["Year altered",nonEmpty(g("YearAlter1"),g("YearAlter2"))],
    ["Floors",fmt1(g("NumFloors"))],["Building frontage × depth",`${fmt1(g("BldgFront"))} × ${fmt1(g("BldgDepth"))} ft`],
    ["Residential units",fmt(P.units[i])],["Total units",fmt(g("UnitsTotal"))],["Gross floor area",sqft(g("BldgArea"))],
    ["Residential floor area",sqft(g("ResArea"))],["Commercial floor area",sqft(g("ComArea"))],["Office / retail",`${sqft(g("OfficeArea"))} / ${sqft(g("RetailArea"))}`],
    ["Garage / storage / factory",`${sqft(g("GarageArea"))} / ${sqft(g("StrgeArea"))} / ${sqft(g("FactryArea"))}`]]};
  specs.zoning={title:"Zoning", kv:[["Zoning district",esc(nonEmpty(g("ZoneDist1"),g("ZoneDist2"),g("ZoneDist3"),g("ZoneDist4")))],
    ["Commercial overlay",esc(nonEmpty(g("Overlay1"),g("Overlay2")))],["Special district",esc(nonEmpty(g("SPDist1"),g("SPDist2"),g("SPDist3")))],
    ["Limited height district",esc(g("LtdHeight")||"None")],["Split by a district line",g("SplitZone")==="Y"?"Yes":"No"],
    ["Zoning map",esc(g("ZoneMap")||"—")],["Street",esc(g("WideSt")||"—")],["E-designation",esc(g("EDesigNum")||"None")]]};
  specs.far={title:"Floor area ratio", kv:[["Built FAR",fmt(P.bfar[i],2)],["Maximum usable FAR (modeled)",fmt(P.mfar[i],2)],
    ["Unused FAR",fmt(fd,2)],["Capacity category",P.fc[i]<7?P.dict.fc[P.fc[i]]:"—"],
    ["Unbuilt floor area (unused FAR × lot area)",!Number.isNaN(fd)&&fd>0?fmt(fd*la)+" sq ft":"None"],
    ["PLUTO residential / adjusted FAR",`${fmt(g("ResidFAR"),2)} / ${fmt(g("AdjResFar"),2)}`],
    ["PLUTO commercial FAR",fmt(g("CommFAR"),2)],["PLUTO community facility FAR",fmt(g("FacilFAR"),2)]]};
  const acc=access(P);
  if (acc && acc.who[i]>=0){ const s=st.T.stations[acc.who[i]];
    specs.sub={title:"Subway", kv:[["Nearest station",`${esc(s.name)} ${s.routes.map(bullet).join("")}`],["Distance to its nearest entrance",miles(acc.d[i])+" straight-line"],
      ["Within ½ mile of an entrance",acc.d[i]<=804.7?"Yes":"No"]]}; }
  specs.districts={title:"Districts", kv:[["Community district",cd?`${BORO[Math.floor(cd/100)]||""} CD ${cd%100}`:"—"],["City Council district",fmt(g("Council"))],
    ["School district",fmt(g("SchoolDist"))],["Police precinct",fmt(g("PolicePrct"))],["Fire company",esc(g("FireComp")||"—")],["ZIP code",g("ZipCode")||"—"],
    ["Census tract (2020)",P.areas[P.tract[i]]?esc(P.areas[P.tract[i]].name):"—"],["Neighborhood",P.areas[P.nta[i]]?esc(P.areas[P.nta[i]].name):"—"]]};
  specs.misc={title:"Landmarks, flood and assessment", kv:[["Landmark",esc(g("Landmark")||"None")],["Historic district",esc(g("HistDist")||"None")],
    ["2015 preliminary flood map",g("PFIRM15_FL")?"In the 1% annual chance floodplain":"Not in the floodplain"],
    ["Assessed value, land / total",`${money(g("AssessLand"))} / ${money(g("AssessTot"))}`],["Exempt value",money(g("ExemptTot"))],
    ["Sanborn map / tax map",`${esc(g("Sanborn")||"—")} / ${esc(g("TaxMap")||"—")}`]]};
  const b5=String(block).padStart(5,"0"), l4=String(lot).padStart(4,"0");
  const links=`<div class="lotlinks"><a href="https://zola.planning.nyc.gov/l/lot/${boro}/${block}/${lot}" target="_blank" rel="noopener">Open in ZoLa</a>
    <a href="https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${boro}&block=${b5}&lot=${l4}" target="_blank" rel="noopener">DOB BIS</a>
    <a href="https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${boro}&block=${block}&lot=${lot}" target="_blank" rel="noopener">ACRIS</a>
    <button data-goblock="${boro*1e5+block}">Select block ${block}</button></div>`;
  return {specs, links};
}

/* ═══ profile render ═══════════════════════════════════════════════════ */
function optSummary(){ const g=groupsFrom(st.opts.div).length, x=st.opts.luExcl.size;
  $("#optSum").textContent=`${st.opts.style==="pies"?"Pies":"Bars"}, ${g===9?"every building size":g+" size groups"}${x?`, ${x} land use${x>1?"s":""} left out`:""}`; }
const shortName=s=>s.length>24?s.slice(0,23)+"…":s;
function renderSelbar(){
  const bar=$("#selbar"), n=st.sels.length; bar.hidden=n<2; if (n<2){ bar.innerHTML=""; return; }
  const on=v=>st.view===v?" on":"";
  bar.innerHTML=`<button data-v="prev" class="nav" title="Previous ([)">‹</button><div class="chips">
    <button data-v="all" class="chip${on("all")}">Combined</button><button data-v="cmp" class="chip${on("cmp")}">Side by side</button>
    ${st.sels.map((e,k)=>{ const t=selTitle(st.P,e.sel,0)[0]; return `<button data-v="${k}" class="chip${on(k)}" title="${esc(t)}"><i style="background:${e.color}"></i>${esc(shortName(t))}<b data-x="${k}" title="Remove this selection">×</b></button>`; }).join("")}
    </div><button data-v="next" class="nav" title="Next (])">›</button>`;
  const cur=bar.querySelector(".chip.on"); if (cur && cur.scrollIntoView) cur.scrollIntoView({block:"nearest",inline:"nearest"});
}
function compareSpecs(){
  const P=st.P, all={type:"multi",parts:st.sels.map(e=>e.sel)};
  const cols=[{name:"Combined",color:"#8795A3",pick:"all",S:computeStats(P,selIndices(P,all),st.opts)}]
    .concat(st.sels.map((e,k)=>({name:selTitle(P,e.sel,0)[0],color:e.color,pick:k,S:computeStats(P,selIndices(P,e.sel),st.opts)})));
  const M=[["Tax lots",S=>fmt(S.lots)],["Acres of lots",S=>fmt(S.acres,1)],["Housing units",S=>fmt(S.units)],["Units per acre",S=>fmt(S.upa,1)],
    ["Lots with housing",S=>fmt(S.resLots)],["Median lot, sq ft",S=>fmt(S.medLot)],["Land in 1-2 family homes",S=>fmt(pct(S.luA[0],S.area),1)+"%"],
    ["Units in 1-2 family homes",S=>fmt(pct(S.luU[0],S.units),1)+"%"],["Mean built FAR",S=>fmt(S.meanBuilt,2)],["Mean maximum usable FAR",S=>fmt(S.meanMax,2)],
    ["Allowed floor area built",S=>S.maxFA?fmt(S.builtFA/S.maxFA*100,1)+"%":"—"],["Underbuilt lots",S=>fmt(S.pctUnder,1)+"%"],
    ["Median year built",S=>S.medYear?Math.round(S.medYear):"—"],["Built before 1961",S=>fmt(S.pre61,1)+"%"]];
  if (cols[0].S.hasAcc) M.push(["Units within ½ mi of an entrance",S=>fmt(pct(S.accU[0]+S.accU[1],S.units),1)+"%"]);
  const acres=v=>fmt(v/43560,1)+" acres";
  const specs={
    multi:{title:"Side by side",soft:"click a column to open it; widen the panel to see more",mcols:cols.map(c=>({name:c.name,color:c.color,pick:c.pick})),mrows:M.map(([k,f])=>[k,...cols.map(c=>f(c.S))])},
    lub:{title:"Land use by selection",soft:"share of land area",bars:cols.map(c=>({name:c.name,color:c.color,pick:c.pick,
      segs:[...Array(12).keys()].map(k=>seg(P.dict.lu[k],LU_COLORS[k],c.S.luA[k],c.S.area,"of land area",acres(c.S.luA[k])))}))},
    ubb:{title:"Housing by building size",soft:"share of housing units",bars:cols.map(c=>{ const g=c.S.groups, gc=groupColors(g.length), t=c.S.ubU.reduce((a,b)=>a+b,0);
      return {name:c.name,color:c.color,pick:c.pick,segs:g.map((x,i)=>seg(groupLabel(x),gc[i],c.S.ubU[i],t,"of housing units",fmt(c.S.ubU[i])+" units"))}; })},
    fcb:{title:"Zoning capacity (FAR)",soft:"share of analyzed lots",bars:cols.map(c=>({name:c.name,color:c.color,pick:c.pick,
      segs:P.dict.fc.map((k,i)=>seg(k,FC_COLORS[i],c.S.fcL[i],c.S.filtered,"of analyzed lots",fmt(c.S.fcL[i])+" lots"))}))},
  };
  if (cols[0].S.hasAcc) specs.accb={title:"Subway access",soft:"share of housing units",bars:cols.map(c=>({name:c.name,color:c.color,pick:c.pick,
    segs:ACC_BINS.map((b,k)=>seg(b[0],["#1B62A5","#6FA3D2","#BDD5EA","#E4E8EC"][k],c.S.accU[k],c.S.units,"of housing units",fmt(c.S.accU[k])+" units"))}))};
  return {specs, S:cols[0].S};
}
function renderProfile(){
  const prof=$("#profile"), sel=st.sel, P=st.P; optSummary();
  $("#actions").hidden=!sel; $("#btnX").hidden=!st.sels.length;
  $("#back").hidden=!(sel&&st.prevSel);
  if (st.prevSel){ const ps=st.prevSel, s=ps.sels.length===1?ps.sels[0].sel:typeof ps.view==="number"?ps.sels[ps.view].sel:{type:"multi",parts:ps.sels.map(e=>e.sel)};
    $("#btnBack").textContent="← Back to "+selTitle(P,s,0)[0]; }
  renderSelbar();
  if (!sel){ $("#opts").hidden=true; $("#areaName").textContent="Pick an area to profile";
    $("#areaSub").textContent=`${fmt(P.n)} tax lots loaded from ${P.id}`;
    prof.innerHTML=`<div class="empty"><b>Click a neighborhood</b> on the map, or switch tools: <b>Lot</b> and <b>Block</b> work like ZoLa, <b>NTAs</b> and <b>Tracts</b> pick census geographies, <b>Draw</b> traces your own boundary, and <b>Radius</b> measures from any point, subway entrance or station. <b>＋ Add</b> keeps earlier selections so you can compare them, and Ctrl+Z undoes. Search takes an address, a BBL, a borough-block-lot such as 3 5634 12, or a station name.</div>`; return; }
  const idx=selIndices(P,sel);
  const [name,sub]=selTitle(P,sel,idx.length);
  $("#areaName").textContent=name; $("#areaSub").textContent=sub+(st.opts.luExcl.size&&!(sel.type==="lots"&&idx.length===1)?`; ${st.opts.luExcl.size} land use${st.opts.luExcl.size>1?"s":""} left out`:"");
  if (sel.type==="lots" && idx.length===1){           // ZoLa-style record for one lot
    $("#opts").hidden=true; const i=idx[0], {specs,links}=lotSpecs(i); st.specs=specs; st.S=null; const R=rec(P);
    prof.innerHTML=`<div class="tiles"><div><div class="v">${fmt(P.area[i])}</div><div class="k">Lot area, sq ft</div></div>
      <div><div class="v">${fmt(R.BldgArea?R.BldgArea[i]:null)}</div><div class="k">Floor area, sq ft</div></div>
      <div><div class="v">${fmt(P.units[i])}</div><div class="k">Housing units</div></div>
      <div><div class="v">${fmt(P.bfar[i],2)}<span class="d eq"> of ${fmt(P.mfar[i],2)}</span></div><div class="k">Built FAR of maximum</div></div></div>
      ${links}${Object.entries(specs).map(([k,sp])=>sectionHTML(k,sp).replace(/<span class="grip"[^>]*>⋮⋮<\/span>/,"")).join("")}
      <p class="note">From MapPLUTO ${P.id}. Maximum usable FAR is the modeled value from ZR 23-142 Table 1; confirm lot-specific rules in ZoLa and the Zoning Resolution.</p>`;
    return; }
  $("#opts").hidden=false;
  if (st.sels.length>1 && st.view==="cmp"){
    const {specs,S}=compareSpecs(); st.specs=specs; st.S=S;
    $("#areaName").textContent=`Comparing ${st.sels.length} selections`;
    $("#areaSub").textContent="One column per selection. Combined counts lots that fall in more than one selection once.";
    prof.innerHTML=Object.entries(specs).map(([k,sp])=>sectionHTML(k,sp).replace(/<span class="grip"[^>]*>⋮⋮<\/span>/,"")).join("")+
      `<p class="note">Straight-line walksheds and radii; lots count when their center falls inside. Source: NYC DCP MapPLUTO ${P.id}${st.T?"; MTA Open Data; © OpenStreetMap contributors":""}.</p>`;
    return; }
  const S=computeStats(P,idx,st.opts); let B=null;
  if (st.C) B=computeStats(st.C,selIndices(st.C,sel),st.opts);
  st.specs=sectionSpecs(S,B); st.S=S;
  const dl=(a,b,dg=0)=>{ if(!B) return ""; const x=a-b; if(Math.abs(x)<Math.pow(10,-dg)/2) return ""; return `<span class="d ${x>0?"up":"dn"}">${x>0?"+":""}${fmt(x,dg)}</span>`; };
  const order=(B?["cmp"]:[]).concat(st.opts.order).filter(k=>st.specs[k]);
  prof.innerHTML=`<div class="tiles">
      <div><div class="v">${fmt(S.lots)}${dl(S.lots,B&&B.lots)}</div><div class="k">Tax lots</div></div>
      <div><div class="v">${fmt(S.acres,1)}${dl(S.acres,B&&B.acres,1)}</div><div class="k">Acres of lots</div></div>
      <div><div class="v">${fmt(S.units)}${dl(S.units,B&&B.units)}</div><div class="k">Housing units</div></div>
      <div><div class="v">${fmt(S.upa,1)}${dl(S.upa||0,B&&(B.upa||0),1)}</div><div class="k">Units per acre</div></div></div>
    <p class="subline">${fmt(S.resLots)} lots with housing. The median lot is ${fmt(S.medLot)} sq ft.</p>
    ${order.map(k=>sectionHTML(k,st.specs[k])).join("")}
    <p class="note">Lots count when their center falls inside the selection. Walksheds and subway distances are straight-line from station entrances, not walking routes. FAR figures cover analyzed lots only: parks, transit and lots with no modeled maximum are left out. Source: NYC DCP MapPLUTO ${P.id}${st.C?` and ${st.C.id}`:""}${st.T?"; MTA Open Data; © OpenStreetMap contributors":""}.</p>`;
}

/* ═══ map styling ══════════════════════════════════════════════════════ */
function rampStops(v){ const [lo,hi]=st.map.range[v];
  if (v==="fd"){ const a=Math.min(lo,-0.01), b=Math.max(hi,0.01);
    return [a,"#B83A2E",a*0.2,"#EBB3A5",0,"#F1EEE6",b/6,"#A7CBA0",b/2,"#3A8356",b,"#0D4A2E"]; }
  const R=RAMPS[st.map.ramp], out=[]; R.forEach((c,k)=>out.push(lo+(hi-lo)*k/(R.length-1),c)); return out; }
function fillColor(){
  const v=st.colorBy, m=["match",["get",v]];
  if (v==="lu"){ LU_COLORS.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="ub"){ UB_RAMP.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="fc"){ FC_COLORS.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="zn"){ st.P.dict.zone.forEach((z,i)=>m.push(i,zoneColor(z))); m.push(NODATA); return m; }
  if (v==="yb") return ["case",["==",["get","yb"],0],NODATA,["step",["get","yb"],YB_CLASSES[0][3],1900,YB_CLASSES[1][3],1930,YB_CLASSES[2][3],1961,YB_CLASSES[3][3],1990,YB_CLASSES[4][3]]];
  const s=rampStops(v), hi=st.map.range[v][1];
  return ["case",["==",["get",v],-999],NODATA,["interpolate",["linear"],["min",["get",v],hi],...s]];
}
function lotOpacity(){
  const op=st.map.opacity, v=st.colorBy, hid=CAT_VIEWS.has(v)?[...st.map.hidden[v]]:[], ex=[...st.opts.luExcl], c=["case"];
  if (hid.length) c.push(["in",["get",v],["literal",hid]],0);
  if (ex.length) c.push(["in",["get","lu"],["literal",ex]],op*0.16);
  const idx=st.curIdx, n=st.P.n;
  if (st.map.dim && idx && idx.length && idx.length<n){          // fade lots outside the current selection
    const inside=idx.length<=n/2, set=inside?Array.from(idx):(()=>{ const h=new Uint8Array(n); idx.forEach(i=>h[i]=1); const o=[]; for(let i=0;i<n;i++) if(!h[i]) o.push(i); return o; })();
    c.push(["match",["id"],set,!inside,inside],op*0.22); }
  return c.length===1?op:[...c,op];
}
function renderLegend(){
  const v=st.colorBy, H=CAT_VIEWS.has(v)?st.map.hidden[v]:null;
  const sw=(code,c,t)=>`<div${code!=null?` data-c="${code}" class="${H&&H.has(code)?"hid":""}" title="Click to hide or show"`:""}><i style="background:${c}"></i>${esc(t)}</div>`;
  let h="";
  if (v==="lu") h=st.P.dict.lu.map((t,i)=>sw(i,LU_COLORS[i],t)).join("");
  if (v==="ub") h=st.P.dict.ub.map((t,i)=>sw(i,UB_RAMP[i],t.replace("-","–"))).join("")+sw(255,NODATA,"No housing");
  if (v==="fc") h=st.P.dict.fc.map((t,i)=>sw(i,FC_COLORS[i],t)).join("");
  if (v==="zn"){ const used=new Set(st.P.zone); h=st.P.dict.zone.map((z,i)=>used.has(i)?sw(i,zoneColor(z),z||"None"):"").join(""); }
  if (v==="yb") h=YB_CLASSES.map(c=>sw(null,c[3],c[0])).join("")+sw(null,NODATA,"Unknown");
  if (RAMPS && st.map.range[v]){ const s=rampStops(v), cols=[]; for(let k=1;k<s.length;k+=2) cols.push(s[k]);
    const [lo,hi]=st.map.range[v];
    h=`<div class="ramp" style="background:linear-gradient(90deg,${cols.join(",")})"></div><div class="rl"><span>${fmt(lo,1)}${v==="fd"?" (over)":""}</span><span>${fmt((lo+hi)/2,1)}</span><span>${fmt(hi,1)}+</span></div>`+sw(null,NODATA,"No value");
    $("#rMin").value=lo; $("#rMax").value=hi; $("#rampRow").hidden=v==="fd"; }
  if (H) h+=`<div class="shint">Click a category to hide it.</div>`;
  $("#swatches").innerHTML=h; $("#rangeBox").hidden=!st.map.range[v];
}
function restyleLots(){ if(!map||!map.getLayer("lots")) return; map.setPaintProperty("lots","fill-color",fillColor()); map.setPaintProperty("lots","fill-opacity",lotOpacity()); renderLegend(); }
const vis=(id,on)=>{ if(map&&map.getLayer(id)) map.setLayoutProperty(id,"visibility",on?"visible":"none"); };
function applyMapOpts(){
  const o=st.map, B=st.base||{fills:[],syms:[]};
  B.fills.forEach(id=>vis(id,o.basemap==="map")); B.syms.forEach(id=>vis(id,o.labels&&o.basemap!=="none"));
  vis("sat",o.basemap==="sat"); vis("lot-line",o.lotLines);
  vis("nta-fill",o.ntas); vis("nta-line",o.ntas); vis("tract-fill",o.tracts||st.mode==="tract"); vis("tract-line",o.tracts||st.mode==="tract");
  markers.forEach(m=>m.getElement().style.display=o.ntas?"":"none");
  vis("sub-line",o.sub.lines); vis("sub-case",o.sub.lines); vis("sub-plat",o.sub.platforms); vis("sub-plat-line",o.sub.platforms);
  vis("sub-ent",o.sub.entrances); vis("sub-st",o.sub.stations); updateStationLabels();
  $("#satBtn").classList.toggle("on",o.basemap==="sat"); $("#basemap").value=o.basemap;
}
const EMPTY={type:"FeatureCollection",features:[]};

/* ═══ basemap: OpenFreeMap vector style (keyless); falls back to a plain background offline ═══ */
async function loadBaseStyle(){
  try{
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),7000);
    const r=await fetch(STYLE_URL,{signal:ctl.signal}); clearTimeout(t); if(!r.ok) throw new Error(r.status);
    const s=await r.json(), abs=u=>typeof u==="string"?new URL(u,STYLE_URL).href:u;
    if (Array.isArray(s.sprite)) s.sprite=s.sprite.map(x=>({...x,url:abs(x.url)}));
    const org=new URL(STYLE_URL).origin, fix=u=>typeof u==="string"&&!/^https?:/.test(u)?org+(u.startsWith("/")?"":"/")+u:u;
    if (s.glyphs) s.glyphs=fix(s.glyphs); if (typeof s.sprite==="string") s.sprite=fix(s.sprite);
    for (const src of Object.values(s.sources||{})){ if (src.url) src.url=abs(src.url); if (src.tiles) src.tiles=src.tiles.map(abs); }
    return s;
  }catch(err){ console.warn("basemap unavailable, using plain background:", err.message||err); return null; }
}

/* ═══ map setup ════════════════════════════════════════════════════════ */
function initMap(style){
  const base = style || {version:8,sources:{},layers:[{id:"bg",type:"background",paint:{"background-color":"#E6E9EC"}}]};
  base.layers=(base.layers||[]).filter(l=>!/building/i.test(l.id));      // lots cover them; skipping them saves render time
  const syms=(base.layers||[]).filter(l=>l.type==="symbol").map(l=>l.id);
  st.base={fills:(base.layers||[]).filter(l=>l.type!=="symbol"&&l.type!=="background").map(l=>l.id), syms, before:syms[0]};
  map=new maplibregl.Map({container:"map",bounds:st.P.bbox,fitBoundsOptions:{padding:40},style:base,
    fadeDuration:0,dragRotate:false,pitchWithRotate:false,touchPitch:false,maxPitch:0,renderWorldCopies:false,attributionControl:{compact:true},maxZoom:19.5});
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-left");
  map.on("error",e=>console.warn("map:",e&&e.error&&e.error.message));
  map.on("load",()=>{
    const U=st.base.before, add=(layer,above)=>map.addLayer(layer, above?undefined:U);
    map.addSource("sat",{type:"raster",tiles:[SATELLITE],tileSize:256,maxzoom:19,attribution:"Imagery © Esri, Maxar, Earthstar Geographics"});
    add({id:"sat",type:"raster",source:"sat",layout:{visibility:"none"}});
    map.addSource("lots",{type:"geojson",data:lotsGeoJSON(st.P),maxzoom:15,tolerance:0.35,buffer:32});
    add({id:"lots",type:"fill",source:"lots",paint:{"fill-color":fillColor(),"fill-opacity":lotOpacity(),"fill-antialias":false}});
    add({id:"lot-line",type:"line",source:"lots",minzoom:14,paint:{"line-color":"#4A4F55",
      "line-width":["interpolate",["linear"],["zoom"],14,0.2,16,0.55,18,1.1],"line-opacity":["interpolate",["linear"],["zoom"],14,0.25,15.5,0.7]}});
    map.addSource("tracts",{type:"geojson",data:areasGeoJSON(st.P,"tract")});
    add({id:"tract-fill",type:"fill",source:"tracts",paint:{"fill-color":"#1B62A5","fill-opacity":["case",["boolean",["feature-state","hover"],false],0.12,0]}});
    add({id:"tract-line",type:"line",source:"tracts",paint:{"line-color":"#14263B","line-width":0.8,"line-opacity":0.55}});
    map.addSource("ntas",{type:"geojson",data:areasGeoJSON(st.P,"nta")});
    add({id:"nta-fill",type:"fill",source:"ntas",paint:{"fill-color":"#1B62A5","fill-opacity":["case",["boolean",["feature-state","hover"],false],0.12,0]}});
    add({id:"nta-line",type:"line",source:"ntas",paint:{"line-color":"#14263B","line-width":1.6,"line-opacity":0.8}});
    map.addSource("sub-plat",{type:"geojson",data:EMPTY,attribution:"Subway: MTA Open Data, © OpenStreetMap contributors"});
    add({id:"sub-plat",type:"fill",source:"sub-plat",minzoom:13.5,filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#8D97A2","fill-opacity":0.85}});
    add({id:"sub-plat-line",type:"line",source:"sub-plat",minzoom:13.5,paint:{"line-color":"#4E5863","line-width":["case",["==",["geometry-type"],"LineString"],3,0.8]}});
    map.addSource("sub-line",{type:"geojson",data:EMPTY});
    const W=(a,b)=>["interpolate",["linear"],["zoom"],10,a,16,b];
    const slot=["-",["get","k"],["/",["-",["get","n"],1],2]];
    add({id:"sub-case",type:"line",source:"sub-line",layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":"#fff","line-width":["interpolate",["linear"],["zoom"],10,["+",["*",["get","n"],1.6],2],16,["+",["*",["get","n"],4.2],3]]}});
    add({id:"sub-line",type:"line",source:"sub-line",layout:{"line-cap":"round","line-join":"round"},
      paint:{"line-color":["get","color"],"line-width":W(1.6,4.2),"line-offset":["interpolate",["linear"],["zoom"],10,["*",slot,1.6],16,["*",slot,4.2]]}});
    map.addSource("rings",{type:"geojson",data:EMPTY});
    add({id:"rings-fill",type:"fill",source:"rings",paint:{"fill-color":"#1B62A5","fill-opacity":0.06}});
    add({id:"rings-line",type:"line",source:"rings",paint:{"line-color":"#1B62A5","line-width":1.4,"line-dasharray":[3,2]}});
    map.addSource("selo",{type:"geojson",data:EMPTY});
    add({id:"selo",type:"line",source:"selo",paint:{"line-color":["get","color"],"line-width":["get","w"],"line-opacity":["get","o"]}},true);
    map.addSource("hl",{type:"geojson",data:EMPTY});
    add({id:"hl",type:"line",source:"hl",paint:{"line-color":"#1B62A5","line-width":2.5}},true);
    map.addSource("sub-ent",{type:"geojson",data:EMPTY});
    add({id:"sub-ent",type:"circle",source:"sub-ent",minzoom:14,paint:{"circle-radius":["interpolate",["linear"],["zoom"],14,2.5,17,5],
      "circle-color":["get","color"],"circle-stroke-color":"#fff","circle-stroke-width":1.2}},true);
    map.addSource("sub-st",{type:"geojson",data:EMPTY});
    add({id:"sub-st",type:"circle",source:"sub-st",paint:{"circle-radius":["interpolate",["linear"],["zoom"],11,3,16,7],
      "circle-color":"#fff","circle-stroke-color":"#14263B","circle-stroke-width":["interpolate",["linear"],["zoom"],11,1.4,16,2.5]}},true);
    map.addSource("draw",{type:"geojson",data:EMPTY});
    add({id:"draw-fill",type:"fill",source:"draw",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#1B62A5","fill-opacity":0.12}},true);
    add({id:"draw-line",type:"line",source:"draw",paint:{"line-color":"#1B62A5","line-width":2.5}},true);
    add({id:"draw-pt",type:"circle",source:"draw",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":4.5,"circle-color":"#fff","circle-stroke-color":"#1B62A5","circle-stroke-width":2}},true);
    placeLabels(); renderLegend(); applyMapOpts(); drawSelection(); if (st.T) drawTransit();
    map.on("moveend",updateStationLabels);
    map.once("idle",()=>$("#loading").hidden=true);
  });
  wireMap();
}
function placeLabels(){ markers.forEach(m=>m.remove());
  markers=st.P.areas.filter(a=>a.kind==="nta").map(a=>{ const el=document.createElement("div"); el.className="ntaLabel"; el.textContent=a.name;
    return new maplibregl.Marker({element:el}).setLngLat(a.label).addTo(map); }); }
function drawSelection(){
  st.curIdx = st.sel ? selIndices(st.P,st.sel) : null;
  if (!map||!map.getSource("selo")) return;
  const f=[], many=st.sels.length>1;
  st.sels.forEach((e,k)=>{ const on=!many||typeof st.view!=="number"||st.view===k;
    for (const r of selRings(st.P,e.sel)) f.push({type:"Feature",properties:{color:e.color,w:on?3:1.6,o:on?1:0.5},geometry:{type:"LineString",coordinates:r}}); });
  map.getSource("selo").setData({type:"FeatureCollection",features:f});
  map.setPaintProperty("lots","fill-opacity",lotOpacity());
}

/* ═══ subway data ══════════════════════════════════════════════════════ */
const normKeys=o=>{ const m={}; for (const k in o) m[k.toLowerCase().replace(/[^a-z0-9]/g,"")]=o[k]; return m; };
const pick=(m,...ks)=>{ for (const k of ks) if (m[k]!=null&&m[k]!=="") return m[k]; return null; };
function num(v){ const x=parseFloat(v); return Number.isFinite(x)?x:null; }
function geoPt(r,la,lo,geo){ let a=num(pick(r,...la)), b=num(pick(r,...lo));
  if ((a==null||b==null) && r[geo] && r[geo].coordinates){ b=+r[geo].coordinates[0]; a=+r[geo].coordinates[1]; } return [b,a]; }
function buildTransit(raw){
  const stations=new Map();
  for (const row of raw.stations||[]){ const r=normKeys(row), id=String(pick(r,"complexid","stationid")||"");
    const [lng,lat]=geoPt(r,["gtfslatitude","latitude","lat"],["gtfslongitude","longitude","lon","lng"],"georeference");
    if (!id||lng==null) continue;
    let s=stations.get(id); if (!s){ s={id,name:pick(r,"stopname","stationname","complexname")||"Station",routes:new Set(),ada:0,structure:pick(r,"structure")||"",pts:[]}; stations.set(id,s); }
    String(pick(r,"daytimeroutes","routes")||"").split(/[\s,]+/).filter(Boolean).forEach(x=>s.routes.add(x));
    s.ada=Math.max(s.ada,+(pick(r,"ada")||0)||0); s.pts.push([lng,lat]); }
  const list=[...stations.values()].map(s=>({id:s.id,name:s.name,ada:s.ada,structure:s.structure,
    routes:[...s.routes].sort((a,b)=>ROUTE_ORDER.indexOf(a)-ROUTE_ORDER.indexOf(b)),
    lng:s.pts.reduce((a,p)=>a+p[0],0)/s.pts.length, lat:s.pts.reduce((a,p)=>a+p[1],0)/s.pts.length}));
  const entrances=[];
  for (const row of raw.entrances||[]){ const r=normKeys(row), sid=String(pick(r,"complexid")||"");
    const [lng,lat]=geoPt(r,["entrancelatitude","latitude","lat"],["entrancelongitude","longitude","lon","lng"],"entrancegeoreference");
    if (!stations.has(sid)||lng==null) continue;
    const t=String(pick(r,"entrancetype","type")||"").toLowerCase();
    entrances.push({sid,lng,lat,type:pick(r,"entrancetype","type")||"Entrance",kind:/elev/.test(t)?"elevator":/escal/.test(t)?"escalator":/ramp/.test(t)?"ramp":/stair/.test(t)?"stair":"other",
      entry:!/^no/i.test(String(pick(r,"entryallowed")??"yes")), exit:!/^no/i.test(String(pick(r,"exitallowed")??"yes"))}); }
  const trunks=new Map(), plats=[];
  for (const el of (raw.osm&&raw.osm.elements)||[]){ const t=el.tags||{};
    if (el.type==="relation" && t.route==="subway"){ const ref=(t.ref||"").trim(), color=MTA[ref]||t.colour||"#808183";
      if (!trunks.has(color)) trunks.set(color,new Map());
      for (const m of el.members||[]) if (m.type==="way"&&m.geometry&&!/platform|stop/.test(m.role||""))
        trunks.get(color).set(m.ref||JSON.stringify(m.geometry[0]), m.geometry.map(p=>[p.lon,p.lat])); }
    else if (t.railway==="platform" && !(t.train==="yes" && t.subway!=="yes")){
      const geoms = el.type==="way" ? [el.geometry] : (el.members||[]).filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry);
      for (const g of geoms){ if(!g||g.length<2) continue; const c=g.map(p=>[p.lon,p.lat]);
        const closed=c.length>3&&c[0][0]===c[c.length-1][0]&&c[0][1]===c[c.length-1][1];
        plats.push({type:"Feature",properties:{name:t.name||""},geometry:closed?{type:"Polygon",coordinates:[c]}:{type:"LineString",coordinates:c}}); } } }
  const T={stations:list, entrances, lines:stripeLines(trunks), platforms:{type:"FeatureCollection",features:plats}, sources:raw.sources||[], built:raw.built};
  T.byId=new Map(list.map(s=>[s.id,s])); T.stIndex=new Map(list.map((s,k)=>[s.id,k]));
  T.nameLower=list.map(s=>s.name.toLowerCase());
  return T;
}
/* Interlined routes, MTA-map style: one stripe per trunk colour where trunks share a corridor.
   1. Each trunk's track is sampled every 15 m. Parallel copies of the same colour (express and local
      tracks, one relation per direction) are dropped, leaving one centreline per colour.
   2. A sample's corridor = trunk colours with a centreline within 40 m. Runs shorter than ~250 m are
      merged into their neighbours so crossings don't make blips.
   3. Each run becomes a feature with its stripe slot (k of n). Stripes only keep their side if all
      colours in a corridor point the same way, so every run is aligned with the corridor's first
      colour, whose runs are oriented once per run. */
function stripeLines(trunks){
  const order=c=>{ const k=TRUNKS.indexOf(c); return k<0?99:k; };
  const colors=[...trunks.keys()].sort((a,b)=>order(a)-order(b));
  const kx=mlng(40.7), STEP=15, DUP=22, R=40, C=40, MINRUN=17;
  const X=p=>p[0]*kx, Y=p=>p[1]*MLAT, ck=(x,y)=>Math.floor(x/C)+","+Math.floor(y/C);
  const sample=line=>{ const out=[line[0]];
    for (let i=1;i<line.length;i++){ const a=line[i-1], b=line[i], d=Math.hypot(X(b)-X(a),Y(b)-Y(a)), n=Math.max(1,Math.ceil(d/STEP));
      for (let s=1;s<=n;s++) out.push([a[0]+(b[0]-a[0])*s/n, a[1]+(b[1]-a[1])*s/n]); }
    return out; };
  const near=(grid,p,r,fn)=>{ const x=X(p), y=Y(p), gx=Math.floor(x/C), gy=Math.floor(y/C);
    for (let a=-1;a<=1;a++) for (let b=-1;b<=1;b++){ const L=grid.get((gx+a)+","+(gy+b)); if (!L) continue;
      for (const q of L){ const dx=q.x-x, dy=q.y-y; if (dx*dx+dy*dy<=r*r && fn(q)===false) return; } } };
  const put=(grid,q)=>{ const k=ck(q.x,q.y); let L=grid.get(k); if(!L) grid.set(k,L=[]); L.push(q); };
  // 1 ─ one centreline per colour
  const pieces=[], all=new Map();
  colors.forEach((c,ci)=>{
    const same=new Map(), lines=[...trunks.get(c).values()].map(sample).sort((a,b)=>b.length-a.length);
    for (const line of lines){
      const cov=line.map(p=>{ let hit=false; near(same,p,DUP,()=>{ hit=true; return false; }); return hit; });
      for (let i=0,s=0;i<=cov.length;i++){ if (i===cov.length||cov[i]!==cov[s]){ if (cov[s] && i-s<4) for(let k=s;k<i;k++) cov[k]=false; s=i; } }
      for (let i=0,s=0;i<=cov.length;i++){
        if (i<cov.length && cov[i]===cov[s]) continue;
        if (!cov[s] && i-s>=2){ const pts=line.slice(Math.max(0,s-1),Math.min(line.length,i+1)), pi=pieces.length;
          pieces.push({ci,pts,sign:new Int8Array(pts.length)});
          pts.forEach((p,si)=>{ const q={x:X(p),y:Y(p),pi,si,ci}; put(same,q); put(all,q); }); }
        s=i; }
    }
  });
  // 2 ─ corridor sets per sample, smoothed
  for (const pc of pieces){
    const keys=pc.pts.map(p=>{ const set=new Set([pc.ci]); near(all,p,R,q=>{ set.add(q.ci); }); return [...set].sort((a,b)=>a-b).join("."); });
    for (let pass=0;pass<2;pass++)
      for (let i=1,s=0;i<=keys.length;i++){ if (i===keys.length||keys[i]!==keys[s]){
        if (i-s<MINRUN && !(s===0&&i===keys.length)){ const fill=s>0?keys[s-1]:keys[i]; for(let k=s;k<i;k++) keys[k]=fill; } s=i; } }
    pc.keys=keys;
  }
  // 3 ─ runs, oriented against the corridor's reference colour (processed in colour order)
  const tan=(pts,i)=>{ const a=pts[Math.max(0,i-2)], b=pts[Math.min(pts.length-1,i+2)]; return [X(b)-X(a),Y(b)-Y(a)]; };
  const feats=[];
  for (const pc of pieces.slice().sort((a,b)=>a.ci-b.ci)){
    for (let i=1,s=0;i<=pc.keys.length;i++){
      if (i<pc.keys.length && pc.keys[i]===pc.keys[s]) continue;
      const set=pc.keys[s].split(".").map(Number), a=Math.max(0,s-1), b=Math.min(pc.pts.length,i+1);
      let seg=pc.pts.slice(a,b), flip=false;
      if (set.length>1){
        const ref=set[0], m=Math.floor((a+b)/2), t=tan(pc.pts,m);
        if (ref===pc.ci){ const d=[X(seg[seg.length-1])-X(seg[0]),Y(seg[seg.length-1])-Y(seg[0])]; flip=Math.abs(d[0])>=Math.abs(d[1])?d[0]<0:d[1]<0; }
        else { let best=null, bd=Infinity;
          near(all,pc.pts[m],R*1.5,q=>{ if (q.ci!==ref) return; const dx=q.x-X(pc.pts[m]), dy=q.y-Y(pc.pts[m]), d=dx*dx+dy*dy; if (d<bd){bd=d;best=q;} });
          if (best){ const rp=pieces[best.pi], rt=tan(rp.pts,best.si), sg=rp.sign[best.si]||1; flip=(t[0]*rt[0]+t[1]*rt[1])*sg<0; }
          else { const d=[X(seg[seg.length-1])-X(seg[0]),Y(seg[seg.length-1])-Y(seg[0])]; flip=Math.abs(d[0])>=Math.abs(d[1])?d[0]<0:d[1]<0; } }
      }
      for (let k=a;k<b;k++) pc.sign[k]=flip?-1:1;
      if (flip) seg=seg.reverse();
      feats.push({type:"Feature",properties:{color:colors[pc.ci],k:set.indexOf(pc.ci),n:set.length},geometry:{type:"LineString",coordinates:seg}});
      s=i;
    }
  }
  return {type:"FeatureCollection",features:feats};
}
async function loadTransit(){
  const [w,s,e,n]=NYC_BOX;                     // whole city, so new lot releases need no transit rebuild
  let raw=window.__LP__&&window.__LP__.transit;
  if (!raw && !window.__LP__){ try{ const r=await fetch("data/transit.json"); if (r.ok) raw=await r.json(); }catch(_){} }
  if (!raw){                                  // live, keyless: MTA Open Data (Socrata) + OpenStreetMap (Overpass)
    $("#subStatus").textContent="Subway data: downloading from MTA Open Data and OpenStreetMap…";
    const q=`[out:json][timeout:60];relation["route"="subway"](${s},${w},${n},${e});out geom;(way["railway"="platform"](${s},${w},${n},${e});relation["railway"="platform"](${s},${w},${n},${e}););out geom;`;
    const [sta,ent,osm]=await Promise.all([
      fetch("https://data.ny.gov/resource/39hk-dx4f.json?$limit=5000").then(r=>{ if(!r.ok) throw new Error("stations HTTP "+r.status); return r.json(); }),
      fetch("https://data.ny.gov/resource/i9wp-a4ja.json?$limit=10000").then(r=>{ if(!r.ok) throw new Error("entrances HTTP "+r.status); return r.json(); }),
      fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(r=>r.ok?r.json():{elements:[]}).catch(()=>({elements:[]}))]);
    const inBox=row=>{ const r=normKeys(row), [lng,lat]=geoPt(r,["gtfslatitude","latitude","entrancelatitude"],["gtfslongitude","longitude","entrancelongitude"],"georeference"); return lng!=null&&lng>=w&&lng<=e&&lat>=s&&lat<=n; };
    raw={stations:sta.filter(inBox), entrances:ent, osm, sources:["MTA Open Data (live)","© OpenStreetMap contributors"]};
  }
  st.T=buildTransit(raw);
  const T=st.T;
  $("#subStatus").textContent=`Subway data: ${T.stations.length} stations, ${T.entrances.length} entrances, ${T.lines.features.length} route lines, ${T.platforms.features.length} platform shapes. Sources: MTA Open Data; © OpenStreetMap contributors.`;
  drawTransit();
  if (st.pending){ const p=st.pending; st.pending=null; restore(p.sels,p.view,true); } else if (st.sels.length){ drawSelection(); renderProfile(); }
}
function drawTransit(){
  const T=st.T; if (!T||!map||!map.getSource("sub-st")) return;
  map.getSource("sub-line").setData(T.lines); map.getSource("sub-plat").setData(T.platforms);
  map.getSource("sub-st").setData({type:"FeatureCollection",features:T.stations.map((s,k)=>({type:"Feature",id:k,properties:{k},geometry:{type:"Point",coordinates:[s.lng,s.lat]}}))});
  map.getSource("sub-ent").setData({type:"FeatureCollection",features:T.entrances.map((e,k)=>({type:"Feature",id:k,properties:{k,color:ENT_COLOR[e.kind]},geometry:{type:"Point",coordinates:[e.lng,e.lat]}}))});
  stMarkers.forEach(m=>m.remove()); stMarkers=new Map();
  updateStationLabels(); drawRings();
}
/* Only stations on screen get a label marker; hundreds of hidden DOM markers still cost time on every pan. */
function updateStationLabels(){
  if (!map || !st.T) return;
  const on=st.map.sub.stations && st.map.sub.names && map.getZoom()>=14.2, want=new Set();
  if (on && map.getBounds){ const b=map.getBounds(), pad=0.004;
    st.T.stations.forEach(s=>{ if (s.lng>b.getWest()-pad&&s.lng<b.getEast()+pad&&s.lat>b.getSouth()-pad&&s.lat<b.getNorth()+pad) want.add(s.id); }); }
  for (const [id,m] of stMarkers) if (!want.has(id)){ m.remove(); stMarkers.delete(id); }
  for (const id of want) if (!stMarkers.has(id)){ const s=st.T.byId.get(id), el=document.createElement("div"); el.className="stLabel";
    el.innerHTML=`${esc(s.name)} ${s.routes.map(bullet).join("")}`; stMarkers.set(id,new maplibregl.Marker({element:el,anchor:"left"}).setLngLat([s.lng,s.lat]).addTo(map)); }
}
function drawRings(){
  if (!map||!map.getSource("rings")) return;
  const m=st.map.rings; if (!m||!st.T){ map.getSource("rings").setData(EMPTY); return; }
  map.getSource("rings").setData({type:"FeatureCollection",features:st.T.stations.map(s=>({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[starUnion(walkPts(s.id),m)]}}))});
}
function stationPopup(k, lngLat){
  const s=st.T.stations[k], ne=st.T.entrances.filter(e=>e.sid===s.id);
  const kinds={}; ne.forEach(e=>kinds[e.type]=(kinds[e.type]||0)+1);
  const html=`<div class="stpop"><h3>${esc(s.name)} ${s.routes.map(bullet).join("")}</h3>
    ${esc(s.structure)}${s.structure?". ":""}${s.ada===1?"Fully accessible":s.ada===2?"Partially accessible":"Not accessible"}.<br>
    ${ne.length?`${ne.length} entrance${ne.length>1?"s":""}: ${Object.entries(kinds).map(([t,c])=>`${c} ${esc(t.toLowerCase())}`).join(", ")}`:"No entrance data; walksheds use the station point."}
    <div class="walk">Walkshed from entrances: ${[[402.3,"¼ mi"],[804.7,"½ mi"],[1609.3,"1 mi"]].map(([m,t])=>`<button data-walk="${esc(s.id)}" data-m="${m}">${t}</button>`).join("")}</div>
    <div class="walk">½ mi around every station on ${s.routes.map(r=>`<button data-route="${esc(r)}" title="Adds one walkshed per station that reaches the loaded lots">${bullet(r)}</button>`).join("")}</div>
    <p class="phint">${st.addMode?"Add is on: walksheds are added to your selections.":"Shift-click, or turn on Add, to keep earlier selections."}</p></div>`;
  openPopup(lngLat||[s.lng,s.lat], html);
}
function entrancePopup(k, lngLat){
  const e=st.T.entrances[k], s=st.T.byId.get(e.sid);
  openPopup(lngLat||[e.lng,e.lat], `<div class="stpop"><h3>${esc(e.type)} to ${esc(s?s.name:"")} ${(s?s.routes:[]).map(bullet).join("")}</h3>
    ${e.entry&&e.exit?"Entry and exit":e.entry?"Entry only":"Exit only"}
    <div class="walk">From this entrance: ${[[402.3,"¼ mi"],[804.7,"½ mi"],[1609.3,"1 mi"]].map(([m,t])=>`<button data-ent="${k}" data-m="${m}">${t}</button>`).join("")}</div>
    <div class="walk">Whole station: <button data-walk="${esc(e.sid)}" data-m="804.7">½ mi walkshed</button></div></div>`);
}

/* ═══ interaction ══════════════════════════════════════════════════════ */
let drawPts=[], radiusC=null, hoverId=null, hoverSrc=null, hoverLot=-1, rafQ=false, lastEv=null, popup=null;
const HINTS={
  lot:"Click a lot to open its record. Shift-click to add or remove lots.",
  block:"Click a tax block to select it. Shift-click to add or remove blocks.",
  poly:"Click to add corners. Click the first corner or press Enter to finish. Esc cancels.",
  radius:"Click the center, move out, then click again. Clicks snap to entrances and stations; with a fixed radius and Add on, click station after station. Radius:"};
function setMode(m){
  st.mode=m; drawPts=[]; radiusC=null; if (map.getSource("draw")) map.getSource("draw").setData(EMPTY);
  $$("#tools button").forEach(b=>b.classList.toggle("on",b.dataset.mode===m));
  const h=$("#hint"); h.hidden=!HINTS[m];
  h.innerHTML=HINTS[m]?esc(HINTS[m])+(m==="radius"?[["¼ mi",402.3],["½ mi",804.7],["1 mi",1609.3],["Free",0]].map(([t,v])=>` <button data-r="${v}" class="${st.radiusPreset==v?"on":""}">${t}</button>`).join(""):""):"";
  map.getCanvas().style.cursor=m==="poly"||m==="radius"?"crosshair":"";
  if (m==="poly") map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  clearHover(); $("#maptip").hidden=true; applyMapOpts();
}
function clearHover(){ if (hoverId!=null && map.getSource(hoverSrc)) map.setFeatureState({source:hoverSrc,id:hoverId},{hover:false}); hoverId=null;
  if (hoverLot>=0 && map.getSource("hl")) map.getSource("hl").setData(EMPTY); hoverLot=-1; }
function tipAt(pt,html){ const t=$("#maptip"); t.innerHTML=html; t.hidden=false; const W=$("#mapbox").clientWidth;
  t.style.left=Math.min(pt.x+14,W-t.offsetWidth-8)+"px"; t.style.top=(pt.y+14)+"px"; }
function drawFC(cursor){ const pts=cursor?[...drawPts,cursor]:drawPts, f=[];
  if (pts.length>2) f.push({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...pts,pts[0]]]}});
  else if (pts.length>1) f.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:pts}});
  drawPts.forEach(p=>f.push({type:"Feature",properties:{},geometry:{type:"Point",coordinates:p}})); return {type:"FeatureCollection",features:f}; }
const radiusFC=(c,m)=>({type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry:{type:"Point",coordinates:c}},{type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[circle(c,m)]}}]});
function lotCard(i){ const P=st.P, y=P.year[i], acc=access(P);
  return `<b>${esc(P.addr[i]||"No address")}</b><br>${P.dict.lu[P.lu[i]]}, zoned ${esc(P.dict.zone[P.zone[i]]||"—")}<br>${fmt(P.area[i])} sq ft lot, ${fmt(P.units[i])} unit${P.units[i]===1?"":"s"}${y?`, built ${y}`:""}<br>Built FAR ${fmt(P.bfar[i],2)} of ${fmt(P.mfar[i],2)} maximum`+
    (acc&&acc.who[i]>=0?`<br>${miles(acc.d[i])} to ${esc(st.T.stations[acc.who[i]].name)} entrance`:""); }
function hlGeom(polys){ map.getSource("hl").setData(polys&&polys.length?{type:"Feature",properties:{},geometry:{type:"MultiLineString",coordinates:polys.map(p=>p[0])}}:EMPTY); }
function openPopup(ll,html){ if (popup) popup.remove(); popup=new maplibregl.Popup({maxWidth:"290px"}).setLngLat(ll).setHTML(html).addTo(map); }
function snap(pt){                                   // nearest visible entrance/station within 14 px
  if (!st.T) return null; let best=null, bd=14*14;
  const test=(lng,lat,label)=>{ const p=map.project([lng,lat]), d=(p.x-pt.x)**2+(p.y-pt.y)**2; if(d<bd){bd=d;best={c:[lng,lat],label};} };
  if (st.map.sub.entrances && map.getZoom()>=14) st.T.entrances.forEach(e=>test(e.lng,e.lat,`an entrance to ${st.T.byId.get(e.sid).name}`));
  if (st.map.sub.stations) st.T.stations.forEach(s=>test(s.lng,s.lat,s.name));
  return best;
}
function wireMap(){
  map.on("mousemove",e=>{ lastEv=e; if(rafQ) return; rafQ=true; requestAnimationFrame(()=>{ rafQ=false; onMove(lastEv); }); });
  map.on("mouseout",()=>{ $("#maptip").hidden=true; clearHover(); });
  map.on("click",onClick);
  map.on("dblclick",e=>{ if(st.mode==="poly"){ e.preventDefault(); finishPoly(e.originalEvent.shiftKey); } });
}
function subAt(point){ const L=["sub-st","sub-ent"].filter(l=>map.getLayer(l)&&map.getLayoutProperty(l,"visibility")!=="none");
  return L.length?map.queryRenderedFeatures([[point.x-6,point.y-6],[point.x+6,point.y+6]],{layers:L}):[]; }
function onMove(e){
  const p=[e.lngLat.lng,e.lngLat.lat];
  if (st.mode==="poly"){ if(!drawPts.length) return; map.getSource("draw").setData(drawFC(p));
    if (drawPts.length>1) tipAt(e.point,`${fmt(selIndices(st.P,{type:"poly",ring:[...drawPts,p,drawPts[0]]}).length)} lots inside`); return; }
  if (st.mode==="radius"){ const sn=radiusC?null:snap(e.point), c=radiusC||(st.radiusPreset?(sn?sn.c:p):null);
    if (!c){ if (sn) tipAt(e.point,`Snap to ${esc(sn.label)}`); else $("#maptip").hidden=true; return; }
    const m=radiusC?distM(radiusC,p):st.radiusPreset; map.getSource("draw").setData(radiusFC(c,m));
    tipAt(e.point,`${miles(m)}, ${fmt(selIndices(st.P,{type:"radius",c,m}).length)} lots${sn&&!radiusC?`<br>from ${esc(sn.label)}`:""}`); return; }
  const sf=subAt(e.point);
  if (sf.length){ const f=sf[0]; map.getCanvas().style.cursor="pointer"; clearHover();
    if (f.layer.id==="sub-st"){ const s=st.T.stations[f.properties.k]; tipAt(e.point,`<b>${esc(s.name)}</b> ${s.routes.map(bullet).join("")}<br>Click for walksheds`); }
    else { const en=st.T.entrances[f.properties.k]; tipAt(e.point,`<b>${esc(en.type)}</b><br>${esc(st.T.byId.get(en.sid).name)}`); }
    return; }
  if (st.mode==="lot"||st.mode==="block"){
    const f=map.queryRenderedFeatures(e.point,{layers:["lots"]}); if (hoverId!=null) clearHover();
    if (!f.length){ if (hoverLot>=0) hlGeom(null); hoverLot=-1; map.getCanvas().style.cursor=""; $("#maptip").hidden=true; return; }
    const i=f[0].id; map.getCanvas().style.cursor="pointer";
    if (st.mode==="lot"){ if (i!==hoverLot){ hoverLot=i; lotsGeoJSON(st.P); hlGeom(st.P.geom[i]); } tipAt(e.point,lotCard(i)); }
    else { const j=st.P.blk[i], b=st.P.blocks[j]; if (b && j!==hoverLot){ hoverLot=j; hlGeom(b.polys); }
      if (b) tipAt(e.point,`<b>${blockName(b.key)}</b><br>${fmt(st.P.blkCount[j])} lots`); }
    return; }
  const layer=st.mode==="tract"?"tract-fill":"nta-fill", src=st.mode==="tract"?"tracts":"ntas";
  if (!map.getLayer(layer)||map.getLayoutProperty(layer,"visibility")==="none"){ $("#maptip").hidden=true; return; }
  const f=map.queryRenderedFeatures(e.point,{layers:[layer]}), id=f.length?f[0].id:null;
  if (id!==hoverId||src!==hoverSrc){ clearHover(); hoverId=id; hoverSrc=src; if(id!=null) map.setFeatureState({source:src,id},{hover:true}); }
  map.getCanvas().style.cursor=id!=null?"pointer":"";
  if (id!=null) tipAt(e.point,`<b>${esc(f[0].properties.name)}</b>`); else $("#maptip").hidden=true;
}
function toggleIn(arr,v){ const s=new Set(arr); s.has(v)?s.delete(v):s.add(v); return [...s]; }
function onClick(e){
  const p=[e.lngLat.lng,e.lngLat.lat];
  if (st.mode==="poly"){ if (drawPts.length>2){ const a=map.project(drawPts[0]); if(Math.hypot(a.x-e.point.x,a.y-e.point.y)<12) return finishPoly(e.originalEvent.shiftKey); }
    drawPts.push(p); map.getSource("draw").setData(drawFC()); return; }

  const shift=e.originalEvent&&e.originalEvent.shiftKey;
  if (st.mode==="radius"){ const sn=radiusC?null:snap(e.point), c=sn?sn.c:p;
    if (st.radiusPreset) return finish({type:"radius",c,m:st.radiusPreset,label:sn?`Within ${miles(st.radiusPreset)} of ${sn.label}`:undefined},shift);
    if (!radiusC){ radiusC=c; radiusC.label=sn&&sn.label; return; }
    const m=distM(radiusC,p); if (m<20) return;
    return finish({type:"radius",c:[radiusC[0],radiusC[1]],m:Math.round(m),label:radiusC.label?`Within ${miles(m)} of ${radiusC.label}`:undefined},shift); }
  const sf=subAt(e.point);
  if (sf.length){ const f=sf[0]; return f.layer.id==="sub-st"?stationPopup(f.properties.k):entrancePopup(f.properties.k); }
  if (st.mode==="lot"||st.mode==="block"){
    const f=map.queryRenderedFeatures(e.point,{layers:["lots"]}); if (!f.length) return;
    const i=f[0].id;
    const cur=st.sel;                                  // shift-click edits the lots/blocks selection being viewed
    if (st.mode==="lot"){ const bbl=Math.round(st.P.bbl[i]);
      if (shift && cur && cur.type==="lots"){ const b=toggleIn(cur.bbls,bbl); return b.length?select({type:"lots",bbls:b},false,{edit:true}):removeSel(curIndex()); }
      return select({type:"lots",bbls:[bbl]},false,{map:true}); }
    const key=st.P.blocks[st.P.blk[i]]&&st.P.blocks[st.P.blk[i]].key; if (key==null) return;
    if (shift && cur && cur.type==="blocks"){ const k=toggleIn(cur.keys,key); return k.length?select({type:"blocks",keys:k},false,{edit:true}):removeSel(curIndex()); }
    return select({type:"blocks",keys:[key]},false,{map:true}); }
  const f=map.queryRenderedFeatures(e.point,{layers:[st.mode==="tract"?"tract-fill":"nta-fill"]});
  if (f.length){ const a=st.P.areas[f[0].id]; select({type:"area",kind:a.kind,code:a.code},false,{map:true,add:shift}); }
}
function finishPoly(shift){ if (drawPts.length<3){ setMode("area"); return; }
  finish({type:"poly",ring:[...drawPts,drawPts[0]].map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)])},shift); }
function finish(sel,shift){ const stay=st.mode==="radius"&&(st.addMode||shift)&&st.radiusPreset;   // keep the radius tool for station-hopping
  if (!stay && (st.mode==="radius"||st.mode==="poly")) setMode("area"); select(sel,false,{map:true,add:shift}); }
/* select(sel, fit, o): o.map = came from the map (Add mode applies), o.add = keep earlier selections,
   o.edit = change the selection being viewed, o.keepPrev = keep the Back link. */
function nextColor(){ const used=new Set(st.sels.map(e=>e.color)); return SEL_COLORS.find(c=>!used.has(c))||SEL_COLORS[st.sels.length%SEL_COLORS.length]; }
const curIndex=()=>st.sels.length===1?0:typeof st.view==="number"?st.view:st.sels.length-1;
function select(sel, fit, o={}){
  if (sel && sel.type==="walk" && !st.T){ const next=o.add||(o.map&&st.addMode)?[...st.sels,{sel,color:nextColor()}]:[{sel,color:SEL_COLORS[0]}];
    st.pending={sels:next.map(e=>e.sel),view:next.length>1?"all":0}; return; }
  if (!o.keepPrev) st.prevSel=null;
  if (!o.noUndo) pushUndo();
  if (!sel){ if (st.sels.length) toast("Selection cleared.","Undo",undo); st.sels=[]; st.view="all"; }
  else if (o.edit && st.sels.length) st.sels[curIndex()].sel=sel;
  else if (o.add || (o.map && st.addMode)){ st.sels.push({sel,color:st.sels.length?nextColor():SEL_COLORS[0]}); st.view=st.sels.length>1?"all":0; }
  else { st.sels=[{sel,color:SEL_COLORS[0]}]; st.view=0; }
  if (popup && sel) popup.remove(); drawSelection(); renderProfile(); writeHash();
  if (fit && sel) fitTo([sel]);
}
function restore(sels, view, fit, record){
  if (sels.some(s=>s.type==="walk") && !st.T){ st.pending={sels,view}; return; }
  if (record) pushUndo();
  st.sels=sels.map((sel,k)=>({sel,color:SEL_COLORS[k%SEL_COLORS.length]})); st.view=sels.length>1?(view??"all"):0;
  drawSelection(); renderProfile(); writeHash(); if (fit && sels.length) fitTo(sels);
}
function removeSel(k){ pushUndo(); const gone=selTitle(st.P,st.sels[k].sel,0)[0]; st.sels.splice(k,1); toast(`Removed ${gone}.`,"Undo",undo); st.view=st.sels.length>1?"all":0; drawSelection(); renderProfile(); writeHash(); }
function setView(v){ st.view=v; drawSelection(); renderProfile(); writeHash();
  if (typeof v==="number") fitTo([st.sels[v].sel]); }
function fitTo(sels){ const rings=sels.flatMap(s=>selRings(st.P,s)); if (!rings.length) return; let x0=180,y0=90,x1=-180,y1=-90;
  rings.flat().forEach(([x,y])=>{ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; });
  map.fitBounds([[x0,y0],[x1,y1]],{padding:70,duration:500,maxZoom:18}); }
function snapshot(){ return {sels:st.sels.map(e=>({...e})), view:st.view}; }
/* Undo / redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y): every change to the set of selections is recorded. */
const undoStack=[], redoStack=[];
const describe=s=>!s.sels.length?"no selection":s.sels.length===1?selTitle(st.P,s.sels[0].sel,0)[0]:`${s.sels.length} selections`;
function pushUndo(){ undoStack.push(snapshot()); if (undoStack.length>80) undoStack.shift(); redoStack.length=0; }
function applySnap(s){ st.sels=s.sels.map(e=>({...e})); st.view=s.view; st.prevSel=null; drawSelection(); renderProfile(); writeHash(); }
function undo(){ if (!undoStack.length) return toast("Nothing to undo"); redoStack.push(snapshot()); const s=undoStack.pop(); applySnap(s); toast(`Undone. Now showing ${describe(s)}.`,"Redo",redo); }
function redo(){ if (!redoStack.length) return toast("Nothing to redo"); undoStack.push(snapshot()); const s=redoStack.pop(); applySnap(s); toast(`Redone. Now showing ${describe(s)}.`,"Undo",undo); }
let toastT=null;
function toast(msg, act, fn){ const t=$("#toast"); t.innerHTML=esc(msg)+(act?` <button>${act}</button>`:""); t.hidden=false;
  if (act) t.querySelector("button").onclick=()=>{ t.hidden=true; fn(); };
  clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3500); }

/* ═══ releases ═════════════════════════════════════════════════════════ */
function renderTrack(){
  $("#track").innerHTML=st.releases.map(r=>`<li class="${r.id===st.P.id?"on":""} ${st.C&&r.id===st.C.id?"cmp":""}"><button data-rel="${r.id}" title="${esc(r.label)}: ${fmt(r.lots)} lots${r.released?`, released ${r.released}`:""}${r.id===st.P.id?" (showing)":""}" aria-pressed="${r.id===st.P.id}"></button><span>${r.id}</span></li>`).join("")+
    `<li class="ghost"><button title="Add the next release: python tools/build.py path/to/MapPLUTO.shp --release 26v1" aria-label="How to add a release"></button><span>next</span></li>`;
  const others=st.releases.filter(r=>r.id!==st.P.id);
  $("#cmp").innerHTML=`<option value="">${others.length?"nothing":"no other release yet"}</option>`+others.map(r=>`<option value="${r.id}" ${st.C&&st.C.id===r.id?"selected":""}>${r.id}</option>`).join("");
  $("#cmp").disabled=!others.length;
}
async function switchRelease(id){
  if (id===st.P.id) return; $("#loading").hidden=false; $("#loading").textContent=`Loading ${id}…`;
  st.P=await getPack(id); if (st.C&&st.C.id===id) st.C=null;
  map.getSource("lots").setData(lotsGeoJSON(st.P)); map.getSource("ntas").setData(areasGeoJSON(st.P,"nta")); map.getSource("tracts").setData(areasGeoJSON(st.P,"tract"));
  restyleLots(); placeLabels(); applyMapOpts(); renderTrack(); drawSelection(); renderProfile(); writeHash();
  map.once("idle",()=>$("#loading").hidden=true);
}
async function setCompare(id){ st.C=id?await getPack(id):null; renderTrack(); renderProfile(); writeHash(); }

/* ═══ URL state ════════════════════════════════════════════════════════ */
function writeHash(){
  const q=new URLSearchParams(); q.set("v",st.P.id); if(st.C) q.set("c",st.C.id); if(st.colorBy!=="lu") q.set("m",st.colorBy);
  for (const {sel:s} of st.sels) q.append("s", s.type==="area"?`a:${s.kind}:${s.code}`: s.type==="lots"?"l:"+s.bbls.join(","): s.type==="blocks"?"k:"+s.keys.join(","):
    s.type==="walk"?`w:${s.sid},${Math.round(s.m)}`: s.type==="radius"?`r:${s.c[0].toFixed(6)},${s.c[1].toFixed(6)},${Math.round(s.m)}`:"p:"+s.ring.slice(0,-1).map(p=>p.join(",")).join(";"));
  if (st.sels.length>1 && st.view!=="all") q.set("view",st.view);
  history.replaceState(null,"","#"+q.toString());
}
function parseSel(s){
  const t=s.slice(0,1), rest=s.slice(2);
  try{
    if (t==="a"){ const [kind,code]=rest.split(":"); return {type:"area",kind,code}; }
    if (t==="l") return {type:"lots",bbls:rest.split(",").map(Number).filter(Boolean)};
    if (t==="k") return {type:"blocks",keys:rest.split(",").map(Number).filter(Boolean)};
    if (t==="w"){ const [sid,m]=rest.split(","); return {type:"walk",sid,m:+m}; }
    if (t==="r"){ const [x,y,m]=rest.split(",").map(Number); return {type:"radius",c:[x,y],m}; }
    if (t==="p"){ const pts=rest.split(";").map(x=>x.split(",").map(Number)); if (pts.length>2) return {type:"poly",ring:[...pts,pts[0]]}; }
  }catch(_){}
  return null;
}
function readHash(){
  const q=new URLSearchParams(location.hash.slice(1)), v=q.get("view");
  return {v:q.get("v"),c:q.get("c"),m:q.get("m"),sels:q.getAll("s").map(parseSel).filter(Boolean),view:v==null?"all":/^\d+$/.test(v)?+v:v};
}

/* ═══ panel wiring ═════════════════════════════════════════════════════ */
function showTip(x,y,html){ const t=$("#tip"); t.innerHTML=html; t.hidden=false;
  t.style.left=Math.min(x+14,innerWidth-t.offsetWidth-8)+"px"; t.style.top=Math.max(8,Math.min(y+14,innerHeight-t.offsetHeight-8))+"px"; }
function openLot(bbl){ const cur=st.sel, prev=cur && !(cur.type==="lots"&&cur.bbls.length===1 && st.sels.length===1) ? snapshot() : st.prevSel;
  select({type:"lots",bbls:[bbl]},true,{keepPrev:true}); st.prevSel=prev; renderProfile(); }
function wirePanel(){
  const panel=$("#panel");
  panel.addEventListener("mousemove",e=>{
    const pie=e.target.closest(".pie");
    if (pie){ const r=pie.getBoundingClientRect(), dx=e.clientX-r.left-r.width/2, dy=e.clientY-r.top-r.height/2, d=Math.hypot(dx,dy);
      if (d>r.width/2||d<r.width*0.28) return $("#tip").hidden=true;
      let a=Math.atan2(dx,-dy)*180/Math.PI; if(a<0) a+=360; let acc=0;
      for (const [k,p,v,m] of JSON.parse(pie.dataset.seg)){ acc+=p*3.6; if(a<=acc) return showTip(e.clientX,e.clientY,`<b>${esc(k)}</b><br>${p.toFixed(1)}% ${m}<br>${esc(v)}`); }
      return $("#tip").hidden=true; }
    const el=e.target.closest("[data-k]");
    if (el&&el.dataset.p!=="") return showTip(e.clientX,e.clientY,`<b>${esc(el.dataset.k)}</b><br>${el.dataset.p}% ${el.dataset.m}${el.dataset.v?"<br>"+esc(el.dataset.v):""}`);
    $("#tip").hidden=true; });
  panel.addEventListener("mouseleave",()=>$("#tip").hidden=true);
  panel.addEventListener("click",e=>{
    const rm=e.target.closest("#profile [data-x]"); if (rm){ e.stopPropagation(); return removeSel(+rm.dataset.x); }
    const x=e.target.closest("[data-export]"); if (x) return exportPNG(x.dataset.export);
    const l=e.target.closest("[data-lot]"); if (l) return openLot(+l.dataset.lot);
    const b=e.target.closest("[data-goblock]"); if (b){ const prev=snapshot(); select({type:"blocks",keys:[+b.dataset.goblock]},true,{keepPrev:true}); st.prevSel=prev; renderProfile(); }
    const pick=e.target.closest("[data-pick]"); if (pick) setView(/^\d+$/.test(pick.dataset.pick)?+pick.dataset.pick:pick.dataset.pick); });
  $("#btnBack").onclick=()=>{ const p=st.prevSel; st.prevSel=null; restore(p.sels.map(e=>e.sel),p.view,true,true); };
  $("#selbar").addEventListener("click",e=>{
    const x=e.target.closest("[data-x]"); if (x){ e.stopPropagation(); return removeSel(+x.dataset.x); }
    const b=e.target.closest("[data-v]"); if (!b) return; const v=b.dataset.v, n=st.sels.length, seq=["all","cmp",...st.sels.map((_,k)=>k)];
    if (v==="prev"||v==="next"){ const at=seq.indexOf(st.view); return setView(seq[(at+(v==="next"?1:seq.length-1))%seq.length]); }
    setView(/^\d+$/.test(v)?+v:v); });
  let dragKey=null;
  panel.addEventListener("mousedown",e=>{ const g=e.target.closest(".grip"); if(g) g.closest(".blk").draggable=true; });
  panel.addEventListener("dragstart",e=>{ const b=e.target.closest(".blk"); if(!b) return; dragKey=b.dataset.key; b.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain",dragKey); });
  panel.addEventListener("dragend",()=>{ $$(".blk").forEach(b=>{ b.classList.remove("dragging","over-top","over-bot"); b.draggable=false; }); dragKey=null; });
  panel.addEventListener("dragover",e=>{ const b=e.target.closest(".blk"); if(!b||!dragKey||b.dataset.key===dragKey||b.dataset.key==="cmp") return; e.preventDefault();
    const r=b.getBoundingClientRect(), top=e.clientY<r.top+r.height/2; $$(".blk").forEach(x=>x.classList.remove("over-top","over-bot")); b.classList.add(top?"over-top":"over-bot"); });
  panel.addEventListener("drop",e=>{ const b=e.target.closest(".blk"); if(!b||!dragKey||b.dataset.key==="cmp") return; e.preventDefault();
    const r=b.getBoundingClientRect(), top=e.clientY<r.top+r.height/2, o=st.opts.order.filter(k=>k!==dragKey);
    let at=o.indexOf(b.dataset.key); if(!top) at++; o.splice(at,0,dragKey); st.opts.order=o; renderProfile(); });
  const bar=$("#dragbar"); let on=false;
  const move=(x,y)=>{ if(!on) return; if(innerWidth<=820) panel.style.height=Math.max(140,Math.min(innerHeight-180,innerHeight-y))+"px";
    else panel.style.width=Math.max(300,Math.min(innerWidth*0.8,innerWidth-x))+"px"; map.resize(); };
  bar.addEventListener("pointerdown",e=>{ on=true; bar.classList.add("on"); bar.setPointerCapture(e.pointerId); });
  bar.addEventListener("pointermove",e=>move(e.clientX,e.clientY));
  bar.addEventListener("pointerup",()=>{ on=false; bar.classList.remove("on"); map.resize(); });
}
function wireOptions(){
  const segBtns=(id,key,after)=>$$(`#${id} button`).forEach(b=>b.onclick=()=>{ st.opts[key]=b.dataset.v; $$(`#${id} button`).forEach(x=>x.classList.toggle("on",x===b)); after(); });
  segBtns("styleSeg","style",renderProfile);
  segBtns("sizeSeg","size",()=>{ const [bh,pd]=SIZES[st.opts.size]; document.documentElement.style.setProperty("--barH",bh); document.documentElement.style.setProperty("--pieD",pd); });
  const pills=()=>{ const g=groupsFrom(st.opts.div), c=groupColors(g.length);
    $("#ubPills").innerHTML=g.map((x,i)=>`<span style="background:${c[i]};color:${i>=g.length/2&&g.length>1?"#fff":"#14263B"}">${groupLabel(x)}</span>`).join(""); };
  $("#ubPreset").onchange=e=>{ const v=e.target.value, box=$("#ubCustom"); box.hidden=v!=="custom"; $("#ubErr").hidden=true;
    if (v==="custom"){ box.value=divText(st.opts.div); box.focus(); return; }
    st.opts.div=v==="all"?Array(8).fill(true):parseGroups(v).div; pills(); renderProfile(); };
  $("#ubCustom").oninput=e=>{ const r=parseGroups(e.target.value); e.target.classList.toggle("bad",!!r.err);
    $("#ubErr").hidden=!r.err; $("#ubErr").textContent=r.err||""; if (r.div){ st.opts.div=r.div; pills(); renderProfile(); } };
  pills();
  $("#luFilter").innerHTML=st.P.dict.lu.map((t,i)=>`<label><input type="checkbox" data-lu="${i}" checked><i style="background:${LU_COLORS[i]}"></i><span>${t}</span></label>`).join("");
  $("#luFilter").onchange=e=>{ const i=+e.target.dataset.lu; e.target.checked?st.opts.luExcl.delete(i):st.opts.luExcl.add(i);
    e.target.closest("label").classList.toggle("off",!e.target.checked); restyleLots(); renderProfile(); };
  $("#btnClear").onclick=()=>select(null); $("#btnX").onclick=()=>select(null);
  $("#btnLink").onclick=async()=>{ try{ await navigator.clipboard.writeText(location.href); $("#btnLink").textContent="Link copied"; }catch(_){ prompt("Copy this link:",location.href); }
    setTimeout(()=>$("#btnLink").textContent="Copy link",1600); };
  $("#btnCsv").onclick=exportCSV;
  // map legend + customize
  $("#colorBy").onchange=e=>{ st.colorBy=e.target.value; restyleLots(); writeHash(); };
  $("#swatches").onclick=e=>{ const d=e.target.closest("[data-c]"); if(!d) return; const H=st.map.hidden[st.colorBy], c=+d.dataset.c; H.has(c)?H.delete(c):H.add(c); restyleLots(); };
  const setRange=()=>{ const a=parseFloat($("#rMin").value), b=parseFloat($("#rMax").value); if (Number.isFinite(a)&&Number.isFinite(b)&&b>a){ st.map.range[st.colorBy]=[a,b]; restyleLots(); } };
  $("#rMin").onchange=setRange; $("#rMax").onchange=setRange;
  $("#rAuto").onclick=()=>{ st.map.range[st.colorBy]=[...RANGE_DEFAULT[st.colorBy]]; restyleLots(); };
  $("#ramp").onchange=e=>{ st.map.ramp=e.target.value; restyleLots(); };
  $("#opacity").oninput=e=>{ st.map.opacity=+e.target.value; $("#opOut").textContent=Math.round(st.map.opacity*100)+"%"; map.setPaintProperty("lots","fill-opacity",lotOpacity()); };
  $$("[data-opt]").forEach(cb=>cb.onchange=()=>{ st.map[cb.dataset.opt]=cb.checked; if (cb.dataset.opt==="tracts") clearHover(); applyMapOpts(); });
  $$("[data-sub]").forEach(cb=>cb.onchange=()=>{ st.map.sub[cb.dataset.sub]=cb.checked; applyMapOpts(); });
  $("#rings").onchange=e=>{ st.map.rings=+e.target.value; drawRings(); };
}
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const plain=s=>String(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
function exportCSV(){
  const lines=[["section","category","measure","value"]], S=st.S;
  if (S) [["Tax lots",S.lots],["Acres",S.acres.toFixed(2)],["Housing units",S.units],["Units per acre",S.upa&&S.upa.toFixed(2)],["Lots with housing",S.resLots],["Median lot sq ft",S.medLot]].forEach(([k,v])=>lines.push(["Summary",k,"value",v]));
  for (const sp of Object.values(st.specs)){
    (sp.rows||[]).forEach(r=>sp.headers.slice(1).forEach((h,j)=>lines.push([sp.title,r[1],h,r[j+2]==null?"":r[j+2].toFixed(2)])));
    (sp.kv||[]).forEach(([k,v])=>lines.push([sp.title,k,"value",plain(v)]));
    (sp.hist||[]).forEach(([d,p])=>lines.push([sp.title,"Built "+d,"% of lots with a year",p.toFixed(2)]));
    (sp.cmpRows||[]).forEach(r=>lines.push([sp.title,r[0],"change",r[3]]));
    (sp.mrows||[]).forEach(r=>sp.mcols.forEach((c,k)=>lines.push([sp.title,r[0],c.name,r[k+1]])));
    (sp.bars||[]).forEach(b=>b.segs.forEach(s=>lines.push([sp.title,s.k,b.name,s.pct.toFixed(2)])));
    (sp.lots||[]).forEach(i=>lines.push([sp.title,st.P.addr[i]||"",`BBL ${Math.round(st.P.bbl[i])}`,`${st.P.units[i]} units; FAR ${fmt(st.P.bfar[i],2)} of ${fmt(st.P.mfar[i],2)}`]));
  }
  download(new Blob([lines.map(l=>l.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")],{type:"text/csv"}),`${slug($("#areaName").textContent)}-${st.P.id}.csv`);
}
function exportPNG(key){
  const sp=st.specs[key], W=760, pies=st.opts.style==="pies"&&sp.charts, rows=sp.rows||[], kv=sp.kv||[], cmp=sp.cmpRows||[];
  const mr=sp.mrows||[], br=sp.bars||[];
  const chartH=sp.charts?(pies?250:70):sp.hist?150:0, H=96+chartH+(rows.length+1)*24+(kv.length+cmp.length)*24+(mr.length?(mr.length+1)*24:0)+br.length*52+40, k=2;
  const cv=document.createElement("canvas"); cv.width=W*k; cv.height=H*k; const g=cv.getContext("2d"); g.scale(k,k);
  const F=(w,s)=>`${w} ${s}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
  g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.fillStyle="#14263B"; g.font=F(700,22); g.fillText(sp.title,28,42);
  g.fillStyle="#5B6B7C"; g.font=F(400,14); g.fillText(`${$("#areaName").textContent}, MapPLUTO ${st.P.id}`,28,66);
  let y=92;
  if (sp.charts&&pies){ const n=sp.charts.length, R=Math.min(95,(W-56)/n/2-14);
    sp.charts.forEach((ch,ci)=>{ const cx=28+(W-56)/n*(ci+.5), cy=y+R+6; let a=-Math.PI/2;
      ch.segs.filter(s=>s.pct>0).forEach(s=>{ const b=a+s.pct/100*2*Math.PI; g.beginPath(); g.moveTo(cx,cy); g.arc(cx,cy,R,a,b); g.closePath(); g.fillStyle=s.c; g.fill(); a=b; });
      g.beginPath(); g.arc(cx,cy,R*.56,0,2*Math.PI); g.fillStyle="#fff"; g.fill();
      g.fillStyle="#5B6B7C"; g.font=F(400,13); g.textAlign="center"; g.fillText(ch.cap,cx,cy+R+22); g.textAlign="left"; }); y+=chartH; }
  else if (sp.charts){ const segs=sp.charts[sp.bar].segs; let x=28; g.fillStyle="#5B6B7C"; g.font=F(400,13); g.fillText(sp.barCap||"",28,y+4);
    segs.forEach(s=>{ const w=(W-56)*s.pct/100; g.fillStyle=s.c; g.fillRect(x,y+14,w,34); x+=w; }); y+=chartH; }
  else if (sp.hist){ const mx=Math.max(1,...sp.hist.map(b=>b[1])), bw=(W-56)/sp.hist.length;
    sp.hist.forEach(([d,p],i)=>{ const h=p/mx*104; g.fillStyle="#7E9CB8"; g.fillRect(28+i*bw+2,y+110-h,bw-4,h);
      g.fillStyle="#5B6B7C"; g.font=F(400,10.5); g.textAlign="center"; g.fillText(d,28+i*bw+bw/2,y+126); g.textAlign="left"; }); y+=chartH; }
  if (rows.length){ g.font=F(700,12.5); g.fillStyle="#5B6B7C"; g.fillText(sp.headers[0],48,y);
    sp.headers.slice(1).forEach((h,j)=>{ g.textAlign="right"; g.fillText(h,W-28-(sp.headers.length-2-j)*90,y); g.textAlign="left"; }); y+=8;
    rows.forEach(r=>{ y+=24; g.fillStyle=r[0]; g.fillRect(28,y-11,12,12); g.fillStyle="#14263B"; g.font=F(400,13.5); g.fillText(r[1],48,y);
      r.slice(2).forEach((v,j)=>{ g.textAlign="right"; g.fillText(v==null?"":fmt(v,1)+"%",W-28-(r.length-3-j)*90,y); g.textAlign="left"; }); }); y+=10; }
  if (mr.length){ const cw=Math.min(120,(W-250)/sp.mcols.length); g.font=F(700,12);
    sp.mcols.forEach((c,ci)=>{ g.textAlign="right"; g.fillStyle=c.color; g.fillText(shortName(c.name).slice(0,16),250+cw*(ci+1),y); }); g.textAlign="left";
    mr.forEach(r=>{ y+=24; g.fillStyle="#14263B"; g.font=F(400,13); g.fillText(r[0],28,y);
      r.slice(1).forEach((v,ci)=>{ g.textAlign="right"; g.fillText(String(v),250+cw*(ci+1),y); g.textAlign="left"; }); }); y+=14; }
  br.forEach(b=>{ y+=18; g.fillStyle=b.color; g.fillRect(28,y-10,10,10); g.fillStyle="#14263B"; g.font=F(700,13); g.fillText(b.name,44,y);
    let x=28; b.segs.forEach(s=>{ const w=(W-56)*s.pct/100; g.fillStyle=s.c; g.fillRect(x,y+8,w,22); x+=w; }); y+=34; });
  [...cmp.map(r=>[r[0],`${r[1]}  →  ${r[2]}  (${r[3]})`]),...kv].forEach(([a,b])=>{ y+=24; g.fillStyle="#14263B"; g.font=F(400,13.5); g.fillText(a,28,y);
    g.font=F(700,13.5); g.textAlign="right"; g.fillText(plain(b),W-28,y); g.textAlign="left"; });
  cv.toBlob(b=>download(b,`${slug($("#areaName").textContent)}-${key}-${st.P.id}.png`));
}

/* ═══ search: address, BBL, borough-block-lot, block, station ══════════ */
function parseLookup(q){
  const s=q.toLowerCase().trim(); if (/^\d{10}$/.test(s)) return {bbl:+s};
  let boro=null, t=s;
  for (const [w,c] of Object.entries(BORO_WORD)){ const re=new RegExp(`^${w}\\b[\\s,-]*`); if (re.test(t)){ boro=c; t=t.replace(re,""); break; } }
  const kw=/\b(block|blk|lot)\b/.test(t);
  t=t.replace(/\b(block|blk|lot)\b\.?/g," ").replace(/[,/-]/g," ").trim();
  if (!/^\d+(\s+\d+){0,2}$/.test(t)) return null;
  const n=t.split(/\s+/).map(Number);
  if (boro==null && n.length===3 && n[0]>=1 && n[0]<=5) boro=n.shift();
  else if (boro==null && n.length===2 && !kw && n[0]>=1 && n[0]<=5 && /^\d[\s\-/]/.test(s)) boro=n.shift();
  if (n.length>2 || n[0]>99999 || (n[1]!=null && n[1]>9999)) return null;
  if (n.length===1 && boro==null && !kw) return null;          // a bare number is more likely part of an address
  return {boro, block:n[0], lot:n[1]};
}
function buildSearch(){
  const inp=$("#q"), res=$("#qres"); let hits=[], cur=-1, t=null;
  const draw=()=>{ res.innerHTML=hits.map((h,k)=>`<li role="option" data-k="${k}" aria-selected="${k===cur}"><span><em>${h.tag}</em>${esc(h.label)}</span><small>${esc(h.sub||"")}</small></li>`).join(""); };
  const P=()=>st.P;
  const go=h=>{ res.innerHTML=""; inp.blur(); h.go(); };
  const lotHit=i=>({tag:"Lot",label:P().addr[i]||"BBL "+Math.round(P().bbl[i]),sub:(()=>{const p=bblParts(P().bbl[i]);return `${BORO[p.boro]} ${p.block}-${p.lot}`;})(),
    go:()=>{ setMode("lot"); select({type:"lots",bbls:[Math.round(P().bbl[i])]},true); }});
  inp.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ const raw=inp.value.trim(), q=raw.toLowerCase().replace(/\s+/g," "); cur=-1; hits=[];
    if (q.length<2){ return draw(); }
    const lk=parseLookup(raw);
    if (lk && lk.bbl){ const i=P().bblIdx.get(lk.bbl); if (i!=null) hits.push(lotHit(i)); }
    else if (lk){ const keys=[...P().blockIdx.keys()].filter(k=>k%1e5===lk.block&&(lk.boro==null||Math.floor(k/1e5)===lk.boro));
      for (const key of keys){
        if (lk.lot!=null){ const bbl=key*1e4+lk.lot, i=P().bblIdx.get(bbl); if (i!=null) hits.push(lotHit(i)); }
        else hits.push({tag:"Block",label:blockName(key),sub:`${fmt(P().blkCount[P().blockIdx.get(key)])} lots`,go:()=>{ setMode("block"); select({type:"blocks",keys:[key]},true); }}); }
      if (!hits.length) hits.push({tag:"None",label:`No ${lk.lot!=null?"lot":"block"} ${lk.block}${lk.lot!=null?"-"+lk.lot:""} in the loaded data`,go:()=>{}}); }
    if (st.T && q.length>=2){ st.T.nameLower.forEach((n,k)=>{ if (hits.length<10 && n.includes(q)){ const s=st.T.stations[k];
      hits.push({tag:"Station",label:s.name,sub:s.routes.join(" "),go:()=>{ map.flyTo({center:[s.lng,s.lat],zoom:16,duration:700}); map.once("moveend",()=>stationPopup(k)); }}); } }); }
    if (q.length>=3){ const A=P().addrLower, starts=[], has=[];
      for (let i=0;i<A.length&&starts.length<8;i++){ const s=A[i]; if(s.startsWith(q)) starts.push(i); else if(has.length<8&&s.includes(q)) has.push(i); }
      starts.concat(has).slice(0,8).forEach(i=>hits.push(lotHit(i))); }
    hits=hits.slice(0,12); draw(); },70); };
  inp.onkeydown=e=>{ if(!hits.length) return;
    if (e.key==="ArrowDown"){ cur=Math.min(hits.length-1,cur+1); draw(); e.preventDefault(); }
    else if (e.key==="ArrowUp"){ cur=Math.max(0,cur-1); draw(); e.preventDefault(); }
    else if (e.key==="Enter") go(hits[Math.max(0,cur)]);
    else if (e.key==="Escape"){ hits=[]; draw(); } };
  res.onmousedown=e=>{ const li=e.target.closest("li"); if(li){ e.preventDefault(); go(hits[+li.dataset.k]); } };
  inp.onblur=()=>setTimeout(()=>{ res.innerHTML=""; },150);
}

function toggleAdd(){ st.addMode=!st.addMode; $("#addBtn").classList.toggle("on",st.addMode); $("#addBtn").setAttribute("aria-pressed",st.addMode);
  if (st.mode==="radius") setMode("radius"); }
/* ═══ boot ═════════════════════════════════════════════════════════════ */
async function boot(){
  try{
    st.releases=window.__LP__?window.__LP__.releases:await (await fetch("data/releases.json")).json();
    if (!st.releases.length) throw new Error("No PLUTO releases found in data/releases.json. Build one with tools/build.py.");
    const h=readHash(), want=st.releases.find(r=>r.id===h.v)||st.releases[st.releases.length-1];
    st.P=await getPack(want.id);
    if (h.c&&h.c!==want.id&&st.releases.some(r=>r.id===h.c)) st.C=await getPack(h.c);
    if (h.m&&VIEW_LABEL[h.m]){ st.colorBy=h.m; $("#colorBy").value=h.m; }
    if (innerWidth<=820) $("#legend").open=false;
    initMap(await loadBaseStyle()); renderTrack(); renderProfile(); wirePanel(); wireOptions(); buildSearch();
    $("#tools").onclick=e=>{ const b=e.target.closest("[data-mode]"); if(b) setMode(b.dataset.mode); };
    $("#hint").onclick=e=>{ const b=e.target.closest("[data-r]"); if(!b) return; st.radiusPreset=+b.dataset.r; setMode("radius"); };
    $("#track").onclick=e=>{ const b=e.target.closest("[data-rel]"); if(b) switchRelease(b.dataset.rel); };
    $("#cmp").onchange=e=>setCompare(e.target.value);
    document.addEventListener("click",e=>{ const w=e.target.closest("[data-walk]"), en=e.target.closest("[data-ent]"), rt=e.target.closest("[data-route]"), o={map:true,add:e.shiftKey};
      if (w) select({type:"walk",sid:w.dataset.walk,m:+w.dataset.m},true,o);
      if (en){ const x=st.T.entrances[+en.dataset.ent], s=st.T.byId.get(x.sid), m=+en.dataset.m;
        select({type:"radius",c:[x.lng,x.lat],m,label:`Within ${miles(m)} of an entrance to ${s.name}`},true,o); }
      if (rt){ const r=rt.dataset.route, [[x0,y0],[x1,y1]]=st.P.bbox, pad=0.012;
        const near=st.T.stations.filter(s=>s.routes.includes(r)&&s.lng>x0-pad&&s.lng<x1+pad&&s.lat>y0-pad&&s.lat<y1+pad);
        if (!near.length) return;
        const keep=(st.addMode||e.shiftKey)?st.sels.map(x=>x.sel):[];
        if (popup) popup.remove(); restore(keep.concat(near.map(s=>({type:"walk",sid:s.id,m:804.7}))),"all",true,true); } });
    $("#addBtn").onclick=()=>toggleAdd();
    $("#satBtn").onclick=()=>{ st.map.basemap=st.map.basemap==="sat"?"map":"sat"; applyMapOpts(); };
    $("#basemap").onchange=e=>{ st.map.basemap=e.target.value; applyMapOpts(); };
    addEventListener("keydown",e=>{ if (e.target.matches("input,select,textarea")) return;
      if ((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==="z"||e.key.toLowerCase()==="y")){ e.preventDefault();
        return (e.key.toLowerCase()==="y"||e.shiftKey) ? redo() : undo(); }
      if (e.key==="Escape"){ if(st.mode==="poly"||st.mode==="radius") setMode("area"); else if(popup) popup.remove(); }
      else if (e.key==="Enter"&&st.mode==="poly") finishPoly(e.shiftKey);
      else if ((e.key==="["||e.key==="]") && st.sels.length>1){ const seq=["all","cmp",...st.sels.map((_,k)=>k)], at=seq.indexOf(st.view); setView(seq[(at+(e.key==="]"?1:seq.length-1))%seq.length]); }
      else if (e.key==="+"||e.key==="=") toggleAdd();
      else { const m={l:"lot",b:"block",n:"area",a:"area",t:"tract",d:"poly",r:"radius"}[e.key.toLowerCase()]; if(m&&!e.metaKey&&!e.ctrlKey) setMode(m); } });
    if (h.sels.length) map.once("load",()=>restore(h.sels,h.view,true));
    writeHash();
    loadTransit().catch(err=>{ console.warn("transit:",err); $("#subStatus").textContent=`Subway data didn't load (${err.message}). Run python tools/transit.py to bundle it with the site.`; });
  }catch(err){
    console.error(err); $("#loading").hidden=false;
    $("#loading").innerHTML=`<div style="max-width:420px;text-align:center;line-height:1.5"><b>The lot data didn't load.</b><br>${esc(err.message)}</div>`;
  }
}
boot();
