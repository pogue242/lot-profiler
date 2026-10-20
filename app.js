"use strict";

const LU_COLORS = ["#FEFFA8","#FCB842","#B16E00","#FF8341","#FC2929","#E362FB",
                   "#E0BEEB","#44A3D5","#78D271","#BAB8B6","#555555","#E7E7E7"];
const LU_NAMES = ["One & Two Family Buildings","Multi-Family Walk-Up Buildings","Multi-Family Elevator Buildings","Mixed Residential & Commercial Buildings",
  "Commercial & Office Buildings","Industrial & Manufacturing","Transportation & Utility","Public Facilities & Institutions","Open Space & Outdoor Recreation",
  "Parking Facilities","Vacant Land","Other"];
const FC_COLORS = ["#0B5D3B","#4E9C55","#AFC97E","#E7C463","#BE3E32","#95A0AE","#D9D6CB","#C4CAD1"];
const LOT_MINZOOM = 14;
const LOT_ZOOMS = [14,13,12];
const LOT_DEFAULT = matchMedia("(pointer:coarse)").matches||innerWidth<=820?14:12;

const UB_RAMP   = ["#DCE8F5","#B7D2EC","#8FB9E2","#639CD4","#3D7EC0","#2763A4","#174C86","#0C3765","#062647"];
const UB_RANGE  = [[1,1],[2,2],[3,3],[4,4],[5,9],[10,19],[20,49],[50,99],[100,null]];
const UB_STARTS = [1,2,3,4,5,10,20,50,100];
const YB_CLASSES = [["Before 1900",0,1900,"#243A73"],["1900–1929",1900,1930,"#2F78B0"],
  ["1930–1960",1930,1961,"#4FB3BF"],["1961–1989",1961,1990,"#A6D8A8"],["1990 or later",1990,9999,"#EEDC5B"]];
const DECADES = ["<1900","1900s","1910s","1920s","1930s","1940s","1950s","1960s","1970s","1980s","1990s","2000s","2010s","2020s"];

const SCHEMES = {
  blues:{name:"Blues", c:["#EFF5FB","#D2E3F3","#B2CFEA","#8BB6DD","#5F98CC","#3B79B6","#24609D","#164A80","#0B3566"]},
  greens:{name:"Greens", c:["#F7FCF5","#E5F5E0","#C7E9C0","#A1D99B","#74C476","#41AB5D","#238B45","#006D2C","#00441B"]},
  ylgnbu:{name:"Yellow–green–blue", c:["#FFFFD9","#EDF8B1","#C7E9B4","#7FCDBB","#41B6C4","#1D91C0","#225EA8","#253494","#081D58"]},
  ylorrd:{name:"Yellow–orange–red", c:["#FFFFCC","#FFEDA0","#FED976","#FEB24C","#FD8D3C","#FC4E2A","#E31A1C","#BD0026","#800026"]},
  viridis:{name:"Viridis", c:["#FDE725","#B5DE2B","#6ECE58","#35B779","#1F9E89","#26828E","#31688E","#3E4989","#482878"]},
  magma:{name:"Magma", c:["#FCFDBF","#FEC287","#FB8761","#E55064","#B5367A","#822681","#4F127B","#1D1147","#000004"]},
  spectral:{name:"Spectral (most contrast)", c:["#5E4FA2","#3288BD","#66C2A5","#ABDDA4","#E6F598","#FEE08B","#FDAE61","#F46D43","#D53E4F"]},
  distinct:{name:"Distinct colors", c:["#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F","#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC"]}};
const LU_SCHEMES={standard:[...LU_COLORS], muted:["#F7E08A","#F2A93B","#C4692A","#EC7B62","#C8323B","#9A6FAA","#B8B2CC","#5B93C4","#77B36B","#C9C9C0","#80807A","#DEDBD2"]};
const UB_BASE=[...UB_RAMP], YB_BASE=YB_CLASSES.map(c=>c[3]), FC_BASE=[...FC_COLORS];
const schemeDefault=v=>v==="lu"?"standard":"spectral";
const schemeOf=v=>(st.colors.scheme[v]||schemeDefault(v));
const hasStandard=v=>["yb","fc","zn","fd"].includes(v);
const schemeChoices=v=>v==="lu"?[["standard","Official (ZoLa)"],["muted","Muted"]]:v==="dq"?[]:[...(hasStandard(v)?[["standard","Standard"]]:[]),
  ...Object.entries(SCHEMES).filter(([k])=>v==="zn"?["distinct","spectral","viridis","ylorrd"].includes(k):(k!=="distinct"||CAT_VIEWS.has(v)||v==="yb")).map(([k,x])=>[k,x.name])];
const sample=(c,n,cyc)=>!cyc&&c.length>=n&&n>1?Array.from({length:n},(_,i)=>c[Math.round(i*(c.length-1)/(n-1))]):Array.from({length:n},(_,i)=>c[i%c.length]);
const FL_CLASSES=[["1 floor",1],["2 floors",2],["3 floors",3],["4–5 floors",4],["6–9 floors",6],["10–19 floors",10],["20–39 floors",20],["40 floors or more",40]];
const FL_BASE=sample(SCHEMES.spectral.c,8), FL_COLORS=[...FL_BASE];
const flClass=f=>f>0?FL_CLASSES.reduce((k,c,j)=>f>=c[1]?j:k,0):8;
const flClassExpr=x=>["step",x,8,...FL_CLASSES.flatMap((c,j)=>[c[1],j])];
const strHash=t=>{ let h=0; for (const ch of String(t)) h=(h*31+ch.charCodeAt(0))|0; return Math.abs(h); };
const RAMPS = {blues:["#EEF4FA","#C3DAEE","#86B6DC","#4A8CC6","#1F5E9E","#0B3566"],
  greens:["#F1F8EC","#C8E6B5","#8FCB7F","#4EA65A","#20793A","#0B4A24"],
  viridis:["#440154","#414487","#2A788E","#22A884","#7AD151","#FDE725"],
  magma:["#FCFDBF","#FE9F6D","#DE4968","#8C2981","#3B0F70","#000004"]};
const RANGE_DEFAULT = {bf:[0,4], mf:[0,6], fd:[-1,3]};
const VIEW_LABEL = {fl:"Floors",dq:"PLUTO data issues",lu:"Land use",ub:"Units per building",zn:"Zoning district",fc:"FAR capacity category",
  bf:"Built FAR",mf:"Maximum FAR",fd:"Unused FAR (maximum minus built)",yb:"Year built"};
const CAT_VIEWS = new Set(["lu","ub","fc","zn","dq","fl"]);
const DQ_NAMES=["No issue found","Lot area smaller than the outline","Lot area larger than the outline","Built FAR above the floor count","Very high built FAR (outside Manhattan)","Unit count doesn't fit the lot"];
const DQ_COLORS=["#E6E9ED","#D7301F","#7B3294","#F08C00","#1C6FB8","#12946F"];
const DQ_FLAG_TEXT={2:"housing units but no building floor area",4:"housing units on vacant land, parking or open space",8:"under 250 sq ft of residential floor area per unit",16:"a one-family building class with 3 or more units"};
const FAR_VIEWS = new Set(["mf","fd","fc"]);
const isFarView = v => FAR_VIEWS.has(v) || /^[bg]_/.test(v);
const NOT_YET = "Not yet calculated for this release";
const NODATA = "#D5D9DD";
const SIZES = {s:["24px","118px"], m:["38px","168px"], l:["56px","228px"]};
const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
const GLYPHS_FALLBACK = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const NYC_BOX = [-74.27, 40.49, -73.68, 40.92];
const SEL_COLORS = ["#14263B","#D1495B","#1B62A5","#2A9D8F","#E08A1E","#7B4FA0","#3C8D2F","#C45BAA"];
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
const pctT = v => v==null||Number.isNaN(v) ? "—" : fmt(v,1)+"%";
const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const bullet = r => `<span class="rb${MTA[r]==="#FCCC0A"?" dark":""}" style="background:${MTA[r]||"#808183"}">${esc(r)}</span>`;

const st = {
  releases:[], packs:new Map(), P:null, C:null, T:null, sels:[], view:"all", addMode:false, addTo:null, combine:null, prevSel:null, pending:null,
  mode:"view", peek:null, ownerShown:new Set(), colorBy:"lu", radiusPreset:0, clip:"touch", base:null, curIdx:null,
  opts:{style:"pies", size:"s", luExcl:new Set(), boroExcl:new Set(), dq:{mode:"pluto",areaPct:25,farMax:10}, div:Array(8).fill(true), sort:{}, shut:new Set(), hideCat:{},
        order:["lu","ub","fc","age","zone","list"]},
  map:{lotZ:(()=>{ try{ const z=+localStorage.getItem("lp-lot-zoom"); return LOT_ZOOMS.includes(z)?z:LOT_DEFAULT; }catch(_){ return LOT_DEFAULT; } })(), blockAgg:{cat:"area",num:"mean",yb:"median",fl:"area"},
       opacity:0.85, fill:true, lotLines:true, labels:true, basemap:"map", ntas:true, tracts:false, dim:true,
       hidden:{lu:new Set(),ub:new Set(),fc:new Set(),zn:new Set(),dq:new Set(),fl:new Set()}, range:{...RANGE_DEFAULT}, ramp:"blues",
       ntaNames:true, sub:{lines:true, rail:true, stations:true, names:false, entrances:true, platforms:true}, rings:0,
       zon:{zd:false, co:false, sp:false, ss:false, lh:false, labels:true}},
  specs:{},
};
st.colors=loadColors(); applyColors();

Object.defineProperty(st,"sel",{get(){ const S=st.sels; if (!S.length) return null; if (S.length===1) return S[0].sel;
  if (typeof st.view==="number" && S[st.view]) return S[st.view].sel; return {type:"multi",parts:S.map(e=>e.sel)}; }});
let map, markers=[], stMarkers=new Map();

const EMB = window.__LP__ && window.__LP__.files || null;
const relDir = rel => "data/"+(rel.dir||rel.id)+"/";
function embBytes(path){ const v=EMB[path]; if (v==null) return null; if (v instanceof Uint8Array) return v;
  const bin=atob(v), u=new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return EMB[path]=u; }
async function fetchBytes(path){
  if (EMB){ const u=embBytes(path); if (!u) throw new Error(`${path} isn't bundled in this file.`); return u; }
  const r=await fetch(path); if (!r.ok) throw new Error(`Couldn't load ${path} (HTTP ${r.status}).`);
  return new Uint8Array(await r.arrayBuffer());
}
const wholeFile=new Map();
async function fetchRange(path, a, b){
  if (EMB) return embBytes(path).subarray(a,b);
  if (wholeFile.has(path)) return (await wholeFile.get(path)).subarray(a,b);
  const r=await fetch(path,{headers:{Range:`bytes=${a}-${b-1}`}});
  if (!r.ok) throw new Error(`Couldn't read ${path} (HTTP ${r.status}).`);
  if (r.status===200){ const p=r.arrayBuffer().then(x=>new Uint8Array(x)); wholeFile.set(path,p); return (await p).subarray(a,b); }
  return new Uint8Array(await r.arrayBuffer());
}
async function inflate(u, fmt){
  if (!("DecompressionStream" in window)) throw new Error("This browser can't unpack the data. Use a current Chrome, Safari (16.4+), Firefox or Edge.");
  return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream(fmt))).arrayBuffer());
}
const gunzip = u => u[0]===0x1f&&u[1]===0x8b ? inflate(u,"gzip") : u;
const DT = {i4:Int32Array,u4:Uint32Array,u2:Uint16Array,u1:Uint8Array,f4:Float32Array,f8:Float64Array};
function unpack(u, magic){
  if (String.fromCharCode(u[0],u[1],u[2],u[3])!==magic) throw new Error("Unrecognized data file (expected "+magic+").");
  const hl=u[4]|u[5]<<8|u[6]<<16|u[7]<<24, H=JSON.parse(new TextDecoder().decode(u.subarray(8,8+hl)));
  const base=Math.ceil((8+hl)/8)*8, buf=u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength), S={};
  for (const [name,[t,off,count]] of Object.entries(H.sections)) S[name]=new DT[t](buf,base+off,count);
  return {H,S};
}
const MLAT=110574, mlng=lat=>111320*Math.cos(lat*Math.PI/180), KX=mlng(40.7);
const eLat=lat=>{ const f=lat*Math.PI/180; return 111132.92-559.82*Math.cos(2*f)+1.175*Math.cos(4*f); }, eLng=lat=>{ const f=lat*Math.PI/180; return 111412.84*Math.cos(f)-93.5*Math.cos(3*f); };
const GRID=0.0025;
const BIG_LOT=250;
function decodeCore(u, rel){
  const {H,S}=unpack(u,"LPK3"), n=H.n, [ox,oy]=H.origin, q=H.q;
  const P={id:H.release, rel, dir:relDir(rel), n, dict:{...H.dict, lu:H.dict&&H.dict.lu&&H.dict.lu.length===12?LU_NAMES:(H.dict||{}).lu}, areas:H.areas, origin:H.origin, q, H, chunk:H.chunk, files:H.files,
    recFields:H.recFields||[], area:S.area, units:S.units, year:S.year, lu:S.lu, ub:S.ub, zone:S.zone, nta:S.nta, tract:S.tract,
    blk:S.blk, floors:S.floors||null, box:S.box, gOff:S.gOff, bOff:S.bOff, rOff:S.rOff, addr:null, addrLower:null,
    gCache:new Map(), bCache:new Map(), rCache:new Map(), loading:new Map()};
  if (H.bfarScale){ P.bfar=new Float32Array(n); const k=1/H.bfarScale; for (let i=0;i<n;i++){ const v=S.bfar[i]; P.bfar[i]=v===65535?NaN:v*k; } }
  else P.bfar=S.bfar;
  P.lng=new Float64Array(n); P.lat=new Float64Array(n);
  let x=0,y=0,x0=180,y0=90,x1=-180,y1=-90;
  for (let i=0;i<n;i++){ x+=S.dcx[i]; y+=S.dcy[i]; const a=P.lng[i]=ox+x/q, b=P.lat[i]=oy+y/q;
    if(a<x0)x0=a; if(a>x1)x1=a; if(b<y0)y0=b; if(b>y1)y1=b; }
  P.bbox=[[x0,y0],[x1,y1]];
  P.blocks=Array.from(S.blkKey,key=>({key}));
  P.bbl=new Float64Array(n); let sorted=true;
  for (let i=0;i<n;i++){ const b=P.bbl[i]=S.blkKey[P.blk[i]]*1e4+S.lotno[i]; if (i&&b<P.bbl[i-1]) sorted=false; }
  P.bblIdx=bblIndex(P.bbl,sorted);
  P.areaIdx=new Map(P.areas.map((a,i)=>[a.kind+":"+a.code,i]));
  P.blockIdx=new Map(P.blocks.map((b,j)=>[b.key,j]));
  [P.blkStart,P.blkLots]=csr(P.blk,P.blocks.length,n);
  P.blkCount=new Uint32Array(P.blocks.length); for (let j=0;j<P.blocks.length;j++) P.blkCount[j]=P.blkStart[j+1]-P.blkStart[j];
  P.mfar=new Float32Array(n).fill(NaN); P.fdiff=new Float32Array(n).fill(NaN); P.fc=new Uint8Array(n).fill(255); P.far=null;
  buildGrid(P);
  return P;
}

function bblIndex(bbl, sorted){
  const n=bbl.length, ord=sorted?null:Uint32Array.from({length:n},(_,i)=>i).sort((a,b)=>bbl[a]-bbl[b]);
  const at=k=>ord?bbl[ord[k]]:bbl[k];
  return {get(b){ let lo=0, hi=n-1; while (lo<=hi){ const m=(lo+hi)>>1, v=at(m); if (v===b) return ord?ord[m]:m; if (v<b) lo=m+1; else hi=m-1; } return undefined; }};
}

function csr(key, k, n){ const start=new Uint32Array(k+2), out=new Uint32Array(n);
  for (let i=0;i<n;i++) if (key[i]<k) start[key[i]+2]++;
  for (let j=2;j<k+2;j++) start[j]+=start[j-1];
  for (let i=0;i<n;i++){ const v=key[i]; if (v<k) out[start[v+1]++]=i; }
  return [start.subarray(0,k+1),out]; }
function areaLots(P, kind){ const key=kind+"Lots"; if (!P[key]) P[key]=csr(kind==="nta"?P.nta:P.tract,P.areas.length,P.n); return P[key]; }

function buildGrid(P){
  const n=P.n, [ox,oy]=P.origin, u=P.H.boxUnit||1e-5, B=P.box;
  P.X=new Float32Array(n); P.Y=new Float32Array(n); P.lotBox=new Float32Array(n*4); P.lotRad=new Float32Array(n);
  const gx0=Math.floor(P.bbox[0][0]/GRID), gy0=Math.floor(P.bbox[0][1]/GRID);
  const W=Math.floor(P.bbox[1][0]/GRID)-gx0+1, Hh=Math.floor(P.bbox[1][1]/GRID)-gy0+1, cell=new Uint32Array(n), big=[];
  for (let i=0;i<n;i++){ const X=P.X[i]=(P.lng[i]-ox)*KX, Y=P.Y[i]=(P.lat[i]-oy)*MLAT;
    const w=B[4*i]*u*KX, s=B[4*i+1]*u*MLAT, e=B[4*i+2]*u*KX, nn=B[4*i+3]*u*MLAT, o=4*i;
    P.lotBox[o]=X-w; P.lotBox[o+1]=Y-s; P.lotBox[o+2]=X+e; P.lotBox[o+3]=Y+nn;
    const r=P.lotRad[i]=Math.hypot(Math.max(w,e),Math.max(s,nn));
    if (r>BIG_LOT){ big.push(i); cell[i]=W*Hh; }
    else cell[i]=(Math.floor(P.lat[i]/GRID)-gy0)*W+(Math.floor(P.lng[i]/GRID)-gx0); }
  [P.gStart,P.gLots]=csr(cell,W*Hh,n);
  Object.assign(P,{gx0,gy0,gW:W,gH:Hh,big:Uint32Array.from(big)});
}

function lotsNear(P, x0, y0, x1, y1){
  const pad=BIG_LOT/MLAT*1.2, padx=BIG_LOT/KX*1.2, out=[];
  const a=Math.max(0,Math.floor((x0-padx)/GRID)-P.gx0), b=Math.min(P.gW-1,Math.floor((x1+padx)/GRID)-P.gx0);
  const c=Math.max(0,Math.floor((y0-pad)/GRID)-P.gy0), d=Math.min(P.gH-1,Math.floor((y1+pad)/GRID)-P.gy0);
  for (let gy=c;gy<=d;gy++) for (let gx=a;gx<=b;gx++){ const k=gy*P.gW+gx; for (let t=P.gStart[k];t<P.gStart[k+1];t++) out.push(P.gLots[t]); }
  for (const i of P.big) out.push(i);
  return out;
}
const toM=(P,lng,lat)=>[(lng-P.origin[0])*KX,(lat-P.origin[1])*MLAT];

function decodeShapes(u, count, P){
  let p=0; const q=P.q, oxq=Math.round(P.origin[0]*q), oyq=Math.round(P.origin[1]*q), out=new Array(count);
  const rd=()=>{ let v=0,m=1,b; do{ b=u[p++]; v+=(b&127)*m; m*=128; }while(b&128); return v; };
  const zz=v=>v%2?-(v+1)/2:v/2;
  for (let k=0;k<count;k++){ let x=oxq,y=oyq; const np=rd(), polys=new Array(np);
    for (let a=0;a<np;a++){ const nr=rd(), rings=new Array(nr);
      for (let r=0;r<nr;r++){ const nv=rd(), ring=new Array(nv+1);
        for (let v=0;v<nv;v++){ x+=zz(rd()); y+=zz(rd()); ring[v]=[x/q,y/q]; }
        ring[nv]=ring[0]; rings[r]=ring; }
      polys[a]=rings; }
    out[k]=polys; }
  return out;
}

function loadChunks(P, kind, list){
  const cache=kind==="g"?P.gCache:P.bCache, offs=kind==="g"?P.gOff:P.bOff, total=kind==="g"?P.n:P.blocks.length;
  const uniq=[...new Set(list)];
  const want=uniq.filter(c=>!cache.has(c)&&!P.loading.has(kind+c)).sort((a,b)=>a-b);
  const waits=uniq.map(c=>P.loading.get(kind+c)).filter(Boolean);
  const runs=[]; for (const c of want){ const r=runs[runs.length-1]; if (r && offs[c]-offs[r.b+1]<=65536) r.b=c; else runs.push({a:c,b:c}); }
  for (const r of runs){
    const job=fetchRange(P.dir+P.files.geom, offs[r.a], offs[r.b+1]).then(async bytes=>{
      const base=offs[r.a];
      await Promise.all(Array.from({length:r.b-r.a+1},async(_,k)=>{ const c=r.a+k;
        const raw=await inflate(bytes.subarray(offs[c]-base,offs[c+1]-base),"deflate-raw");
        cache.set(c,decodeShapes(raw,Math.min(P.chunk,total-c*P.chunk),P)); }));
    }).finally(()=>{ for (let c=r.a;c<=r.b;c++) P.loading.delete(kind+c); });
    for (let c=r.a;c<=r.b;c++) P.loading.set(kind+c,job);
    waits.push(job);
  }
  return Promise.all(waits);
}

const PREFETCH_ALL=3e6, PREFETCH_MAXCHUNKS=120;
function prefetchGeom(P){
  if (!P||P!==st.P||!map) return;
  const total=P.gOff[P.gOff.length-1];
  if (total<=PREFETCH_ALL){ if (!P.allGeom){ P.allGeom=true; loadChunks(P,"g",Array.from({length:P.gOff.length-1},(_,c)=>c)).catch(()=>{ P.allGeom=false; }); } return; }
  if (map.getZoom()<LOT_MINZOOM+0.5) return;
  const b=map.getBounds(), want=new Set();
  for (const i of lotsNear(P,b.getWest(),b.getSouth(),b.getEast(),b.getNorth())){ const c=Math.floor(i/P.chunk); if (!P.gCache.has(c)) want.add(c); if (want.size>PREFETCH_MAXCHUNKS) return; }
  if (want.size) loadChunks(P,"g",[...want]).catch(()=>{});
}
const geomOf=(P,i)=>{ const c=P.gCache.get(Math.floor(i/P.chunk)); return c?c[i%P.chunk]:null; };
const blockGeomOf=(P,j)=>{ const c=P.bCache.get(Math.floor(j/P.chunk)); return c?c[j%P.chunk]:null; };
const needLots=(P,ids)=>loadChunks(P,"g",ids.map(i=>Math.floor(i/P.chunk)));
const needBlocks=(P,ids)=>loadChunks(P,"b",ids.map(j=>Math.floor(j/P.chunk)));

function recChunk(cache, path, offs, c){
  if (cache.has(c)) return cache.get(c);
  const p=fetchRange(path,offs[c],offs[c+1]).then(b=>inflate(b,"deflate-raw")).then(u=>JSON.parse(new TextDecoder().decode(u)));
  cache.set(c,p); p.then(v=>cache.set(c,v)).catch(()=>cache.delete(c)); return p;
}

function recOf(P, i, then){
  const c=Math.floor(i/P.chunk), v=P.rCache.get(c);
  if (v && !(v instanceof Promise)){ const k=i%P.chunk, o={}; for (const f in v) o[f]=v[f][k];
    if (P.far && P.far.rOff){ const w=P.far.rCache.get(c);
      if (w && !(w instanceof Promise)) for (const f in w) o[f]=w[f][k];
      else { recChunk(P.far.rCache,P.dir+P.far.H.rec,P.far.rOff,c).then(()=>then&&then()).catch(err=>console.warn("FAR trace:",err)); o._farPending=true; } }
    return o; }
  recChunk(P.rCache,P.dir+P.files.rec,P.rOff,c).then(()=>then&&then()).catch(err=>console.warn("lot record:",err)); return null;
}

async function loadAddr(P){
  const u=await gunzip(await fetchBytes(P.dir+P.files.addr));
  P.addr=new TextDecoder().decode(u).split("\n"); P.addrLower=P.addr.map(s=>s.toLowerCase());
}
async function loadAreas(P){
  const u=await gunzip(await fetchBytes(P.dir+P.files.areas)), A=JSON.parse(new TextDecoder().decode(u));
  for (const a of P.areas) a.polys=(A[a.kind]||{})[a.code]||[];
  P.areasLoaded=true;
}

async function loadFar(P){
  const {H,S}=unpack(await gunzip(await fetchBytes(P.dir+P.rel.far.file)),"LPF1");
  P.far={H, cols:H.columns, base:H.base, status:S.status, rOff:S.rOff||null, rCache:new Map(), data:{}};
  for (const c of H.columns) P.far.data[c.key]=S[c.key];
  P.mfar=S[H.base]; P.fdiff=S.fdiff; P.fc=S.fc; P.dict={...P.dict, fc:H.cats||P.dict.fc};
}
async function loadQA(P){
  const {H,S}=unpack(await gunzip(await fetchBytes(P.dir+P.rel.qa.file)),"LPQ1"), pos=new Int32Array(P.n).fill(-1);
  S.idx.forEach((i,k)=>pos[i]=k); P.qa={H, idx:S.idx, outA:S.outA, flags:S.flags, pos};
}
function dqIssues(P,i){
  const o=st.opts.dq, out=[], k=P.qa?P.qa.pos[i]:-1;
  if (k>=0){ const la=P.area[i], oa=P.qa.outA[k], t=1+o.areaPct/100, f=P.qa.flags[k];
    if (la>0&&oa>la*t) out.push(1); else if (la>0&&oa*t<la) out.push(2);
    if (f&1) out.push(3); if (f&30) out.push(5); }
  if (Math.floor(P.bbl[i]/1e9)!==1&&P.bfar[i]>o.farMax) out.push(4);
  return out;
}
function dqAll(P){
  const key=JSON.stringify([st.opts.dq.areaPct,st.opts.dq.farMax,!!P.qa]);
  if (P.dqCodes&&P.dqKey===key) return P.dqCodes;
  const c=new Uint8Array(P.n), cand=new Set(P.qa?P.qa.idx:[]);
  for (let i=0;i<P.n;i++) if (P.bfar[i]>st.opts.dq.farMax) cand.add(i);
  for (const i of cand){ const x=dqIssues(P,i); if (x.length) c[i]=x[0]; }
  P.dqCodes=c; P.dqKey=key; return c;
}
function dqLotExpr(){
  const c=dqAll(st.P), G=[[],[],[],[],[],[]], H=st.map.hidden.dq; for (let i=0;i<c.length;i++) if (c[i]) G[c[i]].push(i);
  const e=["match",["get","i"]]; for (let k=1;k<6;k++) if (G[k].length) e.push(G[k],H.has(k)?CLEAR:DQ_COLORS[k]);
  return e.length>2?[...e,H.has(0)?CLEAR:DQ_COLORS[0]]:(H.has(0)?CLEAR:DQ_COLORS[0]);
}
const dqModeText=m=>({pluto:"as published",fix:"recomputed where the outline shows PLUTO's lot area is off",exclude:"with flagged lots left out"})[m];
const niceAddr=a=>a?a.toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g,(m,p,c)=>p+c.toUpperCase()):"";
const addrOf=(P,i)=>P.addr?niceAddr(P.addr[i]):"";
async function getPack(id){
  if (!st.packs.has(id)){ const rel=st.releases.find(r=>r.id===id);
    const job=(async()=>{
      const P=decodeCore(await gunzip(await fetchBytes(relDir(rel)+"core.lpk")),rel);
      if (rel.far) await loadFar(P).catch(err=>{ console.warn("FAR table:",err); P.farError=err.message; });
      if (rel.qa) P.qaReady=loadQA(P).then(()=>{ P.dqKey=""; if (P===st.P){ if (st.colorBy==="dq"){ restyleLots(true); } renderProfile(); } }).catch(err=>console.warn("data issues:",err));
      P.addrReady=new Promise(r=>setTimeout(r,map?0:400)).then(()=>loadAddr(P)).then(()=>onAddr(P)).catch(err=>console.warn("addresses:",err));
      P.areasReady=loadAreas(P).then(()=>onAreas(P)).catch(err=>console.warn("areas:",err));
      return P; })();
    st.packs.set(id,job); job.catch(()=>st.packs.delete(id)); }
  return st.packs.get(id);
}
function onAddr(P){ if (P===st.P) renderProfile(); }
function onAreas(P){ if (P!==st.P||!map||!map.getSource("ntas")) return;
  map.getSource("ntas").setData(areasGeoJSON(P,"nta")); map.getSource("tracts").setData(areasGeoJSON(P,"tract")); drawSelection(); }
function areasGeoJSON(P, kind){
  return {type:"FeatureCollection", features:P.areas.map((a,i)=>a.kind!==kind||!a.polys?null:({type:"Feature",id:i,
    properties:{i,name:a.name}, geometry:{type:"MultiPolygon",coordinates:a.polys}})).filter(Boolean)};
}
function areaLabelsGeoJSON(P){
  return {type:"FeatureCollection", features:P.areas.filter(a=>a.kind==="nta"&&a.label).map(a=>({type:"Feature",properties:{name:a.name},geometry:{type:"Point",coordinates:a.label}}))};
}
const bblParts = bbl => { const b=Math.round(bbl); return {boro:Math.floor(b/1e9), block:Math.floor(b/1e4)%1e5, lot:b%1e4}; };
const blockName = key => `${BORO[Math.floor(key/1e5)]||"Borough "+Math.floor(key/1e5)} block ${key%1e5}`;

const distM=(a,b)=>Math.hypot((a[0]-b[0])*mlng((a[1]+b[1])/2),(a[1]-b[1])*MLAT);
function circle(c,m,n=96){ const kx=mlng(c[1]),o=[]; for(let i=0;i<=n;i++){const t=i/n*2*Math.PI; o.push([c[0]+Math.cos(t)*m/kx,c[1]+Math.sin(t)*m/MLAT]);} return o; }
function inRing(x,y,ring){ let s=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){ const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi) s=!s; } return s; }

