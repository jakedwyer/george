'use strict';
/* ================================================================
   LAXFOO RACING — 3D
   Boomerang Foo x lacrosse x Mario Kart, rendered in real-time 3D.
   Chase cam, PBR materials, procedural vehicles & players.
   ================================================================ */

const TAU = Math.PI*2;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const dist = (x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1);
const angDiff = (a,b)=>{let d=(b-a)%TAU; if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; return d;};
const rnd = (a,b)=>a+Math.random()*(b-a);
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];

/* ---------------- THE 50 STICKS ---------------- */
const STICKS = [
  "Splintered Loaner","Backyard Shorty","Garage Sale Special","Duct-Tape Twig","Hand-Me-Down Hickory",
  "Rusty Screamer","Driveway Dangler","Wooden Wonder","Old Faithful","The Fence Post",
  "Alley Whip","Curbside Cannon","Thrift Store Thunder","The Yard Stick","Suburban Slinger",
  "Cul-de-Sac Cradle","The Mailbox Menace","Two-Car Garage Gale","Minivan Missile","The Carpool Cannon",
  "Varsity Viper","Wing-Dodger Whistler","The Highway Hurler","Interstate Interceptor","Overpass Overlord",
  "The Speed Bump","Torque Wrench","The Gear Shifter","Clutch Cradler","Turbo Twig",
  "The Supercharger","Nitro Netter","The Redline Rocket","Burnout Bringer","The Drift King",
  "Four-Wheel Fury","Mudslinger Supreme","The Trailblazer","Summit Slinger","The Avalanche",
  "Thunderhead","The Hurricane Hurler","Cyclone Sidewall","The Earthquake","Meteor Mesher",
  "The Supernova","Galaxy Gouger","The Singularity","Mythic Crosse of Foo","THE GOLDEN CROSSE"
];
const MAX_STICK = 50;
function stickStats(lv){
  return {
    throwSpeed: 560 + lv*13,
    cooldown: Math.max(0.22, 0.62 - lv*0.008),
    ballR: 7 + lv*0.10,
    range: 480 + lv*9,
    carry: 2 + Math.floor(lv/12),
    spread: lv>=45 ? 3 : (lv>=28 ? 2 : 1),
    stun: 1.1 + lv*0.008
  };
}

/* ---------------- CROSSE-PLAYERS ---------------- */
// One entry per crosse-player. Edit names / teams here; perks are game bonuses only.
const SKIN="#e0a87e";
const PLAYERS = [
  {name:"Marcus Holman",      team:"Cannons",         pos:"Attack",  color:"#ff5252", skin:SKIN, jersey:"#c8102e", perk:"Rifle Arm — +12% throw speed",     mod:{throw:1.12}},
  {name:"Asher Nolting",      team:"Cannons",         pos:"Attack",  color:"#ffca28", skin:SKIN, jersey:"#c8102e", perk:"Cannon Arm — +15% throw range",     mod:{range:1.15}},
  {name:"Matt Campbell",      team:"Cannons",         pos:"Midfield",color:"#4fc3f7", skin:SKIN, jersey:"#c8102e", perk:"Motor — +8% top speed",             mod:{speed:1.08}},
  {name:"Colin Kirst",        team:"Cannons",         pos:"Goalie",  color:"#66bb6a", skin:SKIN, jersey:"#c8102e", perk:"Vacuum — bigger ground-ball scoop", mod:{scoop:1.6}},
  {name:"Owen Grant",         team:"Cannons",         pos:"Defense", color:"#8d6e63", skin:SKIN, jersey:"#c8102e", perk:"Lumber — victims stunned longer",   mod:{bigHit:1.35}},
  {name:"Colin Schallenberg", team:"Carnegie Mellon", pos:"",        color:"#ba68c8", skin:SKIN, jersey:"#a6192e", perk:"Quick Stick — 15% faster reload",   mod:{cool:0.85}},
  {name:"Xander Dixon",       team:"Carnegie Mellon", pos:"",        color:"#26c6da", skin:SKIN, jersey:"#a6192e", perk:"Late Apex — +10% handling",         mod:{handling:1.10}},
  {name:"Tartan Walk-On",     team:"Carnegie Mellon", pos:"",        color:"#f06292", skin:SKIN, jersey:"#a6192e", perk:"Iron Ribs — 30% shorter stuns",     mod:{stun:0.7}},
];

/* ---------------- THE GARAGE ---------------- */
const RARITY = {
  common:   {label:"COMMON",    color:"#9aa5b1"},
  uncommon: {label:"UNCOMMON",  color:"#4caf50"},
  rare:     {label:"RARE",      color:"#2196f3"},
  epic:     {label:"EPIC",      color:"#9c27b0"},
  legendary:{label:"LEGENDARY", color:"#ffb300"},
};
const CARS = [
  {id:"bronco96",  name:"'96 Ford Bronco XLT",     rarity:"common",  body:"#b71c1c", roof:"#eceff1", speed:.62,handling:.55,tough:.70, spare:true,  cab:"closed", round:false, asset:"bronco96"},
  {id:"wranglerTJ",name:"Jeep Wrangler TJ",        rarity:"common",  body:"#2e7d32", roof:"#20262b", speed:.55,handling:.70,tough:.60, spare:true,  cab:"closed", round:true,  jeepGrille:true, asset:"wranglerTJ"},
  {id:"runner5g",  name:"Toyota 4Runner TRD Pro",  rarity:"common",  body:"#b0bec5", roof:"#aeb8bf", speed:.66,handling:.60,tough:.62, spare:false, cab:"closed", round:false, rack:true, asset:"runner5g"},
  {id:"disco2",    name:"Land Rover Discovery II", rarity:"common",  body:"#1565c0", roof:"#e8eef5", speed:.60,handling:.58,tough:.72, spare:false, cab:"closed", round:false, rack:true, asset:"disco2"},
  {id:"cherokeeXJ",name:"Jeep Cherokee XJ",        rarity:"uncommon",body:"#6d1b2d", roof:"#5a1626", speed:.72,handling:.68,tough:.68, spare:false, cab:"closed", round:false, asset:"cherokeeXJ"},
  {id:"bronco21",  name:"'21 Bronco Badlands",     rarity:"uncommon",body:"#7c8f7a", roof:"#22282e", speed:.76,handling:.66,tough:.70, spare:true,  cab:"closed", round:true, asset:"bronco21"},
  {id:"runner3g",  name:"'97 4Runner Limited",     rarity:"uncommon",body:"#33691e", roof:"#2c5a1a", speed:.70,handling:.74,tough:.66, spare:false, cab:"closed", round:false, rack:true, asset:"runner3g"},
  {id:"defender90",name:"Land Rover Defender 90",  rarity:"rare",    body:"#f9a825", roof:"#f2f4f5", speed:.74,handling:.72,tough:.86, spare:true,  cab:"closed", round:true,  rack:true, snorkel:true, asset:"defender90"},
  {id:"willys",    name:"Willys CJ-5",             rarity:"rare",    body:"#556b2f", roof:null,      speed:.68,handling:.88,tough:.62, spare:true,  cab:"open",   round:true,  jeepGrille:true, asset:"willys"},
  {id:"bronco66",  name:"'66 Bronco Half-Cab",     rarity:"epic",    body:"#81d4fa", roof:"#f4f6f7", speed:.86,handling:.82,tough:.75, spare:true,  cab:"half",   round:true, asset:"bronco66"},
  {id:"rangeclassic",name:"Range Rover Classic",   rarity:"epic",    body:"#1b4332", roof:"#25543f", speed:.90,handling:.76,tough:.85, spare:false, cab:"closed", round:false, rack:true, asset:"rangeclassic"},
  {id:"runner85",  name:"'85 4Runner SR5 Soft Top",rarity:"legendary",body:"#d2b48c",roof:null,      speed:.95,handling:.92,tough:.90, spare:true,  cab:"soft",   round:false,
    special:"Sunset Special — starts the match at Stick 3", onlyOne:true, asset:"runner85"},
];

/* ---------------- THE TRACK: "HOME CIRCUIT" (plan units) ---------------- */
const WORLD = {w:3200, h:2300};
const LAPS = 3;
const TRACK_W = 250, SHOULDER = 55, WALL_OFF = TRACK_W/2 + SHOULDER;   // road ±125, walls at ±180
// centreline of the loop (closed Catmull-Rom spline). A lap runs garage -> bedroom -> backyard
// (around the pool) -> kitchen -> living-room S-bend -> hallway -> finish line.
const TRACK_CTRL = [[1000,1950],[1600,1930],[2100,1880],[2600,1750],[2900,1350],[2850,900],[2550,600],[2100,400],
                    [1650,470],[1380,700],[1180,980],[850,1120],[540,1260],[370,1520],[450,1820],[700,1950]];
const ZONES = [   // control-point ranges -> floor texture + wall style
  {name:"garage",      from:0,  to:1,  set:"concrete", col:0xcfccc6, tile:170, wall:"house"},
  {name:"bedroom",     from:1,  to:2,  set:"carpet",   col:0xb9b0c8, tile:90,  wall:"house"},
  {name:"backyard",    from:2,  to:7,  set:"stone",    col:0xd6cec2, tile:140, wall:"fence"},
  {name:"kitchen",     from:7,  to:9,  set:"tile",     col:0xffffff, tile:120, wall:"house"},
  {name:"living room", from:9,  to:12, set:"wood",     col:0xe2c093, tile:130, wall:"house"},
  {name:"hallway",     from:12, to:16, set:"wood",     col:0xd9b88b, tile:130, wall:"house"},
];
const WALL_H = 46, FENCE_H = 40;
const WALLS = [   // the yard fence around the lot; the track walls are generated from the spline
  {x:0,y:0,w:WORLD.w,h:40,fence:true},{x:0,y:WORLD.h-40,w:WORLD.w,h:40,fence:true},
  {x:0,y:0,w:40,h:WORLD.h,fence:true},{x:WORLD.w-40,y:0,w:40,h:WORLD.h,fence:true},
];
const TRACK = {pts:[], N:0, len:0, ctrlS:[]};
(function buildTrackSamples(){
  const P=TRACK_CTRL, n=P.length, raw=[], cs=[];
  const cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return [0,1].map(i=>0.5*((2*p1[i])+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3));};
  for(let k=0;k<n;k++){
    const p0=P[(k-1+n)%n],p1=P[k],p2=P[(k+1)%n],p3=P[(k+2)%n];
    cs.push(raw.length);
    for(let j=0;j<24;j++)raw.push(cr(p0,p1,p2,p3,j/24));
  }
  const L=[0]; for(let i=1;i<=raw.length;i++){const a=raw[i-1],b=raw[i%raw.length];L.push(L[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  const total=L[raw.length], N=600; let j=0;
  for(let i=0;i<N;i++){
    const d=total*i/N; while(L[j+1]<d)j++;
    const a=raw[j],b=raw[(j+1)%raw.length],t=(d-L[j])/(L[j+1]-L[j]);
    TRACK.pts.push({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,s:i/N});
  }
  for(let i=0;i<N;i++){
    const p=TRACK.pts[i],q=TRACK.pts[(i+1)%N],o=TRACK.pts[(i-1+N)%N];
    let dx=q.x-o.x,dy=q.y-o.y; const l=Math.hypot(dx,dy)||1; dx/=l;dy/=l;
    p.dx=dx;p.dy=dy;p.nx=-dy;p.ny=dx;          // nx,ny = right-hand side of the direction of travel
  }
  TRACK.len=total; TRACK.N=N; TRACK.ctrlS=cs.map(ci=>L[ci]/total);
})();
function trackPt(s){ const N=TRACK.N; return TRACK.pts[Math.floor((((s%1)+1)%1)*N)%N]; }
function trackAt(s,lat){ const p=trackPt(s); return {x:p.x+p.nx*lat,y:p.y+p.ny*lat,a:Math.atan2(p.dy,p.dx)}; }
// nearest centreline sample to (x,y); searches near `hint` when given, everywhere otherwise
function trackNearest(x,y,hint){
  const N=TRACK.N,pts=TRACK.pts; let best=0,bd=1e18;
  const scan=(i0,i1)=>{for(let k=i0;k<=i1;k++){const i=((k%N)+N)%N,p=pts[i],d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<bd){bd=d;best=i;}}};
  if(hint===undefined||hint<0)scan(0,N-1); else {scan(hint-40,hint+40); if(bd>300*300)scan(0,N-1);}
  return best;
}
function trackLat(x,y,i){ const p=TRACK.pts[i]; return (x-p.x)*p.nx+(y-p.y)*p.ny; }   // signed: right of travel = +
// keep a circle of radius r inside the track walls; returns the wall normal it hit (or null)
function trackContain(o,r,bounce){
  o.ti=trackNearest(o.x,o.y,o.ti);
  const tp=TRACK.pts[o.ti], lat=trackLat(o.x,o.y,o.ti), lim=WALL_OFF-r+2;
  if(Math.abs(lat)<=lim)return null;
  const sg=Math.sign(lat), over=Math.abs(lat)-lim, nx=tp.nx*sg, ny=tp.ny*sg;
  o.x-=nx*over; o.y-=ny*over;
  const vn=o.vx*nx+o.vy*ny;
  if(vn>0){o.vx-=vn*nx*bounce;o.vy-=vn*ny*bounce;}
  return {nx,ny,vn};
}
// scenery just outside the walls: (lap fraction, side) with side -1 = left of travel, +1 = right
const PROPS = [
  {s:0.02,side:-1,kind:"workbench",w:300,h:60}, {s:0.05,side:+1,kind:"tools",w:80,h:130}, {s:0.075,side:-1,kind:"tires",w:80,h:80},
  {s:0.12,side:-1,kind:"bed",w:240,h:200}, {s:0.16,side:+1,kind:"dresser",w:60,h:160}, {s:0.19,side:-1,kind:"tub",w:300,h:100},
  {s:0.31,side:-1,kind:"bbq",w:60,h:100}, {s:0.40,side:-1,kind:"patio",w:110,h:110},
  {s:0.52,side:-1,kind:"fridge",w:92,h:120}, {s:0.55,side:-1,kind:"counter",w:480,h:56}, {s:0.585,side:+1,kind:"island",w:300,h:130},
  {s:0.66,side:+1,kind:"couch",w:300,h:100}, {s:0.69,side:-1,kind:"tv",w:26,h:200}, {s:0.725,side:+1,kind:"table",w:170,h:80},
  {s:0.78,side:-1,kind:"shelf",w:260,h:42}, {s:0.86,side:+1,kind:"dresser",w:60,h:160}, {s:0.92,side:-1,kind:"chair",w:100,h:100},
];
const TREES = [ {x:2350,y:1350,r:42}, {x:1500,y:1350,r:40}, {x:700,y:600,r:44}, {x:2900,y:2050,r:38}, {x:200,y:2050,r:36}, {x:1700,y:1300,r:36} ];
const POOL = {x:2150,y:950,w:300,h:220};
const TRAMPOLINE = {x:2350,y:1600,r:100};
const PADS = [{s:0.14,lat:0},{s:0.46,lat:0},{s:0.62,lat:-40},{s:0.83,lat:30}].map(p=>{const t=trackAt(p.s,p.lat);return {x:t.x,y:t.y,ang:t.a,r:62};});
// ground-ball "item box" spots along the lap
const GB_SPOTS = [0.08,0.18,0.27,0.36,0.44,0.54,0.63,0.72,0.81,0.9].map((s,i)=>{const t=trackAt(s,[-55,0,55][i%3]);return [t.x,t.y];});
// starting grid, two by two just behind the line; index 0 is the human (back of the grid)
const SPAWNS = [0.966,0.974,0.982,0.990].map((s,i)=>trackAt(s,i%2?45:-45));

/* ---------------- AUDIO ---------------- */
let AC=null, engineNodes=null;
function audio(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(AC&&AC.state==="suspended")AC.resume(); return AC; }
function beep(f,d,type="square",vol=0.12,slide=0){
  const ac=audio(); if(!ac)return;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.setValueAtTime(f,ac.currentTime);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),ac.currentTime+d);
  g.gain.setValueAtTime(vol,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+d);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+d);
}
const SFX = {
  throw:()=>beep(300,0.12,"sawtooth",0.08,-160),
  catch:()=>beep(700,0.07,"square",0.10,300),
  hit:()=>{beep(140,0.18,"sawtooth",0.16,-80);beep(90,0.22,"square",0.12,-40);},
  scoop:()=>beep(520,0.06,"triangle",0.10,240),
  level:()=>{[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,0.10,"square",0.10),i*70));},
  boost:()=>beep(220,0.25,"sawtooth",0.09,500),
  bounce:()=>beep(180,0.14,"triangle",0.12,220),
  count:()=>beep(440,0.15,"square",0.12),
  go:()=>{beep(660,0.4,"square",0.14);beep(880,0.4,"square",0.10);},
  win:()=>{[392,523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>beep(f,0.16,"square",0.11),i*110));},
  ouch:()=>beep(200,0.25,"sawtooth",0.12,-150),
};
function ensureEngine(){
  const ac=audio(); if(!ac||engineNodes)return;
  const o=ac.createOscillator(), f=ac.createBiquadFilter(), g=ac.createGain();
  o.type="sawtooth"; o.frequency.value=60;
  f.type="lowpass"; f.frequency.value=420; f.Q.value=2;
  g.gain.value=0;
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start();
  engineNodes={o,g};
}
function engineTick(speed,on){
  if(!engineNodes)return;
  engineNodes.g.gain.value = on?0.035:0;
  engineNodes.o.frequency.value = 55 + speed*0.16;
}

