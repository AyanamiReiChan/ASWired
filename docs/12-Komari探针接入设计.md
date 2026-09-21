> 当前实现说明（2026-09-16）：本文件保留设计目标与历史方案。已实现范围、测试证据和剩余差异以 [实现核对](reference/implementation-audit.json) 及三个仓库的 README 为准；未公开部分已获准采用 ASWired 原创等效实现，不承诺妙妙屋私有协议互通。

# Komari 探针接入设计

版本：设计 1.2 / 2026-09-15。本文件只定义外部第三方探针接入，唯一外部供应方为 **Komari**，支持目标固定 **1.2.5-fix2**。当前交付是设计与前端演示，没有真实 Komari 连接、服务端适配器或指标同步。

## 1. 范围与职责

- Komari 负责其自身采集与节点管理，ASWired 通过后端只读适配展示获准数据；不部署 Komari 也能使用 ASWired 自有探针。
- ASWired 自有 Agent 采集、内置及独立探针页、API/WS历史和登录回接均保留，见[自有探针设计](18-自有探针与登录回接设计.md)。仅外部第三方供应商限制为 Komari；独立部署自有页面不算第三方供应商。
- 原生 Agent 同时提供独立的主机观测，并继续负责配置、回执、证书和配额执行；3X-UI 适配不变。Komari 探针连接不接管 Xray，也不执行远端命令。
- 账务计量使用 Xray/3X-UI 权威计量链路，不能把 Komari 主机网卡流量作为成员消费。普通 TCP 延迟、连通性和有限下载测速保持独立测量来源。

## 2. 固定版本与已核实契约

基线为 [官方发布 1.2.5-fix2](https://github.com/komari-monitor/komari/releases/tag/1.2.5-fix2)，tag 无 `v` 前缀，commit `2f70b440405c4ea70ff3bcbd87361bbb39dc6f60`。只根据该 tag 实现，不将后续版本能力视为已支持。

| 上游入口 | 固定 tag 事实 | ASWired 使用约束 |
| --- | --- | --- |
| `GET /api/version` | 返回 `{status:'success', message:'', data:{version, hash}}`，可匿名读取 | 校验返回形态、版本与来源；版本未知或不匹配不能进入已验证状态 |
| `POST /api/rpc2` | JSON-RPC，支持单请求与批请求；同路径 GET 为 WebSocket 传输 | 首期后端只调用所需只读方法；是否使用批请求/WS 由实测确定 |
| `common:getNodes` | 多节点结果是按 UUID 索引的字典；查询单 UUID 时是单对象 | 分别归一，按 UUID 建立稳定服务器绑定；不能当数组 |
| `common:getNodesLatestStatus` | 固定 tag 提供该只读方法 | 指标字段、缺值、时间戳语义及可见范围按实机结果映射 |
| `GET /api/nodes` | 对应 `public:getNodesInformation`，结果仍为数组 | 不与 `common:getNodes` 混用解析器或假定字段/权限相同 |

认证支持 `Authorization: Bearer <API Key>` 或管理员 `session_token`。公开站点的 common/public 读取可匿名，私有站点要求认证；`/api/version` 可匿名。ASWired 优先使用后端持有的 API Key，实际可读范围按部署模式验收。即使上游凭据拥有写权限，ASWired 探针适配器也只调用经过核实的只读方法，不能因此宣称上游密钥天然为只读。

固定源码：[路由](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/router/router.go)、[版本与公共方法](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/rpc/jsonrpc/public.go)、[响应包装](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/rpc/jsonrpc/bridge.go)、[传输](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/rpc/jsonrpc/transport.go)、[common 方法](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/rpc/jsonrpc/common.go)、[认证](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/api/principal.go)、[访问控制](https://github.com/komari-monitor/komari/blob/1.2.5-fix2/web/rpc/jsonrpc/dispatch.go)。源码核对不等于实机验收。

## 3. 接入与数据流程

```text
Komari 采集端 → Komari 1.2.5-fix2 → ASWired 后端只读适配
  → UUID / 服务器库存绑定 → 指标快照（采样时间、新鲜度、来源）
  → 服务器白名单 + 字段白名单 → ASWired /probe
```

管理端配置面板地址和服务端凭据引用；供应方、支持版本固定显示。后端依次验证版本、认证与可读性，列出候选节点 UUID，再由管理员确认库存绑定。名称或地址变化不应重建绑定；未绑定、重复绑定或缺失 UUID 的节点不自动公开。关联同一服务器时，不混淆 Komari UUID 与 Xray runtime/成员 credential 的身份。

原生与 Komari 的绑定、状态、历史按来源分别保存；管理员选择主展示源，切换留审计与历史断点，不在故障时静默切源。Komari 连接状态分为未配置、未验证、就绪、版本不匹配、认证失败和连接失败；指标另记新鲜、过期或未知。同步失败保留上次快照及原采样时间，但不可当作实时数据；不能将 Komari 服务断连等同所有主机离线。版本不匹配时停止同步，显示不匹配，不自动升级或切换供应方。

Komari 上游历史范围、粒度、轮询间隔与速率限制按 1.2.5-fix2 实机结果定稿。ASWired 自有服务提供5秒更新目标和1h/6h/24h查询窗口，也可从接入时开始保存 Komari 的本地观测历史；必须保留来源采样时间和缺口，重复快照不能冒充新采样，不能补造接入前历史。

## 4. 公开展示与隐私

公开默认关闭。管理员选择发布的服务器和字段后，后端重新构造只读投影；不返回 Komari 原始对象，浏览器不携带上游 API Key，也不直连上游管理接口。

候选字段为显示名、地区、在线状态、CPU/内存/磁盘占用、网络速率、采样时间与新鲜度，以固定版本实测可用字段为准。缺失显示未知，不以 0 填充。管理地址、服务器地址、内部 UUID、凭据、成员资料、来源 IP、订阅链接和费用账单不进入公开投影。取消服务器/字段授权或关闭公开后，相关缓存必须失效。

## 5. 原型与实施验收

演示页默认开启以展示样例；正式部署的公开展示默认关闭。当前前端仅保存面板地址、凭据引用和公开范围的演示设置，展示合成指标。真实 API Key 不进入 localStorage；演示反馈只说明已保存演示设置，不显示真实连接验证成功。

真实接入至少验收：

1. 固定版本可读；不同版本、无版本、错误凭据、私有站点和不可达分别报告状态。
2. 多节点字典、单 UUID 对象与 public 数组按各自契约解析；重命名保持绑定，未绑定节点不公开。
3. 缺字段、空结果、过期样本、断连和恢复保持正确时间与未知状态；实际历史能力有记录。
4. 公开白名单、撤回与缓存失效生效；浏览器响应和日志不出现上游凭据或管理信息。
5. 探针同步及故障不写 Xray 配置，不增加、扣减或修正成员账本与配额。
6. 无 Komari 时原生探针仍可用；双来源不混算，故障不自动切源；Komari 凭据不能作为 ASWired 登录回接凭据。

只有上述契约及实机验收通过后，才能将该环境标记为“已接入 Komari 1.2.5-fix2”。
