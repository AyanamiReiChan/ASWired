export function decodeBase64URL(value: string): ArrayBuffer {
 const normalized=value.replaceAll('-','+').replaceAll('_','/');const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer;
}
export function encodeBase64URL(value: ArrayBuffer): string {return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function creationOptions(input: any): CredentialCreationOptions {
 const publicKey=structuredClone(input.publicKey??input);publicKey.challenge=decodeBase64URL(publicKey.challenge);publicKey.user.id=decodeBase64URL(publicKey.user.id);if(publicKey.excludeCredentials)publicKey.excludeCredentials=publicKey.excludeCredentials.map((item:any)=>({...item,id:decodeBase64URL(item.id)}));return {publicKey};
}
export function requestOptions(input: any): CredentialRequestOptions {
 const publicKey=structuredClone(input.publicKey??input);publicKey.challenge=decodeBase64URL(publicKey.challenge);if(publicKey.allowCredentials)publicKey.allowCredentials=publicKey.allowCredentials.map((item:any)=>({...item,id:decodeBase64URL(item.id)}));return {publicKey};
}
export function credentialJSON(credential: PublicKeyCredential) {
 const base={id:credential.id,rawId:encodeBase64URL(credential.rawId),type:credential.type,authenticatorAttachment:credential.authenticatorAttachment,clientExtensionResults:credential.getClientExtensionResults()};
 const response=credential.response;
 if(response instanceof AuthenticatorAttestationResponse)return {...base,response:{clientDataJSON:encodeBase64URL(response.clientDataJSON),attestationObject:encodeBase64URL(response.attestationObject),transports:response.getTransports?.()??[]}};
 const assertion=response as AuthenticatorAssertionResponse;return {...base,response:{clientDataJSON:encodeBase64URL(assertion.clientDataJSON),authenticatorData:encodeBase64URL(assertion.authenticatorData),signature:encodeBase64URL(assertion.signature),userHandle:assertion.userHandle?encodeBase64URL(assertion.userHandle):null}};
}
export function passkeyError(cause:unknown):string {if(cause instanceof DOMException&&cause.name==='NotAllowedError')return '通行密钥操作已取消或超时';return cause instanceof Error?cause.message:'通行密钥操作失败';}