/* ---------------- INPUT ---------------- */
const keys={};
const input={steer:0,throttle:null,drift:false,joyActive:false,gp:false,gpThrow:false,gpPause:false};
function pollGamepad(){
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  let gp=null; for(const p of pads){ if(p&&p.connected){gp=p;break;} }
  if(!gp){input.gp=false;return;}
  input.gp=true;
  const dz=v=>Math.abs(v)<0.12?0:(v-Math.sign(v)*0.12)/0.88;
  const ax0=dz(gp.axes[0]||0), ax1=dz(gp.axes[1]||0);
  const rt=(gp.buttons[7]&&gp.buttons[7].value)||0, lt=(gp.buttons[6]&&gp.buttons[6].value)||0;
  input.gpSteer=ax0;
  input.gpThrottle=(rt>0.02||lt>0.02)?(rt-0.6*lt):(Math.abs(ax1)>0?-ax1:null);
  input.gpDrift=!!((gp.buttons[1]&&gp.buttons[1].pressed)||(gp.buttons[4]&&gp.buttons[4].pressed));
  const thr=!!((gp.buttons[0]&&gp.buttons[0].pressed)||(gp.buttons[5]&&gp.buttons[5].pressed));
  input.gpThrowEdge=thr&&!input.gpThrow; input.gpThrow=thr;
  const pause=!!(gp.buttons[9]&&gp.buttons[9].pressed);
  if(pause&&!input.gpPause)togglePause(); input.gpPause=pause;
}
const TOUCH=(matchMedia&&matchMedia("(pointer: coarse)").matches)||("ontouchstart" in window)||navigator.maxTouchPoints>0;
const MOBILE=TOUCH&&Math.min(screen.width,screen.height)<=1024;   // phones + iPads: lighter render tier
if(TOUCH)document.body.classList.add("touch");
function updateOrientation(){
  document.body.classList.toggle("portrait",TOUCH&&innerHeight>innerWidth);
}
updateOrientation();
addEventListener("keydown",e=>{
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key))e.preventDefault();
  keys[e.key.toLowerCase()]=true;
  handleMenuKeys(e);
  if(game.phase==="race"||game.phase==="countdown"){
    if(e.key.toLowerCase()==="p"||e.key==="Escape") togglePause();
  }
});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
const raycaster=new THREE.Raycaster(), groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
addEventListener("touchstart",()=>{audio();ensureEngine();},{passive:true});
addEventListener("pointerdown",e=>{
  audio(); ensureEngine();
  if(game.phase==="race"&&!game.paused&&e.target.id==="game"){
    const p=game.cars[0]; if(!p||p.stun>0)return;
    const ndc=new THREE.Vector2((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
    raycaster.setFromCamera(ndc,camera);
    const hit=new THREE.Vector3();
    if(raycaster.ray.intersectPlane(groundPlane,hit)){
      tryThrow(p,Math.atan2(hit.z-p.y,hit.x-p.x));
    }
  }
});

/* ================================================================
   THREE.JS SETUP
   ================================================================ */
const FAST=/[?&]fast/.test(location.search);   // low-fx mode for weak hardware / CI
const HIFI=!FAST&&!MOBILE&&!!window.POST;       // desktop tier: post-processing (SSAO + bloom), 4K shadows
const canvas=document.getElementById("game");
const renderer=new THREE.WebGLRenderer({canvas,antialias:!FAST,powerPreference:"high-performance"});
renderer.setPixelRatio(FAST?0.6:Math.min(devicePixelRatio,MOBILE?1.5:(HIFI?1.5:2)));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=!FAST;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=0.92;
renderer.useLegacyLights=false;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9ec9ef);
scene.fog=new THREE.Fog(0x9ec9ef,1500,4600);

const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,2,7000);
camera.position.set(360,300,1900);
const camLook=new THREE.Vector3(1280,0,880);

const sun=new THREE.DirectionalLight(0xffedd2,3.8);
sun.castShadow=true;
const SHADOW_RES=MOBILE?1024:(HIFI?4096:2048);
sun.shadow.mapSize.set(SHADOW_RES,SHADOW_RES);
sun.shadow.camera.left=-750; sun.shadow.camera.right=750;
sun.shadow.camera.top=750; sun.shadow.camera.bottom=-750;
sun.shadow.camera.near=200; sun.shadow.camera.far=3200;
sun.shadow.bias=-0.0004; sun.shadow.normalBias=2.5;
scene.add(sun); scene.add(sun.target);
const hemi=new THREE.HemisphereLight(0xbdd8ff,0x6b7f62,0.38); scene.add(hemi);

// environment reflections: a tiny hand-built light box right away (so the menu previews have
// something to reflect), replaced by the Blender/Cycles-rendered sky HDRI once it decodes
const SUN_DIR=new THREE.Vector3(520,900,300).normalize();   // overwritten from the HDRI's sun disc
const SUN_DIST=1080;
let skyDome=null;
{
  const env=new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(200,200,200),
    new THREE.MeshBasicMaterial({color:0x6f7f93,side:THREE.BackSide})));
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshBasicMaterial({color:0xffffff}));
  sky.position.y=99; sky.rotation.x=Math.PI/2; env.add(sky);
  const warm=new THREE.Mesh(new THREE.PlaneGeometry(120,60),new THREE.MeshBasicMaterial({color:0xffe0b0}));
  warm.position.set(-99,20,0); warm.rotation.y=Math.PI/2; env.add(warm);
  const cool=new THREE.Mesh(new THREE.PlaneGeometry(120,60),new THREE.MeshBasicMaterial({color:0xa0c8ff}));
  cool.position.set(99,20,0); cool.rotation.y=-Math.PI/2; env.add(cool);
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(env,0.05).texture;
  pmrem.dispose();
}
function halfToFloat(h){
  const e=(h>>10)&0x1f, f=h&0x3ff, sg=(h&0x8000)?-1:1;
  if(e===0)return sg*Math.pow(2,-14)*(f/1024);
  if(e===31)return f?NaN:sg*Infinity;
  return sg*Math.pow(2,e-15)*(1+f/1024);
}
function applySkyHDR(tex){
  const {data,width,height}=tex.image;
  const n=width*height, isHalf=data instanceof Uint16Array;
  const f=isHalf?new Float32Array(n*4):data;
  if(isHalf)for(let i=0;i<n*4;i++)f[i]=halfToFloat(data[i]);
  // Cycles writes physical sky radiance; normalise so the robust mean of the sky (5th-95th
  // percentile, i.e. without the sun disc) sits at 0.32; the sun disc is clamped so image-based
  // lighting doesn't double-count the directional sun (it still reads as a hot spot for bloom)
  const lums=[];
  for(let y=0;y<height;y++){
    const up=tex.flipY?(y<height/2):(y>=height/2); if(!up)continue;
    for(let x=0;x<width;x++){const i=(y*width+x)*4;lums.push(0.2126*f[i]+0.7152*f[i+1]+0.0722*f[i+2]);}
  }
  lums.sort((a,b)=>a-b);
  const lo=lums[Math.floor(lums.length*0.05)], hi=lums[Math.floor(lums.length*0.95)];
  let sum=0,cnt=0; for(const l of lums){if(l>=lo&&l<=hi){sum+=l;cnt++;}}
  const scale=0.28/((sum/cnt)||1);
  for(let i=0;i<n*4;i++){ if((i&3)!==3)f[i]=Math.min(60,f[i]*scale); }
  if(isHalf){ for(let i=0;i<n*4;i++)data[i]=THREE.DataUtils.toHalfFloat(f[i]); }
  tex.needsUpdate=true;
  const px=(x,y,c)=>f[(y*width+x)*4+c];
  // sun = brightest texel; horizon colour = mean of the middle row (for fog)
  let best=-1,bx=0,by=0; const hr=[0,0,0]; const mid=height>>1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const r=px(x,y,0),g=px(x,y,1),b=px(x,y,2),l=r+g+b;
    if(l>best){best=l;bx=x;by=y;}
    if(y===mid){hr[0]+=r;hr[1]+=g;hr[2]+=b;}
  }
  const u=(bx+0.5)/width; let v=(by+0.5)/height; if(tex.flipY)v=1-v;
  let elev=(v-0.5)*Math.PI; if(elev<0){elev=-elev;}           // the sun is above the horizon by construction
  const phi=(u-0.5)*Math.PI*2;
  SUN_DIR.set(Math.cos(elev)*Math.cos(phi),Math.sin(elev),Math.cos(elev)*Math.sin(phi));
  const sc=new THREE.Color(px(bx,by,0),px(bx,by,1),px(bx,by,2));
  const mx=Math.max(sc.r,sc.g,sc.b)||1; sun.color.setRGB(sc.r/mx,sc.g/mx,sc.b/mx).lerp(new THREE.Color(1,1,1),0.35);
  const tm=x=>{x*=renderer.toneMappingExposure*0.9; x=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14); return Math.pow(clamp(x,0,1),1/2.2);};
  const fogC=new THREE.Color(tm(hr[0]/width),tm(hr[1]/width),tm(hr[2]/width));
  scene.fog.color.copy(fogC); scene.background=fogC;
  hemi.intensity=0.16;   // the sky HDRI now carries the ambient
  // image-based lighting
  const pmrem=new THREE.PMREMGenerator(renderer);
  const envTex=pmrem.fromEquirectangular(tex).texture; pmrem.dispose();
  scene.environment=envTex;
  if(pPrev){pPrev.s.environment=envTex;cPrev.s.environment=envTex;}
  // visible sky: a dome mesh (not scene.background) so the post-processing depth/normal passes stay clean
  const geo=new THREE.SphereGeometry(3300,48,24); geo.scale(-1,1,1);
  skyDome=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:tex,fog:false}));
  skyDome.rotation.y=Math.PI; skyDome.frustumCulled=false; skyDome.name="sky";
  scene.add(skyDome);
}
if(window.LAXFOO_TEX&&window.LAXFOO_TEX.sky&&window.RGBELoader&&!FAST){
  new RGBELoader().load(window.LAXFOO_TEX.sky,tex=>{
    try{applySkyHDR(tex);}catch(e){console.warn("sky HDR failed:",e);}
  },undefined,e=>console.warn("sky HDR load error:",e));
}

// post-processing (desktop): SSAO -> bloom -> filmic tone map + sRGB output. The scene is rendered
// into half-float buffers so highlights survive until the tone-mapping pass.
let composer=null;
function makeComposer(){
  const pr=renderer.getPixelRatio();
  const rt=new THREE.WebGLRenderTarget(innerWidth*pr,innerHeight*pr,{type:THREE.HalfFloatType});
  const cp=new POST.EffectComposer(renderer,rt);
  const ssao=new POST.SSAOPass(scene,camera,innerWidth,innerHeight);
  ssao.kernelRadius=18; ssao.minDistance=0.0004; ssao.maxDistance=0.03;
  ssao.beautyRenderTarget.texture.type=THREE.HalfFloatType;
  // keep the sky dome out of the depth/normal passes so AO never touches the sky
  const ro=ssao.renderOverride.bind(ssao);
  ssao.renderOverride=function(...a){ if(skyDome)skyDome.visible=false; ro(...a); if(skyDome)skyDome.visible=true; };
  cp.addPass(ssao);
  cp.addPass(new POST.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.18,0.4,0.92));
  cp.addPass(new POST.ShaderPass({
    uniforms:{tDiffuse:{value:null}},
    vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor=texture2D(tDiffuse,vUv);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}",
  }));
  return cp;
}
if(HIFI){ try{composer=makeComposer();}catch(e){console.warn("post-processing unavailable:",e);composer=null;} }

function onResize(){
  renderer.setSize(innerWidth,innerHeight);
  if(composer)composer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  updateOrientation();
}
addEventListener("resize",onResize);
addEventListener("orientationchange",()=>{setTimeout(onResize,250);});
if(window.visualViewport)visualViewport.addEventListener("resize",onResize);

