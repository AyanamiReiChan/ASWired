# RayNo1：3X-UI 官方能力与适配审查

审查日期：2026-09-15（Asia/Shanghai）。本报告区分**官方已实现能力**与**RayNo1 建议设计**。依据仅为 MHSanaei/3x-ui 官方仓库、仓库内官方文档、官方发布页及 docs.sanaei.dev；未安装、启动面板、执行安装脚本或调用真实服务器 API。接口为静态源码和 OpenAPI 核对，尚未做目标服务器端到端兼容测试。

## 1. 固定版本与结论

| 项目 | 核对结果 |
| --- | --- |
| 官方仓库 | [MHSanaei/3x-ui](https://github.com/MHSanaei/3x-ui) |
| 当前最新稳定发布 | [v3.8.0](https://github.com/MHSanaei/3x-ui/releases/tag/v3.8.0)，发布页显示 2026-09-14 |
| 本报告固定提交 | [`837addf66e945a80080273b5d2a315dea765d748`](https://github.com/MHSanaei/3x-ui/commit/837addf66e945a80080273b5d2a315dea765d748) |
| 抓取时 main | `a810f497e6ed3915ba58413dd64a64e619f987ad`，比稳定版多一个修复；本报告未把它算作稳定能力 |
| 发布说明中的内置 Xray | v26.9.9；具体已部署服务器的核心仍需单独探测 |
| 许可证 | [GNU GPL v3 / GPL-3.0](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/LICENSE)；它不是 MIT/Apache |
| 研究副本 | 独立研究环境中的上游只读副本，checkout 为上述 v3.8.0 提交；不随本仓库分发 |
| OpenAPI 文件 | `docs/public/openapi.json`，SHA-256：`76E35FEC5827CC438C465645F9ABCE83E2604366F4D819C7ACC73AC3FDB6F540` |

**建议：RayNo1 自建业务控制面、订阅网关及 Agent，把 3X-UI 用作有明确边界的过渡执行后端。** 3X-UI 已有多节点、客户端跨入站关联、全局流量汇总、配额与到期、订阅、管理 API 和监控；无需重复声称这些基础能力缺失。需要自建的是拼车项目、席位、付款与退款状态、计费账本、权益版本、跨节点交付任务和严格的配额分配策略。

官方 README 明示个人用途，并不建议用于生产环境。这是上游的运行支持定位，不应改写为 GPL 禁止商业用途；RayNo1 的生产可靠性目标需要自己实现和验收。[固定版本 README](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/README.md)

### 文档与版本偏差

1. 审查时 [官方文档首页](https://docs.sanaei.dev/)仍显示 v3.7.0，官方 GitHub 最新发布已为 v3.8.0。
2. API 总览仍泛称 token 为 full-admin，实际有 `admin`、`monitor`、`node-sync` 范围。[鉴权实现](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/api.go)
3. 出站文档仍有“没有独立规则 UI，只编辑 JSON”的陈述；固定版实际有 [RoutingTab](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/frontend/src/pages/xray/routing/RoutingTab.tsx)、[RuleFormModal](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/frontend/src/pages/xray/routing/RuleFormModal.tsx) 和出站表单。后端存储和提交仍围绕完整 Xray 模板。
4. 客户端文档对 TUIC 的配额/IP 功能标有例外，发布说明和后端又有 TUIC 客户端计量、通用禁用路径。应把 TUIC 配额/IP 作为待专项实测能力，首批不要按所有协议完全等价承诺。

## 2. 官方能力矩阵

| 范畴 | v3.8.0 已有能力 | RayNo1 的边界/处理 |
| --- | --- | --- |
| 服务器与节点 | 一个 master 管多个 3X-UI 节点；稳定 panel GUID；状态、版本、CPU/内存、流量、心跳；可按全部或选中 tag 导入入站；节点可以有只读展示的传递子节点 | 不是通用云服务器供应、任意主机 Agent 或基础设施库存。云厂商账单、SSH引导、系统配置基线仍由 RayNo1 负责 |
| 节点信任 | HTTPS 验证、证书 pin、mTLS、Bearer；节点 token 写入后 API 仅返回是否存在；节点 token 可配置静态加密 | 明确配置验证方式与密钥加密，默认 `NODE_TOKEN_ENCRYPTION=off` 不等于已加密；受管节点只保留一个写入权威 |
| 入站 | VLESS、VMess、Trojan、Shadowsocks、WireGuard、AmneziaWG、TUIC v5、Hysteria2、MTProto、HTTP、Mixed/SOCKS、Tunnel/Dokodemo-door、TUN；增删改、开关、批量、导入、fallback、流量和到期 | 协议能力受核心、sidecar、传输、安全配置共同约束；首批能力开关应按节点探测 |
| 传输与安全 | Raw/TCP、mKCP、WebSocket、gRPC、HTTPUpgrade、XHTTP；TLS、XTLS、REALITY | 模板应声明支持的协议/核心版本，不把每个传输与协议作笛卡尔积展示 |
| 出站与路由 | 手工出站、路由、DNS、负载均衡、observatory、链式转发；WARP、NordVPN、PIA；导入远端订阅成为运行时出站池；连通性、路由、balancer 测试 | 出站池订阅与用户订阅是两种资源。不存在可假定的 `/outbounds/add` 通用 CRUD，普通出站变更走 Xray 模板保存 |
| 客户端 | `email` 为面板内唯一标识；客户端一等记录可关联多个入站；UUID/password/auth/隧道密钥；启停、分享、二维码、批量、分组、外部链接 | 面板 client 不等于 RayNo1 登录用户、付款人或席位。建议一席位一稳定 client identity，多节点/入站映射独立保存 |
| 限额与到期 | 客户端总量、入站总量、固定到期、首次使用后开始、周期重置、日历续期、续期次数限制；达到条件自动禁用 | 有最终一致的跨节点全局计量与禁用；无支付成交、金额账本、席位名额事务；不要把计数器当不可变账本 |
| 在线与 IP | 在线/最近在线、按 GUID 归属、客户端 IP、清理 IP；IP 上限依赖 Fail2ban | IP 数不等于人数或设备数；NAT、IPv6地址变化、漫游和旧节点兼容都会影响解释 |
| HWID | 订阅请求读取 `X-HWID`，按 subId 登记设备槽；查询和删除登记；只读槽位状态 | 不是 Xray 数据连接的硬件证明；原始配置下载后的复制使用不因此自动失效 |
| 用户订阅 | 独立订阅服务；原始链接/base64、Xray JSON、Clash/Mihomo、legacy Clash；UA检测、信息页、响应头、品牌模板、Hosts覆盖 | 不同协议输出能力不同；换订阅 token 只阻止后续拉取，撤销现有连接还需撤销/轮换代理凭证 |
| API | cookie+CSRF、Bearer token、mTLS节点权限；面板内 OpenAPI；管理读写、监控、批量操作 | token scope 并非租户 RBAC；大量操作 HTTP 200 仍可能 `success:false`；多入站修改允许部分成功 |
| Telegram/Discord/SMTP | 管理命令、自助流量和链接、监控事件、到期与额度告警、定时报告、备份 | 不等于订单通知工作流、付款核销、团长审批；RayNo1 以自己事件记录驱动业务通知 |
| 证书 | 面板/订阅/入站 TLS；本地 ACME/Cloudflare DNS-01 菜单；证书路径、hash、REALITY相关密钥辅助接口 | 本次核对没有发现通用远程“签发/续期/吊销证书 REST API”。自动签发和部署由 Agent/ACME承担 |
| 备份 | 下载数据库和运行配置；SQLite/PostgreSQL；上传恢复；Bot备份；迁移工具 | 数据库之外还需证书、环境配置、静态密钥加密 keyring、版本清单；整库恢复会重启，不能作为单订单回滚 |
| Xray生命周期 | 状态、版本、停止/重启、核心安装、面板更新、日志、geodata、配置模板和运行配置 | 热更新与重启视变更类型和运行状态而定，不承诺全部无损；配置发布要健康检查和回滚 |

能力来源：[多节点](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/operations/multi-node.mdx)、[客户端](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/config/clients.mdx)、[出站/路由](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/operations/outbounds-routing.mdx)、[证书](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/config/ssl-certificates.mdx)、[备份](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/operations/backup-restore.mdx)。

## 3. 经过核对的管理接口

下列路径均为**官方现有接口**。面板有自定义 `webBasePath` 时，实际请求前要拼接该路径；不能把 `https://host/panel/api/...` 固定为根路径。`{email}` 等参数应作为一个路径段编码。具体参数定义以固定版本 [OpenAPI](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/public/openapi.json) 和控制器为准。

| 操作 | 方法和路径 |
| --- | --- |
| 登录、CSRF | `POST /login`；`GET /csrf-token`；`POST /logout` |
| 自描述接口 | `GET /panel/api/openapi.json` |
| Token管理 | `GET /panel/api/setting/apiTokens`；`POST .../apiTokens/create`；`POST .../apiTokens/delete/{id}`；`POST .../apiTokens/setEnabled/{id}` |
| 节点读取 | `GET /panel/api/nodes/list`；`GET .../nodes/get/{id}`；`GET .../nodes/history/{id}/{metric}/{bucket}` |
| 节点写入 | `POST /panel/api/nodes/add`；`POST .../nodes/update/{id}`；`POST .../nodes/del/{id}`；`POST .../nodes/setEnable/{id}` |
| 节点验证 | `POST /panel/api/nodes/test`；`POST .../nodes/probe/{id}`；`POST .../nodes/inbounds`；`POST .../nodes/certFingerprint` |
| mTLS | `POST /panel/api/nodes/mtls/ca`；`POST .../mtls/trustCA`；`POST .../mtls/reloadClient` |
| 入站查询 | `GET /panel/api/inbounds/list`、`.../list/slim`、`.../options`、`.../get/{id}`、`.../allLinks` |
| 入站写入 | `POST /panel/api/inbounds/add`、`.../update/{id}`、`.../del/{id}`、`.../bulkDel`、`.../setEnable/{id}`、`.../import` |
| 入站流量 | `POST /panel/api/inbounds/{id}/resetTraffic`；`POST .../inbounds/resetAllTraffics`；`POST .../inbounds/pushClientTraffics` |
| 客户端查询 | `GET /panel/api/clients/list`、`.../list/paged`、`.../get/{email}`、`.../traffic/{email}` |
| 客户端创建/修改/删除 | `POST /panel/api/clients/add`、`.../update/{email}`、`.../del/{email}` |
| 关联入站 | `POST /panel/api/clients/{email}/attach`；`POST .../{email}/detach`；`POST .../bulkAttach`；`POST .../bulkDetach` |
| 批量与迁移 | `POST /panel/api/clients/bulkCreate`、`.../bulkEnable`、`.../bulkDisable`、`.../bulkDel`、`.../bulkAdjust`、`.../import`；`GET .../export` |
| 流量操作 | `POST /panel/api/clients/resetTraffic/{email}`、`.../bulkResetTraffic`、`.../updateTraffic/{email}`、`.../resetAllTraffics` |
| 在线/IP | `POST /panel/api/clients/onlines`、`.../onlinesByGuid`、`.../lastOnline`、`.../activeInbounds`、`.../ips/{email}`、`.../clearIps/{email}`、`.../clientIpsByGuid` |
| HWID | `POST /panel/api/clients/hwids/{email}`；`DELETE .../hwids/{email}`；`DELETE .../hwids/{email}/{id}` |
| 分享与订阅 | `GET /panel/api/clients/links/{email}`；`GET .../subLinks/{subId}`；`POST .../{email}/externalLinks` |
| 分组 | `GET /panel/api/clients/groups`；`GET .../groups/{name}/emails`；`POST .../groups/create`、`.../rename`、`.../delete`、`.../resetTraffic` |
| Xray模板读取/保存 | `POST /panel/api/xray/`；`POST /panel/api/xray/update` |
| Xray运行配置/状态 | `GET /panel/api/server/getConfigJson`；`GET /panel/api/server/status`；`GET /panel/api/xray/getXrayResult` |
| 出站流量/测试 | `GET /panel/api/xray/getOutboundsTraffic`；`POST .../resetOutboundsTraffic`、`.../testOutbound`、`.../testOutbounds`、`.../routeTest`、`.../balancerStatus`、`.../balancerOverride` |
| 出站订阅池 | `GET/POST /panel/api/xray/outbound-subs`；`POST .../outbound-subs/{id}`；`DELETE .../outbound-subs/{id}`；`POST .../{id}/refresh`；`POST .../outbound-subs/parse` |
| 设置 | `POST /panel/api/setting/all`；`POST .../setting/update`；`POST .../setting/restartPanel` |
| 核心启停/更新 | `POST /panel/api/server/stopXrayService`；`POST .../restartXrayService`；`POST .../installXray/{version}`；`POST .../updatePanel` |
| 版本、日志 | `GET /panel/api/server/getXrayVersion`；`GET .../getPanelUpdateInfo`；`POST .../logs/{count}`；`POST .../xraylogs/{count}` |
| 证书辅助 | `GET /panel/api/server/getWebCertFiles`；`GET /panel/api/nodes/webCert/{id}`；`POST /panel/api/server/getCertHash`；`POST .../getRemoteCertHash` |
| 备份/恢复 | `GET /panel/api/server/getDb`；`GET .../getMigration`；`POST .../importDB`；`POST /panel/api/backuptotgbot` |

没有在这个版本的已注册接口中发现旧教程常见的 `/panel/api/inbounds/addClient`、`.../updateClient/{uuid}`、`.../getClientTraffics/{email}`。适配 v2.x 时要单独实现 legacy profile，不能把旧接口混进 v3.8.0 文档。

来源：[客户端路由](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/client.go#L58)、[入站路由](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/inbound.go#L78)、[Xray路由](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/xray_setting.go#L44)。完整方法/路径清单另见同目录 `3x-ui-api-method-paths.txt`。

### 3.1 鉴权和权限的准确含义

- Bearer token 创建后只返回一次明文，数据库存 SHA-256；可禁用、删除、设置过期时间。
- `admin` 可做完整管理；`monitor` 只允许状态/指标/部分版本和历史接口，**不能**用它读取全体客户和代理凭证。
- `node-sync` 有明确方法与路由白名单，包括必要的入站/客户端增删改、统计、重启等；它不是一般应用的细粒度权限集合，也不包括所有 client 查询及 Xray模板配置接口。
- 已验证 mTLS 客户端证书在 API 中取得 `node-sync` scope，**不是 admin**。
- API token 的执行身份取面板第一位用户；没有本次可见的“给 token 限定某个拼车组/席位”的资源权限。因此用户浏览器和团长账户不应持有面板 token。
- Cookie 模式修改请求要处理 CSRF；已鉴权 Bearer/mTLS 请求绕过该 CSRF步骤。v3.8.0 对错误 Bearer 返回 401；普通匿名扫描可能返回 404；scope不足返回403。实际适配必须分类鉴权失败、路径错误和业务失败。

依据：[鉴权与scope](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/api.go#L35)、[Token实现](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/panel/api_token.go)。

### 3.2 写入契约和失败语义

1. **读取也有多个对象形态。** 入站 `settings`、`streamSettings`、`sniffing` 读取为嵌套 JSON；写入兼容对象和旧的JSON字符串。`clients/get/{email}` 外层是 `client`、`inboundIds` 等；记录中的 `id` 是数据库数字主键，`uuid` 才是代理身份，提交 `model.Client` 时 UUID 字段名是 `id`。适配器应明确映射，不能把读取对象原样回传。
2. **`clients/update/{email}` 不是 PATCH。** 应读取最新记录、映射并保留所有需要保持的字段后提交。漏掉 enable、凭证、subId、续期参数等可能改变其值。
3. **HTTP 200 不表示业务成功。** 通用响应包含 `success`、`msg`、`obj`。应检查 JSON里的 `success`，不能仅检查状态码。
4. **多入站 create/update 可部分成功。** 无效 inboundId 在写前拒绝；通过初始验证后，各入站并发独立执行，失败返回可能仍已在别处创建或修改。错误带入站编号；client record 还可能在入站更新后保存失败。创建时 `limitHwid` 仅在全部成功后应用。
5. `obj.nodePending=true` 表示本地已存、远程节点离线/禁用等待同步；这不是交付完成。RayNo1 状态应显示“等待节点同步”。
6. 创建可能由服务端生成凭证；已有 email 与其 subId 配合时复用身份。Shadowsocks2022 的错误长度密钥还可能被自动重生成。必须读回记录核对；未知结果重试不能重新生成凭证。
7. 没发现标准通用 `Idempotency-Key`、`If-Match` 乐观并发接口或持久化业务 webhook 契约。已有 WebSocket 与内部事件不能代替可靠订单消息队列。该结论限定于本次公开接口/控制器审查，不宣称上游所有内部调用都没有去重。

依据：[完整 OpenAPI契约](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/public/openapi.json)、[响应和nodePending](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/util.go#L157)、[Client与ClientRecord字段](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/database/model/model.go#L875)。

### 3.3 单位、续期和重置

| 字段/行为 | 必须采用的解释 |
| --- | --- |
| 客户端 `totalGB` | 尽管名字含GB，API值是 **bytes**；例如 `53687091200` 为50 GiB |
| 入站 `total`、流量 `up/down/total` | bytes；0配额表示不限量 |
| `expiryTime` | 正数 Unix毫秒；0不限时；负数为首次使用后的持续时间（毫秒取负） |
| `Subscription-Userinfo.expire` | Unix秒，不能直接填毫秒 |
| `reset` | 自动续期周期天数；与 `resetDay` 日历续期、`resetMax` 次数上限区分 |
| `trafficReset` | 独立流量重置周期 `never/hourly/daily/weekly/monthly`，月重置还有 `trafficResetDay` |
| `bulkAdjust` | `addDays`、`addBytes`为增量，可为负；无限额度/到期不会因此自动变有限；有些自动耗尽停用客户会被重新启用 |
| resetTraffic/bulkResetTraffic | 源码会尝试重新启用原已停用客户；不能当作无副作用统计清零 |

RayNo1 续费完成应生成新的绝对权益快照并幂等交付。不要在可自动重试任务中盲调 `bulkAdjust +30days`，也不要用每月“重置流量”代替生成新的账期。手动停用、退款停用、风控停用必须保留独立原因，避免面板重置重新放行。

依据：[流量模型与自动续期](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/inbound_traffic.go)、[重置实现](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/client_traffic.go#L15)。

## 4. 跨节点配额、IP及订阅的真实边界

### 跨节点配额已有，但不等于同步交易约束

3X-UI master 拉取节点统计、维护增量基线、汇总同一 email 的使用量，并将全局量推回节点作为显示和禁用依据。本版全局推送间隔为30秒；IP同步间隔10秒；节点请求超时和并发也在任务中有上限。全局记录超过24小时未更新不再参与判定。节点 `inbounds/list` 的统计快照与全局 overlay 的UI读数有区别，混着采集会产生重复计量。

所以“同一套餐100GB，在3台独立服务器各写100GB”不构成严格共享100GB。即便使用官方master全局同步，断连和采样间隔仍产生超用窗口；这里没有发现业务层跨节点字节预算租约协议。需要硬预算时，RayNo1必须分配有限的节点额度片段，只有拿到新额度才能继续使用，或采用每席位固定节点预算。前端应明示“统计截至时间”“待同步”“配额模式”，不能把离线数据显示为零。

来源：[统计同步任务](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/job/node_traffic_sync_job.go#L20)、[全局统计overlay](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/inbound_traffic_global.go#L16)、[24小时判定与禁用](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/inbound_disable.go#L35)。

### 分组不是拼车账务模型

`ClientGroup` 有名称、统计重置基线与时间字段，客户端可按组批量操作；本次模型没有组席位容量、付款人、拼车账期、共享预算额度、保留名额或退款分账。可把 group 作为 RayNo1拼车组的标签映射，不能反过来以 group 作为业务真相源。[模型](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/database/model/model.go#L959)

### IP限制与HWID

IP限制基于 Fail2ban 和日志；Docker 缺必要网络capability时可能只写封禁日志而未实际阻断。HWID门禁读取客户端自行提供的请求头，限制订阅拉取时注册的槽位；没有合适HWID时会拒绝受限订阅。它不证明设备身份，也不能阻止配置文件被复制。`/{subPath}{subid}/hwid-status` 是槽位只读计数接口，不消耗槽位。[Fail2ban说明](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/operations/security.mdx)、[HWID实现](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/client_hwid.go#L105)、[订阅门禁](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/sub/controller.go#L683)

### 订阅输出与撤销

- 订阅服务与管理面板分开监听，默认端口2096；新面板订阅路径随机。
- Base64原始链接、XrayJSON、Mihomo YAML、legacy Clash不是完全等价的渲染器。TUIC、AmneziaWG不输出到XrayJSON；MTProto只在原始链接；legacy Clash会排除VLESS、Reality、Hysteria2、XHTTP等，不兼容节点为空时返回422。
- XrayJSON单配置返回对象、多配置返回数组；订阅网关不能假定固定数组形态。
- HWID、品牌页、UA、`Subscription-Userinfo` 是交付附属功能；没有“所有用户客户端支持全部头”的保证。
- 一个用户的订阅token泄露时，旋转订阅URL不足以撤销已下载的UUID/password。RayNo1撤销应同时更新代理凭证、节点权限和订阅网关缓存。

来源：[订阅规格](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/config/subscription.mdx)。

## 5. 推荐的 RayNo1 控制面 + Agent + 适配器方案

以下为**本报告建议设计，不是3X-UI已存在接口或保证**。

```text
管理员/团长/成员浏览器
        ↓ RayNo1登录与资源权限
RayNo1控制面 ── 关系库：拼车组、席位、订单、权益、账本、审计
        ├── 订阅网关：独立token、格式渲染、撤销、访问记录
        ├── 交付任务/Outbox：desired revision → reconciliation
        ├── 3X-UI适配器 → 一个受管master → 其3X-UI节点
        └── Agent通道 → RayNo1自管节点 → Xray/辅助进程
                          ↑ 指标、回执、配置hash、计数器epoch
```

### 权责划分

| 层 | 应拥有的状态 |
| --- | --- |
| RayNo1控制面 | 登录、角色、服务器库存、可售拼车组、席位锁定、订单、付款事实、账期、权益和暂停原因；这是业务真相源 |
| 订阅网关 | 每席位的独立可撤销token、节点选择、客户端格式能力、下载日志、缓存版本；浏览器不直接拿3X-UI管理token |
| 交付任务 | 操作ID、目标版本、前后快照、分节点结果、重试次数、最后观察结果、人工接管状态 |
| 3X-UI适配器 | 版本profile、字段映射、panel GUID/inbound/client映射、绝对状态写入、错误归一和读回核对 |
| Agent | 受限本地配置部署、核心/sidecar版本管理、证书、指标、健康检查、计数器epoch及离线额度策略 |

不建议让 RayNo1同时直写子节点，又让3X-UI master把它当权威受管节点：master的导入、同步和清理可能覆盖这些更改。要么适配该master并让它唯一管理子节点，要么解除master管理后由RayNo1直接管理。每个节点维护 `management_owner`，接管需要明确迁移记录。

### 分阶段落地

1. **读取与导入。** 以既有面板只读接入开始；探测版本、GUID、OpenAPI、协议；导入映射并产生差异清单；原服务继续运行。不要按email猜测付款人关系。
2. **业务控制面上线。** RayNo1控制席位、订单、权益和订阅URL；使用3X-UI v3适配器交付。策略上先选择基础协议组合，TUIC/IP门禁等放入明确测试后的能力列表。
3. **Agent用于系统操作。** 通过主动出站连接和mTLS接入控制面；签发单次引导token；本地最小权限辅助进程只接受白名单动作。避免把通用远程shell作为日常业务API。
4. **分批迁移运行时。** 同一目标权益可由不同backend执行。为新节点用Agent直接管理Xray；每次迁移保留映射、计量切换点和配置快照；验证订阅与连通性后切换；不同时运行两个配置写入者。

## 6. 幂等、回滚与配额账务要求

### 交付任务

- 每项业务变更创建稳定 `operation_id`，以 `(resource_id, desired_revision)` 去重；数据库事务同时写业务状态和Outbox。
- 每个面板/客户端写入串行化，读取完整现状并规范化比较。幂等键是RayNo1自己的任务标识；不要伪装为3X-UI提供的幂等头。
- 存储生成的代理凭证和subId后再发送，重试复用同一凭证；超时先查询实际状态，再决定补写。记录目标节点、入站和实际成功集合。
- 生命周期区分 `queued → applying → verifying → applied`，异常含 `partial`、`node_pending`、`retrying`、`blocked`。API接收成功与数据面交付成功分别记录。
- 写完核对配置、客户端完整字段、订阅输出、Xray运行状态与必要的连通性探测；只在目标节点验证达标后把席位标为可用。

### 回滚

- 配置修改前保存脱敏摘要及加密完整快照。发布先验证配置，按节点/批次应用，再观察健康；必要时恢复上一版模板及对应核心/sidecar。
- 3X-UI `xray/update`先保存模板，再尝试协调运行核心；协调失败可能意味着存储已变、运行态未变。回滚需同时核对持久化状态和实际运行状态。[保存/协调实现](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/xray_setting.go#L143)
- 业务补偿按新操作记账；退款记录、席位退订和节点停用各自保存回执。不要用整库restore撤销一笔订单，因为它会回滚其他用户的新数据。
- 停用应首先撤销权益、使订阅停止交付，然后可靠地下发数据面禁用。对离线节点标记“撤销待确认”，不能显示已完全撤销。
- 紧急安全撤销不能因为配置回滚被复活：effective state 必须合并最新停用原因；旧snapshot仅作配置依据，不覆盖最新权益账本。

### 流量与金额分账

- 金额用整数最小货币单位和明确币种；付款事件去重，账本追加记录。席位锁定有到期时间；先锁名额再核销付款，避免最后一个席位重复售出。
- 维护两类数据：不可变的额度授予/扣减/调整记录，以及可校正的观测用量；二者不因一次3X-UI清零而删除。
- 每个样本至少包含 backend、node/panel GUID、client identity、direction、counter epoch、采样时刻、累计值、来源层级。先按一条可信统计链去重，再计算正向差值。
- 计数器下降可能是重启、重置、恢复或迁移，必须新建epoch并留异常记录，不能把下降当退款或自动新增额度。
- 不把master汇总和其node明细相加；不要把同一email出现在多个inbound的累计量当独立流量。机房网络字节、入站字节、出站字节、Xray按用户计量不是同一账单口径。
- 拼车“共享总池”与“每席位独立池”必须是显式产品选项。共享池保留已分配节点租约后才可再分配额度，预算满足 `已消费 + 未结算保留额度 ≤ 已授予额度`。
- 若允许离线继续使用，应事先分配有限剩余额度及有效期。过期后按产品策略停用或降级；正常联网也有采样/禁用延迟。没有各节点速率上界时，不能宣称超用误差严格小于固定字节数。
- 3X-UI中不再并行启用未经协调的自动续期/周期重置；默认由RayNo1产生账期版本，或明确使用面板续期并将它导入账本，二选一作为权威。

## 7. 前端展示直接建议

这些字段可以使演示接近真实可实现产品：

- 服务器列表：地区、provider、管理后端、panel/core版本、连接状态、配置状态、最近心跳、数据时间、入站/客户数、成本和到期；离线指标保留最后一次值并注明时间。
- 服务器详情：概览、入站、出站/路由、客户端、证书、发布历史、日志、备份；把“执行中/部分成功/待节点恢复”做成具体状态。
- 拼车组：团长、总席位/已用/暂留、账期、总池或独立池、分配/消费/保留额度、节点范围、健康、分摊费用。
- 席位详情：独立订阅、有效期、流量、设备登记、最近在线、交付版本、暂停原因、续费/退出记录；不要共享全车同一个UUID。
- 订单详情：订单金额、付款状态、权益状态、交付状态、异常处理三者分离；展示每节点交付回执。
- 高级设置：支持能力明确、未知能力置灰并解释；“设备登记数”与“在线IP数”分开，不能使用虚假的硬件在线人数。
- 开通流程：锁定席位→确认付款事实→授予权益→逐节点交付→核对→显示可用；演示数据和真实连接状态应有明确标识。

## 8. 最小验收清单

静态审查之后，实施必须在隔离目标版本测试：

1. 自定义basePath、401/403、cookie CSRF、三种token scope和mTLS；确认token不会进入浏览器日志。
2. 单节点/跨节点同一客户端创建、完整替换、重复任务、超时后读回、部分失败和nodePending；验证UUID/subId不漂移。
3. bytes/GiB、毫秒/秒、首次使用到期、日历边界、闰月/时区、续费重试、退款与手动暂停后的流量重置。
4. 全局配额聚合、master失联、节点恢复、清零、数据库恢复、跨节点迁移、不重复计量；shared-pool断线策略。
5. VLESS/VMess/Trojan/Shadowsocks各模板及核心版本；TUIC/IP/UDP按专项结果启用，不靠通用字段推断。
6. Mihomo、XrayJSON、原始链接的渲染；单个JSON对象/数组；不兼容协议剔除；订阅token轮换与代理凭证撤销。
7. 错误配置、核心无法启动、证书更新、备份恢复及上一版发布回滚；既有连接影响应实际测量。

没有通过上述测试的能力在项目文档和前端应标“待验证”，而不是“已支持”。
