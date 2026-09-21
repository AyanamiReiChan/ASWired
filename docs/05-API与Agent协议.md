> 当前接入范围（2026-09-16）：服务器仅通过 ASWired Agent 接入，面板 API 适配已移出实施范围；本文相关旧设计只保留追溯。范围冲突时以 [当前实施范围](CURRENT-SCOPE.md) 为准。

> 当前实现说明（2026-09-16）：本文件保留设计目标与历史方案。已实现范围、测试证据和剩余差异以 [实现核对](reference/implementation-audit.json) 及三个仓库的 README 为准；未公开部分已获准采用 ASWired 原创等效实现，不承诺妙妙屋私有协议互通。

# API 与 Agent 协议

> 早期业务草案说明：本文仍保留旧版业务模型或原型交互供参考。自行提出的车主/多租户、AA账本、人工审批及付款流程不是本轮新增要求；角色、套餐和续费等实际行为以[第15份当前矩阵](15-完整功能与PRO对齐矩阵.md)及固定版本核对为准，不据旧稿另设流程。

> 当前决策（2026-09-15）：除PRO商业授权外，采用妙妙屋X的公开设计和固定版本行为，ASWired全部功能不设置付费墙。此前自拟的Agent多进程/mTLS、独立协调器、Vision拷贝替代、离线双策略及JWT刷新方案已撤回；当前节点、运行时、运维与登录规则以[13](13-子Agent详细设计.md)、[16](16-增强运行时与PRO执行设计.md)、[17](17-Agent运维测速与联邦设计.md)、[18](18-自有探针与登录回接设计.md)的0.3修订及[完整矩阵](15-完整功能与PRO对齐矩阵.md)为准。品牌、固定深色、三私有仓、JWT、自有探针和外部仅Komari1.2.5-fix2为用户既定要求。以下业务模型不是上游私有协议声明，尚未实现。


原生 Agent 同时承担 Xray 管理/配额执行与独立的自有主机观测流；观测信封以[第13份设计](13-子Agent详细设计.md)为准。仅外部第三方探针接入限制为 Komari 1.2.5-fix2；公开接口与登录回接以[第18份设计](18-自有探针与登录回接设计.md)为准。

## 用户JWT与原生Agent契约

网站用户采用JWT，公开接口头为 `MM-Authorization`，过期重新登录；签名、claims、浏览器存储和回接细节按[第18份0.3方案](18-自有探针与登录回接设计.md)核对。此前自建的刷新接口、Cookie-only、固定EdDSA和时效规则已撤回。