/* ---------------- PROCEDURAL TEXTURES ---------------- */
function canvasTex(size,draw){
  const cv=document.createElement("canvas");cv.width=cv.height=size;
  const c=cv.getContext("2d"); draw(c,size);
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return t;
}
function noise(c,s,n,col,a0,a1){
  for(let i=0;i<n;i++){c.fillStyle=col;c.globalAlpha=rnd(a0,a1);
    c.fillRect(Math.random()*s,Math.random()*s,rnd(1,3),rnd(1,3));}
  c.globalAlpha=1;
}
const TEX={
  wood:canvasTex(256,(c,s)=>{
    c.fillStyle="#a97a4c";c.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=32){
      c.fillStyle=`hsl(${rnd(26,32)},${rnd(38,48)}%,${rnd(44,54)}%)`;
      c.fillRect(0,y,s,32);
      c.fillStyle="rgba(60,35,15,.55)";c.fillRect(0,y,s,2);
      c.fillStyle="rgba(60,35,15,.5)";c.fillRect(rnd(0,s),y+2,2,30);
      for(let g=0;g<6;g++){c.strokeStyle=`rgba(80,50,25,${rnd(.08,.2)})`;c.lineWidth=1;
        c.beginPath();const yy=y+rnd(4,28);c.moveTo(0,yy);
        for(let x=0;x<=s;x+=32)c.lineTo(x,yy+rnd(-2,2));c.stroke();}
    }
  }),
  tile:canvasTex(256,(c,s)=>{
    for(let y=0;y<2;y++)for(let x=0;x<2;x++){
      c.fillStyle=(x+y)%2?"#d9d0be":"#e9e2d3";c.fillRect(x*128,y*128,128,128);}
    c.strokeStyle="#a29882";c.lineWidth=4;
    for(let i=0;i<=2;i++){c.beginPath();c.moveTo(i*128,0);c.lineTo(i*128,s);c.stroke();
      c.beginPath();c.moveTo(0,i*128);c.lineTo(s,i*128);c.stroke();}
    noise(c,s,300,"#00000022",0.05,0.15);
  }),
  bathTile:canvasTex(256,(c,s)=>{
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){
      c.fillStyle=(x+y)%2?"#cfe3e8":"#e2eff2";c.fillRect(x*64,y*64,64,64);}
    c.strokeStyle="#9fb6bc";c.lineWidth=2;
    for(let i=0;i<=4;i++){c.beginPath();c.moveTo(i*64,0);c.lineTo(i*64,s);c.stroke();
      c.beginPath();c.moveTo(0,i*64);c.lineTo(s,i*64);c.stroke();}
  }),
  grass:canvasTex(256,(c,s)=>{
    c.fillStyle="#4d8040";c.fillRect(0,0,s,s);
    for(let i=0;i<2600;i++){
      c.fillStyle=`hsl(${rnd(90,130)},${rnd(30,52)}%,${rnd(26,44)}%)`;
      c.fillRect(Math.random()*s,Math.random()*s,2,rnd(2,5));}
  }),
  concrete:canvasTex(256,(c,s)=>{
    c.fillStyle="#9aa0a4";c.fillRect(0,0,s,s);
    noise(c,s,2200,"#ffffff",0.03,0.09);noise(c,s,2200,"#000000",0.03,0.10);
    c.strokeStyle="rgba(60,60,60,.25)";c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,128);c.lineTo(s,128);c.stroke();
    c.beginPath();c.moveTo(128,0);c.lineTo(128,s);c.stroke();
  }),
  carpet:canvasTex(256,(c,s)=>{
    c.fillStyle="#b7a7cf";c.fillRect(0,0,s,s);
    noise(c,s,3600,"#ffffff",0.03,0.08);noise(c,s,3200,"#5d4a78",0.04,0.10);
  }),
  stone:canvasTex(256,(c,s)=>{
    c.fillStyle="#a89a88";c.fillRect(0,0,s,s);
    for(let y=0;y<2;y++)for(let x=0;x<2;x++){
      c.fillStyle=`hsl(${rnd(28,40)},${rnd(10,18)}%,${rnd(58,68)}%)`;
      c.fillRect(x*128+3,y*128+3,122,122);}
    noise(c,s,1200,"#00000033",0.05,0.12);
  }),
  water:canvasTex(256,(c,s)=>{
    c.fillStyle="#2f9fd8";c.fillRect(0,0,s,s);
    for(let i=0;i<26;i++){
      c.strokeStyle=`rgba(220,245,255,${rnd(.15,.4)})`;c.lineWidth=rnd(1.5,3.5);
      c.beginPath();
      const x=rnd(0,s),y=rnd(0,s),r=rnd(8,30);
      c.arc(x,y,r,rnd(0,TAU),rnd(0,TAU));c.stroke();}
  }),
  drywall:canvasTex(128,(c,s)=>{
    c.fillStyle="#ece6d8";c.fillRect(0,0,s,s);
    noise(c,s,500,"#00000011",0.04,0.09);
    c.fillStyle="#d8d0bd";c.fillRect(0,s-26,s,26);        // wainscot band
    c.fillStyle="#b8ad94";c.fillRect(0,s-26,s,3);
    c.fillStyle="#8a7c60";c.fillRect(0,s-7,s,7);          // baseboard
  }),
  fenceTex:canvasTex(128,(c,s)=>{
    c.fillStyle="#8c7150";c.fillRect(0,0,s,s);
    for(let x=0;x<s;x+=22){
      c.fillStyle=`hsl(28,${rnd(24,32)}%,${rnd(38,48)}%)`;
      c.fillRect(x,0,20,s);
      c.fillStyle="rgba(40,25,10,.5)";c.fillRect(x+20,0,2,s);
    }
    noise(c,s,700,"#00000022",0.05,0.12);
  }),
  rug:canvasTex(512,(c,s)=>{
    c.fillStyle="#7b3f22";c.fillRect(0,0,s,s);
    c.fillStyle="#a0522d";c.fillRect(30,30,s-60,s-60);
    c.fillStyle="#7b3f22";c.fillRect(60,60,s-120,s-120);
    c.fillStyle="#c17b4a";c.fillRect(72,72,s-144,s-144);
    c.save();c.translate(s/2,s/2);c.rotate(Math.PI/4);
    c.fillStyle="#7b3f22";c.fillRect(-70,-70,140,140);
    c.fillStyle="#e0b089";c.fillRect(-40,-40,80,80);c.restore();
    noise(c,s,3000,"#00000022",0.04,0.1);
  }),
  arrow:canvasTex(128,(c,s)=>{
    c.clearRect(0,0,s,s);
    c.fillStyle="#ffe082";
    for(let i=0;i<2;i++){
      c.beginPath();
      c.moveTo(20,20+i*10-6); c.lineTo(64,52+i*10); c.lineTo(108,20+i*10-6);
      c.lineTo(108,38+i*10-6); c.lineTo(64,70+i*10); c.lineTo(20,38+i*10-6);
      c.closePath();c.fill();
    }
  }),
  net:canvasTex(128,(c,s)=>{
    c.clearRect(0,0,s,s);
    c.strokeStyle="rgba(245,245,240,.95)";c.lineWidth=3;
    for(let i=-4;i<9;i++){
      c.beginPath();c.moveTo(i*24,0);c.lineTo(i*24+64,s);c.stroke();
      c.beginPath();c.moveTo(i*24,0);c.lineTo(i*24-64,s);c.stroke();
    }
  }),
};
TEX.checker=canvasTex(64,(c,s)=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){c.fillStyle=(x+y)%2?"#141414":"#f4f4f4";c.fillRect(x*8,y*8,8,8);}});
TEX.arrow.colorSpace=THREE.SRGBColorSpace;

/* ---------------- BAKED PBR TEXTURE SETS (Blender/Cycles, see tools/blender_textures.py) ---------------- */
const TSET={};
const PENDING_CLONES=new Map();   // source texture uuid -> repeat-clones waiting for its image
(function loadTextureSets(){
  if(!window.LAXFOO_TEX||!window.LAXFOO_TEX.sets)return;
  const tl=new THREE.TextureLoader();
  const aniso=renderer.capabilities.getMaxAnisotropy();
  for(const [name,src] of Object.entries(window.LAXFOO_TEX.sets)){
    const set={};
    for(const k of ["albedo","normal","rough"]){
      if(!src[k])continue;
      const t=tl.load(src[k],tex=>{
        for(const c of PENDING_CLONES.get(tex.uuid)||[])c.needsUpdate=true;
        PENDING_CLONES.delete(tex.uuid);
      });
      t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=aniso;
      t.colorSpace=k==="albedo"?THREE.SRGBColorSpace:THREE.NoColorSpace;
      set[k]=t;
    }
    TSET[name]=set;
  }
})();
// a repeat-scaled copy of a set texture (shares the decoded image; uploads once it has arrived)
function texRepeat(t,rx,ry){
  const c=t.clone(); c.repeat.set(rx,ry);
  if(!t.image){
    c.version=0;
    if(!PENDING_CLONES.has(t.uuid))PENDING_CLONES.set(t.uuid,[]);
    PENDING_CLONES.get(t.uuid).push(c);
  }
  return c;
}
// MeshStandardMaterial from a baked set: albedo * color, tangent normal map, roughness map.
// Falls back to the procedural canvas texture (or flat colour) when the set is missing.
function pbr(name,rx,ry,o={},fallbackMap=null){
  const set=TSET[name];
  const ns=o.normalScale??1, mo=Object.assign({roughness:1,metalness:0},o); delete mo.normalScale;
  if(!set){
    if(fallbackMap){mo.map=fallbackMap.clone();mo.map.needsUpdate=true;mo.map.repeat.set(rx,ry);}
    if(mo.roughness===1)mo.roughness=.9;
    return new THREE.MeshStandardMaterial(mo);
  }
  if(set.albedo)mo.map=texRepeat(set.albedo,rx,ry);
  if(set.normal){mo.normalMap=texRepeat(set.normal,rx,ry);mo.normalScale=new THREE.Vector2(ns,ns);}
  if(set.rough)mo.roughnessMap=texRepeat(set.rough,rx,ry);
  return new THREE.MeshStandardMaterial(mo);
}
// dress an existing (glTF) material with a detail set, keeping its colour / metalness / clearcoat
function detail(m,name,rep,ns=0.6,withRough=true){
  const set=TSET[name]; if(!set)return;
  if(set.normal){m.normalMap=texRepeat(set.normal,rep,rep);m.normalScale=new THREE.Vector2(ns,ns);}
  if(withRough&&set.rough)m.roughnessMap=texRepeat(set.rough,rep,rep);
  m.needsUpdate=true;
}

/* ---------------- MATERIAL HELPERS ---------------- */
const MAT={
  paint:c=>new THREE.MeshStandardMaterial({color:c,metalness:.5,roughness:.32}),
  matte:c=>new THREE.MeshStandardMaterial({color:c,metalness:.05,roughness:.9}),
  metal:c=>new THREE.MeshStandardMaterial({color:c,metalness:.85,roughness:.3}),
  glass:()=>new THREE.MeshStandardMaterial({color:0x1c2b3a,metalness:.9,roughness:.08,transparent:true,opacity:.6}),
  tire:new THREE.MeshStandardMaterial({color:0x16181c,roughness:.95}),
  rim:new THREE.MeshStandardMaterial({color:0xc2c9d1,metalness:.85,roughness:.28}),
  chrome:new THREE.MeshStandardMaterial({color:0xdfe4e8,metalness:.95,roughness:.15}),
  emis:(c,i)=>new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:i??1.4,roughness:.5}),
};
function box(w,h,d,mat,x,y,z,cast=true){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;return m;
}
function cyl(rt,rb,h,mat,x,y,z,seg=18){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;
}
function sph(r,mat,x,y,z,seg=18){
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg,seg),mat);
  m.position.set(x,y,z);m.castShadow=true;return m;
}

/* ================================================================
   WORLD BUILD
   ================================================================ */
