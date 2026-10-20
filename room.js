import * as THREE from './vendor/three.module.min.js';
import { textureAtlas } from './assets/textures/atlas-layout.js';
import { createGesture, clampZoom } from './interaction.js';

export function createRoom(container, { onInspect, solved = false, keyTaken = false, escaped = false, quality = 1.5, markers = true, surfaceMode = 'images', view = null }) {
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
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 70);
  const target = new THREE.Vector3(0, 1.15, -.4);
  const wantedTarget = target.clone();
  let zoom = 1, wantedZoom = 1, doorResolve = null;
  let yaw = 0, wantedYaw = 0, pitch = .12, wantedPitch = .12, distance = 10.8;
  let frame = 0, drawerOpen = solved ? .65 : 0, doorOpen = escaped ? 1 : 0, drawerTarget = drawerOpen, doorTarget = doorOpen;
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
  box(9.15,3.65,.14,0,1.76,-3.17,plaster);
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
    c.font='38px serif';c.lineWidth=2.5;c.strokeStyle='#383d30';
    const paths=['M22 41V19M10 21l12-14 12 14M5 31l17-17 17 17M4 40l18-17 18 17','M22 43V5M17 14h10M17 27h10M22 21Q8 7 5 16q7 11 17 5M22 32q14-17 17-9-3 11-17 9','M22 18c-10-17-24 1-11 9-10 15 11 23 13 8 17 8 23-15 8-16 2-15-19-18-10-1Z'];
    ['松','竹','梅'].forEach((label,i)=>{const x=145+i*110;c.fillText(label,x,90);for(let j=0;j<[3,1,5][i];j++){c.save();c.translate(x-23,110+j*57);c.stroke(new Path2D(paths[i]));if(i===2){c.beginPath();c.arc(23,26,3,0,Math.PI*2);c.stroke();}c.restore();}});
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

  const hotspotSpecs=[['scroll','掛け軸を調べる',[-2.55,1.85,-2.86]],['chest','箪笥を調べる',[.46,1.15,-1.82]],['door','襖を調べる',[3.18,1.5,-2.8]],['tea','卓上を調べる',[-.45,.98,.7]]];
  const hotContainer=document.querySelector('#hotspots');
  hotContainer.replaceChildren();
  const hotspots=hotspotSpecs.map(([id,label,pos])=>{
    const button=document.createElement('button');button.className='hotspot';button.dataset.inspect=id;button.setAttribute('aria-label',label);button.innerHTML=`<span class="hotspot-label">${label.replace('を調べる','')}</span>`;button.addEventListener('click',e=>{if(e.detail===0)onInspect(id);});hotContainer.appendChild(button);
    return {button,position:new THREE.Vector3(...pos)};
  });
  hotContainer.hidden=!markers;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const gesture=createGesture(),surface=container.parentElement;
  const controls=new AbortController(),listen={signal:controls.signal};
  surface.addEventListener('pointerdown',e=>{
    if(e.button!==0||(!e.target.closest('#scene')&&!e.target.closest('.hotspot')))return;
    gesture.down(e.pointerId,e.clientX,e.clientY,e.target.closest('[data-inspect]')?.dataset.inspect);
    surface.setPointerCapture(e.pointerId);e.preventDefault();
  },listen);
  surface.addEventListener('pointermove',e=>{
    const action=gesture.move(e.pointerId,e.clientX,e.clientY);if(!action)return;
    if(action.zoom)wantedZoom=clampZoom(wantedZoom*action.zoom);
    else {wantedYaw=THREE.MathUtils.clamp(wantedYaw-action.dx*.004,-1.1,1.1);wantedPitch=THREE.MathUtils.clamp(wantedPitch+action.dy*.002,.06,.8);}
    updateIndicator();requestRender();
  },listen);
  surface.addEventListener('pointerup',e=>{
    const tap=gesture.up(e.pointerId);if(!tap)return;
    if(tap.hit){onInspect(tap.hit);return;}
    const r=container.getBoundingClientRect();pointer.set((tap.x-r.left)/r.width*2-1,-(tap.y-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(pickables,true).filter(hit=>{let object=hit.object;while(object){if(!object.visible)return false;object=object.parent;}return true;});
    if(hits.length){let obj=hits[0].object;while(obj&&!obj.userData.inspect)obj=obj.parent;if(obj)onInspect(obj.userData.inspect);}
  },listen);
  surface.addEventListener('pointercancel',()=>gesture.cancel(),listen);
  surface.addEventListener('lostpointercapture',e=>{gesture.up(e.pointerId);},listen);
  surface.addEventListener('wheel',e=>{e.preventDefault();wantedZoom=clampZoom(wantedZoom*Math.exp(Math.max(-100,Math.min(100,e.deltaY))*.002));requestRender();},{...listen,passive:false});

  function render(){
    frame=0;
    yaw=THREE.MathUtils.lerp(yaw,wantedYaw,.13);pitch=THREE.MathUtils.lerp(pitch,wantedPitch,.13);
    target.lerp(wantedTarget,.13);zoom=THREE.MathUtils.lerp(zoom,wantedZoom,.13);
    drawerOpen=THREE.MathUtils.lerp(drawerOpen,drawerTarget,.09);doorOpen=THREE.MathUtils.lerp(doorOpen,doorTarget,.045);
    drawer.position.z=drawerOpen;door.position.x=-doorOpen*1.23;exitGlow.visible=doorOpen>.01;
    camera.position.set(target.x+Math.sin(yaw)*distance*zoom,Math.sin(pitch)*distance*zoom+target.y,target.z+Math.cos(yaw)*Math.cos(pitch)*distance*zoom);camera.lookAt(target);camera.updateMatrixWorld();
    const beforeRender=performance.now();renderer.render(scene,camera);lastRenderMs=performance.now()-beforeRender;
    const w=container.clientWidth,h=container.clientHeight;
    for(const item of hotspots){const p=item.position.clone().project(camera);item.button.style.left=`${(p.x*.5+.5)*w}px`;item.button.style.top=`${(-p.y*.5+.5)*h}px`;item.button.style.visibility=p.z<1&&p.x>-.95&&p.x<.95&&p.y>-.85&&p.y<.75?'visible':'hidden';}
    if(doorResolve&&doorOpen>.98){const resolve=doorResolve;doorResolve=null;resolve(true);}
    if(Math.abs(yaw-wantedYaw)>.0002||Math.abs(pitch-wantedPitch)>.0002||Math.abs(zoom-wantedZoom)>.0002||target.distanceTo(wantedTarget)>.001||Math.abs(drawerOpen-drawerTarget)>.001||Math.abs(doorOpen-doorTarget)>.001)requestRender();
  }
  function requestRender(){if(!disposed&&!frame)frame=requestAnimationFrame(render);}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;
    camera.fov=w/h<1?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(41/2))/(w/h))):39;
    distance=w/h<1?15.3:10.8*Math.max(1,1.6/(w/h));
    camera.updateProjectionMatrix();requestRender();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  if (view) { yaw=wantedYaw=view.yaw; pitch=wantedPitch=view.pitch;zoom=wantedZoom=view.zoom??1;if(view.target){target.fromArray(view.target);wantedTarget.copy(target);}updateIndicator(); }
  const ready=Promise.all(assetLoads).then(()=>{
    if(disposed)return;
    requestRender();document.querySelector('#loading').classList.add('hidden');document.querySelector('#loading').setAttribute('aria-hidden','true');
    if(assetErrors.length)document.querySelector('#scene-message').textContent='一部の素材画像を読み込めませんでした。再読み込みしてください。';
  });
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!disposed)document.querySelector('#scene-message').textContent='描画が中断されました。ページを再読み込みしてください。';});
  return {
    ready,
    look(direction){wantedYaw=THREE.MathUtils.clamp(wantedYaw+direction*.25,-1.1,1.1);updateIndicator();requestRender();},
    zoomBy(factor){wantedZoom=clampZoom(wantedZoom*factor);requestRender();},
    frontView(){wantedYaw=0;wantedPitch=0;wantedTarget.set(0,1.5,-.4);wantedZoom=1;updateIndicator();requestRender();},
    focus(id){const points={scroll:[-2.55,1.85,-2.7],chest:[.46,.95,-2],door:[3,1.5,-2.7],tea:[-.4,.85,.7],lantern:[-3.55,.6,-.85],window:[-3.9,1.6,0],'pickup-key':[.46,1.05,-1.7]};if(!points[id])return;wantedTarget.fromArray(points[id]);wantedYaw=id==='window'?.7:0;wantedPitch=['chest','pickup-key'].includes(id)?.3:id==='tea'?.48:.12;wantedZoom=.42;updateIndicator();requestRender();},
    resetView(){wantedYaw=.48;wantedPitch=.37;wantedZoom=1;wantedTarget.set(0,1.15,-.4);updateIndicator();requestRender();},
    openDrawer(){drawerTarget=.65;requestRender();},
    openDoor(){doorTarget=1;requestRender();return new Promise(resolve=>{if(doorOpen>.98)resolve(true);else doorResolve=resolve;});},
    takeKey(){keyItem.visible=false;requestRender();},
    restart(){doorResolve?.(false);doorResolve=null;drawerTarget=0;doorTarget=0;keyItem.visible=true;this.resetView();},
    setMarkers(value){hotContainer.hidden=!value;},
    setQuality(value){renderer.setPixelRatio(Math.min(devicePixelRatio||1,value));resize();},
    getView(){return {yaw:wantedYaw,pitch:wantedPitch,zoom:wantedZoom,target:wantedTarget.toArray()};},
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
        yaw=wantedYaw=.28+i/59*.4;pitch=wantedPitch=.37;target.set(0,1.15,-.4);wantedTarget.copy(target);zoom=wantedZoom=1;render();
        if(i>=12)samples.push(lastRenderMs);resolve();
      }));
      if(disposed)throw new Error('Room was disposed during comparison');
      samples.sort((a,b)=>a-b);
      const result={...this.getInfo(),cpuMedianMs:samples[Math.floor(samples.length/2)],cpuP95Ms:samples[Math.floor(samples.length*.95)],samples:samples.length};
      wantedYaw=previous.yaw;wantedPitch=previous.pitch;wantedZoom=previous.zoom;wantedTarget.fromArray(previous.target);updateIndicator();requestRender();return result;
    },
    dispose(){
      disposed=true;doorResolve?.(false);controls.abort();cancelAnimationFrame(frame);observer.disconnect();
      const geometries=new Set(),materials=new Set(),maps=new Set(textureCache.values());
      scene.traverse(obj=>{if(obj.geometry)geometries.add(obj.geometry);for(const mat of [obj.material].flat()){if(mat){materials.add(mat);if(mat.map)maps.add(mat.map);}}});
      geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());maps.forEach(map=>map.dispose());
      renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();hotspots.forEach(item=>item.button.remove());
    }
  };
  function updateIndicator(){const index=wantedYaw<.3?0:wantedYaw>.6?2:1;document.querySelector('#view-angle').textContent=['左側','正面','右側'][index];document.querySelectorAll('.view-indicator i').forEach((el,i)=>el.classList.toggle('active',i===index));}
}