function starUnion(pts, m, n=180){
  const c=[pts.reduce((a,p)=>a+p[0],0)/pts.length, pts.reduce((a,p)=>a+p[1],0)/pts.length], kx=mlng(c[1]);
  const Q=pts.map(([x,y])=>[(x-c[0])*kx,(y-c[1])*MLAT]), ring=[];
  for (let k=0;k<=n;k++){ const t=k/n*2*Math.PI, ux=Math.cos(t), uy=Math.sin(t); let best=0;
    for (const [px,py] of Q){ const b=ux*px+uy*py, d=m*m-(px*px+py*py)+b*b; if (d>=0){ const te=b+Math.sqrt(d); if(te>best) best=te; } }
    ring.push([c[0]+ux*best/kx, c[1]+uy*best/MLAT]); }
  return ring;
}

const CLIP_NAME={touch:"Intersecting",center:"Centroid within",most:"Majority within",all:"Fully within"};
const CLIP_DESC={touch:"Any portion of the lot lies within the boundary.",
  center:"The lot's centroid lies within the boundary.",
  most:"At least 50% of the lot's area lies within the boundary.",
  all:"The entire lot lies within the boundary."};
const CLIP_PHRASE={touch:"intersecting",center:"with centroids within",most:"at least 50% within",all:"fully within"};
const CLIP_CODE={touch:"t",center:"c",most:"m",all:"e"}, CLIP_FROM=Object.fromEntries(Object.entries(CLIP_CODE).map(([k,v])=>[v,k]));
const clipOf=sel=>sel.type==="group"?(sel.parts.find(p=>isShape(p))||{}).clip||"center":sel.clip||"center";
function shapeAcres(sel){
  const C=[], Pg=[], add=x=>{ if (x.type==="radius") C.push([x.c[0],x.c[1],x.m]); else if (x.type==="walk") walkPts(x.sid).forEach(q=>C.push([q[0],q[1],x.m])); else if (x.type==="poly") Pg.push(x.ring); };
  (sel.type==="group"?sel.parts:[sel]).forEach(add); if (!C.length&&!Pg.length) return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; const ox=(C[0]||Pg[0][0])[0], oy=(C[0]||Pg[0][0])[1], kx=eLng(oy), ky=eLat(oy);
  const cs=C.map(([x,y,m])=>[(x-ox)*kx,(y-oy)*ky,m]), ps=Pg.map(r=>r.map(([x,y])=>[(x-ox)*kx,(y-oy)*ky]));
  cs.forEach(([x,y,m])=>{ x0=Math.min(x0,x-m); x1=Math.max(x1,x+m); y0=Math.min(y0,y-m); y1=Math.max(y1,y+m); });
  ps.forEach(r=>r.forEach(([x,y])=>{ x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); }));
  const N=150, dx=(x1-x0)/N, dy=(y1-y0)/N; let hit=0;
  for (let i=0;i<N;i++) for (let j=0;j<N;j++){ const x=x0+(i+.5)*dx, y=y0+(j+.5)*dy;
    if (cs.some(([cx,cy,m])=>(x-cx)**2+(y-cy)**2<=m*m)||ps.some(r=>inRing(x,y,r))) hit++; }
  return hit*dx*dy/4046.856;
}
const isShape=sel=>sel&&(sel.type==="radius"||sel.type==="walk"||sel.type==="poly");
const clippable=sel=>isShape(sel)||(sel&&sel.type==="group"&&sel.parts.some(isShape));
const clipsIn=sel=>sel.type==="group"?[...new Set(sel.parts.filter(isShape).map(p=>p.clip||"center"))]:[clipOf(sel)];

function lotRingsM(P,i){ const g=geomOf(P,i); if (!g) return null; const [ox,oy]=P.origin;
  return g.map(poly=>poly.map(r=>r.map(([x,y])=>[(x-ox)*KX,(y-oy)*MLAT]))); }
function inLotM(polys,x,y){ for (const poly of polys){ if (!inRing(x,y,poly[0])) continue; let hole=false; for (let h=1;h<poly.length;h++) if (inRing(x,y,poly[h])){ hole=true; break; } if (!hole) return true; } return false; }
function ringArea(r){ let a=0; for (let i=0,j=r.length-1;i<r.length;j=i++) a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]); return Math.abs(a)/2; }
const lotAreaM=polys=>polys.reduce((a,poly)=>a+ringArea(poly[0])-poly.slice(1).reduce((b,h)=>b+ringArea(h),0),0);
function segDist(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy, t=L?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L)):0; return Math.hypot(px-ax-t*dx,py-ay-t*dy); }
function edgeDist(polys,x,y){ let d=Infinity; for (const poly of polys) for (const r of poly) for (let i=1;i<r.length;i++){ const e=segDist(x,y,r[i-1][0],r[i-1][1],r[i][0],r[i][1]); if(e<d) d=e; } return d; }
function clipConvex(ring, clip){
  let out=ring.slice(0,-1);
  for (let k=0;k<clip.length-1&&out.length;k++){ const [ax,ay]=clip[k],[bx,by]=clip[k+1], inside=p=>(bx-ax)*(p[1]-ay)-(by-ay)*(p[0]-ax)>=0, inp=out; out=[];
    for (let i=0;i<inp.length;i++){ const P=inp[i], Q=inp[(i+1)%inp.length], pi=inside(P), qi=inside(Q);
      if (pi) out.push(P);
      if (pi!==qi){ const x1=P[0],y1=P[1],x2=Q[0],y2=Q[1], den=(x1-x2)*(ay-by)-(y1-y2)*(ax-bx); if (den){ const t=((x1-ax)*(ay-by)-(y1-ay)*(ax-bx))/den; out.push([x1+t*(x2-x1),y1+t*(y2-y1)]); } } } }
  return out.length>2?ringArea([...out,out[0]]):0;
}
function shareInside(polys, box, test){
  const N=14, [x0,y0,x1,y1]=box; let lot=0, hit=0;
  for (let a=0;a<N;a++) for (let b=0;b<N;b++){ const x=x0+(x1-x0)*(a+.5)/N, y=y0+(y1-y0)*(b+.5)/N; if (!inLotM(polys,x,y)) continue; lot++; if (test(x,y)) hit++; }
  return lot?hit/lot:0;
}
const boxOf=(P,i)=>P.lotBox.subarray(4*i,4*i+4);

function lotsInCircles(P, pts, m, mode, miss){
  const out=[], C=pts.map(([x,y])=>toM(P,x,y)), r2=m*m;
  let a=180,b=90,c=-180,d=-90; for (const [x,y] of pts){ if(x<a)a=x; if(x>c)c=x; if(y<b)b=y; if(y>d)d=y; }
  const cand=lotsNear(P,a-m/KX,b-m/MLAT,c+m/KX,d+m/MLAT);
  const inAny=(x,y)=>{ for (const [cx,cy] of C) if ((x-cx)**2+(y-cy)**2<=r2) return true; return false; };
  if (mode==="center"){ const kx=mlng(pts[0][1]);
    for (const i of cand){ const x=P.lng[i], y=P.lat[i]; for (const [cx,cy] of pts){ const dx=(x-cx)*kx, dy=(y-cy)*MLAT; if (dx*dx+dy*dy<=r2){ out.push(i); break; } } }
    return Uint32Array.from(out).sort(); }
  for (const i of cand){
    const x=P.X[i], y=P.Y[i];
    const rad=P.lotRad[i]; let full=false; const near=[];
    for (const q of C){ const dd=Math.hypot(x-q[0],y-q[1]); if (dd+rad<=m){ full=true; break; } if (dd-rad<=m) near.push(q); }
    if (full){ out.push(i); continue; }
    if (!near.length) continue;
    const [bx0,by0,bx1,by1]=boxOf(P,i);
    if (near.some(([cx,cy])=>(Math.max(cx-bx0,bx1-cx))**2+(Math.max(cy-by0,by1-cy))**2<=r2)){ out.push(i); continue; }
    if (!near.some(([cx,cy])=>{ const dx=Math.max(bx0-cx,0,cx-bx1), dy=Math.max(by0-cy,0,cy-by1); return dx*dx+dy*dy<=r2; })) continue;
    const cin=inAny(x,y);
    if (mode==="all" && C.length===1 && !cin) continue;
    const polys=lotRingsM(P,i);
    if (!polys){ if (miss) miss.push(i); if (cin) out.push(i); continue; }
    if (!polys.length) continue;

    let reach=0, ex0=Infinity, ey0=Infinity, ex1=-Infinity, ey1=-Infinity;
    for (const poly of polys) for (const [vx,vy] of poly[0]){ const d=Math.hypot(vx-x,vy-y); if (d>reach) reach=d; if(vx<ex0)ex0=vx; if(vx>ex1)ex1=vx; if(vy<ey0)ey0=vy; if(vy>ey1)ey1=vy; }
    near.length=0; let whole=false;
    for (const q of C){ const dd=Math.hypot(x-q[0],y-q[1]); if (dd+reach<=m){ whole=true; break; } if (dd-reach<=m) near.push(q); }
    if (whole){ out.push(i); continue; }
    if (!near.length) continue;
    let ok=false;
    if (mode==="touch") ok=near.some(([cx,cy])=>inLotM(polys,cx,cy)||edgeDist(polys,cx,cy)<=m);
    else if (mode==="all") ok=polys.every(poly=>poly[0].every(([vx,vy])=>inAny(vx,vy)));
    else { const A=lotAreaM(polys); if (!A) continue;
      if (near.length===1){ const [cx,cy]=near[0], circ=[], mr=m*Math.sqrt((2*Math.PI/96)/Math.sin(2*Math.PI/96)); for (let k=0;k<=96;k++){ const t=k/96*2*Math.PI; circ.push([cx+Math.cos(t)*mr,cy+Math.sin(t)*mr]); }
        const inA=polys.reduce((s,poly)=>s+clipConvex(poly[0],circ)-poly.slice(1).reduce((t,h)=>t+clipConvex(h,circ),0),0); ok=inA/A>=0.5; }
      else ok=shareInside(polys,[ex0,ey0,ex1,ey1],inAny)>=0.5; }
    if (ok) out.push(i); }
  return Uint32Array.from(out).sort();
}
function segCross(a,b,c,d){ const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])); return o(a,b,c)!==o(a,b,d)&&o(c,d,a)!==o(c,d,b); }
function segHitsBox(p,q,x0,y0,x1,y1){
  if (Math.max(p[0],q[0])<x0||Math.min(p[0],q[0])>x1||Math.max(p[1],q[1])<y0||Math.min(p[1],q[1])>y1) return false;
  const A=[x0,y0],B=[x1,y0],Cc=[x1,y1],D=[x0,y1];
  return segCross(p,q,A,B)||segCross(p,q,B,Cc)||segCross(p,q,Cc,D)||segCross(p,q,D,A);
}

function lotsInRing(P, ring, mode, miss){
  const out=[]; let x0=180,y0=90,x1=-180,y1=-90;
  for (const [x,y] of ring){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  const R=ring.map(([x,y])=>toM(P,x,y)), [rx0,ry0]=toM(P,x0,y0), [rx1,ry1]=toM(P,x1,y1);
  const cand=lotsNear(P,x0,y0,x1,y1);
  for (const i of cand){
    const x=P.X[i], y=P.Y[i];
    if (mode==="center"){ if (x>=rx0&&x<=rx1&&y>=ry0&&y<=ry1&&inRing(x,y,R)) out.push(i); continue; }
    const bb=boxOf(P,i); if (bb[2]<rx0||bb[0]>rx1||bb[3]<ry0||bb[1]>ry1) continue;
    let corners=0; for (const [cx,cy] of [[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]]]) if (inRing(cx,cy,R)) corners++;
    let touches=R.some(([rx,ry])=>rx>=bb[0]&&rx<=bb[2]&&ry>=bb[1]&&ry<=bb[3]);
    if (!touches) for (let k=1;k<R.length&&!touches;k++) if (segHitsBox(R[k-1],R[k],bb[0],bb[1],bb[2],bb[3])) touches=true;
    if (!touches){ if (corners===4) out.push(i); continue; }
    const cin=inRing(x,y,R);
    const polys=lotRingsM(P,i);
    if (!polys){ if (miss) miss.push(i); if (cin) out.push(i); continue; }
    if (!polys.length) continue;
    let vin=0, vtot=0, ex0=Infinity, ey0=Infinity, ex1=-Infinity, ey1=-Infinity;
    for (const poly of polys) for (const [vx,vy] of poly[0]){ vtot++; if (inRing(vx,vy,R)) vin++; if(vx<ex0)ex0=vx; if(vx>ex1)ex1=vx; if(vy<ey0)ey0=vy; if(vy>ey1)ey1=vy; }
    const eb=[ex0,ey0,ex1,ey1];
    const ringIn=R.some(([rx,ry])=>rx>=eb[0]&&rx<=eb[2]&&ry>=eb[1]&&ry<=eb[3]&&inLotM(polys,rx,ry));
    let ok;
    if (mode==="all") ok=vin===vtot&&!ringIn;
    else if (mode==="touch"){ ok=vin>0||ringIn;
      if (!ok) outer: for (const poly of polys){ const r=poly[0]; for (let k=1;k<r.length;k++) for (let j=1;j<R.length;j++) if (segCross(r[k-1],r[k],R[j-1],R[j])){ ok=true; break outer; } } }
    else ok = vin===vtot&&!ringIn ? true : vin===0&&!ringIn ? false : shareInside(polys,eb,(px,py)=>inRing(px,py,R))>=0.5;
    if (ok) out.push(i); }
  return Uint32Array.from(out).sort();
}

function walkPts(sid){ const T=st.T; if(!T) return []; const s=T.byId.get(sid); if(!s) return [];
  const e=T.entrances.filter(x=>x.sid===sid).map(x=>[x.lng,x.lat]); return e.length?e:[[s.lng,s.lat]]; }
const selCache=new Map(), pending=new Set();
let refreshQ=false;

function refreshSoon(){ if (refreshQ) return; refreshQ=true; requestAnimationFrame(()=>{ refreshQ=false; drawSelection(); renderProfile(); }); }
function mergeIdx(lists){ let tot=0; for (const l of lists) tot+=l.length; const a=new Uint32Array(tot); let o=0; for (const l of lists){ a.set(l,o); o+=l.length; }
  a.sort(); let w=0; for (let k=0;k<a.length;k++) if (!k||a[k]!==a[k-1]) a[w++]=a[k]; return a.slice(0,w); }

function selIndices(P, sel, preview){
  if (sel.type==="multi"||sel.type==="group"){ const parts=sel.parts.map(s=>selIndices(P,s,preview)), r=mergeIdx(parts);
    if (parts.some(x=>x.provisional)) r.provisional=true; return r; }
  if (!isShape(sel)) return rawIndices(P,sel);
  const key=P.id+"|"+(sel.type==="walk"&&st.T?st.T.file:"")+"|"+JSON.stringify([sel.type,sel.c,sel.m,sel.sid,sel.ring,clipOf(sel)]);
  let r=selCache.get(key); if (r) return r;
  const miss=[]; r=rawIndices(P,sel,miss);
  if (miss.length){ r.provisional=true; if (preview) return r;
    const job=needLots(P,miss).then(()=>{ if (selCache.get(key)===r) selCache.delete(key); refreshSoon(); }).catch(err=>console.warn("lot outlines:",err));
    pending.add(job); job.finally(()=>pending.delete(job)); }
  if (selCache.size>300) selCache.clear(); selCache.set(key,r); return r;
}

window.LP={ settled: async()=>{ while (pending.size) await Promise.all([...pending]); await new Promise(r=>requestAnimationFrame(r)); } };
function rawIndices(P, sel, miss){
  if (sel.type==="area"){ const ai=P.areaIdx.get(sel.kind+":"+sel.code); if (ai==null) return new Uint32Array(0);
    const [start,lots]=areaLots(P,sel.kind); return lots.slice(start[ai],start[ai+1]); }
  if (sel.type==="lots"){ const out=[]; for (const b of sel.bbls){ const i=P.bblIdx.get(b); if (i!=null) out.push(i); } return Uint32Array.from(out); }
  if (sel.type==="blocks"){ const parts=sel.keys.map(k=>P.blockIdx.get(k)).filter(v=>v!=null).map(j=>P.blkLots.subarray(P.blkStart[j],P.blkStart[j+1]));
    return mergeIdx(parts); }
  if (sel.type==="radius" || sel.type==="walk"){
    const pts = sel.type==="radius" ? [sel.c] : walkPts(sel.sid); if (!pts.length) return new Uint32Array(0);
    return lotsInCircles(P,pts,sel.m,clipOf(sel),miss); }
  return lotsInRing(P,sel.ring,clipOf(sel),miss);
}

function partTest(P, sel){
  if (sel.type==="radius"||sel.type==="walk"){ const pts=sel.type==="radius"?[sel.c]:walkPts(sel.sid), kx=mlng(40.7), r2=sel.m*sel.m;
    return (x,y)=>pts.some(([cx,cy])=>((x-cx)*kx)**2+((y-cy)*MLAT)**2<r2*0.9999); }
  const rings=selRings(P,sel), boxes=rings.map(r=>{ let a=180,b=90,c=-180,d=-90; for (const [x,y] of r){ if(x<a)a=x; if(x>c)c=x; if(y<b)b=y; if(y>d)d=y; } return [a,b,c,d]; });
  return (x,y)=>rings.some((r,i)=>{ const q=boxes[i]; return x>q[0]&&x<q[2]&&y>q[1]&&y<q[3]&&inRing(x,y,r); });
}
function unionOutline(P, parts){
  const tests=parts.map(p=>partTest(P,p)), out=[];
  parts.forEach((p,i)=>{ for (const ring of selRings(P,p)){ let run=[];
    for (let k=1;k<ring.length;k++){ const a=ring[k-1], b=ring[k], mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;
      const hidden=tests.some((t,j)=>j!==i&&t(mx,my));
      if (!hidden){ if (!run.length) run.push(a); run.push(b); } else if (run.length){ out.push(run); run=[]; } }
    if (run.length) out.push(run); } });
  return out;
}

function selRings(P, sel){
  if (sel.type==="multi") return sel.parts.flatMap(s=>selRings(P,s));
  if (sel.type==="group") return unionOutline(P,sel.parts);
  if (sel.type==="radius") return [circle(sel.c,sel.m)];
  if (sel.type==="poly") return [sel.ring];
  if (sel.type==="walk"){ const pts=walkPts(sel.sid); return pts.length?[starUnion(pts,sel.m)]:[]; }
  if (sel.type==="lots"){ const ids=sel.bbls.map(b=>P.bblIdx.get(b)).filter(i=>i!=null), miss=ids.filter(i=>!geomOf(P,i));
    if (miss.length) needLots(P,miss).then(refreshSoon).catch(err=>console.warn("lot outlines:",err));
    return ids.flatMap(i=>(geomOf(P,i)||[]).map(p=>p[0])); }
  if (sel.type==="blocks"){ const js=sel.keys.map(k=>P.blockIdx.get(k)).filter(j=>j!=null), miss=js.filter(j=>!blockGeomOf(P,j));
    if (miss.length) needBlocks(P,miss).then(refreshSoon).catch(err=>console.warn("block outlines:",err));
    return js.flatMap(j=>(blockGeomOf(P,j)||[]).map(p=>p[0])); }
  const ai=P.areaIdx.get(sel.kind+":"+sel.code); return ai==null||!P.areas[ai].polys?[]:P.areas[ai].polys.map(p=>p[0]);
}

function lotLL(P,i){ const u=P.H.boxUnit||1e-5, B=P.box, o=4*i; return [P.lng[i]-B[o]*u,P.lat[i]-B[o+1]*u,P.lng[i]+B[o+2]*u,P.lat[i]+B[o+3]*u]; }
function selBox(P, sel){
  const grow=(a,b)=>!a?b:!b?a:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[2],b[2]),Math.max(a[3],b[3])];
  const ofPts=(pts,m=0)=>pts.reduce((bx,[x,y])=>grow(bx,[x-m/mlng(y),y-m/MLAT,x+m/mlng(y),y+m/MLAT]),null);
  if (sel.type==="multi"||sel.type==="group") return sel.parts.reduce((bx,s)=>grow(bx,selBox(P,s)),null);
  if (sel.type==="radius") return ofPts([sel.c],sel.m);
  if (sel.type==="walk") return ofPts(walkPts(sel.sid),sel.m);
  if (sel.type==="poly") return ofPts(sel.ring);
  if (sel.type==="area"){ const ai=P.areaIdx.get(sel.kind+":"+sel.code); return ai==null?null:P.areas[ai].bbox; }
  return Array.from(rawIndices(P,sel)).reduce((bx,i)=>grow(bx,lotLL(P,i)),null);
}
function groupName(sel){
  const P=sel.parts, n=P.length;
  if (sel.name) return sel.name;
  if (P.every(p=>p.type==="walk") && P.every(p=>p.m===P[0].m)) return `${miles(P[0].m)} around ${n} station${n===1?"":"s"}`;
  if (P.every(p=>p.type==="radius") && P.every(p=>p.m===P[0].m)) return `${n} circles of ${miles(P[0].m)}`;
  if (P.every(p=>p.type==="radius")) return `${n} circles combined`;
  if (P.every(p=>p.type==="walk")) return `Walksheds around ${n} stations`;
  return `${n} areas combined`;
}
function groupTitle(P, sel, count){
  const cl=clipsIn(sel), ph=cl.length===1?CLIP_PHRASE[cl[0]]:"counted by each part's rule,";
  const kinds=sel.parts.every(p=>p.type==="walk")?"walksheds":sel.parts.every(p=>p.type==="radius")?"circles":"areas";
  return [groupName(sel), `One merged area: ${fmt(count)} lots ${ph} any of its ${sel.parts.length} ${kinds}; lots in overlaps count once`];
}
const miles = m => { const mi=m/1609.344; return mi>=0.1 ? (Math.round(mi*100)/100)+" mi" : Math.round(m*3.28084)+" ft"; };
function selTitle(P, sel, count){
  if (sel.type==="multi"){ const tot=sel.parts.reduce((a,s)=>a+selIndices(P,s).length,0);
    return [`${sel.parts.length} selections combined`, `${fmt(count)} lots in total`+(tot>count?`; ${fmt(tot-count)} fall in more than one selection and count once`:"")]; }
  if (sel.type==="area"){ const a=P.areas[P.areaIdx.get(sel.kind+":"+sel.code)];
    return [a?a.name:sel.code,(sel.kind==="nta"?"Neighborhood tabulation area":"2020 census tract")+`, ${fmt(count)} lots`]; }
  if (sel.type==="lots"){ if (sel.bbls.length===1){ const i=P.bblIdx.get(sel.bbls[0]), p=bblParts(sel.bbls[0]);
      return [i!=null&&addrOf(P,i)?addrOf(P,i):`BBL ${sel.bbls[0]}`, i!=null?`${P.dict.lu[P.lu[i]]}${P.dict.zone[P.zone[i]]?`  ·  ${P.dict.zone[P.zone[i]]}`:""}`:`${BORO[p.boro]}, block ${p.block}, lot ${p.lot}`]; }
    return [`${fmt(count)} selected lots`, "Shift-click lots to add or remove them"]; }
  if (sel.type==="blocks") return [sel.keys.length===1?blockName(sel.keys[0]):`${sel.keys.length} tax blocks`, `${fmt(count)} lots`+(sel.keys.length>1?"; shift-click blocks to add or remove":"")];
  if (sel.type==="group") return groupTitle(P,sel,count);
  const ph=CLIP_PHRASE[clipOf(sel)];
  if (sel.type==="walk"){ const s=st.T&&st.T.byId.get(sel.sid), ne=st.T?st.T.entrances.filter(x=>x.sid===sel.sid).length:0;
    return [`${miles(sel.m)} around ${s?s.name:"station"}`, `${fmt(count)} lots ${ph} ${ne?`the ${miles(sel.m)} walkshed of its ${ne} entrance${ne===1?"":"s"}`:`${miles(sel.m)} of the station (no entrance data)`} (straight-line)`]; }
  if (sel.type==="radius") return [sel.label||`Within ${miles(sel.m)} of a point`, `${fmt(count)} lots ${ph} the circle`];
  return ["Drawn area", `${fmt(count)} lots ${ph} the boundary`];
}

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
  if (expect!==Infinity) return {err:`Finish with an open group such as ${expect}+ so every building is counted.`};
  return {div:UB_STARTS.slice(1).map(s=>starts.includes(s))};
}
const divText = div => groupsFrom(div).map(g=>{ const lo=UB_RANGE[g[0]][0], hi=UB_RANGE[g[g.length-1]][1]; return hi==null?lo+"+":lo===hi?""+lo:lo+"-"+hi; }).join(", ");

function median(arr){ if(!arr.length) return null; const a=Float64Array.from(arr).sort(), m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2; }

function computeStats(P, idx, o, allLots){
  const groups=groupsFrom(o.div), G=groups.length, b2g=new Int16Array(256).fill(-1);
  groups.forEach((g,gi)=>g.forEach(b=>b2g[b]=gi));
  const S={lots:0,area:0,units:0,resLots:0,groups, luL:new Float64Array(12),luA:new Float64Array(12),luU:new Float64Array(12),
    ubL:new Float64Array(G),ubA:new Float64Array(G),ubU:new Float64Array(G), fcL:new Float64Array(8), zone:new Map(),
    dec:new Float64Array(DECADES.length), filtered:0, ids:[],
    hasFar:!!P.far&&!allLots, ageLots:0, dqLots:0, dqUnits:0, dqFixed:0};
  const hasFar=S.hasFar;
  const areas=[],built=[],years=[]; let sm=0,sd=0,nd=0,over=0,under=0,bfa=0,mfa=0;
  for (const i of idx){
    const lu=P.lu[i]; if (o.luExcl.has(lu)||(o.boroExcl&&o.boroExcl.size&&o.boroExcl.has(Math.floor(P.bbl[i]/1e9)))) continue;
    const dq=P.qa||o.dq.farMax?dqIssues(P,i):[]; if (dq.length){ S.dqLots++; S.dqUnits+=P.units[i]; if (o.dq.mode==="exclude") continue; }
    let a=P.area[i], bfi=P.bfar[i]; const u=P.units[i];
    if (o.dq.mode==="fix"&&(dq[0]===1||dq[0]===2)){ const oa=P.qa.outA[P.qa.pos[i]]; if (a>0&&!Number.isNaN(bfi)) bfi=bfi*a/oa; a=oa; S.dqFixed++; }
    S.ids.push(i);
    S.lots++; S.area+=a; S.units+=u; areas.push(a);
    S.luL[lu]++; S.luA[lu]+=a; S.luU[lu]+=u;
    const g=b2g[P.ub[i]]; if(g>=0){ S.ubL[g]++; S.ubA[g]+=a; S.ubU[g]+=u; if(u>0) S.resLots++; }
    const z=P.zone[i]; let zr=S.zone.get(z); if(!zr) S.zone.set(z,zr=[0,0,0]); zr[0]++; zr[1]+=a; zr[2]+=u;
    if (hasFar){
      const fc=P.fc[i], mx=P.mfar[i];
      if (fc<6 && mx>0){ S.filtered++; S.fcL[fc]++; sm+=mx; mfa+=mx*a;
        const b=bfi; if(!Number.isNaN(b)){ built.push(b); bfa+=b*a; }
        const d=P.fdiff[i]; if(!Number.isNaN(d)){ sd+=d; nd++; if(d<0)over++; else if(d>0)under++; }
        const y=P.year[i]; if(y>1800&&y<2030){ years.push(y); S.dec[y<1900?0:Math.min(13,Math.floor((y-1900)/10)+1)]++; } }
    } else {
      const b=bfi; if(!Number.isNaN(b)){ built.push(b); bfa+=b*a; }
      const y=P.year[i]; if(y>1800&&y<2030){ years.push(y); S.dec[y<1900?0:Math.min(13,Math.floor((y-1900)/10)+1)]++; } }
  }
  S.acres=S.area/43560; S.upa=S.acres?S.units/S.acres:null; S.medLot=median(areas);
  S.meanBuilt=built.length?built.reduce((x,y)=>x+y,0)/built.length:null; S.medBuilt=median(built);
  S.meanMax=S.filtered?sm/S.filtered:null; S.meanDiff=nd?sd/nd:null;
  S.builtFA=bfa; S.maxFA=mfa;
  S.pctUnder=S.filtered?under/S.filtered*100:null; S.pctOver=S.filtered?over/S.filtered*100:null;
  S.years=years.length; S.medYear=median(years); S.meanYear=years.length?years.reduce((x,y)=>x+y,0)/years.length:null;
  S.pre61=years.length?years.filter(y=>y<1961).length/years.length*100:null;
  return S;
}

function mix(a,b,t){ const p=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)); const A=p(a),B=p(b);
  return "#"+A.map((v,k)=>Math.round(v+(B[k]-v)*t).toString(16).padStart(2,"0")).join(""); }
function zoneColor(z){ const c=(st.colors.custom.zn||{})[z]; if (c) return c;
  const sc=schemeOf("zn"); if (!z||sc==="standard"||!SCHEMES[sc]) return zoneBase(z);
  if (sc==="distinct"){ const D=SCHEMES.distinct.c; return D[strHash(z)%D.length]; }
  const m=/^[A-Z]+(\d+)/.exec(z), C=SCHEMES[sc].c; if (!m) return /^PARK/.test(z)?"#A9D39E":NODATA;
  return C[Math.round(Math.min(1,(Math.min(+m[1],10)-1)/9)*(C.length-1))]; }
function zoneBase(z){ const m=/^([A-Z]+)(\d+)?/.exec(z||""); if(!m) return NODATA; const t=Math.min(1,((+m[2]||1)-1)/9);
  if (m[1]==="R") return mix("#F5E3A0","#B97A12",t); if (m[1]==="C") return mix("#F0A898","#A8272B",t);
  if (m[1]==="M") return mix("#CDB8E2","#5E3F8F",t); if ((z||"").startsWith("PARK")) return "#7FB36E"; return "#B7BEC6"; }

