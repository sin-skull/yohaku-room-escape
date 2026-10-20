import { createRoom } from './room.js';
import { wrapDigit } from './interaction.js';
import { VERSION } from './version.js';
const $=s=>document.querySelector(s);
$('#game-version').textContent=`v${VERSION}`;
const icon=(id,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const freshState=()=>({clue:false,solved:false,key:false,escaped:false,started:Date.now(),finished:null,hints:0,digits:[0,0,0]});
let state=freshState(),settings={markers:true,quality:1.5,volume:.35,surfaceMode:'images'},room;
try{const progress=JSON.parse(localStorage.getItem('yohaku-progress'));if(progress&&typeof progress.clue==='boolean')state={...state,...progress};const prefs=JSON.parse(localStorage.getItem('yohaku-settings'));if(prefs)settings={...settings,...prefs};}catch{}
state.digits=Array.from({length:3},(_,i)=>wrapDigit(Number(state.digits?.[i])||0));
settings.surfaceMode=settings.surfaceMode==='geometry'?'geometry':'images';
const modal=$('#modal');let comparing=false,ending=false;
$('.modal-close').onclick=()=>{if(!comparing)modal.close();};
modal.addEventListener('cancel',e=>{if(comparing)e.preventDefault();});
modal.addEventListener('click',e=>{if(e.target===modal&&!comparing){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
function show(_eyebrow,title,body){modal.classList.remove('comparison-modal','lock-modal','scroll-modal');$('#modal-content').innerHTML=`<h2 id="modal-title">${title}</h2>${body}`;if(!modal.open)modal.showModal();else $('.modal-close').focus();}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function save(){try{localStorage.setItem('yohaku-progress',JSON.stringify(state));localStorage.setItem('yohaku-settings',JSON.stringify(settings));}catch{$('.save-note').textContent='保存できません';}}
function update(){
 const items=[];if(state.clue)items.push(['note','掛け軸','scroll']);if(state.key)items.push(['key','鍵','key']);
 $('#inventory').innerHTML=Array.from({length:4},(_,i)=>items[i]?`<button class="inventory-slot filled" aria-label="${items[i][1]}を調べる" data-item="${items[i][2]}">${icon(items[i][0])}</button>`:`<span class="inventory-slot empty" aria-hidden="true">・</span>`).join('');
 $('#inventory').querySelectorAll('[data-item]').forEach(el=>el.onclick=()=>inspect(el.dataset.item));
 $('.live-badge').textContent=state.escaped?'脱出':'静寂の間';
}
try{room=createRoom($('#scene'),{onInspect:inspect,solved:state.solved,keyTaken:state.key,escaped:state.escaped,...settings});}
catch(error){console.error(error);$('#loading').innerHTML='<span class="loading-mark">余白</span><p>描画を準備できませんでした。</p><button class="primary-button" id="retry">再読み込み</button>';$('#retry').onclick=()=>location.reload();}
function paper(message){toast(message);}
function motif(name){const paths={pine:'<path d="M22 41V19M10 21l12-14 12 14M5 31l17-17 17 17M4 40l18-17 18 17"/>',bamboo:'<path d="M22 43V5M17 14h10M17 27h10M22 21Q8 7 5 16q7 11 17 5M22 32q14-17 17-9-3 11-17 9"/>',plum:'<path d="M22 18c-10-17-24 1-11 9-10 15 11 23 13 8 17 8 23-15 8-16 2-15-19-18-10-1Z"/><circle cx="23" cy="26" r="3"/>'};return `<svg viewBox="0 0 46 50" aria-hidden="true">${paths[name]}</svg>`;}
function showScroll(){
 state.clue=true;save();update();
 show('','掛け軸',`<div class="clue-window"><div class="scroll-art" id="clue-art" role="img" aria-label="松の墨絵が三つ、竹の墨絵が一つ、梅の墨絵が五つ"><div class="ink-column"><b>松</b>${motif('pine').repeat(3)}</div><div class="ink-column"><b>竹</b>${motif('bamboo')}</div><div class="ink-column"><b>梅</b>${motif('plum').repeat(5)}</div><span class="ink-seal">余白</span></div></div><div class="paper-zoom"><button id="clue-minus" aria-label="掛け軸を縮小">−</button><button id="clue-reset">原寸</button><button id="clue-plus" aria-label="掛け軸を拡大">＋</button></div>`);
 modal.classList.add('scroll-modal');
 const art=$('#clue-art'),windowEl=$('.clue-window');let scale=1,offset={x:0,y:0},touches=new Map(),span=0,moved=false,lastTap=0;
 const paint=()=>{art.style.transform=`translate(${offset.x}px,${offset.y}px) scale(${scale})`;};
 const setScale=value=>{scale=Math.max(1,Math.min(2.6,value));if(scale===1)offset={x:0,y:0};paint();};
 $('#clue-minus').onclick=()=>setScale(scale/1.25);$('#clue-plus').onclick=()=>setScale(scale*1.25);$('#clue-reset').onclick=()=>setScale(1);
 windowEl.onwheel=e=>{e.preventDefault();setScale(scale*Math.exp(-e.deltaY*.002));};
 windowEl.onpointerdown=e=>{if(!touches.size)moved=false;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});windowEl.setPointerCapture(e.pointerId);if(touches.size===2){moved=true;const [a,b]=[...touches.values()];span=Math.hypot(a.x-b.x,a.y-b.y);}};
 windowEl.onpointermove=e=>{const p=touches.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(touches.size===2){const [a,b]=[...touches.values()],next=Math.hypot(a.x-b.x,a.y-b.y);if(span>0)setScale(scale*next/span);span=next;}else if(Math.abs(dx)+Math.abs(dy)>2){moved=true;if(scale>1){offset.x=Math.max(-100,Math.min(100,offset.x+dx));offset.y=Math.max(-200,Math.min(200,offset.y+dy));paint();}}};
 windowEl.onpointerup=e=>{touches.delete(e.pointerId);if(!moved){const now=performance.now();if(now-lastTap>250)setScale(scale===1?1.5:1);lastTap=now;}};
 windowEl.onpointercancel=()=>{touches.clear();moved=true;};
}
function showLock(){
 show('','箪笥の錠',`<div class="wood-lock"><div class="code-entry">${['松','竹','梅'].map((label,i)=>`<div class="dial" data-dial="${i}"><span class="dial-label">${label}</span><button class="dial-arrow" data-step="1" aria-label="${label}を一つ増やす">▴</button><button class="digit" id="digit-${i}" role="spinbutton" aria-label="${label}の数字" aria-valuemin="0" aria-valuemax="9" aria-valuenow="${state.digits[i]}">${state.digits[i]}</button><button class="dial-arrow" data-step="-1" aria-label="${label}を一つ減らす">▾</button></div>`).join('')}</div><button class="wood-handle" id="unlock">引く</button></div><p class="code-message" id="code-message" role="status"></p>`);
 modal.classList.add('lock-modal');
 document.querySelectorAll('[data-dial]').forEach(dial=>{
  const i=Number(dial.dataset.dial),digit=$(`#digit-${i}`);let drag=null,suppress=false;
  const step=n=>{state.digits[i]=wrapDigit(state.digits[i]+n);digit.textContent=state.digits[i];digit.setAttribute('aria-valuenow',state.digits[i]);digit.classList.remove('turned');void digit.offsetWidth;digit.classList.add('turned');$('#code-message').textContent='';save();chime(240+state.digits[i]*20);};
  dial.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>step(Number(button.dataset.step)));
  digit.onclick=()=>{if(!suppress)step(1);suppress=false;};
  digit.onkeydown=e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')step(-state.digits[i]);else if(e.key==='End')step(9-state.digits[i]);else step(['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}};
  digit.onwheel=e=>{e.preventDefault();step(e.deltaY<0?1:-1);};
  digit.onpointerdown=e=>{drag={id:e.pointerId,y:e.clientY};suppress=false;digit.setPointerCapture(e.pointerId);};
  digit.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;const dy=e.clientY-drag.y;if(Math.abs(dy)>=22){step(dy<0?1:-1);drag.y=e.clientY;suppress=true;}};
  digit.onpointerup=()=>{drag=null;};digit.onpointercancel=()=>{drag=null;suppress=true;};
 });
 $('#unlock').onclick=()=>{if(state.digits.join('')==='315'){state.solved=true;save();update();modal.close();room?.openDrawer();chime(660);paper('かちり。');}else{$('#code-message').textContent='動かない。';chime(180);$('.wood-lock').animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:150});}};
}
function inspect(id){
 if(ending)return;
 room?.focus(id);
 if(id==='scroll'){showScroll();return;}
 if(id==='chest'||id==='pickup-key'){if(!state.solved)showLock();else if(!state.key)showKey();else paper('何も入っていない。');return;}
 if(id==='key'){show('','真鍮の鍵',`${icon('key','key-art')}<button class="primary-button" id="back-room">しまう</button>`);$('#back-room').onclick=()=>modal.close();return;}
 if(id==='door'){
  if(state.escaped){showEnding();return;}
  if(!state.key){paper('鍵がかかっている。');return;}
  show('','鍵穴',`${icon('key','key-art')}<button class="primary-button" id="use-key">鍵を回す</button>`);
  $('#use-key').onclick=async()=>{modal.close();ending=true;chime(880);const opened=await room?.openDoor();ending=false;if(opened){state.escaped=true;state.finished=Date.now();save();update();showEnding();}};return;
 }
 paper('何も反応しないようだ。');
}
function showKey(){show('','引き出しの奥',`${icon('key','key-art')}<button class="primary-button" id="take-key">手に取る</button>`);$('#take-key').onclick=()=>{state.key=true;room?.takeKey();save();update();modal.close();chime(780);paper('鍵を手に入れた。');};}
function showEnding(){show('','余白の、その先へ',`<div class="ending-art">風　光</div><p class="center">脱出</p><button class="primary-button" id="enjoy-room">余韻を楽しむ</button><button class="secondary-button" id="play-again">もう一度</button>`);$('#enjoy-room').onclick=()=>modal.close();$('#play-again').onclick=restart;}
function restart(){state=freshState();ending=false;room?.restart();save();update();modal.close();paper('新たな、余白。');}