const worldGroup=new THREE.Group(); scene.add(worldGroup);
function floorPlane(x,y,w,h,set,fallback,texScale,yLift=0,col=0xffffff,ns=1){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    pbr(set,w/texScale,h/texScale,{color:col,normalScale:ns},fallback));
  m.rotation.x=-Math.PI/2;
  m.position.set(x+w/2,yLift,y+h/2);
  m.receiveShadow=true;
  worldGroup.add(m);
  return m;
}
// a strip along the track between lateral offsets latA..latB (right = +), from sample i0 to i1 (inclusive)
function trackStrip(i0,i1,latA,latB,y,tile,colorFn){
  const N=TRACK.N, count=(((i1-i0)%N)+N)%N||N, pos=[],uv=[],col=[],idx=[];
  for(let k=0;k<=count;k++){
    const p=TRACK.pts[(i0+k)%N], arc=k*TRACK.len/N, u=arc/tile;
    pos.push(p.x+p.nx*latA,y,p.y+p.ny*latA, p.x+p.nx*latB,y,p.y+p.ny*latB);
    uv.push(u,latA/tile, u,latB/tile);
    if(colorFn){const c=colorFn(arc);col.push(c.r,c.g,c.b,c.r,c.g,c.b);}
    if(k<count){const b=k*2;idx.push(b,b+1,b+2, b+1,b+3,b+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  if(colorFn)g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setIndex(idx); g.computeVertexNormals();
  if(g.attributes.normal.getY(0)<0){ const ix=g.index.array; for(let k=0;k<ix.length;k+=3){const t=ix[k+1];ix[k+1]=ix[k+2];ix[k+2]=t;} g.computeVertexNormals(); }
  return g;
}
// a wall ribbon standing at lateral offset `lat`, `thick` units deep outward, `h` tall
function trackWall(i0,i1,lat,thick,h,tile){
  const N=TRACK.N, count=(((i1-i0)%N)+N)%N||N, sg=Math.sign(lat), pos=[],uv=[];
  const quad=(a,b,c,d,u0,u1,v1)=>{pos.push(...a,...b,...c, ...a,...c,...d); uv.push(u0,0,u1,0,u1,v1, u0,0,u1,v1,u0,v1);};
  for(let k=0;k<count;k++){
    const p=TRACK.pts[(i0+k)%N],q=TRACK.pts[(i0+k+1)%N], u0=k*TRACK.len/N/tile, u1=(k+1)*TRACK.len/N/tile;
    const pi=[p.x+p.nx*lat,0,p.y+p.ny*lat], qi=[q.x+q.nx*lat,0,q.y+q.ny*lat];
    const po=[p.x+p.nx*(lat+sg*thick),0,p.y+p.ny*(lat+sg*thick)], qo=[q.x+q.nx*(lat+sg*thick),0,q.y+q.ny*(lat+sg*thick)];
    const up=v=>[v[0],h,v[2]];
    quad(pi,qi,up(qi),up(pi),u0,u1,h/tile);          // face toward the road
    quad(up(pi),up(qi),up(qo),up(po),u0,u1,thick/tile); // top
    quad(po,qo,up(qo),up(po),u0,u1,h/tile);          // outer face
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  return g;
}
function buildTrack(){
  const N=TRACK.N, idx=v=>Math.floor(v*N)%N;
  const curbMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65});
  const red=new THREE.Color(0xc62828), white=new THREE.Color(0xf5f5f5);
  const curbCol=arc=>Math.floor(arc/60)%2?red:white;
  for(const z of ZONES){
    const i0=idx(TRACK.ctrlS[z.from]), i1=z.to>=TRACK_CTRL.length?N:idx(TRACK.ctrlS[z.to]);
    const road=new THREE.Mesh(trackStrip(i0,i1,-TRACK_W/2,TRACK_W/2,0.4,z.tile),pbr(z.set,1,1,{color:z.col},TEX[z.set]));
    road.receiveShadow=true; worldGroup.add(road);
    const shCol=new THREE.Color(z.col).multiplyScalar(0.72).getHex();
    for(const sg of [-1,1]){
      const sh=new THREE.Mesh(trackStrip(i0,i1,sg*(TRACK_W/2+14),sg*WALL_OFF,0.3,z.tile),pbr(z.set,1,1,{color:shCol},TEX[z.set]));
      sh.receiveShadow=true; worldGroup.add(sh);
      const curb=new THREE.Mesh(trackStrip(i0,i1,sg*TRACK_W/2,sg*(TRACK_W/2+14),0.9,60,curbCol),curbMat);
      curb.receiveShadow=true; worldGroup.add(curb);
      const wallMat=z.wall==="fence"
        ?pbr("fence",1,1,{color:0xffffff,normalScale:.8,side:THREE.DoubleSide},TEX.fenceTex)
        :pbr("drywall",1,1,{color:0xe9e4d8,normalScale:.5,side:THREE.DoubleSide},TEX.drywall);
      const wall=new THREE.Mesh(trackWall(i0,i1,sg*WALL_OFF,22,z.wall==="fence"?FENCE_H:WALL_H,110),wallMat);
      wall.castShadow=true; wall.receiveShadow=true; worldGroup.add(wall);
    }
  }
  // start / finish line
  const line=new THREE.Mesh(trackStrip(N-1,2,-TRACK_W/2,TRACK_W/2,1.3,22),new THREE.MeshStandardMaterial({map:TEX.checker,roughness:.7}));
  line.receiveShadow=true; worldGroup.add(line);
}
function buildProp(f){
  const p=trackPt(f.s), a=Math.atan2(p.dy,p.dx);
  const g=buildFurniture({x:-f.w/2,y:-f.h/2,w:f.w,h:f.h,kind:f.kind});
  const off=WALL_OFF+22+14+f.h/2;
  g.position.set(p.x+p.nx*f.side*off,0,p.y+p.ny*f.side*off);
  g.rotation.y=-a+(f.side>0?Math.PI:0);
  return g;
}
function buildWorld(){
  floorPlane(0,0,WORLD.w,WORLD.h,"grass",TEX.grass,150,-0.6,0xa6c874,0.8);   // the lot
  const fenceTop=MAT.matte(0x74593c);
  for(const w of WALLS){
    const sideX=pbr("fence",Math.max(1,Math.round(w.h/110)),1,{color:0xffffff,normalScale:.8},TEX.fenceTex);
    const sideZ=pbr("fence",Math.max(1,Math.round(w.w/110)),1,{color:0xffffff,normalScale:.8},TEX.fenceTex);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w.w,FENCE_H,w.h),[sideX,sideX,fenceTop,fenceTop,sideZ,sideZ]);
    m.position.set(w.x+w.w/2,FENCE_H/2,w.y+w.h/2); m.castShadow=true;m.receiveShadow=true; worldGroup.add(m);
  }
  buildTrack();
  for(const f of PROPS)worldGroup.add(buildProp(f));
  for(const t of TREES)worldGroup.add(buildTree(t));
  buildPool(); buildTrampoline(); buildPads();
}
function buildFurniture(f){
  const g=new THREE.Group();
  g.position.set(f.x+f.w/2,0,f.y+f.h/2);
  const w=f.w,d=f.h;
  const add=m=>{g.add(m);return m;};
  switch(f.kind){
    case "couch":{
      const c=MAT.matte(0x7a5236), cu=MAT.matte(0x94684a);
      add(box(w,14,d,c,0,7,0));
      add(box(w,16,10,c,0,18,-d/2+5));                      // back
      add(box(10,10,d,c,-w/2+5,17,0)); add(box(10,10,d,c,w/2-5,17,0)); // arms
      for(let i=0;i<3;i++)add(box(w/3-8,6,d-22,cu,-w/3+i*w/3,16.5,4));
      break;}
    case "chair":{
      const c=MAT.matte(0x7a5236);
      add(box(w,13,d,c,0,6.5,0));
      add(box(w,15,9,c,0,16,-d/2+4.5));
      add(box(8,9,d,c,-w/2+4,15,0));add(box(8,9,d,c,w/2-4,15,0));
      break;}
    case "table": case "patio":{
      const top=MAT.matte(f.kind==="patio"?0x8d6e63:0x8a5f3c);
      add(box(w,4,d,top,0,22,0));
      const leg=MAT.matte(0x5e422b);
      add(box(5,22,5,leg,-w/2+6,11,-d/2+6));add(box(5,22,5,leg,w/2-6,11,-d/2+6));
      add(box(5,22,5,leg,-w/2+6,11,d/2-6));add(box(5,22,5,leg,w/2-6,11,d/2-6));
      break;}
    case "tv":{
      add(box(w,34,d,MAT.matte(0x0c0f13),0,20,0));
      add(new THREE.Mesh(new THREE.PlaneGeometry(d*0.86,24),
        MAT.emis(0x3d5a80,0.8))).position.set(w/2+0.5,22,0);
      g.children[1].rotation.y=Math.PI/2;
      break;}
    case "shelf":{
      const c=MAT.matte(0x6d4c41);
      add(box(w,36,d,c,0,18,0));
      for(let i=0;i<7;i++){const bh=rnd(8,13);
        add(box(8,bh,d-10,MAT.matte(["#a33","#375","#557","#973","#345"][i%5]),-w/2+18+i*(w-30)/7,36+bh/2,0));}
      break;}
    case "counter":{
      add(box(w,26,d,MAT.matte(0x8b9aa5),0,13,0));
      add(box(w+4,3,d+4,MAT.matte(0x4a3a2c),0,27.5,0));
      break;}
    case "island":{
      add(box(w,25,d,MAT.matte(0x90a4ae),0,12.5,0));
      add(box(w+6,4,d+6,MAT.matte(0x5d4a36),0,27,0));
      break;}
    case "fridge":{
      add(box(w,56,d,MAT.metal(0xcfd6da),0,28,0));
      add(box(2,20,3,MAT.metal(0x9aa2a8),-w/2-1,34,d/4));
      break;}
    case "workbench":{
      add(box(w,24,d,MAT.matte(0x5d4037),0,12,0));
      add(box(w,3,d,MAT.matte(0x8a6a4a),0,25.5,0));
      break;}
    case "tools":{
      add(box(w,30,d,MAT.paint("#b71c1c"),0,15,0));
      for(let i=0;i<3;i++)add(box(w-6,2,3,MAT.metal(0x999999),0,7+i*8,d/2-1));
      break;}
    case "tires":{
      for(let i=0;i<3;i++){
        const t=new THREE.Mesh(new THREE.TorusGeometry(w/2-8,8,10,20),MAT.tire);
        t.rotation.x=Math.PI/2;t.position.y=8+i*13;t.castShadow=true;add(t);}
      break;}
    case "bed":{
      add(box(w,10,d,MAT.matte(0x5a4632),0,5,0));
      add(box(w-8,8,d-8,MAT.matte(0xf1ece2),0,13,0));            // mattress
      add(box(w-8,5,d*0.62,MAT.matte(0x7986cb),0,17,d*0.16));    // duvet
      add(box(w,22,6,MAT.matte(0x5a4632),0,11,-d/2+3));          // headboard
      add(box(w/3,6,14,MAT.matte(0xffffff),-w/5,17.5,-d/2+16));
      add(box(w/3,6,14,MAT.matte(0xffffff),w/5,17.5,-d/2+16));
      break;}
    case "dresser":{
      add(box(w,32,d,MAT.matte(0x6d4c41),0,16,0));
      for(let i=0;i<3;i++)add(box(w+1,1.6,d-8,MAT.matte(0x8a6a52),0,7+i*9,0));
      break;}
    case "tub":{
      add(box(w,20,d,MAT.matte(0xf2f2ee),0,10,0));
      add(box(w-16,4,d-16,MAT.matte(0xbfe0ea),0,18.5,0));
      break;}
    case "toilet":{
      add(box(w,14,d,MAT.matte(0xf5f5f2),0,7,0));
      add(box(w,18,8,MAT.matte(0xf5f5f2),0,16,-d/2+4));
      break;}
    case "sink":{
      add(box(w,26,d,MAT.matte(0xd8cfc2),0,13,0));
      add(box(w-10,3,d-10,MAT.matte(0xffffff),0,27,0));
      break;}
    case "bbq":{
      add(cyl(w/2,w/2,16,MAT.metal(0x37474f),0,26,0));
      const lid=new THREE.Mesh(new THREE.SphereGeometry(w/2,16,10,0,TAU,0,Math.PI/2),MAT.metal(0x2b373e));
      lid.position.y=34;lid.castShadow=true;add(lid);
      add(box(3,26,3,MAT.metal(0x222222),-w/3,13,0));add(box(3,26,3,MAT.metal(0x222222),w/3,13,0));
      break;}
  }
  return g;
}
function buildTree(t){
  const g=new THREE.Group(); g.position.set(t.x,0,t.y);
  g.add(cyl(7,9,52,MAT.matte(0x6a4a2e),0,26,0,10));
  const f1=MAT.matte(0x2e5d2e),f2=MAT.matte(0x3a6f38);
  g.add(sph(t.r*0.95,f1,0,66,0,14));
  g.add(sph(t.r*0.7,f2,t.r*0.4,84,t.r*0.2,12));
  g.add(sph(t.r*0.6,f2,-t.r*0.4,80,-t.r*0.25,12));
  return g;
}
let waterMesh=null;
function buildPool(){
  const {x,y,w,h}=POOL;
  // basin walls + coping
  const wallM=MAT.matte(0xcfe8f2);
  worldGroup.add(box(w+16,6,8,MAT.matte(0xd9cfc0),x+w/2,2.4,y-4,false));
  worldGroup.add(box(w+16,6,8,MAT.matte(0xd9cfc0),x+w/2,2.4,y+h+4,false));
  worldGroup.add(box(8,6,h+16,MAT.matte(0xd9cfc0),x-4,2.4,y+h/2,false));
  worldGroup.add(box(8,6,h+16,MAT.matte(0xd9cfc0),x+w+4,2.4,y+h/2,false));
  worldGroup.add(box(w,14,4,wallM,x+w/2,-7,y+2,false));
  worldGroup.add(box(w,14,4,wallM,x+w/2,-7,y+h-2,false));
  worldGroup.add(box(4,14,h,wallM,x+2,-7,y+h/2,false));
  worldGroup.add(box(4,14,h,wallM,x+w-2,-7,y+h/2,false));
  const t=TEX.water; t.repeat.set(3,2.4);
  waterMesh=new THREE.Mesh(new THREE.PlaneGeometry(w-4,h-4),
    new THREE.MeshStandardMaterial({map:t,color:0x6fb4e6,roughness:.06,metalness:.25,
      transparent:true,opacity:.86}));
  waterMesh.rotation.x=-Math.PI/2;
  waterMesh.position.set(x+w/2,-6,y+h/2);
  worldGroup.add(waterMesh);
}
function buildTrampoline(){
  const g=new THREE.Group(); g.position.set(TRAMPOLINE.x,0,TRAMPOLINE.y);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(TRAMPOLINE.r,7,12,36),MAT.paint("#26a69a"));
  ring.rotation.x=Math.PI/2; ring.position.y=16; ring.castShadow=true; g.add(ring);
  const mat=new THREE.Mesh(new THREE.CircleGeometry(TRAMPOLINE.r-6,36),
    new THREE.MeshStandardMaterial({color:0x1d2429,roughness:.85}));
  mat.rotation.x=-Math.PI/2; mat.position.y=14; g.add(mat);
  for(let i=0;i<6;i++){
    const a=i/6*TAU;
    g.add(cyl(2.5,2.5,16,MAT.metal(0x555e66),Math.cos(a)*(TRAMPOLINE.r-4),8,Math.sin(a)*(TRAMPOLINE.r-4),8));
  }
  worldGroup.add(g);
}
const padMeshes=[];
function buildPads(){
  for(const p of PADS){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(p.r*1.8,p.r*1.8),
      new THREE.MeshStandardMaterial({map:TEX.arrow,transparent:true,
        emissive:0xffa000,emissiveMap:TEX.arrow,emissiveIntensity:1.4,
        color:0xffc966,roughness:.6}));
    m.rotation.x=-Math.PI/2; m.rotation.z=-p.ang-Math.PI/2;
    m.position.set(p.x,1.6,p.y);
    worldGroup.add(m); padMeshes.push(m);
    const base=new THREE.Mesh(new THREE.CircleGeometry(p.r,28),
      new THREE.MeshStandardMaterial({color:0x2b2f36,roughness:.9}));
    base.rotation.x=-Math.PI/2; base.position.set(p.x,1.1,p.y);
    base.receiveShadow=true; worldGroup.add(base);
  }
}
buildWorld();

/* ================================================================
   VEHICLES — CC0 glTF models (Kenney Car Kit) with procedural
   accessories; fully procedural builds as fallback / for the
   one-of-a-kind open-tops.
   ================================================================ */