const seg=(k,c,v,tot,metric,val)=>({k,c,pct:pct(v,tot),val,metric});
const barHTML=segs=>`<div class="core">${segs.filter(s=>s.pct>0).map(s=>`<i style="width:${s.pct.toFixed(3)}%;background:${s.c}" data-k="${esc(s.k)}" data-p="${s.pct.toFixed(1)}" data-v="${esc(s.val)}" data-m="${esc(s.metric)}"></i>`).join("")}</div>`;
function pieCSS(segs){ let acc=0; const stops=[]; for (const s of segs){ if(!s.pct) continue; stops.push(`${s.c} ${(acc*3.6).toFixed(2)}deg ${((acc+s.pct)*3.6).toFixed(2)}deg`); acc+=s.pct; }
  return `conic-gradient(${stops.join(",")||"#eee 0deg 360deg"})`; }
const piesHTML=charts=>`<div class="pies">${charts.map(ch=>`<div class="pieBox"><div class="pie" style="background:${pieCSS(ch.segs)}" data-seg="${esc(JSON.stringify(ch.segs.filter(s=>s.pct>0).map(s=>[s.k,+s.pct.toFixed(2),s.val,s.metric])))}"></div><small>${ch.cap}</small></div>`).join("")}</div>`;
function tableHTML(headers, rows, key){
  const cols=`grid-template-columns:11px minmax(0,1fr) repeat(${headers.length-1},58px)`, cur=key&&st.opts.sort[key]||"std";
  const hb=(h,mode,cls)=>key?`<button class="${cls} sorth${cur===mode?" on":""}" data-sort="${key}:${mode}" title="${cur===mode?"Back to the standard order":`Sort by ${h}`}">${h}${cur===mode?(mode==="az"?" ↑":" ↓"):""}</button>`:`<span class="${cls}">${h}</span>`;
  return `<div class="rows"><div class="r hd" style="${cols}"><span></span>${hb(headers[0],"az","nm")}${headers.slice(1).map((h,k)=>hb(h,["lots","area","units"][k],"val")).join("")}</div>`+
    rows.map(r=>`<div class="r${r.hid?" off":""}" style="${cols}"${key?` data-hidecat="${key}" data-name="${esc(r[1])}" title="${r.hid?"Click to put this back in the chart":"Click to leave this out of this chart (the rest recalculate)"}"`:""} data-k="${esc(r[1])}" data-p="${r[2]==null?"":r[2].toFixed(1)}" data-v="" data-m="${esc(headers[1]).toLowerCase().replace("%","of")}"><span class="sw" style="background:${r[0]}"></span><span class="nm">${esc(r[1])}</span>${r.slice(2).map(v=>`<span class="val">${v==null?"":fmt(v,1)+"%"}</span>`).join("")}</div>`).join("")+`</div>`;
}
const kvHTML=pairs=>`<div class="kv">${pairs.map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join("")}</div>`;
function sectionSpecs(S, B, Sc){
  const P=st.P, acres=v=>fmt(v/43560,1)+" acres", specs={};
  const luRows=[]; let oL=0,oA=0,oU=0; const order=[...Array(12).keys()];
  for (const k of order){ if(!S.luL[k]) continue; const pl=pct(S.luL[k],S.lots),pa=pct(S.luA[k],S.area),pu=pct(S.luU[k],S.units);
    if (pl<0.1&&pa<0.1){oL+=S.luL[k];oA+=S.luA[k];oU+=S.luU[k];continue;} luRows.push([LU_COLORS[k],P.dict.lu[k],pl,pa,pu]); }
  const luRest=order.filter(k=>S.luL[k]&&pct(S.luL[k],S.lots)<0.1&&pct(S.luA[k],S.area)<0.1).map(k=>P.dict.lu[k]);
  if (oL) luRows.push([NODATA,"All other (under 0.1%)",pct(oL,S.lots),pct(oA,S.area),pct(oU,S.units)]);
  const luSeg=(arr,tot,metric,vf)=>order.filter(k=>arr[k]).map(k=>seg(P.dict.lu[k],LU_COLORS[k],arr[k],tot,metric,vf(arr[k])));
  specs.lu={title:"Land use",about:"land-use",barCap:"Share of land area",
    charts:[{cap:"Lots",segs:luSeg(S.luL,S.lots,"of lots",v=>fmt(v)+" lots")},{cap:"Land area",segs:luSeg(S.luA,S.area,"of land area",acres)},
            {cap:"Housing units",segs:luSeg(S.luU,S.units,"of housing units",v=>fmt(v)+" units")}],
    bar:1, headers:["Land use","% lots","% area","% units"], rows:luRows, rest:luRest};
  const gl=S.groups.map(groupLabel), gc=groupColors(S.groups.length);
  const tL=S.ubL.reduce((a,b)=>a+b,0),tA=S.ubA.reduce((a,b)=>a+b,0),tU=S.ubU.reduce((a,b)=>a+b,0);
  const ubSeg=(arr,tot,metric,vf)=>gl.map((k,i)=>seg(k,gc[i],arr[i],tot,metric,vf(arr[i])));
  specs.ub={title:"Housing by units per building",about:"units-per-building",barCap:"Share of housing units",
    charts:[{cap:"Residential lots",segs:ubSeg(S.ubL,tL,"of residential lots",v=>fmt(v)+" lots")},{cap:"Land area",segs:ubSeg(S.ubA,tA,"of residential land",acres)},
            {cap:"Housing units",segs:ubSeg(S.ubU,tU,"of housing units",v=>fmt(v)+" units")}],
    bar:2, headers:["Units per building","% lots","% area","% units"], rows:gl.map((k,i)=>[gc[i],k,pct(S.ubL[i],tL),pct(S.ubA[i],tA),pct(S.ubU[i],tU)]).filter(r=>r[2]||r[4])};
  if (!S.hasFar) specs.fc={title:"Zoning capacity (FAR)",soft:NOT_YET,about:"far",
    placeholder:"Maximum FAR for this release is being modeled separately and will be added later. Built FAR is from PLUTO floor area and lot area.",
    kv:[["Mean built FAR",fmt(S.meanBuilt,2)],["Median built FAR",fmt(S.medBuilt,2)],["Floor area built",fmt(S.builtFA)+" sq ft"],
        ["Mean maximum FAR","—"],["Mean unused FAR","—"],["Floor area allowed","—"],["Share of allowed floor area built","—"],["Underbuilt lots","—"],["Overbuilt lots","—"]]};
  else specs.fc={title:"Zoning capacity (FAR)",soft:`${fmt(S.filtered)} lots analyzed`,barCap:"Share of analyzed lots",about:"far",
    charts:[{cap:"Analyzed lots",segs:P.dict.fc.map((k,i)=>seg(k,FC_COLORS[i],S.fcL[i],S.filtered,"of analyzed lots",fmt(S.fcL[i])+" lots"))}],
    bar:0, headers:["Capacity","% lots"], rows:P.dict.fc.map((k,i)=>[FC_COLORS[i],k,pct(S.fcL[i],S.filtered)]).filter(r=>r[2]),
    kv:[["Mean built FAR",fmt(S.meanBuilt,2)],["Median built FAR",fmt(S.medBuilt,2)],["Mean maximum usable FAR (modeled)",fmt(S.meanMax,2)],
        ["Mean unused FAR",fmt(S.meanDiff,2)],["Floor area built",fmt(S.builtFA)+" sq ft"],["Floor area allowed (modeled)",fmt(S.maxFA)+" sq ft"],
        ["Share of allowed floor area built",S.maxFA?fmt(S.builtFA/S.maxFA*100,1)+"%":"—"],["Underbuilt lots",pctT(S.pctUnder)],["Overbuilt lots",pctT(S.pctOver)]]};
  specs.age={title:"Building age",soft:`${fmt(S.years)} lots with a year`,about:"building-age",hist:DECADES.map((d,i)=>[d,pct(S.dec[i],S.years),S.dec[i]]),
    kv:[["Median year built",S.medYear?Math.round(S.medYear):"—"],["Mean year built",S.meanYear?Math.round(S.meanYear):"—"],["Built before the 1961 Zoning Resolution",fmt(S.pre61,1)+"%"]]};
  const zs=[...S.zone.entries()].map(([z,v])=>[P.dict.zone[z]||"None",v]).sort((a,b)=>b[1][1]-a[1][1]);
  const top=zs.slice(0,8), rest=zs.slice(8).reduce((a,[,v])=>[a[0]+v[0],a[1]+v[1],a[2]+v[2]],[0,0,0]);
  const zrows=top.map(([z,v])=>[zoneColor(z),z,pct(v[0],S.lots),pct(v[1],S.area),pct(v[2],S.units)]);
  if (rest[0]) zrows.push([NODATA,`${zs.length-8} other districts`,pct(rest[0],S.lots),pct(rest[1],S.area),pct(rest[2],S.units)]);
  specs.zone={title:"Zoning districts",about:"zoning",soft:`${zs.length} district${zs.length===1?"":"s"}`,barCap:"Share of land area",
    charts:[{cap:"Land area",segs:top.map(([z,v])=>seg(z,zoneColor(z),v[1],S.area,"of land area",acres(v[1]))).concat(rest[1]?[seg("Other districts",NODATA,rest[1],S.area,"of land area",acres(rest[1]))]:[])}],
    bar:0, headers:["District","% lots","% area","% units"], rows:zrows};
  if (S.ids.length>1 && S.ids.length<=500 && st.sel.type!=="area")
    specs.list={title:"Lots",soft:`${fmt(S.ids.length)} lots, click one for its record`,
      lots:S.ids.slice().sort((a,b)=>(addrOf(P,a)||"~").localeCompare(addrOf(P,b)||"~",undefined,{numeric:true}))};
  if (B){ const d=(a,b,dg=0,sfx="")=>{let x=a-b; if (Math.abs(x)<0.5*Math.pow(10,-dg)) x=0; return (x>0?"+":"")+fmt(x,dg)+sfx;}; S=Sc||S;
    const lu12=pct(S.luU[0],S.units)-pct(B.luU[0],B.units);
    specs.cmp={title:`Change since ${st.C.id}`,soft:"same boundary",
      cmpRows:[["Tax lots",fmt(B.lots),fmt(S.lots),d(S.lots,B.lots)],["Housing units",fmt(B.units),fmt(S.units),d(S.units,B.units)],
        ["Residential lots",fmt(B.resLots),fmt(S.resLots),d(S.resLots,B.resLots)],["Units per acre",fmt(B.upa,1),fmt(S.upa,1),d(S.upa,B.upa,1)],
        ["Mean built FAR",fmt(B.meanBuilt,2),fmt(S.meanBuilt,2),d(S.meanBuilt,B.meanBuilt,2)],
        ["Underbuilt lots",pctT(B.pctUnder),pctT(S.pctUnder),B.pctUnder==null||S.pctUnder==null?"—":d(S.pctUnder,B.pctUnder,1," pts")],
        ["Units in 1-2 family homes",fmt(pct(B.luU[0],B.units),1)+"%",fmt(pct(S.luU[0],S.units),1)+"%",(lu12>0?"+":"")+fmt(lu12,1)+" pts"]]}; }
  hideSpecs(specs); sortSpecs(specs);
  return specs;
}