async function switchSurface(mode,{view=room?.getView(),persist=true}={}){
  if(!['images','geometry'].includes(mode))return room;
  room?.dispose();settings.surfaceMode=mode;
  room=createRoom($('#scene'),{onInspect:inspect,solved:state.solved,keyTaken:state.key,escaped:state.escaped,...settings,view});
  await room.ready;
  if(room.getInfo().assetErrors.length)throw new Error('A surface texture could not be loaded');
  if(persist)save();return room;
}

function showComparison(){
  const results={};results[settings.surfaceMode]=room?.getInfo();
  show('ONE ROOM, TWO WAYS','静寂の間で、比べる',`<p>この部屋だけに、画像を使う表現を試験導入しています。<br>切り替えても、視点・持ちもの・謎解きの進行は引き継ぎます。</p><div class="surface-choices"><button class="surface-choice" data-mode="images"><strong>画像中心</strong><small>輪郭は立体、細部は画像</small></button><button class="surface-choice" data-mode="geometry"><strong>従来の立体細部</strong><small>桟・縁・金具も立体</small></button></div><p class="texture-note" id="texture-note">7素材を1枚のWebPに共有 · 素材は最大500px</p><div id="comparison-results"></div><p class="comparison-status" id="comparison-status" role="status">同じ画面サイズ・描画倍率・見回し動作で計測できます。</p><button class="primary-button" id="run-comparison">同じ条件で描画負荷を計測</button><button class="secondary-button" id="back-from-comparison">この表現で、部屋に戻る</button><p class="measurement-note">CPU描画送信は48フレームの中央値です。GPU時間や実機FPSとは異なります。テクスチャ展開量はミップマップ込みの概算です。</p>`);
  modal.classList.add('comparison-modal');
  const updateResults=()=>{
    document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===settings.surfaceMode)));
    const number=value=>value===undefined?'—':Math.round(value).toLocaleString('ja-JP');
    const memory=value=>value===undefined?'—':`${(value/1048576).toFixed(2)} MB`;
    const cpu=value=>value===undefined?'未計測':`${value.toFixed(2)} ms`;
    $('#comparison-results').innerHTML=`<table class="comparison-table"><caption>静寂の間の描画負荷</caption><thead><tr><th scope="col">比較項目</th><th scope="col">従来の立体細部</th><th scope="col">画像中心</th></tr></thead><tbody><tr><th scope="row">三角形数</th><td>${number(results.geometry?.triangles)}</td><td>${number(results.images?.triangles)}</td></tr><tr><th scope="row">描画回数 / フレーム</th><td>${number(results.geometry?.calls)}</td><td>${number(results.images?.calls)}</td></tr><tr><th scope="row">テクスチャ展開量</th><td>${memory(results.geometry?.textureBytes)}</td><td>${memory(results.images?.textureBytes)}</td></tr><tr><th scope="row">CPU描画送信</th><td>${cpu(results.geometry?.cpuMedianMs)}</td><td>${cpu(results.images?.cpuMedianMs)}</td></tr></tbody></table>`;
    $('#comparison-results').dataset.measurements=JSON.stringify(results);
  };
  updateResults();
  fetch(new URL('./assets/textures/manifest.json',import.meta.url)).then(response=>response.json()).then(manifest=>{if($('#texture-note'))$('#texture-note').textContent=`${manifest.textures.length}素材をWebP 1枚に共有 · ${(manifest.totalBytes/1024).toFixed(1)} KB · 共有画像1024px／素材部分は最大500px`;}).catch(()=>{});
  document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=async()=>{
    const controls=[...document.querySelectorAll('[data-mode]'),$('#run-comparison')];controls.forEach(control=>control.disabled=true);
    try{await switchSurface(button.dataset.mode);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));results[settings.surfaceMode]={...results[settings.surfaceMode],...room.getInfo()};updateResults();}
    catch{$('#comparison-status').textContent='切り替えに失敗しました。ページを再読み込みしてください。';}
    finally{controls.forEach(control=>control.disabled=false);}
  });
  $('#back-from-comparison').onclick=()=>modal.close();
  $('#run-comparison').onclick=async()=>{
    comparing=true;const originalMode=settings.surfaceMode,originalView=room.getView();
    const controls=[...document.querySelectorAll('[data-mode]'),$('#run-comparison'),$('#back-from-comparison'),$('.modal-close')];controls.forEach(control=>control.disabled=true);
    try{
      for(const mode of ['geometry','images']){
        $('#comparison-status').textContent=`${mode==='images'?'画像中心':'従来の立体細部'}を計測中…`;
        await switchSurface(mode,{view:originalView,persist:false});results[mode]=await room.measure();updateResults();
      }
      $('#comparison-status').textContent=`計測完了 · ${results.images.width} × ${results.images.height}px · 描画倍率 ${results.images.pixelRatio}倍 · 各48フレーム`;
    }catch(error){console.error(error);$('#comparison-status').textContent='計測を完了できませんでした。もう一度お試しください。';}
    finally{
      try{await switchSurface(originalMode,{view:originalView});}catch(error){console.error(error);}
      comparing=false;controls.forEach(control=>control.disabled=false);updateResults();
    }
  };
}


