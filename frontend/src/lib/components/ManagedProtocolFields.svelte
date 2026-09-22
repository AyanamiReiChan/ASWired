<script lang="ts">
 import AppSelect from "./Select.svelte";
 import type {Row} from '../data';
 import {managedProtocols,protocolDefaults,protocolUnavailable} from '../managed-protocols';
 import {isManagedRealityInbound} from '../inbound-profile';
 import RealityFields from './RealityFields.svelte';
 let {form=$bindable(),server,busy=$bindable(false)}:{form:Row;server?:Row;busy?:boolean}=$props();
 const selectable=$derived(['VLESS','VMess','Trojan'].includes(form.protocol));
 const securities=$derived(form.protocol==='VLESS'&&form.network==='tcp'?['reality','tls','none']:form.protocol==='Trojan'||['Hysteria2','AnyTLS'].includes(form.protocol)?['tls']:['tls','none']);
 function changeProtocol(){form=protocolDefaults(form,form.protocol);}
 function changeTransport(){
  if(form.security==='reality'&&(form.protocol!=='VLESS'||form.network!=='tcp'))form.security='tls';
  form.transport=`${form.network.toUpperCase()} / ${form.security==='reality'?'Reality':form.security.toUpperCase()}`;
  if(form.protocol!=='VLESS'||form.network!=='tcp'||form.security==='none')form.flow='无';
 }
</script>
<div class="form-grid protocol-fields">
 <label class="field">协议<AppSelect aria-label="入站协议" bind:value={form.protocol} onchange={changeProtocol} options={[...managedProtocols.map(protocol=>{const reason=protocolUnavailable(protocol,server);return {value:protocol,label:protocol+(reason?' · '+reason:''),disabled:Boolean(reason)};}),{value:'TUIC',label:'TUIC · 尚未接入 Agent',disabled:true},{value:'Hysteria1',label:'Hysteria1 · 尚未接入 Agent',disabled:true},{value:'WireGuard',label:'WireGuard · 仅隧道管理',disabled:true}]}/></label>
 <label class="field">传输<AppSelect aria-label="入站传输" bind:value={form.network} onchange={changeTransport} disabled={!selectable} options={[{value:'tcp',label:'TCP'},...(selectable?[{value:'ws',label:'WebSocket'},{value:'grpc',label:'gRPC'}]:[]),...(form.protocol==='Hysteria2'?[{value:'hysteria',label:'QUIC / UDP'}]:[])]}/></label>
 <label class="field">安全<AppSelect aria-label="入站安全" bind:value={form.security} onchange={changeTransport} disabled={['Shadowsocks','Snell','Hysteria2','AnyTLS'].includes(form.protocol)} options={securities.map(security=>({value:security,label:security==='none'?'无':security.toUpperCase()}))}/></label>
 {#if form.protocol==='VLESS'&&form.network==='tcp'&&form.security!=='none'}<label class="field">Flow<AppSelect aria-label="Flow" bind:value={form.flow} options={[{value:'xtls-rprx-vision',label:'XTLS Vision'},'无']}/></label>{/if}
 {#if form.network==='ws'}<label class="field">WebSocket 路径<input bind:value={form.path} placeholder="/"/></label><label class="field">Host<input bind:value={form.hostHeader}/></label>{/if}
 {#if form.network==='grpc'}<label class="field">gRPC Service Name<input bind:value={form.serviceName}/></label>{/if}
 {#if form.protocol==='Shadowsocks'}<label class="field">加密算法<AppSelect aria-label="加密算法" bind:value={form.method} options={['aes-128-gcm','aes-256-gcm','chacha20-ietf-poly1305','xchacha20-ietf-poly1305']}/></label>{/if}
 {#if form.protocol==='Snell'}<label class="field">Snell 版本<AppSelect aria-label="Snell 版本" value={String(form.snellVersion)} onchange={value=>form.snellVersion=Number(value)} options={[{value:'3',label:'v3'},{value:'4',label:'v4'}]}/></label>{/if}
 {#if ['AnyTLS','Snell'].includes(form.protocol)}<label class="field">本地桥接端口<input type="number" min="1024" max="65535" bind:value={form.bridgePort}/></label>{/if}
 {#if form.security==='tls'}<label class="field">SNI<input bind:value={form.sni} required/></label><label class="field">ALPN<input bind:value={form.alpn} readonly={form.protocol==='Hysteria2'}/></label><label class="field">Agent 证书文件<input bind:value={form.certificateFile} required placeholder="/etc/aswired/certs/fullchain.pem"/></label><label class="field">Agent 私钥文件<input bind:value={form.keyFile} required placeholder="/etc/aswired/certs/key.pem"/></label>{/if}
</div>
{#if isManagedRealityInbound(form)}<RealityFields bind:form bind:busy/>{/if}
{#if form.protocol==='AnyTLS'||form.protocol==='Snell'}<p class="hint">仅 TCP；不支持原客户端 IP 限额。{form.protocol==='Snell'?'每个监听端口限一个有效订阅。':''}</p>{/if}
{#if form.protocol==='SOCKS5'||form.protocol==='HTTP'}<p class="hint">仅 TCP；账号变更会重载核心，现有连接需要重连。</p>{/if}
<style>.protocol-fields{margin:16px 0}.hint{font-size:12px;color:var(--muted)}</style>
