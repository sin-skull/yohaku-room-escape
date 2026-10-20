export const wrapDigit = value => ((value % 10) + 10) % 10;
export const clampZoom = value => Math.max(.28, Math.min(1.45, value));

// Shared by the canvas and its markers: a pinch or drag can never become a tap.
export function createGesture() {
  const points = new Map();
  let moved = false, span = 0;
  const separation = () => { const [a,b] = [...points.values()]; return Math.hypot(a.x-b.x,a.y-b.y); };
  return {
    down(id,x,y,hit=null) {
      if (!points.size) moved=false;
      points.set(id,{x,y,ox:x,oy:y,hit});
      if(points.size>1){moved=true;span=separation();}
    },
    move(id,x,y) {
      const p=points.get(id);if(!p)return null;
      const dx=x-p.x,dy=y-p.y;p.x=x;p.y=y;
      if(points.size>1){const next=separation(),ratio=span>0?span/Math.max(next,1):1;span=next;return {zoom:ratio};}
      if(Math.hypot(x-p.ox,y-p.oy)>7)moved=true;
      return moved?{dx,dy}:null;
    },
    up(id) {const p=points.get(id);if(!p)return null;points.delete(id);return !moved?{hit:p.hit,x:p.x,y:p.y}:null;},
    cancel(){points.clear();moved=true;span=0;}
  };
}