const ASSET_TEMPLATES={};
const PROP_TEMPLATES={};          // driverSeated / driverStanding / stick (kept in meters)
const UNITS_PER_M=11.3;           // world units per meter for metric assets
const WHEEL_TAGS=["frontLeft","frontRight","backLeft","backRight"];
// detail texture per glTF material name (models are UV box-mapped at 1 tile / metre in Blender)
const DETAIL=[
  [/^carTire/,"rubber",5,0.7],[/^rubberTrim/,"rubber",6,0.4],[/^seatCloth/,"leather",3,0.6],
  [/^canvas/,"canvas",4,0.7],[/^rim/,"alloy",2,0.35,false],[/^(paint|roof)/,"paintFlake",3,0.12,false],
  [/^jersey|^shorts|^stripe/,"fabric",7,0.5],[/^skin/,"skin",4,0.35],[/^(gloves|pads)/,"leather",5,0.6],
  [/^helmet/,"paintFlake",4,0.1,false],[/^pocket/,"leather",6,0.4],[/^net/,"fabric",10,0.4],
];
function detailMaterials(root){
  const seen=new Set();
  root.traverse(o=>{
    if(!o.isMesh||!o.material||seen.has(o.material.uuid))return;
    seen.add(o.material.uuid);
    const n=o.material.name||"";
    for(const [re,set,rep,ns,rough] of DETAIL){ if(re.test(n)){detail(o.material,set,rep,ns,rough!==false);break;} }
  });
}
function normalizeProp(scene){
  scene.traverse(o=>{ if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
  detailMaterials(scene);
  return scene;
}
// clone an asset and give it private, recolored materials for the names in `tints`
function tintClone(template,tints){
  const c=template.clone(true);
  c.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    for(const [re,color] of tints){
      if(re.test(o.material.name||"")){
        o.material=o.material.clone(); o.material.color.set(color); break;
      }
    }
  });
  return c;
}
function driverTints(p){ return [[/^jersey/,p.jersey],[/^helmet/,p.color],[/^skin/,p.skin]]; }
function normalizeVehicleModel(model){
  model.updateMatrixWorld(true);
  // re-center wheel pivots (some kit meshes are baked at the model origin)
  const seenGeo=new Set();
  for(const tag of WHEEL_TAGS){
    let node=null;
    const re=new RegExp("^wheel_"+tag);   // loader strips dots: wheel_backLeft.009 -> wheel_backLeft009
    model.traverse(o=>{if(!node&&re.test(o.name)&&(o.parent===model||o.parent.type==="Scene"||o.parent===model.parent))node=o;});
    if(!node)continue;
    const box=new THREE.Box3().setFromObject(node);
    if(box.isEmpty())continue;
    const worldC=box.getCenter(new THREE.Vector3());
    const localC=node.worldToLocal(worldC.clone());
    node.traverse(m=>{
      if(m.isMesh){
        if(seenGeo.has(m.geometry.uuid))m.geometry=m.geometry.clone();
        seenGeo.add(m.geometry.uuid);
        m.geometry.translate(-localC.x,-localC.y,-localC.z);
        m.geometry.computeBoundingSphere();
        m.geometry.computeBoundingBox();
      }
    });
    const shift=localC.clone().applyQuaternion(node.quaternion).multiply(node.scale);
    node.position.add(shift);
    node.rotation.order="YXZ";
    // the kit hubcaps share the dark plastic material — swap them to bright alloy
    node.traverse(m=>{
      if(m.isMesh&&/^_defaultMat/.test(m.material.name||""))m.material=MAT.rim;
    });
  }
  // kit vehicles face -Z; rotate to face +X, verified via the headlight material
  model.rotation.y=-Math.PI/2;
  const wrap=new THREE.Group();
  wrap.add(model);
  wrap.updateMatrixWorld(true);
  let lightBox=null;
  model.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true;o.receiveShadow=true;
      if(o.material&&/^lightFront/.test(o.material.name||"")){
        lightBox=lightBox||new THREE.Box3();
        lightBox.expandByObject(o);
      }
    }
  });
  if(lightBox&&lightBox.getCenter(new THREE.Vector3()).x<0){
    model.rotation.y+=Math.PI;
    wrap.updateMatrixWorld(true);
  }
  // scale: metric models (built in Blender, meters) use a fixed units-per-meter so a
  // Willys really is shorter than a Range Rover; anything else is normalized to length 52
  let bb=new THREE.Box3().setFromObject(wrap);
  const rawLen=bb.max.x-bb.min.x;
  const metric=rawLen<8;
  const s=metric?UNITS_PER_M:52/rawLen;
  model.scale.setScalar(s);
  model.position.set(0,0,0);
  wrap.updateMatrixWorld(true);
  bb=new THREE.Box3().setFromObject(wrap);
  const c=bb.getCenter(new THREE.Vector3());
  model.position.set(-c.x,-bb.min.y,-c.z);
  wrap.updateMatrixWorld(true);
  bb=new THREE.Box3().setFromObject(wrap);
  wrap.userData.dims={h:bb.max.y,w:bb.max.z-bb.min.z};
  wrap.userData.metric=metric;
  const seat=model.getObjectByName("seat"), mount=model.getObjectByName("stickMount");
  wrap.userData.seat=seat?seat.position.clone():null;
  wrap.userData.stickMount=mount?mount.position.clone():null;
  if(seat)seat.visible=false; if(mount)mount.visible=false;
  wrap.userData.model=model;
  // shared material prep (paint is cloned per instance later)
  model.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const n=o.material.name||"";
    if(/^window/.test(n)){
      o.material.transparent=true;o.material.opacity=0.5;
      o.material.color.set(0x2a3c4e);o.material.metalness=0.7;o.material.roughness=0.12;
      o.castShadow=false;
    } else if(/^lightFront/.test(n)){
      o.material.emissive=new THREE.Color(0xfff3d0);o.material.emissiveIntensity=0.8;
    } else if(/^lightBack/.test(n)){
      o.material.emissive=new THREE.Color(0xd32f2f);o.material.emissiveIntensity=0.7;
    } else if(/^carTire/.test(n)){
      o.material.roughness=0.95;o.material.color.set(0x16181c);
    }
  });
  detailMaterials(model);
  return wrap;
}
(function loadVehicleAssets(){
  if(!window.LAXFOO_MODELS||!window.GLTFLoader)return;
  const loader=new GLTFLoader();
  let pending=Object.keys(window.LAXFOO_MODELS).length;
  for(const [key,uri] of Object.entries(window.LAXFOO_MODELS)){
    loader.load(uri,gltf=>{
      try{
        if(/^(driver|stick)/.test(key))PROP_TEMPLATES[key]=normalizeProp(gltf.scene);
        else ASSET_TEMPLATES[key]=normalizeVehicleModel(gltf.scene);
      }
      catch(e){ console.warn("asset failed:",key,e); }
      if(--pending===0&&pPrev)updatePreviews();
    },undefined,err=>{ console.warn("vehicle asset load error:",key,err); pending--; });
  }
})();
function buildVehicleFromAsset(def,playerDef){
  const T=ASSET_TEMPLATES[def.asset];
  if(!T)return null;
  const g=new THREE.Group();
  const body=new THREE.Group(); g.add(body);
  const wrapClone=T.clone(true);
  body.add(wrapClone);
  const model=wrapClone.children[0];
  const wheels=[];
  wrapClone.traverse(o=>{
    if(o.isMesh&&o.material){
      const n=o.material.name||"";
      if(/^paint/.test(n)){o.material=o.material.clone();o.material.color.set(def.body);o.material.metalness=0.55;o.material.roughness=0.3;}
      else if(/^roof/.test(n)&&def.roof){o.material=o.material.clone();o.material.color.set(def.roof);}
    }
    for(const tag of WHEEL_TAGS){
      if(new RegExp("^wheel_"+tag).test(o.name)&&o.parent===model){
        wheels.push({front:tag.startsWith("front"),
          spin:r=>{o.rotation.x-=r;},
          steer:v=>{o.rotation.y=-v;}});
        break;
      }
    }
    if(o.name==="wheel_back"&&!def.spare)o.visible=false;
  });
  const D=T.userData.dims;
  if(!T.userData.metric){
    // generic (non-Blender) asset: bolt on procedural accessories
    if(def.rack){
      body.add(box(18,1.5,2,MAT.metal(0x788088),-5,D.h+0.8,6.5));
      body.add(box(18,1.5,2,MAT.metal(0x788088),-5,D.h+0.8,-6.5));
    }
    if(def.snorkel){
      body.add(box(2,12,2,MAT.matte(0x23272c),9,D.h-9,D.w/2-0.6));
    }
  }
  // driver + crosse: Blender props placed at the rig's seat / stickMount markers (meters, inside the model)
  const seatP=T.userData.seat, mountP=T.userData.stickMount;
  if(PROP_TEMPLATES.driverSeated&&seatP){
    const d=tintClone(PROP_TEMPLATES.driverSeated,driverTints(playerDef));
    d.position.set(seatP.x,seatP.y-0.55,seatP.z);
    model.add(d);
  } else {
    const driver=buildFigure(playerDef,{seated:true});
    driver.position.set(0,D.h*0.30,-4.5); driver.scale.setScalar(0.92);
    body.add(driver);
  }
  if(PROP_TEMPLATES.stick&&mountP){
    const st=tintClone(PROP_TEMPLATES.stick,[[/^pocket/,playerDef.color]]);
    st.position.copy(mountP);
    st.rotation.order="YXZ"; st.rotation.set(-Math.PI/2+0.22,-0.38,0);
    model.add(st);
  } else {
    const stick=buildStick(playerDef);
    stick.position.set(2,D.h*0.60,D.w/2-1.5);
    stick.rotation.set(-0.28,0.42,-0.12);
    body.add(stick);
  }
  return {group:g,body,wheels};
}
function buildWheel(r){
  const g=new THREE.Group();
  const tireGeo=new THREE.CylinderGeometry(r,r,4.8,20); tireGeo.rotateX(Math.PI/2);
  const tire=new THREE.Mesh(tireGeo,MAT.tire); tire.castShadow=true;
  const rimGeo=new THREE.CylinderGeometry(r*0.55,r*0.55,5.2,14); rimGeo.rotateX(Math.PI/2);
  const rim=new THREE.Mesh(rimGeo,MAT.rim);
  const hubGeo=new THREE.CylinderGeometry(r*0.18,r*0.18,5.6,10); hubGeo.rotateX(Math.PI/2);
  const hub=new THREE.Mesh(hubGeo,MAT.metal(0x333a40));
  const spin=new THREE.Group(); spin.add(tire,rim,hub);
  for(let i=0;i<5;i++){
    const sp=box(r*0.42,1.6,1.2,MAT.rim,r*0.28,0,0);
    const holder=new THREE.Group(); holder.rotation.z=i/5*TAU; holder.add(sp);
    spin.add(holder);
  }
  g.add(spin);
  return {group:g,spin};
}
function buildVehicle(def,playerDef){
  if(def.asset){
    const fromAsset=buildVehicleFromAsset(def,playerDef);
    if(fromAsset)return fromAsset;
  }
  const g=new THREE.Group();
  const body=new THREE.Group(); g.add(body);      // gets cosmetic roll/pitch
  const paint=MAT.paint(def.body);
  const trim=MAT.matte(0x23272c);
  const wheelR=7.4;

  // wheels
  const wheels=[];
  [[16.5,13.4],[16.5,-13.4],[-15.5,13.4],[-15.5,-13.4]].forEach(([wx,wz],i)=>{
    const w=buildWheel(wheelR);
    w.group.position.set(wx,wheelR,wz);
    g.add(w.group);
    wheels.push({front:i<2,
      spin:r=>{w.spin.rotation.z-=r;},
      steer:v=>{w.group.rotation.y=-v;}});
  });

  // main tub
  body.add(box(46,9.5,25,paint,0,12,0));
  body.add(box(47,3.5,26,trim,0,7.6,0));                       // rocker/chassis line
  // fender flares
  [[16.5,13.8],[16.5,-13.8],[-15.5,13.8],[-15.5,-13.8]].forEach(([fx,fz])=>{
    body.add(box(11,3.4,3.4,MAT.matte(0x1d2126),fx,15.2,fz));
  });
  // hood
  body.add(box(15,4,23,paint,14.8,18.6,0));
  // bull bar + bumpers
  body.add(box(2.6,4.5,26,MAT.metal(0x9aa2aa),23.6,9.5,0));
  body.add(box(2.6,4.5,26,MAT.metal(0x9aa2aa),-23.6,9.5,0));
  // grille + lights
  body.add(box(1.6,5.5,20,def.jeepGrille?MAT.matte(0x30363c):trim,23.2,14.5,0));
  if(def.jeepGrille)for(let i=0;i<5;i++)body.add(box(1.2,4.2,1.6,trim,23.9,14.5,-6+i*3));
  const lightM=MAT.emis(0xfff3d0,0.9);
  if(def.round){
    const hlGeo=new THREE.CylinderGeometry(2.2,2.2,1.6,12); hlGeo.rotateZ(Math.PI/2);
    const hl1=new THREE.Mesh(hlGeo,lightM); hl1.position.set(23.9,15,8.2); body.add(hl1);
    const hl2=new THREE.Mesh(hlGeo,lightM); hl2.position.set(23.9,15,-8.2); body.add(hl2);
  } else {
    body.add(box(1.2,2.6,6,lightM,23.9,15.4,8.5));
    body.add(box(1.2,2.6,6,lightM,23.9,15.4,-8.5));
  }
  const tailM=MAT.emis(0xd32f2f,0.8);
  body.add(box(1.2,3.4,3.4,tailM,-23.8,14.6,10));
  body.add(box(1.2,3.4,3.4,tailM,-23.8,14.6,-10));

  const glass=MAT.glass();
  const roofM=def.roof?MAT.paint(def.roof):null;
  if(def.cab==="closed"||def.cab==="half"){
    const cabL=def.cab==="half"?16:27, cabX=def.cab==="half"?3:-5;
    // pillars
    const px=[cabX+cabL/2-1.4,cabX-cabL/2+1.4];
    for(const zx of px)for(const zz of [10.4,-10.4])
      body.add(box(2.2,10,2.2,paint,zx,22.5,zz));
    // glasshouse
    body.add(box(cabL-1,8.4,21.6,glass,cabX,23,0,false));
    // roof
    body.add(box(cabL+1,2.2,23,roofM||paint,cabX,28.4,0));
    if(def.rack){
      body.add(box(cabL-4,1.6,2,MAT.metal(0x788088),cabX,30.4,8));
      body.add(box(cabL-4,1.6,2,MAT.metal(0x788088),cabX,30.4,-8));
    }
    if(def.cab==="half"){
      body.add(box(2,5,25,paint,-9,19,0));                   // bed front rail
      body.add(box(28,4.5,2,paint,-9-14+14,18.7,11.5));
      body.add(box(28,4.5,2,paint,-9-14+14,18.7,-11.5));
    }
  } else {
    // open tops: windshield + roll bar
    const ws=new THREE.Group();
    ws.position.set(7.5,21.5,0); ws.rotation.z=-0.18;
    ws.add(box(1.4,8.6,22,paint,0,0,0));
    ws.add(box(0.8,6.6,19,glass,0.4,0,0,false));
    body.add(ws);
    body.add(box(2.4,10.5,2.4,MAT.matte(0x2f353b),-4,22,10));
    body.add(box(2.4,10.5,2.4,MAT.matte(0x2f353b),-4,22,-10));
    body.add(box(2.4,2.4,22,MAT.matte(0x2f353b),-4,27.5,0));
    if(def.cab==="soft"){
      // folded tan canvas at rear
      const can=MAT.matte(0xc9a76e);
      body.add(box(9,4.6,21,can,-17.5,19.6,0));
      body.add(box(9,1.6,21,MAT.matte(0xb8945c),-17.5,22,0));
      body.add(box(9,1.2,21,MAT.matte(0xd6b57e),-17.5,17.4,0));
    } else {
      body.add(box(10,2.5,20,MAT.matte(0x3a3f45),-17.5,17.8,0)); // tonneau
    }
  }
  if(def.snorkel){
    body.add(box(2,12,2,trim,10,22,12.4));
    body.add(box(4,2,2,trim,12,28,12.4));
  }
  // mirrors
  body.add(box(1,2.6,1.8,trim,9,20.5,13.2));
  body.add(box(1,2.6,1.8,trim,9,20.5,-13.2));
  // spare on the tailgate
  if(def.spare){
    const spGeo=new THREE.CylinderGeometry(5.6,5.6,3.4,16); spGeo.rotateZ(Math.PI/2);
    const sp=new THREE.Mesh(spGeo,MAT.tire); sp.position.set(-24.8,15.5,0); sp.castShadow=true;
    body.add(sp);
    const spr=new THREE.CylinderGeometry(3.1,3.1,3.8,12); spr.rotateZ(Math.PI/2);
    const sprm=new THREE.Mesh(spr,MAT.rim); sprm.position.set(-24.8,15.5,0); body.add(sprm);
  }
  // antenna + exhaust
  body.add(cyl(0.35,0.35,10,MAT.metal(0x222222),18,24,-11.5,6));
  const exGeo=new THREE.CylinderGeometry(1.1,1.1,4,8); exGeo.rotateZ(Math.PI/2);
  const ex=new THREE.Mesh(exGeo,MAT.metal(0x555e66)); ex.position.set(-23.5,6.5,8); body.add(ex);

  // seat + driver, actually down in the tub
  body.add(box(7,6,8,MAT.matte(0x2c3237),-6,17,-6));
  const driver=buildFigure(playerDef,{seated:true});
  driver.position.set(-2,11.5,-6);
  driver.scale.setScalar(1.05);
  body.add(driver);
  // crosse held out the passenger side, pocket forward like a jousting lance
  const stick=buildStick(playerDef);
  stick.position.set(2,19,9.5);
  stick.rotation.set(-0.28,0.42,-0.12);
  body.add(stick);

  return {group:g,body,wheels,stick};
}
function stickHead(color){
  const headG=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.TorusGeometry(4.2,0.55,8,20),MAT.paint(color));
  rim.scale.set(1,1.28,1); headG.add(rim);
  const net=new THREE.Mesh(new THREE.CircleGeometry(3.9,16),
    new THREE.MeshStandardMaterial({map:TEX.net,transparent:true,side:THREE.DoubleSide,roughness:.9}));
  net.scale.set(1,1.28,1); headG.add(net);
  return headG;
}
function buildStick(playerDef,upright){
  const g=new THREE.Group();
  if(upright){
    g.add(cyl(0.8,0.8,34,MAT.metal(0xb8bec6),0,17,0,10));
    const h=stickHead(playerDef.color);
    h.position.set(0.8,38.5,0); h.rotation.z=-0.18;
    g.add(h);
    return g;
  }
  const shaft=cyl(0.8,0.8,26,MAT.metal(0xb8bec6),0,0,0,10);
  shaft.rotation.z=Math.PI/2-0.35; shaft.position.set(6,0,0);
  g.add(shaft);
  const headG=stickHead(playerDef.color);
  headG.position.set(17.5,4.2,0);
  headG.rotation.z=-0.35; g.add(headG);
  return g;
}
function buildFigure(p,{seated}){
  const g=new THREE.Group();
  const skin=MAT.matte(p.skin), jersey=MAT.matte(p.jersey);
  // torso + shoulder pads
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(3.4,4.5,6,12),jersey);
  torso.position.y=8; torso.castShadow=true; g.add(torso);
  g.add(box(8.6,2.8,7.2,jersey,0,11.4,0));
  // number patch on the chest (figure faces +X)
  const num=new THREE.Mesh(new THREE.PlaneGeometry(3.2,3.6),MAT.matte(0xffffff));
  num.position.set(3.5,8.6,0); num.rotation.y=Math.PI/2; g.add(num);
  // arms
  const armL=new THREE.Mesh(new THREE.CapsuleGeometry(1.25,5,4,8),jersey);
  armL.position.set(2,9.5,4.3); armL.rotation.x=seated?-1.0:-0.3; armL.castShadow=true; g.add(armL);
  const armR=new THREE.Mesh(new THREE.CapsuleGeometry(1.25,5,4,8),jersey);
  armR.position.set(2,9.5,-4.3); armR.rotation.x=seated?1.0:0.3; armR.castShadow=true; g.add(armR);
  g.add(sph(1.5,MAT.matte(0x30353b),3.4,7.6,4.9,10));  // gloves
  g.add(sph(1.5,MAT.matte(0x30353b),3.4,7.6,-4.9,10));
  // head + helmet + facemask
  g.add(sph(2.6,skin,0,15,0,14));
  const helmet=sph(3.15,MAT.paint(p.color),0,15.7,0,16);
  helmet.scale.set(1.12,0.95,1.05); g.add(helmet);
  g.add(box(3,0.9,5.6,MAT.paint(0xffffff),1.4,17.6,0));       // stripe/brim
  const maskM=MAT.metal(0xcfd6dd);
  for(let i=0;i<3;i++){
    const bar=new THREE.Mesh(new THREE.TorusGeometry(2.5-i*0.25,0.22,6,14,Math.PI),maskM);
    bar.position.set(2.1,14.4-i*0.4,0);
    bar.rotation.set(Math.PI/2,0,-0.5);
    g.add(bar);
  }
  if(!seated){
    const shorts=MAT.matte(0x2b3138);
    g.add(box(6.4,3.6,5.4,shorts,0,3.6,0));
    const legL=new THREE.Mesh(new THREE.CapsuleGeometry(1.35,4.6,4,8),skin);
    legL.position.set(0,-0.5,1.8); legL.castShadow=true; g.add(legL);
    const legR=legL.clone(); legR.position.z=-1.8; g.add(legR);
    g.add(box(3.4,1.5,2.2,MAT.matte(0xf0f0ec),0.6,-3.4,1.8));
    g.add(box(3.4,1.5,2.2,MAT.matte(0xf0f0ec),0.6,-3.4,-1.8));
  }
  return g;
}