Agent每台机器使用独立 `agent_token` 与主控 `master_public_key`，按妙妙屋的加密通道认证；不以自建mTLS PKI替代。WebSocket主动连接、HTTP主控直连、Pull拉取与Auto回退保持上游设计。内嵌核心与Agent同进程，外置核心通过gRPC控制。[Agent部署说明](https://miaomiaowux.com/docs/install-agent/)

命令、上报、计数器与恢复的精确字段以[第13份](13-子Agent详细设计.md)和[第16份](16-增强运行时与PRO执行设计.md)0.3方案核对清单为准。此前 `/agent/v1/enroll`、证书轮换、JCS命令信封、owner epoch、有限离线预算和prepare/activate日志协议属于已撤回的自行设计，不能作为上游兼容接口实现。

## 配置与执行结果

配置编辑、下发、历史、回滚、模式切换、启停和升级保持上游公开功能；动态限速保持无需核心重启的执行能力。模式切换涉及Agent重启和外置服务启停，不增加自拟的多进程迁移、双槽或签名离线恢复门槛。操作页面显示实际生效、失败或待核对，不以保存按钮成功代替节点执行结果。

上游完整请求与回复格式、幂等标识、故障重试和升级断电行为尚需固定版本样例，未核对前不能宣称严格幂等或零丢账保证。以下仅保留ASWired业务API草案用于三仓协作；它们不描述上游私有Agent协议。

## 12. ASWired管理API草案

**本节所有路径均为建议实现，不是3X-UI接口。** 使用稳定资源ID而非显示名称；列表用cursor分页并支持filter，默认不返回secret。读取资源返回 `version`/ETag，修改要求If-Match；长任务返回202+operation链接。幂等键按租户、调用主体和接口语义作用域保存，不做全平台一个裸字符串key。

| 领域 | 建议接口 | 关键语义 |
| --- | --- | --- |
| 登录 | `POST /api/v1/session`、`DELETE /api/v1/session`、`POST /api/v1/mfa/verify`、`GET /api/v1/me` | 浏览器cookie使用Secure/HttpOnly及适当SameSite，修改请求有CSRF保护 |
| 工作台 | `GET /api/v1/dashboard`、`GET /api/v1/events?cursor=` | 每项指标带observedAt、freshness和来源 |
| 服务器 | `GET/POST /api/v1/servers`；`GET/PATCH /api/v1/servers/{id}` | 库存字段与运行状态分开 |
| 节点接入 | `POST /api/v1/nodes/enrollment-tokens`；`POST /api/v1/nodes/import-3xui`；`GET /api/v1/nodes` | 引导token只返回一次；导入默认只读预览 |
| 接管 | `POST /api/v1/nodes/{id}/handover-preview`；`POST .../handover` | 明确旧owner、影响、计量切换点和epoch |
| 节点详情 | `GET /api/v1/nodes/{id}`、`.../capabilities`、`.../metrics`、`.../drift` | 管理状态、连接状态、运行状态分别返回 |
| 入站 | `GET/POST /api/v1/nodes/{id}/inbounds`；`PATCH/DELETE /api/v1/inbounds/{id}` | 写的是期望状态，返回交付operation |
| 出站/路由 | `GET/POST /api/v1/nodes/{id}/outbounds`；`PATCH/DELETE /api/v1/outbounds/{id}`；`PUT /api/v1/nodes/{id}/routing` | 适配器在后端编译为3X-UI模板；不让前端直接调用面板 |
| 连接测试 | `POST /api/v1/nodes/{id}/probes` | 普通连通性测试，独立于 Komari 监控探针；目标由授权模板/资源限定 |
| 模板 | `GET/POST /api/v1/templates`；`POST /api/v1/templates/{id}/versions` | 已发布版本不可变 |
| 发布 | `POST /api/v1/deployments/preview`；`POST /api/v1/deployments`；`GET /api/v1/deployments/{id}` | preview包含diff、重启影响、目标策略；create持久化manifest |
| 发布控制 | `POST /api/v1/deployments/{id}/pause`、`.../resume`、`.../rollback` | 回滚新revision，保留最新撤销水位 |
| 套餐 | `GET/POST /api/v1/plans`；`POST /api/v1/plans/{id}/versions` | 修改价格产生新版本，旧订单不变 |
| 权益 | `GET /api/v1/subjects/{id}/entitlements`；`POST /api/v1/entitlements/{id}/suspensions`；`POST .../suspensions/{reasonId}/clear` | 各原因独立清除，不能仅一个enable toggle |
| 拼车组 | `GET/POST /api/v1/carpools`；`GET/PATCH /api/v1/carpools/{id}`；`GET .../{id}/seats` | 组级资源权限和版本校验 |
| 暂留名额 | `POST /api/v1/carpools/{id}/seat-holds`；`DELETE /api/v1/seat-holds/{id}` | 幂等；最后席位数据库事务保护 |
| 加入/退出 | `POST /api/v1/seats/{id}/leave-preview`；`POST .../leave` | 预览费用/截止/配额影响；执行形成新业务事件 |
| 订单 | `POST /api/v1/orders`；`GET /api/v1/orders/{id}`；`POST .../{id}/cancel` | 价格由后端plan快照生成 |
| 支付 | `POST /api/v1/orders/{id}/payment-attempts`；`POST /api/v1/payment-events/{provider}` | 回调验签和去重；前端“支付完成”按钮不当付款事实 |
| 人工核销 | `POST /api/v1/orders/{id}/manual-payment-confirmations` | 财务权限、金额币种、证据、审计；不可覆盖已确认款项 |
| 退款 | `POST /api/v1/orders/{id}/refund-previews`；`POST /api/v1/refunds`；`GET /api/v1/refunds/{id}` | 回执成功前保持进行中/失败状态 |
| AA费用 | `GET/POST /api/v1/billing-periods/{id}/cost-items`；`POST .../{id}/allocation-preview`；`POST .../{id}/allocations` | 冻结参与者和规则；所有金额整数 |
| 账单/账本 | `GET /api/v1/subjects/{id}/statements`；`GET /api/v1/ledger-transactions` | 账本只读，修正走调整接口 |
| 配额 | `GET /api/v1/quota-pools/{id}`、`POST .../{id}/adjustment-previews`、`POST .../{id}/adjustments` | 展示上游额度、用量和动作结果；确切计算口径按固定版本核对 |
| 凭据 | `POST /api/v1/subjects/{id}/credential-rotations`；`POST .../{id}/revocations` | 长任务，逐目标回执 |
| 订阅token | `POST /api/v1/subjects/{id}/subscription-tokens`；`POST /api/v1/subscription-tokens/{id}/revoke` | 明文只在授权创建响应显示一次 |
| 设备 | `GET /api/v1/subjects/{id}/devices`；`DELETE /api/v1/devices/{id}` | 删除登记与撤销代理权限是不同动作 |
| 证书 | `GET/POST /api/v1/certificates`；`POST .../{id}/renewals`；`GET .../{id}/bindings` | 后端Agent/ACME工作流；不虚构3X-UI证书签发API |
| 备份 | `POST /api/v1/backups`；`GET /api/v1/backups/{id}`；`POST /api/v1/restores/preview`；`POST /api/v1/restores` | 恢复为独立高影响任务，输出审计和验证结果 |
| 操作 | `GET /api/v1/operations/{id}`；`POST .../{id}/retry`；`POST .../{id}/cancel` | retry不改变原目标；要改目标应生成新revision |
| 审计 | `GET /api/v1/audit-events`；`GET /api/v1/audit-exports/{id}` | 范围授权、脱敏、导出过期 |

配置preview不是外部执行许可；当用户已授权创建/编辑时可以直接完成可逆交付，是否人工批准由组织策略与操作影响决定。所有服务端副作用由后端授权检查，前端disabled状态只作体验。

### 12.1 外部 Komari 集成与统一公开投影

以下是 **ASWired 自有 API 设计，尚未实现**，不是 Komari 上游路径。已核对的固定 tag 上游入口为 `GET /api/version` 与 `POST /api/rpc2`；认证及响应形态见 [Komari探针接入设计](12-Komari探针接入设计.md)。部署可读性与实际指标仍须实机验收，不套用妙妙屋探针 API 或最新版本文档。

| 范围 | 设计操作 | 约束 |
| --- | --- | --- |
| 管理端 | 配置 Komari 连接、验证版本与可读性、读取候选 UUID、保存服务器绑定 | 供应方固定 Komari，版本固定 1.2.5-fix2；浏览器只得到凭据引用/掩码 |
| 管理端 | 选择原生/Komari主展示源、设置公开开关、服务器白名单、字段白名单，预览结果 | 预览与公开读取使用相同投影逻辑；不转发上游原始响应 |
| 公开端 | 通过第18份HTTP/WS契约读取已发布服务器状态与历史 | 只读且无上游凭据；返回采样时间、新鲜度及来源，不暴露内部 UUID、管理地址或成员数据 |

同步必须区分 `VERSION_MISMATCH`、版本未验证、认证失败、连接失败、数据过期与真实节点离线。`common:getNodes` 的多节点 UUID-keyed 字典及单 UUID 对象分别归一；不可假定为数组。历史粒度、分页、刷新间隔和错误映射按 1.2.5-fix2 样例与实机结果定稿。详见 [Komari探针接入设计](12-Komari探针接入设计.md)。



## 13. Agent API与错误约定

### 13.1 节点协议核对

节点控制面不再实现旧 `/agent/v1/` mTLS与额度租约API。P0按固定上游版本记录WS/HTTP/Pull入口、token/主控公钥、加密握手、错误、命令、状态与流量消息的真实字段，再形成三仓共用契约。公开资料不足时相应工作包保持待核对，不使用旧草案补空。

下节通用业务操作响应仅是ASWired主控的内部/网站草案，不能用它推断上游Agent错误报文格式。

### 13.2 返回结构

同步成功：

```json
{
  "data": {"id": "resource-id", "version": "12"},
  "meta": {"requestId": "request-id", "observedAt": "2026-09-15T04:10:00Z"}
}
```

异步接受（HTTP202）：

```json
{
  "data": {
    "operationId": "operation-id",
    "state": "QUEUED",
    "desiredRevision": "13"
  },
  "meta": {"requestId": "request-id"}
}
```

错误：

```json
{
  "error": {
    "code": "SEAT_CAPACITY_EXHAUSTED",
    "message": "当前拼车组没有可用席位。",
    "retryable": false,
    "details": {"groupId": "group-id"}
  },
  "meta": {"requestId": "request-id"}
}
```

| HTTP | 代表错误码 |
| --- | --- |
| 400 | INVALID_REQUEST、MALFORMED_PAYLOAD |
| 401 | AUTH_REQUIRED、TOKEN_EXPIRED |
| 403 | RESOURCE_FORBIDDEN、AGENT_SCOPE_MISMATCH |
| 404 | RESOURCE_NOT_FOUND（必要时对跨租户资源隐藏其存在） |
| 409 | SEAT_CAPACITY_EXHAUSTED、IDEMPOTENCY_CONFLICT、OWNER_CONFLICT、COMMAND_ID_CONFLICT |
| 412 | VERSION_CONFLICT、CONFIG_DRIFT（If-Match不成立） |
| 422 | UNSUPPORTED_CAPABILITY、INVALID_PLAN_COMBINATION、QUOTA_POLICY_UNSATISFIED、INVALID_CURRENCY |
| 429 | RATE_LIMITED，带Retry-After |
| 502/503 | BACKEND_UNAVAILABLE、BACKEND_CONTRACT_MISMATCH；异步任务则在target错误中表达 |

节点离线不是伪造成功，也不必把已持久化交付任务整体返回500。202表示任务已接收，后续target可NODE_PENDING。错误详情给backend_name和request_id，不原样透出含凭据的URL、Xray配置或服务端堆栈。

**操作摘要：** `state`、目标总数/成功/待同步/失败、`requiredTargetsSatisfied`、`serviceUsable`、`desiredRevision`、`observedRevision`、最近事件。APPLIED终态要求验证通过；PARTIAL仍可重试。前端据此展示“2/3节点已生效；香港节点待恢复”，不能仅一个绿色完成点。



## 其他领域接口归属

`/api/v1/subscription-sources` 管理来源；`/{id}/sync-previews` 先预览解析差异，再 `/{id}/sync-runs` 入队。`/api/v1/subscription-files` 管理渲染文件，`/{id}/builds` 生成版本。`/api/v1/rule-sets` 与 `/script-versions` 管理不可变版本及隔离编译。`/api/v1/federation-peers` 管理主控关系和作用域，`/{id}/share-tokens` 独立轮换。`/api/v1/sites`、`/ddns-records`、`/forwardings`、`/probe-runs`、`/notification-rules`、`/announcements`、`/backup-targets`、`/migration-runs` 使用同样的读取版本、预览、幂等提交和 operation 查询约定。

全部新接口均为本项目草案。附录 OpenAPI 仅覆盖服务器、拼车暂留、分摊预览、订阅凭据与 operation 等核心契约；其他领域在实现对应模块时继续扩展，不宣称与上游 API 兼容。