$('#help-button').onclick=()=>{show('','手ほどき',`<div class="gesture-guide"><p>一本指　⟷　見回す</p><p>二本指　↔　拡大・縮小</p><p>ひと触れ　◯　調べる</p><p>数字　↕　切り替える</p></div><p class="fine-print">マウス：ドラッグ／ホイール　鍵盤：← →／＋ −</p>`);};
$('#hint-button').onclick=()=>{
 state.hints++;save();
 const hints=!state.clue?['床の間の、墨絵を。','掛け軸は、触れると大きくなる。']:!state.solved?['同じ草木を、数えてみる。','松、竹、梅。錠の順に。','三・一・五。']:!state.key?['開いた引き出しの、奥へ。']:!state.escaped?['鍵を、襖へ。']:['風の先へ。'];
 let index=0;show('','道しるべ',`<div class="hint-body"><p id="hint-text">${hints[0]}</p></div>${hints.length>1?'<button class="secondary-button" id="more-hint">もう一枚</button>':''}`);
 $('#more-hint')?.addEventListener('click',()=>{index=Math.min(index+1,hints.length-1);$('#hint-text').textContent=hints[index];$('#more-hint').disabled=index===hints.length-1;});
};
$('#settings-button').onclick=()=>{
 show('','しつらえ',`<div class="settings-row"><span>目印</span><button id="markers-setting" aria-pressed="${settings.markers}">${settings.markers?'あり':'なし'}</button></div><div class="settings-row"><span>描画</span><button id="quality-setting">${settings.quality===1?'軽量':'標準'}</button></div><label class="settings-row">音量<input id="volume-setting" aria-label="音量" type="range" min="0" max="1" step=".05" value="${settings.volume}"></label><button class="secondary-button" id="compare-surfaces">素材の比較</button><button class="secondary-button" id="reset-game">はじめから</button>`);
 $('#modal-content').insertAdjacentHTML('beforeend',`<p class="version-note">余白　v${VERSION}</p>`);
 $('#markers-setting').onclick=e=>{settings.markers=!settings.markers;e.currentTarget.textContent=settings.markers?'あり':'なし';e.currentTarget.setAttribute('aria-pressed',settings.markers);room?.setMarkers(settings.markers);save();};
 $('#quality-setting').onclick=e=>{settings.quality=settings.quality===1?1.5:1;e.currentTarget.textContent=settings.quality===1?'軽量':'標準';room?.setQuality(settings.quality);save();};
 $('#volume-setting').oninput=e=>{settings.volume=Number(e.target.value);if(master)master.gain.setTargetAtTime(settings.volume,audio.currentTime,.1);save();};
 $('#compare-surfaces').onclick=showComparison;
 $('#reset-game').onclick=()=>{show('','記憶を白紙に',`<p class="center">持ちものと進行が消えます。</p><button class="primary-button" id="confirm-reset">白紙に戻す</button><button class="secondary-button" id="cancel-reset">戻る</button>`);$('#confirm-reset').onclick=restart;$('#cancel-reset').onclick=()=>modal.close();};
};
$('#view-left').onclick=()=>room?.look(-1);$('#view-right').onclick=()=>room?.look(1);
$('#front-view').onclick=()=>room?.frontView();
$('#reset-view').onclick=()=>room?.resetView();$('#zoom-in').onclick=()=>room?.zoomBy(.8);$('#zoom-out').onclick=()=>room?.zoomBy(1.25);
document.addEventListener('keydown',e=>{if(modal.open||e.target.closest('button,input'))return;const actions={ArrowLeft:()=>room?.look(-1),ArrowRight:()=>room?.look(1),'+':()=>room?.zoomBy(.8),'=':()=>room?.zoomBy(.8),'-':()=>room?.zoomBy(1.25),Escape:()=>room?.resetView()};if(actions[e.key]){e.preventDefault();actions[e.key]();}});