/* ================================================================
   GAME STATE
   ================================================================ */
const game={
  phase:"title", paused:false,
  cars:[], balls:[], groundBalls:[], particles:[],
  shake:0, raceT:0, finishCount:0, countT:0, gbTimer:0, cdOrbit:0,
  selPlayer:0, selCar:0, winner:null,
  autoGas:true,
};
const dynamic=new THREE.Group(); scene.add(dynamic);

/* particles pool */
const POOL_N=140, pPool=[];
for(let i=0;i<POOL_N;i++){
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(2.2,0),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true}));
  m.visible=false; scene.add(m);
  pPool.push({m,vx:0,vy:0,vz:0,t:0,max:1});
}
let pIdx=0;
function spawnP(x,y,z,color,n,spd,up){
  for(let i=0;i<n;i++){
    const p=pPool[pIdx=(pIdx+1)%POOL_N];
    const a=rnd(0,TAU),s=rnd(spd*0.3,spd);
    p.vx=Math.cos(a)*s; p.vz=Math.sin(a)*s; p.vy=rnd(up*0.3,up);
    p.t=p.max=rnd(0.3,0.7);
    p.m.position.set(x,y,z); p.m.material.color.set(color);
    p.m.visible=true; p.m.scale.setScalar(rnd(0.7,1.6));
  }
}
function burst(x,z,color,n){ spawnP(x,14,z,color,n,240,180); }

/* ---------------- MENUS ---------------- */
const $=id=>document.getElementById(id);
const screens={title:$("titleScreen"),players:$("playerScreen"),cars:$("carScreen"),over:$("overScreen"),pause:$("pauseScreen")};
function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  if(name&&screens[name])screens[name].classList.add("active");
  $("hud").classList.toggle("active",!name||name==="pause");
  $("touchUI").classList.toggle("active",TOUCH&&(!name));
}
function buildMenus(){
  const teams=[...new Set(PLAYERS.map(p=>p.team))];
  $("playerGrid").innerHTML=teams.map(t=>`<div class="teamHdr">${t}</div>`+PLAYERS.map((p,i)=>p.team!==t?"":`
    <div class="card" data-i="${i}">
      <div class="nm"><span class="swatch" style="background:${p.color}"></span>${p.name}</div>
      <div class="sub">${p.pos||t}</div>
    </div>`).join("")).join("");
  $("carGrid").innerHTML=CARS.map((c,i)=>`
    <div class="card ${c.rarity==="legendary"?"legend":""}" data-i="${i}">
      <span class="rar ${c.rarity}">${RARITY[c.rarity].label}</span>
      <div class="nm"><span class="swatch" style="background:${c.body}"></span>${c.name}</div>
      <div class="sub">4WD${c.cab!=="closed"?" · open top":""}${c.spare?" · rear spare":""}</div>
    </div>`).join("");
  $("playerGrid").querySelectorAll(".card").forEach(el=>el.onclick=()=>{game.selPlayer=+el.dataset.i;refreshSel();SFX.catch();});
  $("carGrid").querySelectorAll(".card").forEach(el=>el.onclick=()=>{game.selCar=+el.dataset.i;refreshSel();SFX.catch();});
  refreshSel();
}
function refreshSel(){
  $("playerGrid").querySelectorAll(".card").forEach(el=>el.classList.toggle("sel",+el.dataset.i===game.selPlayer));
  $("carGrid").querySelectorAll(".card").forEach(el=>el.classList.toggle("sel",+el.dataset.i===game.selCar));
  const P=PLAYERS[game.selPlayer], C=CARS[game.selCar];
  $("pPrevName").textContent=P.name;
  $("pPrevPos").textContent=[P.pos,P.team].filter(Boolean).join(" · ");
  $("pPrevPerk").textContent="★ "+P.perk;
  $("cPrevName").textContent=C.name;
  $("cPrevSub").textContent="4WD"+(C.cab!=="closed"?" · open top":"")+(C.spare?" · rear spare":"");
  $("cPrevSpec").textContent=C.special?"★ "+C.special:"";
  $("cPrevOnly").style.display=C.onlyOne?"block":"none";
  $("cPrevBars").innerHTML=
    `<div>SPEED</div><div class="bar"><i style="width:${C.speed*100}%"></i></div>
     <div>HANDLING</div><div class="bar"><i style="width:${C.handling*100}%"></i></div>
     <div>TOUGHNESS</div><div class="bar"><i style="width:${C.tough*100}%"></i></div>`;
  updatePreviews();
}
function handleMenuKeys(e){
  const k=e.key;
  if(game.phase==="players"||game.phase==="cars"){
    const n=game.phase==="players"?PLAYERS.length:CARS.length;
    const prop=game.phase==="players"?"selPlayer":"selCar";
    const cols=2;
    if(k==="ArrowRight")game[prop]=(game[prop]+1)%n;
    else if(k==="ArrowLeft")game[prop]=(game[prop]-1+n)%n;
    else if(k==="ArrowDown")game[prop]=Math.min(n-1,game[prop]+cols);
    else if(k==="ArrowUp")game[prop]=Math.max(0,game[prop]-cols);
    else if(k==="Enter"){ game.phase==="players"?gotoCars():startMatch(); return; }
    else if(k==="Escape"){ game.phase==="players"?gotoTitle():gotoPlayers(); return; }
    else return;
    refreshSel(); SFX.count();
  } else if(game.phase==="title"&&k==="Enter") gotoPlayers();
  else if(game.phase==="over"&&k==="Enter") startMatch();
}
function gotoTitle(){game.phase="title";showScreen("title");}
function gotoPlayers(){game.phase="players";showScreen("players");updatePreviews();}
function gotoCars(){game.phase="cars";showScreen("cars");updatePreviews();}
$("btnStart").onclick=()=>{audio();ensureEngine();gotoPlayers();};
$("btnBackTitle").onclick=gotoTitle;
$("btnToCars").onclick=gotoCars;
$("btnBackPlayers").onclick=gotoPlayers;
$("btnRace").onclick=()=>startMatch();
$("btnRematch").onclick=()=>startMatch();
$("btnGarage").onclick=()=>gotoPlayers();
$("btnResume").onclick=()=>togglePause();
$("btnQuit").onclick=()=>{game.paused=false;gotoTitle();};
function togglePause(){
  if(game.phase!=="race"&&game.phase!=="countdown")return;
  game.paused=!game.paused;
  showScreen(game.paused?"pause":null);
}

/* ---------------- 3D PREVIEWS ---------------- */
function makePreview(canvasEl){
  const r=new THREE.WebGLRenderer({canvas:canvasEl,antialias:true,alpha:true});
  r.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:2));
  r.outputColorSpace=THREE.SRGBColorSpace;
  r.toneMapping=THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap;
  r.useLegacyLights=false;
  const s=new THREE.Scene();
  const cam=new THREE.PerspectiveCamera(38,canvasEl.width/canvasEl.height,1,600);
  const key=new THREE.DirectionalLight(0xfff1dc,3.2); key.position.set(80,120,60);
  key.castShadow=true; key.shadow.mapSize.set(1024,1024);
  key.shadow.normalBias=1.4; key.shadow.bias=-0.0004;
  key.shadow.camera.left=-70;key.shadow.camera.right=70;key.shadow.camera.top=70;key.shadow.camera.bottom=-70;
  s.add(key);
  s.add(new THREE.HemisphereLight(0xbdd8ff,0x44403a,0.9));
  s.environment=scene.environment;
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(42,46,5,40),
    new THREE.MeshStandardMaterial({color:0x232d40,roughness:.4,metalness:.5}));
  ped.position.y=-2.5; ped.receiveShadow=true; s.add(ped);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(44,0.9,8,50),MAT.emis(0xffb300,1.2));
  ring.rotation.x=Math.PI/2; s.add(ring);
  const holder=new THREE.Group(); s.add(holder);
  return {r,s,cam,holder,ring};
}
let pPrev=null,cPrev=null;
function updatePreviews(){
  if(!pPrev){pPrev=makePreview($("playerPrev"));cPrev=makePreview($("carPrev"));}
  // player figure
  pPrev.holder.clear();
  const P=PLAYERS[game.selPlayer];
  if(PROP_TEMPLATES.driverStanding){
    const S=30;   // preview units per meter
    const fig=tintClone(PROP_TEMPLATES.driverStanding,driverTints(P));
    fig.scale.setScalar(S); fig.rotation.y=Math.PI*0.85;
    pPrev.holder.add(fig);
    if(PROP_TEMPLATES.stick){
      const st=tintClone(PROP_TEMPLATES.stick,[[/^pocket/,P.color]]);
      st.scale.setScalar(S); st.position.set(-0.30*S,0,0.16*S); st.rotation.z=0.12;
      pPrev.holder.add(st);
    }
  } else {
    const fig=buildFigure(P,{seated:false});
    fig.position.y=4; fig.scale.setScalar(2.4);
    const st=buildStick(P,true);
    st.position.set(3.4,-4.6,5.2); st.scale.setScalar(0.62);
    fig.add(st);
    pPrev.holder.add(fig);
  }
  pPrev.cam.position.set(86,52,86); pPrev.cam.lookAt(0,26,0);
  // car
  cPrev.holder.clear();
  const v=buildVehicle(CARS[game.selCar],PLAYERS[game.selPlayer]);
  cPrev.holder.add(v.group);
  cPrev.ring.material.color.set(RARITY[CARS[game.selCar].rarity].color);
  cPrev.ring.material.emissive.set(RARITY[CARS[game.selCar].rarity].color);
  cPrev.cam.position.set(78,50,78); cPrev.cam.lookAt(0,12,0);
}

/* ---------------- MATCH SETUP ---------------- */
function makeCar(playerIdx,carIdx,spawn,isAI){
  const P=PLAYERS[playerIdx], C=CARS[carIdx];
  const st=C.cab==="soft"?3:1;
  const v=buildVehicle(C,P);
  v.group.scale.setScalar(1.14);
  v.group.position.set(spawn.x,0,spawn.y);
  dynamic.add(v.group);
  return {
    player:P, car:C, isAI, mesh:v.group, bodyG:v.body, wheels:v.wheels,
    x:spawn.x,y:spawn.y,a:spawn.a, vx:0,vy:0, r:22,
    h:0, hv:0, steerVis:0,
    stick:st, ammo:stickStats(st).carry, cool:0,
    stun:0, invuln:0, spin:0, boostGlow:0, trampCool:0,
    hits:0, ai:{target:null,unstick:0,rev:0,turn:0,thinkT:0,lane:rnd(-50,50)},
    ti:-1, s:0, dist:0, lapDone:-1, finished:false, place:0, finishT:0, onShoulder:false,
  };
}
function ballMesh(r,ground){
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,12),
    new THREE.MeshStandardMaterial({color:ground?0xfdd835:0xff9100,roughness:.45}));
  m.castShadow=true;
  return m;
}
function makeGroundBall(x,y,vx,vy){
  const g={x,y,vx:vx||rnd(-60,60),vy:vy||rnd(-60,60),r:10,ti:-1,mesh:ballMesh(10,true),ring:null};
  const ring=new THREE.Mesh(new THREE.TorusGeometry(20,1.6,6,28),MAT.emis(0xfdd835,1.3));
  ring.rotation.x=Math.PI/2;
  g.ring=ring;
  g.mesh.add(ring); ring.position.y=-4;
  g.mesh.position.set(x,8,y);
  dynamic.add(g.mesh);
  return g;
}
function startMatch(){
  audio(); ensureEngine();
  dynamic.clear();
  const cars=[makeCar(game.selPlayer,game.selCar,SPAWNS[0],false)];
  const pPool2=PLAYERS.map((_,i)=>i).filter(i=>i!==game.selPlayer);
  const cPool2=CARS.map((_,i)=>i).filter(i=>i!==game.selCar&&!CARS[i].onlyOne);
  for(let k=1;k<4;k++){
    const pi=pPool2.splice(Math.floor(Math.random()*pPool2.length),1)[0];
    const ci=cPool2.splice(Math.floor(Math.random()*cPool2.length),1)[0];
    cars.push(makeCar(pi,ci,SPAWNS[k],true));
  }
  for(const c of cars){ c.ti=trackNearest(c.x,c.y); c.s=TRACK.pts[c.ti].s; c.dist=c.s-1; }
  game.cars=cars; game.balls=[]; game.msgs=[];
  game.groundBalls=GB_SPOTS.map(([x,y])=>makeGroundBall(x,y,0,0));
  game.raceT=0; game.finishCount=0; game.countT=3.6; game.gbTimer=0; game.winner=null;
  game.shake=0; game.paused=false; game.cdOrbit=0;
  game.phase="countdown";
  $("msgs").innerHTML="";
  showScreen(null);
  $("countdown").classList.add("active");
  hudCache={};
  const p=cars[0];
  camera.position.set(p.x-Math.cos(p.a)*160,120,p.y-Math.sin(p.a)*160);
  camLook.set(p.x,15,p.y);
}

/* ---------------- COLLISION ---------------- */
function circleRectPush(cx,cy,r,rc){
  const nx=clamp(cx,rc.x,rc.x+rc.w), ny=clamp(cy,rc.y,rc.y+rc.h);
  let dx=cx-nx, dy=cy-ny;
  const d2=dx*dx+dy*dy;
  if(d2>=r*r)return null;
  if(d2===0){
    const l=cx-rc.x, rr=rc.x+rc.w-cx, t=cy-rc.y, b=rc.y+rc.h-cy;
    const m=Math.min(l,rr,t,b);
    if(m===l)return{x:-(l+r),y:0}; if(m===rr)return{x:rr+r,y:0};
    if(m===t)return{x:0,y:-(t+r)}; return{x:0,y:b+r};
  }
  const d=Math.sqrt(d2), push=(r-d)/d;
  return {x:dx*push,y:dy*push};
}
const SOLIDS=WALLS;
function pointBlocked(x,y,pad){
  for(const rc of SOLIDS){
    if(x>rc.x-pad&&x<rc.x+rc.w+pad&&y>rc.y-pad&&y<rc.y+rc.h+pad)return true;
  }
  for(const t of TREES){ if(dist(x,y,t.x,t.y)<t.r+pad)return true; }
  return false;
}

