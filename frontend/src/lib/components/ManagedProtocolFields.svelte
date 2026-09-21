<script lang="ts">
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
 <label class="field">协议<select aria-label="入站协议" bind:value={form.protocol} onchange={changeProtocol}>{#each managedProtocols as protocol}{@const reason=protocolUnavailable(protocol,server)}<option value={protocol} disabled={Boolean(reason)}>{protocol}{reason?` · ${reason}`:''}</option>{/each}<option disabled>TUIC · 尚未接入 Agent</option><option disabled>Hysteria1 · 尚未接入 Agent</option><option disabled>WireGuard · 仅隧道管理</option></select></label>
 <label class="field">传输<select aria-label="入站传输" bind:value={form.network} onchange={changeTransport} disabled={!selectable}><option value="tcp">TCP</option>{#if selectable}<option value="ws">WebSocket</option><option value="grpc">gRPC</option>{/if}{#if form.protocol==='Hysteria2'}<option value="hysteria">QUIC / UDP</option>{/if}</select></label>
 <label class="field">安全<select aria-label="入站安全" bind:value={form.security} onchange={changeTransport} disabled={['Shadowsocks','Snell','Hysteria2','AnyTLS'].includes(form.protocol)}>{#each securities as security}<option value={security}>{security==='none'?'无':security.toUpperCase()}</option>{/each}</select></label>
 {#if form.protocol==='VLESS'&&form.network==='tcp'&&form.security!=='none'}<label class="field">Flow<select bind:value={form.flow}><option value="xtls-rprx-vision">XTLS Vision</option><option value="无">无</option></select></label>{/if}
 {#if form.network==='ws'}<label class="field">WebSocket 路径<input bind:value={form.path} placeholder="/"/></label><label class="field">Host<input bind:value={form.hostHeader}/></label>{/if}
 {#if form.network==='grpc'}<label class="field">gRPC Service Name<input bind:value={form.serviceName}/></label>{/if}
 {#if form.protocol==='Shadowsocks'}<label class="field">加密算法<select bind:value={form.method}>{#each ['aes-128-gcm','aes-256-gcm','chacha20-ietf-poly1305','xchacha20-ietf-poly1305'] as method}<option>{method}</option>{/each}</select></label>{/if}
 {#if form.protocol==='Snell'}<label class="field">Snell 版本<select bind:value={form.snellVersion}><option value={3}>v3</option><option value={4}>v4</option></select></label>{/if}
 {#if ['AnyTLS','Snell'].includes(form.protocol)}<label class="field">本地桥接端口<input type="number" min="1024" max="65535" bind:value={form.bridgePort}/></label>{/if}
 {#if form.security==='tls'}<label class="field">SNI<input bind:value={form.sni} required/></label><label class="field">ALPN<input bind:value={form.alpn} readonly={form.protocol==='Hysteria2'}/></label><label class="field">Agent 证书文件<input bind:value={form.certificateFile} required placeholder="/etc/aswired/certs/fullchain.pem"/></label><label class="field">Agent 私钥文件<input bind:value={form.keyFile} required placeholder="/etc/aswired/certs/key.pem"/></label>{/if}
</div>
{#if isManagedRealityInbound(form)}<RealityFields bind:form bind:busy/>{/if}
{#if form.protocol==='AnyTLS'||form.protocol==='Snell'}<p class="hint">仅 TCP；不支持原客户端 IP 限额。{form.protocol==='Snell'?'每个监听端口限一个有效订阅。':''}</p>{/if}
{#if form.protocol==='SOCKS5'||form.protocol==='HTTP'}<p class="hint">仅 TCP；账号变更会重载核心，现有连接需要重连。</p>{/if}
<style>.protocol-fields{margin:16px 0}.hint{font-size:12px;color:var(--muted)}</style>