const isRestRow=r=>r[0]===NODATA&&/other/i.test(r[1]);
function hideSpecs(specs){
  for (const [key,sp] of Object.entries(specs)){
    const H=st.opts.hideCat[key]; if (!H||!H.size||!sp.rows) continue;
    const hid=r=>H.has(r[1]), cols=sp.headers.length-1, sums=Array(cols).fill(0), restOff=sp.rows.some(r=>isRestRow(r)&&H.has(r[1]));
    sp.rows.forEach(r=>{ if (hid(r)) for (let c=0;c<cols;c++) sums[c]+=r[c+2]||0; });
    sp.rows=sp.rows.map(r=>{ if (hid(r)){ const x=[r[0],r[1],...Array(cols).fill(null)]; x.hid=true; return x; }
      return [r[0],r[1],...r.slice(2).map((v,c)=>v==null||sums[c]>=99.999?v:v/(100-sums[c])*100)]; });
    const segOff=g=>H.has(g.k)||(restOff&&((sp.rest||[]).includes(g.k)||(g.c===NODATA&&/other/i.test(g.k))));
    if (sp.charts) sp.charts.forEach(ch=>{ const gone=ch.segs.filter(segOff), t=gone.reduce((a,g)=>a+g.pct,0);
      ch.segs=ch.segs.filter(g=>!gone.includes(g)).map(g=>({...g,pct:t>=99.999?g.pct:g.pct/(100-t)*100})); });
    sp.hiddenNote=[...H];
  }
}
const SORT_COL={lots:2,area:3,units:4};
const SORT_NAME={lots:"% lots",area:"% area",units:"% units",az:"A–Z"};
function sortSpecs(specs){
  for (const [key,sp] of Object.entries(specs)){
    const m=st.opts.sort[key]; if (!m||m==="std"||!sp.rows) continue;
    const c=SORT_COL[m]; if (c!=null && c>sp.headers.length) continue;
    const rest=r=>r[0]===NODATA&&/other/i.test(r[1]), keep=sp.rows.filter(r=>!rest(r));
    keep.sort(m==="az"?(a,b)=>a[1].localeCompare(b[1],undefined,{numeric:true}):(a,b)=>(b[c]||0)-(a[c]||0));
    sp.rows=keep.concat(sp.rows.filter(rest));
    const rank=new Map(sp.rows.map((r,k)=>[r[1],k])), rk=(s,k)=>rank.has(s.k)?rank.get(s.k):1e4+k;
    if (sp.charts) sp.charts.forEach(ch=>{ ch.segs=ch.segs.map((s,k)=>[rk(s,k),s]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); });
  }
}
function sectionHTML(key, sp){
  const pies=st.opts.style==="pies";
  const shut=st.opts.shut.has(key);
  let h=`<section class="blk${shut?" shut":""}" data-key="${key}"><h2><span class="grip" title="Drag to reorder">⋮⋮</span><button class="fold" data-fold="${key}" aria-expanded="${!shut}" title="${shut?"Show":"Hide"} this section"><span class="chev" aria-hidden="true">▾</span>${sp.title}</button>${sp.soft?` <span class="soft">${sp.soft}</span>`:""}${sp.lots||sp.html||sp.warn?"":`<button class="xbtn" data-export="${key}" title="Download this section as an image">PNG</button>`}</h2>`;
  if (sp.charts) h+=pies?piesHTML(sp.charts):barHTML(sp.charts[sp.bar].segs);
  if (sp.hist){ const mx=Math.max(1,...sp.hist.map(b=>b[1]));
    h+=`<div class="hist">${sp.hist.map(([d,p,c])=>`<i style="height:${(p/mx*100).toFixed(1)}%" data-k="Built ${d}" data-p="${p.toFixed(1)}" data-v="${fmt(c)} lots" data-m="of lots with a year"></i>`).join("")}</div><div class="histx">${DECADES.map((d,k)=>`<span>${k%3===0?esc(d):""}</span>`).join("")}</div>`; }
  if (sp.rows) h+=tableHTML(sp.headers,sp.rows,key)+(sp.hiddenNote?`<p class="hidnote">Left out of this chart: ${sp.hiddenNote.map(esc).join(", ")}. Percentages are of the rest. <button class="link" data-showall="${key}">Show all</button></p>`:"")+(st.opts.sort[key]&&st.opts.sort[key]!=="std"?`<button class="link sortreset" data-sort="${key}:std">Back to the standard order</button>`:"");
  if (sp.lots){ const P=st.P, cols="grid-template-columns:minmax(0,1fr) 44px 92px";
    h+=`<div class="rows lotlist"><div class="r hd" style="${cols}"><span class="nm">Address</span><span class="val">Units</span><span class="val">FAR built/max</span></div>${sp.lots.map(i=>`<div class="r" style="${cols}" data-lot="${Math.round(P.bbl[i])}"><span class="nm">${esc(addrOf(P,i)||"BBL "+Math.round(P.bbl[i]))}</span><span class="val">${fmt(P.units[i])}</span><span class="val">${fmt(P.bfar[i],2)} / ${fmt(P.mfar[i],2)}</span></div>`).join("")}</div>`; }
  if (sp.cmpRows) sp.cmpRows=sp.cmpRows.filter(r=>!(r[1]==="—"&&r[2]==="—"));
  if (sp.cmpRows){ const g="grid-template-columns:minmax(0,1fr) 70px 70px 76px";
    h+=`<div class="rows"><div class="r hd" style="${g}"><span class="nm">Measure</span><span class="val">${st.C.id}</span><span class="val">${st.P.id}</span><span class="val">Change</span></div>${sp.cmpRows.map(r=>`<div class="r" style="${g}"><span class="nm">${r[0]}</span><span class="val">${r[1]}</span><span class="val">${r[2]}</span><span class="val ${/^\+(?!0(\.0+)?( |$))/.test(r[3])?"up":r[3].startsWith("-")?"dn":"eq"}">${r[3]}</span></div>`).join("")}</div>`; }
  if (sp.mrows) h+=`<div class="mt"><table><thead><tr><th>Measure</th>${sp.mcols.map(c=>`<th data-pick="${c.pick}" title="Open ${esc(c.name)}"><i style="background:${c.color}"></i>${esc(c.name.length>14?c.name.slice(0,13)+"…":c.name)}${typeof c.pick==="number"?`<b class="rmx" data-x="${c.pick}" title="Remove this selection">×</b>`:""}</th>`).join("")}</tr></thead><tbody>${sp.mrows.map(r=>`<tr><td>${r[0]}</td>${r.slice(1).map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  if (sp.bars){ const seen=new Map(); sp.bars.forEach(b=>b.segs.forEach(g=>{ if (g.pct>0&&!seen.has(g.k)) seen.set(g.k,g.c); }));
    h+=`<div class="blegend">${[...seen].map(([k,c])=>`<span><i style="background:${c}"></i>${esc(k)}</span>`).join("")}</div>`; }
  if (sp.bars) h+=sp.bars.map(b=>`<div class="sbar"><div class="sbh"><button class="link" data-pick="${b.pick}"><i style="background:${b.color}"></i>${esc(b.name)}</button>${typeof b.pick==="number"?`<b class="rmx" data-x="${b.pick}" title="Remove this selection">×</b>`:""}</div>${barHTML(b.segs)}</div>`).join("");
  if (sp.placeholder) h+=`<p class="notyet">${esc(sp.placeholder)}</p>`;
  if (sp.warn) h+=`<p class="warn">${esc(sp.warn)}</p>`;
  if (sp.kv) h+=kvHTML(sp.kv);
  if (sp.html) h+=sp.html;
  if (sp.about) h+=`<a class="howcalc" href="about.html#${sp.about}" target="_blank" rel="noopener">ⓘ How is this calculated?</a>`;
  return h+`</section>`;
}

const OWNER_TYPE={C:"City",M:"Mixed city and private",O:"Other public (state or federal)",P:"Private",X:"Tax-exempt"};
const nonEmpty=(...v)=>v.filter(x=>x!=null&&x!==""&&x!==0&&x!=="0").join(", ")||"None";
const FAR_STATUS={modeled:"Modeled",provisional:"Provisional (rules still under review)",not_modeled:"Not modeled (rules not encoded yet)"};

function farOf(P, i){
  if (!P.far) return null; const F=P.far, v=F.data[F.base][i];
  const st_=F.status[i]<F.H.status.length?F.H.status[F.status[i]]:null;
  return {base:v, status:st_, cols:F.cols.map(c=>({...c,v:F.data[c.key][i]}))};
}
const SPD_NAME={"125th":"Special 125th Street District","AAM":"Special Atlantic Avenue Mixed Use District (AAM)","BPC":"Special Battery Park City District","BR":"Special Bay Ridge District","BSC":"Special Bay Street Corridor District","BNY":"Special Brooklyn Navy Yard","CD":"Special City Island District","CL":"Special Clinton District","CR-1":"Special Coastal Risk District 1","CR-2":"Special Coastal Risk District 2","CR-3":"Special Coastal Risk District 3","CR-4":"Special Coastal Risk District 4","CR-5":"Special Coastal Risk District 5","CP":"Special College Point District","CI":"Special Coney Island District","CO":"Special Coney Island Mixed Use District","DB":"Special Downtown Brooklyn District","DFR":"Special Downtown Far Rockaway District","DJ":"Special Downtown Jamaica District","EHC":"Special East Harlem Corridors","ETC":"Special Eastchester – East Tremont Corridor District (ETC)","EC-1":"Special Enhanced Commercial District 1","EC-2":"Special Enhanced Commercial District 2","EC-3":"Special Enhanced Commercial District 3","EC-4":"Special Enhanced Commercial District 4","EC-5":"Special Enhanced Commercial District 5","EC-6":"Special Enhanced Commercial District 6","FW":"Special Flushing Waterfront District","FH":"Special Forest Hills District","NA-4":"Special Fort Totten Natural Area District-4","GI":"Special Governors Island District","G":"Special Gowanus Mixed-Use District","C":"Special Grand Concourse Preservation District","HRW":"Special Harlem River Waterfront District","HS":"Special Hillsides Preservation District","HRP":"Special Hudson River Park District","HSQ":"Special Hudson Square District","HY":"Special Hudson Yards District","HP":"Special Hunts Point District","IN":"Special Inwood District","J":"Special Jerome Corridor District","LC":"Special Limited Commercial District","L":"Special Lincoln Square District","LI":"Special Little Italy District","LIC":"Special Long Island City Mixed Use District","LM":"Special Lower Manhattan District","MP":"Special Madison Avenue Preservation District","MMU":"Special Manhattanville Mixed Use District","MiD":"Special Midtown District","MSX":"Special Midtown South Mixed-Use District","MX-1":"Special Mixed Use District (MX-1)","MX-10":"Special Mixed Use District (MX-10)","MX-11":"Special Mixed Use District (MX-11)","MX-12":"Special Mixed Use District (MX-12)","MX-13":"Special Mixed Use District (MX-13)","MX-14":"Special Mixed Use District (MX-14)","MX-15":"Special Mixed Use District (MX-15)","MX-16":"Special Mixed Use District (MX-16)","MX-17":"Special Mixed Use District (MX-17)","MX-18":"Special Mixed Use District (MX-18)","MX-19":"Special Mixed Use District (MX-19)","MX-2":"Special Mixed Use District (MX-2)","MX-21":"Special Mixed Use District (MX-21)","MX-22":"Special Mixed Use District (MX-22)","MX-23":"Special Mixed Use District (MX-23)","MX-24":"Special Mixed Use District (MX-24)","MX-25":"Special Mixed Use District (MX-25)","MX-26":"Special Mixed Use District (MX-26)","MX-27":"Special Mixed Use District (MX-27)","MX-30":"Special Mixed Use District (MX-30)","MX-4":"Special Mixed Use District (MX-4)","MX-5":"Special Mixed Use District (MX-5)","MX-6":"Special Mixed Use District (MX-6)","MX-7":"Special Mixed Use District (MX-7)","MX-8":"Special Mixed Use District (MX-8)","NA-1":"Special Natural Area District-1","NA-2":"Special Natural Area District-2","NA-3":"Special Natural Area District-3","OP":"Special Ocean Parkway District","PI":"Special Park Improvement District","PC":"Special Planned Community Preservation District","SV-1":"Special Scenic View District","SB":"Special Sheepshead Bay District","SNX":"Special SoHo-NoHo Mixed Use District","SRD":"Special South Richmond Development District","SHP":"Special Southern Hunters Point District","SRI":"Special Southern Roosevelt Island District","SG":"Special St. George District","SW":"Special Stapleton Waterfront District","TA":"Special Transit Land Use District","TMU":"Special Tribeca Mixed Use District","US":"Special Union Square District","U":"Special United Nations Development District","WCh":"Special West Chelsea District","WP":"Special Willets Point District"};
const spdName=c=>SPD_NAME[c]?`${SPD_NAME[c].replace(/\s*\([^)]*\)$/,"")} (${c})`:c;
const CD_MAX={1:12,2:12,3:18,4:14,5:3}, isJIA=cd=>(+cd%100)>(CD_MAX[Math.floor(+cd/100)]||99);
function lotSpecs(i){
  const P=st.P, again=()=>{ if (st.P===P && (st.peek===Math.round(P.bbl[i]) || (st.sel&&st.sel.type==="lots"&&st.sel.bbls.length===1&&st.sel.bbls[0]===Math.round(P.bbl[i])))) renderProfile(); };
  const R=recOf(P,i,again), wait="…", g=(...fs)=>{ if (!R) return null; for (const f of fs) if (R[f]!=null&&R[f]!=="") return R[f]; return null; };
  const has=f=>P.recFields.includes(f), {boro,block,lot}=bblParts(P.bbl[i]);
  const sqft=v=>!R?wait:v?fmt(v)+" sq ft":"—", money=v=>!R?wait:v?"$"+fmt(v):"—", txt=(v,d="—")=>!R?wait:esc(v||d), cd=g("CD");
  const specs={}, fd=P.fdiff[i], la=P.area[i], F=farOf(P,i);
  const bblN=Math.round(P.bbl[i]), owner=!R?wait:st.ownerShown.has(bblN)?txt(g("OwnerName")):`<button class="link" data-showowner="${bblN}" title="Owner names are public PLUTO data; they stay hidden until you ask, as in ZoLa">Show owner</button>`;
  specs.lotinfo={title:"Lot", kv:[["Owner",owner],["Owner type",!R?wait:OWNER_TYPE[g("OwnerType")]||"Private or unknown"],
    ["Land use",P.dict.lu[P.lu[i]]],["Building class",txt(g("BldgClass"))],["Lot area",fmt(la)+" sq ft"],
    ["Lot frontage × depth",!R?wait:`${fmt1(g("LotFront"))} × ${fmt1(g("LotDepth"))} ft`],["Buildings on lot",!R?wait:fmt(g("NumBldgs"))],
    ["Condo number",!R?wait:g("CondoNo")?fmt(g("CondoNo")):"None"]]};
  specs.bldg={title:"Building", kv:[["Year built",P.year[i]||"—"],["Year altered",!R?wait:nonEmpty(g("YearAlter1"),g("YearAlter2"))],
    ["Floors",!R?wait:fmt1(g("NumFloors"))],["Building frontage × depth",!R?wait:`${fmt1(g("BldgFront"))} × ${fmt1(g("BldgDepth"))} ft`],
    ["Residential units",fmt(P.units[i])],["Total units",!R?wait:fmt(g("UnitsTotal"))],["Gross floor area",sqft(g("BldgArea"))],
    ["Residential floor area",sqft(g("ResArea"))],["Commercial floor area",sqft(g("ComArea"))],["Office / retail",!R?wait:`${sqft(g("OfficeArea"))} / ${sqft(g("RetailArea"))}`],
    ["Garage / storage / factory",!R?wait:`${sqft(g("GarageArea"))} / ${sqft(g("StrgeArea"))} / ${sqft(g("FactryArea"))}`]]};
  const mih=[1,2,3,4].filter(k=>String(g("MIHOption"+k)||"")==="1").map(k=>"Option "+k);
  specs.zoning={title:"Zoning", kv:[["Zoning district",!R?esc(P.dict.zone[P.zone[i]]||"—"):esc(nonEmpty(g("ZoneDist1"),g("ZoneDist2"),g("ZoneDist3"),g("ZoneDist4")))],
    ["Commercial overlay",!R?wait:esc(nonEmpty(g("Overlay1"),g("Overlay2")))],["Special district",!R?wait:esc(nonEmpty(...["SPDist1","SPDist2","SPDist3"].map(f=>g(f)?spdName(g(f)):"")))],
    ["Limited height district",txt(g("LtdHeight"),"None")],["Split by a district line",!R?wait:g("SplitZone")==="Y"?"Yes":"No"],
    ...(has("TrnstZone")?[["Transit zone",txt(g("TrnstZone"))]]:[]),
    ...(has("MIHOption1")?[["Mandatory Inclusionary Housing",!R?wait:mih.length?mih.join(", "):"Not an MIH area"]]:[]),
    ["Zoning map",txt(g("ZoneMap"))],...(has("WideSt")?[["Street",txt(g("WideSt"))]]:[]),["E-designation",txt(g("EDesigNum"),"None")]]};

  const fkv=[["Built FAR",fmt(P.bfar[i],2)]];
  if (!F){
    fkv.push(["Maximum FAR (base)",`— <span class="soft">${NOT_YET.toLowerCase()}</span>`],["Unused FAR","—"],["Capacity category","—"],
      ["With qualifying / UAP housing (bonus)","—"],["With Mandatory Inclusionary Housing (bonus)","—"]); }
  else {
    const base=F.cols.find(c=>c.kind==="base");
    fkv.push([esc(base?base.label:"Maximum FAR"),fmt(F.base,2)],["Unused FAR",fmt(fd,2)],["Capacity category",P.fc[i]<P.dict.fc.length?esc(P.dict.fc[P.fc[i]]):"—"],
      ["Unbuilt floor area (unused FAR × lot area)",!Number.isNaN(fd)&&fd>0?fmt(fd*la)+" sq ft":"None"]);
    if (F.status) fkv.push(["Status",esc(FAR_STATUS[F.status]||F.status)]);
    for (const c of F.cols.filter(c=>c.kind==="bonus")) fkv.push([esc(c.label)+" (bonus)",Number.isNaN(c.v)?"—":`${fmt(c.v,2)} <span class="soft">${c.v-F.base>=0?"+":""}${fmt(c.v-F.base,2)}</span>`]);
    for (const c of F.cols.filter(c=>c.kind==="other")) fkv.push([esc(c.label),fmt(c.v,2)]); }
  fkv.push(["PLUTO residential FAR",!R?wait:fmt(g("ResidFAR"),2)],
    [has("AffResFAR")?"PLUTO affordable residential FAR":"PLUTO adjusted residential FAR",!R?wait:fmt(g("AffResFAR","AdjResFar"),2)],
    ["PLUTO commercial / community facility FAR",!R?wait:`${fmt(g("CommFAR"),2)} / ${fmt(g("FacilFAR"),2)}`],
    ...(has("ManuFAR")?[["PLUTO manufacturing FAR",!R?wait:fmt(g("ManuFAR"),2)]]:[]));
  const fl=+g("NumFloors")||0, bf=P.bfar[i], polys=lotRingsM(P,i);
  if (!polys) needLots(P,[i]).then(again).catch(()=>{});
  const outA=polys?polys.reduce((t,poly)=>t+ringArea(poly[0])-poly.slice(1).reduce((h,r)=>h+ringArea(r),0),0)*10.7639*eLng(P.lat[i])*eLat(P.lat[i])/(KX*MLAT):null;
  if (outA) fkv.splice(1,0,["Lot outline area (measured from the map)",`${fmt(outA)} sq ft${la&&Math.abs(outA-la)/la>0.25?` <span class="soft">vs ${fmt(la)} in PLUTO</span>`:""}`]);
  { const q=dqIssues(P,i), k=P.qa?P.qa.pos[i]:-1, oa=k>=0?P.qa.outA[k]:outA, ba=R?+g("BldgArea")||0:bf*la, msg=[];
    if (q.includes(1)||q.includes(2)) msg.push(`PLUTO's lot area (${fmt(la)} sq ft) is ${q.includes(1)?"smaller":"larger"} than the lot's outline (${fmt(oa)} sq ft), by ${fmt(Math.abs(oa-la)/la*100,0)}%. Built FAR on the outline: ${fmt(ba/oa,2)}${lot>=7501&&lot<=7599?" (common for condominium billing lots)":""}.`);
    if (q.includes(3)) msg.push(`Built FAR (${fmt(bf,2)}) is higher than the floor count${R?` (${fmt1(fl)})`:""}, which can't happen on one lot${q.includes(1)?"; the small lot area explains it":"; the floor area or floor count is the likelier error"}.`);
    if (q.includes(4)) msg.push(`Built FAR ${fmt(bf,2)} is above ${st.opts.dq.farMax}, unusual outside Manhattan; check the floor area and lot area.`);
    if (q.includes(5)) msg.push(`The unit count (${fmt(P.units[i])}) doesn't fit: ${Object.entries(DQ_FLAG_TEXT).filter(([b2])=>P.qa.flags[k]&+b2).map(([,t])=>t).join("; ")}.`);
    if (msg.length) specs.check={title:"Data check", warn:msg.join(" ")+` Area figures are ${dqModeText(st.opts.dq.mode)} (Customize charts).`}; }
  specs.far={title:"Floor area ratio", kv:fkv, about:"far"};
  if (F && R && (R.far_trace||R.split_shares)) specs.trace={title:"How this FAR was calculated", kv:[
    ...(R.split_shares?[["Share in each zoning district",esc(R.split_shares)]]:[]),...(R.far_trace?[["Portions and rules applied",`<code>${esc(R.far_trace)}</code>`]]:[])]};
  specs.districts={title:"Districts", kv:[["Community district",!R?wait:cd?(isJIA(cd)?`Joint interest area ${cd%100} (${BORO[Math.floor(cd/100)]||""}, PLUTO code ${cd})`:`${BORO[Math.floor(cd/100)]||""} CD ${cd%100}`):"—"],["City Council district",!R?wait:fmt(g("Council"))],
    ["School district",!R?wait:fmt(g("SchoolDist"))],["Police precinct",!R?wait:fmt(g("PolicePrct"))],["Fire company",txt(g("FireComp"))],["ZIP code",!R?wait:g("ZipCode")||"—"],
    ["Census tract (2020)",P.areas[P.tract[i]]?esc(P.areas[P.tract[i]].name):"—"],["Neighborhood (2020 NTA)",P.areas[P.nta[i]]?esc(P.areas[P.nta[i]].name):"—"]]};
  specs.misc={title:"Landmarks, flood and assessment", kv:[["Landmark",txt(g("Landmark"),"None")],["Historic district",txt(g("HistDist"),"None")],
    ["2015 preliminary flood map",!R?wait:g("PFIRM15_FLAG","PFIRM15_FL")?"In the 1% annual chance floodplain":"Not in the floodplain"],
    ["Assessed value, land / total",!R?wait:`${money(g("AssessLand"))} / ${money(g("AssessTot"))}`],["Exempt value",money(g("ExemptTot"))],
    ["Sanborn map / tax map",!R?wait:`${esc(g("Sanborn")||"—")} / ${esc(g("TaxMap")||"—")}`]]};
  const b5=String(block).padStart(5,"0"), l4=String(lot).padStart(4,"0");
  const bbl=Math.round(P.bbl[i]), lng=P.lng[i].toFixed(6), lat=P.lat[i].toFixed(6), zm=String(g("ZoneMap")||"").toLowerCase().replace(/^(\d)([a-z])$/,"0$1$2"), cdn=+cd||0, cou=+g("Council")||0;
  const condo=lot>=7501&&lot<=7599, L=(href,t)=>`<a href="${href}" target="_blank" rel="noopener">${t}</a>`;
  const groups=[["Property records",[L(`https://propertyinformationportal.nyc.gov/parcels/${condo?"condo":"parcel"}/${bbl}`,"Digital Tax Map"),
      L(`https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${boro}&block=${block}&lot=${lot}`,"ACRIS"),
      L(`https://a810-bisweb.nyc.gov/bisweb/PropertyBrowseByBBLServlet?allborough=${boro}&allblock=${block}&alllot=${lot}&go5=+GO+&requestid=0`,"DOB BIS"),
      L("https://hpdonline.nyc.gov/hpdonline/","HPD Online (search there by address)")]],
    ["Zoning and planning",[L(`https://zola.planning.nyc.gov/l/lot/${boro}/${block}/${lot}`,"Open in ZoLa"),
      ...(zm?[L(`https://zoningmap.nyc3.digitaloceanspaces.com/map${zm}.pdf`,`Zoning map ${esc(zm.toUpperCase())} (PDF)`),L(`https://zoningmap.nyc3.digitaloceanspaces.com/maps${zm}.pdf`,"Historical zoning maps (PDF)")]:[]),
      L(`https://zap.planning.nyc.gov/projects?applied-filters=dcp_publicstatus%2Cdistance_from_point%2Cradius_from_point&distance_from_point=${lng}%2C${lat}`,"Land use applications nearby (ZAP)"),
      L(`https://streets.planning.nyc.gov/about?lat=${lat}&lng=${lng}&zoom=17`,"City Map (Streets)")]],
    ["Neighborhood",[...(cdn&&!isJIA(cdn)?[L(`https://popfactfinder.planning.nyc.gov/explorer/districts/${cdn}`,"Population FactFinder"),
      L(`https://communityprofiles.planning.nyc.gov/${(BORO[Math.floor(cdn/100)]||"").toLowerCase().replace(/ /g,"-")}/${cdn%100}`,`Community District ${cdn%100} profile`)]:[]),
      ...(cou?[L(`https://council.nyc.gov/district-${cou}/`,`Council District ${cou}`)]:[]),
      L(`https://roadview.planninglabs.nyc/view/${lng}/${lat}`,"Street-level imagery"),L(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,"Google Maps")]]];
  const links=`<div class="lotlinks">${st.peek!=null?`<button data-selpeek>Select this lot</button>`:""}<a href="https://zola.planning.nyc.gov/l/lot/${boro}/${block}/${lot}" target="_blank" rel="noopener">Open in ZoLa</a>
    <a href="https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?boro=${boro}&block=${b5}&lot=${l4}" target="_blank" rel="noopener">DOB BIS</a>
    <a href="https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?borough=${boro}&block=${block}&lot=${lot}" target="_blank" rel="noopener">ACRIS</a>
    <button data-goblock="${boro*1e5+block}">Select block ${block}</button></div>`;
  specs.links={title:"Links", html:!R?`<p class="soft">${wait}</p>`:groups.map(([t,ls])=>`<div class="lgrp"><span>${t}</span><p>${ls.join("")}</p></div>`).join("")};
  return {specs, links, R};
}

function setDQ(ch){ Object.assign(st.opts.dq,ch); $$("#dqSeg button").forEach(b=>b.classList.toggle("on",b.dataset.v===st.opts.dq.mode));
  $("#dqArea").value=st.opts.dq.areaPct; $("#dqFar").value=st.opts.dq.farMax;
  if (st.colorBy==="dq"){ restyleLots(true); } renderProfile(); }
function optSummary(){ const g=groupsFrom(st.opts.div).length, x=st.opts.luExcl.size;
  $("#optSum").textContent=`${st.opts.style==="pies"?"Pies":"Bars"}, ${g===9?"every unit band":g+" unit groups"}${x?`, ${x} land use${x>1?"s":""} left out`:""}`; }
const shortName=s=>s.length>24?s.slice(0,23)+"…":s;
function renderSelbar(){
  const bar=$("#selbar"), n=st.sels.length; bar.hidden=n<2; if (n<2){ bar.innerHTML=""; return; }
  const on=v=>st.view===v?" on":"", C=st.combine;
  if (C){
    bar.innerHTML=`<div class="combinehead">Pick the selections to merge into one area, then press Merge.</div><div class="chips">
      ${st.sels.map((e,k)=>{ const t=selTitle(st.P,e.sel,0)[0]; return `<button data-pick-c="${k}" class="chip pickc${C.has(k)?" on":""}" title="${esc(t)}"><span class="box">${C.has(k)?"✓":""}</span><i style="background:${e.color}"></i>${esc(shortName(t))}</button>`; }).join("")}
      </div><div class="combineact"><button data-merge ${C.size<2?"disabled":""}>Merge ${C.size} into one area</button><button data-cancelc>Cancel</button></div>`;
    return; }
  bar.innerHTML=`<button data-v="prev" class="nav" title="Previous ([)">‹</button><div class="chips">
    <button data-v="all" class="chip${on("all")}">Combined</button><button data-v="cmp" class="chip${on("cmp")}">Side by side</button>
    ${st.sels.map((e,k)=>{ const t=selTitle(st.P,e.sel,0)[0]; return `<button data-v="${k}" class="chip${on(k)}" title="${esc(t)}"><i style="background:${e.color}"></i>${e.sel.type==="group"?"◎ ":""}${esc(shortName(t))}<b data-x="${k}" title="Remove this selection">×</b></button>`; }).join("")}
    </div><button data-v="next" class="nav" title="Next (])">›</button><button data-startc class="mergeb" title="Merge several circles, walksheds or drawn areas into one area">Merge…</button>`;
  const cur=bar.querySelector(".chip.on"); if (cur && cur.scrollIntoView) cur.scrollIntoView({block:"nearest",inline:"nearest"});
}
function compareSpecs(){
  const P=st.P, all={type:"multi",parts:st.sels.map(e=>e.sel)};
  const cols=[{name:"Combined",color:"#8795A3",pick:"all",S:computeStats(P,selIndices(P,all),st.opts)}]
    .concat(st.sels.map((e,k)=>({name:selTitle(P,e.sel,0)[0],color:e.color,pick:k,S:computeStats(P,selIndices(P,e.sel),st.opts)})));
  const M=[["Tax lots",S=>fmt(S.lots)],["Acres of lots",S=>fmt(S.acres,1)],["Housing units",S=>fmt(S.units)],["Units per acre",S=>fmt(S.upa,1)],
    ["Lots with housing",S=>fmt(S.resLots)],["Median lot, sq ft",S=>fmt(S.medLot)],["Land in 1-2 family homes",S=>fmt(pct(S.luA[0],S.area),1)+"%"],
    ["Units in 1-2 family homes",S=>fmt(pct(S.luU[0],S.units),1)+"%"],["Mean built FAR",S=>fmt(S.meanBuilt,2)],["Mean maximum FAR",S=>fmt(S.meanMax,2)],
    ["Allowed floor area built",S=>S.maxFA?fmt(S.builtFA/S.maxFA*100,1)+"%":"—"],["Underbuilt lots",S=>pctT(S.pctUnder)],
    ["Median year built",S=>S.medYear?Math.round(S.medYear):"—"],["Built before 1961",S=>fmt(S.pre61,1)+"%"]];
  const acres=v=>fmt(v/43560,1)+" acres";
  const specs={
    multi:{title:"Side by side",soft:"click a column to open it; widen the panel to see more",mcols:cols.map(c=>({name:c.name,color:c.color,pick:c.pick})),mrows:M.map(([k,f])=>[k,...cols.map(c=>f(c.S))]).filter(r=>r.slice(1).some(v=>v!=="—"))},
    lub:{title:"Land use by selection",soft:"share of land area",bars:cols.map(c=>({name:c.name,color:c.color,pick:c.pick,
      segs:[...Array(12).keys()].map(k=>seg(P.dict.lu[k],LU_COLORS[k],c.S.luA[k],c.S.area,"of land area",acres(c.S.luA[k])))}))},
    ubb:{title:"Housing by units per building",soft:"share of housing units",bars:cols.map(c=>{ const g=c.S.groups, gc=groupColors(g.length), t=c.S.ubU.reduce((a,b)=>a+b,0);
      return {name:c.name,color:c.color,pick:c.pick,segs:g.map((x,i)=>seg(groupLabel(x),gc[i],c.S.ubU[i],t,"of housing units",fmt(c.S.ubU[i])+" units"))}; })},
    fcb:P.far?{title:"Zoning capacity (FAR)",soft:"share of analyzed lots",bars:cols.map(c=>({name:c.name,color:c.color,pick:c.pick,
      segs:P.dict.fc.map((k,i)=>seg(k,FC_COLORS[i],c.S.fcL[i],c.S.filtered,"of analyzed lots",fmt(c.S.fcL[i])+" lots"))}))}
      :{title:"Zoning capacity (FAR)",soft:NOT_YET,placeholder:"Maximum FAR for this release will be added when it has been modeled.",about:"far"},
  };
  return {specs, S:cols[0].S};
}

function clipTargets(){ const n=st.sels.length; if (!n) return [];
  const ks=n===1?[0]:typeof st.view==="number"?[st.view]:st.sels.map((_,k)=>k); return ks.filter(k=>clippable(st.sels[k].sel)); }
function renderClipRow(){
  const row=$("#clipRow"), ks=clipTargets(), sel=st.sel;
  if (!ks.length || (sel&&sel.type==="lots")){ row.hidden=true; row.innerHTML=""; return; }
  const vals=[...new Set(ks.flatMap(k=>clipsIn(st.sels[k].sel)))];
  row.hidden=false; row.innerHTML=`<label title="How lots on the boundary are treated">Lot inclusion ${clipSelect(vals[0],vals.length>1)}</label>`+
    (ks.length>1&&ks.length<st.sels.length?` <span class="soft">applies to ${ks.length} of ${st.sels.length} selections</span>`:"");
}
function applyClip(v){
  const ks=clipTargets(); st.clip=v; if (!ks.length) return;
  const set=x=>x.type==="group"?{...x,parts:x.parts.map(p=>isShape(p)?{...p,clip:v}:p)}:{...x,clip:v};
  pushUndo(); ks.forEach(k=>{ st.sels[k]={...st.sels[k],sel:set(st.sels[k].sel)}; });
  drawSelection(); renderProfile(); writeHash(); toast(`Lot inclusion: ${CLIP_NAME[v].toLowerCase()}.`,"Undo",undo);
}

function lotRecord(i, extra){
  const P=st.P, {specs,links,R}=lotSpecs(i); st.specs=specs; st.S=null;
  const note=P.far?`Maximum FAR: ${esc(P.far.H.source||"FAR table")}. Confirm lot-specific rules in ZoLa and the Zoning Resolution.`
    :`Maximum FAR is ${NOT_YET.toLowerCase()}; the PLUTO FAR fields are DCP's district values for ZoneDist1.`;
  const bb=Math.round(P.bbl[i]), {block:bk,lot:lt}=bblParts(bb), zip=R&&R.ZipCode?` ${R.ZipCode}`:"";
  return `<div class="lotids"><span>${BORO[Math.floor(bb/1e9)]||""}${zip}</span><span>Block ${bk}, lot ${lt}</span><span class="bblchip">BBL <b>${bb}</b><button data-copybbl="${bb}" title="Copy the BBL">Copy</button></span></div>
    <div class="tiles"><div><div class="v">${fmt(P.area[i])}</div><div class="k">Lot area, sq ft</div></div>
      <div><div class="v">${R?fmt(R.BldgArea):"…"}</div><div class="k">Floor area, sq ft</div></div>
      <div><div class="v">${fmt(P.units[i])}</div><div class="k">Housing units</div></div>
      <div><div class="v">${fmt(P.bfar[i],2)}<span class="d eq"> of ${fmt(P.mfar[i],2)}</span></div><div class="k">Built FAR of maximum</div></div></div>
      ${links}${Object.entries(specs).sort((a,b)=>(b[0]==="check")-(a[0]==="check")).map(([k,sp])=>sectionHTML(k,sp).replace(/<span class="grip"[^>]*>⋮⋮<\/span>/,"")).join("")}
      <p class="note">From MapPLUTO ${P.id}. ${note}</p>`;
}
function renderProfile(){
  const prof=$("#profile"), sel=st.sel, P=st.P; optSummary(); renderClipRow();
  $("#actions").hidden=!sel; $("#btnX").hidden=!st.sels.length;
  const g=sel&&sel.type==="group"; $("#btnSplit").hidden=!g; $("#btnAddTo").hidden=!g;
  if (g){ $("#btnSplit").textContent="Split"; $("#btnSplit").title=`Turn this merged area back into its ${sel.parts.length} separate parts`; const on=st.addTo===curIndex(); $("#btnAddTo").textContent=on?"Done adding":"Add circles"; $("#btnAddTo").classList.toggle("on",on); }
  $("#back").hidden=!(sel&&st.prevSel);
  if (st.prevSel){ const ps=st.prevSel, s=ps.sels.length===1?ps.sels[0].sel:typeof ps.view==="number"?ps.sels[ps.view].sel:{type:"multi",parts:ps.sels.map(e=>e.sel)};
    $("#btnBack").textContent="← Back to "+selTitle(P,s,0)[0]; }
  renderSelbar();
  if (st.peek!=null){
    const i=P.bblIdx.get(st.peek);
    if (i!=null){
      const [name,sub]=selTitle(P,{type:"lots",bbls:[st.peek]},1);
      $("#areaName").textContent=name; $("#areaSub").textContent=sub; $("#opts").hidden=true; $("#actions").hidden=true; $("#clipRow").hidden=true; $("#btnX").hidden=true;
      $("#back").hidden=false; $("#btnBack").textContent=sel?"← Back to "+selTitle(P,sel,0)[0]:"Close";
      prof.innerHTML=lotRecord(i);
      return; }
    st.peek=null; }
  if (!sel){ $("#opts").hidden=true; $("#areaName").textContent="Pick an area to profile";
    $("#areaSub").textContent=`${fmt(P.n)} tax lots in ${(P.rel.coverage||"the release").replace(/^Five/,"five")}, MapPLUTO ${P.id}`;
    prof.innerHTML=`<div class="empty"><p class="guideptr">New here? <button class="link" data-guide>Open the quick guide</button> (the <b>?</b> at the top).</p><b>Click any lot</b> to see its record (the pointer tool; zoom in to see lots), or switch tools: <b>Lot</b> and <b>Block</b> work like ZoLa, <b>NTAs</b> and <b>Tracts</b> pick census geographies, <b>Draw</b> traces your own boundary, and <b>Radius</b> measures from any point, subway entrance or station. <b>＋ Add</b> keeps earlier selections so you can compare them, and Ctrl+Z undoes. Search takes an address, a BBL, a borough-block-lot such as 3 5634 12, or a station name.</div>`; return; }
  const idx=selIndices(P,sel);
  const [name,sub]=selTitle(P,sel,idx.length);
  $("#areaName").textContent=name; $("#areaSub").textContent=sub+(st.opts.dq.mode!=="pluto"?`; figures ${dqModeText(st.opts.dq.mode)}`:"")+(st.opts.boroExcl.size?`; counting ${Object.keys(BORO).filter(b=>!st.opts.boroExcl.has(+b)).map(b=>BORO[b]).join(", ")} only`:"")+(st.opts.luExcl.size&&!(sel.type==="lots"&&idx.length===1)?`; ${st.opts.luExcl.size} land use${st.opts.luExcl.size>1?"s":""} left out`:"")+(idx.provisional?" (checking lots on the boundary…)":"");
  if (sel.type==="lots" && idx.length===1){ $("#opts").hidden=true; prof.innerHTML=lotRecord(idx[0]); return; }

  $("#opts").hidden=false;
  if (st.sels.length>1 && st.view==="cmp"){
    const {specs,S}=compareSpecs(); st.specs=specs; st.S=S;
    $("#areaName").textContent=`Comparing ${st.sels.length} selections`;
    $("#areaSub").textContent="One column per selection. Combined counts lots that fall in more than one selection once.";
    prof.innerHTML=Object.entries(specs).map(([k,sp])=>sectionHTML(k,sp).replace(/<span class="grip"[^>]*>⋮⋮<\/span>/,"")).join("")+
      `<p class="note">Straight-line walksheds and radii; each one counts lots by the rule shown under the title. Source: NYC DCP MapPLUTO ${P.id}${st.T?"; MTA Open Data; © OpenStreetMap contributors":""}.</p>`;
    return; }
  const S=computeStats(P,idx,st.opts); let B=null, Sc=S;
  if (st.C){ const cidx=selIndices(st.C,sel), mixed=!!P.far!==!!st.C.far;
    B=computeStats(st.C,cidx,st.opts,mixed); if (mixed) Sc=computeStats(P,idx,st.opts,true); }
  st.specs=sectionSpecs(S,B,Sc); st.S=S;
  const dl=(a,b,dg=0)=>{ if(!B) return ""; const x=a-b; if(Math.abs(x)<Math.pow(10,-dg)/2) return ""; return `<span class="d ${x>0?"up":"dn"}">${x>0?"+":""}${fmt(x,dg)}</span>`; };
  const order=(B?["cmp"]:[]).concat(st.opts.order).filter(k=>st.specs[k]);
  const shA=clippable(sel)&&clipsIn(sel).includes("touch")?shapeAcres(sel):null, over=shA&&S.acres>shA*1.2;
  const boros=[...new Set(Array.from(idx,i=>Math.floor(P.bbl[i]/1e9)))].sort();
  const boroLine=boros.length>1||st.opts.boroExcl.size?`<p class="borol">${boros.length>1?`Spans ${boros.map(b=>BORO[b]).join(", ")}. Count only: ${boros.map(b=>`<button class="link" data-onlyboro="${b}">${BORO[b]}</button>`).join(" · ")}`:""}${st.opts.boroExcl.size?` ${[...st.opts.boroExcl].map(b=>BORO[b]).join(", ")} left out. <button class="link" data-onlyboro="all">Count every borough</button>`:""}</p>`:"";
  const dqLine=S.dqLots||st.opts.dq.mode!=="pluto"?`<p class="dqline"><b>${fmt(S.dqLots)} lot${S.dqLots===1?"":"s"}</b> here ${S.dqLots===1?"has":"have"} possible PLUTO data issues (${fmt(S.dqUnits)} units). Figures: ${[["pluto","As published"],["fix","Recomputed"],["exclude","Leave them out"]].map(([k,t])=>`<button class="link${st.opts.dq.mode===k?" on":""}" data-dqmode="${k}">${t}</button>`).join(" · ")}${st.colorBy!=="dq"?` · <button class="link" data-dqview>Show on map</button>`:""}${st.opts.dq.mode==="fix"&&S.dqFixed?` <span class="soft">(${fmt(S.dqFixed)} lot areas replaced by their outline)</span>`:""}</p>`:"";
  prof.innerHTML=`${boroLine}${dqLine}${over?`<p class="warn spill">The lots counted cover ${fmt(S.acres,0)} acres, but the shape itself is ${fmt(shA,0)} acres: large lots (parks, rail yards, campuses) that only touch it count in full under <b>Intersecting</b>. <button class="link" data-clipto="center">Use Centroid within</button> or <button class="link" data-clipto="most">Majority within</button>.</p>`:""}<div class="tiles">
      <div><div class="v">${fmt(S.lots)}${dl(S.lots,B&&B.lots)}</div><div class="k">Tax lots</div></div>
      <div><div class="v">${fmt(S.acres,1)}${dl(S.acres,B&&B.acres,1)}</div><div class="k">Acres of lots</div></div>
      <div><div class="v">${fmt(S.units)}${dl(S.units,B&&B.units)}</div><div class="k">Housing units</div></div>
      <div><div class="v">${fmt(S.upa,1)}${dl(S.upa||0,B&&(B.upa||0),1)}</div><div class="k">Units per acre</div></div></div>
    <p class="subline">${fmt(S.resLots)} lots with housing. The median lot is ${fmt(S.medLot)} sq ft.</p>
    ${order.map(k=>sectionHTML(k,st.specs[k])).join("")}
    <p class="note">${clippable(sel)?`Lot inclusion: ${clipsIn(sel).map(c=>CLIP_NAME[c]+" ("+CLIP_DESC[c].replace(/\.$/,"").replace(/^./,x=>x.toLowerCase())+")").join("; ")}. `:""}${clippable(sel)?"Walksheds are straight-line from station entrances, not walking routes. ":""}${S.hasFar?"FAR figures cover analyzed lots only: parks, transit and lots with no modeled maximum are left out.":`Maximum FAR is ${NOT_YET.toLowerCase()}; built FAR and building age cover every lot with a value.`} Source: NYC DCP MapPLUTO ${P.id}${st.C?` and ${st.C.id}`:""}${st.T?"; MTA Open Data; © OpenStreetMap contributors":""}.</p>`;
}

const NONE_V=-99999;
const rangeFor=v=>st.map.range[v]||(st.map.range[v]=/^g_/.test(v)?[0,2]:[...RANGE_DEFAULT.mf]);
function rampStops(v){ const [lo,hi]=rangeFor(v);
  if (v==="fd"&&schemeOf("fd")!=="standard"){ const a=Math.min(lo,-0.01), b=Math.max(hi,0.01), C=SCHEMES[schemeOf("fd")].c, mid=(C.length-1)/2, out=[];
    C.forEach((c,k)=>out.push(k<=mid?a*(1-k/mid):b*((k-mid)/(C.length-1-mid)),c)); return out; }
  if (v==="fd"){ const a=Math.min(lo,-0.01), b=Math.max(hi,0.01);
    return [a,"#B83A2E",a*0.2,"#EBB3A5",0,"#F1EEE6",b/6,"#A7CBA0",b/2,"#3A8356",b,"#0D4A2E"]; }
  const sc=schemeOf(v), R=sc==="standard"?RAMPS[/^g_/.test(v)?"greens":"blues"]:SCHEMES[sc].c, out=[]; R.forEach((c,k)=>out.push(lo+(hi-lo)*k/(R.length-1),c)); return out; }
const farReady=v=>!isFarView(v)||!!st.P.far;

function colorExpr(v, get){
  if (!farReady(v)) return NODATA;
  if (v==="fl"){ const f=["match",flClassExpr(get(v))]; FL_COLORS.forEach((c,i)=>f.push(i,c)); f.push(NODATA); return f; }
  const m=["match",get(v)];
  if (v==="lu"){ LU_COLORS.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="ub"){ UB_RAMP.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="fc"){ FC_COLORS.forEach((c,i)=>m.push(i,c)); m.push(NODATA); return m; }
  if (v==="dq"){ DQ_COLORS.forEach((c,i)=>m.push(i,c)); m.push(DQ_COLORS[0]); return m; }
  if (v==="zn"){ st.P.dict.zone.forEach((z,i)=>m.push(i,zoneColor(z))); m.push(NODATA); return m; }
  if (v==="yb") return ["case",["<=",get("yb"),0],NODATA,["step",get("yb"),YB_CLASSES[0][3],1900,YB_CLASSES[1][3],1930,YB_CLASSES[2][3],1961,YB_CLASSES[3][3],1990,YB_CLASSES[4][3]]];
  const s=rampStops(v), hi=rangeFor(v)[1], x=get(v);
  return ["case",["<",x,v==="bf"?0:-999],NODATA,["interpolate",["linear"],["min",x,hi],...s]];
}
const tileGet=v=>CAT_VIEWS.has(v)||v==="yb"?["coalesce",["get",v],-1]:["/",["coalesce",["get",v],NONE_V],100];
const stateGet=v=>["coalesce",["feature-state","v"],-99999];

const CLEAR="rgba(0,0,0,0)";
function fillColor(){
  if (st.colorBy==="dq") return dqLotExpr();
  const v=st.colorBy, col=colorExpr(v,tileGet), hid=CAT_VIEWS.has(v)&&farReady(v)?[...st.map.hidden[v]]:[], ex=[...st.opts.luExcl], c=["case"];
  if (hid.length) c.push(["in",v==="fl"?flClassExpr(["coalesce",["get",v],-1]):["coalesce",["get",v],-1],["literal",hid]],CLEAR);
  if (ex.length) c.push(["in",["get","lu"],["literal",ex]],["let","c",["to-rgba",col],["rgba",["at",0,["var","c"]],["at",1,["var","c"]],["at",2,["var","c"]],0.19]]);
  return c.length===1?col:[...c,col];
}

const FADE_STATE_MAX=60000;
let fadeLots=new Set(), fadeBlocks=new Set(), fadeBig=false;
const dimOn=()=>{ const idx=st.curIdx; return !!(st.map.dim && idx && idx.length && idx.length<st.P.n); };
const fillOp=()=>st.map.fill?st.map.opacity:0;
const topAlpha=(op,on)=>on?0:Math.max(0,(op-op*0.22)/(1-op*0.22));
function lotOpacity(){
  const op=fillOp(), idx=st.curIdx, n=st.P.n;
  if (fadeBig && dimOn()){ const inside=idx.length<=n/2, set=inside?Array.from(idx):(()=>{ const h=new Uint8Array(n); idx.forEach(i=>h[i]=1); const o=[]; for(let i=0;i<n;i++) if(!h[i]) o.push(i); return o; })();
    return ["case",["match",["get","i"],set,!inside,inside],op*0.22,op]; }
  return ["case",["boolean",["feature-state","s"],false],op,op*0.22];
}
function blockOpacity(){ const op=fillOp();
  const z=lotZ(); return ["interpolate",["linear"],["zoom"],z-0.4,["case",["boolean",["feature-state","h"],false],0,["boolean",["feature-state","s"],false],op,op*0.22],z,0]; }
function topOpacities(){
  if (!map||!map.getLayer("lots-top")) return;
  const on=dimOn(), op=fillOp();
  map.setPaintProperty("lots-top","fill-opacity",fadeBig?0:topAlpha(op,on));
  map.setPaintProperty("blocks-top","fill-opacity",["interpolate",["linear"],["zoom"],lotZ()-0.4,topAlpha(op,on),lotZ(),0]);
}

function applyFade(){
  if (!map||!map.getSource("lots")) return;
  const P=st.P, idx=st.curIdx, on=dimOn(), big=on&&idx.length>FADE_STATE_MAX;
  const want=new Set(on&&!big?idx:[]), wantB=new Set(); if (on) for (const i of idx) wantB.add(P.blk[i]);
  const L={source:"lots",sourceLayer:"lots"}, B={source:"blocks",sourceLayer:"blocks"};
  for (const i of fadeLots) if (!want.has(i)) map.setFeatureState({...L,id:i},{s:false});
  for (const i of want) if (!fadeLots.has(i)) map.setFeatureState({...L,id:i},{s:true});
  for (const j of fadeBlocks) if (!wantB.has(j)) map.setFeatureState({...B,id:j},{s:false});
  for (const j of wantB) if (!fadeBlocks.has(j)) map.setFeatureState({...B,id:j},{s:true});
  fadeLots=want; fadeBlocks=wantB;
  if (big!==fadeBig || big){ fadeBig=big; map.setPaintProperty("lots","fill-opacity",lotOpacity()); }
  topOpacities();
}
function resetFade(){ fadeLots=new Set(); fadeBlocks=new Set(); fadeBig=false; }

const AGG={cat:[["area","Most common, by land area"],["lots","Most common, by number of lots"],["units","Most common, by housing units"]],
  num:[["mean","Average, weighted by land area"],["median","Median lot"],["max","Highest lot"],["min","Lowest lot"]],
  yb:[["median","Median year"],["min","Oldest building"],["max","Newest building"]]};
AGG.fl=[...AGG.cat,["median","Median lot"],["max","Tallest building"]];
const aggKind=v=>v==="yb"||v==="fl"?v:CAT_VIEWS.has(v)?"cat":"num";
const AGG_NOTE={area:"its most common value by land area",lots:"its most common value by number of lots",units:"its most common value by housing units",
  mean:"its land-area-weighted average",median:"its median lot",max:"its highest lot",min:"its lowest lot"};
function blockValues(P, v){
  const B=P.blocks.length, out=new Float64Array(B).fill(NaN), ex=st.opts.luExcl;
  if (!farReady(v)) return out;
  if (v==="dq"){ const c=dqAll(P), cnt=new Uint32Array(6);
    for (let j=0;j<B;j++){ cnt.fill(0); for (let t=P.blkStart[j];t<P.blkStart[j+1];t++) cnt[c[P.blkLots[t]]]++;
      let best=0; for (let k=1;k<6;k++) if (cnt[k]>cnt[best]||(best===0&&cnt[k]>0)) best=k; out[j]=best; }
    return out; }
  if (v==="fl"){ const F=P.floors, ag=st.map.blockAgg.fl, LO=[...FL_CLASSES.map(c=>c[1]),0], cnt=new Float64Array(9); if (!F) return out;
    for (let j=0;j<B;j++){ const s=P.blkStart[j], e=P.blkStart[j+1];
      if (ag==="median"||ag==="max"){ const xs=[]; for (let t=s;t<e;t++){ const i=P.blkLots[t]; if (!ex.has(P.lu[i])&&F[i]>0) xs.push(F[i]); }
        if (xs.length){ xs.sort((a,b)=>a-b); out[j]=ag==="max"?xs[xs.length-1]:xs[xs.length>>1]; } continue; }
      cnt.fill(0); let any=false;
      for (let t=s;t<e;t++){ const i=P.blkLots[t]; if (ex.has(P.lu[i])) continue; const wt=ag==="lots"?1:ag==="units"?P.units[i]:(P.area[i]||1); if (!(wt>0)) continue; cnt[flClass(F[i])]+=wt; any=true; }
      if (any){ let best=0; for (let k=1;k<9;k++) if (cnt[k]>cnt[best]) best=k; out[j]=LO[best]; } }
    return out; }
  const cat=CAT_VIEWS.has(v), arr=v==="lu"?P.lu:v==="ub"?P.ub:v==="zn"?P.zone:v==="fc"?P.fc:null;
  const num=v==="bf"?P.bfar:v==="mf"?P.mfar:v==="fd"?P.fdiff:/^[bg]_/.test(v)&&P.far?(()=>{ const k="far_"+v.slice(2), b=P.far.data[k], base=P.mfar;
    if (!b) return null; if (v[0]==="b") return b; const g=new Float32Array(P.n); for (let i=0;i<P.n;i++) g[i]=b[i]-base[i]; return g; })():null;
  const acc=new Map(), ag=st.map.blockAgg;
  for (let j=0;j<B;j++){
    if (v==="yb"){ const ys=[]; for (let t=P.blkStart[j];t<P.blkStart[j+1];t++){ const i=P.blkLots[t]; if (ex.has(P.lu[i])) continue; const y=P.year[i]; if (y>0) ys.push(y); }
      if (ys.length){ ys.sort((a,b)=>a-b); out[j]=ag.yb==="min"?ys[0]:ag.yb==="max"?ys[ys.length-1]:ys[ys.length>>1]; } continue; }
    if (cat){ acc.clear(); let best=-1, bv=0;
      for (let t=P.blkStart[j];t<P.blkStart[j+1];t++){ const i=P.blkLots[t]; if (ex.has(P.lu[i])) continue;
        const wt=ag.cat==="lots"?1:ag.cat==="units"?P.units[i]:(P.area[i]||1); if (!(wt>0)) continue;
        const k=arr[i], a=(acc.get(k)||0)+wt; acc.set(k,a); if (a>bv){ bv=a; best=k; } }
      if (best>=0) out[j]=best; continue; }
    if (num){ let s=0, w=0, lo=Infinity, hi=-Infinity; const xs=ag.num==="median"?[]:null;
      for (let t=P.blkStart[j];t<P.blkStart[j+1];t++){ const i=P.blkLots[t]; if (ex.has(P.lu[i])) continue; const x=num[i]; if (Number.isNaN(x)) continue; const a=P.area[i]||1;
        s+=x*a; w+=a; if (x<lo) lo=x; if (x>hi) hi=x; if (xs) xs.push(x); }
      if (w) out[j]=ag.num==="max"?hi:ag.num==="min"?lo:xs?(xs.sort((a,b)=>a-b),xs[xs.length>>1]):s/w; } }
  return out;
}
let blockKey="", blockStateN=0;

function styleBlocks(force){
  if (!map||!map.getSource("blocks")) return;
  const P=st.P, v=st.colorBy, hid=CAT_VIEWS.has(v)?st.map.hidden[v]:new Set();
  const key=[P.id,v,[...st.opts.luExcl].join(),[...hid].join(),st.map.range[v],st.map.blockAgg[aggKind(v)],v==="dq"?JSON.stringify(st.opts.dq)+(P.qa?1:0):""].join("|");
  if (!force&&key===blockKey) return;
  blockKey=key; const vals=blockValues(P,v), sl={source:"blocks",sourceLayer:"blocks"};
  for (let j=0;j<vals.length;j++){ const x=vals[j]; map.setFeatureState({...sl,id:j},{v:Number.isNaN(x)?null:x,h:CAT_VIEWS.has(v)&&hid.has(v==="fl"?flClass(x):x)}); }
  for (let j=vals.length;j<blockStateN;j++) map.setFeatureState({...sl,id:j},{v:null,h:false});
  blockStateN=Math.max(blockStateN,vals.length);
  const col=colorExpr(v,stateGet);
  map.setPaintProperty("blocks-fill","fill-color",col);
  map.setPaintProperty("blocks-top","fill-color",["case",["boolean",["feature-state","h"],false],CLEAR,col]);
}
function renderLegend(){
  const v=st.colorBy, H=CAT_VIEWS.has(v)?st.map.hidden[v]:null, ready=farReady(v);
  const editable=["ub","yb","fc","zn","fl"].includes(v)&&ready&&st.map.fill;
  const sw=(code,c,t,ck=code)=>`<div${code!=null&&ready?` data-c="${code}" class="${H&&H.has(code)?"hid":""}" title="Click to hide or show"`:""}>${editable&&ck!=null&&code!==255?`<label class="pick" style="background:${c}" title="Change this color"><input type="color" data-col="${esc(String(ck))}" value="${c.toLowerCase()}" aria-label="Color for ${esc(t)}"></label>`:`<i style="background:${c}"></i>`}${esc(t)}</div>`;
  let h="";
  if (v==="lu") h=st.P.dict.lu.map((t,i)=>sw(i,LU_COLORS[i],t)).join("");
  if (v==="ub") h=st.P.dict.ub.map((t,i)=>sw(i,UB_RAMP[i],t.replace("-","–"))).join("")+sw(255,NODATA,"No housing");
  if (v==="fc") h=(ready?st.P.dict.fc:st.P.dict.fc.slice(0,7)).map((t,i)=>sw(i,FC_COLORS[i],t)).join("");
  if (v==="zn"){ const used=new Set(st.P.zone); h=st.P.dict.zone.map((z,i)=>used.has(i)?sw(i,zoneColor(z),z||"None",z||null):"").join(""); }
  if (v==="yb") h=YB_CLASSES.map((c,k)=>sw(null,c[3],c[0],k)).join("")+sw(null,NODATA,"Unknown");
  if (v==="fl") h=FL_CLASSES.map((c,k)=>sw(k,FL_COLORS[k],c[0])).join("")+sw(8,NODATA,"Unknown",null)+`<div class="shint">${st.P.floors?"PLUTO floor count of the tallest building on the lot; partial floors count down (2½ and 2¾ show as 2).":"This release has no floor counts."}</div>`;
  if (v==="dq"){ const c=dqAll(st.P), n=new Uint32Array(6); for (const x of c) n[x]++;
    h=[1,2,3,4,5,0].map(k=>sw(k,DQ_COLORS[k],`${DQ_NAMES[k]} (${fmt(n[k])})`)).join("")+
      `<div class="shint">${st.P.qa?`Lot area flags use the outline in MapPLUTO (off by more than ${st.opts.dq.areaPct}%).`:"This release has no outline or unit checks; only the high-FAR flag applies."} Thresholds and how figures treat these lots: Customize charts.</div>`; }
  const cont=!CAT_VIEWS.has(v)&&v!=="yb";
  if (cont){ const s=rampStops(v), cols=[]; for(let k=1;k<s.length;k+=2) cols.push(s[k]);
    const [lo,hi]=rangeFor(v);
    h=`<div class="ramp" style="background:linear-gradient(90deg,${cols.join(",")})"></div><div class="rl"><span>${fmt(lo,1)}${v==="fd"?" (over)":""}</span><span>${fmt((lo+hi)/2,1)}</span><span>${fmt(hi,1)}+</span></div>`+sw(null,NODATA,"No value");
    $("#rMin").value=lo; $("#rMax").value=hi; }
  const ch=schemeChoices(v);
  if (ch.length&&ready&&st.map.fill) h=`<label class="rrow palrow">Colors <select id="palSel">${ch.map(([k,n])=>`<option value="${k}"${schemeOf(v)===k?" selected":""}>${esc(n)}</option>`).join("")}</select></label>`+h;
  if (!st.map.fill) h=`<div class="legnote">Lot colors are off, so only lot lines show. Turn them back on under Customize map or Zoning map.</div>`;
  else if (!ready) h=`<div class="legnote">${NOT_YET}. Lots show in grey.</div><div class="greyed">${h}</div>`;
  else if (H||editable||colorsChanged(v)) h+=`<div class="shint">${H?"Click a category to hide it":""}${H&&editable?"; click":editable?"Click":""}${editable?" its color to change it":""}.${colorsChanged(v)?` <button class="linkbtn" data-resetcol="${v}">Reset colors</button>`:""}</div>`;
  if (map && map.getZoom()<lotZ()) h+=`<div class="shint">Zoomed out, each tax block shows ${v==="yb"?{median:"its median year",min:"its oldest building",max:"its newest building"}[st.map.blockAgg.yb]:(v==="fl"&&st.map.blockAgg.fl==="max"?"its tallest building":AGG_NOTE[st.map.blockAgg[aggKind(v)]])}. Zoom in to see lots${lotZ()>LOT_ZOOMS[LOT_ZOOMS.length-1]?`, or <button class="linkbtn" data-lotz="${LOT_ZOOMS[LOT_ZOOMS.length-1]}">show lots from zoom ${LOT_ZOOMS[LOT_ZOOMS.length-1]}</button>`:""}.</div>`;
  $("#swatches").innerHTML=h; $("#rangeBox").hidden=!cont||!ready;
  const ak=aggKind(v), as=$("#blockAgg"); as.innerHTML=AGG[ak].map(([k,t])=>`<option value="${k}"${st.map.blockAgg[ak]===k?" selected":""}>${t}</option>`).join("");
  $(".aggrow").hidden=!ready||!st.map.fill||v==="dq"; showZoom();
}

function showZoom(){ const e=$("#zNow"); if (!e||!map) return; const z=map.getZoom(); e.textContent=`Now ${z.toFixed(1)}: ${z>=lotZ()?"lots":"blocks"}`; }
function lotZ(){ const s=map&&map.getSource("lots"), tmin=s&&typeof s.minzoom==="number"&&s.minzoom>0?s.minzoom:LOT_MINZOOM;
  return Math.max(st.map.lotZ,Math.min(tmin,LOT_MINZOOM)); }
function applyLotZoom(){
  if (!map||!map.getLayer("lots")) return; const z=lotZ();
  ["lots","lots-top","lot-line","lot-hl"].forEach(id=>map.setLayerZoomRange(id,z,24));
  map.setLayerZoomRange("blocks-top",0,z); map.setLayerZoomRange("blk-line",12.5,Math.max(z,12.5));
  map.setPaintProperty("blocks-fill","fill-opacity",blockOpacity()); topOpacities();
  { const s=map.getSource("lots"), tmin=s&&s.minzoom>0?s.minzoom:LOT_MINZOOM;
    $$("#lzSeg button").forEach(b=>{ b.classList.toggle("on",+b.dataset.z===z); b.disabled=+b.dataset.z<Math.min(tmin,LOT_MINZOOM); }); }
  renderLegend(); }
function setLotZoom(z){ st.map.lotZ=z; try{ localStorage.setItem("lp-lot-zoom",String(z)); }catch(_){} applyLotZoom(); }
function restyleLots(force){ if(!map||!map.getLayer("lots")) return; const c=fillColor();
  map.setPaintProperty("lots","fill-color",c); map.setPaintProperty("lots-top","fill-color",c); styleBlocks(force); renderLegend(); }

function loadColors(){ try{ const c=JSON.parse(localStorage.getItem("lp-colors2")||"null"); if (c&&typeof c==="object") return {scheme:c.scheme||{},custom:c.custom||{}}; }catch(_){}
  return {scheme:{},custom:{}}; }
function applyColors(){
  const pick=(v,base,n)=>{ const s=schemeOf(v); return s==="standard"||!SCHEMES[s]?[...base]:sample(SCHEMES[s].c,n,s==="distinct"); };
  (LU_SCHEMES[schemeOf("lu")]||LU_SCHEMES.standard).forEach((c,i)=>LU_COLORS[i]=c);
  pick("ub",UB_BASE,9).forEach((c,i)=>UB_RAMP[i]=c);
  pick("yb",YB_BASE,5).forEach((c,i)=>YB_CLASSES[i][3]=c);
  pick("fl",FL_BASE,8).forEach((c,i)=>FL_COLORS[i]=c);
  const f=pick("fc",FC_BASE.slice(0,5),5); FC_BASE.forEach((c,i)=>FC_COLORS[i]=i<5?f[i]:c);
  const T={ub:UB_RAMP,fc:FC_COLORS,fl:FL_COLORS};
  for (const [v,m] of Object.entries(st.colors.custom)) for (const [i,c] of Object.entries(m||{})) if (/^#[0-9a-f]{6}$/i.test(c)){
    if (T[v]) T[v][+i]=c; else if (v==="yb"&&YB_CLASSES[+i]) YB_CLASSES[+i][3]=c; }
}
function setColors(fn){ fn(st.colors); try{ localStorage.setItem("lp-colors2",JSON.stringify(st.colors)); }catch(_){}
  applyColors(); restyleLots(true); renderProfile(); $$("#luFilter i").forEach((el,i)=>el.style.background=LU_COLORS[i]); }
const colorsChanged=v=>!!(st.colors.custom[v]&&Object.keys(st.colors.custom[v]).length)||schemeOf(v)!==schemeDefault(v);

const zdFillOp=()=>st.map.fill?0:0.5;
function setFillOpacity(){ if (map.getLayer("zd-hit")) map.setPaintProperty("zd-hit","fill-opacity",zdFillOp()); map.setPaintProperty("lots","fill-opacity",lotOpacity()); map.setPaintProperty("blocks-fill","fill-opacity",blockOpacity()); topOpacities(); }
const vis=(id,on)=>{ if(map&&map.getLayer(id)) map.setLayoutProperty(id,"visibility",on?"visible":"none"); };
const ZON_LAYERS={zd:["zd-hit","zd-line","zd-label"],co:["co-fill","co-line","co-label"],sp:["sp-fill","sp-line","sp-label"],ss:["ss-fill","ss-line","ss-label"],lh:["lh-fill","lh-line","lh-label"]};
function applyMapOpts(){
  const o=st.map, B=st.base||{fills:[],syms:[]};
  B.fills.forEach(id=>vis(id,o.basemap==="map")); B.syms.forEach(id=>vis(id,o.labels&&o.basemap!=="none"));
  vis("sat",o.basemap==="sat"); vis("lot-line",o.lotLines); vis("blk-line",o.lotLines);
  vis("nta-fill",o.ntas); vis("nta-line",o.ntas); vis("tract-fill",o.tracts||st.mode==="tract"); vis("tract-line",o.tracts||st.mode==="tract");
  vis("nta-label",o.ntas&&o.ntaNames); markers.forEach(m=>m.getElement().style.display=o.ntas&&o.ntaNames?"":"none");
  for (const [k,ids] of Object.entries(ZON_LAYERS)) ids.forEach(id=>vis(id,o.zon[k]&&(!/label/.test(id)||o.zon.labels)));
  const modes=[...(o.sub.lines?["subway"]:[]),...(o.sub.rail?["path","lightrail","rail"]:[])], lf=["in",["get","m"],["literal",modes]];
  ["sub-line","sub-case"].forEach(id=>{ if(map&&map.getLayer(id)) map.setFilter(id,lf); vis(id,modes.length>0); }); vis("sub-rail-dash",o.sub.rail); vis("sub-ost",o.sub.rail&&o.sub.stations); vis("sub-plat",o.sub.platforms); vis("sub-plat-line",o.sub.platforms);
  vis("sub-ent",o.sub.entrances); vis("sub-st",o.sub.stations); updateStationLabels();
  $("#satBtn").classList.toggle("on",o.basemap==="sat"); $("#basemap").value=o.basemap;
}
const EMPTY={type:"FeatureCollection",features:[]};

function buildColorBy(){
  const P=st.P, F=P.far, sel=$("#colorBy"), cur=st.colorBy, nt=F?"":" (not yet calculated)";
  const opts=[["lu","Land use"],["ub","Units per building"],["yb","Year built"],["fl","Floors"],["bf","Built FAR"],
    ["mf","Maximum FAR"+nt],["fd","Unused FAR"+nt],["fc","FAR capacity category"+nt],["dq","PLUTO data issues"]];
  if (F) for (const c of F.cols.filter(c=>c.kind==="bonus")){ const k=c.key.slice(4), sh=c.short||k.toUpperCase();
    opts.push(["b_"+k,`Maximum FAR with ${sh}`],["g_"+k,`${sh} gain (FAR added)`]); VIEW_LABEL["b_"+k]=`Maximum FAR with ${sh}`; VIEW_LABEL["g_"+k]=`${sh} gain`; }
  sel.innerHTML=opts.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join("");
  if (!opts.some(o=>o[0]===cur)) st.colorBy="lu";
  sel.value=st.colorBy;
}

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

let pmProto=null;
const absURL=p=>new URL(p,location.href).href;
function pmURL(path){
  if (!pmProto){ pmProto=new pmtiles.Protocol(); maplibregl.addProtocol("pmtiles",pmProto.tile); }
  const url=absURL(path);
  if (EMB && !pmProto.tiles.has(url)){
    pmProto.add(new pmtiles.PMTiles({getKey:()=>url, getBytes:async(off,len)=>({data:embBytes(path).slice(off,off+len).buffer})})); }
  return "pmtiles://"+url;
}
function hatch(color){ const c=document.createElement("canvas"); c.width=c.height=8; const g=c.getContext("2d"); g.strokeStyle=color; g.lineWidth=1.2;
  g.beginPath(); g.moveTo(-2,10); g.lineTo(10,-2); g.moveTo(-2,2); g.lineTo(2,-2); g.moveTo(6,10); g.lineTo(10,6); g.stroke(); return g.getImageData(0,0,8,8); }

function fallbackGlyphs(){
  if (!map) return; console.warn("map fonts unavailable; using Noto Sans");
  map.setGlyphs(GLYPHS_FALLBACK);
  for (const l of map.getStyle().layers) if (l.type==="symbol"){ const orig=l.metadata&&l.metadata["lp:font"];
    map.setLayoutProperty(l.id,"text-font",orig||["Noto Sans Bold"]); }
  st.font=["Noto Sans Bold"];
}

function initMap(style){
  const base = style || {version:8,sources:{},layers:[{id:"bg",type:"background",paint:{"background-color":"#E6E9EC"}}]};
  base.layers=(base.layers||[]).filter(l=>!/building/i.test(l.id));

  base.glyphs=GLYPHS;
  for (const l of base.layers) if (l.layout&&Array.isArray(l.layout["text-font"])){ l.metadata={...(l.metadata||{}),"lp:font":l.layout["text-font"]};
    l.layout["text-font"]=[...new Set(l.layout["text-font"].map(f=>/Bold/.test(f)?"Metropolis Bold":/Italic/.test(f)?"Metropolis Regular Italic":"Metropolis Regular"))]; }
  const syms=(base.layers||[]).filter(l=>l.type==="symbol").map(l=>l.id);
  st.base={fills:(base.layers||[]).filter(l=>l.type!=="symbol"&&l.type!=="background").map(l=>l.id), syms, before:syms[0]};
  const fonts=((base.layers||[]).find(l=>l.type==="symbol"&&l.layout&&l.layout["text-font"])||{layout:{}}).layout["text-font"];
  st.font=["Open Sans Bold"]; void fonts;
  map=new maplibregl.Map({container:"map",bounds:st.P.bbox,fitBoundsOptions:{padding:40},style:base,
    fadeDuration:0,dragRotate:false,pitchWithRotate:false,touchPitch:false,maxPitch:0,renderWorldCopies:false,attributionControl:{compact:true},minZoom:9,maxZoom:19.5});
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-left");
  let glyphsOff=false;
  map.on("error",e=>{ const msg=e&&e.error&&(e.error.message||String(e.error))||"";
    if (!glyphsOff && /openmaptiles\.org|glyph|fonts?\//i.test(msg)){ glyphsOff=true; fallbackGlyphs(); return; }
    console.warn("map:",msg); });
  map.on("load",()=>{
    const U=st.base.before, add=(layer,above)=>map.addLayer(layer, above?undefined:U), P=st.P;
    map.addSource("sat",{type:"raster",tiles:[SATELLITE],tileSize:256,maxzoom:19,attribution:"Imagery © Esri, Maxar, Earthstar Geographics"});
    add({id:"sat",type:"raster",source:"sat",layout:{visibility:"none"}});

    map.addSource("blocks",{type:"vector",url:pmURL(P.dir+P.files.blockTiles),promoteId:{blocks:"b"},attribution:"NYC DCP MapPLUTO"});
    add({id:"blocks-fill",type:"fill",source:"blocks","source-layer":"blocks",paint:{"fill-color":NODATA,"fill-opacity":blockOpacity(),"fill-antialias":false}});
    add({id:"blocks-top",type:"fill",source:"blocks","source-layer":"blocks",maxzoom:LOT_MINZOOM,paint:{"fill-color":NODATA,"fill-opacity":0,"fill-antialias":false}});

    map.addSource("lots",{type:"vector",url:pmURL(P.dir+P.files.tiles),promoteId:{lots:"i"}});
    add({id:"lots",type:"fill",source:"lots","source-layer":"lots",minzoom:LOT_MINZOOM,paint:{"fill-color":fillColor(),"fill-opacity":lotOpacity(),"fill-antialias":false}});
    add({id:"lots-top",type:"fill",source:"lots","source-layer":"lots",minzoom:LOT_MINZOOM,paint:{"fill-color":fillColor(),"fill-opacity":0,"fill-antialias":false}});
    add({id:"lot-line",type:"line",source:"lots","source-layer":"lots",minzoom:LOT_MINZOOM,paint:{"line-color":"#4A4F55",
      "line-width":["interpolate",["linear"],["zoom"],14,0.2,16,0.55,18,1.1],"line-opacity":["interpolate",["linear"],["zoom"],13,0,14,0.25,15.5,0.7]}});
    add({id:"blk-line",type:"line",source:"blocks","source-layer":"blocks",minzoom:12.5,maxzoom:LOT_MINZOOM,paint:{"line-color":"#4A4F55","line-width":0.3,"line-opacity":0.35}});

    const zf=st.zoningFile;
    if (zf){ map.addSource("zoning",{type:"vector",url:pmURL("data/"+zf.file),attribution:"Zoning: NYC DCP"});
      if (!map.hasImage("hatch-co")) map.addImage("hatch-co",hatch("rgba(209,73,91,.75)"));
      const lbl=(id,sl,color,size,extra={})=>add({id,type:"symbol",source:"zoning","source-layer":sl,layout:{"text-field":["get","t"],"text-font":st.font,
        "text-size":["interpolate",["linear"],["zoom"],11,size-2,16,size+2],"symbol-sort-key":["-",0,["get","a"]],"text-padding":4,visibility:"none",...extra},
        paint:{"text-color":color,"text-halo-color":"rgba(255,255,255,.92)","text-halo-width":1.6}},true);
      const hit=(id,sl)=>add({id,type:"fill",source:"zoning","source-layer":sl,layout:{visibility:"none"},paint:{"fill-color":"#000","fill-opacity":0}});
      hit("zd-hit","zd");

      map.setPaintProperty("zd-hit","fill-color",["match",["slice",["coalesce",["get","z"],""],0,1],"R","#EBD58C","C","#E9A194","M","#C5B0DD",
        ["case",["in","PARK",["coalesce",["get","z"],""]],"#A9D39E","#D9DDE1"]]);
      map.setPaintProperty("zd-hit","fill-opacity",zdFillOp());
      add({id:"zd-line",type:"line",source:"zoning","source-layer":"zd",layout:{visibility:"none","line-join":"round"},paint:{"line-color":"#262A2F","line-width":["interpolate",["linear"],["zoom"],11,0.6,15,1.4,18,2.2],"line-opacity":0.85}});
      add({id:"co-fill",type:"fill",source:"zoning","source-layer":"co",layout:{visibility:"none"},paint:{"fill-pattern":"hatch-co","fill-opacity":0.8}});
      add({id:"co-line",type:"line",source:"zoning","source-layer":"co",layout:{visibility:"none"},paint:{"line-color":"#C23B4E","line-width":["interpolate",["linear"],["zoom"],12,0.6,16,1.6]}});
      hit("sp-fill","sp");
      add({id:"sp-line",type:"line",source:"zoning","source-layer":"sp",layout:{visibility:"none","line-join":"round"},paint:{"line-color":"#6A3FA0","line-width":["interpolate",["linear"],["zoom"],10,1.2,16,3],"line-dasharray":[3,1.5],"line-opacity":0.9}});
      hit("ss-fill","ss");
      add({id:"ss-line",type:"line",source:"zoning","source-layer":"ss",layout:{visibility:"none","line-join":"round"},paint:{"line-color":"#8E6CC0","line-width":["interpolate",["linear"],["zoom"],12,0.8,16,1.8],"line-dasharray":[1,1.5]}});
      hit("lh-fill","lh");
      add({id:"lh-line",type:"line",source:"zoning","source-layer":"lh",layout:{visibility:"none"},paint:{"line-color":"#C26A12","line-width":["interpolate",["linear"],["zoom"],12,1,16,2.4],"line-dasharray":[4,2]}});
      lbl("zd-label","zd_l","#262A2F",12);
      lbl("co-label","co_l","#B3243A",11);
      lbl("sp-label","sp_l","#5A2F90",13,{"text-padding":20});
      lbl("ss-label","ss_l","#7650AE",11);
      lbl("lh-label","lh_l","#A85508",11); }
    map.addSource("tracts",{type:"geojson",data:areasGeoJSON(P,"tract")});
    add({id:"tract-fill",type:"fill",source:"tracts",paint:{"fill-color":"#1B62A5","fill-opacity":["case",["boolean",["feature-state","hover"],false],0.12,0]}});
    add({id:"tract-line",type:"line",source:"tracts",paint:{"line-color":"#14263B","line-width":0.8,"line-opacity":0.55}});
    map.addSource("ntas",{type:"geojson",data:areasGeoJSON(P,"nta")});
    add({id:"nta-fill",type:"fill",source:"ntas",paint:{"fill-color":"#1B62A5","fill-opacity":["case",["boolean",["feature-state","hover"],false],0.12,0]}});
    add({id:"nta-line",type:"line",source:"ntas",paint:{"line-color":"#14263B","line-width":["interpolate",["linear"],["zoom"],10,0.7,13,1.6],"line-opacity":0.8}});
    map.addSource("sub-plat",{type:"geojson",data:EMPTY,attribution:"Subway: MTA Open Data, © OpenStreetMap contributors"});
    add({id:"sub-plat",type:"fill",source:"sub-plat",minzoom:13.5,filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#8D97A2","fill-opacity":0.85}});
    add({id:"sub-plat-line",type:"line",source:"sub-plat",minzoom:13.5,paint:{"line-color":"#4E5863","line-width":["case",["==",["geometry-type"],"LineString"],3,0.8]}});

    map.addSource("sub-line",{type:"geojson",data:EMPTY,tolerance:0.3});
    const k=["match",["get","m"],"subway",1,"path",0.8,"lightrail",0.75,0.7];
    const Z=[[10,1.4],[13,2.3],[16,4],[19,6.5]];
    const LW=add1=>["interpolate",["linear"],["zoom"],...Z.flatMap(([z,w])=>[z,["+",["*",k,w],add1]])];
    const slot=["-",["coalesce",["get","k"],0],["/",["-",["coalesce",["get","n"],1],1],2]];
    const OFF=["interpolate",["linear"],["zoom"],...Z.flatMap(([z,w])=>[z,["*",["*",k,w],slot]])];
    const sortKey=["match",["get","m"],"subway",4,"path",3,"lightrail",2,1];
    add({id:"sub-case",type:"line",source:"sub-line",layout:{"line-cap":"round","line-join":"round","line-sort-key":sortKey},
      paint:{"line-color":"#fff","line-width":LW(2),"line-offset":OFF,"line-opacity":0.9}});
    add({id:"sub-line",type:"line",source:"sub-line",layout:{"line-cap":"round","line-join":"round","line-sort-key":sortKey},
      paint:{"line-color":["get","c"],"line-width":LW(0),"line-offset":OFF}});
    add({id:"sub-rail-dash",type:"line",source:"sub-line",filter:["==",["get","m"],"rail"],layout:{"line-join":"round"},
      paint:{"line-color":"#fff","line-width":["interpolate",["linear"],["zoom"],10,0.3,16,0.9,19,1.6],"line-dasharray":[3,3]}});
    map.addSource("rings",{type:"geojson",data:EMPTY});
    add({id:"rings-fill",type:"fill",source:"rings",paint:{"fill-color":"#1B62A5","fill-opacity":0.06}});
    add({id:"rings-line",type:"line",source:"rings",paint:{"line-color":"#1B62A5","line-width":1.4,"line-dasharray":[3,2]}});

    add({id:"blk-hl",type:"line",source:"blocks","source-layer":"blocks",paint:{"line-color":"#1B62A5",
      "line-width":["case",["boolean",["feature-state","hover"],false],2.5,0],"line-opacity":["case",["boolean",["feature-state","hover"],false],1,0]}},true);
    add({id:"lot-hl",type:"line",source:"lots","source-layer":"lots",minzoom:LOT_MINZOOM,paint:{
      "line-color":["case",["boolean",["feature-state","peek"],false],"#E08A1E","#1B62A5"],
      "line-width":["case",["boolean",["feature-state","peek"],false],3.5,["boolean",["feature-state","hover"],false],2.5,0],
      "line-opacity":["case",["any",["boolean",["feature-state","peek"],false],["boolean",["feature-state","hover"],false]],1,0]}},true);
    map.addSource("selo",{type:"geojson",data:EMPTY});
    add({id:"selo",type:"line",source:"selo",paint:{"line-color":["get","color"],"line-width":["get","w"],"line-opacity":["get","o"]}},true);
    map.addSource("peek",{type:"geojson",data:EMPTY});
    add({id:"peek",type:"line",source:"peek",paint:{"line-color":"#E08A1E","line-width":3.5}},true);
    map.addSource("nta-label",{type:"geojson",data:areaLabelsGeoJSON(P)});
    add({id:"nta-label",type:"symbol",source:"nta-label",minzoom:11,layout:{"text-field":["get","name"],"text-font":st.font,"text-size":["interpolate",["linear"],["zoom"],11,10.5,14,13],
      "text-max-width":9,"text-padding":6},paint:{"text-color":"#14263B","text-halo-color":"rgba(255,255,255,.95)","text-halo-width":2}},true);
    map.addSource("sub-ent",{type:"geojson",data:EMPTY});
    add({id:"sub-ent",type:"circle",source:"sub-ent",minzoom:14,paint:{"circle-radius":["interpolate",["linear"],["zoom"],14,2.5,17,5],
      "circle-color":["get","color"],"circle-stroke-color":"#fff","circle-stroke-width":1.2}},true);
    map.addSource("sub-ost",{type:"geojson",data:EMPTY});
    add({id:"sub-ost",type:"circle",source:"sub-ost",paint:{"circle-radius":["interpolate",["linear"],["zoom"],11,2.6,16,6],
      "circle-color":"#fff","circle-stroke-color":["match",["get","net"],"HBLR","#1C8FC7","NLR","#8C4FA3","LIRR","#0F61A9","MNR","#0F7B5F","#0B5FA5"],"circle-stroke-width":["interpolate",["linear"],["zoom"],11,1.3,16,2.3]}},true);
    map.addSource("sub-st",{type:"geojson",data:EMPTY});
    add({id:"sub-st",type:"circle",source:"sub-st",paint:{"circle-radius":["interpolate",["linear"],["zoom"],9,1.2,11,2.4,12,3,16,7],
      "circle-color":"#fff","circle-stroke-color":"#14263B","circle-stroke-width":["interpolate",["linear"],["zoom"],9,0.7,11,1.1,12,1.4,16,2.5]}},true);
    map.addSource("draw",{type:"geojson",data:EMPTY});
    map.addSource("measure",{type:"geojson",data:EMPTY});
    add({id:"meas-fill",type:"fill",source:"measure",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#E08A1E","fill-opacity":0.15}},true);
    add({id:"meas-line",type:"line",source:"measure",paint:{"line-color":"#C26A00","line-width":2.5,"line-dasharray":[2,1.5]}},true);
    add({id:"meas-pt",type:"circle",source:"measure",filter:["all",["==",["geometry-type"],"Point"],["!",["has","t"]]],paint:{"circle-radius":4,"circle-color":"#fff","circle-stroke-color":"#C26A00","circle-stroke-width":2}},true);
    add({id:"meas-label",type:"symbol",source:"measure",filter:["has","t"],layout:{"text-field":["get","t"],"text-font":st.font,"text-size":13,"text-offset":[0,-1.3],"text-allow-overlap":true},
      paint:{"text-color":"#7A4300","text-halo-color":"#fff","text-halo-width":2}},true);
    add({id:"draw-fill",type:"fill",source:"draw",filter:["==",["geometry-type"],"Polygon"],paint:{"fill-color":"#1B62A5","fill-opacity":0.12}},true);
    add({id:"draw-line",type:"line",source:"draw",paint:{"line-color":"#1B62A5","line-width":2.5}},true);
    add({id:"draw-pt",type:"circle",source:"draw",filter:["==",["geometry-type"],"Point"],paint:{"circle-radius":4.5,"circle-color":"#fff","circle-stroke-color":"#1B62A5","circle-stroke-width":2}},true);
    styleBlocks(true); renderLegend(); applyMapOpts(); drawSelection(); if (st.T) drawTransit();
    map.on("moveend",updateStationLabels);
    let pfT=null; map.on("idle",()=>{ clearTimeout(pfT); pfT=setTimeout(()=>prefetchGeom(st.P),250); });
    applyLotZoom();
    map.on("sourcedata",e=>{ if (e.sourceId==="lots"&&e.sourceDataType==="metadata") applyLotZoom(); });
    let lowZoom=map.getZoom()<lotZ();
    map.on("zoom",showZoom);
    if (innerWidth>820&&innerWidth<1366) $("#legend").open=false;
    const sidePad=()=>map.setPadding({left:matchMedia("(min-width:821px)").matches&&$("#legend").open?272:0,top:0,right:0,bottom:0});
    $("#legend").addEventListener("toggle",sidePad); addEventListener("resize",sidePad); sidePad();
    map.on("zoomend",()=>{ const lz=map.getZoom()<lotZ(); if (lz!==lowZoom){ lowZoom=lz; renderLegend(); } });
    map.once("idle",()=>{ $("#loading").hidden=true;
      if (innerWidth<=820){ const a=document.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show"); if (a) a.classList.remove("maplibregl-compact-show"); } });
  });
  wireMap();
}
function placeLabels(){ if (map&&map.getSource("nta-label")) map.getSource("nta-label").setData(areaLabelsGeoJSON(st.P)); }
let peekId=null;
function setPeekState(i){ if (!map||!map.getSource("lots")) return;
  if (peekId!=null) map.setFeatureState({source:"lots",sourceLayer:"lots",id:peekId},{peek:false});
  peekId=i; if (i!=null) map.setFeatureState({source:"lots",sourceLayer:"lots",id:i},{peek:true}); }
function drawSelection(){
  st.curIdx = st.sel ? selIndices(st.P,st.sel) : null;
  if (!map||!map.getSource("selo")) return;
  const f=[], many=st.sels.length>1;
  st.sels.forEach((e,k)=>{ const on=!many||typeof st.view!=="number"||st.view===k;
    for (const r of selRings(st.P,e.sel)) f.push({type:"Feature",properties:{color:e.color,w:on?3:1.6,o:on?1:0.5},geometry:{type:"LineString",coordinates:r}}); });
  map.getSource("selo").setData({type:"FeatureCollection",features:f});
  applyFade();
}

const normKeys=o=>{ const m={}; for (const k in o) m[k.toLowerCase().replace(/[^a-z0-9]/g,"")]=o[k]; return m; };
const pick=(m,...ks)=>{ for (const k of ks) if (m[k]!=null&&m[k]!=="") return m[k]; return null; };
function num(v){ const x=parseFloat(v); return Number.isFinite(x)?x:null; }
function geoPt(r,la,lo,geo){ let a=num(pick(r,...la)), b=num(pick(r,...lo));
  if ((a==null||b==null) && r[geo] && r[geo].coordinates){ b=+r[geo].coordinates[0]; a=+r[geo].coordinates[1]; } return [b,a]; }

function osmPlatforms(osm){
  const plats=[];
  for (const el of (osm&&osm.elements)||[]){ const t=el.tags||{};
    if (t.railway!=="platform" || t.access==="private" || t.public_transport==="no") continue;
    if (!(t.subway==="yes" || /NYC Subway|New York City Transit|Staten Island|PATH/.test((t.network||"")+" "+(t.operator||"")) || t["gtfs:stop_id"])) continue;
    const geoms = el.type==="way" ? [el.geometry] : (el.members||[]).filter(m=>m.role==="outer"&&m.geometry).map(m=>m.geometry);
    for (const g of geoms){ if(!g||g.length<2) continue; const c=g.map(p=>[p.lon,p.lat]);
      const closed=c.length>3&&c[0][0]===c[c.length-1][0]&&c[0][1]===c[c.length-1][1];
      plats.push({type:"Feature",properties:{name:t.name||""},geometry:closed?{type:"Polygon",coordinates:[c]}:{type:"LineString",coordinates:c}}); } }
  return {type:"FeatureCollection",features:plats};
}
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

  const byStop=new Map();
  for (const row of raw.stations||[]){ const r=normKeys(row), g=String(pick(r,"gtfsstopid")||""), c=String(pick(r,"complexid","stationid")||""); if (g&&c) byStop.set(g,c); }
  const ctr=new Map(list.map(s=>[s.id,s])), far=(s,lng,lat)=>Math.hypot((lng-s.lng)*84300,(lat-s.lat)*111100)>600;
  const entrances=[], dropped=[];
  for (const row of raw.entrances||[]){ const r=normKeys(row); let sid=String(pick(r,"complexid")||"");
    const [lng,lat]=geoPt(r,["entrancelatitude","latitude","lat"],["entrancelongitude","longitude","lon","lng"],"entrancegeoreference");
    const gs=byStop.get(String(pick(r,"gtfsstopid")||"")); if (gs&&gs!==sid&&stations.has(gs)) sid=gs;
    if (!stations.has(sid)||lng==null) continue;
    if (far(ctr.get(sid),lng,lat)){ dropped.push(`${pick(r,"stopname")||sid} (${lat.toFixed(5)}, ${lng.toFixed(5)})`); continue; }
    const t=String(pick(r,"entrancetype","type")||"").toLowerCase();
    entrances.push({sid,lng,lat,type:pick(r,"entrancetype","type")||"Entrance",kind:/elev/.test(t)?"elevator":/escal/.test(t)?"escalator":/ramp/.test(t)?"ramp":/stair/.test(t)?"stair":"other",
      entry:!/^no/i.test(String(pick(r,"entryallowed")??"yes")), exit:!/^no/i.test(String(pick(r,"exitallowed")??"yes"))}); }

  const lines=raw.lines&&raw.lines.features?raw.lines:{type:"FeatureCollection",features:[]};
  const pathColor={}; for (const f of lines.features){ const p=f.properties; if (p.m==="path" && !/\s/.test(p.r)) pathColor[p.r]=p.c; }
  const T={stations:list, entrances, lines, platforms:raw.platforms&&raw.platforms.features?raw.platforms:osmPlatforms(raw.osm),
    sources:raw.sources||[], built:raw.built, date:raw.date||raw.built||"", gtfs:raw.gtfs||null, pathColor,
    other:(raw.other_stations||[]).filter(x=>x&&x.lng!=null)};
  if (dropped.length) console.info(`transit: left out ${dropped.length} entrance(s) over 600 m from their station:`, dropped.join("; "));
  T.byId=new Map(list.map(s=>[s.id,s])); T.stIndex=new Map(list.map((s,k)=>[s.id,k]));
  T.other.forEach((x,k)=>T.byId.set("o"+k,{id:"o"+k,name:`${x.name} (${netLabel(x)})`,lng:x.lng,lat:x.lat,routes:[],net:x.net}));
  for (const x of raw.other_entrances||[]) if (T.other[x.station]) T.entrances.push({sid:"o"+x.station,lng:x.lng,lat:x.lat,type:x.type||"Entrance",kind:/elev/i.test(x.type||"")?"elevator":"other",entry:true,exit:true});
  T.nameLower=list.map(s=>s.name.toLowerCase());
  return T;
}

let transitIndex=null, transitLoad=0;
const transitCache=new Map();
async function getTransitIndex(){
  if (transitIndex!==null) return transitIndex;
  if (window.__LP__) return transitIndex=window.__LP__.transitIndex||false;
  try{ const r=await fetch("data/transit_index.json"); transitIndex=r.ok?await r.json():false; }catch(_){ transitIndex=false; }
  return transitIndex;
}
const relDate=rel=>{ const s=(rel&&(rel.released||rel.built))||""; return /^\d{4}-\d{2}$/.test(s)?s+"-15":/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):null; };
function pickSnapshot(rel, idx){
  const S=(idx&&idx.snapshots||[]).slice().sort((a,b)=>a.date<b.date?-1:1); if (!S.length) return null;
  if (rel&&rel.transit){ const s=S.find(x=>x.file===rel.transit); if (s) return {s,how:"tied"}; }
  const d=relDate(rel); if (!d) return {s:S[S.length-1],how:"latest"};
  const t=Date.parse(d); let best=S[0], bd=Infinity;
  for (const s of S){ const dd=Math.abs(Date.parse(s.date)-t); if (dd<=bd){ bd=dd; best=s; } }
  return {s:best,how:best.date===d?"exact":"nearest"};
}
async function liveTransit(){
  const [w,s,e,n]=NYC_BOX;
  $("#subStatus").textContent="Subway data: downloading from MTA Open Data and OpenStreetMap…";
  const q=`[out:json][timeout:60];(way["railway"="platform"](${s},${w},${n},${e});relation["railway"="platform"](${s},${w},${n},${e}););out geom;`;
  const [sta,ent,osm]=await Promise.all([
    fetch("https://data.ny.gov/resource/39hk-dx4f.json?$limit=5000").then(r=>{ if(!r.ok) throw new Error("stations HTTP "+r.status); return r.json(); }),
    fetch("https://data.ny.gov/resource/i9wp-a4ja.json?$limit=10000").then(r=>{ if(!r.ok) throw new Error("entrances HTTP "+r.status); return r.json(); }),
    fetch("https://overpass-api.de/api/interpreter",{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(r=>r.ok?r.json():{elements:[]}).catch(()=>({elements:[]}))]);
  const inBox=row=>{ const r=normKeys(row), [lng,lat]=geoPt(r,["gtfslatitude","latitude","entrancelatitude"],["gtfslongitude","longitude","entrancelongitude"],"georeference"); return lng!=null&&lng>=w&&lng<=e&&lat>=s&&lat<=n; };
  return {stations:sta.filter(inBox), entrances:ent, osm, date:new Date().toISOString().slice(0,10), sources:["MTA Open Data (live)","© OpenStreetMap contributors"], live:true};
}
async function rawTransit(file){
  if (window.__LP__){ const F=window.__LP__.transitFiles; return F?F[file]||null:(file==="transit.json"?window.__LP__.transit||null:null); }
  if (!transitCache.has(file)) transitCache.set(file, fetch("data/"+file).then(r=>r.ok?r.json():null).catch(()=>null));
  return transitCache.get(file);
}
function transitStatus(){
  const T=st.T; if (!T) return; const rel=st.releases.find(r=>r.id===st.P.id), pk=T.pick, n={subway:0,path:0,rail:0};
  T.lines.features.forEach(f=>n[f.properties.m]=(n[f.properties.m]||0)+1);
  const when=T.live?"downloaded live just now":`as of ${T.date}`+(pk&&pk.how==="tied"?`, saved with PLUTO ${rel.id}`:pk&&pk.how==="nearest"?`, the closest snapshot to PLUTO ${rel.id}`:"");
  const lines=n.subway?`${n.subway} subway line segments${n.path||n.rail?`, ${n.path} PATH and ${n.rail} LIRR / Metro-North segments`:""}`+(T.gtfs&&T.gtfs.start?` (MTA GTFS schedule of ${T.gtfs.start})`:"")
    :"no route lines (this file predates 1.5; run python tools/transit.py)";
  $("#subStatus").textContent=`Subway map ${when}: ${T.stations.length} stations, ${T.entrances.length} entrances, ${lines}, ${T.platforms.features.length} platform shapes. Sources: MTA Open Data and GTFS; © OpenStreetMap contributors.`;
}
async function loadTransit(){
  const my=++transitLoad, idx=await getTransitIndex(), rel=st.releases.find(r=>r.id===st.P.id), pk=idx?pickSnapshot(rel,idx):null;
  const file=pk?pk.s.file:"transit.json";
  if (st.T && st.T.file===file){ st.T.pick=pk; transitStatus(); return; }
  let raw=await rawTransit(file);
  if (!raw && !pk && !window.__LP__) raw=await liveTransit();
  if (!raw) throw new Error(`data/${file} is missing`);
  if (my!==transitLoad) return;
  const first=!st.T, T=buildTransit(raw); T.file=file; T.pick=pk; T.live=!!raw.live;
  st.T=T; transitStatus(); drawTransit();
  if (st.pending){ const p=st.pending; st.pending=null; restore(p.sels,p.view,true); } else if (st.sels.length){ drawSelection(); renderProfile(); }
  if (!first) toast(`Subway map now shows ${T.date}${pk&&pk.how==="nearest"?`, the closest snapshot to ${rel.id}`:""}.`);
}
function drawTransit(){
  const T=st.T; if (!T||!map||!map.getSource("sub-st")) return;
  map.getSource("sub-line").setData(T.lines); map.getSource("sub-plat").setData(T.platforms);
  map.getSource("sub-ost").setData({type:"FeatureCollection",features:T.other.map((s,k)=>({type:"Feature",id:k,properties:{k,net:s.net},geometry:{type:"Point",coordinates:[s.lng,s.lat]}}))});
  map.getSource("sub-st").setData({type:"FeatureCollection",features:T.stations.map((s,k)=>({type:"Feature",id:k,properties:{k},geometry:{type:"Point",coordinates:[s.lng,s.lat]}}))});
  map.getSource("sub-ent").setData({type:"FeatureCollection",features:T.entrances.map((e,k)=>({type:"Feature",id:k,properties:{k,color:ENT_COLOR[e.kind]},geometry:{type:"Point",coordinates:[e.lng,e.lat]}}))});
  stMarkers.forEach(m=>m.remove()); stMarkers=new Map();
  updateStationLabels(); drawRings();
}

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
const LR={HBLR:["Hudson-Bergen Light Rail","#1C8FC7"],NLR:["Newark Light Rail","#8C4FA3"],LIRR:["LIRR","#0F61A9"],MNR:["Metro-North","#0F7B5F"]};
const isRail=s=>s.net==="LIRR"||s.net==="MNR";
const netLabel=s=>s.net==="PATH"?"PATH":LR[s.net]?LR[s.net][0]:s.net;
const netPills=s=>s.net==="PATH"?pathPills(s.routes):isRail(s)?`<span class="pp" style="background:${LR[s.net][1]}">${LR[s.net][0]}</span>`+(s.routes||[]).map(r=>`<span class="pp lite" style="border-color:${(s.colors||{})[r]||"#4F5B66"};color:${(s.colors||{})[r]||"#4F5B66"}">${esc(r.replace(/ Branch$/,""))}</span>`).join(""):`<span class="pp" style="background:${LR[s.net]?LR[s.net][1]:"#1C8FC7"}">${esc(netLabel(s))}</span>`;
const pathPills=rs=>(rs||[]).map(r=>`<span class="pp" style="background:${st.T.pathColor[r]||"#0079C1"}">${esc(r)}</span>`).join("");
function otherPopup(k){
  const s=st.T.other[k], ne=st.T.entrances.filter(e=>e.sid==="o"+k).length;
  openPopup([s.lng,s.lat],`<div class="stpop"><h3>${esc(s.name)}</h3><div class="pps">${netPills(s)}</div>
    <div class="walk">Walkshed: ${[[402.3,"¼ mi"],[804.7,"½ mi"],[1609.3,"1 mi"]].map(([m,t])=>`<button data-walk="o${k}" data-m="${m}">${t}</button>`).join("")}</div>
    ${isRail(s)&&(s.routes||[]).length?`<div class="walk">½ mi around every station on ${s.routes.map(r=>`<button data-oroute="${esc(r)}" data-net="${s.net}">${esc(r.replace(/ Branch$/,""))}</button>`).join("")}</div>`:""}
    <p class="phint">${ne?`Measured from ${ne} entrance${ne>1?"s":""} (OpenStreetMap).`:`No entrance data for ${esc(netLabel(s))} yet, so this measures from the station point.`} ${st.addMode?"Add is on.":"Shift-click, or turn on Add, to keep earlier selections."}</p></div>`);
}
function entrancePopup(k, lngLat){
  const e=st.T.entrances[k], s=st.T.byId.get(e.sid);
  openPopup(lngLat||[e.lng,e.lat], `<div class="stpop"><h3>${esc(e.type)} to ${esc(s?s.name:"")} ${(s?s.routes:[]).map(bullet).join("")}</h3>
    ${e.entry&&e.exit?"Entry and exit":e.entry?"Entry only":"Exit only"}
    <div class="walk">From this entrance: ${[[402.3,"¼ mi"],[804.7,"½ mi"],[1609.3,"1 mi"]].map(([m,t])=>`<button data-ent="${k}" data-m="${m}">${t}</button>`).join("")}</div>
    <div class="walk">Whole station: <button data-walk="${esc(e.sid)}" data-m="804.7">½ mi walkshed</button></div></div>`);
}

let drawPts=[], radiusC=null, hov=null, rafQ=false, lastEv=null, popup=null;
const clipSelect=(v,mixed)=>`<select data-clip title="${esc(mixed?"":CLIP_DESC[v])}">${mixed?`<option value="" selected>Mixed</option>`:""}${Object.entries(CLIP_NAME).map(([k,t])=>`<option value="${k}" title="${esc(CLIP_DESC[k])}"${k===v&&!mixed?" selected":""}>${t}</option>`).join("")}</select>`;
const HINTS={
  lot:"Click a lot to open its record. Shift-click to add or remove lots.",
  block:"Click a tax block to select it. Shift-click to add or remove blocks.",
  poly:"Click to add corners. Click the first corner or press Enter to finish. Esc cancels.",
  measure:"Click or tap to add points, then Done (or double-click / Enter).",
  radius:"Click the center, move out, then click again. Clicks snap to entrances and stations; with a fixed radius and Add on, click station after station. Radius:"};
const meas={kind:"line",pts:[],done:false};
const geoDist=(a,b)=>{ const m=(a[1]+b[1])/2; return Math.hypot((a[0]-b[0])*eLng(m),(a[1]-b[1])*eLat(m)); };
const fmtLen=m=>{ const ft=m*3.28084; return ft<2640?`${fmt(ft)} ft`:`${(ft/5280).toFixed(2)} mi (${fmt(ft)} ft)`; };
function measText(cursor){
  const pts=cursor&&!meas.done?[...meas.pts,cursor]:meas.pts;
  if (meas.kind==="line"){ if (pts.length<2) return "Click a starting point"; let d=0; for (let k=1;k<pts.length;k++) d+=geoDist(pts[k-1],pts[k]); return fmtLen(d); }
  if (pts.length<3) return "Click at least three corners";
  const kx=eLng(pts[0][1]), ky=eLat(pts[0][1]), r=pts.map(p=>[(p[0]-pts[0][0])*kx,(p[1]-pts[0][1])*ky]), sf=ringArea(r)*10.7639;
  let per=0; for (let k=0;k<pts.length;k++) per+=geoDist(pts[k],pts[(k+1)%pts.length]);
  return `${fmt(sf)} sq ft · ${(sf/43560).toFixed(2)} acres · perimeter ${fmtLen(per)}`;
}
function measFC(cursor){ const pts=cursor&&!meas.done?[...meas.pts,cursor]:meas.pts, f=[];
  if (meas.kind==="area"&&pts.length>2) f.push({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...pts,pts[0]]]}});
  if (pts.length>1) f.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:meas.kind==="area"&&pts.length>2?[...pts,pts[0]]:pts}});
  pts.forEach(p=>f.push({type:"Feature",properties:{},geometry:{type:"Point",coordinates:p}}));
  if (pts.length>1) f.push({type:"Feature",properties:{t:measText(cursor).replace(/ · perimeter.*/,"")},geometry:{type:"Point",coordinates:pts[pts.length-1]}});
  return {type:"FeatureCollection",features:f}; }
function drawMeas(cursor){ if (map.getSource("measure")) map.getSource("measure").setData(measFC(cursor)); const o=$("#measOut"); if (o) o.textContent=measText(cursor); }
function setMode(m){
  if (m==="measure"&&st.mode!=="measure"&&!meas.done){ meas.pts=[]; if (map&&map.getSource("measure")) map.getSource("measure").setData(EMPTY); }
  st.mode=m; drawPts=[]; radiusC=null; if (map.getSource("draw")) map.getSource("draw").setData(EMPTY);
  $$("#tools button").forEach(b=>b.classList.toggle("on",b.dataset.mode===m));
  const h=$("#hint"); h.hidden=!HINTS[m];
  h.innerHTML=HINTS[m]?esc(HINTS[m])+(m==="radius"?[["¼ mi",402.3],["½ mi",804.7],["1 mi",1609.3],["Free",0]].map(([t,v])=>` <button data-r="${v}" class="${st.radiusPreset==v?"on":""}">${t}</button>`).join(""):"")
    +(m==="measure"?` <button data-mk="line" class="${meas.kind==="line"?"on":""}">Distance</button><button data-mk="area" class="${meas.kind==="area"?"on":""}">Area</button><button data-mdone>Done</button><button data-mclear>Clear</button> <b id="measOut">${measText()}</b>`:"")
    +(m==="radius"||m==="poly"?` <span class="cliphint">Lot inclusion: <b>${CLIP_NAME[st.clip]}</b> (change with ▾)</span>`:"")
    +(st.addTo!=null&&st.sels[st.addTo]?` <span class="cliphint">Adding to <b>${esc(groupName(st.sels[st.addTo].sel))}</b>. <button data-doneadd>Done</button></span>`:""):"";
  map.getCanvas().style.cursor=m==="poly"||m==="radius"||m==="measure"?"crosshair":"";
  if (m==="poly"||m==="measure") map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  clearHover(); $("#maptip").hidden=true; applyMapOpts();
}

const srcLayer=src=>src==="lots"||src==="blocks"?src:undefined;
function setHover(src, id){
  if (hov && hov.src===src && hov.id===id) return;
  clearHover(); if (id==null||!map.getSource(src)) return;
  hov={src,id}; map.setFeatureState({source:src,sourceLayer:srcLayer(src),id},{hover:true}); }
function clearHover(){ if (hov && map.getSource(hov.src)) map.setFeatureState({source:hov.src,sourceLayer:srcLayer(hov.src),id:hov.id},{hover:false}); hov=null; }
function tipAt(pt,html){ const t=$("#maptip"); t.innerHTML=html; t.hidden=false; const W=$("#mapbox").clientWidth;
  t.style.left=Math.min(pt.x+14,W-t.offsetWidth-8)+"px"; t.style.top=(pt.y+14)+"px"; }
function drawFC(cursor){ const pts=cursor?[...drawPts,cursor]:drawPts, f=[];
  if (pts.length>2) f.push({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[[...pts,pts[0]]]}});
  else if (pts.length>1) f.push({type:"Feature",properties:{},geometry:{type:"LineString",coordinates:pts}});
  drawPts.forEach(p=>f.push({type:"Feature",properties:{},geometry:{type:"Point",coordinates:p}})); return {type:"FeatureCollection",features:f}; }
const radiusFC=(c,m)=>({type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry:{type:"Point",coordinates:c}},{type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[circle(c,m)]}}]});

