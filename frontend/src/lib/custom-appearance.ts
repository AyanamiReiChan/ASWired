export function installCustomCSS(css:string,search=location.search){
 const disabled=new URLSearchParams(search).get('nocss')==='1';const element=document.createElement('style');element.dataset.aswiredCustom='true';

 element.textContent=(disabled?'':css.slice(0,131072))+'\n:root{color-scheme:dark!important}';document.head.append(element);return ()=>element.remove();
}
