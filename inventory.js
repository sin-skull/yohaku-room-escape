export function toggleItemSelection(current,item,owned){
  if(!owned.includes(item))return current;
  return current===item?null:item;
}
export function itemAction(selected,target,progress){
  if(!selected)return 'inspect';
  if(selected==='key'&&target==='door'&&progress.key&&!progress.escaped)return 'unlock-door';
  return 'no-effect';
}
