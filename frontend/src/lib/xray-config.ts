export type ConfigSection = 'config' | 'inbounds' | 'outbounds' | 'routing';
export function parseConfigDraft(text:string, section:ConfigSection):any {
 const value=JSON.parse(text);
 if(section==='inbounds'||section==='outbounds') {
  if(!Array.isArray(value)||value.some(item=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error('须填写 JSON 对象数组');
 }else if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('须填写 JSON 对象');
 return value;
}
export function mergeConfigDraft(config:Record<string,any>,text:string,section:ConfigSection):Record<string,any>{
 const value=parseConfigDraft(text,section);
 if(section!=='config'&&!(section in config)&&JSON.stringify(value)===JSON.stringify(section==='routing'?{}:[]))return config;
 return section==='config'?value:{...config,[section]:value};
}
export function sectionDraft(config:Record<string,any>,section:ConfigSection):string{
 return JSON.stringify(section==='config'?config:config[section]??(section==='routing'?{}:[]),null,2);
}