function lotCard(i){ const P=st.P, y=P.year[i], {boro,block,lot}=bblParts(P.bbl[i]), lu=P.lu[i], z=P.dict.zone[P.zone[i]];
  const maxTxt=P.far?fmt(P.mfar[i],2):"—";
  return `<div class="lc"><div class="lc-h"><b>${esc(addrOf(P,i)||(P.addr?"No address":"…"))}</b><span>${BORO[boro]||""} ${block}-${lot}</span></div>
    <div class="lc-t"><i style="background:${LU_COLORS[lu]}"></i>${esc(P.dict.lu[lu])}${z?`<em>${esc(z)}</em>`:""}</div>
    <dl class="lc-g"><div><dt>Lot area</dt><dd>${fmt(P.area[i])} sq ft</dd></div><div><dt>Housing units</dt><dd>${fmt(P.units[i])}</dd></div>
      <div><dt>Year built</dt><dd>${y||"—"}</dd></div><div><dt>Built / max FAR</dt><dd>${fmt(P.bfar[i],2)} <span>/ ${maxTxt}</span></dd></div></dl>
    ${(()=>{ const q=dqIssues(P,i); return q.length?`<div class="lc-f lc-dq">Possible data issue: ${q.map(k=>DQ_NAMES[k].toLowerCase()).join("; ")}</div>`:""; })()}</div>`; }
