import { createRoom } from './room.js';

const $ = s => document.querySelector(s);
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const freshState = () => ({ clue:false, solved:false, key:false, escaped:false, started:Date.now(), finished:null, hints:0 });
let state=freshState(),settings={markers:true,quality:1.5,volume:.35,surfaceMode:'images'};
let storageAvailable=true;
try{const saved=JSON.parse(localStorage.getItem('yohaku-progress'));if(saved&&typeof saved.clue==='boolean')state={...state,...saved};const prefs=JSON.parse(localStorage.getItem('yohaku-settings'));if(prefs)settings={...settings,...prefs};}catch{storageAvailable=false;}
settings.surfaceMode=settings.surfaceMode==='geometry'?'geometry':'images';
let room;
try{room=createRoom($('#scene'),{onInspect:inspect,solved:state.solved,keyTaken:state.key,escaped:state.escaped,...settings});}
catch(error){console.error(error);$('#loading').innerHTML='<div class="error-message"><span class="loading-mark">余白</span><p>3Dの描画を準備できませんでした。<br>WebGLに対応したブラウザで、もう一度お試しください。</p><button class="primary-button" id="retry">再読み込み</button></div>';$('#retry').onclick=()=>location.reload();}

const modal=$('#modal');
let comparing=false;
$('.modal-close').onclick=()=>{if(!comparing)modal.close();};
modal.addEventListener('cancel',e=>{if(comparing)e.preventDefault();});
modal.addEventListener('click',e=>{if(!comparing&&e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
function show(eyebrow,title,body){modal.classList.remove('comparison-modal');$('#modal-content').innerHTML=`<p class="modal-eyebrow">${eyebrow}</p><h2 id="modal-title">${title}</h2>${body}`;if(!modal.open)modal.showModal();}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function save(){try{localStorage.setItem('yohaku-progress',JSON.stringify(state));localStorage.setItem('yohaku-settings',JSON.stringify(settings));}catch{storageAvailable=false;}if(!storageAvailable)$('.save-note').textContent='このブラウザでは保存ができません';}
function update(){
  for(const [id,done,current] of [['clue',state.clue,!state.clue],['chest',state.solved,state.clue&&!state.solved],['escape',state.escaped,state.solved&&!state.escaped]]){$(`#step-${id}`).classList.toggle('done',done);$(`#step-${id}`).classList.toggle('current',current);}
  const items=[];if(state.clue)items.push(['note','掛け軸の覚え書き','scroll']);if(state.key)items.push(['key','古びた真鍮の鍵','key']);
  $('#inventory').innerHTML=Array.from({length:4},(_,i)=>items[i]?`<button class="inventory-slot filled" aria-label="${items[i][1]}" title="${items[i][1]}" data-item="${items[i][2]}">${icon(items[i][0])}</button>`:`<button class="inventory-slot" disabled aria-label="空の持ちもの枠 ${i+1}"><span>＋</span></button>`).join('');
  $('#inventory').querySelectorAll('[data-item]').forEach(el=>el.onclick=()=>inspect(el.dataset.item));
  $('#inventory-count').textContent=`${items.length} / 4`;$('#inventory-caption').textContent=items.length?'クリックで、もう一度調べられます。':'見つけたものは、ここに。';
  if(state.escaped){$('.live-badge').innerHTML='<span></span>脱出成功';$('#scene-message').textContent='見つけた出口の先にも、穏やかな一日を。';$('.objective h2').textContent='この部屋から、脱出しました';}
  else if(state.key){$('#scene-message').textContent='この鍵は、どこかの扉に合うかもしれません。';$('.live-badge').innerHTML='<span></span>探索中';$('.objective h2').textContent='鍵を使って、この部屋を出る';}
  else{$('.objective h2').textContent='隠された鍵を見つける';$('.live-badge').innerHTML='<span></span>探索中';$('#scene-message').textContent=state.clue?'掛け軸の言葉が、箪笥の仕掛けにつながりそうです。':'気になるものを、そっと調べてみましょう。';}
}

function inspect(id){
  if(id==='pickup-key'){
    if(state.solved&&!state.key)showKey();else inspect('chest');
  }else if(id==='scroll'){
    const isNew=!state.clue;state.clue=true;save();update();chime(520);
    show('A CLUE IN THE STILLNESS','床の間の掛け軸',`<p>掛け軸の裏に、小さな覚え書きがありました。</p><div class="scroll-art"><div class="scroll-paper"><span>松は三つ</span><span>竹は一つ</span><span>梅は五つ</span><small>右より、順に。</small></div></div><p class="clue-detail">「松・竹・梅。右より、順に。」<br>箪笥の三つの数字に、関係があるのでしょうか。</p><button class="primary-button" id="keep-note">${isNew?'覚え書きを記録する':'部屋に戻る'}</button>`);
    $('#keep-note').onclick=()=>{modal.close();if(isNew)toast('掛け軸の覚え書きを、持ちものに記録しました。');};
  }else if(id==='chest'){
    if(state.solved){if(!state.key)showKey();else show('THE OLD TANSU','開いた箪笥',`<p>引き出しは、静かに開いています。<br>中にあった鍵は、すでに持ちものに入っています。</p><button class="primary-button" id="back-room">部屋に戻る</button>`);$('#back-room')?.addEventListener('click',()=>modal.close());return;}
    show('A LITTLE MECHANISM','箪笥の仕掛け',`<p>一番上の引き出しに、三つの数字錠。<br>その上に、小さく「松・竹・梅」と刻まれています。</p><div class="code-entry">${['松','竹','梅'].map((name,i)=>`<label>${name}<select aria-label="${name}の数字" id="digit-${i}">${Array.from({length:10},(_,n)=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}</div><p class="code-message" id="code-message" role="status"></p><button class="primary-button" id="unlock">引き出しを開ける</button>${state.clue?'<button class="secondary-button" id="read-note">覚え書きを見返す</button>':''}`);
    $('#read-note')?.addEventListener('click',()=>inspect('scroll'));
    $('#unlock').onclick=()=>{const code=[0,1,2].map(i=>$(`#digit-${i}`).value).join('');if(code==='315'){state.solved=true;save();update();room?.openDrawer();chime(660);showKey();}else{$('#code-message').textContent='まだ、開かないようです。もう一度考えてみましょう。';chime(180);}};
  }else if(id==='key'){
    show('A WAY TO THE OUTSIDE','古びた真鍮の鍵',`${icon('key','key-art')}<p class="center">手のひらに、ひんやりとした重み。<br>襖の錠前に、合いそうな形をしています。</p><button class="primary-button" id="back-room">部屋に戻る</button>`);$('#back-room').onclick=()=>modal.close();
  }else if(id==='door'){
    if(state.escaped){showEnding();return;}
    if(!state.key){show('BEYOND THE ROOM','閉ざされた襖',`<p>外の気配はするけれど、襖は動きません。<br>引き手の下に、小さな鍵穴がありました。</p><p>この部屋のどこかに、鍵があるはずです。</p><button class="primary-button" id="back-room">もう少し、探してみる</button>`);$('#back-room').onclick=()=>modal.close();}
    else{show('ONE LAST LITTLE STEP','出口の鍵穴',`${icon('key','key-art')}<p class="center">箪笥で見つけた鍵が、ぴたりと合いそうです。<br>静かに、鍵を回してみますか。</p><button class="primary-button" id="use-key">鍵を使って、襖を開ける</button>`);$('#use-key').onclick=()=>{state.escaped=true;state.finished=Date.now();save();update();room?.openDoor();chime(880);showEnding();};}
  }else if(id==='tea'){
    show('A MOMENT TO BREATHE','淹れたての、静けさ',`<p>湯呑みには、まだ少し温もりが残っています。<br>傍らの紙には、こんな言葉。</p><div class="hint-body"><p>「急がずに。答えはいつも、<br>　目の前の景色の中に。」</p></div><p>床の間の掛け軸が、少し気になりました。</p><button class="primary-button" id="back-room">ひと息ついて、戻る</button>`);$('#back-room').onclick=()=>modal.close();
  }else if(id==='window'){
    show('LIGHT THROUGH WASHI','障子越しの午後',`<p>和紙を透かして、やわらかな光が差し込みます。<br>向こうで、竹の葉がかすかに揺れていました。</p><p>障子には鍵も仕掛けもないようです。<br>この部屋の出口は、奥の襖でしょう。</p><button class="primary-button" id="back-room">部屋に戻る</button>`);$('#back-room').onclick=()=>modal.close();
  }else if(id==='lantern'){
    show('A GENTLE GLOW','和紙の行灯',`<p>竹の骨組みに和紙を張った、小さな行灯。<br>あたたかな光が、畳の目を照らしています。</p><p>そっと持ち上げてみましたが、<br>下には何もありませんでした。</p><button class="primary-button" id="back-room">そっと、元に戻す</button>`);$('#back-room').onclick=()=>modal.close();
  }
}
function showKey(){show('THE FIRST DISCOVERY','引き出しの奥に',`${icon('key','key-art')}<p class="center">かちり、と小さな音。<br>開いた引き出しの中に、古びた鍵がありました。</p><button class="primary-button" id="take-key">鍵を手に取る</button>`);$('#take-key').onclick=()=>{state.key=true;room?.takeKey();save();update();modal.close();chime(780);toast('古びた真鍮の鍵を、手に入れました。');};}
function showEnding(){const secs=Math.max(0,Math.floor(((state.finished||Date.now())-state.started)/1000));show('THANK YOU FOR TAKING A MOMENT','余白の、その先へ。',`<div class="ending-art">風 光</div><p class="center">襖の向こうに、やわらかな午後が待っていました。<br>小さなひらめきが、あなたを外へ連れ出しました。</p><p class="ending-time">${String(Math.floor(secs/60)).padStart(2,'0')} : ${String(secs%60).padStart(2,'0')}</p><p class="center">脱出成功 · ヒント ${state.hints} 回</p><button class="primary-button" id="enjoy-room">もう少し、この余韻を</button><button class="secondary-button" id="play-again">はじめから、もう一度</button>`);$('#enjoy-room').onclick=()=>modal.close();$('#play-again').onclick=restart;}
function restart(){state=freshState();room?.restart();save();update();modal.close();toast('新しい余白が、はじまります。');}

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

$('#help-button').onclick=()=>{show('HOW TO ENJOY YOHAKU','余白の、楽しみ方',`<div class="help-row">${icon('eye')}<div><strong>ゆっくり、見回す</strong><p>部屋をドラッグするか、左右の矢印で見回せます。<br>スマートフォンでは、指でなぞってみてください。</p></div></div><div class="help-row">${icon('hand')}<div><strong>気になったら、調べる</strong><p>白い丸や、部屋のものをクリック・タップ。<br>見つけた手がかりは「持ちもの」に残ります。</p></div></div><div class="help-row">${icon('bulb')}<div><strong>つまずいたら、ひと休み</strong><p>ヒントは、いつでもどうぞ。時間制限はありません。<br>進行状況は、このブラウザに自動で保存されます。</p></div></div><button class="primary-button" id="start-playing">部屋を、見回してみる</button>`);$('#start-playing').onclick=()=>modal.close();};
$('#hint-button').onclick=()=>{
  state.hints++;save();let hints,title;
  if(!state.clue){title='まずは、目を凝らして';hints=['床の間に掛かっている掛け軸を、調べてみましょう。','掛け軸の裏に、数字に関わる覚え書きがあります。'];}
  else if(!state.solved){title='言葉を、数字にして';hints=['掛け軸の「松・竹・梅」と、箪笥に刻まれた言葉を見比べてみましょう。','松は三つ、竹は一つ、梅は五つ。松・竹・梅の順に「3・1・5」を入力してみましょう。'];}
  else if(!state.key){title='引き出しの、奥に';hints=['開いた箪笥をもう一度調べて、鍵を手に取りましょう。'];}
  else if(!state.escaped){title='鍵が、待っている場所';hints=['奥にある襖を調べて、手に入れた鍵を使ってみましょう。'];}
  else{title='もう、出口はあなたの前に';hints=['脱出は成功しました。もう一度、ゆっくり部屋の景色を楽しんでください。'];}
  let index=0;show('A SMALL NUDGE',title,`<div class="hint-body"><p id="hint-text">${hints[0]}</p></div>${hints.length>1?'<button class="secondary-button" id="more-hint">もう少し、詳しく</button>':''}<button class="primary-button" id="back-room">もう一度、探してみる</button>`);$('#back-room').onclick=()=>modal.close();$('#more-hint')?.addEventListener('click',()=>{index=Math.min(index+1,hints.length-1);$('#hint-text').textContent=hints[index];$('#more-hint').disabled=true;});
};
$('#settings-button').onclick=()=>{
  show('MAKE YOURSELF COMFORTABLE','心地よい、しつらえ',`<label class="settings-row">調べる場所の目印<input id="markers-setting" type="checkbox" ${settings.markers?'checked':''}></label><label class="settings-row">素材の描き方<select id="surface-setting"><option value="images" ${settings.surfaceMode==='images'?'selected':''}>画像中心（この部屋で試験）</option><option value="geometry" ${settings.surfaceMode==='geometry'?'selected':''}>従来の立体細部</option></select></label><label class="settings-row">描画の細かさ<select id="quality-setting"><option value="1" ${settings.quality===1?'selected':''}>軽量（1倍）</option><option value="1.5" ${settings.quality===1.5?'selected':''}>標準（最大1.5倍）</option></select></label><label class="settings-row">環境音の音量<input id="volume-setting" type="range" min="0" max="1" step=".05" value="${settings.volume}"></label><button class="secondary-button" id="compare-surfaces">見た目と描画負荷を比較する</button><button class="secondary-button" id="reset-game">最初からやり直す</button><button class="primary-button" id="save-settings">部屋に戻る</button>`);
  $('#surface-setting').onchange=async e=>{e.target.disabled=true;try{await switchSurface(e.target.value);}catch{toast('素材の切り替えに失敗しました。再読み込みしてください。');}finally{e.target.disabled=false;}};
  $('#compare-surfaces').onclick=showComparison;
  $('#markers-setting').onchange=e=>{settings.markers=e.target.checked;room?.setMarkers(settings.markers);save();};$('#quality-setting').onchange=e=>{settings.quality=Number(e.target.value);room?.setQuality(settings.quality);save();};$('#volume-setting').oninput=e=>{settings.volume=Number(e.target.value);if(master)master.gain.setTargetAtTime(settings.volume,audio.currentTime,.1);save();};$('#save-settings').onclick=()=>modal.close();
  $('#reset-game').onclick=()=>{show('A FRESH START','はじめから、もう一度',`<p>この部屋の進行状況と持ちものをリセットします。<br>もう一度、まっさらな気持ちで探索できます。</p><button class="primary-button" id="confirm-reset">進行状況をリセットする</button><button class="secondary-button" id="cancel-reset">部屋に戻る</button>`);$('#confirm-reset').onclick=restart;$('#cancel-reset').onclick=()=>modal.close();};
};
$('#view-left').onclick=()=>room?.look(-1);$('#view-right').onclick=()=>room?.look(1);$('#reset-view').onclick=()=>{room?.resetView();toast('はじめの視点に戻しました。');};
$('#expand-view').onclick=()=>{const expanded=$('.game-panel').classList.toggle('expanded');$('#expand-view').setAttribute('aria-label',expanded?'元の大きさに戻す':'画面を広げる');};
document.addEventListener('keydown',e=>{if(modal.open)return;if(e.key==='ArrowLeft'){room?.look(-1);e.preventDefault();}if(e.key==='ArrowRight'){room?.look(1);e.preventDefault();}if(e.key==='Escape')$('.game-panel').classList.remove('expanded');});

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
