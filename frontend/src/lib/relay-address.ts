import type {Row} from './data';
import {nodeAddress} from './node-workbench';

export function sameEndpoint(a:string,b:string){
 const normalize=(value:string)=>{try{const url=new URL('tcp://'+value);return url.hostname.toLowerCase().replace(/\.$/,'')+':'+Number(url.port);}catch{return value;}};
 return normalize(a)===normalize(b);
}
export function nodeRelay(row:Row,relays:Row[]){return relays.find(relay=>relay.nodeId===row.id&&sameEndpoint(relay.originalAddress,nodeAddress(row)));}