/* ---------------- THROWING ---------------- */
function effStats(c){
  const S=stickStats(c.stick), m=c.player.mod;
  return {
    throwSpeed:S.throwSpeed*(m.throw||1),
    cooldown:S.cooldown*(m.cool||1),
    ballR:S.ballR,
    range:S.range*(m.range||1),
    carry:S.carry,
    spread:S.spread,
    stun:S.stun*(m.bigHit||1),
  };
}
function tryThrow(c,aimAng){
  const S=effStats(c);
  if(c.cool>0||c.ammo<=0||c.stun>0||game.phase!=="race")return;
  let ang=aimAng!==undefined?aimAng:c.a;
  let best=null,bestD=1e9;
  for(const o of game.cars){
    if(o===c||o.invuln>0)continue;
    const d=dist(c.x,c.y,o.x,o.y);
    if(d>S.range*1.2)continue;
    const lead=d/S.throwSpeed;
    const tx=o.x+o.vx*lead, ty=o.y+o.vy*lead;
    const da=Math.abs(angDiff(ang,Math.atan2(ty-c.y,tx-c.x)));
    if(da<0.45&&d<bestD){bestD=d;best=Math.atan2(ty-c.y,tx-c.x);}
  }
  if(best!==null)ang=lerp(ang,ang+angDiff(ang,best),0.8);
  c.ammo--; c.cool=S.cooldown;
  const n=S.spread, arc=0.16;
  for(let i=0;i<n;i++){
    const off=n===1?0:(i-(n-1)/2)*arc;
    const b={
      x:c.x+Math.cos(c.a)*30, y:c.y+Math.sin(c.a)*30,
      vx:Math.cos(ang+off)*S.throwSpeed, vy:Math.sin(ang+off)*S.throwSpeed,
      owner:c, state:"out", travel:0, range:S.range, r:S.ballR, ti:c.ti,
      retT:0, mesh:ballMesh(S.ballR,false),
    };
    b.mesh.position.set(b.x,16,b.y);
    dynamic.add(b.mesh);
    game.balls.push(b);
  }
  SFX.throw();
}
function dropGroundBall(x,y,vx,vy){
  game.groundBalls.push(makeGroundBall(x,y,vx,vy));
}
function removeMesh(o){ if(o.mesh){dynamic.remove(o.mesh);} }
function landHit(ball,victim){
  const th=ball.owner;
  const S=effStats(th);
  victim.stun=S.stun*(victim.player.mod.stun||1)*(1.15-victim.car.tough*0.4);
  victim.invuln=victim.stun+1.2;
  victim.spin=0;
  victim.vx+=ball.vx*0.4; victim.vy+=ball.vy*0.4;
  const lost=victim.stick>1?1:0;
  victim.stick=Math.max(1,victim.stick-1);
  if(victim.ammo>0){victim.ammo--;dropGroundBall(victim.x,victim.y);}
  th.hits++;
  if(th.stick<MAX_STICK){
    th.stick++;
    th.ammo=Math.min(effStats(th).carry,th.ammo+1);
    if(!th.isAI){addMsg(`STICK ${th.stick}: ${STICKS[th.stick-1]}`,"#ffd54f");SFX.level();}
  }
  if(!victim.isAI){addMsg(lost?"PLUNKED! Dropped a stick level":"PLUNKED!","#ff8a80");SFX.ouch();}
  if(!th.isAI&&victim.isAI)SFX.hit(); else if(th.isAI&&victim.isAI)beep(140,0.1,"sawtooth",0.05,-60);
  burst(victim.x,victim.y,victim.player.color,26);
  game.shake=Math.max(game.shake,(!th.isAI||!victim.isAI)?10:4);
  dropGroundBall(ball.x,ball.y,ball.vx*0.1,ball.vy*0.1);
  th.boostGlow=Math.max(th.boostGlow,0.55);
}
const ORD=["","1st","2nd","3rd","4th"];
function raceOrder(){
  return [...game.cars].sort((a,b)=>{
    if(a.finished&&b.finished)return a.place-b.place;
    if(a.finished!==b.finished)return a.finished?-1:1;
    return b.dist-a.dist;
  });
}
function fmtT(t){ const m=Math.floor(t/60), s=t-m*60; return `${m}:${s<10?"0":""}${s.toFixed(1)}`; }
function endMatch(){
  if(game.phase==="over")return;
  game.phase="over";
  const order=raceOrder(), me=game.cars[0], myPos=order.indexOf(me)+1;
  game.winner=order[0];
  $("overTitle").textContent=myPos===1?"YOU WIN!":`${ORD[myPos].toUpperCase()} PLACE`;
  $("overWinner").innerHTML=`🏁 ${order[0].player.name} wins the Home Circuit${order[0].finished?` in <b>${fmtT(order[0].finishT)}</b>`:""}`;
  $("overRows").innerHTML=order.map((c,i)=>`
    <div class="standRow">
      <div style="font-size:22px">${["🥇","🥈","🥉","4th"][i]}</div>
      <div class="pl"><span class="swatch" style="background:${c.player.color}"></span>
        ${c.player.name}${c.isAI?"":" (YOU)"}<div style="font-family:Verdana;font-size:11px;color:#9fb0c8">${c.player.team} · ${c.car.name}</div></div>
      <div class="lv">${c.finished?fmtT(c.finishT):`lap ${clamp(Math.floor(c.dist)+1,1,LAPS)}`}<div style="font-family:Verdana;font-size:11px;color:#9fb0c8">Stick ${c.stick} · ${c.hits} hits</div></div>
    </div>`).join("");
  showScreen("over");
  engineTick(0,false);
  if(myPos===1)SFX.win();
}
function addMsg(text,color){
  const d=document.createElement("div");
  d.className="msg"; d.textContent=text; d.style.color=color;
  $("msgs").appendChild(d);
  while($("msgs").children.length>4)$("msgs").firstChild.remove();
  setTimeout(()=>d.remove(),2400);
}

/* ---------------- CAR PHYSICS ---------------- */
function updateCar(c,dt){
  const m=c.player.mod;
  const maxSpd=(330+c.car.speed*260)*(m.speed||1)*(1+(c.stick-1)*0.004);   // every stick level adds a little top end
  const turnRate=(2.0+c.car.handling*1.6)*(m.handling||1);
  let throttle=0,steer=0,drift=false;
  if(c.stun>0){
    c.stun-=dt; c.spin+=dt*12;
  } else if(!c.isAI){
    // keyboard: digital keys eased into an analog steer so it feels like a stick
    let kSteer=(keys["a"]||keys["arrowleft"]?-1:0)+(keys["d"]||keys["arrowright"]?1:0);
    c.kSteer=lerp(c.kSteer||0,kSteer,Math.min(1,(kSteer?9:16)*dt));
    let kThr=null;
    if(keys["w"]||keys["arrowup"])kThr=1;
    if(keys["s"]||keys["arrowdown"])kThr=-0.6;
    // virtual joystick (touch) and gamepad
    let jSteer=input.joyActive?input.steer:0, jThr=input.joyActive?input.throttle:null;
    let gSteer=input.gp?input.gpSteer:0, gThr=input.gp?input.gpThrottle:null;
    steer=clamp(c.kSteer+jSteer+gSteer,-1,1);
    throttle=kThr!==null?kThr:(jThr!==null?jThr:(gThr!==null?gThr:0));
    if(TOUCH&&game.autoGas&&throttle===0&&kThr===null&&gThr===null)throttle=1;   // touch: auto-gas unless braking
    drift=!!(keys["shift"]||(input.gp&&input.gpDrift));
    if(keys[" "]||keys["x"]||(input.gp&&input.gpThrowEdge))tryThrow(c);
  } else {
    const o=aiDrive(c,dt); throttle=o.throttle; steer=o.steer;
  }
  const hx=Math.cos(c.a),hy=Math.sin(c.a),nx=-hy,ny=hx;
  let fwd=c.vx*hx+c.vy*hy, lat=c.vx*nx+c.vy*ny;
  if(c.stun<=0){
    fwd+=throttle*(throttle>0?620:480)*dt;
    c.a+=steer*turnRate*dt*clamp(Math.abs(fwd)/180,0,1)*(fwd<-20?-1:1);
  }
  fwd*=Math.pow(0.72,dt);
  const grip=drift?2.2:9;
  lat*=Math.max(0,1-grip*dt);
  let cap=maxSpd; if(c.boostGlow>0)cap=maxSpd*1.55;
  if(c.onShoulder){cap*=0.62;fwd*=Math.pow(0.5,dt);}                       // off the racing surface
  if(c.isAI&&game.cars[0]){const lead=c.dist-game.cars[0].dist;cap*=lead<-0.3?1.14:(lead>0.25?0.9:1);}   // rubber band
  const inPool=c.x>POOL.x&&c.x<POOL.x+POOL.w&&c.y>POOL.y&&c.y<POOL.y+POOL.h;
  if(inPool){
    cap*=0.45; fwd*=Math.pow(0.25,dt);
    if(Math.abs(fwd)>60&&Math.random()<dt*22)spawnP(c.x+rnd(-16,16),4,c.y+rnd(-16,16),0x9adcf5,2,90,160);
  }
  fwd=clamp(fwd,-maxSpd*0.5,cap);
  c.vx=hx*fwd+nx*lat; c.vy=hy*fwd+ny*lat;
  c.x+=c.vx*dt; c.y+=c.vy*dt;
  for(const p of PADS){
    if(dist(c.x,c.y,p.x,p.y)<p.r&&c.boostGlow<=0.2){
      c.vx+=Math.cos(p.ang)*420; c.vy+=Math.sin(p.ang)*420; c.boostGlow=0.9;
      if(!c.isAI)SFX.boost();
    }
  }
  c.boostGlow=Math.max(0,c.boostGlow-dt);
  if(c.boostGlow>0.15)spawnP(c.x-hx*26,8,c.y-hy*26,0xffb74d,1,60,50);
  c.trampCool=Math.max(0,c.trampCool-dt);
  const td=dist(c.x,c.y,TRAMPOLINE.x,TRAMPOLINE.y);
  if(td<TRAMPOLINE.r&&c.trampCool<=0){
    const spd=Math.max(420,Math.hypot(c.vx,c.vy)*1.2);
    const a=Math.atan2(c.y-TRAMPOLINE.y,c.x-TRAMPOLINE.x);
    c.vx=Math.cos(a)*spd; c.vy=Math.sin(a)*spd; c.trampCool=0.6;
    c.hv=260;
    if(!c.isAI)SFX.bounce();
    spawnP(c.x,16,c.y,0x80cbc4,10,180,220);
  }
  // vertical (visual) motion
  const hTarget=inPool?-7:0;
  c.h+=c.hv*dt; c.hv-=900*dt;
  if(c.h<=hTarget&&c.hv<=0){c.h=lerp(c.h,hTarget,Math.min(1,10*dt));c.hv=0;}
  // track walls, shoulders and lap progress
  {
    const hit=trackContain(c,c.r-4,1.4);
    if(hit&&hit.vn>140&&!c.isAI){game.shake=Math.max(game.shake,5);spawnP(c.x,10,c.y,0xd7ccc8,4,120,90);}
    const tp=TRACK.pts[c.ti];
    c.onShoulder=Math.abs(trackLat(c.x,c.y,c.ti))>TRACK_W/2;
    let ds=tp.s-c.s; if(ds>0.5)ds-=1; else if(ds<-0.5)ds+=1; c.s=tp.s;
    if(game.phase==="race"&&!c.finished){
      c.dist+=ds;
      const lap=Math.floor(c.dist);
      if(lap>c.lapDone){
        c.lapDone=lap;
        if(lap>=LAPS){
          c.finished=true; c.place=++game.finishCount; c.finishT=game.raceT;
          if(!c.isAI)endMatch();
          else if(!game.cars[0].finished)addMsg(`${firstName(c)} takes the flag`,"#c8d5e8");
        } else if(lap>=1&&!c.isAI){ addMsg(lap===LAPS-1?"FINAL LAP!":`LAP ${lap+1}`,"#8fd3ff"); SFX.level(); }
      }
    }
  }
  for(const t of TREES){
    const d=dist(c.x,c.y,t.x,t.y),min=t.r+c.r;
    if(d<min&&d>0){
      const px=(c.x-t.x)/d,py=(c.y-t.y)/d;
      c.x=t.x+px*min;c.y=t.y+py*min;
      const vn=c.vx*px+c.vy*py;
      if(vn<0){c.vx-=vn*px*1.4;c.vy-=vn*py*1.4;}
    }
  }
  for(const o of game.cars){
    if(o===c)continue;
    const d=dist(c.x,c.y,o.x,o.y),min=c.r+o.r;
    if(d<min&&d>0){
      const px=(c.x-o.x)/d,py=(c.y-o.y)/d,ov=(min-d)/2;
      c.x+=px*ov;c.y+=py*ov;o.x-=px*ov;o.y-=py*ov;
      const rvx=c.vx-o.vx,rvy=c.vy-o.vy,vn=rvx*px+rvy*py;
      if(vn<0){c.vx-=vn*px*0.6;c.vy-=vn*py*0.6;o.vx+=vn*px*0.6;o.vy+=vn*py*0.6;}
    }
  }
  c.x=clamp(c.x,50,WORLD.w-50); c.y=clamp(c.y,50,WORLD.h-50);
  c.cool=Math.max(0,c.cool-dt); c.invuln=Math.max(0,c.invuln-dt);
  const scoopR=c.r+30*(m.scoop||1)+(m.scoop?10:0), pullR=scoopR*2.4;
  const S=effStats(c);
  for(let i=game.groundBalls.length-1;i>=0;i--){
    const g=game.groundBalls[i];
    if(c.ammo>=S.carry||c.stun>0)break;
    const d=dist(c.x,c.y,g.x,g.y);
    if(d<pullR&&d>=scoopR){ const k=(1-d/pullR)*560*dt; g.vx+=(c.x-g.x)/d*k; g.vy+=(c.y-g.y)/d*k; }   // the crosse pulls loose balls in
    if(d<scoopR){
      removeMesh(g);
      game.groundBalls.splice(i,1); c.ammo++;
      if(!c.isAI){addMsg("GROUND BALL!","#aed581");SFX.scoop();}
    }
  }
  // ---- visuals ----
  c.mesh.position.set(c.x,c.h,c.y);
  c.mesh.rotation.y=-(c.a+(c.stun>0?c.spin:0));
  const spinRate=fwd*dt/7.4;
  c.steerVis=lerp(c.steerVis,steer*0.42,Math.min(1,10*dt));
  c.wheels.forEach(w=>{
    w.spin(spinRate);
    if(w.front)w.steer(c.steerVis);
  });
  c.bodyG.rotation.x=lerp(c.bodyG.rotation.x,c.steerVis*clamp(fwd/maxSpd,0,1)*0.14,Math.min(1,8*dt));
  c.bodyG.rotation.z=lerp(c.bodyG.rotation.z,-throttle*0.045,Math.min(1,6*dt));
  c.mesh.visible=!(c.invuln>0&&Math.floor(performance.now()/90)%2===0);
  if(Math.abs(fwd)>420&&!inPool&&Math.random()<dt*18)
    spawnP(c.x-hx*24,3,c.y-hy*24,0xb9a891,1,40,60);
}