let audio,master,ambient,soundOn=false;
async function toggleSound(){
  try{
    if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=settings.volume;master.connect(audio.destination);
      const size=audio.sampleRate*4,buffer=audio.createBuffer(1,size,audio.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let i=0;i<size;i++){brown=(brown+(Math.random()*2-1)*.025)/1.025;data[i]=brown*.7;}ambient=audio.createBufferSource();ambient.buffer=buffer;ambient.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;ambient.connect(filter);filter.connect(master);ambient.start();}
    soundOn=!soundOn;if(soundOn)await audio.resume();else await audio.suspend();
    $('#sound-button').innerHTML=`${icon(soundOn?'sound':'mute')}<span>音 ${soundOn?'ON':'OFF'}</span>`;$('#sound-button').setAttribute('aria-pressed',String(soundOn));$('#sound-button').setAttribute('aria-label',soundOn?'環境音をオフにする':'環境音をオンにする');toast(soundOn?'静かな風の音を、添えました。':'環境音をオフにしました。');
  }catch{toast('このブラウザでは環境音を再生できませんでした。');}
}
function chime(frequency){if(!soundOn||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.8);o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+.8);}
$('#sound-button').onclick=toggleSound;
document.addEventListener('visibilitychange',()=>{if(!audio||!soundOn)return;if(document.hidden)audio.suspend();else audio.resume();});
// Remove an older Flutter worker if this directory was previously used by Flutter.
if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(regs=>{const scope=new URL('./',location.href).href;for(const reg of regs){const url=reg.active?.scriptURL||'';if(reg.scope===scope&&url.includes('flutter_service_worker.js'))reg.unregister();}}).catch(()=>{});
update();