function blockCard(j, hint){ const P=st.P, b=P.blocks[j];
  return `<div class="lc"><div class="lc-h"><b>${blockName(b.key)}</b><span>${fmt(P.blkCount[j])} lots</span></div>${hint?`<div class="lc-f">${hint}</div>`:""}</div>`; }
function openPopup(ll,html){ if (popup) popup.remove(); popup=new maplibregl.Popup({maxWidth:"290px"}).setLngLat(ll).setHTML(html).addTo(map); }
function snap(pt){
  if (!st.T) return null; let best=null, bd=14*14;
  const test=(lng,lat,label)=>{ const p=map.project([lng,lat]), d=(p.x-pt.x)**2+(p.y-pt.y)**2; if(d<bd){bd=d;best={c:[lng,lat],label};} };
  if (st.map.sub.entrances && map.getZoom()>=14) st.T.entrances.forEach(e=>test(e.lng,e.lat,`an entrance to ${st.T.byId.get(e.sid).name}`));
  if (st.map.sub.stations) st.T.stations.forEach(s=>test(s.lng,s.lat,s.name));
  if (st.map.sub.stations && st.map.sub.rail) st.T.other.forEach(s=>test(s.lng,s.lat,`${s.name} (${netLabel(s)})`));
  return best;
}
function wireMap(){
  map.on("mousemove",e=>{ lastEv=e; if(rafQ) return; rafQ=true; requestAnimationFrame(()=>{ rafQ=false; onMove(lastEv); }); });
  map.on("mouseout",()=>{ $("#maptip").hidden=true; clearHover(); });
  map.on("click",onClick);
  map.on("dblclick",e=>{ if(st.mode==="poly"){ e.preventDefault(); finishPoly(e.originalEvent.shiftKey); }
    else if (st.mode==="measure"){ e.preventDefault(); while (meas.pts.length>1&&geoDist(meas.pts[meas.pts.length-1],meas.pts[meas.pts.length-2])<0.5) meas.pts.pop(); meas.done=true; drawMeas(); } });
}
function subAt(point){ const L=["sub-st","sub-ost","sub-ent"].filter(l=>map.getLayer(l)&&map.getLayoutProperty(l,"visibility")!=="none");
  return L.length?map.queryRenderedFeatures([[point.x-6,point.y-6],[point.x+6,point.y+6]],{layers:L}):[]; }

