# 妙妙屋 X 功能审计：RayNo1 全量覆盖基线

审计日期：2026-09-15。公开仓库固定到 `f16a72407366c888e4c9685afc784e7f666e268f`；最新稳定版 **v0.5.4（2026-09-08）**，最新预发布 **v0.5.5-beta.6（2026-09-14）**。

本稿整理 **146 条功能条目**，覆盖 15 个域；每条可以包含紧密关联的子能力。来源仅为项目官方仓库、官方发布记录与官方文档。**“确认”指官方资料明确描述，不等于已运行测试，也不代表 RayNo1 已实现。**

## 审查方法和可验证边界

- [固定版本仓库](https://github.com/iluobei/miaomiaowuX/tree/f16a72407366c888e4c9685afc784e7f666e268f)共14个公开文件：README、5个安装/卸载脚本、Compose、3个规则模板+embed.go、代理组说明及2个JSON。没有应用路由、前端页面源码、业务handler或完整数据库schema。
- 浅克隆后只读分析；没有运行目标仓库脚本、容器、二进制，也没有访问任何真实用户数据。
- 官方文档为SPA，普通HTTP返回壳页面。只读下载其[公开静态资产](https://miaomiaowux.com/assets/index-BXsisD9o.js)，从内置搜索语料提取59篇说明；SHA-256：`f9b942d9db7b4f7d301c206a560d78d747a3f48eb01e6b68d7f0d587b4fb7f54`。未执行该JS。索引会去掉Markdown特殊字符，因此语法、参数键名和命令不能直接从索引照抄。
- 每条条目记录官方URL、快照路径与版本。文档中交互演示明确标注mock，未拿演示作真实后端证据。Release正文为空的旧标签没有补猜变更。
- README历史日志停在8月17日，文档changelog也滞后；版本状态以[GitHub Releases](https://github.com/iluobei/miaomiaowuX/releases)及保存的API元数据为准。

## 核心判断

1. 可确认原生登录角色是管理员和普通用户。车主是RayNo1需要定义的运营权限层；跨主控共享的Owner/Consumer属于另一套联邦权限。
2. “拼车”至少有三层：套餐共享与独立用户计量、用户自助转发、官方市场发布。只有第三层在v0.5.5-beta.1明确停用。RayNo1可以保留市场功能，但应标注为自己的增强设计。
3. 独立多套餐、套餐限定节点、过期真正撤权、加权流量、限速、成员私有出口，都是核心业务能力，不能只复刻订阅链接页面。
4. 近期功能必须纳入基线：Loon模板与规则集托管、定时远端备份、定向公告、用户转发、MCP扩展，以及预发布的WebAuthn、在线IP上限、行为自动限速、对账台账、合并订阅。
5. 无证据可声称已覆盖上游全部私有实现。应以本矩阵逐项验收，并为公开资料冲突项补实机验证。

## 功能矩阵

状态：文档＝官方说明确认；发布＝Release确认；公开文件＝配置/模板至少部分静态确认；预发布项不属于稳定版保证。角色为资料中可确认或明确标注的设计映射。

### 身份与权限

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| identity.roles | 管理员与普通用户 | 管理员,普通用户 | 公开说明只确认两种登录角色；管理员管全局，普通用户查看自身订阅与资料，并按开关获取额外能力。 | [users](https://miaomiaowux.com/docs/users)；[system-settings](https://miaomiaowux.com/docs/system-settings)；confirmed_documented |
| identity.create | 账户创建与资料 | 管理员 | 用户名、邮箱、昵称、备注、随机或指定初始密码；生成订阅令牌及短码；可按用户名、昵称、套餐搜索筛选。 | [users](https://miaomiaowux.com/docs/users)；confirmed_documented |
| identity.lifecycle | 账户启停与删除 | 管理员 | 启停用户；禁用撤销节点访问并退出登录；删除时清理用户凭据与自建路由资源。 | [users](https://miaomiaowux.com/docs/users)；[routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| identity.personal | 个人设置 | 管理员,普通用户 | 编辑个人资料、密码、个人主题、默认模板、两步验证及订阅凭据；个人主题优先于系统默认。 | [mcp](https://miaomiaowux.com/docs/mcp)；[system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| identity.totp | TOTP 两步验证 | 管理员,普通用户 | 登录安全支持 TOTP；个人设置提供管理入口。 | [comparison](https://miaomiaowux.com/docs/comparison)；[mcp](https://miaomiaowux.com/docs/mcp)；confirmed_documented |
| identity.passkey | Passkey 登录 | 管理员,普通用户 | WebAuthn 登录、个人设置管理、Related Origin Requests 跨域支持、外置探针登录态接回。仅新预发布确认。 | [v0.5.5-beta.1](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.1)；confirmed_release_notes；仅新预发布 |
| identity.tokens | API Token 管理 | 管理员,普通用户 | 个人命名 Token 仅一次展示、可吊销；权限继承账号。另有管理员全局 API Token 生成与轮换。 | [mcp](https://miaomiaowux.com/docs/mcp)；[system-settings](https://miaomiaowux.com/docs/system-settings)；confirmed_documented |
| identity.subscription_credentials | 订阅凭据与短码轮换 | 管理员,普通用户 | 用户独立订阅令牌、自定义用户短码与订阅文件短码；令牌重置使旧链接失效；历史发布记录确认全量重置订阅凭据。 | [users](https://miaomiaowux.com/docs/users)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| identity.qr_client_login | 手机及官方客户端登录 | 管理员,普通用户 | 桌面展示二维码供手机扫码登录；MeowX 客户端可被按钮唤起并登录。 | [v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes |
| identity.menu_quota | 用户菜单与资源配额 | 管理员 | 设置用户可见菜单、自建子节点数量、私有路由出站数量与每日操作次数；关闭创建能力不等于删除既有资源。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| identity.owner_role | 车主角色边界 | 设计映射 | 未发现独立于管理员、普通用户之外的车主登录角色；可将管理员的套餐运营能力映射成 RayNo1 车主，需自行设计租户边界。联邦 Owner 是主控身份。 | [users](https://miaomiaowux.com/docs/users)；[share-server](https://miaomiaowux.com/docs/share-server)；design_mapping_not_native_role |

### 套餐与拼车

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| package.templates | 套餐模板 CRUD | 管理员 | 名称说明、总配额、周期、计量方式、限速、连接数、关联节点、客户端模板，编辑与删除。 | [packages](https://miaomiaowux.com/docs/packages)；confirmed_documented |
| package.instance | 独立多套餐实例 | 管理员,普通用户 | 同一用户可绑定多个套餐；相同物理节点使用独立子凭据，分别维护用量、额度、连接数、重置基线及到期时间。 | [users](https://miaomiaowux.com/docs/users)；[packages](https://miaomiaowux.com/docs/packages)；confirmed_documented |
| package.assignment | 绑定、解绑、续期 | 管理员 | 单实例管理；到期日可手填或快捷增加 30/60/90 天；按月 1–31 日重置，支持流量覆写与实例解绑。 | [users](https://miaomiaowux.com/docs/users)；confirmed_documented |
| package.renewal_view | 续费工作视图 | 管理员 | 完整视图与续费视图切换，快捷续期、重置流量；新预发布支持按套餐、到期时间筛选。 | [users](https://miaomiaowux.com/docs/users)；[v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；confirmed_documented |
| package.quota | 总额度、单节点额度与覆写 | 管理员 | 套餐总额度、套餐内单节点额度、用户额度覆写；明确留空继承和 0 不限；修改总额度即时生效，修改倍率只作用未来增量。 | [users](https://miaomiaowux.com/docs/users)；[packages](https://miaomiaowux.com/docs/packages)；[traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| package.node_scope | 套餐节点范围与呈现 | 管理员 | 按标签批选节点、节点排序、套餐专属节点名；旧文档称未选=全部，新预发布纠正该路径有风险，见冲突表。 | [packages](https://miaomiaowux.com/docs/packages)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.5-beta.1](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.1)；confirmed_documented |
| package.client_templates | 按客户端绑定模板 | 管理员 | 套餐可分别选择 Clash、Surge、Loon 模板；未设时使用默认模板。 | [packages](https://miaomiaowux.com/docs/packages)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| package.billing | 用户计费倍率 | 管理员,普通用户 | 用户计费用 Xray user/email 原始上下行；采集时冻结套餐方向倍率与节点倍率，历史不因日后改倍率重算。 | [traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；confirmed_documented |
| package.expiry_enforce | 到期与超额执行 | 管理员,普通用户 | 到期撤除用户入站访问；超额可停止下发/限制接入或自动降速；额度恢复后解除限制。v0.5.4 增加临近超额快速执行。 | [packages](https://miaomiaowux.com/docs/packages)；[routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| package.member_self_renew | 成员自助续费 | 普通用户 | README 确认用户自主续费、Mini App 续费及“我已续费”通知按钮；支付、审批与记账细则未公开确认。 | [README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| package.carpool_flow | 基础拼车开通流程 | 管理员,普通用户 | 接入服务器、创建节点、建套餐、为成员建账号并绑定；同端口按用户身份分别计量，订阅注入各自凭据。 | [faq-carpool](https://miaomiaowux.com/docs/faq-carpool)；confirmed_documented |
| package.public_market | 发布到官方拼车页 | 管理员 | 历史版本可发布/下架套餐到官方拼车页；v0.5.5-beta.1 明确移除发布入口和 /api/admin/carpool 路由。最新预发布已停用。 | [README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[packages](https://miaomiaowux.com/docs/packages)；[v0.5.5-beta.1](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.1)；historical_removed_in_latest_prerelease |
| package.redeem | 邀请码与兑换码 | 管理员,普通用户 | 通过 TG 生成、列出、撤销兑换码，成员兑换注册并绑定套餐；新预发布支持自定义天数、长期有效。 | [tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；confirmed_documented |
| package.merged | 全部套餐合并订阅 | 普通用户,管理员 | 新预发布提供全局开关、用户“全部套餐”虚拟订阅卡、合并短码及订阅生成路径。具体冲突取舍算法未公开。 | [v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes；仅新预发布 |

### 服务器与Agent

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| server.inventory | 多服务器清单 | 管理员 | 卡片/列表、在线离线筛选与计数、排序、IP 隐藏、状态/版本/心跳/网速/流量；新预发布增加服务器分组。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；confirmed_documented |
| server.enrollment | Agent 注册与安装 | 管理员 | 服务器名、IP/域名、Agent 端口、认证令牌；生成一键安装命令与 Docker 环境变量。可扫描现有 Xray/Nginx。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[install-agent](https://miaomiaowux.com/docs/install-agent)；confirmed_documented |
| server.connection | 三种连接与回退 | 管理员 | WebSocket、HTTP、Pull/轮询、自动回退与重连；WS 连接时隐藏 Agent 本地管理端口；文档中 Pull 方向描述冲突。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[system-settings](https://miaomiaowux.com/docs/system-settings)；[faq-server-management](https://miaomiaowux.com/docs/faq-server-management)；confirmed_documented |
| server.address | IPv4/IPv6、域名、DDNS | 管理员 | IPv6 开关、多地址选择、独立 IPv6 域名、DDNS、锁定入口 IP、域名/IP 替换与节点地址同步。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；confirmed_documented |
| server.ports | 端口管理 | 管理员 | 自定义 Agent 端口、节点随机端口范围、端口占用探测、入站自动分配；转发端口可重选。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| server.credentials | 服务器凭据生命周期 | 管理员 | Server/Agent Token、轮换与在线同步；主控/Agent 加密通信；新预发布测速令牌轮换保留 15 分钟旧令牌宽限。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_documented |
| server.operations | Agent 更新与卸载 | 管理员 | 单台升级、批量/滚动升级、版本提示、卸载与流式进度；支持从主控更新家用测速端。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[features](https://miaomiaowux.com/docs/features)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| server.mode | 外置/内嵌 Xray 模式 | 管理员 | 外置独立服务或内嵌 xray-core；面板切换并重启；内嵌支持限速、并发控制及在线 IP 跟踪。 | [embedded-xray](https://miaomiaowux.com/docs/embedded-xray)；[remote-servers](https://miaomiaowux.com/docs/remote-servers)；confirmed_documented |
| server.accounting | 服务器容量与周期 | 管理员 | 系统网卡或 Xray 流量源；上行、下行、总和、最大方向四种统计；配额、周期日、人工校准、重置。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；confirmed_documented |
| server.assets | 服务器商务与探针资料 | 管理员 | 地区、城市、提供商名称/网址、续费价格/币种/周期、到期日；公开探针续费时间轴跳转提供商。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[probe-api](https://miaomiaowux.com/docs/probe-api)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| server.config_history | 配置历史与回滚 | 管理员 | 记录主控修改及 Agent 上报的配置快照、Hash 与来源；预览、差异检查、验证后重新下发及默认配置修复。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| server.sync | 节点与地址一致性 | 管理员 | 自动/手动扫描入站同步节点、同步域名地址、检测配置漂移；新版引入地址对账及入口故障降级推送。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| server.self_site | REALITY 本机站点复用 | 管理员 | 服务器向导配置本机网站、Tunnel/回落模式、域名与 443；安装联动 Xray/Nginx，冲突检查。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[website-management](https://miaomiaowux.com/docs/website-management)；confirmed_documented |

### Xray配置

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| xray.services | Xray/Nginx 服务控制 | 管理员 | 安装、卸载、启动、停止、重启、扫描版本及运行状态；SSE 展示安装过程，完成后部署证书并同步入站。 | [xray-service](https://miaomiaowux.com/docs/xray-service)；confirmed_documented |
| xray.global_config | 完整 JSON 配置管理 | 管理员 | 编辑、格式化、保存 Xray 配置及自动重启；日志、DNS、策略、统计、gRPC/API 项，历史快照可回滚。 | [xray-system-config](https://miaomiaowux.com/docs/xray-system-config)；[xray-service](https://miaomiaowux.com/docs/xray-service)；confirmed_documented |
| xray.inbounds | 入站 CRUD 与节点联动 | 管理员 | 按服务器浏览入站、卡片/列表、协议/端口/用户数、JSON 预览、编辑删除；入站与节点双向联动。 | [xray-inbounds](https://miaomiaowux.com/docs/xray-inbounds)；confirmed_documented |
| xray.wizard | 简易与专家向导 | 管理员 | 简易自动分配端口/生成凭据；专家编辑监听、端口、嗅探、中转及协议细项；实时预览 JSON、多用户配置。 | [xray-inbounds](https://miaomiaowux.com/docs/xray-inbounds)；[nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| xray.protocols | 受管协议与传输 | 管理员 | 公开向导列 VLESS、VMess、Trojan、SS/SS2022、Hysteria2、AnyTLS、Snell、Mieru、SOCKS5、HTTP；TCP/UDP/WS/gRPC/XHTTP 与各安全组合需按客户端核对。 | [xray-inbounds](https://miaomiaowux.com/docs/xray-inbounds)；[protocol-matrix](https://miaomiaowux.com/docs/protocol-matrix)；confirmed_documented |
| xray.reality | REALITY 域名与保护 | 管理员 | 目标域名自动/手动选择、批量延迟探测、共享域名池、允许域名保护规则；新版共享池要求先贡献一个域名。 | [nodes](https://miaomiaowux.com/docs/nodes)；[xray-routing](https://miaomiaowux.com/docs/xray-routing)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_documented |
| xray.protocol_options | 协议特殊参数 | 管理员 | Snell v4/v5 独立 PSK 与 v6 clientID、obfs；HY2 salamander 混淆；证书、自签、Vision 与 flow 配置按协议适配。 | [protocol-matrix](https://miaomiaowux.com/docs/protocol-matrix)；[protocol-snell](https://miaomiaowux.com/docs/protocol-snell)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| xray.outbounds | 出站 CRUD 与排序 | 管理员 | 直连、阻断、代理、隧道出站，查看编辑删除、隐藏默认项、调整顺序；可从节点自动创建出站。 | [xray-outbounds](https://miaomiaowux.com/docs/xray-outbounds)；confirmed_documented |
| xray.warp | WARP 出站 | 管理员 | 每台 Agent 独立注册 WARP，IPv4/IPv6 出站、WARP+ 密钥升级、刷新配置与卸载，供路由选择。 | [xray-outbounds](https://miaomiaowux.com/docs/xray-outbounds)；confirmed_documented |
| xray.routing | 路由规则管理 | 管理员 | 节点专属/服务器全局规则、拖拽顺序、JSON 详情、增删；匹配域名/IP/协议/端口/源地址/用户/入站标签等。 | [xray-routing](https://miaomiaowux.com/docs/xray-routing)；confirmed_documented |
| xray.routing_presets | 预设路由与命中提示 | 管理员 | 常用阻断/直连/解锁规则，选择目标出站；显示 catch-all 遮蔽后续规则的影响，默认 API 路由保留。 | [xray-routing](https://miaomiaowux.com/docs/xray-routing)；confirmed_documented |
| xray.balancers | 出站负载均衡 | 管理员 | 按标签前缀选择候选出站；random、roundRobin、leastPing、leastLoad；按需配置观测器。 | [xray-routing](https://miaomiaowux.com/docs/xray-routing)；confirmed_documented |

### 节点管理

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| node.import | 外部节点导入 | 管理员,普通用户 | 逐行 URI、Clash/mihomo YAML、Base64 列表、订阅 URL 与 User-Agent、SOCKS5 表单；预览、选节点、打标签再保存。新预发布支持 Surge 节点格式。 | [nodes](https://miaomiaowux.com/docs/nodes)；[subscribe-files](https://miaomiaowux.com/docs/subscribe-files)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_documented |
| node.crud | 节点列表与日常操作 | 管理员,普通用户 | 节点启停、重命名、排序、协议与多标签筛选、编辑、查看/修改 Clash 配置、复制 URI、批量清理/去重。 | [nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| node.metadata | 节点显示与地址工具 | 管理员,普通用户 | Emoji 匹配、手动地区图标、域名转 IP 与恢复原地址、节点证书验证开关、Snell 批量设置。 | [nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| node.temp_sub | 临时订阅 | 管理员,普通用户 | 为单节点生成无访问密码的临时订阅，可指定次数与有效期，次数用尽或到期失效。具体普通用户可见范围需运行验证。 | [nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| node.uri_view | 用户 URI 总览 | 管理员 | 按用户、服务器查看节点协议 URI，使用该用户子账户凭据，可复制全部。 | [nodes](https://miaomiaowux.com/docs/nodes)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| node.self_import | 成员自有节点管理 | 普通用户,管理员 | 用户可导入自己的外部节点；管理员可查看、清空其自导节点，区别于套餐共享池。 | [users](https://miaomiaowux.com/docs/users)；[nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| node.latency | TCP 延迟与域名探测 | 管理员,普通用户 | 浏览器/客户端节点行 TCPing；域名批量 TCP 探测（文档描述上限 200、并发 16）。 | [nodes](https://miaomiaowux.com/docs/nodes)；[features](https://miaomiaowux.com/docs/features)；confirmed_documented |
| node.speedtest | 真实测速工作台 | 管理员 | mihomo 单节点下载速度、真连接延迟、出口 IP、单/多线程、批量异步任务、历史记录及排序。 | [node-speedtest](https://miaomiaowux.com/docs/node-speedtest)；confirmed_documented |
| node.home_endpoint | 家用测速端 | 管理员 | 反向 WSS 接入、一次性配对、安装命令、Linux/Windows/macOS；端点管理、在线/离线回退、测速来源选择。 | [node-speedtest](https://miaomiaowux.com/docs/node-speedtest)；confirmed_documented |
| node.external_probe | 外部节点探测与重同步 | 管理员 | 定时 mihomo 探测外部导入节点；选主控或家用端；掉线自动同步外部订阅。 | [nodes](https://miaomiaowux.com/docs/nodes)；[system-settings](https://miaomiaowux.com/docs/system-settings)；confirmed_documented |

### 订阅源与转换

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| subscription.sources | 外部订阅源管理 | 管理员,普通用户 | 导入源列表、手动同步/删除、源 URL 与 User-Agent；管理员可管理所有外部源，节点与自建节点合并。 | [subscribe-files](https://miaomiaowux.com/docs/subscribe-files)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| subscription.sync | 定时、按需与缓存刷新 | 管理员 | 小时/每日/自定义同步周期；获取订阅时强制刷新或用缓存；静默同步、失效重同步。 | [subscribe-files](https://miaomiaowux.com/docs/subscribe-files)；[system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| subscription.matching | 同步匹配与保留策略 | 管理员 | 按名称、地址端口、协议地址端口匹配；仅更新已存节点或同步全部新增；保留当前名称，正则排除信息节点。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；confirmed_documented |
| subscription.external_traffic | 外部流量聚合 | 管理员,普通用户 | 读取 subscription-userinfo 额度、用量、到期；选择统计方向和标签范围；可把剩余额度/天数追加到节点名称。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；confirmed_documented |
| subscription.fetch_proxy | 家用端中转抓取源 | 管理员 | 外部订阅可经家用测速端抓取，解决来源网络访问差异。 | [v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_release_notes |
| subscription.generate | 订阅生成工作台 | 管理员 | 选择节点和规则/模板，预览生成配置，自动/手动排序，填写名称文件名说明并保存订阅文件。 | [generator](https://miaomiaowux.com/docs/generator)；confirmed_documented |
| subscription.formats | 多客户端输出 | 管理员,普通用户 | 明确列出的格式家族为 Clash/Meta、Surge、Loon、QX、Shadowrocket、SingBox、Stash、Surfboard、V2Ray、Egern；文档称12+，不能等同12种独立引擎。 | [generator](https://miaomiaowux.com/docs/generator)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| subscription.compatibility | 自动客户端与兼容处理 | 管理员,普通用户 | auto 客户端识别、显式格式选择、不支持协议过滤/报错开关；Clash YAML/JSON；clash-to-loon 与 Egern 块状 YAML。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| subscription.files | 订阅文件维护 | 管理员,普通用户 | 名称、所属用户、更新时间、短码、V3绑定、流量信息；节点范围/标签配置、编辑内容、限额显示覆写和删除；普通用户仅自己的文件。 | [subscribe-files](https://miaomiaowux.com/docs/subscribe-files)；confirmed_documented |
| subscription.links | 分发链接与独立域名 | 管理员,普通用户 | 用户令牌链接、用户/文件短码、订阅域名与主控域名分开；独立订阅域名供网页/TG/Mini App 分发。 | [generator](https://miaomiaowux.com/docs/generator)；[cloudflare-tunnel](https://miaomiaowux.com/docs/cloudflare-tunnel)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| subscription.info | 订阅元信息展示 | 管理员,普通用户 | 响应头用量/到期、可选流量与到期信息节点及前缀；最新版本细分兼容输出范围。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_documented |
| subscription.providers | 代理集合 | 管理员,普通用户 | 开关控制 Proxy Provider；外部源动态加载，能拖入代理组，与本地节点混合。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| subscription.change_push | 订阅变化即时通知 | 普通用户 | subscription_changed 事件提醒客户端重拉；入口故障降级实时推送。客户端接入细节未公开。 | [v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_release_notes |
| subscription.access | 订阅访问策略 | 管理员 | 订阅请求限频、禁止浏览器访问订阅、IP 白名单、用户/套餐权限与过期校验。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |

### 模板与规则

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| template.versions | 模板版本兼容 | 管理员 | v1 文件、v2 数据库/subconverter INI、v3 mihomo 风格模板；系统开关选择及旧模板迁移。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.library | 模板库 CRUD 与共享 | 管理员 | Clash、Surge、Loon 类型分类、编辑预览删除、普通用户可见性；系统/个人默认模板与套餐/文件绑定。 | [templates](https://miaomiaowux.com/docs/templates)；[packages](https://miaomiaowux.com/docs/packages)；confirmed_documented |
| template.import | 六类模板来源 | 管理员 | 上传、粘贴、空白、URL、V2转换、从现有订阅提取分组，保留常用结构。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.editor | 可视化与代码编辑 | 管理员 | 代理组增改排序、引用其他组、图标与隐藏、实时预览；可切换 YAML 与可视化模式。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.selectors | 动态匹配节点 | 管理员 | include-all/proxies/providers/type 与 filter/exclude-filter/exclude-type；YAML 顶层变量复用，生成时清除模板专用字段。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.regions | 区域组与空组处理 | 管理员 | 按节点名称自动分地区、其他地区兜底；未匹配节点的组自动移除。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.policy_groups | 代理组选路 | 管理员 | select、url-test、fallback、load-balance、链式组；测速 URL/周期/容差与 dialer-proxy-group。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| template.regeneration | 订阅自动再生成 | 管理员,普通用户 | 节点增加、删除、模板修改触发绑定订阅更新；每订阅单模板，模板替代原规则配置。 | [templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| rules.overrides | DNS/规则/规则集覆写 | 管理员,普通用户 | 启停、名称、类型、替换/追加/前置、全局或按模板作用域；YAML 片段、规则优先级与出站策略。具体用户权限需实测。 | [custom-rules](https://miaomiaowux.com/docs/custom-rules)；confirmed_documented |
| rules.scripts | JavaScript 覆写脚本 | 管理员,普通用户 | 开关启用后可在订阅生成链上二次修改节点字段、代理组与配置结构。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[comparison](https://miaomiaowux.com/docs/comparison)；confirmed_documented |
| rules.group_catalog | 远程代理组配置 | 管理员 | 自定义 HTTP 配置源、同步与规范化缓存；minimal/balanced/comprehensive；域名/IP providers 与格式、地址、路径、刷新周期。下载失败保留现有配置。 | [README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/proxy_groups/README.md)；[proxy-groups-lite.json](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/proxy_groups/proxy-groups-lite.json)；partly_verified_public_files |
| rules.hosted | 规则集托管 | 管理员 | v0.5.4 新增规则集托管与独立规则集页面；具体上传格式/版本模型待验证。 | [v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_release_notes |
| rules.bundled | 内置模板文件 | 管理员 | 公开分发 fake-ip/redirhost V3 YAML 与 Surge conf；Go embed.Ensure 只在缺失时写入，保留已有自定义文件。 | [embed.go](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/rule_templates/embed.go)；[fake_ip__v3.yaml](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/rule_templates/fake_ip__v3.yaml)；[redirhost__v3.yaml](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/rule_templates/redirhost__v3.yaml)；[surge_cn__surge.conf](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/rule_templates/surge_cn__surge.conf)；partly_verified_public_files |

### 中转与转发

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| relay.node_outbound | 整节点链式出站 | 管理员 | 指定已有落地、另台服务器新建落地或均衡器，将同一入站全部用户流量导向选定出口。 | [routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；confirmed_documented |
| relay.package_children | 套餐路由子节点 | 管理员 | 同一父入站创建多条 routed 子节点；每用户独立凭据/user路由，套餐分配后生效，删除级联清理。 | [routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；confirmed_documented |
| relay.private_children | 成员私有路由子节点 | 普通用户,管理员 | 管理员开启后，成员用自己的可见节点创建私有出口；仅本人可见/可删；数量及每日操作上限、启停/超额/到期联动。 | [routed-outbound](https://miaomiaowux.com/docs/routed-outbound)；confirmed_documented |
| relay.client_group | 客户端中转组 | 管理员,普通用户 | 为落地节点选择多个中转组成 url-test 组，生成 dialer-proxy 链；Clash 链式功能继承。 | [nodes](https://miaomiaowux.com/docs/nodes)；[templates](https://miaomiaowux.com/docs/templates)；confirmed_documented |
| relay.tunnels | Xray Tunnel 与端口转发 | 管理员 | dokodemo-door 指向已有节点或自定义地址端口；自动配套节点、入口地址替换、TCP/UDP、连通性探测。 | [nodes](https://miaomiaowux.com/docs/nodes)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| relay.reused_port | 复用入站的目标转发 | 管理员 | 现有 Tunnel 按域名/IP 匹配复用监听端口；统一列表维护、显示关联转发及原始落地地址。 | [nodes](https://miaomiaowux.com/docs/nodes)；confirmed_documented |
| relay.native_chains | Agent 转发组与链 | 管理员 | 入口/中转/出口分组，多选/拖拽组链，落到节点或自定义目标；支持单入口组链、入口故障降级与 DNS 地址对账。 | [nodes](https://miaomiaowux.com/docs/nodes)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| relay.member_forward | 成员“我的转发” | 普通用户,管理员 | 套餐开启转发配额并授权入口链；成员自填裸目标或选套餐节点，显示入口端口并可换端口，支持 UDP。 | [packages](https://miaomiaowux.com/docs/packages)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| relay.ledger | 转发计量与连接 | 管理员,普通用户 | 转发载体标识、链周期流量、入口实时连接与来源 IP；新版按链/端口/日期、套餐查转发账目。 | [v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；[v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；confirmed_release_notes |
| relay.wireguard | WireGuard 中转隧道 | 管理员 | 新版支持 IPv4/双栈地址族选择、25 秒 keepalive与定时探活、正常/失败/延迟展示；具体全参数未公开。 | [v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes；仅新预发布 |

### 共享与联邦

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| federation.share | 跨主控分享与接入 | 拥有方管理员,消费方管理员 | 拥有方生成令牌；消费方用地址+令牌接入，独立服务器名/入站前缀；所有操作经拥有方转发到 Agent。 | [share-server](https://miaomiaowux.com/docs/share-server)；confirmed_documented |
| federation.acl | 联邦权限边界 | 拥有方管理员,消费方管理员 | 默认消费方仅管自己入站/节点、看状态；无启停/安装/改服务器/再分享/Agent直连权限；可显式授权完整Xray配置。 | [share-server](https://miaomiaowux.com/docs/share-server)；confirmed_documented |
| federation.tokens | 分享令牌管理 | 拥有方管理员 | 一机多令牌、仅首次展示明文、SHA256存储、列表与创建时间、即时吊销；文档称吊销不自动删消费方入站。 | [share-server](https://miaomiaowux.com/docs/share-server)；confirmed_documented |
| federation.security | 联邦加密与白名单 | 拥有方管理员,消费方管理员 | HTTPS、ECDH、转发路径白名单；旧文档的自动降级说明与新版强制加密须单独验证。 | [share-server](https://miaomiaowux.com/docs/share-server)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |

### 证书与网站

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| cert.providers | DNS 供应商管理 | 管理员 | Cloudflare、阿里云、腾讯 DNSPod、Namesilo 凭据表单，生成并校验配置。 | [certificates](https://miaomiaowux.com/docs/certificates)；confirmed_documented |
| cert.issue | 证书申请与续期 | 管理员 | CA选择、邮箱、DNS-01、通配符与根域名 SAN、自动续期、签发日志与状态。 | [certificates](https://miaomiaowux.com/docs/certificates)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| cert.manual | 证书导入与导出 | 管理员 | PEM证书/私钥上传、证书列表与下载ZIP、手动证书管理、删除。 | [certificates](https://miaomiaowux.com/docs/certificates)；confirmed_documented |
| cert.deploy | 证书部署与更新 | 管理员 | 部署主控HTTPS及远程Xray/Nginx；续期、重签、Webhook更新后下发所有引用处；恢复配置时先补证书。 | [certificates](https://miaomiaowux.com/docs/certificates)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| cert.webhook | Certimate Webhook | 管理员 | POST /api/admin/certificates/upload，管理员API Token鉴权，支持裸PEM/旧Base64；同域更新并触发部署。 | [certificates](https://miaomiaowux.com/docs/certificates)；confirmed_documented |
| site.nginx | Nginx 站点管理 | 管理员 | 扫描受管站点、静态目录/反向代理、创建删除、80/443占用检查、重载与证书匹配；保留站点内容。 | [website-management](https://miaomiaowux.com/docs/website-management)；confirmed_documented |
| site.runtime | 多种服务管理环境 | 管理员 | systemd、OpenRC、SysV、直接命令与Docker Nginx管理；可检测并复用已有Nginx。 | [website-management](https://miaomiaowux.com/docs/website-management)；confirmed_documented |

### 监控与流量

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| monitor.dashboard | 管理员流量总览 | 管理员 | 总额度、用量、剩余、30日趋势、今日/周/月、节点/用户/服务器视图，选择计入统计服务器。 | [traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；[features](https://miaomiaowux.com/docs/features)；confirmed_documented |
| monitor.member | 成员用量总览 | 普通用户 | 有效套餐实例额度与已用、趋势、实例卡片；外部订阅按配置合并；列表聚合与实例口径有差别。 | [traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；[users](https://miaomiaowux.com/docs/users)；confirmed_documented |
| monitor.live | 实时系统与连接状态 | 管理员,普通用户 | CPU/内存/硬盘/负载/uptime/OS/架构、实时网卡速度、在线用户、节点连接数与来源IP。 | [probe-api](https://miaomiaowux.com/docs/probe-api)；[embedded-xray](https://miaomiaowux.com/docs/embedded-xray)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| monitor.probe | 内置公开探针 | 管理员,访客 | 启停、展示服务器和指标、标题/Logo/主题、3D地球、隐蔽登录入口、是否屏蔽原登录页。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[probe-api](https://miaomiaowux.com/docs/probe-api)；confirmed_documented |
| monitor.external_probe | 外置探针 | 管理员,访客 | Cloudflare Worker静态页、只读API/WS代理、独立访问密钥；主控选择服务器及指标，可与内置探针并存。 | [install-external-probe](https://miaomiaowux.com/docs/install-external-probe)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| monitor.probe_api | 探针API与历史 | 访客,外置探针 | 状态HTTP、5秒WS推送、1h/6h/24h延迟和系统历史；字段白名单、可选Token保护、无数据可省略。 | [probe-api](https://miaomiaowux.com/docs/probe-api)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| monitor.network_quality | 网络质量与回程 | 管理员,访客 | Ping目标、延迟、丢包、历史桶、三网回程、地区/运营商/线路标识；用户侧接口供官方客户端展示回程。 | [probe-api](https://miaomiaowux.com/docs/probe-api)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.5-beta.1](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.1)；confirmed_documented |
| monitor.accounting | 多维流量对账 | 管理员 | 区分主机网卡、Xray物理节点、routed子节点、用户/套餐加权用量；日期范围、周期、手工校准与不完整采集标记。 | [traffic-accounting](https://miaomiaowux.com/docs/traffic-accounting)；confirmed_documented |
| monitor.ledger | 流量明细台账 | 管理员 | 新预发布节点/用户流量、连接IP历史、峰值top5、上下行拆分、可排序；未归属流量原因与管理员自用分类。 | [v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes；仅新预发布 |
| monitor.ip_database | IP 地区库 | 管理员 | 新预发布按地址族下载、更新、删除地区库；有库时连接IP显示地区和运营商。 | [v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes；仅新预发布 |

### 限速与接入控制

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| limit.speed | 用户与套餐限速 | 管理员 | Mbps限速、套餐默认、用户全局及单节点覆写；0不限/空继承；内嵌Xray热更新及Vision限速。 | [node-ratelimit](https://miaomiaowux.com/docs/node-ratelimit)；[users](https://miaomiaowux.com/docs/users)；[embedded-xray](https://miaomiaowux.com/docs/embedded-xray)；confirmed_documented |
| limit.connection | 并发连接数 | 管理员 | 按套餐/用户/节点限制并发连接，新连接达限拒绝；不能把并发连接数当成设备数量。 | [node-ratelimit](https://miaomiaowux.com/docs/node-ratelimit)；[packages](https://miaomiaowux.com/docs/packages)；confirmed_documented |
| limit.online_ips | 同时在线IP数量 | 管理员 | v0.5.5-beta.5独立新增套餐/用户IP上限配置、覆写与下发；与并发连接数分开。 | [v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_release_notes；仅新预发布 |
| limit.auto_rules | 行为自动限速 | 管理员 | 持续超速和窗口突发规则，阈值/持续时长/限制速度/解除时间；新预发布全局默认、套餐覆盖、事件和独立通知。 | [embedded-xray](https://miaomiaowux.com/docs/embedded-xray)；[v0.5.5-beta.5](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；confirmed_documented |
| limit.quota_throttle | 超额度限速与恢复 | 管理员,普通用户 | 套餐超额降速策略、重置或扩额后自动解除；与基于速度行为的临时自动限速区分。 | [packages](https://miaomiaowux.com/docs/packages)；confirmed_documented |

### 通知与TG

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| notify.events | Telegram事件通知 | 管理员 | 登录、获取订阅、IP封禁、静默切换、到期、服务器上下线、流量阈值、延迟/丢包；独立开关与测试消息。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| notify.daily | 日报与文案 | 管理员,普通用户 | 管理员定时流量报表、时间/文本配置；成员可选通知开关，TG到期7/3/1日提醒，续费确认按钮。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| notify.announcements | 公告中心 | 管理员,普通用户 | 被墙/恢复/维护/订阅更新/通用公告模板、探测源、Bot/Mini App渠道、发布日志；稳定版支持套餐定向发送。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| tg.builtin | 内置TG Bot生命周期 | 管理员 | 启停、Token/管理员TG ID配置、掩码保留、保存热重启、运行状态；已不需独立部署Bot。 | [tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；confirmed_documented |
| tg.commands | 成员TG命令 | 普通用户 | /start注册绑定、/me账户、/sub订阅、/traffic流量、/nodes节点状态、/notify开关、/unbind解绑确认。 | [tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；confirmed_documented |
| tg.admin | 管理员TG命令 | 管理员 | 邀请码列表、交互创建、撤销、用户查询；管理员名单与命令限频。 | [tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；confirmed_documented |
| tg.miniapp | Telegram Mini App | 管理员,普通用户 | /tg-app通过initData免密码登录；管理员看全局、用户/流量/兑换码，成员看套餐/用量/订阅/节点；Xray开关与续费。 | [tool-mmwx-tgbot](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |

### 安全与外观

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| security.limits | 登录与请求防护 | 管理员 | 登录限流、暴力破解封禁、订阅限频、真实来源IP、独立通知、安全日志；配置可热更新。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；confirmed_documented |
| security.turnstile | Turnstile人机验证 | 管理员 | Site/Secret Key、完整配置启用、页面内自测；登录验证接入。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[tool-cloudflare-turnstile](https://miaomiaowux.com/docs/tool-cloudflare-turnstile)；confirmed_documented |
| security.silent | 静默隐藏与本地监听 | 管理员 | 静默404、合法订阅唤醒及恢复时长；仅本机监听、公开访问自救环境变量、隐蔽探针入口。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| security.encryption | 主控/Agent及客户端加密 | 管理员,客户端 | 主控/Agent密钥协商；稳定版加强强制加密、X25519客户端身份、证书续签与端到端专用端点。实现未公开验证。 | [remote-servers](https://miaomiaowux.com/docs/remote-servers)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| security.local_reset | 管理员本地恢复 | 管理员 | 官方文档描述本地SSH脚本重置管理员密码与TOTP；当前公开仓库缺该脚本，无法验证或提供可用脚本保证。 | [faq-common-ops](https://miaomiaowux.com/docs/faq-common-ops)；documented_but_referenced_script_unavailable |
| appearance.themes | 主题、品牌与菜单 | 管理员,普通用户 | 亮/暗、个人默认、多个视觉主题、标题/Logo/称号、菜单排序显隐、壁纸上传、色调、登录框透明度、PRO CSS。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[custom-css](https://miaomiaowux.com/docs/custom-css)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| appearance.mobile | 移动端与多语言 | 管理员,普通用户 | 响应式页面、移动操作入口、国际化；Mini App与探针可配主题及CSS。 | [README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |

### 数据维护与集成

| ID | 功能 | 角色 | 功能范围 | 证据与状态 |
|---|---|---|---|---|
| data.manual_backup | 完整备份与恢复 | 管理员 | 导出ZIP、上传校验恢复、初始化向导恢复；包含数据库、订阅、证书/私钥；旧zip.enc可用原密码恢复。 | [backup-restore](https://miaomiaowux.com/docs/backup-restore)；confirmed_documented |
| data.remote_backup | 定时远端备份 | 管理员 | WebDAV、S3兼容、Google Drive；间隔、保留份数、立即执行、写列删连接测试、成功时间与任务记录。 | [backup-auto-sync](https://miaomiaowux.com/docs/backup-auto-sync)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| data.database | SQLite/PostgreSQL | 管理员 | 安装选择或设置页双向迁移；PG dump/restore备份；SQLite完整性检查与有效应急副本恢复。 | [backup-restore](https://miaomiaowux.com/docs/backup-restore)；[docker-compose.yml](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/docker-compose.yml)；partly_verified_public_files |
| data.migration | 从妙妙屋迁移 | 管理员 | 五步向导：备份、导入、服务器接入、旧节点认领/补email、验证；用户/短链/节点/模板/规则/订阅等迁入，支持回滚。 | [upgrade-from-mmw](https://miaomiaowux.com/docs/upgrade-from-mmw)；confirmed_documented |
| data.logs | 日志中心 | 管理员 | 系统、Agent交互、定时任务、安全日志四类；级别、行数过滤、清空；Agent日志开关与自动清理。 | [faq-common-ops](https://miaomiaowux.com/docs/faq-common-ops)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；confirmed_documented |
| data.scheduler | 任务调度与运行记录 | 管理员 | 流量/速度上报、同步、清理、备份等周期配置与执行日志；孤儿子账户清理、配置/凭据修复回填任务。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[v0.5.5-beta.6](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；confirmed_documented |
| data.updates | 安装、升级与渠道 | 管理员 | 原生/Docker/单二进制；初始化向导、稳定/预发布切换、网页检查更新、CDN下载；签名Guard参数仅能据公开安装器确认。 | [README.md](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；[install.sh](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/install.sh)；[install-prerelease.sh](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/install-prerelease.sh)；partly_verified_public_files |
| data.mcp | MCP自动化接口 | 管理员,普通用户 | /mcp streamable-HTTP、个人Token继承权限、危险写操作确认参数；稳定版说明扩充至109工具，旧文档26工具已滞后。 | [mcp](https://miaomiaowux.com/docs/mcp)；[v0.5.4](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；confirmed_documented |
| data.license | 许可证与PRO能力 | 管理员 | 许可证状态/档位/有效期、服务器/节点/用户配额、功能开关、称号展示；测速/内嵌/限速/共享/品牌等有PRO依赖。 | [system-settings](https://miaomiaowux.com/docs/system-settings)；[embedded-xray](https://miaomiaowux.com/docs/embedded-xray)；[share-server](https://miaomiaowux.com/docs/share-server)；[node-speedtest](https://miaomiaowux.com/docs/node-speedtest)；confirmed_documented |

## 文档冲突与版本变化

| 主题 | 证据差异 | RayNo1如何处理 |
|---|---|---|
| 发布到官方拼车页 | README v0.4.8-beta.3、套餐文档仍列发布；v0.5.5-beta.1发布说明明确移除入口和/admin/carpool路由。 | 稳定版历史功能与最新预发布停用并列；基础套餐拼车、我的转发继续存在。 |
| 套餐不选节点的含义 | 套餐文档与v0.5.4写留空=全部并二次确认；v0.5.5-beta.1将“未勾节点时订阅发全部、Agent不建client”列为修复。 | 不能从发布说明判定修复后的精确选择语义。RayNo1需显式“全部/指定/无”，实际验收前列待验证。 |
| MCP工具数量 | 官方MCP文档26；v0.5.4发布说明63→109。 | 以v0.5.4声明109为新版本数量；公开源码不可得，无法列全109个签名。 |
| 连接数、设备数、IP数 | 内嵌/比较文档称设备数，限速/套餐文档明确device_limit实为并发连接数；v0.5.5-beta.5另增同时在线IP数限制。 | RayNo1分别设计并发连接数与同时在线IP上限；没有证据可把任一项称精确设备数。 |
| 备份是否加密 | 旧README v0.3.0称增加备份加密；当前备份文档说新导出普通ZIP，仅兼容旧zip.enc恢复。 | 现状应写普通ZIP+历史加密格式兼容；新增加密备份是RayNo1产品决定。 |
| Pull/HTTP方向 | system-settings旧段写Master拉Agent；remote-servers及FAQ写Agent从Master取指令。 | 承认三模式与回退，但以服务管理文档表述为优先；协议时序需Agent源码或运行验证。 |
| 普通用户自建路由出站 | 同一路由出站文档前段称仅管理员，后段详细列用户开关、POST /api/user/routed-outbound和配额。 | 按后段条件能力收录；不把管理员套餐池与成员私有路由混为一类。 |
| 支持客户端数量 | README具体列10个格式家族；docs称12+，也包含auto、ClashMeta和clash-to-loon等模式。 | 逐个列明确名称，不声称已验证12个独立转换器或全部协议跨客户端可用。 |
| AnyTLS REALITY | 协议矩阵标题称全部经mihomo测试，但同表明示该组合没有Clash/Mihomo/sing-box客户端支持。 | 区分管理后端能配置与常用客户端能连接；不要纳入通用兼容承诺。 |
| TG管理员数量 | 旧README提及禁止绑定第二个TG管理员；当前Bot文档允许逗号分隔多个管理员ID。 | 收录管理员名单机制，账号绑定与Bot授权名单上限需实测。 |
| 联邦加密保证 | 分享文档称Owner不可窥探操作且不支持加密可降级；最新稳定版强制加密说明、权限模型与转发实现未公开。 | 只确认官方声称的HTTPS/ECDH/权限边界，不背书密码学安全属性。 |
| 公开仓库许可及源码 | README结尾写MIT，旧更新日志写Source Available License；树中无LICENSE与应用源码。 | 只审查公开资料；不可据此认定应用为MIT开源或可直接复用全部代码。 |
| 文档时间 | README日志停8月17；docs changelog快照称8月16最新版；GitHub releases已到9月14。 | 版本判断以Release元数据；每项注明文档或Release层级，不能将搜索索引时间当应用版本。 |
| PG备份行为 | 自动备份页允许数据库勾选；备份恢复页又说PG会拒绝无数据库ZIP。 | 必须以恢复演练确认；RayNo1验收要求PG完整备份明确包含数据库。 |

## 可确认的公开接口/页面路径

这是一份**文档路由摘录，不是源码路由审计或完整API规范**。未探测端点，无鉴权请求，无执行操作。参数、响应、权限最终应以真实服务的API材料为准。

| 方法/类别 | 路径 | 用途 | 证据 |
|---|---|---|---|
| GET | `/api/public/probe-servers` | 公开探针状态 | README.md / docs/probe-api |
| WS | `/api/public/probe-ws` | 公开探针实时推送 | README.md / docs/probe-api |
| GET | `/api/public/probe-series` | 探针历史序列 | README.md / docs/probe-api |
| GET | `/api/clash/subscribe` | 格式化订阅入口 | docs/generator |
| GET | `/api/user/package-subscribe` | 套餐订阅 | docs/cloudflare-tunnel |
| GET | `/api/subscribe` | 兼容订阅入口 | docs/cloudflare-tunnel |
| GET | `/x/…` | 短链接/套餐链接前缀 | docs/generator / docs/cloudflare-tunnel |
| GET/POST | `/api/admin/remote/routing` | 远程路由读取修改 | docs/xray-routing |
| GET | `/api/admin/remote/outbounds` | 远程出站列表 | docs/xray-routing |
| POST | `/api/admin/remote/services/control` | 远程服务控制 | docs/xray-routing |
| POST | `/api/admin/routed-outbound` | 管理员路由子节点 | docs/routed-outbound |
| POST | `/api/user/routed-outbound` | 成员私有路由子节点 | docs/routed-outbound |
| POST | `/api/admin/certificates/upload` | 证书Webhook | docs/certificates |
| MCP/HTTP | `/mcp` | streamable-HTTP接口 | docs/mcp |
| UI | `/tg-app` | 内置Telegram Mini App | docs/tool-mmwx-tgbot |
| UI | `/system-settings` | 系统设置页 | docs/system-settings |
| UI | `/migrate-from-mmw` | 迁移向导 | docs/upgrade-from-mmw |
| prefix | `/api/admin/migrate/…` | 文档声称6个管理员迁移接口，未列完整 | docs/upgrade-from-mmw |
| prefix | `/api/child/…` | 联邦转发白名单前缀 | docs/share-server |
| unknown | `/api/admin/traffic-ledger/forward` | 新版转发台账；方法未公开 | release v0.5.5-beta.5 |
| removed | `/api/admin/carpool` | v0.5.5-beta.1移除 | release v0.5.5-beta.1 |

## 尚不能确认的功能

以下都不能冒充妙妙屋X现成功能；若RayNo1需要，作为自身需求另建条目：

- 应用后端/前端源码、全量API路由、中间件与数据库schema在本次公开仓库树中不可得，无法做到实现级全功能证明。
- 原生“车主/车队”多租户角色、细粒度RBAC、独立车库空间未获确认；不能直接等同于联邦Owner。
- 支付网关、余额、在线订单、账单/发票、自动收款对账、退款、资金托管或平台抽成未获确认。用户自助续费并不证明支付闭环。
- 拼车市场的车位数、候补队列、预约、审核、拼车群、成员AA分摊与费用账本未获确认。
- 工单模块未获确认；发布日志的“工单批”是维护描述，不能据此发明产品工单系统。
- 邮件/短信/企业微信/Discord/任意Webhook通知渠道未获确认；明确证据为Telegram/Bot/Mini App及证书Webhook。
- OAuth/OIDC/SAML组织登录、密码策略、完整会话设备清单、审计日志不可篡改与租户数据隔离未获确认。
- 服务器SSH网页终端、任意远程Shell、Docker全生命周期、操作系统补丁管理未获确认；不要由Agent推断通用运维平台。
- Xray之外sing-box核心的远程完整管理未获确认；SingBox输出与AnyTLS等可配置不能等同于sing-box管理。
- 应用自动回滚、数据库迁移向后兼容、多主高可用、横向扩容、离线可用SLA未获确认。
- 在线IP历史保留时间、完整流量账本保留策略、删除用户后的隐私清理及导出能力未获确认。
- MCP 109工具的全部签名和权限、最新合并订阅去重/优先级算法、节点空选精确语义仍需实机或上游接口材料。
- 文档里的交互演示明确是本地mock，不能视为真实产品功能测试；本次未运行任何目标仓库脚本或二进制。

## 建议的RayNo1验收组织

把管理员服务器运维、车主套餐运营、成员订阅消费做成三个独立工作区。共享物理资源、套餐实例和成员私有出口分别建对象和权限，不以“能看到按钮”代替服务端授权。

覆盖验收至少贯通：接入服务器→建入站→同步节点→建套餐→开成员→下载不同客户端配置→产生流量→多实例独立对账→触发超额/到期→续费恢复→变更入口/证书→通知成员→备份恢复。新版本差异要追加WebAuthn、在线IP上限、转发端口计费、合并订阅、外部源刷新与私有出口权限验证。

这些是从已确认能力推导的RayNo1验收建议，不是上游额外功能声明。

## 数据与证据文件

- `miaomiao-features.json`：结构化条目、角色、状态、证据、冲突、路由摘录与待确认项。
- `miaomiaowuX/`：固定commit浅克隆，仅14个公开分发文件。
- `releases.json`、`releases-notes.md`：38条官方Release快照及本地可读版。
- `docs-index.html`、`docs-app.js`、`docs-extracted.json`、`docs-extracted/`：官方SPA快照与59篇搜索语料。后两者仅为研究中间证据，不应照抄命令/标点作为配置。

## 官方文档覆盖目录

- [关于妙妙屋X](https://miaomiaowux.com/docs/about) — `docs-extracted/about.txt`
- [定时同步备份](https://miaomiaowux.com/docs/backup-auto-sync) — `docs-extracted/backup-auto-sync.txt`
- [备份与恢复](https://miaomiaowux.com/docs/backup-restore) — `docs-extracted/backup-restore.txt`
- [证书管理](https://miaomiaowux.com/docs/certificates) — `docs-extracted/certificates.txt`
- [更新日志](https://miaomiaowux.com/docs/changelog) — `docs-extracted/changelog.txt`
- [使用 Cloudflare Tunnel 发布主控](https://miaomiaowux.com/docs/cloudflare-tunnel) — `docs-extracted/cloudflare-tunnel.txt`
- [与妙妙屋的区别](https://miaomiaowux.com/docs/comparison) — `docs-extracted/comparison.txt`
- [自定义 CSS](https://miaomiaowux.com/docs/custom-css) — `docs-extracted/custom-css.txt`
- [覆写管理](https://miaomiaowux.com/docs/custom-rules) — `docs-extracted/custom-rules.txt`
- [内嵌 Xray](https://miaomiaowux.com/docs/embedded-xray) — `docs-extracted/embedded-xray.txt`
- [拼车教程](https://miaomiaowux.com/docs/faq-carpool) — `docs-extracted/faq-carpool.txt`
- [常见操作](https://miaomiaowux.com/docs/faq-common-ops) — `docs-extracted/faq-common-ops.txt`
- [安装与部署](https://miaomiaowux.com/docs/faq-install-deploy) — `docs-extracted/faq-install-deploy.txt`
- [节点的创建与使用(入站与出站)](https://miaomiaowux.com/docs/faq-node-management) — `docs-extracted/faq-node-management.txt`
- [协议与入站](https://miaomiaowux.com/docs/faq-protocol-inbound) — `docs-extracted/faq-protocol-inbound.txt`
- [服务器管理](https://miaomiaowux.com/docs/faq-server-management) — `docs-extracted/faq-server-management.txt`
- [订阅与客户端](https://miaomiaowux.com/docs/faq-sub-client) — `docs-extracted/faq-sub-client.txt`
- [常见问题](https://miaomiaowux.com/docs/faq) — `docs-extracted/faq.txt`
- [核心特性](https://miaomiaowux.com/docs/features) — `docs-extracted/features.txt`
- [生成订阅](https://miaomiaowux.com/docs/generator) — `docs-extracted/generator.txt`
- [Agent 部署](https://miaomiaowux.com/docs/install-agent) — `docs-extracted/install-agent.txt`
- [直接安装](https://miaomiaowux.com/docs/install-direct) — `docs-extracted/install-direct.txt`
- [Docker 安装](https://miaomiaowux.com/docs/install-docker) — `docs-extracted/install-docker.txt`
- [外置探针部署](https://miaomiaowux.com/docs/install-external-probe) — `docs-extracted/install-external-probe.txt`
- [接入 AI Agent(MCP)](https://miaomiaowux.com/docs/mcp) — `docs-extracted/mcp.txt`
- [节点限速](https://miaomiaowux.com/docs/node-ratelimit) — `docs-extracted/node-ratelimit.txt`
- [节点测速](https://miaomiaowux.com/docs/node-speedtest) — `docs-extracted/node-speedtest.txt`
- [节点管理](https://miaomiaowux.com/docs/nodes) — `docs-extracted/nodes.txt`
- [套餐管理](https://miaomiaowux.com/docs/packages) — `docs-extracted/packages.txt`
- [探针 API 字段说明](https://miaomiaowux.com/docs/probe-api) — `docs-extracted/probe-api.txt`
- [AnyTLS](https://miaomiaowux.com/docs/protocol-anytls) — `docs-extracted/protocol-anytls.txt`
- [Hysteria2](https://miaomiaowux.com/docs/protocol-hysteria2) — `docs-extracted/protocol-hysteria2.txt`
- [协议矩阵](https://miaomiaowux.com/docs/protocol-matrix) — `docs-extracted/protocol-matrix.txt`
- [Shadowsocks](https://miaomiaowux.com/docs/protocol-shadowsocks) — `docs-extracted/protocol-shadowsocks.txt`
- [Snell](https://miaomiaowux.com/docs/protocol-snell) — `docs-extracted/protocol-snell.txt`
- [Trojan](https://miaomiaowux.com/docs/protocol-trojan) — `docs-extracted/protocol-trojan.txt`
- [VLESS](https://miaomiaowux.com/docs/protocol-vless) — `docs-extracted/protocol-vless.txt`
- [VMess](https://miaomiaowux.com/docs/protocol-vmess) — `docs-extracted/protocol-vmess.txt`
- [快速开始](https://miaomiaowux.com/docs/quick-start) — `docs-extracted/quick-start.txt`
- [远程服务器](https://miaomiaowux.com/docs/remote-servers) — `docs-extracted/remote-servers.txt`
- [路由出站](https://miaomiaowux.com/docs/routed-outbound) — `docs-extracted/routed-outbound.txt`
- [分享服务器](https://miaomiaowux.com/docs/share-server) — `docs-extracted/share-server.txt`
- [订阅文件](https://miaomiaowux.com/docs/subscribe-files) — `docs-extracted/subscribe-files.txt`
- [系统要求](https://miaomiaowux.com/docs/system-requirements) — `docs-extracted/system-requirements.txt`
- [系统设置](https://miaomiaowux.com/docs/system-settings) — `docs-extracted/system-settings.txt`
- [模板管理](https://miaomiaowux.com/docs/templates) — `docs-extracted/templates.txt`
- [Cloudflare Turnstile 人机验证](https://miaomiaowux.com/docs/tool-cloudflare-turnstile) — `docs-extracted/tool-cloudflare-turnstile.txt`
- [Telegram 机器人(mmwX-tgbot)](https://miaomiaowux.com/docs/tool-mmwx-tgbot) — `docs-extracted/tool-mmwx-tgbot.txt`
- [流量统计口径](https://miaomiaowux.com/docs/traffic-accounting) — `docs-extracted/traffic-accounting.txt`
- [新手教程](https://miaomiaowux.com/docs/tutorial) — `docs-extracted/tutorial.txt`
- [版本更新](https://miaomiaowux.com/docs/update) — `docs-extracted/update.txt`
- [从妙妙屋迁移到妙妙屋X](https://miaomiaowux.com/docs/upgrade-from-mmw) — `docs-extracted/upgrade-from-mmw.txt`
- [用户管理](https://miaomiaowux.com/docs/users) — `docs-extracted/users.txt`
- [Nginx 网站管理](https://miaomiaowux.com/docs/website-management) — `docs-extracted/website-management.txt`
- [Xray 入站管理](https://miaomiaowux.com/docs/xray-inbounds) — `docs-extracted/xray-inbounds.txt`
- [Xray 出站管理](https://miaomiaowux.com/docs/xray-outbounds) — `docs-extracted/xray-outbounds.txt`
- [Xray 路由管理](https://miaomiaowux.com/docs/xray-routing) — `docs-extracted/xray-routing.txt`
- [Xray 服务管理](https://miaomiaowux.com/docs/xray-service) — `docs-extracted/xray-service.txt`
- [Xray 系统配置](https://miaomiaowux.com/docs/xray-system-config) — `docs-extracted/xray-system-config.txt`
