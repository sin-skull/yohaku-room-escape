export const CLUE_VALUES=Object.freeze({pine:3,bamboo:1,plum:5});
export const CLUE_SYMBOLS=Object.freeze({pine:'松',bamboo:'竹',plum:'梅'});
export const CLUE_INK=Object.freeze({pine:'三',bamboo:'一',plum:'五'});
export const flowerCell=({row,column})=>row===CLUE_VALUES.pine-1&&column===CLUE_VALUES.bamboo-1;
export function restoreObservations(saved){
 const legacy=!!(saved?.solved||saved?.key||saved?.escaped);
 return Object.fromEntries(Object.keys(CLUE_VALUES).map(id=>[id,typeof saved?.observations?.[id]==='boolean'?saved.observations[id]:legacy]));
}
export function nextHint(state){
 if(!state.observations.pine)return ['書院の高い棚の墨を、上から眺める。','表廊下から書院へ。神目線で飾り棚に触れ、俯瞰の印を。'];
 if(!state.observations.bamboo)return ['表廊下の低い覗き穴。床の丸い印から。','歩行に切り替え、廊下の覗き棚に触れて近づく。'];
 if(!state.flowerSolved)return ['静寂の間に戻る。松は縦、竹は横。','静寂の間の格子。三段目の、一番左。'];
 if(!state.observations.plum)return ['静寂の間で、開いた花の紋を写す。'];
 if(!state.solved)return ['書院へ。写した松竹梅を、箪笥の錠の順に。','三・一・五。'];
 if(!state.key)return ['書院の開いた引き出しの、奥へ。'];
 if(!state.escaped)return ['表廊下の先に玄関。持ちものの鍵を選び、玄関の襖に触れる。'];
 return ['風の先へ。'];
}