const railName=r=>String(r||"").replace(/\b([A-Z])([A-Z]+)\b/g,(m,a,b)=>/^(LIRR|MNR)$/.test(m)?m:a+b.toLowerCase());

function lineTip(point){
  if (!st.T || !map.getLayer("sub-line") || map.getLayoutProperty("sub-line","visibility")==="none") return "";
  const f=map.queryRenderedFeatures([[point.x-5,point.y-5],[point.x+5,point.y+5]],{layers:["sub-line"]}); if (!f.length) return "";
  const sub=new Set(), path=new Set(), rail=new Set(), lr=new Set();
  for (const x of f){ const p=x.properties, set=p.m==="subway"?sub:p.m==="path"?path:p.m==="lightrail"?lr:rail;
    if (p.m==="rail") set.add(railName(p.r)); else String(p.r||"").split(" ").filter(Boolean).forEach(r=>set.add(r)); }
  const bits=[];
  if (sub.size) bits.push([...sub].sort((a,b)=>ROUTE_ORDER.indexOf(a)-ROUTE_ORDER.indexOf(b)).map(bullet).join(""));
  if (path.size) bits.push([...path].map(r=>`<span class="pp" style="background:${st.T.pathColor[r]||"#0079C1"}">PATH ${esc(r)}</span>`).join(""));
  if (lr.size) bits.push([...lr].map(r=>`<span class="pp" style="background:${LR[r]?LR[r][1]:"#1C8FC7"}">${esc(LR[r]?LR[r][0]:r)}</span>`).join(""));
  if (rail.size) bits.push([...rail].map(r=>`<span class="pp rail">${esc(r)}</span>`).join(""));
  return `<div class="tipln">${bits.join(" ")}</div>`;
}
function onMove(e){
  const p=[e.lngLat.lng,e.lngLat.lat];
  if (st.mode==="measure"){ $("#maptip").hidden=true; if (meas.pts.length&&!meas.done) drawMeas(p); return; }
  if (st.mode==="poly"){ if(!drawPts.length) return; map.getSource("draw").setData(drawFC(p));
    if (drawPts.length>1){ const r=selIndices(st.P,{type:"poly",ring:[...drawPts,p,drawPts[0]],clip:st.clip},true); tipAt(e.point,`${r.provisional?"About ":""}${fmt(r.length)} lots ${CLIP_PHRASE[st.clip]}`); } return; }
  if (st.mode==="radius"){ const sn=radiusC?null:snap(e.point), c=radiusC||(st.radiusPreset?(sn?sn.c:p):null);
    if (!c){ if (sn) tipAt(e.point,`Snap to ${esc(sn.label)}`); else $("#maptip").hidden=true; return; }
    const m=radiusC?distM(radiusC,p):st.radiusPreset; map.getSource("draw").setData(radiusFC(c,m));
    const r=selIndices(st.P,{type:"radius",c,m,clip:st.clip},true);
    tipAt(e.point,`${miles(m)}, ${r.provisional?"about ":""}${fmt(r.length)} lots ${CLIP_PHRASE[st.clip]}${sn&&!radiusC?`<br>from ${esc(sn.label)}`:""}`); return; }
  const sf=subAt(e.point);
  if (sf.length){ const f=sf[0]; map.getCanvas().style.cursor="pointer"; clearHover();
    if (f.layer.id==="sub-st"){ const s=st.T.stations[f.properties.k]; tipAt(e.point,`<b>${esc(s.name)}</b> ${s.routes.map(bullet).join("")}<br>Click for walksheds`); }
    else if (f.layer.id==="sub-ost"){ const s=st.T.other[f.properties.k]; tipAt(e.point,`<b>${esc(s.name)}</b> <span class="tipln">${netPills(s)}</span>Click for a radius`); }
    else { const en=st.T.entrances[f.properties.k]; tipAt(e.point,`<b>${esc(en.type)}</b><br>${esc(st.T.byId.get(en.sid).name)}`); }
    return; }
  const lt=lineTip(e.point)+zoneTip(e.point), bare=()=>{ if (lt) tipAt(e.point,lt); else $("#maptip").hidden=true; };
  if (st.mode==="lot"||st.mode==="block"||st.mode==="view"){
    const low=map.getZoom()<lotZ();
    if (st.mode==="block"||low){
      const f=map.queryRenderedFeatures(e.point,{layers:["blocks-fill"]});
      if (!f.length){ clearHover(); map.getCanvas().style.cursor=""; return bare(); }
      const j=f[0].id; setHover("blocks",j); map.getCanvas().style.cursor="pointer";
      return tipAt(e.point,blockCard(j,st.mode==="block"?"":"Zoom in to see its lots; click to zoom to this block.")+lt); }
    const f=map.queryRenderedFeatures(e.point,{layers:["lots"]});
    if (!f.length){ clearHover(); map.getCanvas().style.cursor=""; return bare(); }
    const i=f[0].id; setHover("lots",i); map.getCanvas().style.cursor="pointer";
    return tipAt(e.point,lotCard(i)+lt); }
  const layer=st.mode==="tract"?"tract-fill":"nta-fill", src=st.mode==="tract"?"tracts":"ntas";
  if (!map.getLayer(layer)||map.getLayoutProperty(layer,"visibility")==="none") return bare();
  const f=map.queryRenderedFeatures(e.point,{layers:[layer]}), id=f.length?f[0].id:null;
  setHover(src,id);
  map.getCanvas().style.cursor=id!=null?"pointer":"";
  if (id!=null) tipAt(e.point,`<div class="lc"><div class="lc-h"><b>${esc(f[0].properties.name)}</b><span>${src==="ntas"?"Neighborhood tabulation area":"2020 census tract"}</span></div></div>${lt}`); else bare();
}

function zoneTip(point){
  const L=["zd-hit","co-fill","sp-fill","ss-fill","lh-fill"].filter(l=>map.getLayer(l)&&map.getLayoutProperty(l,"visibility")!=="none"); if (!L.length) return "";
  const f=map.queryRenderedFeatures(point,{layers:L}), seen=new Set(), bits=[];
  for (const x of f){ const p=x.properties, id=x.layer.id, t=id==="zd-hit"?`Zoning district <b>${esc(p.z)}</b>`:id==="co-fill"?`Commercial overlay <b>${esc(p.o)}</b>`:
      id==="sp-fill"?`<b>${esc(p.n)}</b>`:id==="ss-fill"?`${esc([p.s,p.a2,p.o2].filter(Boolean).join(", ")||"Subdistrict")}`:`Limited height district <b>${esc(p.l)}</b>`;
    if (!seen.has(t)){ seen.add(t); bits.push(t); } }
  return bits.length?`<div class="tipzn">${bits.join("<br>")}</div>`:"";
}
const P_blockLots=j=>Array.from(st.P.blkLots.subarray(st.P.blkStart[j],st.P.blkStart[j+1]));
function toggleIn(arr,v){ const s=new Set(arr); s.has(v)?s.delete(v):s.add(v); return [...s]; }
function onClick(e){
  const p=[e.lngLat.lng,e.lngLat.lat];
  if (st.mode==="measure"){ if (meas.done){ meas.pts=[]; meas.done=false; } meas.pts.push(p); return drawMeas(); }
  if (st.mode==="poly"){ if (drawPts.length>2){ const a=map.project(drawPts[0]); if(Math.hypot(a.x-e.point.x,a.y-e.point.y)<12) return finishPoly(e.originalEvent.shiftKey); }
    drawPts.push(p); map.getSource("draw").setData(drawFC()); return; }

  const shift=e.originalEvent&&e.originalEvent.shiftKey;
  if (st.mode==="radius"){ const sn=radiusC?null:snap(e.point), c=sn?sn.c:p;
    if (st.radiusPreset) return finish({type:"radius",c,m:st.radiusPreset,label:sn?`Within ${miles(st.radiusPreset)} of ${sn.label}`:undefined,clip:st.clip},shift);
    if (!radiusC){ radiusC=c; radiusC.label=sn&&sn.label; return; }
    const m=distM(radiusC,p); if (m<20) return;
    return finish({type:"radius",c:[radiusC[0],radiusC[1]],m:Math.round(m),label:radiusC.label?`Within ${miles(m)} of ${radiusC.label}`:undefined,clip:st.clip},shift); }
  const sf=subAt(e.point);
  if (sf.length){ const f=sf[0]; return f.layer.id==="sub-st"?stationPopup(f.properties.k):f.layer.id==="sub-ost"?otherPopup(f.properties.k):entrancePopup(f.properties.k); }
  if ((st.mode==="view"||st.mode==="lot") && map.getZoom()<lotZ()){
    const f=map.queryRenderedFeatures(e.point,{layers:["blocks-fill"]}); if (!f.length) return;
    const bx=P_blockLots(f[0].id).reduce((q,i)=>{ const b=lotLL(st.P,i); return q?[Math.min(q[0],b[0]),Math.min(q[1],b[1]),Math.max(q[2],b[2]),Math.max(q[3],b[3])]:b; },null);
    if (bx) map.fitBounds([[bx[0],bx[1]],[bx[2],bx[3]]],{padding:60,duration:600,minZoom:lotZ()+0.6,maxZoom:18}); return; }
  if (st.mode==="view"){ const f=map.queryRenderedFeatures(e.point,{layers:["lots"]}); if (f.length) peekLot(Math.round(st.P.bbl[f[0].id])); return; }
  if (st.mode==="lot"||st.mode==="block"){
    const cur=st.sel;
    if (st.mode==="lot"){ const f=map.queryRenderedFeatures(e.point,{layers:["lots"]}); if (!f.length) return; const bbl=Math.round(st.P.bbl[f[0].id]);
      if (shift && cur && cur.type==="lots"){ const b=toggleIn(cur.bbls,bbl); return b.length?select({type:"lots",bbls:b},false,{edit:true}):removeSel(curIndex()); }
      return select({type:"lots",bbls:[bbl]},false,{map:true}); }
    const f=map.queryRenderedFeatures(e.point,{layers:["blocks-fill"]}); if (!f.length) return;
    const key=st.P.blocks[f[0].id]&&st.P.blocks[f[0].id].key; if (key==null) return;
    if (shift && cur && cur.type==="blocks"){ const k=toggleIn(cur.keys,key); return k.length?select({type:"blocks",keys:k},false,{edit:true}):removeSel(curIndex()); }
    return select({type:"blocks",keys:[key]},false,{map:true}); }
  const f=map.queryRenderedFeatures(e.point,{layers:[st.mode==="tract"?"tract-fill":"nta-fill"]});
  if (f.length){ const a=st.P.areas[f[0].id]; select({type:"area",kind:a.kind,code:a.code},false,{map:true,add:shift}); }
}
function finishPoly(shift){ if (drawPts.length<3){ setMode("view"); return; }
  finish({type:"poly",ring:[...drawPts,drawPts[0]].map(([x,y])=>[+x.toFixed(6),+y.toFixed(6)]),clip:st.clip},shift); }
function finish(sel,shift){ const stay=st.mode==="radius"&&(st.addMode||shift||st.addTo!=null)&&st.radiusPreset;
  if (!stay && (st.mode==="radius"||st.mode==="poly")) setMode("view"); select(sel,false,{map:true,add:shift}); }

function nextColor(){ const used=new Set(st.sels.map(e=>e.color)); return SEL_COLORS.find(c=>!used.has(c))||SEL_COLORS[st.sels.length%SEL_COLORS.length]; }
const curIndex=()=>st.sels.length===1?0:typeof st.view==="number"?st.view:st.sels.length-1;
const needsT=sel=>sel&&(sel.type==="walk"||(sel.type==="group"&&sel.parts.some(needsT)));
function select(sel, fit, o={}){
  if (needsT(sel) && !st.T){ const next=o.add||(o.map&&st.addMode)?[...st.sels,{sel,color:nextColor()}]:[{sel,color:SEL_COLORS[0]}];
    st.pending={sels:next.map(e=>e.sel),view:next.length>1?"all":0}; return; }
  if (!o.keepPrev) st.prevSel=null;
  if (st.peek!=null){ st.peek=null; setPeekState(null); }
  if (st.addTo!=null && sel && isShape(sel) && !o.edit && st.sels[st.addTo] && st.sels[st.addTo].sel.type==="group"){
    pushUndo(); const k=st.addTo, e=st.sels[k]; st.sels[k]={...e,sel:{...e.sel,parts:[...e.sel.parts,sel]}}; st.view=st.sels.length>1?k:0;
    if (popup) popup.remove(); drawSelection(); renderProfile(); writeHash(); return; }
  if (!o.noUndo) pushUndo();
  if (!sel){ if (st.sels.length) toast("Selection cleared.","Undo",undo); st.sels=[]; st.view="all"; }
  else if (o.edit && st.sels.length) st.sels[curIndex()].sel=sel;
  else if (o.add || (o.map && st.addMode)){ st.sels.push({sel,color:st.sels.length?nextColor():SEL_COLORS[0]}); st.view=st.sels.length>1?"all":0; }
  else { st.sels=[{sel,color:SEL_COLORS[0]}]; st.view=0; }
  if (popup && sel) popup.remove(); drawSelection(); renderProfile(); writeHash();
  if (fit && sel) fitTo([sel]);
}
function restore(sels, view, fit, record){
  if (sels.some(needsT) && !st.T){ st.pending={sels,view}; return; }
  if (record) pushUndo();
  st.sels=sels.map((sel,k)=>({sel,color:SEL_COLORS[k%SEL_COLORS.length]})); st.view=sels.length>1?(view??"all"):0;
  drawSelection(); renderProfile(); writeHash(); if (fit && sels.length) fitTo(sels);
}

function mergeSels(ks){
  if (ks.length<2) return; pushUndo();
  const seen=new Set(), parts=ks.flatMap(k=>{ const x=st.sels[k].sel; return x.type==="group"?x.parts:[x]; }).filter(x=>{ const key=JSON.stringify(x); if (seen.has(key)) return false; seen.add(key); return true; }), color=st.sels[ks[0]].color;
  const at=ks[0]; st.sels=st.sels.filter((_,k)=>!ks.includes(k)); st.sels.splice(at,0,{sel:{type:"group",parts},color});
  st.combine=null; st.addTo=null; st.view=st.sels.length>1?at:0;
  drawSelection(); renderProfile(); writeHash(); toast(`Merged ${ks.length} selections into one area.`,"Undo",undo);
}
function splitSel(k){
  const e=st.sels[k]; if (!e||e.sel.type!=="group") return; pushUndo();
  const add=e.sel.parts.map((sel,i)=>({sel,color:i?null:e.color}));
  st.sels.splice(k,1,...add); st.sels.forEach(x=>{ if (!x.color) x.color=nextColor(); });
  st.addTo=null; st.view=st.sels.length>1?"all":0; drawSelection(); renderProfile(); writeHash(); toast(`Split into ${add.length} selections.`,"Undo",undo);
}
function toggleAddTo(){
  const k=curIndex(); st.addTo = st.addTo===k||!st.sels[k]||st.sels[k].sel.type!=="group" ? null : k;
  if (st.addTo!=null && st.mode!=="radius" && st.mode!=="poly") setMode("radius"); else setMode(st.mode);
  renderProfile();
}
function peekLot(bbl, fit){
  st.peek=bbl; const i=bbl==null?null:st.P.bblIdx.get(bbl); setPeekState(i??null);
  if (fit&&i!=null) map.flyTo({center:[st.P.lng[i],st.P.lat[i]],zoom:Math.max(map.getZoom(),17),duration:600});
  renderProfile(); writeHash();
}
function removeSel(k){ if (st.addTo!=null) st.addTo = st.addTo===k?null:st.addTo>k?st.addTo-1:st.addTo; pushUndo(); const gone=selTitle(st.P,st.sels[k].sel,0)[0]; st.sels.splice(k,1); toast(`Removed ${gone}.`,"Undo",undo); st.view=st.sels.length>1?"all":0; drawSelection(); renderProfile(); writeHash(); }
function setView(v){ st.view=v; drawSelection(); renderProfile(); writeHash();
  if (typeof v==="number") fitTo([st.sels[v].sel]); }
function fitTo(sels){ const bx=sels.map(s=>selBox(st.P,s)).filter(Boolean); if (!bx.length) return;
  const x0=Math.min(...bx.map(b=>b[0])), y0=Math.min(...bx.map(b=>b[1])), x1=Math.max(...bx.map(b=>b[2])), y1=Math.max(...bx.map(b=>b[3]));
  map.fitBounds([[x0,y0],[x1,y1]],{padding:70,duration:500,maxZoom:18}); }
function snapshot(){ return {sels:st.sels.map(e=>({...e})), view:st.view}; }

const undoStack=[], redoStack=[];
const describe=s=>!s.sels.length?"no selection":s.sels.length===1?selTitle(st.P,s.sels[0].sel,0)[0]:`${s.sels.length} selections`;
function pushUndo(){ undoStack.push(snapshot()); if (undoStack.length>80) undoStack.shift(); redoStack.length=0; }
function applySnap(s){ st.sels=s.sels.map(e=>({...e})); st.view=s.view; st.prevSel=null; st.combine=null; if (st.addTo!=null && !(st.sels[st.addTo]&&st.sels[st.addTo].sel.type==="group")) st.addTo=null; drawSelection(); renderProfile(); writeHash(); }
function undo(){ if (!undoStack.length) return toast("Nothing to undo"); redoStack.push(snapshot()); const s=undoStack.pop(); applySnap(s); toast(`Undone. Now showing ${describe(s)}.`,"Redo",redo); }
function redo(){ if (!redoStack.length) return toast("Nothing to redo"); undoStack.push(snapshot()); const s=redoStack.pop(); applySnap(s); toast(`Redone. Now showing ${describe(s)}.`,"Undo",undo); }
let toastT=null;
function toast(msg, act, fn){ const t=$("#toast"); t.innerHTML=esc(msg)+(act?` <button>${act}</button>`:""); t.hidden=false;
  if (act) t.querySelector("button").onclick=()=>{ t.hidden=true; fn(); };
  clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3500); }

function renderTrack(){
  $("#track").innerHTML=st.releases.map(r=>`<li class="${r.id===st.P.id?"on":""} ${st.C&&r.id===st.C.id?"cmp":""}"><button data-rel="${r.id}" title="${esc(r.label)}: ${fmt(r.lots)} lots${r.coverage?` (${esc(r.coverage)})`:""}${r.released?`, released ${r.released}`:""}${r.id===st.P.id?" (showing)":""}" aria-pressed="${r.id===st.P.id}"></button><span data-rel="${r.id}">${r.id}${r.coverage&&!/New York City/.test(r.coverage)?`<small>${esc(shortCov(r.coverage))}</small>`:""}</span></li>`).join("")+
    `<li class="ghost"><button title="Add the next release: python tools/build.py path/to/MapPLUTO.gdb" aria-label="How to add a release"></button><span>next</span></li>`;
  const others=st.releases.filter(r=>r.id!==st.P.id);
  $("#cmp").innerHTML=`<option value="">${others.length?"nothing":"no other release yet"}</option>`+others.map(r=>`<option value="${r.id}" ${st.C&&st.C.id===r.id?"selected":""}>${r.id}</option>`).join("");
  $("#cmp").disabled=!others.length;
}
async function switchRelease(id){
  if (id===st.P.id) return; $("#loading").hidden=false; $("#loading").textContent=`Loading ${id}…`;
  st.P=await getPack(id); if (st.C&&st.C.id===id) st.C=null;

  clearHover(); setPeekState(null);
  for (const i of fadeLots) map.setFeatureState({source:"lots",sourceLayer:"lots",id:i},{s:false});
  for (const j of fadeBlocks) map.setFeatureState({source:"blocks",sourceLayer:"blocks",id:j},{s:false});
  map.getSource("lots").setUrl(pmURL(st.P.dir+st.P.files.tiles)); map.getSource("blocks").setUrl(pmURL(st.P.dir+st.P.files.blockTiles));
  map.getSource("ntas").setData(areasGeoJSON(st.P,"nta")); map.getSource("tracts").setData(areasGeoJSON(st.P,"tract"));
  blockKey=""; resetFade(); buildColorBy(); restyleLots(); placeLabels(); applyMapOpts(); renderTrack(); drawSelection(); renderProfile(); writeHash();
  map.once("idle",()=>$("#loading").hidden=true);
  loadTransit().catch(err=>console.warn("transit:",err));
}
const shortCov=c=>/five brooklyn ntas/i.test(c)?"5 NTAs":c.length>12?c.slice(0,11)+"…":c;

async function getZoningFile(rel){
  try{ const idx=window.__LP__?window.__LP__.zoningIndex:await (await fetch("data/zoning_index.json")).json();
    const S=(idx&&idx.snapshots)||[]; return S.find(s=>s.file===rel.zoning)||S[S.length-1]||null; }catch(_){ return null; } }
async function setCompare(id){ st.C=id?await getPack(id):null; renderTrack(); renderProfile(); writeHash(); }

