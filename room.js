import * as THREE from './vendor/three.module.min.js';
import { textureAtlas } from './assets/textures/atlas-layout.js?v=1.4.0';
import { createGesture, clampZoom } from './interaction.js?v=1.4.0';
import { createNavigation, angleDelta } from './navigation.js?v=1.4.0';
import { AREAS, areaId, hasObject, passageAt } from './mansion.js?v=1.4.0';
import { GOD_TARGET, GOD_DISTANCE, GOD_PITCH, PEEP_EYE, PEEP_TARGET, inkFragments, alignedObservation } from './perspective.js?v=1.4.0';

export function createRoom(container, { onInspect, onTravel = ()=>{}, onObservation = ()=>{}, location = 'parlor', solved = false, flowerSolved = false, keyTaken = false, escaped = false, quality = 1.5, markers = true, surfaceMode = 'images', viewMode = 'god', view = null }) {
  location=areaId(location);const area=AREAS[location],START=area.start;
  const {canStand,walkStep,moveBy,findPath}=createNavigation(location);
  const imageSurfaces = surfaceMode === 'images';
  let disposed = false, lastRenderMs = 0;
  const assetLoads = [], assetErrors = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d2d4bc');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(64, 1, .045, 35);
  const player = new THREE.Vector3(START.x,1.58,START.z);
  let movement={side:0,forward:0},approach=null,lastFrame=0,baseFov=64,paused=false;
  let zoom = 1, wantedZoom = 1, doorResolve = null;
  let yaw = -.22, wantedYaw = -.22, pitch = -.06, wantedPitch = -.06;
  let mode=viewMode==='walk'?'walk':'god',godYaw=.48,wantedGodYaw=.48,godPitch=.37,wantedGodPitch=.37,godZoom=1,wantedGodZoom=1;
  const godTarget=new THREE.Vector3(0,1.15,-.4),wantedGodTarget=godTarget.clone();
  let orbitDistance=10.8,navAnchor=null,navTurn=0,navForward=0;
  const viewPointers=new Set();
  let frame = 0, drawerOpen = solved ? .65 : 0, doorOpen = escaped ? 1 : 0, drawerTarget = drawerOpen, doorTarget = doorOpen;
  let flowerOpen=flowerSolved?1:0,flowerTarget=flowerOpen,lastObservation;
  let crossing=false;
  let seed = 529;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pickables = [];
  const room = new THREE.Group(); scene.add(room);
  scene.add(new THREE.HemisphereLight('#fff5d8', '#7b8063', 2.35));
  const sunlight = new THREE.DirectionalLight('#fff2ce', 3.2); sunlight.position.set(-5, 7, 3); scene.add(sunlight);
  const fill = new THREE.DirectionalLight('#dce7c7', .6); fill.position.set(4, 3, 5); scene.add(fill);
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .93, ...extra });

  // Small, compressed local images are shared by every surface using the same finish.
  const textureCache = new Map();
  function imageTexture(name) {
    const key='surface-atlas';
    if (textureCache.has(key)) return textureCache.get(key);
    let complete;
    assetLoads.push(new Promise(resolve => { complete = resolve; }));
    const map = new THREE.TextureLoader().load(new URL(textureAtlas.file, import.meta.url).href,
      loaded => { if (disposed) loaded.dispose(); else requestRender(); complete(); },
      undefined, () => { assetErrors.push(key); complete(); });
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textureCache.set(key, map);
    return map;
  }

  function texture(draw, size = 512) {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const woodTexture = imageSurfaces ? imageTexture('wood') : texture((c,s) => {
    c.fillStyle='#776046';c.fillRect(0,0,s,s);
    for(let i=0;i<1600;i++){const x=random()*s;c.strokeStyle=`rgba(${random()>.5?'37,29,17':'187,163,111'},${random()*.17})`;c.lineWidth=random()*1.9+.2;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+random()*15,160,x-random()*15,350,x+random()*5,s);c.stroke();}
    for(let i=0;i<12;i++){const x=random()*s,y=random()*s;c.strokeStyle='#3a33221a';c.lineWidth=2;c.beginPath();c.ellipse(x,y,5,35,0,0,Math.PI*2);c.stroke();}
  });
  const lightWoodTexture = imageSurfaces ? imageTexture('light-wood') : texture((c,s)=>{c.fillStyle='#b2a17a';c.fillRect(0,0,s,s);for(let i=0;i<900;i++){c.fillStyle=`rgba(72,61,34,${random()*.1})`;c.fillRect(random()*s,0,.4+random(),s);}});
  const tatamiTexture = imageSurfaces ? imageTexture('tatami') : texture((c,s)=>{
    c.fillStyle='#b8bc8c';c.fillRect(0,0,s,s);
    for(let y=0;y<s;y+=2){c.fillStyle=y%4===0?'#8f98683f':'#ecdeb13a';c.fillRect(0,y,s,1);}
    for(let x=0;x<s;x+=6){c.fillStyle='#6b74421b';c.fillRect(x,0,1,s);for(let y=0;y<s;y+=8){c.fillStyle=(x+y)%16?'#e6d7a12a':'#8c946433';c.fillRect(x,y,5,1);}}
    const g=c.createLinearGradient(0,0,s,s);g.addColorStop(0,'#f7eccb14');g.addColorStop(1,'#4d5d3b20');c.fillStyle=g;c.fillRect(0,0,s,s);
  });
  const plasterTexture = imageSurfaces ? imageTexture('plaster') : texture((c,s)=>{c.fillStyle='#cecbb3';c.fillRect(0,0,s,s);for(let i=0;i<28000;i++){c.fillStyle=random()>.5?'#fffce30c':'#574d3e08';c.fillRect(random()*s,random()*s,1,1);}});
  const paperTexture = imageSurfaces ? imageTexture('washi') : texture((c,s)=>{
    c.fillStyle='#eeebd4';c.fillRect(0,0,s,s);
    const g=c.createRadialGradient(150,170,5,260,260,400);g.addColorStop(0,'#fffdefb8');g.addColorStop(1,'#b5bd9633');c.fillStyle=g;c.fillRect(0,0,s,s);
    for(let i=0;i<4000;i++){c.strokeStyle='#726f4f09';c.beginPath();const x=random()*s,y=random()*s;c.moveTo(x,y);c.lineTo(x+random()*5,y+random()*9);c.stroke();}
    c.save();c.filter='blur(8px)';c.strokeStyle='#7d8e6550';c.fillStyle='#7f8f6640';c.lineWidth=8;
    for(let j=0;j<3;j++){let x=70+j*160;c.beginPath();c.moveTo(x,s);c.quadraticCurveTo(x+20,260,x-30,10);c.stroke();for(let y=60;y<490;y+=65){c.beginPath();c.ellipse(x+25,y,45,7,-.65,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(x-22,y+25,37,6,.7,0,Math.PI*2);c.fill();}}c.restore();
  });
  const timber = material('#b2a383', {map: woodTexture});
  const paleTimber = material('#e2d4ad', {map: lightWoodTexture});
  const darkTimber = material('#796246', {map: woodTexture});
  const plaster = material('#eeead2', {map: plasterTexture});
  const blackMetal = material('#383a2e',{metalness:.5,roughness:.57});
  const tatami = material('#e2deb4', {map:tatamiTexture});
  const tatamiAlt = material('#d1d5a6', {map:tatamiTexture});
  const tagSurface=(mat,name)=>{if(imageSurfaces)mat.userData.atlasTile=name;return mat;};
  for(const [mat,name] of [[timber,'wood'],[darkTimber,'wood'],[paleTimber,'light-wood'],[plaster,'plaster'],[tatami,'tatami'],[tatamiAlt,'tatami']])tagSurface(mat,name);
  const sharedAtlasMaterial=imageSurfaces?material('#ffffff',{map:woodTexture,vertexColors:true}):null;
  const edge = material('#626c4c');
  // Surface generation must not change the shared furniture/plant geometry in A/B tests.
  seed=529;
  function box(w,h,d,x,y,z,mat=timber,parent=room){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
  function surfaceBox(w,h,d,x,y,z,mat,fullFace,parent=room){
    const mesh=box(w,h,d,x,y,z,mat,parent),uv=mesh.geometry.getAttribute('uv');
    // One full image face; the narrow solid sides sample a quiet patch of that image.
    // This keeps thickness and side lighting without extra materials or draw calls.
    for(let face=0;face<6;face++)if(face!==fullFace)for(let vertex=0;vertex<4;vertex++)uv.setXY(face*4+vertex,.45,.14);
    uv.needsUpdate=true;return mesh;
  }
  function cylinder(rt,rb,h,x,y,z,mat,parent=room,segments=24){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat);m.position.set(x,y,z);parent.add(m);return m;}
  function sphere(r,x,y,z,mat,parent=room,sx=1,sy=1,sz=1){const m=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
  function clickable(group,id){group.userData.inspect=id;pickables.push(group);return group;}
  function line(points,color,width=1,parent=room){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color,linewidth:width}));parent.add(m);return m;}
  function flatShadow(x,z,w,d,opacity=.25,y=.025){
    const t=texture((c,s)=>{const g=c.createRadialGradient(s/2,s/2,s*.05,s/2,s/2,s*.5);g.addColorStop(0,`rgba(36,44,25,${opacity})`);g.addColorStop(.55,`rgba(36,44,25,${opacity*.5})`);g.addColorStop(1,'rgba(36,44,25,0)');c.fillStyle=g;c.fillRect(0,0,s,s);},128);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);room.add(m);return m;
  }
  // Six woven mats, wooden thresholds, and a deep, solid timber foundation.
  box(9.15,.25,6.45,0,-.19,0,darkTimber);
  box(9.2,.15,.15,0,-.03,3.17,paleTimber);box(.15,.15,6.4,4.53,-.03,0,paleTimber);
  box(.15,.15,6.4,-4.53,-.03,0,paleTimber);
  const wovenEdge=material('#c8c99a');
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const x=-2.96+col*2.96,z=-1.52+row*3.03;
    const top = (row+col)%2 ? tatamiAlt : tatami;
    if(imageSurfaces)surfaceBox(2.91,.09,2.98,x,-.03,z,top,2);
    else box(2.91,.09,2.98,x,-.03,z,top);
    if (!imageSurfaces) {
      box(.055,.012,2.98,x-1.43,.023,z,edge);box(.055,.012,2.98,x+1.43,.023,z,edge);
      for(let i=0;i<27;i++){box(.041,.002,.018,x-1.43,.031,z-1.45+i*.11,wovenEdge);box(.041,.002,.018,x+1.43,.031,z-1.45+i*.11,wovenEdge);}
    }
  }
  // Back wall, open tokonoma, fusuma door, and heavy traditional beams.
  const northShell=new THREE.Group();room.add(northShell);
  box(9.15,3.65,.14,0,1.76,-3.17,plaster,northShell);
  box(.16,3.66,.16,-4.43,1.77,-3.05,darkTimber);box(.16,3.66,.16,4.43,1.77,-3.05,timber);
  box(9.15,.18,.22,0,3.5,-3.03,timber);box(9.15,.13,.2,0,.1,-3.03,timber);
  for(const x of [-.8,1.72])box(.12,3.45,.17,x,1.78,-3.03,timber);
  box(9.05,.07,.16,0,2.92,-3.02,timber);
  const alcove = new THREE.Group();room.add(alcove);
  box(3.5,2.75,.08,-2.62,1.57,-3.04,material('#b6baa0'),alcove);
  box(3.6,.23,1.0,-2.62,.15,-2.65,darkTimber,alcove);
  box(3.62,.05,1.02,-2.62,.295,-2.65,paleTimber,alcove);
  box(.15,3.2,.26,-.82,1.6,-2.82,darkTimber,alcove);
  box(3.6,.2,.7,-2.62,2.93,-2.8,timber,alcove);
  box(3.45,.03,.4,-2.62,2.81,-2.85,material('#766b4f'),alcove);
  // Hanging scroll, calligraphy drawn once to a small canvas.
  const scroll=new THREE.Group();room.add(scroll);clickable(scroll,'scroll');
  box(1.02,1.97,.025,-2.55,1.74,-2.937,material('#b1ac8a'),scroll);
  const calligraphy = texture((c,s)=>{
    c.fillStyle='#ece6cf';c.fillRect(0,0,s,s);c.fillStyle='#313b29';c.textAlign='center';c.font='105px "Yu Mincho", "Noto Serif JP", serif';
    c.font='46px serif';c.lineWidth=3;c.strokeStyle='#383d30';
    ['松','竹','梅'].forEach((label,i)=>{const x=140+i*118;c.fillText(label,x,105);c.save();c.translate(x,190);
      if(i===0){c.strokeRect(-38,-20,76,55);c.beginPath();c.moveTo(-52,20);c.lineTo(0,65);c.lineTo(52,20);c.moveTo(0,-65);c.lineTo(0,-32);c.stroke();}
      if(i===1){c.strokeRect(-42,-30,84,70);c.beginPath();c.ellipse(0,3,24,12,0,0,Math.PI*2);c.stroke();c.beginPath();c.arc(0,3,5,0,Math.PI*2);c.stroke();}
      if(i===2){for(let r=0;r<3;r++)for(let col=0;col<3;col++)c.strokeRect(-42+col*28,-35+r*28,22,22);}
      c.restore();});
    c.font='25px serif';c.fillText('松 ↓　竹 →',256,365);
    c.fillStyle='#a35d454f';c.fillRect(380,411,38,38);c.fillStyle='#8b4934';c.font='23px serif';c.fillText('和',399,438);
  });
  box(.74,1.5,.012,-2.55,1.78,-2.917,material('#f4f0db',{map:calligraphy}),scroll);
  for(const y of [.74,2.74]){const m=cylinder(.035,.035,1.16,-2.55,y,-2.93,darkTimber,scroll);m.rotation.z=Math.PI/2;}
  line([[-3.02,2.77,-2.94],[-2.55,3.02,-2.96],[-2.08,2.77,-2.94]],'#6f745a',1,scroll);
  // Earthenware ikebana in the alcove.
  const ceramic=material('#52635a',{roughness:.72});
  const vase=new THREE.Group();room.add(vase);
  sphere(.19,-3.64,.49,-2.52,ceramic,vase,1,1.23,1);cylinder(.095,.14,.27,-3.64,.7,-2.52,ceramic,vase);cylinder(.1,.1,.03,-3.64,.85,-2.52,material('#334338'),vase);
  for(let i=0;i<5;i++){
    const end=[-3.65+(i-2)*.2,1.22+random()*.33,-2.5+(random()-.5)*.2];
    line([[-3.64,.78,-2.52],[-3.64+(i-2)*.08,1.05,-2.53],end],'#546346',1,vase);
    for(let j=0;j<3;j++){const leaf=sphere(.09,end[0]+(j-1)*.045,end[1]-.1*j,end[2],material('#71815b'),vase,1,.22,.5);leaf.rotation.z=(j%2?1:-1)*.6;}
  }
  // Left shoji with translucent bamboo silhouettes and close-set wooden lattice.
  const shoji=new THREE.Group();room.add(shoji);clickable(shoji,'window');
  box(.13,3.5,6.3,-4.46,1.74,0,plaster,shoji);
  const washiMaterial=material('#fff9d8',{map:paperTexture,emissive:'#d4d8a7',emissiveIntensity:.27});
  const shojiFace=imageSurfaces ? tagSurface(material('#fff9d8',{map:imageTexture('shoji'),emissive:'#d4d8a7',emissiveIntensity:.27}),'shoji') : null;
  for(let panel=0;panel<3;panel++){
    const z=-2.02+panel*2.02;
    if(imageSurfaces)surfaceBox(.13,2.65,1.91,-4.32,1.68,z,shojiFace,0,shoji);
    else box(.04,2.65,1.91,-4.37,1.68,z,washiMaterial,shoji);
    for(const zz of [z-.98,z+.98])box(.085,2.84,.055,-4.29,1.69,zz,paleTimber,shoji);
    if (!imageSurfaces) {
      for(let j=0;j<6;j++)box(.065,.025,1.92,-4.275,.39+j*.52,z,paleTimber,shoji);
      for(let j=0;j<4;j++)box(.065,2.64,.023,-4.27,1.69,z-.72+j*.48,paleTimber,shoji);
    }
  }
  for(const y of [.23,3.09,3.5])box(.2,.14,6.35,-4.3,y,0,timber,shoji);
  for(const z of [-3.1,3.1])box(.19,3.63,.19,-4.3,1.76,z,darkTimber,shoji);
  // Warm window light and lattice shadows baked into a single floor texture.
  const sunMap=texture((c,s)=>{
    c.clearRect(0,0,s,s);c.fillStyle='#fff5b85e';c.beginPath();c.moveTo(0,0);c.lineTo(s*.69,s*.16);c.lineTo(s,s);c.lineTo(0,s*.79);c.fill();
    c.save();c.globalCompositeOperation='destination-out';c.strokeStyle='#000';c.lineWidth=6;
    for(let i=0;i<9;i++){c.beginPath();c.moveTo(0,i*65-10);c.lineTo(s,i*65+150);c.stroke();}
    c.lineWidth=9;for(let i=0;i<5;i++){c.beginPath();c.moveTo(i*120,0);c.lineTo(i*120+230,s);c.stroke();}c.restore();
  });
  const lightPlane=new THREE.Mesh(new THREE.PlaneGeometry(7.9,5.6),new THREE.MeshBasicMaterial({map:sunMap,transparent:true,depthWrite:false,opacity:.73}));lightPlane.rotation.x=-Math.PI/2;lightPlane.position.set(-.35,.037,.1);room.add(lightPlane);
  // Exit fusuma: hand-painted mountains and a recessed round handle.
  const door=new THREE.Group();room.add(door);clickable(door,'door');
  const landscape=texture((c,s)=>{
    c.fillStyle='#d9d9bc';c.fillRect(0,0,s,s);
    const g=c.createLinearGradient(0,0,0,s);g.addColorStop(0,'#eeecd444');g.addColorStop(1,'#8192743c');c.fillStyle=g;c.fillRect(0,0,s,s);
    c.fillStyle='#87957824';c.beginPath();c.moveTo(0,380);c.bezierCurveTo(90,200,180,330,260,250);c.bezierCurveTo(380,150,420,300,512,220);c.lineTo(s,s);c.lineTo(0,s);c.fill();
    c.fillStyle='#6d806124';c.beginPath();c.moveTo(0,450);c.bezierCurveTo(120,300,230,420,360,340);c.bezierCurveTo(450,260,490,390,512,340);c.lineTo(s,s);c.lineTo(0,s);c.fill();
    c.fillStyle='#f2e4ab77';c.beginPath();c.arc(400,140,38,0,Math.PI*2);c.fill();
  });
  box(2.47,2.76,.1,3.04,1.55,-3.025,darkTimber,door);
  box(2.3,2.58,.028,3.04,1.55,-2.959,material('#eeead1',{map:landscape}),door);
  box(.045,2.6,.03,3.05,1.55,-2.938,paleTimber,door);
  const handle=cylinder(.061,.061,.022,2.18,1.31,-2.928,blackMetal,door);handle.rotation.x=Math.PI/2;
  const exitGlow=box(2.43,2.7,.02,3.03,1.55,-3.1,material('#f8f0cf',{emissive:'#fff2c7',emissiveIntensity:.6}));exitGlow.visible=escaped;
  // Tansu: worn drawers, iron corner plates, ring handles and three-digit lock.
  const chest=new THREE.Group();chest.position.set(.46,0,-2.4);room.add(chest);clickable(chest,'chest');
  flatShadow(.46,-2.35,2.6,1.7,.37,.04);
  // A hollow upper compartment, rather than a solid block hiding the drawer interior.
  box(.1,1.3,.84,-.84,.77,0,darkTimber,chest);box(.1,1.3,.84,.84,.77,0,darkTimber,chest);
  box(1.58,1.3,.07,0,.77,-.385,darkTimber,chest);
  box(1.58,.82,.75,0,.55,0,darkTimber,chest);
  box(1.9,.1,.92,0,1.46,0,timber,chest);
  for(const x of [-.76,.76])for(const z of [-.29,.29])box(.12,.19,.13,x,.12,z,darkTimber,chest);
  const drawer=new THREE.Group();chest.add(drawer);drawer.position.z=drawerOpen;
  const drawerFace = imageSurfaces ? tagSurface(material('#b2a383',{map:imageTexture('drawer-front')}),'drawer-front') : null;
  for(let row=0;row<3;row++){
    const group=row===0?drawer:chest,y=1.2-row*.39;
    box(1.65,.34,.07,0,y,.45,imageSurfaces ? [timber,timber,timber,timber,drawerFace,timber] : timber,group);
    if (!imageSurfaces) {
    for(const x of [-.75,.75])box(.055,.32,.015,x,y,.495,blackMetal,group);
    for(const x of [-.42,.42]){
      box(.16,.1,.02,x,y+.03,.5,blackMetal,group);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.061,.011,6,20,Math.PI*1.6),blackMetal);ring.position.set(x,y-.035,.53);ring.rotation.z=-.3;group.add(ring);
      for(const xx of [-.061,.061])sphere(.009,x+xx,y+.03,.517,blackMetal,group);
    }
    }
  }
  box(1.51,.04,.72,0,1.04,.11,timber,drawer);box(.04,.21,.72,-.75,1.13,.1,timber,drawer);box(.04,.21,.72,.75,1.13,.1,timber,drawer);
  box(1.51,.21,.04,0,1.13,-.25,timber,drawer);
  box(.25,.18,.025,0,1.19,.51,blackMetal,drawer);
  for(let i=0;i<3;i++)box(.045,.07,.015,-.071+i*.071,1.19,.53,material('#a29771'),drawer);
  if (!imageSurfaces) for(const x of [-.78,.78])for(const y of [.2,1.36])box(.15,.1,.018,x,y,.496,blackMetal,chest);
  // The collectible keeps a real silhouette, thickness and depth in both profiles.
  const keyItem = new THREE.Group(); drawer.add(keyItem); keyItem.visible = !keyTaken;
  keyItem.userData.inspect = 'pickup-key';
  const brass=material('#b59a58',{metalness:.65,roughness:.55});
  box(.34,.04,.22,-.06,1.08,-.16,material('#717d56'),keyItem);
  const keyRing=new THREE.Mesh(new THREE.TorusGeometry(.065,.013,6,12),brass);
  keyRing.rotation.x=Math.PI/2;keyRing.position.set(-.15,1.113,-.16);keyItem.add(keyRing);
  box(.16,.024,.026,-.035,1.113,-.16,brass,keyItem);
  box(.025,.024,.053,.025,1.113,-.14,brass,keyItem);
  box(.025,.024,.046,-.015,1.113,-.14,brass,keyItem);
  // Stacked books on the chest.
  for(let i=0;i<2;i++){box(.43,.055,.32,.4,1.55+i*.065,0,material(i?'#879275':'#a49c76'),chest);box(.38,.035,.325,.4,1.55+i*.065,-.005,material('#d4d0b3'),chest);}
  // Low table, tea tray and cushions.
  const table=new THREE.Group();room.add(table);clickable(table,'tea');
  flatShadow(-.35,.55,3.5,2.6,.43,.05);
  box(2.35,.13,1.48,-.35,.65,.55,timber,table);box(2.25,.045,1.39,-.35,.733,.55,paleTimber,table);
  for(const x of [-1.32,.62])for(const z of [-.02,1.11]){const leg=box(.13,.58,.14,x,.3,z,darkTimber,table);leg.rotation.z=x<0?-.055:.055;}
  for(const z of [-.08,1.18])box(2.13,.16,.055,-.35,.52,z,darkTimber,table);
  cylinder(.48,.48,.027,-.1,.78,.4,material('#6c5b3c'),table,40);
  const teaCeramic=material('#4d6052',{roughness:.53});
  sphere(.2,-.23,.975,.39,teaCeramic,table,1,.8,1);cylinder(.12,.15,.055,-.23,1.1,.39,teaCeramic,table);sphere(.035,-.23,1.146,.39,teaCeramic,table,1,.7,1);
  const spout=cylinder(.042,.08,.24,-.46,1.02,.39,teaCeramic,table);spout.rotation.z=.95;
  const teaHandle=new THREE.Mesh(new THREE.TorusGeometry(.16,.023,8,24,Math.PI),material('#726643'));teaHandle.position.set(-.22,1.17,.39);table.add(teaHandle);
  for(const [x,z] of [[.17,.58],[-.27,.8]]){cylinder(.08,.055,.09,x,.84,z,material('#dbd5b6'),table);cylinder(.064,.064,.004,x,.89,z,material('#6d6941'),table);cylinder(.12,.12,.012,x,.789,z,material('#a89c70'),table);}
  const note=box(.38,.006,.28,-1.08,.764,.66,material('#e7dfc3'),table);note.rotation.y=-.12;
  for(let i=0;i<4;i++)box(.18,.002,.005,-1.07,.769,.6+i*.033,material('#95937a'),table);
  const cushionMat=material('#7b8767');
  for(const [x,z,angle] of [[-1.1,2.0,-.09],[1.45,.7,.11]]){
    flatShadow(x,z,1.6,1.5,.21,.045);
    const cushion=new THREE.Mesh(new THREE.BoxGeometry(1.03,.15,.94,4,1,4),cushionMat);cushion.position.set(x,.13,z);cushion.rotation.y=angle;room.add(cushion);
    const top=box(.96,.025,.87,x,.218,z,material('#939c78'));top.rotation.y=angle;
    const stitch=line([[x-.39,.235,z-.32],[x+.39,.235,z-.32],[x+.39,.235,z+.32],[x-.39,.235,z+.32],[x-.39,.235,z-.32]],'#a9b28a');stitch.rotation.y=0;
  }
  // Paper floor lantern, warm emissive paper, and hand-built ribs.
  const lantern=new THREE.Group();room.add(lantern);clickable(lantern,'lantern');
  flatShadow(-3.55,-.85,1.4,1.4,.32,.045);
  cylinder(.35,.37,.1,-3.55,.1,-.85,darkTimber,lantern);
  const lanternPaper=material('#f5e4b1',{emissive:'#efb56b',emissiveIntensity:.35,roughness:1,...(imageSurfaces?{map:paperTexture}:{})});
  tagSurface(lanternPaper,'washi');
  cylinder(.29,.32,.87,-3.55,.59,-.85,lanternPaper,lantern,32);
  for(let i=0;i<14;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.305-i*.0015,.006,4,32),material('#b7a373'));ring.rotation.x=Math.PI/2;ring.position.set(-3.55,.18+i*.061,-.85);lantern.add(ring);}
  for(let i=0;i<4;i++){const a=i*Math.PI/2;box(.025,.94,.025,-3.55+Math.sin(a)*.28,.59,-.85,darkTimber,lantern);}
  cylinder(.3,.3,.035,-3.55,1.052,-.85,timber,lantern);
  // Soft contact occlusion at the wall and raised step.
  flatShadow(0,-2.85,9,1.2,.28,.041);flatShadow(-4.16,0,.8,6.1,.2,.042);

  // Complete the room around the player. Its rear and right walls stay physical.
  const southShell=new THREE.Group(),eastShell=new THREE.Group(),ceilingShell=new THREE.Group();room.add(southShell,eastShell,ceilingShell);
  box(9.15,3.65,.14,0,1.76,3.17,plaster,southShell);
  box(.14,3.65,6.35,4.53,1.76,0,plaster,eastShell);
  box(9.15,.12,6.35,0,3.64,0,plaster,ceilingShell);
  for(const x of [-4.43,4.43]){
    box(.16,3.66,.16,x,1.77,3.05,darkTimber,southShell);
    for(const y of [.1,2.92,3.5])box(.18,.12,6.3,x,y,0,timber,x<0?shoji:eastShell);
  }
  for(const y of [.1,2.92,3.5])box(9.05,.13,.18,0,y,3.04,timber,southShell);
  for(const x of [-1.45,1.5])box(.085,3.45,.12,x,1.77,3.06,paleTimber,southShell);
  const roundPaper=tagSurface(material('#f1e8ca',{map:paperTexture,emissive:'#c4cb9b',emissiveIntensity:.12}),'washi');
  const roundWindow=new THREE.Mesh(new THREE.CircleGeometry(.7,40),roundPaper);
  roundWindow.rotation.y=-Math.PI/2;roundWindow.position.set(4.44,1.98,.35);eastShell.add(roundWindow);
  const roundFrame=new THREE.Mesh(new THREE.TorusGeometry(.72,.035,6,40),darkTimber);
  roundFrame.rotation.y=Math.PI/2;roundFrame.position.copy(roundWindow.position);eastShell.add(roundFrame);
  // A landscape at the rear is a landmark when turning around, using the exit's image.
  box(1.8,1.05,.04,-1.05,1.95,3.05,darkTimber,southShell);
  box(1.65,.9,.02,-1.05,1.95,3.015,material('#e5ddc3',{map:landscape}),southShell);
  box(1.6,.64,.62,2.7,.35,2.7,timber);
  box(1.68,.06,.68,2.7,.7,2.7,paleTimber);
  for(const x of [2.32,3.08])box(.7,.48,.035,x,.35,2.375,timber);
  for(const x of [2.47,2.93])box(.035,.055,.03,x,.38,2.345,blackMetal);

  const inkMaterial=new THREE.MeshBasicMaterial({color:'#242b24',polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  function paintedQuad(points,parent){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,inkMaterial);parent.add(mesh);return mesh;}
  // Nine real paint fragments on shelf tops at three different heights form 三.
  const highShelf=new THREE.Group();room.add(highShelf);clickable(highShelf,'high-shelf');
  for(const x of [2.3,4.02])for(const z of [-.18,1.5])box(.055,2.82,.055,x,1.41,z,paleTimber,highShelf);
  for(const height of [2.05,2.38,2.7])box(.055,.045,1.72,4.02,height-.065,.66,paleTimber,highShelf);
  for(const fragment of inkFragments('pine')){
    const xs=fragment.points.map(p=>p[0]),zs=fragment.points.map(p=>p[2]),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
    box(Math.max(...xs)-Math.min(...xs)+.004,.025,Math.max(...zs)-Math.min(...zs)+.005,x,fragment.plane-.015,z,paleTimber,highShelf);
    // A thin bracket meets each board at its rear edge without covering another stroke.
    const rear=Math.min(...zs);
    box(4.02-x,.018,.018,(x+4.02)/2,fragment.plane-.035,rear,paleTimber,highShelf);
    paintedQuad(fragment.points.map(p=>[p[0],p[1]+.003,p[2]]),highShelf);
  }
  // A closed, roofed horizontal chamber: overhead views cannot see its inner strokes.
  const peepShelf=new THREE.Group();room.add(peepShelf);clickable(peepShelf,'peep-shelf');
  for(const x of [-3.31,-2.19])box(.08,.54,1.36,x,1.59,2.22,darkTimber,peepShelf);
  box(1.2,.05,1.36,-2.75,1.685,2.22,timber,peepShelf);
  box(1.2,.05,1.36,-2.75,1.475,2.22,timber,peepShelf);
  box(1.2,.5,.05,-2.75,1.59,2.89,plaster,peepShelf);
  box(1.2,.18,.08,-2.75,1.75,1.58,paleTimber,peepShelf);
  box(1.2,.18,.08,-2.75,1.4,1.58,paleTimber,peepShelf);
  for(const x of [-3.25,-2.25])for(const z of [1.7,2.7])box(.06,1.38,.06,x,.7,z,darkTimber,peepShelf);
  for(const fragment of inkFragments('bamboo'))paintedQuad(fragment.points,peepShelf);
  const standingMark=new THREE.Mesh(new THREE.RingGeometry(.23,.25,40),new THREE.MeshBasicMaterial({color:'#8b4f38',transparent:true,opacity:.58,side:THREE.DoubleSide}));standingMark.rotation.x=-Math.PI/2;standingMark.position.set(PEEP_EYE[0],.055,PEEP_EYE[2]);room.add(standingMark);
  // Pine gives a row; bamboo gives a column. The panel opens to a five-petal flower.
  const lattice=new THREE.Group();room.add(lattice);clickable(lattice,'lattice');
  box(1.18,1.08,.08,.46,2.3,-2.96,darkTimber,lattice);
  const flowerImage=texture((c,s)=>{c.fillStyle='#eee4c9';c.fillRect(0,0,s,s);c.strokeStyle='#343c2d';c.lineWidth=5;
    for(let i=0;i<5;i++){c.save();c.translate(s/2,s/2);c.rotate(i*Math.PI*2/5);c.beginPath();c.ellipse(0,-s*.21,s*.115,s*.19,0,0,Math.PI*2);c.stroke();c.restore();}
    c.beginPath();c.arc(s/2,s/2,s*.055,0,Math.PI*2);c.stroke();c.fillStyle='#8f4d39';c.font='25px serif';c.fillText('梅',s*.78,s*.9);},256);
  const flowerFace=new THREE.Mesh(new THREE.PlaneGeometry(.88,.84),material('#f2e9cf',{map:flowerImage}));flowerFace.position.set(.46,2.3,-2.91);lattice.add(flowerFace);
  const latticeCover=new THREE.Group();lattice.add(latticeCover);
  box(1.12,.98,.04,.46,2.3,-2.88,timber,latticeCover);
  const cellGeometry=new THREE.BoxGeometry(.26,.25,.045),cellMaterial=material('#b8ab83',{map:woodTexture});
  if(imageSurfaces){const tile=textureAtlas.tiles.wood,uv=cellGeometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,(tile.x+uv.getX(i)*tile.width)/textureAtlas.width,1-(tile.y+(1-uv.getY(i))*tile.height)/textureAtlas.height);uv.needsUpdate=true;}
  const latticeCells=new THREE.InstancedMesh(cellGeometry,cellMaterial,9);latticeCells.userData.inspect='lattice';latticeCells.userData.latticeCells=true;latticeCover.add(latticeCells);
  const cellMatrix=new THREE.Matrix4();for(let i=0;i<9;i++){cellMatrix.makeTranslation(.46+(i%3-1)*.31,2.3+(1-Math.floor(i/3))*.29,-2.835);latticeCells.setMatrixAt(i,cellMatrix);}
  const latticeLabels=texture((c,s)=>{c.clearRect(0,0,s,s);c.fillStyle='#303a29';c.font='34px serif';c.textAlign='center';c.fillText('竹 →',s/2,48);c.fillText('松',30,120);c.fillText('↓',30,165);},256);
  const labelMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.42),new THREE.MeshBasicMaterial({map:latticeLabels,transparent:true,depthWrite:false}));labelMesh.position.set(.46,2.36,-2.80);latticeCover.add(labelMesh);
  labelMesh.raycast=()=>{};

  // Spread the existing chain across a connected wing. Keep only one area active.
  // Detached source pieces are retained only for resource disposal at area changes.
  const detached=[];
  let shells={north:northShell,south:southShell,east:eastShell,west:shoji,ceiling:ceilingShell};
  function inscription(text,w,h,parent,x,y,z,rotation=0){
    const map=texture((c,s)=>{c.fillStyle='#e7dfc7';c.fillRect(0,0,s,s);c.fillStyle='#3c4635';c.textAlign='center';c.textBaseline='middle';c.font='62px serif';c.fillText(text,s/2,s/2,s-30);},256);
    const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material('#eee5ce',{map}));face.position.set(x,y,z);face.rotation.y=rotation;parent.add(face);return face;
  }
  function passageFace(p,parent){
    const group=new THREE.Group();parent.add(group);clickable(group,`passage:${p.to}`);
    const [x,y,z]=p.point,rotation=p.side==='west'?Math.PI/2:p.side==='east'?-Math.PI/2:p.side==='south'?Math.PI:0;
    group.position.set(x,y,z);group.rotation.y=rotation;
    box(1.4,2.7,.08,0,-.1,0,darkTimber,group);box(1.25,2.5,.04,0,-.1,.055,plaster,group);
    for(const px of [-.62,.62])box(.05,2.55,.05,px,-.1,.085,paleTimber,group);
    box(.06,.09,.035,.4,-.2,.1,blackMetal,group);
    inscription(p.label.replace('へ',''),.87,.32,group,0,.8,.085);
    // A low sill makes the travel threshold readable from the walking view.
    box(1.45,.05,.24,0,-1.43,.12,paleTimber,group);
    return group;
  }
  if(location==='parlor'){
    for(const object of [chest,highShelf,peepShelf,standingMark,exitGlow]){room.remove(object);detached.push(object);}
    door.userData.inspect='passage:hall';
    inscription('表廊下',.9,.3,door,3.04,2.5,-2.93);
  }else{
    const keep=location==='study'?[chest,highShelf]:[peepShelf,standingMark];
    for(const object of [...room.children])if(!keep.includes(object)){room.remove(object);detached.push(object);}
    shells={};for(const side of ['north','south','east','west','ceiling']){shells[side]=new THREE.Group();room.add(shells[side]);}
    const half=location==='hall'?1.7:4.53,width=half*2;
    box(width+.1,.25,6.45,0,-.19,0,darkTimber);
    if(location==='hall'){
      for(let n=0;n<12;n++)box(width-.12,.08,.505,0,-.015,-2.8+n*.51,timber);
      scene.background.set('#b8bca4');sunlight.intensity=2.2;
      // The closed peep chamber lives at the end of the timber corridor.
      peepShelf.position.x=2.75;standingMark.position.x+=2.75;
      const mount=new THREE.Group();mount.position.x=-3.04;shells.north.add(mount);mount.add(door,exitGlow);
      door.userData.inspect='door';
      inscription('玄関',.8,.27,mount,3.04,2.95,-2.94);
    }else{
      for(let row=0;row<2;row++)for(let col=0;col<3;col++)surfaceBox(2.91,.09,2.98,-2.96+col*2.96,-.03,-1.52+row*3.03,(row+col)%2?tatamiAlt:tatami,2);
      // A quiet writing desk is the room's landmark; it is not another lock.
      const desk=new THREE.Group();room.add(desk);clickable(desk,'study-desk');
      box(2.05,.1,1.1,-2.8,.71,-.4,timber,desk);
      for(const x of [-3.65,-1.95])for(const z of [-.83,.03])box(.1,.68,.1,x,.34,z,darkTimber,desk);
      box(.75,.01,.55,-2.95,.77,-.4,plaster,desk);
      for(let i=0;i<3;i++)box(.055,.006,.28,-3.1+i*.14,.78,-.4,inkMaterial,desk);
      box(.22,.03,.18,-2.17,.79,-.5,blackMetal,desk);
      inscription('松',.3,.45,highShelf,3.95,1.7,.05);
      inscription('松　竹　梅',1.15,.23,chest,0,1.65,-.08);
    }
    box(width,3.65,.14,0,1.76,-3.17,plaster,shells.north);
    box(width,3.65,.14,0,1.76,3.17,plaster,shells.south);
    box(.14,3.65,6.35,half,1.76,0,plaster,shells.east);
    box(.14,3.65,6.35,-half,1.76,0,plaster,shells.west);
    box(width,.12,6.35,0,3.64,0,darkTimber,shells.ceiling);
    for(const [side,z] of [['north',-3.05],['south',3.05]])for(const y of [.08,2.92,3.5])box(width,.13,.18,0,y,z,timber,shells[side]);
    for(const [side,x] of [['west',-half+.1],['east',half-.1]]){
      for(const y of [.08,2.92,3.5])box(.17,.13,6.3,x,y,0,timber,shells[side]);
      for(const z of [-3.05,3.05])box(.15,3.6,.15,x,1.75,z,darkTimber,shells[side]);
    }
    if(location==='study'){
      // Shared small paper texture gives the study a different, broad window.
      box(.05,1.95,2.65,-4.43,2,-1.1,washiMaterial,shells.west);
      for(const z of [-2.42,-1.54,-.66,.22])box(.06,2.02,.045,-4.37,2,z,paleTimber,shells.west);
      box(.07,.05,2.72,-4.36,2,-1.1,paleTimber,shells.west);
    }
    for(const p of area.passages)passageFace(p,shells[p.side]);
  }

  // Batch static pieces sharing a material; moving and clickable groups keep their identity.
  // In particular, all 324 woven border stitches become a single draw call.
  function batchStatic(parent){
    const batches=new Map();
    const addToBatch=mesh=>{
      const mat=mesh.material,tile=textureAtlas.tiles[mat.userData.atlasTile];
      if(imageSurfaces&&tile){
        const uv=mesh.geometry.getAttribute('uv');
        for(let i=0;i<uv.count;i++)uv.setXY(i,(tile.x+uv.getX(i)*tile.width)/textureAtlas.width,1-(tile.y+(1-uv.getY(i))*tile.height)/textureAtlas.height);
        uv.needsUpdate=true;
        if(mat.emissive.getHex()===0&&mat.metalness===0&&mat.roughness===.93){
          const colors=new Float32Array(mesh.geometry.getAttribute('position').count*3);
          for(let i=0;i<colors.length;i+=3){colors[i]=mat.color.r;colors[i+1]=mat.color.g;colors[i+2]=mat.color.b;}
          mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));mesh.material=sharedAtlasMaterial;
        }
      }
      if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(mesh);
    };
    for(const child of [...parent.children]){
      if(child.isGroup)batchStatic(child);
      if(!child.isMesh||child.isInstancedMesh||child===exitGlow)continue;
      // Split box faces by material, then merge their shared finishes as well.
      // A six-sided textured box must not cost six calls per piece of furniture.
      if(Array.isArray(child.material)){
        child.updateMatrix();
        const source=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();source.applyMatrix4(child.matrix);
        for(const group of child.geometry.groups){
          const geometry=new THREE.BufferGeometry();
          for(const name of ['position','normal','uv']){
            const attr=source.getAttribute(name);
            geometry.setAttribute(name,new THREE.BufferAttribute(attr.array.slice(group.start*attr.itemSize,(group.start+group.count)*attr.itemSize),attr.itemSize));
          }
          const part=new THREE.Mesh(geometry,child.material[group.materialIndex]);parent.add(part);addToBatch(part);
        }
        source.dispose();parent.remove(child);child.geometry.dispose();
      }else addToBatch(child);
    }
    for(const [mat,meshes] of batches){
      if(meshes.length<2)continue;
      const attributes={position:[],normal:[],uv:[],...(meshes[0].geometry.hasAttribute('color')?{color:[]}: {})};
      for(const mesh of meshes){
        mesh.updateMatrix();
        const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);
        for(const name of Object.keys(attributes))attributes[name].push(geometry.getAttribute(name).array);
        geometry.dispose();parent.remove(mesh);mesh.geometry.dispose();
      }
      const geometry=new THREE.BufferGeometry();
      for(const [name,arrays] of Object.entries(attributes)){
        const merged=new Float32Array(arrays.reduce((sum,array)=>sum+array.length,0));let offset=0;
        for(const array of arrays){merged.set(array,offset);offset+=array.length;}
        geometry.setAttribute(name,new THREE.BufferAttribute(merged,name==='uv'?2:3));
      }
      geometry.computeBoundingSphere();parent.add(new THREE.Mesh(geometry,mat));
    }
  }
  batchStatic(room);

  const hotspotSpecs=[['scroll','掛け軸を調べる',[-2.55,1.85,-2.86]],['chest','箪笥を調べる',[.46,1.15,-1.82]],['door','玄関の襖を調べる',[0,1.5,-2.8]],['tea','卓上を調べる',[-.45,.98,.7]],['high-shelf','高い飾り棚を調べる',[3.1,2.42,.6]],['peep-shelf','覗き棚を調べる',[0,1.65,2.05]],['lattice','梅の格子を調べる',[.46,2.3,-2.78]],['study-desk','文机を調べる',[-2.8,.9,-.4]],...area.passages.map(p=>[`passage:${p.to}`,p.label,p.point])].filter(([id])=>hasObject(location,id));
  const hotContainer=document.querySelector('#hotspots');
  hotContainer.replaceChildren();
  const hotspots=hotspotSpecs.map(([id,label,pos])=>{
    const button=document.createElement('button');button.className=id.startsWith('passage:')?'hotspot passage-hotspot':'hotspot';button.dataset.inspect=id;button.setAttribute('aria-label',label);button.innerHTML=`<span class="hotspot-label">${label.replace('を調べる','')}</span>`;button.addEventListener('click',e=>{if(e.detail===0)onInspect(id);});hotContainer.appendChild(button);
    return {button,position:new THREE.Vector3(...pos)};
  });
  hotContainer.hidden=!markers;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const gesture=createGesture(),surface=container.parentElement;
  const controls=new AbortController(),listen={signal:controls.signal};
  surface.addEventListener('contextmenu',e=>e.preventDefault(),listen);
  surface.addEventListener('pointerdown',e=>{
    if(e.button!==0||(!e.target.closest('#scene')&&!e.target.closest('.hotspot')))return;
    gesture.down(e.pointerId,e.clientX,e.clientY,e.target.closest('[data-inspect]')?.dataset.inspect);
    viewPointers.add(e.pointerId);paused=false;
    if(viewPointers.size===1)navAnchor={id:e.pointerId,x:e.clientX,y:e.clientY};
    else{navAnchor=null;navTurn=navForward=0;}
    surface.setPointerCapture(e.pointerId);e.preventDefault();
  },listen);
  surface.addEventListener('pointermove',e=>{
    const action=gesture.move(e.pointerId,e.clientX,e.clientY);if(!action)return;
    cancelApproach();
    if(action.zoom){navTurn=navForward=0;if(mode==='god')wantedGodZoom=clampZoom(wantedGodZoom*action.zoom);else wantedZoom=clampZoom(wantedZoom*action.zoom);}
    else if(mode==='god'){wantedGodYaw-=action.dx*.004;wantedGodPitch=THREE.MathUtils.clamp(wantedGodPitch+action.dy*.002,.1,1.4);}
    else if(navAnchor?.id===e.pointerId&&viewPointers.size===1){navTurn=THREE.MathUtils.clamp((e.clientX-navAnchor.x)/65,-1,1);navForward=THREE.MathUtils.clamp((navAnchor.y-e.clientY)/65,-1,1);}
    updateIndicator();requestRender();
  },listen);
  surface.addEventListener('pointerup',e=>{
    releasePointer(e.pointerId);const tap=gesture.up(e.pointerId);if(!tap)return;
    if(tap.hit){onInspect(tap.hit);return;}
    const r=container.getBoundingClientRect();pointer.set((tap.x-r.left)/r.width*2-1,-(tap.y-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(room,true).find(hit=>visible(hit.object));
    if(hit){if(hit.object.userData.latticeCells){onInspect(`lattice-${hit.instanceId}`);return;}let obj=hit.object;while(obj&&!obj.userData.inspect)obj=obj.parent;if(obj)onInspect(obj.userData.inspect);}
  },listen);
  function releasePointer(id){viewPointers.delete(id);if(navAnchor?.id===id)navAnchor=null;navTurn=navForward=0;}
  surface.addEventListener('pointercancel',()=>{gesture.cancel();viewPointers.clear();navAnchor=null;navTurn=navForward=0;},listen);
  surface.addEventListener('lostpointercapture',e=>{releasePointer(e.pointerId);gesture.up(e.pointerId);},listen);
  surface.addEventListener('wheel',e=>{e.preventDefault();const factor=Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002);if(mode==='god')wantedGodZoom=clampZoom(wantedGodZoom*factor);else wantedZoom=clampZoom(wantedZoom*factor);requestRender();},{...listen,passive:false});

  function visible(object){while(object){if(!object.visible)return false;object=object.parent;}return true;}
  function cancelApproach(){if(approach){const resolve=approach.resolve;approach=null;resolve(false);}}
  function aimAt(point){const dx=point.x-player.x,dz=point.z-player.z;wantedYaw=Math.atan2(dx,-dz);wantedPitch=Math.atan2(point.y-player.y,Math.hypot(dx,dz));}
  function render(now=performance.now()){
    frame=0;
    const dt=Math.min(.05,Math.max(.001,(now-(lastFrame||now-16))/1000));lastFrame=now;
    if(!paused&&approach?.path){
      let budget=2.6*dt;
      while(budget>0&&approach.path.length){const next=approach.path[0],dx=next.x-player.x,dz=next.z-player.z,d=Math.hypot(dx,dz),step=Math.min(d,budget);
        if(d<.005){approach.path.shift();continue;}
        const p=moveBy(player,dx/d*step,dz/d*step);player.x=p.x;player.z=p.z;budget-=step;
        if(step===d)approach.path.shift();
      }
      aimAt(approach.target);
    }else if(!paused&&mode==='walk'&&(movement.side||movement.forward||navForward||navTurn)){
      wantedYaw+=navTurn*1.5*dt;
      const p=walkStep(player,movement.side,movement.forward+navForward,yaw,dt);player.x=p.x;player.z=p.z;
    }
    const ease=1-Math.exp(-14*dt);
    yaw+=angleDelta(wantedYaw,yaw)*ease;pitch=THREE.MathUtils.lerp(pitch,wantedPitch,ease);zoom=THREE.MathUtils.lerp(zoom,wantedZoom,ease);
    godYaw+=angleDelta(wantedGodYaw,godYaw)*ease;godPitch=THREE.MathUtils.lerp(godPitch,wantedGodPitch,ease);godZoom=THREE.MathUtils.lerp(godZoom,wantedGodZoom,ease);godTarget.lerp(wantedGodTarget,ease);
    drawerOpen=THREE.MathUtils.lerp(drawerOpen,drawerTarget,.09);doorOpen=THREE.MathUtils.lerp(doorOpen,doorTarget,.045);
    flowerOpen=THREE.MathUtils.lerp(flowerOpen,flowerTarget,.1);latticeCover.position.y=flowerOpen*.94;
    drawer.position.z=drawerOpen;door.position.x=-doorOpen*1.23;exitGlow.visible=doorOpen>.01;
    if(mode==='walk'){camera.position.copy(player);camera.lookAt(player.x+Math.sin(yaw)*Math.cos(pitch),player.y+Math.sin(pitch),player.z-Math.cos(yaw)*Math.cos(pitch));}
    else{camera.position.set(godTarget.x+Math.sin(godYaw)*orbitDistance*godZoom,godTarget.y+Math.sin(godPitch)*orbitDistance*godZoom,godTarget.z+Math.cos(godYaw)*Math.cos(godPitch)*orbitDistance*godZoom);camera.lookAt(godTarget);}
    const inside=mode==='walk';shells.north.visible=inside||Math.cos(godYaw)>=0;shells.south.visible=inside||Math.cos(godYaw)<=0;shells.east.visible=inside||Math.sin(godYaw)<=0;shells.west.visible=inside||Math.sin(godYaw)>=0;shells.ceiling.visible=inside;
    if(location==='parlor')for(const object of [scroll,door,alcove,lattice])object.visible=shells.north.visible;
    const fov=inside?THREE.MathUtils.clamp(baseFov*zoom,30,85):(camera.aspect<1?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(41/2))/camera.aspect)):39);
    if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}camera.updateMatrixWorld();
    container.dataset.area=location;container.dataset.viewMode=mode;container.dataset.position=`${player.x.toFixed(3)},${player.z.toFixed(3)}`;container.dataset.heading=(inside?yaw:godYaw).toFixed(3);
    const beforeRender=performance.now();renderer.render(scene,camera);lastRenderMs=performance.now()-beforeRender;
    const direction=camera.getWorldDirection(new THREE.Vector3());
    const observationPosition=camera.position.toArray();if(location==='hall')observationPosition[0]-=2.75;
    let observation=alignedObservation(observationPosition,direction.toArray());
    if((observation==='pine'&&location!=='study')||(observation==='bamboo'&&location!=='hall'))observation=null;
    if(!observation&&location==='parlor'&&flowerOpen>.99){const toFlower=new THREE.Vector3(.46,2.3,-2.91).sub(camera.position);if(toFlower.length()<8.5&&direction.dot(toFlower.normalize())>.98){raycaster.set(camera.position,toFlower);const hit=raycaster.intersectObject(room,true).find(hit=>visible(hit.object));if(hit?.object===flowerFace)observation='plum';}}
    container.dataset.observation=observation||'';
    if(observation!==lastObservation){lastObservation=observation;onObservation(observation);}
    const w=container.clientWidth,h=container.clientHeight;
    for(const item of hotspots){
      if(item.button.dataset.inspect==='chest')item.position.z=-1.82+drawerOpen;
      const p=item.position.clone().project(camera);let show=p.z>-1&&p.z<1&&p.x>-.94&&p.x<.94&&p.y>-.86&&p.y<.78;
      if(['scroll','door','lattice'].includes(item.button.dataset.inspect)&&!shells.north.visible)show=false;
      if(item.button.dataset.inspect==='lattice')item.button.setAttribute('aria-label',flowerOpen>.99?'梅の花紋を調べる':'梅の格子を調べる');
      if(show&&!hotContainer.hidden){
        const direction=item.position.clone().sub(camera.position),length=direction.length();raycaster.set(camera.position,direction.normalize());
        const hit=raycaster.intersectObject(room,true).find(hit=>visible(hit.object));
        let ownSurface=false;for(let object=hit?.object;object;object=object.parent)if(object.userData.inspect===item.button.dataset.inspect)ownSurface=true;
        if(hit&&!ownSurface&&hit.distance<length-.18)show=false;
      }
      item.button.style.left=`${(p.x*.5+.5)*w}px`;item.button.style.top=`${(-p.y*.5+.5)*h}px`;item.button.style.visibility=show?'visible':'hidden';
    }
    if(approach&&(approach.path?!approach.path.length&&Math.abs(angleDelta(wantedYaw,yaw))<.015&&Math.abs(pitch-wantedPitch)<.015:godTarget.distanceTo(wantedGodTarget)<.01&&Math.abs(godZoom-wantedGodZoom)<.005&&Math.abs(angleDelta(wantedGodYaw,godYaw))<.015)){const resolve=approach.resolve;approach=null;resolve(true);}
    if(doorResolve&&doorOpen>.98){const resolve=doorResolve;doorResolve=null;resolve(true);}
    // Crossing an actual doorway while walking changes area; never fire on restore.
    if(inside&&!paused&&!crossing&&(movement.side||movement.forward||navForward||approach?.path)){
      const next=passageAt(location,player);if(next){crossing=true;onTravel(next);}
    }
    updateIndicator();
    if((!paused&&(approach||movement.side||movement.forward||navForward||navTurn))||Math.abs(angleDelta(wantedYaw,yaw))>.0002||Math.abs(pitch-wantedPitch)>.0002||Math.abs(zoom-wantedZoom)>.0002||Math.abs(angleDelta(wantedGodYaw,godYaw))>.0002||Math.abs(godPitch-wantedGodPitch)>.0002||Math.abs(godZoom-wantedGodZoom)>.0002||godTarget.distanceTo(wantedGodTarget)>.001||Math.abs(drawerOpen-drawerTarget)>.001||Math.abs(doorOpen-doorTarget)>.001||Math.abs(flowerOpen-flowerTarget)>.001)requestRender();
  }
  function requestRender(){if(!disposed&&!frame)frame=requestAnimationFrame(render);}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;
    baseFov=w/h<1?70:64;camera.fov=THREE.MathUtils.clamp(baseFov*zoom,30,85);
    orbitDistance=w/h<1?15.3:10.8*Math.max(1,1.6/(w/h));
    camera.updateProjectionMatrix();requestRender();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  if(view?.position)restoreView(view);
  function restoreView(view){mode=view.mode==='walk'?'walk':'god';yaw=wantedYaw=view.yaw;pitch=wantedPitch=view.pitch;zoom=wantedZoom=view.zoom??1;if(view.position&&canStand({x:view.position[0],z:view.position[2]}))player.fromArray(view.position);if(view.orbit){godYaw=wantedGodYaw=view.orbit.yaw;godPitch=wantedGodPitch=view.orbit.pitch;godZoom=wantedGodZoom=view.orbit.zoom;godTarget.fromArray(view.orbit.target);wantedGodTarget.copy(godTarget);}updateIndicator();}
  const ready=Promise.all(assetLoads).then(()=>{
    if(disposed)return;
    requestRender();document.querySelector('#loading').classList.add('hidden');document.querySelector('#loading').setAttribute('aria-hidden','true');
    if(assetErrors.length)document.querySelector('#scene-message').textContent='一部の素材画像を読み込めませんでした。再読み込みしてください。';
  });
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!disposed)document.querySelector('#scene-message').textContent='描画が中断されました。ページを再読み込みしてください。';});
  return {
    ready,
    look(direction){cancelApproach();if(mode==='walk')wantedYaw+=direction*Math.PI/4;else wantedGodYaw+=direction*Math.PI/4;requestRender();},
    setMovement(side,forward){if(side||forward)cancelApproach();movement={side,forward};paused=false;requestRender();},
    pauseMotion(){movement={side:0,forward:0};navTurn=navForward=0;navAnchor=null;viewPointers.clear();gesture.cancel();cancelApproach();paused=true;},
    setMode(value){this.pauseMotion();mode=value==='walk'?'walk':'god';paused=false;requestRender();},
    zoomBy(factor){if(mode==='god')wantedGodZoom=clampZoom(wantedGodZoom*factor);else wantedZoom=clampZoom(wantedZoom*factor);requestRender();},
    frontView(){cancelApproach();if(mode==='walk'){wantedYaw=0;wantedPitch=0;wantedZoom=1;}else{wantedGodYaw=0;wantedGodPitch=.12;}requestRender();},
    overheadView(){cancelApproach();wantedGodYaw=0;wantedGodPitch=GOD_PITCH;requestRender();},
    focus(id){
      if(!hasObject(location,id))return Promise.resolve(false);
      const poses={scroll:[-2.55,-1.35,-2.55,1.8,-2.9],chest:[.46,-.85,.46,1.12,-1.95],door:[0,-1.7,0,1.45,-2.93],tea:[-.35,1.85,-.35,.85,.55],lantern:[-2.7,-.85,-3.55,.6,-.85],window:[-3.4,.4,-4.3,1.7,.4],'pickup-key':[.46,-.85,.46,1.12,-1.8],'high-shelf':[1.8,.65,...GOD_TARGET],'peep-shelf':[0,PEEP_EYE[2],0,PEEP_TARGET[1],PEEP_TARGET[2]],lattice:[.46,-.85,.46,2.3,-2.89],'study-desk':[-2.8,1,-2.8,.85,-.4],...Object.fromEntries(area.passages.map(p=>[`passage:${p.to}`,[...p.stand,...p.point]]))};
      cancelApproach();movement={side:0,forward:0};const pose=poses[id];if(!pose)return Promise.resolve(true);
      if(mode==='god'){wantedGodTarget.set(...pose.slice(2));wantedGodYaw=id==='window'?Math.PI/2:0;wantedGodPitch=['chest','pickup-key','high-shelf'].includes(id)?.3:.12;wantedGodZoom=id==='high-shelf'?GOD_DISTANCE/orbitDistance:.42;paused=false;requestRender();return new Promise(resolve=>{approach={resolve};});}
      const path=findPath(player,{x:pose[0],z:pose[1]});if(!path)return Promise.resolve(false);
      paused=false;wantedZoom=1;requestRender();return new Promise(resolve=>{approach={path,target:new THREE.Vector3(...pose.slice(2)),resolve};});
    },
    resetView(){this.pauseMotion();player.set(START.x,1.58,START.z);wantedYaw=-.22;wantedPitch=-.06;wantedZoom=1;wantedGodTarget.set(0,1.15,-.4);wantedGodYaw=.48;wantedGodPitch=.37;wantedGodZoom=1;requestRender();},
    openDrawer(){drawerTarget=.65;requestRender();},
    revealFlower(){flowerTarget=1;requestRender();},
    openDoor(){doorTarget=1;requestRender();return new Promise(resolve=>{if(doorOpen>.98)resolve(true);else doorResolve=resolve;});},
    takeKey(){keyItem.visible=false;requestRender();},
    restart(){doorResolve?.(false);doorResolve=null;drawerTarget=0;doorTarget=0;flowerTarget=0;keyItem.visible=true;this.resetView();},
    setMarkers(value){hotContainer.hidden=!value;},
    setQuality(value){renderer.setPixelRatio(Math.min(devicePixelRatio||1,value));resize();},
    getView(){return {mode,yaw:wantedYaw,pitch:wantedPitch,zoom:wantedZoom,position:player.toArray(),orbit:{yaw:wantedGodYaw,pitch:wantedGodPitch,zoom:wantedGodZoom,target:wantedGodTarget.toArray()}};},
    getInfo(){
      const maps=new Set();scene.traverse(obj=>{for(const mat of [obj.material].flat()){if(mat?.map)maps.add(mat.map);}});
      let textureBytes=0;for(const map of maps){const image=map.image;if(image)textureBytes+=image.width*image.height*4*(map.generateMipmaps?4/3:1);}
      return {mode:surfaceMode,triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,textures:renderer.info.memory.textures,textureBytes:Math.round(textureBytes),pixelRatio:renderer.getPixelRatio(),width:container.clientWidth,height:container.clientHeight,assetErrors:[...assetErrors],cpuMs:lastRenderMs};
    },
    async measure(){
      await ready;
      if(disposed)throw new Error('Room was disposed during comparison');
      const previous=this.getView();
      cancelAnimationFrame(frame);frame=0;drawerOpen=drawerTarget;doorOpen=doorTarget;
      const samples=[];
      for(let i=0;i<60;i++)await new Promise(resolve=>requestAnimationFrame(()=>{
        if(disposed){resolve();return;}
        mode='walk';player.set(START.x,1.58,START.z);yaw=wantedYaw=-.55+i/59*.7;pitch=wantedPitch=-.06;zoom=wantedZoom=1;render();
        if(i>=12)samples.push(lastRenderMs);resolve();
      }));
      if(disposed)throw new Error('Room was disposed during comparison');
      samples.sort((a,b)=>a-b);
      const result={...this.getInfo(),cpuMedianMs:samples[Math.floor(samples.length/2)],cpuP95Ms:samples[Math.floor(samples.length*.95)],samples:samples.length};
      restoreView(previous);requestRender();return result;
    },
    dispose(){
      disposed=true;cancelApproach();doorResolve?.(false);controls.abort();cancelAnimationFrame(frame);observer.disconnect();
      const geometries=new Set(),materials=new Set(),maps=new Set(textureCache.values());
      for(const root of [scene,...detached])root.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const mat of [obj.material].flat()){if(mat){materials.add(mat);if(mat.map)maps.add(mat.map);}}});
      geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());maps.forEach(map=>map.dispose());
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();hotspots.forEach(item=>item.button.remove());
    }
  };
  function updateIndicator(){const heading=mode==='walk'?wantedYaw:wantedGodYaw;const index=((Math.round(heading/(Math.PI/2))%4)+4)%4;document.querySelector('#view-angle').textContent=['正面','右側','背面','左側'][index];}
}
