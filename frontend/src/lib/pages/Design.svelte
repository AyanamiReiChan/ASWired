<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import AppSelect from '../components/Select.svelte';
  import {onMount} from 'svelte';
  type Mapping={id:string;domain:string;title:string;target_behavior:string;entry_kind:string};
  let alignment=$state<{mappings:Mapping[]}>({mappings:[]}),loadError=$state('');
  onMount(()=>{fetch('/docs/reference/aswired-alignment.json').then(r=>{if(!r.ok)throw new Error('无法读取设计矩阵');return r.json();}).then(data=>alignment=data).catch(cause=>loadError=cause.message);});
  import { KOMARI_VERSION, KOMARI_RELEASE_URL } from '../probe';

  let search = $state(''), domain = $state('全部领域');
  const documents = [
    '00-阅读索引', '01-产品与完整功能设计', '02-参考功能覆盖矩阵',
    '03-系统架构与部署', '04-数据模型与状态机', '05-API与Agent协议',
    '06-拼车套餐流量与账务规则', '07-前端页面与交互规范', '08-安全权限与可靠性',
    '09-实施里程碑与验收', '10-原型使用与演示场景', '11-来源与版本基线',
    '12-Komari探针接入设计', '13-子Agent详细设计', '14-三仓拆分与协作设计',
    '15-完整功能与PRO对齐矩阵', '16-增强运行时与PRO执行设计',
    '17-Agent运维测速与联邦设计', '18-自有探针与登录回接设计',
    '19-主控后端详细设计', '20-主控全功能验收清单',
  ];
  const filtered = $derived(alignment.mappings.filter(f =>
    (domain === '全部领域' || f.domain === domain) &&
    (f.title + f.target_behavior + f.id).toLowerCase().includes(search.toLowerCase())
  ));
</script>

<div class="page-head">
  <div>
    <div class="eyebrow">项目设计 / ASWired</div>
    <h1>从设计到连接</h1>
    <p>核对 ASWired 主控、Agent 与网站的设计和实现，全部功能不设付费墙。</p>
  </div>
  <a class="button primary" href="/docs/19-主控后端详细设计.md" download><Icon name="download"/>下载主控设计</a>
</div>
{#if loadError}<p class="error" role="alert">{loadError}</p>{/if}<div class="stat-grid">
  <div class="card stat-card"><span class="muted">功能与细化验收</span><div class="stat-number">{alignment.mappings.length}<small> 项</small></div><small class="muted">146 项原始记录 + 22 项细化</small></div>
  <div class="card stat-card"><span class="muted">前端展示</span><div class="stat-number">23<small> 页</small></div><small class="muted">已连接主控 API，能力以实际实现为准</small></div>
  <div class="card stat-card"><span class="muted">完整设计文档</span><div class="stat-number">{documents.length}<small> 份</small></div><small class="muted">主控、Agent 与逐项验收</small></div>
  <div class="card stat-card"><span class="muted">交付边界</span><div class="stat-number" style="font-size:1.4rem">持续实现</div><small class="muted">主控能力与 Agent 回报决定可用范围</small></div>
</div>
<section class="card padded">
  <div class="section-head"><h2>本轮主控设计</h2><span class="muted">配套 Agent v0.3</span></div>
  <p>主控设计说明各模块和 Agent 的配合；验收清单逐项保留职责、真实验证要求及待核对细节。</p>
  <div class="actions space-top">
    <a class="button" href="/docs/CURRENT-SCOPE.md" target="_blank" rel="noreferrer"><Icon name="book"/>当前实施范围</a>
    <a class="button" href="/docs/19-主控后端详细设计.md" download><Icon name="book"/>主控详细设计</a>
    <a class="button" href="/docs/20-主控全功能验收清单.md" download><Icon name="book"/>全功能验收清单</a>
    <a class="button" href="/docs/13-子Agent详细设计.md" download><Icon name="book"/>配套 Agent 设计</a>
    <a class="button" href="/docs/reference/implementation-audit.json" download><Icon name="download"/>实现核对</a>
    <a class="button" href="/docs/REFERENCES.md" target="_blank" rel="noreferrer"><Icon name="book"/>参考来源</a>
  </div>
</section>
<section class="card padded space-top">
  <div class="section-head"><h2>设计文档</h2><span class="muted">当前实施范围优先，设计草案保留供追溯</span></div>
  <div class="quick-grid">{#each documents as doc}<a class="button" href={`/docs/${doc}.md`} download><Icon name="book"/>{doc.slice(3)}</a>{/each}</div>
</section>
<section class="card padded space-top">
  <div class="section-head"><h2>Komari 探针与登录回接</h2><a class="quiet-link" href={KOMARI_RELEASE_URL} target="_blank" rel="noreferrer">Komari 版本 <Icon name="external" size={12}/></a></div>
  <p>主机监控和历史固定使用 Komari {KOMARI_VERSION}，Native 采集已移除。ASWired Agent 负责配置、任务和 Xray 计费，主控保留公开展示权限与统一登录。</p>
  <div class="actions space-top">
    <a class="button" href="/docs/18-自有探针与登录回接设计.md" download>自有探针与登录回接</a>
    <a class="button" href="/docs/12-Komari探针接入设计.md" download>Komari 接入设计</a>
  </div>
</section>
<div class="section-head space-top"><div><h2>功能对齐范围</h2><p class="muted">覆盖 15 个领域；以下为设计目标，当前实现与剩余差异见实现核对。公开资料不足的部分须核对固定版本。</p></div></div>
<div class="card no-pad">
  <div class="toolbar">
    <div class="search-input"><Icon name="search"/><input bind:value={search} placeholder="搜索功能，例如：备份、流量、订阅…" aria-label="搜索功能覆盖"/></div>
    <AppSelect bind:value={domain} options={['全部领域', ...new Set(alignment.mappings.map(f => f.domain))]} aria-label="功能领域"/>
  </div>
  <div class="table-scroll"><table>
    <thead><tr><th>功能</th><th>领域</th><th>设计范围</th></tr></thead>
    <tbody>{#each filtered as f}<tr>
      <td><strong>{f.title}</strong><small class="muted" style="display:block">{f.entry_kind === 'baseline_mapping' ? '原始功能' : '细化验收'}</small></td>
      <td>{f.domain}</td>
      <td style="max-width:40rem;min-width:12rem;white-space:normal">{f.target_behavior}</td>
    </tr>{/each}</tbody>
  </table></div>
  <div class="table-footer">{filtered.length} / {alignment.mappings.length} 项 · 设计覆盖不代表功能已实现</div>
</div>
