type Document = Record<string, any>;
const object = (value: any): value is Document => value !== null && typeof value === 'object' && !Array.isArray(value);

function merge(before: Document, changes: Document): Document {
 const result = {...before};
 for(const [key,value] of Object.entries(changes)) {
  const next = object(value) && Object.hasOwn(before,key) && object(before[key]) ? merge(before[key],value) : value;
  Object.defineProperty(result,key,{value:next,writable:true,enumerable:true,configurable:true});
 }
 return result;
}

export function applySnapshot(previous: Document | undefined, cursor: string, response: any): Document {
 if(response.reset===true && object(response.data)) return response.data;
 if(!previous || response.base!==cursor || !object(response.changes) || !Array.isArray(response.removed)) throw new Error('状态缓存版本不匹配');
 const next=structuredClone(previous);
 for(const path of response.removed) {
  if(!Array.isArray(path)||!path.length||path.some(key=>typeof key!=='string'))throw new Error('状态删除标记无效');
  let parent=next;
  for(const key of path.slice(0,-1)){if(!Object.hasOwn(parent,key)||!object(parent[key]))throw new Error('状态缓存缺少字段');parent=parent[key];}
  if(!Object.hasOwn(parent,path.at(-1)))throw new Error('状态缓存缺少字段');
  delete parent[path.at(-1)];
 }
 return merge(next,response.changes);
}

export function createSnapshotCache(request: (path:string,init?:RequestInit)=>Promise<any>) {
 let epoch=0;
 const entries=new Map<string,{cursor:string;data:Document;bytes:number}>();
 const pending=new Map<string,Promise<any>>();
 return {
  clear(){epoch++;entries.clear();pending.clear();},
  async read(path:string,init:RequestInit={}):Promise<any>{
   if(pending.has(path))return structuredClone(await pending.get(path));
   const started=epoch;
   const work=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
     const old=entries.get(path);
     let response:any;
     try{response=await request(path+(old?(path.includes('?')?'&':'?')+'cursor='+encodeURIComponent(old.cursor):''),init);}
     catch(error){if(started===epoch && [401,403].includes((error as any)?.status))entries.delete(path);throw error;}
     if(started!==epoch)throw new Error('会话已切换');
     if(typeof response.cursor!=='string')return response;
     let data:Document;
     try{data=applySnapshot(old?.data,old?.cursor??'',response);}
     catch(error){entries.delete(path);if(attempt===0)continue;throw error;}
     const bytes=JSON.stringify(data).length*2;
     entries.delete(path);
     let total=bytes;for(const entry of entries.values())total+=entry.bytes;
     while(entries.size && (entries.size>=32 || total>16*1024*1024)){const key=entries.keys().next().value!;total-=entries.get(key)!.bytes;entries.delete(key);}
     if(bytes<=16*1024*1024)entries.set(path,{cursor:response.cursor,data,bytes});
     return data;
    }
   })();
   pending.set(path,work);
   try{return structuredClone(await work);}finally{if(pending.get(path)===work)pending.delete(path);}
  }
 };
}