function writeHash(){
  const q=new URLSearchParams(); q.set("v",st.P.id); if (st.peek!=null) q.set("lot",st.peek); if(st.C) q.set("c",st.C.id); if(st.colorBy!=="lu") q.set("m",st.colorBy);
  for (const {sel:s} of st.sels) q.append("s", encSel(s));
  if (st.sels.length>1 && st.view!=="all") q.set("view",st.view);
  history.replaceState(null,"","#"+q.toString());
}
function encSel(s){
  if (s.type==="group") return "g:"+s.parts.map(encSel).join("~");
  return (s.type==="area"?`a:${s.kind}:${s.code}`: s.type==="lots"?"l:"+s.bbls.join(","): s.type==="blocks"?"k:"+s.keys.join(","):
    (s.type==="walk"?`w:${s.sid},${Math.round(s.m)}`: s.type==="radius"?`r:${s.c[0].toFixed(6)},${s.c[1].toFixed(6)},${Math.round(s.m)}`:"p:"+s.ring.slice(0,-1).map(p=>p.join(",")).join(";"))
      +(s.clip?"!"+CLIP_CODE[s.clip]:""));
}
function parseSel(s){
  if (s.startsWith("g:")){ const parts=s.slice(2).split("~").map(parseSel).filter(Boolean); return parts.length?{type:"group",parts}:null; }
  const t=s.slice(0,1); let rest=s.slice(2), clip;
  const bang=rest.lastIndexOf("!"); if (bang>=0){ clip=CLIP_FROM[rest.slice(bang+1)]; rest=rest.slice(0,bang); }
  const c=o=>(clip&&(o.clip=clip),o);
  try{
    if (t==="a"){ const [kind,code]=rest.split(":"); return {type:"area",kind,code}; }
    if (t==="l") return {type:"lots",bbls:rest.split(",").map(Number).filter(Boolean)};
    if (t==="k") return {type:"blocks",keys:rest.split(",").map(Number).filter(Boolean)};
    if (t==="w"){ const [sid,m]=rest.split(","); return c({type:"walk",sid,m:+m}); }
    if (t==="r"){ const [x,y,m]=rest.split(",").map(Number); return c({type:"radius",c:[x,y],m}); }
    if (t==="p"){ const pts=rest.split(";").map(x=>x.split(",").map(Number)); if (pts.length>2) return c({type:"poly",ring:[...pts,pts[0]]}); }
  }catch(_){}
  return null;
}
function readHash(){
  const q=new URLSearchParams(location.hash.slice(1)), v=q.get("view");
  return {v:q.get("v"),c:q.get("c"),m:q.get("m"),lot:q.get("lot"),sels:q.getAll("s").map(parseSel).filter(Boolean),view:v==null?"all":/^\d+$/.test(v)?+v:v};
}

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
    const sa=e.target.closest("#profile [data-showall]"); if (sa){ delete st.opts.hideCat[sa.dataset.showall]; return renderProfile(); }
    const hc=e.target.closest("#profile [data-hidecat]"); if (hc && !e.target.closest("button")){ const k=hc.dataset.hidecat, n=hc.dataset.name, H=st.opts.hideCat[k]||(st.opts.hideCat[k]=new Set());
      H.has(n)?H.delete(n):H.add(n); if (!H.size) delete st.opts.hideCat[k]; $("#tip").hidden=true; return renderProfile(); }
    const dm=e.target.closest("#profile [data-dqmode]"); if (dm){ setDQ({mode:dm.dataset.dqmode}); return; }
    if (e.target.closest("#profile [data-dqview]")){ const s2=$("#colorBy"); s2.value="dq"; s2.dispatchEvent(new Event("change")); return; }
    const ob=e.target.closest("#profile [data-onlyboro]"); if (ob){ const v=ob.dataset.onlyboro; st.opts.boroExcl=new Set(v==="all"?[]:Object.keys(BORO).map(Number).filter(b=>b!==+v));
      $$("#boroFilter input").forEach(x=>{ x.checked=!st.opts.boroExcl.has(+x.dataset.boro); x.closest("label").classList.toggle("off",!x.checked); }); return renderProfile(); }
    const ct=e.target.closest("#profile [data-clipto]"); if (ct) return applyClip(ct.dataset.clipto);
    const so=e.target.closest("#profile [data-sort]"); if (so){ const [k,m]=so.dataset.sort.split(":"); st.opts.sort[k]=st.opts.sort[k]===m?"std":m; return renderProfile(); }
    const fo=e.target.closest("#profile [data-fold]"); if (fo){ const k=fo.dataset.fold, sec=fo.closest(".blk"), shut=!st.opts.shut.has(k);
      shut?st.opts.shut.add(k):st.opts.shut.delete(k); sec.classList.toggle("shut",shut); fo.setAttribute("aria-expanded",String(!shut)); fo.title=(shut?"Show":"Hide")+" this section"; return; }
    const rm=e.target.closest("#profile [data-x]"); if (rm){ e.stopPropagation(); return removeSel(+rm.dataset.x); }
    const x=e.target.closest("[data-export]"); if (x) return exportPNG(x.dataset.export);
    const l=e.target.closest("[data-lot]"); if (l) return openLot(+l.dataset.lot);
    const own=e.target.closest("[data-showowner]"); if (own){ st.ownerShown.add(+own.dataset.showowner); return renderProfile(); }
    const cb=e.target.closest("[data-copybbl]"); if (cb){ navigator.clipboard&&navigator.clipboard.writeText(cb.dataset.copybbl).then(()=>{ cb.textContent="Copied"; setTimeout(()=>cb.textContent="Copy",1400); }); return; }
    if (e.target.closest("[data-selpeek]")){ const bbl=st.peek; st.peek=null; setMode("lot"); return select({type:"lots",bbls:[bbl]},false); }
    const b=e.target.closest("[data-goblock]"); if (b){ const prev=snapshot(); select({type:"blocks",keys:[+b.dataset.goblock]},true,{keepPrev:true}); st.prevSel=prev; renderProfile(); }
    const pick=e.target.closest("[data-pick]"); if (pick) setView(/^\d+$/.test(pick.dataset.pick)?+pick.dataset.pick:pick.dataset.pick); });
  $("#btnBack").onclick=()=>{ if (st.peek!=null) return peekLot(null); const p=st.prevSel; st.prevSel=null; restore(p.sels.map(e=>e.sel),p.view,true,true); };
  $("#selbar").addEventListener("click",e=>{
    if (e.target.closest("[data-startc]")){ st.combine=new Set(st.sels.map((x,k)=>k).filter(k=>clippable(st.sels[k].sel))); if (st.combine.size<2) st.combine=new Set(st.sels.map((x,k)=>k)); return renderSelbar(); }
    if (e.target.closest("[data-cancelc]")){ st.combine=null; return renderSelbar(); }
    const pc=e.target.closest("[data-pick-c]"); if (pc){ const k=+pc.dataset.pickC; st.combine.has(k)?st.combine.delete(k):st.combine.add(k); return renderSelbar(); }
    if (e.target.closest("[data-merge]")) return mergeSels([...st.combine].sort((a,b)=>a-b));
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
  $$("#dqSeg button").forEach(b=>b.onclick=()=>setDQ({mode:b.dataset.v}));
  $("#dqArea").onchange=e=>setDQ({areaPct:Math.max(5,+e.target.value||25)});
  $("#dqFar").onchange=e=>setDQ({farMax:Math.max(2,+e.target.value||10)});
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
  $("#boroFilter").innerHTML=Object.entries(BORO).map(([b,t])=>`<label><input type="checkbox" data-boro="${b}" ${st.opts.boroExcl.has(+b)?"":"checked"}><span>${t}</span></label>`).join("");
  $("#boroFilter").onchange=e=>{ const b=+e.target.dataset.boro; e.target.checked?st.opts.boroExcl.delete(b):st.opts.boroExcl.add(b); e.target.closest("label").classList.toggle("off",!e.target.checked); renderProfile(); };
  $("#luFilter").onchange=e=>{ const i=+e.target.dataset.lu; e.target.checked?st.opts.luExcl.delete(i):st.opts.luExcl.add(i);
    e.target.closest("label").classList.toggle("off",!e.target.checked); restyleLots(); renderProfile(); };
  $("#btnClear").onclick=()=>{ st.addTo=null; select(null); };
  $("#btnSplit").onclick=()=>splitSel(curIndex());
  $("#btnAddTo").onclick=()=>toggleAddTo(); $("#btnX").onclick=()=>select(null);
  $("#btnLink").onclick=async()=>{ try{ await navigator.clipboard.writeText(location.href); $("#btnLink").textContent="Link copied"; }catch(_){ prompt("Copy this link:",location.href); }
    setTimeout(()=>$("#btnLink").textContent="Copy link",1600); };

  $("#colorBy").onchange=e=>{ st.colorBy=e.target.value; restyleLots(); renderProfile(); writeHash(); };
  $("#swatches").addEventListener("change",e=>{ const t=e.target;
    if (t.matches("[data-col]")){ const v=st.colorBy, i=t.dataset.col, c=t.value; setColors(C=>{ (C.custom[v]=C.custom[v]||{})[i]=c; }); }
    else if (t.id==="palSel"){ const v=st.colorBy; setColors(C=>{ C.scheme[v]=t.value; delete C.custom[v]; }); } });
  $("#swatches").addEventListener("click",e=>{ const r=e.target.closest("[data-resetcol]"); if (r){ e.stopPropagation(); const v=r.dataset.resetcol; setColors(C=>{ delete C.custom[v]; delete C.scheme[v]; }); } },true);
  $("#swatches").onclick=e=>{ if (e.target.closest(".pick,#palSel,.palrow,[data-resetcol]")) return; const d=e.target.closest("[data-c]"); if(!d) return; const H=st.map.hidden[st.colorBy], c=+d.dataset.c; H.has(c)?H.delete(c):H.add(c); restyleLots(); };
  const setRange=()=>{ const a=parseFloat($("#rMin").value), b=parseFloat($("#rMax").value); if (Number.isFinite(a)&&Number.isFinite(b)&&b>a){ st.map.range[st.colorBy]=[a,b]; restyleLots(); } };
  $("#rMin").onchange=setRange; $("#rMax").onchange=setRange;
  $("#rAuto").onclick=()=>{ if (RANGE_DEFAULT[st.colorBy]) st.map.range[st.colorBy]=[...RANGE_DEFAULT[st.colorBy]]; else delete st.map.range[st.colorBy]; restyleLots(); };
  $("#opacity").oninput=e=>{ st.map.opacity=+e.target.value; $("#opOut").textContent=Math.round(st.map.opacity*100)+"%"; setFillOpacity(); };
  $$("[data-opt]").forEach(cb=>cb.onchange=()=>{ const o=cb.dataset.opt; st.map[o]=cb.checked; $$(`[data-opt="${o}"]`).forEach(x=>x.checked=cb.checked);
    if (o==="tracts") clearHover(); if (o==="dim") applyFade(); if (o==="fill"){ setFillOpacity(); renderLegend(); } applyMapOpts(); });
  $$("[data-sub]").forEach(cb=>cb.onchange=()=>{ st.map.sub[cb.dataset.sub]=cb.checked; applyMapOpts(); });
  $$("[data-zon]").forEach(cb=>cb.onchange=()=>{ st.map.zon[cb.dataset.zon]=cb.checked; applyMapOpts(); });
  const zs=$("#zonStatus"); if (zs) zs.textContent=st.zoningFile?`Zoning map: ${st.zoningFile.source||"NYC DCP"}, ${st.zoningFile.date}. Display only.`:"Zoning map tiles not found (run python tools/zoning.py).";
  $("#rings").onchange=e=>{ st.map.rings=+e.target.value; drawRings(); };
  $("#lzSeg").onclick=e=>{ const b=e.target.closest("[data-z]"); if (b) setLotZoom(+b.dataset.z); };
  $("#swatches").addEventListener("click",e=>{ const b=e.target.closest("[data-lotz]"); if (b){ e.stopPropagation(); setLotZoom(+b.dataset.lotz); } });
  $("#blockAgg").onchange=e=>{ const v=st.colorBy, k=aggKind(v); st.map.blockAgg[k]=e.target.value; styleBlocks(true); renderLegend(); };
}
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const plain=s=>String(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
function exportMap(){
  const btn=$("#mapPng"); btn.disabled=true;
  map.once("render",()=>{
    try{
      const mc=map.getCanvas(), sc=mc.width/mc.clientWidth, W=mc.width, v=st.colorBy, legH=Math.round(150*sc);
      const cv=document.createElement("canvas"); cv.width=W; cv.height=mc.height+legH; const g=cv.getContext("2d");
      g.drawImage(mc,0,0); g.fillStyle="#fff"; g.fillRect(0,mc.height,W,legH);
      const F=(w,px)=>`${w} ${Math.round(px*sc)}px "Helvetica Neue",Helvetica,Arial,sans-serif`, y0=mc.height+Math.round(26*sc), pad=Math.round(18*sc);
      const title=st.sel?$("#areaName").textContent:"Lot Profiler";
      g.fillStyle="#14263B"; g.font=F(700,16); g.fillText(title,pad,y0);
      g.fillStyle="#5B6B7C"; g.font=F(400,12); g.fillText(`${VIEW_LABEL[v]||v} · MapPLUTO ${st.P.id} · zoom ${map.getZoom().toFixed(1)}${map.getZoom()<lotZ()?` (tax blocks: ${(AGG[aggKind(v)].find(x=>x[0]===st.map.blockAgg[aggKind(v)])||["",""])[1].toLowerCase()})`:""}`,pad,y0+Math.round(18*sc));
      const items=[...$("#swatches").querySelectorAll(":scope > div")].filter(d=>d.querySelector("i,.pick")).map(d=>[getComputedStyle(d.querySelector("i,.pick")).backgroundColor,d.textContent.trim(),d.classList.contains("hid")]);
      const ramp=$("#swatches .ramp");
      let x=pad, y=y0+Math.round(42*sc); const colW=Math.round(270*sc), rowH=Math.round(17*sc);
      if (ramp){ const lab=[...$$("#swatches .rl span")].map(e=>e.textContent), gw=Math.round(260*sc), gr=g.createLinearGradient(x,0,x+gw,0);
        const cols=getComputedStyle(ramp).backgroundImage.match(/rgba?\([^)]+\)/g)||[]; cols.forEach((c,k)=>gr.addColorStop(k/Math.max(1,cols.length-1),c));
        g.fillStyle=gr; g.fillRect(x,y-Math.round(10*sc),gw,Math.round(12*sc)); g.fillStyle="#14263B"; g.font=F(400,11);
        lab.forEach((t,k)=>{ g.textAlign=k===0?"left":k===lab.length-1?"right":"center"; g.fillText(t,x+gw*k/Math.max(1,lab.length-1),y+Math.round(16*sc)); }); g.textAlign="left"; }
      else items.filter(t=>!t[2]).forEach(([c,t],k)=>{ const cx=x+Math.floor(k/5)*colW, cy=y+(k%5)*rowH;
        g.fillStyle=c; g.fillRect(cx,cy-Math.round(9*sc),Math.round(10*sc),Math.round(10*sc)); g.fillStyle="#14263B"; g.font=F(400,11.5); g.fillText(t.slice(0,44),cx+Math.round(15*sc),cy); });
      g.fillStyle="#7A8794"; g.font=F(400,10); g.textAlign="right";
      g.fillText("Lot Profiler · NYC DCP MapPLUTO · © OpenStreetMap contributors, OpenMapTiles"+(st.map.basemap==="sat"?" · Imagery © Esri":""),W-pad,cv.height-Math.round(10*sc)); g.textAlign="left";
      cv.toBlob(b=>{ if (b) download(b,`${slug(title)}-map-${st.P.id}.png`); else toast("The map image couldn't be saved."); btn.disabled=false; });
    }catch(err){ console.warn("map image:",err); toast(st.map.basemap==="sat"?"The satellite imagery can't be saved in an image. Switch the basemap to Map and try again.":"The map image couldn't be saved."); btn.disabled=false; }
  });
  map.triggerRepaint();
}
function exportPNG(key){
  const sp=st.specs[key], W=760, pies=st.opts.style==="pies"&&sp.charts, rows=(sp.rows||[]).filter(r=>!r.hid), kv=sp.kv||[], cmp=sp.cmpRows||[];
  const mr=sp.mrows||[], br=sp.bars||[];
  const ks=clipTargets(), clipTxt=ks.length?"Lot inclusion: "+[...new Set(ks.flatMap(k=>clipsIn(st.sels[k].sel)))].map(c=>CLIP_NAME[c].toLowerCase()).join(" / "):"";
  const chartH=sp.charts?(pies?250:70):sp.hist?150:0, H=96+(clipTxt?18:0)+chartH+(rows.length+1)*24+(kv.length+cmp.length)*24+(mr.length?(mr.length+1)*24:0)+br.length*52+40, k=2;
  const cv=document.createElement("canvas"); cv.width=W*k; cv.height=H*k; const g=cv.getContext("2d"); g.scale(k,k);
  const F=(w,s)=>`${w} ${s}px "Helvetica Neue",Helvetica,Arial,sans-serif`;
  g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.fillStyle="#14263B"; g.font=F(700,22); g.fillText(sp.title,28,42);
  g.fillStyle="#5B6B7C"; g.font=F(400,14); g.fillText(`${$("#areaName").textContent}, MapPLUTO ${st.P.id}${sp.placeholder?` · maximum FAR ${NOT_YET.toLowerCase()}`:""}`,28,66);
  let y=92; if (clipTxt){ g.font=F(400,12.5); g.fillText(clipTxt,28,84); y+=18; }
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
    g.font=F(700,13.5); g.textAlign="right"; g.fillText(/data-showowner/.test(b)?"Not shown":plain(b),W-28,y); g.textAlign="left"; });
  cv.toBlob(b=>download(b,`${slug($("#areaName").textContent)}-${key}-${st.P.id}.png`));
}

const ADDR_WORDS={st:"street",str:"street",ave:"avenue",av:"avenue",rd:"road",pl:"place",blvd:"boulevard",pkwy:"parkway",dr:"drive",ln:"lane",ct:"court",
  ter:"terrace",terr:"terrace",sq:"square",hwy:"highway",expy:"expressway",tpke:"turnpike",bway:"broadway",saint:"street",ste:"street",e:"east",w:"west",n:"north",s:"south"};
const DIRS=new Set(["e","w","n","s"]);
function normAddr(raw, partial){
  const t=raw.toLowerCase().replace(/(\d)-(\d)/g,"$1$2").replace(/[.,#']/g," ").replace(/\b(\d+)(st|nd|rd|th)\b/g,"$1").replace(partial?/(\d)(s|st|n|nd|r|rd|t|th)$/:/$^/,"$1").split(/\s+/).filter(Boolean);
  return t.map((w,k)=>{ const last=k===t.length-1, x=ADDR_WORDS[w];
    if (!x) return w; if (DIRS.has(w)) return last||/^av/.test(t[k-1]||"")?w:x; return partial&&last&&w.length<2?w:x; }).join(" ");
}
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
  if (n.length===1 && boro==null && !kw) return null;
  return {boro, block:n[0], lot:n[1]};
}
function buildSearch(){
  const inp=$("#q"), res=$("#qres"); let hits=[], cur=-1, t=null;
  const draw=()=>{ inp.setAttribute("aria-expanded",String(hits.length>0)); if (cur>=0) inp.setAttribute("aria-activedescendant","qr-"+cur); else inp.removeAttribute("aria-activedescendant");
    res.innerHTML=hits.map((h,k)=>`<li role="option" id="qr-${k}" data-k="${k}" aria-selected="${k===cur}"><span><em>${h.tag}</em>${esc(h.label)}</span><small>${esc(h.sub||"")}</small></li>`).join(""); };
  const P=()=>st.P;
  const go=h=>{ res.innerHTML=""; inp.setAttribute("aria-expanded","false"); h.go(); if (h.tag!=="None"&&h.tag!=="…") setTimeout(()=>$("#areaName").focus({preventScroll:false}),60); };
  const lotHit=i=>({tag:"Lot",label:addrOf(P(),i)||"BBL "+Math.round(P().bbl[i]),sub:(()=>{const p=bblParts(P().bbl[i]);return `${BORO[p.boro]} ${p.block}-${p.lot}`;})(),
    go:()=>{ const bbl=Math.round(P().bbl[i]); if (st.mode==="view") return peekLot(bbl,true); setMode("lot"); select({type:"lots",bbls:[bbl]},true); }});
  inp.oninput=()=>{ clearTimeout(t); t=setTimeout(()=>{ const raw=inp.value.trim(), q=raw.toLowerCase().replace(/\s+/g," "); cur=-1; hits=[];
    if (q.length<2){ return draw(); }
    const lk=parseLookup(raw);
    if (lk && lk.bbl){ const i=P().bblIdx.get(lk.bbl); if (i!=null) hits.push(lotHit(i)); }
    else if (lk){ const keys=[...P().blockIdx.keys()].filter(k=>k%1e5===lk.block&&(lk.boro==null||Math.floor(k/1e5)===lk.boro));
      for (const key of keys){
        if (lk.lot!=null){ const bbl=key*1e4+lk.lot, i=P().bblIdx.get(bbl); if (i!=null) hits.push(lotHit(i)); }
        else hits.push({tag:"Block",label:blockName(key),sub:`${fmt(P().blkCount[P().blockIdx.get(key)])} lots`,go:()=>{ setMode("block"); select({type:"blocks",keys:[key]},true); }}); }
      if (!hits.length) hits.push({tag:"None",label:`No ${lk.lot!=null?"lot":"block"} ${lk.block}${lk.lot!=null?"-"+lk.lot:""} in the loaded data`,go:()=>{}}); }
    const sq=normAddr(q,true), netQ=/^(lirr|long island rail ?road|metro.?north|mnr|path)$/.test(q)?(/^(lirr|long)/.test(q)?"LIRR":/^path/.test(q)?"PATH":"MNR"):null;
    if (st.T && q.length>=2) st.T.other.forEach((s,k)=>{ if (hits.length<12 && (netQ?s.net===netQ:(s.name.toLowerCase().includes(q)||normAddr(s.name,false).includes(sq)))) hits.push({tag:"Station",label:s.name,sub:netLabel(s),go:()=>{ map.flyTo({center:[s.lng,s.lat],zoom:16,duration:700}); map.once("moveend",()=>otherPopup(k)); }}); });
    if (st.T && q.length>=2 && !netQ){ st.T.nameLower.forEach((n,k)=>{ if (hits.length<10 && (n.includes(q)||normAddr(n,false).includes(sq))){ const s=st.T.stations[k];
      hits.push({tag:"Station",label:s.name,sub:s.routes.join(" "),go:()=>{ map.flyTo({center:[s.lng,s.lat],zoom:16,duration:700}); map.once("moveend",()=>stationPopup(k)); }}); } }); }
    let qa=q.replace(/,/g," ").replace(/\s+/g," ").trim(), boroF=null;
    { let m2; if ((m2=/\s(\d{5})$/.exec(qa))) qa=qa.slice(0,m2.index).trim();
      qa=qa.replace(/\s(ny|new york|nyc)$/,"").trim();
      const BW={manhattan:1,"new york":1,bronx:2,"the bronx":2,brooklyn:3,queens:4,"staten island":5};
      for (const [w,c] of Object.entries(BW)) if (qa.endsWith(" "+w)&&qa.split(" ").length>2){ qa=qa.slice(0,-w.length-1).trim(); boroF=c; break; }
      if ((m2=/\s(\d{5})$/.exec(qa))) qa=qa.slice(0,m2.index).trim(); }
    const inBoro=i=>boroF==null||Math.floor(P().bbl[i]/1e9)===boroF;
    if (q.length>=3 && P().areas){ let na=0; P().areas.forEach(a=>{ if (na<4 && a.name && (a.name.toLowerCase().includes(q)||(a.kind==="tract"&&a.code===q))){ na++;
      hits.push({tag:a.kind==="nta"?"NTA":"Tract",label:a.name,sub:a.kind==="nta"?"Neighborhood tabulation area":"2020 census tract",go:()=>{ setMode(a.kind==="nta"?"area":"tract"); select({type:"area",kind:a.kind,code:a.code},true); }}); } }); }
    if (q.length>=3 && !P().addrLower) hits.push({tag:"…",label:"Addresses are still loading",go:()=>{}});
    if (qa.length>=3 && P().addrLower){ const A=P().addrLower, N=P().addrNorm||(P().addrNorm=P().addr.map(a=>normAddr(a))), nq=normAddr(qa,true), starts=[], has=[];
      const bq=" "+nq;
      for (let i=0;i<A.length&&starts.length<8;i++){ if (!inBoro(i)) continue; const s=A[i], n=N[i]; if(s.startsWith(qa)||n.startsWith(nq)) starts.push(i); else if(has.length<8&&((" "+s).includes(" "+qa)||(" "+n).includes(bq))) has.push(i); }
      starts.concat(has).slice(0,8).forEach(i=>hits.push(lotHit(i)));
      const m=/^(\d+)\s+(.+\S)$/.exec(normAddr(qa,false));
      if (!starts.length && m && m[2].split(" ").length>=2){ const num=+m[1], tail=" "+m[2], near=[];
        for (let i=0;i<N.length;i++){ const n=N[i]; if (!n.endsWith(tail)||!inBoro(i)) continue; const h=parseInt(n,10); if (!(h>=0)||n.length!==String(h).length+tail.length) continue;
          near.push([Math.abs(h-num)+((h-num)%2?1e6:0),i]); }
        near.sort((x,y)=>x[0]-y[0]).slice(0,3).forEach(([,i])=>hits.push({...lotHit(i),tag:"Nearby"})); } }
    if (!hits.length && q.length>=3 && P().addrLower) hits.push({tag:"None",label:"No address, BBL, block or station matches",sub:"PLUTO lists one address per lot; try the street without the number",go:()=>{}});
    hits=hits.slice(0,12); draw(); },70); };
  inp.onkeydown=e=>{ if(!hits.length) return;
    if (e.key==="ArrowDown"){ cur=Math.min(hits.length-1,cur+1); draw(); e.preventDefault(); }
    else if (e.key==="ArrowUp"){ cur=Math.max(0,cur-1); draw(); e.preventDefault(); }
    else if (e.key==="Enter") go(hits[Math.max(0,cur)]);
    else if (e.key==="Escape"){ hits=[]; draw(); } };
  res.onmousedown=e=>{ const li=e.target.closest("li"); if(li){ e.preventDefault(); go(hits[+li.dataset.k]); } };
  inp.onblur=()=>setTimeout(()=>{ res.innerHTML=""; },150);
}

function openGuide(on){
  const g=$("#guide"), b=$("#guideBtn"); g.hidden=!on; b.setAttribute("aria-expanded",on); b.classList.toggle("on",on);
  if (on){ g.focus({preventScroll:true}); try{ localStorage.setItem("lp-guide-seen","1"); }catch(_){} }
  $$(".gpulse").forEach(x=>x.classList.remove("gpulse"));
}
function wireGuide(){
  $("#guideBtn").onclick=()=>openGuide($("#guide").hidden);
  $("#guide").addEventListener("click",e=>{ if (e.target.closest("[data-gclose]")) openGuide(false); });

  const pulse=e=>{ const li=e.target.closest("[data-gfocus]"); $$(".gpulse").forEach(x=>x.classList.remove("gpulse"));
    if (!li) return; const el=$(li.dataset.gfocus); if (el && el.offsetParent) el.classList.add("gpulse"); };
  $("#guide").addEventListener("mouseover",pulse); $("#guide").addEventListener("focusin",pulse);
  $("#guide").addEventListener("mouseleave",()=>$$(".gpulse").forEach(x=>x.classList.remove("gpulse")));
  document.addEventListener("click",e=>{ if (e.target.closest("[data-guide]")) openGuide(true); });
  addEventListener("keydown",e=>{ if (e.key==="Escape" && !$("#guide").hidden) openGuide(false); });
  let seen=false; try{ seen=!!localStorage.getItem("lp-guide-seen"); }catch(_){ seen=true; }
  if (!seen && !location.hash.includes("s=") && !navigator.webdriver) openGuide(true);
}
function toggleAdd(){ st.addMode=!st.addMode; $("#addBtn").classList.toggle("on",st.addMode); $("#addBtn").setAttribute("aria-pressed",st.addMode);
  if (st.mode==="radius") setMode("radius"); }

async function boot(){
  try{
    const styleJob=loadBaseStyle();
    st.releases=window.__LP__?window.__LP__.releases:await (await fetch("data/releases.json")).json();
    if (!st.releases.length) throw new Error("No PLUTO releases found in data/releases.json. Build one with tools/build.py.");
    const h=readHash(), want=st.releases.find(r=>r.id===h.v)||st.releases[st.releases.length-1];
    st.P=await getPack(want.id);
    if (h.c&&h.c!==want.id&&st.releases.some(r=>r.id===h.c)) st.C=await getPack(h.c);
    if (h.m&&h.m!=="zn") st.colorBy=h.m;
    buildColorBy();
    st.zoningFile=await getZoningFile(want);
    if (innerWidth<=820) $("#legend").open=false;
    initMap(await styleJob); renderTrack(); renderProfile(); wirePanel(); wireOptions(); buildSearch(); wireGuide();
    $("#tools").onclick=e=>{ const b=e.target.closest("[data-mode]"); if(b) setMode(b.dataset.mode); };
    $("#hint").onclick=e=>{ const b=e.target.closest("[data-r]"); if(!b) return; st.radiusPreset=+b.dataset.r; setMode("radius"); };
    $("#hint").addEventListener("click",e=>{ const k=e.target.closest("[data-mk]"); if (k){ meas.kind=k.dataset.mk; meas.pts=[]; meas.done=false; setMode("measure"); drawMeas(); return; }
      if (e.target.closest("[data-mdone]")){ meas.done=true; drawMeas(); return; }
      if (e.target.closest("[data-mclear]")){ meas.pts=[]; meas.done=false; drawMeas(); return; } });
    $("#mapPng").onclick=exportMap;
    $("#hint").addEventListener("click",e=>{ if (e.target.closest("[data-doneadd]")){ st.addTo=null; setMode("view"); renderProfile(); } });

    const cm=$("#clipMenu"), cb=$("#clipBtn");
    const drawMenu=()=>{ cm.innerHTML=`<div class="cmh">Lot inclusion<small>Radius, walkshed and drawn selections</small></div>`+
      Object.keys(CLIP_NAME).map(k=>`<button role="menuitemradio" aria-checked="${k===st.clip}" data-c="${k}" class="${k===st.clip?"on":""}"><b>${CLIP_NAME[k]}${k==="touch"?" <em>default</em>":""}</b><span>${CLIP_DESC[k]}</span></button>`).join("")+
      (clipTargets().length?`<label class="cmall"><input type="checkbox" id="clipApply" checked> Apply to current selection</label>`:"");
      const r=cb.getBoundingClientRect(), m=$("#mapbox").getBoundingClientRect(); cm.style.left=Math.max(8,r.left-m.left-150)+"px"; cm.style.top=(r.bottom-m.top+6)+"px"; };
    cb.onclick=e=>{ e.stopPropagation(); const open=cm.hidden; if (open) drawMenu(); cm.hidden=!open; cb.setAttribute("aria-expanded",open); };
    cm.onclick=e=>{ e.stopPropagation(); const b=e.target.closest("[data-c]"); if (!b) return; const v=b.dataset.c, all=$("#clipApply");
      st.clip=v; cm.hidden=true; cb.setAttribute("aria-expanded","false");
      if (all&&all.checked&&clipTargets().length) applyClip(v); else toast(`Lot inclusion: ${CLIP_NAME[v].toLowerCase()}.`);
      if (st.mode==="radius"||st.mode==="poly") setMode(st.mode); };
    document.addEventListener("click",e=>{ if (!cm.hidden && !e.target.closest("#clipMenu,#clipBtn")){ cm.hidden=true; cb.setAttribute("aria-expanded","false"); } });
    $("#clipRow").onchange=e=>{ if (e.target.matches("[data-clip]") && e.target.value) applyClip(e.target.value); };
    $("#track").onclick=e=>{ const b=e.target.closest("[data-rel]"); if(b) switchRelease(b.dataset.rel); };
    $("#cmp").onchange=e=>setCompare(e.target.value);
    document.addEventListener("click",e=>{ const w=e.target.closest("[data-walk]"), en=e.target.closest("[data-ent]"), rt=e.target.closest("[data-route]"), o={map:true,add:e.shiftKey};
      if (w) select({type:"walk",sid:w.dataset.walk,m:+w.dataset.m,clip:st.clip},true,o);
      const orad=e.target.closest("[data-orad]"); if (orad){ const x=st.T.other[+orad.dataset.orad], m=+orad.dataset.m;
        select({type:"radius",c:[x.lng,x.lat],m,label:`Within ${miles(m)} of ${x.name} (${netLabel(x)})`,clip:st.clip},true,o); }
      if (en){ const x=st.T.entrances[+en.dataset.ent], s=st.T.byId.get(x.sid), m=+en.dataset.m;
        select({type:"radius",c:[x.lng,x.lat],m,label:`Within ${miles(m)} of an entrance to ${s.name}`,clip:st.clip},true,o); }
      const ort=e.target.closest("[data-oroute]");
      if (rt||ort){ const r=(rt||ort).dataset.route||ort.dataset.oroute, [[x0,y0],[x1,y1]]=st.P.bbox, pad=0.012, inb=s=>s.lng>x0-pad&&s.lng<x1+pad&&s.lat>y0-pad&&s.lat<y1+pad;
        const near=rt?st.T.stations.filter(s=>s.routes.includes(r)&&inb(s)).map(s=>s.id)
          :st.T.other.map((s,k)=>[s,k]).filter(([s])=>s.net===ort.dataset.net&&(s.routes||[]).includes(r)&&inb(s)).map(([,k])=>"o"+k);
        if (!near.length) return;
        const walks=[...new Set(near)].map(sid=>({type:"walk",sid,m:804.7,clip:st.clip}));
        if (popup) popup.remove();
        if (st.addTo!=null && st.sels[st.addTo]){ pushUndo(); const k=st.addTo, g=st.sels[k]; st.sels[k]={...g,sel:{...g.sel,parts:[...g.sel.parts,...walks]}}; st.view=st.sels.length>1?k:0; drawSelection(); renderProfile(); writeHash(); return; }
        const grp={type:"group",parts:walks};
        const keep=(st.addMode||e.shiftKey)?st.sels.map(x=>x.sel):[];
        restore(keep.concat([grp]),keep.length?keep.length:0,true,true); } });
    $("#addBtn").onclick=()=>toggleAdd();
    $("#satBtn").onclick=()=>{ st.map.basemap=st.map.basemap==="sat"?"map":"sat"; applyMapOpts(); };
    $("#basemap").onchange=e=>{ st.map.basemap=e.target.value; applyMapOpts(); };
    addEventListener("keydown",e=>{ if (e.target.matches("input,select,textarea")) return;
      if ((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==="z"||e.key.toLowerCase()==="y")){ e.preventDefault();
        return (e.key.toLowerCase()==="y"||e.shiftKey) ? redo() : undo(); }
      if (e.key==="Escape"){ if(st.mode==="poly"||st.mode==="radius"||st.mode==="measure") setMode("view"); else if(popup) popup.remove(); else if (st.peek!=null) peekLot(null); }
      else if (e.key==="Enter"&&st.mode==="poly") finishPoly(e.shiftKey);
      else if (e.key==="Enter"&&st.mode==="measure"){ meas.done=true; drawMeas(); }
      else if ((e.key==="["||e.key==="]") && st.sels.length>1){ const seq=["all","cmp",...st.sels.map((_,k)=>k)], at=seq.indexOf(st.view); setView(seq[(at+(e.key==="]"?1:seq.length-1))%seq.length]); }
      else if (e.key==="+"||e.key==="=") toggleAdd();
      else { const m={v:"view",l:"lot",b:"block",n:"area",a:"area",t:"tract",d:"poly",r:"radius",m:"measure"}[e.key.toLowerCase()]; if(m&&!e.metaKey&&!e.ctrlKey) setMode(m); } });
    if (h.sels.length) map.once("load",()=>restore(h.sels,h.view,true));
    if (h.lot && /^\d{10}$/.test(h.lot)) map.once("load",()=>setTimeout(()=>peekLot(+h.lot,!h.sels.length),0));
    writeHash();
    try{ for (const k of Object.keys(localStorage)) if (k.startsWith("lp-lines-")) localStorage.removeItem(k); }catch(_){}
    loadTransit().catch(err=>{ console.warn("transit:",err); $("#subStatus").textContent=`Subway data didn't load (${err.message}). Run python tools/transit.py to bundle it with the site.`; });
  }catch(err){
    console.error(err); $("#loading").hidden=false;
    $("#loading").innerHTML=`<div style="max-width:420px;text-align:center;line-height:1.5"><b>The lot data didn't load.</b><br>${esc(err.message)}</div>`;
  }
}
boot();