/* ---------------- AI ---------------- */
function firstName(c){ return c.player.name.replace(/"/g,"").split(" ")[0]; }
function aiDrive(c,dt){
  const ai=c.ai; ai.thinkT-=dt;
  const S=effStats(c);
  if(ai.thinkT<=0){ ai.thinkT=rnd(0.4,0.9); ai.lane=clamp(ai.lane+rnd(-45,45),-70,70); }
  const spd=Math.hypot(c.vx,c.vy);
  if(ai.rev>0){ ai.rev-=dt; return {throttle:-0.8,steer:ai.turn}; }
  if(spd<25&&game.phase==="race"){ ai.unstick+=dt; if(ai.unstick>1.2){ai.unstick=0;ai.rev=0.6;ai.turn=Math.random()<0.5?-1:1;} }
  else ai.unstick=0;
  // racing line: aim at a point further along the centreline (further when faster), in this car's lane
  const look=0.012+spd/700*0.03;
  let tgt=trackAt(c.s+look,ai.lane);
  if(c.ammo===0){   // empty pocket: detour for a loose ball that's roughly ahead
    for(const g of game.groundBalls){
      const d=dist(c.x,c.y,g.x,g.y);
      if(d<260&&Math.abs(angDiff(c.a,Math.atan2(g.y-c.y,g.x-c.x)))<0.7){tgt={x:g.x,y:g.y};break;}
    }
  }
  const want=Math.atan2(tgt.y-c.y,tgt.x-c.x), da=angDiff(c.a,want);
  let steer=clamp(da*2.6,-1,1), throttle=1;
  const p1=trackPt(c.s+0.02), p2=trackPt(c.s+0.07);
  const bend=Math.abs(angDiff(Math.atan2(p1.dy,p1.dx),Math.atan2(p2.dy,p2.dx)));
  if(bend>0.55&&spd>380)throttle=0.45;      // lift for the corner ahead
  if(Math.abs(da)>1.2)throttle=0.3;
  if(c.ammo>0&&c.cool<=0){                   // plunk whoever is ahead and in range
    for(const o of game.cars){
      if(o===c||o.invuln>0)continue;
      const d=dist(c.x,c.y,o.x,o.y);
      if(d<S.range*0.9&&Math.abs(angDiff(c.a,Math.atan2(o.y-c.y,o.x-c.x)))<0.3){tryThrow(c);break;}
    }
  }
  return {throttle,steer};
}

/* ---------------- BALLS ---------------- */
function updateBall(b,i,dt){
  if(b.state==="out"){
    b.travel+=Math.hypot(b.vx,b.vy)*dt;
    if(b.travel>b.range)b.state="ret";
  } else if(b.state==="ret"){
    b.retT+=dt;
    const o=b.owner, d=dist(b.x,b.y,o.x,o.y)||1;
    const sp=Math.max(430,Math.hypot(b.vx,b.vy));
    const wx=(o.x-b.x)/d*sp, wy=(o.y-b.y)/d*sp;
    const k=Math.min(1,(2.5+b.retT*4)*dt);
    b.vx=lerp(b.vx,wx,k); b.vy=lerp(b.vy,wy,k);
    if(b.retT>4){
      dropGroundBall(b.x,b.y,b.vx*0.05,b.vy*0.05);
      removeMesh(b); game.balls.splice(i,1); return;
    }
    if(d<o.r+14&&o.stun<=0){
      const cap=effStats(o).carry;
      if(o.ammo<cap)o.ammo++;
      else dropGroundBall(b.x,b.y);
      if(!o.isAI)SFX.catch();
      removeMesh(b); game.balls.splice(i,1); return;
    }
  }
  b.x+=b.vx*dt; b.y+=b.vy*dt;
  if(trackContain(b,b.r,2.0)&&b.state==="out")b.travel+=b.range*0.34;
  for(const t of TREES){
    const d=dist(b.x,b.y,t.x,t.y),min=t.r+b.r;
    if(d<min&&d>0){
      const px=(b.x-t.x)/d,py=(b.y-t.y)/d;
      b.x=t.x+px*min;b.y=t.y+py*min;
      const vn=b.vx*px+b.vy*py;
      if(vn<0){b.vx-=2*vn*px;b.vy-=2*vn*py;}
    }
  }
  if(b.x<48||b.x>WORLD.w-48){b.vx*=-1;b.x=clamp(b.x,48,WORLD.w-48);}
  if(b.y<48||b.y>WORLD.h-48){b.vy*=-1;b.y=clamp(b.y,48,WORLD.h-48);}
  const arc=b.state==="out"?10*Math.sin(Math.PI*clamp(b.travel/b.range,0,1)):2*Math.sin(b.retT*9);
  b.mesh.position.set(b.x,15+arc,b.y);
  for(const o of game.cars){
    if(o===b.owner||o.invuln>0)continue;
    if(dist(b.x,b.y,o.x,o.y)<o.r+b.r){
      landHit(b,o);
      removeMesh(b); game.balls.splice(i,1); return;
    }
  }
}

/* ---------------- CAMERA ---------------- */
function updateCamera(dt){
  const p=game.cars[0]; if(!p)return;
  let dx,dy,dz,lx,ly,lz;
  if(game.phase==="countdown"){
    game.cdOrbit+=dt*0.55;
    const th=game.cdOrbit+p.a+Math.PI;
    dx=p.x+Math.cos(th)*170; dz=p.y+Math.sin(th)*170; dy=70;
    lx=p.x; ly=18; lz=p.y;
  } else {
    const hx=Math.cos(p.a),hy=Math.sin(p.a);
    dx=p.x-hx*112; dz=p.y-hy*112; dy=72;
    lx=p.x+hx*50; ly=13; lz=p.y+hy*50;
  }
  const k=Math.min(1,4.5*dt);
  camera.position.x=lerp(camera.position.x,dx,k);
  camera.position.y=lerp(camera.position.y,dy,k);
  camera.position.z=lerp(camera.position.z,dz,k);
  camLook.x=lerp(camLook.x,lx,Math.min(1,6*dt));
  camLook.y=lerp(camLook.y,ly,Math.min(1,6*dt));
  camLook.z=lerp(camLook.z,lz,Math.min(1,6*dt));
  if(game.shake>0){
    camera.position.x+=rnd(-game.shake,game.shake)*0.6;
    camera.position.y+=rnd(-game.shake,game.shake)*0.4;
    camera.position.z+=rnd(-game.shake,game.shake)*0.6;
  }
  camera.lookAt(camLook);
  sun.position.set(p.x+SUN_DIR.x*SUN_DIST,SUN_DIR.y*SUN_DIST,p.y+SUN_DIR.z*SUN_DIST);
  sun.target.position.set(p.x,0,p.y);
}

/* ---------------- HUD ---------------- */
let hudCache={};
const mm=$("minimap").getContext("2d");
function updateHUD(){
  const p=game.cars[0]; if(!p)return;
  const S=effStats(p);
  if(hudCache.stick!==p.stick){
    hudCache.stick=p.stick;
    $("stickLab").textContent=`STICK ${p.stick} / ${MAX_STICK}`;
    $("stickName").textContent=STICKS[p.stick-1];
    $("stickBar").style.width=(p.stick/MAX_STICK*100)+"%";
  }
  const ammoKey=p.ammo+"/"+S.carry;
  if(hudCache.ammo!==ammoKey){
    hudCache.ammo=ammoKey;
    $("ammoRow").innerHTML=Array.from({length:S.carry},(_,i)=>
      `<div class="pip ${i<p.ammo?"full":""}"></div>`).join("");
  }
  const order=raceOrder(), pos=order.indexOf(p)+1;
  const lapShown=p.finished?LAPS:clamp(Math.floor(p.dist)+1,1,LAPS);
  const lKey=lapShown+"/"+pos;
  if(hudCache.lap!==lKey){
    hudCache.lap=lKey;
    $("timer").textContent=`LAP ${lapShown}/${LAPS}`;
    $("posTxt").textContent=ORD[pos];
    $("posPanel").classList.toggle("first",pos===1);
  }
  const sKey=order.map(c=>c.player.name+(c.finished?"F":Math.floor(c.dist))).join("|");
  if(hudCache.stand!==sKey){
    hudCache.stand=sKey;
    $("standRows").innerHTML=order.map((c,i)=>`
      <div class="srow ${c.isAI?"":"you"}">
        <div class="dot" style="background:${c.player.color}"></div>
        <span class="n">${ORD[i+1]} ${firstName(c)}${c.isAI?"":" (YOU)"}</span>
        <span class="v">${c.finished?"🏁":"L"+clamp(Math.floor(c.dist)+1,1,LAPS)}</span>
      </div>`).join("");
  }
  // minimap
  const MS=200/WORLD.w;
  mm.fillStyle="#20324e"; mm.fillRect(0,0,200,144);
  if(!hudCache.mmPath){
    const path=new Path2D();
    TRACK.pts.forEach((q,i)=>{ if(i%4)return; if(i===0)path.moveTo(q.x*MS,q.y*MS); else path.lineTo(q.x*MS,q.y*MS); });
    path.closePath(); hudCache.mmPath=path;
  }
  mm.lineJoin="round"; mm.lineCap="round";
  mm.strokeStyle="#3b4d6b"; mm.lineWidth=WALL_OFF*2*MS; mm.stroke(hudCache.mmPath);
  mm.strokeStyle="#66788f"; mm.lineWidth=TRACK_W*MS; mm.stroke(hudCache.mmPath);
  const sp=TRACK.pts[0]; mm.strokeStyle="#fff"; mm.lineWidth=1.5;
  mm.beginPath(); mm.moveTo((sp.x-sp.nx*TRACK_W/2)*MS,(sp.y-sp.ny*TRACK_W/2)*MS); mm.lineTo((sp.x+sp.nx*TRACK_W/2)*MS,(sp.y+sp.ny*TRACK_W/2)*MS); mm.stroke();
  mm.fillStyle="#2a6db3"; mm.fillRect(POOL.x*MS,POOL.y*MS,POOL.w*MS,POOL.h*MS);
  mm.fillStyle="#fdd835";
  for(const g of game.groundBalls){mm.beginPath();mm.arc(g.x*MS,g.y*MS,1.5,0,TAU);mm.fill();}
  for(const c of game.cars){
    mm.fillStyle=c.player.color;
    mm.beginPath();mm.arc(c.x*MS,c.y*MS,c.isAI?3:4.5,0,TAU);mm.fill();
    if(!c.isAI){mm.strokeStyle="#fff";mm.lineWidth=1.2;mm.stroke();}
  }
}

/* ---------------- MAIN LOOP ---------------- */
let last=performance.now();
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(0.033,(now-last)/1000); last=now;
  const menuUp=["title","players","cars"].includes(game.phase);
  if(menuUp){
    if(pPrev&&game.phase==="players"){
      pPrev.holder.rotation.y+=dt*0.7;
      pPrev.r.render(pPrev.s,pPrev.cam);
    }
    if(cPrev&&game.phase==="cars"){
      cPrev.holder.rotation.y+=dt*0.55;
      cPrev.r.render(cPrev.s,cPrev.cam);
    }
    return;
  }
  if(game.phase==="countdown"&&!game.paused){
    const prev=Math.ceil(game.countT);
    game.countT-=dt;
    const n=Math.ceil(game.countT-0.5);
    $("cdNum").textContent=n>0?String(n):"GO!";
    if(Math.ceil(game.countT)<prev&&game.countT>0)SFX.count();
    if(game.countT<=0){
      game.phase="race";SFX.go();
      $("countdown").classList.remove("active");
    }
  }
  pollGamepad();
  if(game.phase==="race"&&!game.paused){
    game.raceT+=dt;
    if(game.raceT>420)endMatch();
    else{
      for(const c of game.cars)updateCar(c,dt);
      for(let i=game.balls.length-1;i>=0;i--)updateBall(game.balls[i],i,dt);
      for(const g of game.groundBalls){
        g.x+=g.vx*dt;g.y+=g.vy*dt;g.vx*=Math.pow(0.05,dt);g.vy*=Math.pow(0.05,dt);
        trackContain(g,g.r,1.5);
        g.x=clamp(g.x,52,WORLD.w-52);g.y=clamp(g.y,52,WORLD.h-52);
        g.mesh.position.set(g.x,6,g.y);
        const pulse=1+0.25*Math.sin(now/200);
        g.ring.scale.setScalar(pulse);
      }
      game.gbTimer+=dt;
      if(game.gbTimer>3){
        game.gbTimer=0;
        if(game.groundBalls.length<8){
          const s=pick(GB_SPOTS);
          if(!game.groundBalls.some(g=>dist(g.x,g.y,s[0],s[1])<60))dropGroundBall(s[0],s[1],0,0);
        }
      }
      const p0=game.cars[0];
      engineTick(Math.hypot(p0.vx,p0.vy),true);
    }
  } else if(game.paused){
    engineTick(0,false);
  }
  // particles
  for(const p of pPool){
    if(!p.m.visible)continue;
    p.t-=dt;
    if(p.t<=0){p.m.visible=false;continue;}
    p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
    p.vy-=500*dt;
    if(p.m.position.y<2){p.m.position.y=2;p.vy*=-0.3;}
    p.m.material.opacity=clamp(p.t/p.max,0,1);
  }
  game.shake=Math.max(0,game.shake-dt*30);
  if(game.phase==="race"||game.phase==="countdown"||game.phase==="over"){
    if(!game.paused)updateCamera(dt);
    // ambient anims
    if(waterMesh){waterMesh.material.map.offset.x+=dt*0.02;waterMesh.material.map.offset.y+=dt*0.013;}
    const pulse=1.1+0.5*Math.sin(now/180);
    for(const pm of padMeshes)pm.material.emissiveIntensity=pulse;
    updateHUD();
    if(skyDome)skyDome.position.set(camera.position.x,0,camera.position.z);
    if(composer)composer.render(); else renderer.render(scene,camera);
  }
}

/* ---------------- TOUCH CONTROLS ---------------- */
// two layouts: "dpad" (◀ ▶ + ▲ gas / ▼ reverse buttons, the default) or "stick" (virtual joystick + auto-gas)
game.touchScheme=(()=>{try{return localStorage.getItem("laxfoo.touch")||"dpad";}catch(_){return "dpad";}})();
function applyTouchScheme(){
  const s=game.touchScheme;
  $("touchUI").classList.toggle("scheme-dpad",s==="dpad");
  $("touchUI").classList.toggle("scheme-stick",s==="stick");
  game.autoGas=s==="stick";
  const b=$("btnScheme"); if(b)b.textContent="TOUCH CONTROLS: "+(s==="dpad"?"BUTTONS":"JOYSTICK");
  try{localStorage.setItem("laxfoo.touch",s);}catch(_){}
}
(function setupTouchUI(){
  if(!TOUCH)return;
  document.querySelectorAll(".touchOnly").forEach(el=>el.style.display="");
  applyTouchScheme();
  $("btnScheme").onclick=()=>{game.touchScheme=game.touchScheme==="dpad"?"stick":"dpad";applyTouchScheme();};
  const bind=(el,down,up)=>{
    const active=new Set();
    const on=e=>{e.preventDefault();active.add(e.pointerId);el.classList.add("on");down(e);
      try{el.setPointerCapture(e.pointerId);}catch(_){}};
    const off=e=>{active.delete(e.pointerId);if(active.size===0){el.classList.remove("on");up(e);}};
    el.addEventListener("pointerdown",on);
    el.addEventListener("pointerup",off);el.addEventListener("pointercancel",off);
    el.addEventListener("lostpointercapture",off);
    el.addEventListener("contextmenu",e=>e.preventDefault());
  };
  document.querySelectorAll("#touchUI .tbtn[data-key]").forEach(el=>{
    const k=el.dataset.key;
    bind(el,()=>{keys[k]=true;},()=>{keys[k]=false;});
  });
  // virtual analog stick: appears where the thumb lands, steers by x, brakes/reverses when pulled back
  const zone=$("joyZone"), base=$("joyBase"), knob=$("joyKnob");
  const R=58; let jid=null, ox=0, oy=0;
  const setKnob=(dx,dy)=>{knob.style.transform=`translate(${dx}px,${dy}px)`;};
  zone.addEventListener("pointerdown",e=>{
    if(jid!==null)return; e.preventDefault();
    jid=e.pointerId; ox=e.clientX; oy=e.clientY;
    base.style.left=ox+"px"; base.style.top=oy+"px"; base.classList.add("on"); setKnob(0,0);
    input.joyActive=true; input.steer=0; input.throttle=null;
    try{zone.setPointerCapture(e.pointerId);}catch(_){}
  });
  zone.addEventListener("pointermove",e=>{
    if(e.pointerId!==jid)return;
    let dx=e.clientX-ox, dy=e.clientY-oy; const d=Math.hypot(dx,dy);
    if(d>R){dx*=R/d;dy*=R/d;}
    setKnob(dx,dy);
    const nx=dx/R, ny=dy/R;                       // ny>0 = pulled back
    const dzx=Math.abs(nx)<0.1?0:(nx-Math.sign(nx)*0.1)/0.9;
    input.steer=clamp(dzx*1.15,-1,1);
    input.throttle=ny>0.3?-0.6*Math.min(1,(ny-0.3)/0.7):(ny<-0.25?1:null);   // pull back = brake/reverse, push = gas
  });
  const joyEnd=e=>{
    if(e.pointerId!==jid)return;
    jid=null; base.classList.remove("on"); input.joyActive=false; input.steer=0; input.throttle=null;
  };
  zone.addEventListener("pointerup",joyEnd); zone.addEventListener("pointercancel",joyEnd); zone.addEventListener("lostpointercapture",joyEnd);
  addEventListener("gamepadconnected",e=>{addMsg("🎮 "+(e.gamepad.id||"Gamepad").split("(")[0].trim()+" connected","#8fd3ff");});
  bind($("tThrow"),()=>{const p=game.cars[0];if(p&&game.phase==="race"&&!game.paused)tryThrow(p);},()=>{});
  $("tPause").addEventListener("pointerdown",e=>{e.preventDefault();togglePause();});
  // never let the page scroll/zoom under the game
  document.addEventListener("touchmove",e=>{if($("hud").classList.contains("active"))e.preventDefault();},{passive:false});
  document.addEventListener("gesturestart",e=>e.preventDefault());
  let lastTap=0;
  document.addEventListener("touchend",e=>{const t=Date.now();if(t-lastTap<300)e.preventDefault();lastTap=t;},{passive:false});
})();

/* ---------------- BOOT ---------------- */
buildMenus();
requestAnimationFrame(tick);
