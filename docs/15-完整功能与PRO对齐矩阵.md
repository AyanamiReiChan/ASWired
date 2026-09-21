> 当前接入范围（2026-09-16）：服务器仅通过 ASWired Agent 接入，面板 API 适配已移出实施范围；本文相关旧设计只保留追溯。范围冲突时以 [当前实施范围](CURRENT-SCOPE.md) 为准。

> 当前实现说明（2026-09-16）：本文件保留设计目标与历史方案。已实现范围、测试证据和剩余差异以 [实现核对](reference/implementation-audit.json) 及三个仓库的 README 为准；未公开部分已获准采用 ASWired 原创等效实现，不承诺妙妙屋私有协议互通。

# 完整功能与 PRO 对齐矩阵

> **状态：设计待确认，全部功能尚未实现。** 本轮按用户最新要求修订：除 PRO 商业授权门槛，以及此前明确保留的 ASWired 品牌、深色、JWT、自有探针/外部 Komari 和三私有仓要求外，其余按妙妙屋官方公开设计及固定版本验证结果对齐。
>
> 原始基线仍为妙妙屋 X **v0.5.4 稳定版 + v0.5.5-beta.6 预发布版**。原始 146 条审计事实不改写；公开描述不足的内部机制列为待核对，不能把先前自行设计的机制当作上游事实。

## 1. 范围与判定

- **146 个原始功能 ID + 22 个细化 ID = 168 行映射**，不是 168 项已经实现的功能。每行保留原 ID/名称/领域、主责与配合仓库、设计引用、阶段、具体验收和来源。
- 当前全部 `implementation_status = not_implemented`。网站页面、模拟状态、字段保存或测试替身不证明节点、后端或客户端行为已实现。
- 除本文件明确列出的用户覆盖项外，按官方公开行为及固定版本样本验收；每行的边界用例是待执行测试，**不是声称已经知道上游的事务、锁、日志或协议内部结构**。
- 难项保留在完整范围。私有协议、授权样本或合法可用实现不足时记录待核对，不能静默删除，也不能用另一个自创流程冒充已对齐。
- 结构化版本：[aswired-alignment.json](reference/aswired-alignment.json)。原始事实：[miaomiao-features.json](reference/miaomiao-features.json)。

### 三个私有仓库

| 简称 | 仓库 | 职责 |
|---|---|---|
| W | ASWired | 网站、成员界面、自有内置/独立探针展示、交互 |
| S | ASWired-Server | 身份与业务、配置管理、订阅、统计、探针服务、联邦 |
| A | ASWired-Agent | Agent、同进程embedded核心、外置核心管理、自有采集、节点运维；同仓家用测速端 |

三仓独立维护与发布，互相约定接口版本；分仓不意味着把同进程核心拆成独立服务。详见[三仓协作设计](14-三仓拆分与协作设计.md)。

## 2. 对齐基线与用户覆盖项

### 本轮确定的实现方向

| 项目 | 对齐目标与证据 |
|---|---|
| embedded | xray-core编进Agent，在**同一进程**内运行、调用、退出与升级；external仍是独立Xray进程经gRPC管理。[内嵌说明](https://miaomiaowux.com/docs/embedded-xray/) |
| Agent认证与连接 | 每服务器独立Token、主控身份公钥和securechan；WS/HTTP/Pull及回退按官方公开说明核对。[Agent部署](https://miaomiaowux.com/docs/install-agent/) |
| Vision | 使用**VisionLimiterHook接入splice**限速；无规则保留原始splice。仅通过copy路径限速不能通过此项。[内嵌说明](https://miaomiaowux.com/docs/embedded-xray/) |
| Docker | 按官方**host网络 + embedded**容器设计，包含Nginx及依赖；具体持久目录与环境变量按公开安装资料核对。[Docker约束](https://miaomiaowux.com/docs/install-agent/#docker-部署) |
| 联邦 | consumer操作经owner转发至Agent；owner保留令牌和路径控制，但**不能读取消费方操作正文**，不在owner明文重编译正文。[分享说明](https://miaomiaowux.com/docs/share-server/) |
| 用户认证 | 保留用户明确要求的JWT；官方用户页描述的`MM-Authorization`请求头和过期重登作为已知行为。[用户认证](https://miaomiaowux.com/docs/users/) |
| 自有探针 | 原生采集、内置/独立域名/Worker展示、历史、地球和密码/Passkey回接全部保留。详细边界见[设计18](18-自有探针与登录回接设计.md)。 |

独立helper/coordinator/observer、多sidecar、availability/accounting两种模式，以及自创的命令提交、离线许可和升级回滚状态机，**不再作为对齐承诺**。内部未公开部分按下面的核对门槛处理。

| user_override | 用户已明确要求 |
|---|---|
| aswired_brand | 名称ASWired、用户指定图标；不冒充上游品牌。 |
| dark_only | 全站及自有探针固定深色，无浅色、系统跟随或个人主题切换。 |
| external_probe_komari_only | 仅外部第三方探针接入限 **Komari1.2.5-fix2**；自有采集、内置/独立展示和登录回接不受此限制。 |
| user_auth_jwt | 网站和自有探针强制JWT用户认证；不自行固定未公开算法、TTL、刷新或跨域协议。 |
| no_pro_license_gate | **全部PRO功能不设付费墙、商业许可证或授权配额**；技术身份及消息鉴权全部保留。 |
| three_private_repositories | 网站、主控、Agent三个独立仓库保持私有，用户明确确认后才改public。 |

“独立部署自有探针页”是展示部署方式，“外部探针供应商”是数据来源，二者分开配置。ASWired原生采集不依赖Komari；同机双来源分别标识和选择，不能相加成两份主机流量。主机观测也不能替代用户计费。

### JWT及登录回接的事实边界

官方用户页明确JWT、`MM-Authorization`和过期后重新登录；README中`JWT_SECRET`及未设置时随机Token的配置说明与该页存在需核对的差异。**ASWired仍按用户要求强制JWT，原始上游事实不改写。**[用户页](https://miaomiaowux.com/docs/users/)、[固定版本README](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)

JWT签名算法、claims、具体有效期、是否有刷新令牌、浏览器存放方式、退出失效及跨域回接细节尚不能据上述页面确定。先前的EdDSA/5分钟、7天/30天、强制Cookie/BFF、PKCE单次码和会话族方案不再写成必须对齐的协议；按公开实现与固定版本核对后确定。密码、Passkey、探针回接和JWT登录能力仍必须完成。

Agent Token、主控公钥、securechan、联邦密钥、Komari凭据、公开探针读密钥及用户JWT各有用途。去掉PRO商业检查不会取消技术鉴权，也不使读密钥或Komari凭据变成登录凭据。

## 3. 阶段与未公开项处理

| 阶段 | 主要工作 |
|---|---|
| P0 | 固定官方版本、公开参数/样本、三仓边界及未知项清单。 |
| P1 | Token/公钥/securechan连接、用户JWT、external/同进程embedded、基础原生采集。 |
| P2 | 用户/套餐控制、统计、限速、连接/IP、VisionLimiterHook与自动规则。 |
| P3 | 官方部署环境、Docker host+embedded、节点服务、网络、证书和探针部署。 |
| P4 | 主控/家用测速及受限联邦分享、端到端加密转发。 |
| P5 | 网站全业务、订阅模板、通知/TG/MCP、自有历史展示与登录回接、Komari整合。 |
| P6 | 全功能、全平台/协议以及实际升级恢复行为完成固定版本对照。 |

单行阶段是主工作包起点；最终统一P6验收。P1完成基本身份不等于P5的跨域登录回接已完成。

| 未公开或冲突项 | 必须取得的结果 |
|---|---|
| securechan/Pull私有消息 | 固定版本的参数、方向、加密要求和可核对交互样本。 |
| 用户热更新、离线和重启 | 记录是否重启、存量连接、断网到期、计量缺口和恢复的真实行为。 |
| 升级、数据库与配置提交 | 按官方发布/安装器及授权实机核对；不预设Agent本地账本、独立updater或自动回滚机制。 |
| Vision接口及协议模块 | 取得合法可用实现，证明Hook和splice路径以及各承诺协议的真实互通。 |
| JWT/扫码/探针回接 | 核对请求头、时效、存储和回接；算法及刷新缺少依据时明确保持待核对。 |
| 联邦 | 验证owner不可读正文；核对密钥终点、授权位置、私有封装及旧版降级/新版加密差异。 |
| 旧备份、迁移、客户端私有事件 | 使用合法授权样本核对格式与行为；不宣称未知格式已兼容。 |

## 4. 原始146项映射

以下“目标”和“验收”须与引用的公开范围和固定版本对照。事实状态来自原审计，未做运行验证。边界用例失败时记录差异；不要反向声称参考产品具有未公开的内部机制。

### 身份与权限（11项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `identity.roles`<br>**管理员与普通用户** | 网站和自有探针使用用户要求的JWT认证，按官方MM-Authorization请求头及过期重登行为对齐管理员/普通用户权限。<br>覆盖：user_auth_jwt<br>待核对/边界：JWT算法、claims、有效期与退出失效细则未完整公开；不预定sid/session_version方案。 | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 有效JWT按角色访问；无效或过期Token拒绝并要求重登；普通用户无法读取他人订阅与资料。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `identity.create`<br>**账户创建与资料** | 创建账户及唯一订阅身份，提供资料维护、搜索和初始密码交付。 | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) | 重名拒绝；搜索昵称与套餐得到同一账户；创建响应仅授权人员可取初始凭据。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `identity.lifecycle`<br>**账户启停与删除** | 按官方账户启停和删除流程撤销登录及节点访问，清理用户凭据与专属资源。<br>覆盖：user_auth_jwt<br>待核对/边界：登录退出/停用即时性、内部吊销和离线节点执行细则未公开，待固定版本核对。 | S；配合W<br>P2 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 停用账户后按固定版本核对退出及接入拒绝；删除A不删B或共享父节点；退出即时性和内部吊销机制记录实测结果。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `identity.personal`<br>**个人设置** | 支持个人资料、密码、默认模板、两步验证和订阅凭据设置，固定深色；网站及自有探针使用JWT登录。<br>覆盖：dark_only、user_auth_jwt | W；配合S<br>P5 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 改密码后旧密码无效；成员不能改他人资料；过期Token返回登录；个人设置无主题切换。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/mcp)；未实机验证 |
| `identity.totp`<br>**TOTP 两步验证** | 按官方两步验证入口完成TOTP绑定、验证和解除，并在所需验证完成后建立JWT登录。<br>覆盖：user_auth_jwt | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 绑定后登录要求正确TOTP；错误/过期验证码拒绝；解除后按固定版本核对登录行为，不预设未公开的恢复码机制。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/comparison)；未实机验证 |
| `identity.passkey`<br>**Passkey 登录** | 对齐Passkey登录、个人管理、Related Origin Requests及自有探针登录态回接；登录结果采用JWT。<br>覆盖：user_auth_jwt<br>待核对/边界：跨域登录回接消息、令牌承载、关联域兼容矩阵未公开完整，不强制PKCE/BFF或自建刷新协议。 | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 密码/Passkey均能进入相应网站及探针页面；过期JWT重登；错误来源/密钥拒绝；跨域回接数据和浏览器支持按固定版本验证。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.1)；未实机验证 |
| `identity.tokens`<br>**API Token 管理** | 个人命名API令牌继承账户授权；管理令牌独立轮换并仅初次展示。 | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) | 数据库无明文；吊销后API/MCP均拒绝；低权令牌无法调用管理员接口。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/mcp)；未实机验证 |
| `identity.subscription_credentials`<br>**订阅凭据与短码轮换** | 支持用户及文件短码、自定义短码、单个和批量令牌轮换。 | S；配合W<br>P2 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) | 轮换后所有旧链接失效；短码碰撞拒绝；批量任务重试不产生第二套新凭据。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `identity.qr_client_login`<br>**手机及官方客户端登录** | 按公开手机扫码及客户端唤起流程提供登录，ASWired账户采用JWT；客户端私有交互按授权样本核对。<br>覆盖：user_auth_jwt<br>待核对/边界：按官方公开行为和授权样本核对客户端互操作，不用自定义私有协议替代验证。<br>待核对/边界：扫码及客户端私有登录消息需公开契约或授权固定版本样本。 | S；配合W<br>P5 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) [18](18-自有探针与登录回接设计.md) | 扫码前后确认与登录结果可复现；失效二维码不能登录；客户端唤起及订阅事件需真实客户端验证，不以演示动画替代。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；未实机验证 |
| `identity.menu_quota`<br>**用户菜单与资源配额** | 配置成员菜单、自建节点/路由上限和每日操作限额。 | S；配合W<br>P2 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) | 并发创建不越配额；关闭创建保留既有资源；隐藏菜单仍由API检查权限。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `identity.owner_role`<br>**车主角色边界** | 按官方管理员和普通用户两种登录角色设计；车主是管理员套餐运营称谓，联邦Owner是主控身份。<br>待核对/边界：原始审计已说明车主不是独立上游登录角色；本轮保留管理员/普通用户及联邦Owner边界。 | S；配合W<br>P1 → P6；[04](04-数据模型与状态机.md) [05](05-API与Agent协议.md) [08](08-安全权限与可靠性.md) | 不新增未公开车主租户角色或独立权限状态机；套餐运营按管理员权限，普通用户仅使用获准资源。 | design_mapping_not_native_role<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |

### 套餐与拼车（14项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `package.templates`<br>**套餐模板 CRUD** | 套餐模板管理配额、周期、计量、速率、连接/IP限制、节点与客户端模板。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 复制套餐后各字段独立；被使用模板删除需明确解绑策略；非法周期拒绝。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |
| `package.instance`<br>**独立多套餐实例** | 同一用户多套餐使用独立凭据、用量、额度、连接数、重置基线和到期时间。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 同物理节点两个套餐凭据和用量独立；续期/重置A不改变B；跨子凭据连接/IP汇总规则按固定版本核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `package.assignment`<br>**绑定、解绑、续期** | 对齐套餐绑定/解绑、快捷续期、自定到期日、月度1–31日重置及流量覆写。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 常用续期天数和指定日期正确保存；月末、重复点击与重启边界按固定版本样本核对，不先指定权益版本状态机。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `package.renewal_view`<br>**续费工作视图** | 提供套餐/到期筛选的续费视图与批量续期、流量重置结果。 | W；配合S<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 跨页选择后仅选中实例被续期；失败项可单独重试；筛选不遗漏临界到期实例。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `package.quota`<br>**总额度、单节点额度与覆写** | 总额、节点额和用户覆写分别保存，空继承、0不限与数值有区别。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 三种输入往返不混淆；扩额解除超额状态；缩额按既有用量立即重算可用权益。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `package.node_scope`<br>**套餐节点范围与呈现** | 按套餐标签选节点、排序和专属名称，对齐固定版本的空选择与全部节点规则。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 选中范围和生成订阅一致；空集合相关文档冲突按v0.5.5-beta.6核对，不沿用旧版危险全量解释。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |
| `package.client_templates`<br>**按客户端绑定模板** | 为每个套餐选择Clash/Surge/Loon模板并定义缺省回退。 | S；配合W+A<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 三个客户端分别命中指定模板；删除绑定模板返回可解释回退而不生成无效配置。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |
| `package.billing`<br>**用户计费倍率** | 原始上下行与冻结倍率生成不可变增量账目，历史倍率不追溯改写。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 同一100MiB输入在倍率切换前后分段记账；补传和重放只计一次。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/traffic-accounting)；未实机验证 |
| `package.expiry_enforce`<br>**到期与超额执行** | 对齐到期撤除接入、超额停用/降速、额度恢复及近额度快速执行。 | S；配合W+A<br>P2 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 实测到期、超额和恢复；对v0.5.4所述15秒内踢出记录采样、送达和断开时间以核对起算条件，不自行重定义时限或声称严格字节上界。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |
| `package.member_self_renew`<br>**成员自助续费** | 对齐成员自主续费、MiniApp续费及已续费通知入口，付款/审批/记账细则按固定版本核对。<br>待核对/边界：支付、审批与记账细则未公开。 | S；配合W+A<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 网站与MiniApp可完成公开续费流程；已续费按钮的实际作用有样本记录；未公开审批机制不能以自定义流程判定对齐。 | confirmed_documented<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；未实机验证 |
| `package.carpool_flow`<br>**基础拼车开通流程** | 串联服务器、入站、套餐、账户、绑定及个人订阅的完整开通向导。 | W；配合S<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 从空环境建两个成员后同端口可连且凭据/账目独立；任一步失败可继续恢复。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/faq-carpool)；未实机验证 |
| `package.public_market`<br>**发布到官方拼车页** | 保留该历史事实；按最新预发布移除官方拼车发布入口及对应管理路由，不自行另建市场替代。<br>待核对/边界：目标预发布已移除此入口及路由；保留历史记录，不新增自托管市场替代。 | S；配合W+A<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 固定v0.5.5-beta.6界面及路由不出现已移除发布能力；历史迁移资源的显示与清理按授权样本核对。 | historical_removed_in_latest_prerelease<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；未实机验证 |
| `package.redeem`<br>**邀请码与兑换码** | 兑换码支持天数、长期有效、次数及TG创建和吊销。 | S；配合W+A<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 最后一次兑换并发只有一个成功；吊销即拒绝；兑换重试不重复绑定套餐。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；未实机验证 |
| `package.merged`<br>**全部套餐合并订阅** | 对齐全部套餐合并订阅开关、虚拟卡片、合并短码与生成流程。<br>待核对/边界：同节点/重名/多套餐合并冲突算法未公开。 | S；配合W+A<br>P5 → P6；[04](04-数据模型与状态机.md) [06](06-拼车套餐流量与账务规则.md) | 开关控制入口和输出；多套餐、同物理节点与重名条目按固定版本核对冲突算法，不自行另定合并规则。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；未实机验证 |

### 服务器与Agent（13项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `server.inventory`<br>**多服务器清单** | 统一多服务器分组、筛选、排序、心跳和版本；自有Agent采集主机指标，外部第三方接入仅Komari1.2.5-fix2。<br>覆盖：external_probe_komari_only | S；配合W+A<br>P1 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) [18](18-自有探针与登录回接设计.md) | 未安装Komari也能显示自有CPU/内存/磁盘/网卡指标；每源保留采样时间与离线状态；分组不改归属，同机双源不产生双份服务器。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.enrollment`<br>**Agent 注册与安装** | 按官方原生安装及Docker入口生成独立agent_token和主控身份公钥配置；Docker采用host网络和embedded。<br>待核对/边界：安装公开字段已确认；securechan私有封装及升级失败恢复未公开完整。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 两台服务器使用各自Token可上线；缺Token/主控公钥按强制加密配置拒绝；Docker host+embedded启动，bridge与不支持模式有对应错误。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.connection`<br>**三种连接与回退** | 按官方WS、HTTP、Pull三种连接、回退及重连行为实现，使用token、master_public_key和securechan技术鉴权。<br>待核对/边界：Pull方向存在文档差异；回退顺序、私有消息、重试/去重内部机制待固定版本核对。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 分别验证三种连接及断线回退；错误Token/公钥或不满足加密要求时拒绝；Pull方向及私有消息结构以固定版本核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.address`<br>**IPv4/IPv6、域名、DDNS** | 管理多地址、IPv6域名、DDNS、入口锁定和订阅地址对账。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | A/AAAA变化后仅未锁定入口更新；IPv6禁用不生成不可达AAAA入口；回滚恢复原映射。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.ports`<br>**端口管理** | 对齐Agent端口、动态入站端口范围、占用探测、自动分配和转发换端口。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 占用端口时按官方规则换选；TCP/UDP与新旧端口可达性核对；并发和失败处理以固定版本行为确定。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.credentials`<br>**服务器凭据生命周期** | 对齐Server/Agent Token生成、轮换和在线同步、主控公钥及加密通道，测速令牌按公开15分钟宽限核对。<br>待核对/边界：Agent凭据轮换细则及密钥交换完整协议未公开。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 改Token后新旧连接结果符合固定版本；缺主控公钥不能误报加密成功；测速旧令牌仅在核实宽限内有效。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.operations`<br>**Agent 更新与卸载** | 对齐单台、批量/滚动升级、版本提示、流式进度、卸载及家用测速端更新。<br>待核对/边界：断电、进程中断和自动回滚机制未公开，不采用自建updater状态机作为替代事实。 | A；配合S+W<br>P6 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 真实升级后版本和业务状态可核对，批次进度/失败可见；断电恢复及自动回滚内部机制未公开，须记录固定版本结果后确定。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.mode`<br>**外置/内嵌 Xray 模式** | external为独立Xray进程经gRPC管理；embedded将xray-core编入Agent同一进程，随Agent启动、退出和升级。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) | 查看进程确认embedded没有独立核心worker；切换后的端口/配置及功能与固定版本一致；Docker采用host网络且仅embedded。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray)；未实机验证 |
| `server.accounting`<br>**服务器容量与周期** | 服务器容量支持自有网卡/Xray来源、四种方向和周期校准；可选Komari外部来源独立标识，与用户账单分离。<br>覆盖：external_probe_komari_only | S；配合W+A<br>P2 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) [18](18-自有探针与登录回接设计.md) | 上下行10/20分别算10、20、30、20；同机切换自有/Komari来源建立新基线不重复累加；网卡重置记缺口；校准有独立审计。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.assets`<br>**服务器商务与探针资料** | 保存服务器地区、供应商链接、成本币种和续费日期，供自有探针地图及续费时间轴按字段权限展示。 | S；配合W+A<br>P5 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) [18](18-自有探针与登录回接设计.md) | 公开地图/时间轴仅含允许地点、续费和供应商字段；成本默认仅授权角色可见；不同币种不直接相加，隐藏坐标不从API泄露。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.config_history`<br>**配置历史与回滚** | 对齐来源、Hash、快照预览、差异检查、验证后重新下发及默认配置修复。<br>待核对/边界：提交原子性、断电恢复和回滚与用户变更关系未公开。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 保存产生可查看历史；错误配置不能验证通过；回滚后实际内容与选中快照核对，未公开提交/崩溃恢复机制不自行指定。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.sync`<br>**节点与地址一致性** | 对齐自动/手动入站扫描、节点同步、地址对账、配置漂移及入口故障降级推送。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 扫描后节点/入站映射、地址与固定样本一致；重复扫描无重复条目；自动覆盖与冲突处理以固定版本结果为准。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `server.self_site`<br>**REALITY 本机站点复用** | 提供REALITY本机站点、回落/Tunnel向导，联合规划Xray与Nginx端口证书。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 同443业务与站点按规则可达；冲突在部署前被阻止；失败恢复原站点和代理。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |

### Xray配置（12项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `xray.services`<br>**Xray/Nginx 服务控制** | 按服务适配器安装、启停、扫描、卸载Xray/Nginx并流式回报阶段。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 安装重试不重复创建服务；启动失败有退出原因；操作范围不越已认领实例。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-service)；未实机验证 |
| `xray.global_config`<br>**完整 JSON 配置管理** | 按官方完整JSON编辑、格式化、保存并自动重启，覆盖日志、DNS、策略、统计及API项。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 保存有效配置后实际重启并生效；坏JSON显示错误；历史快照可重新下发，不将自创准备/提交状态机作为对齐要求。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-system-config)；未实机验证 |
| `xray.inbounds`<br>**入站 CRUD 与节点联动** | 对齐入站浏览、增改删、JSON预览、多用户及与节点的双向联动。<br>待核对/边界：用户变更是否重启、存量连接处理和失败恢复须固定版本核对。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 新增入站可生成节点并真实连接；删除后的节点与用户处理符合固定版本；变更是否重启及影响范围如实记录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-inbounds)；未实机验证 |
| `xray.wizard`<br>**简易与专家向导** | 简易向导自动端口/凭据、专家向导提供监听/嗅探/中转/协议细项，共享官方参数范围。 | S；配合W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 同组参数的JSON预览与实际配置一致；简易/专家切换保留公开字段；不支持组合返回对应错误。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-inbounds)；未实机验证 |
| `xray.protocols`<br>**受管协议与传输** | 按运行时×协议×传输×客户端矩阵覆盖全部公开受管组合。<br>待核对/边界：协议实现或引擎必须具有合法来源和可分发许可；取得真实客户端互通样本前不标支持。闭源/缺引擎不会从承诺清单删除，而是阻断完整对齐验收。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 每个承诺单元有真实握手、双向流量和坏凭据用例；Snell等不得只验导入/订阅字符串。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-inbounds)；未实机验证 |
| `xray.reality`<br>**REALITY 域名与保护** | 实现目标域名探测、池管理、贡献门槛和允许域名保护。 | S；配合W<br>P3 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 不允许目标在准备阶段拒绝；批量探测有并发上限；共享池不等同可随意探测内网。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `xray.protocol_options`<br>**协议特殊参数** | 按协议保存并验证密钥代际、混淆、TLS证书与flow等专用字段。<br>待核对/边界：需要各Snell版本等真实合法客户端样本和对应合法引擎；导入/导出字段成功不等于受管服务端实现。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | Snell各版本凭据不串用；错误Vision flow/证书/SNI握手失败可定位；编辑往返不丢字段。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/protocol-matrix)；未实机验证 |
| `xray.outbounds`<br>**出站 CRUD 与排序** | 管理并排序直连、阻断、代理、隧道出站，支持由节点生成。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 被路由引用的出站删除需处理引用；顺序调整稳定；受保护默认出站不可误删。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-outbounds)；未实机验证 |
| `xray.warp`<br>**WARP 出站** | 按服务器独立管理WARP注册、双栈出站、WARP+凭据、刷新和卸载。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 两节点身份不共用；刷新失败保留可用配置；卸载不破坏仍引用该出站的规则。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-outbounds)；未实机验证 |
| `xray.routing`<br>**路由规则管理** | 按全局/入站/用户维护有序路由，并解释实际匹配结果。 | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 同请求命中首条有效规则；用户子路由不能转出他人私有节点；保存后顺序不变。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-routing)；未实机验证 |
| `xray.routing_presets`<br>**预设路由与命中提示** | 提供可审阅预设、catch-all遮蔽提示和受保护管理API路由。 | S；配合W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 前置catch-all列出失效后续规则；套用预设不移动受保护API路由；可撤回单次变更。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-routing)；未实机验证 |
| `xray.balancers`<br>**出站负载均衡** | 实现四种选路算法及对应观测器配置和出站健康数据。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [17](17-Agent运维测速与联邦设计.md) | 固定样本验证轮询序列；失败候选被策略排除；无健康候选明确失败而非随机直连。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/xray-routing)；未实机验证 |

### 节点管理（10项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `node.import`<br>**外部节点导入** | 统一URI、YAML、Base64、订阅URL、SOCKS5与Surge解析预览后导入。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 混合输入逐行给成功/错误；导入前不保存；重复预览确认不会重复创建节点。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.crud`<br>**节点列表与日常操作** | 节点启停、重命名、排序、标签、配置编辑、URI导出及批量去重。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 禁用节点不再下发；重命名保留身份和历史；去重预览说明保留项及引用迁移。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.metadata`<br>**节点显示与地址工具** | 管理地区标识、显示地址转换/恢复、证书验证策略和批量协议属性。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | IP替换可还原原域名；关闭证书校验有明确标识；批改只影响所选兼容协议节点。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.temp_sub`<br>**临时订阅** | 节点临时订阅绑定次数、有效期、所有者和可分享范围。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 次数1的并发请求最多一次成功；过期即拒绝；临时链接不展开未授权节点。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.uri_view`<br>**用户 URI 总览** | 按用户/服务器展示个人凭据URI并提供复制全部。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 查看A的URI不含B凭据；到期实例不出现可用链接；批量复制数量与筛选一致。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.self_import`<br>**成员自有节点管理** | 成员管理自有外部节点，管理员依授权检查和清空自导资源。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | A的私有节点不会进入B订阅；清空不会删除套餐节点；管理查看留下审计。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/users)；未实机验证 |
| `node.latency`<br>**TCP 延迟与域名探测** | 提供节点TCP延迟和限量并发域名探测，标明执行位置和失败类型。 | A；配合S+W<br>P4 → P6；[17](17-Agent运维测速与联邦设计.md) | DNS失败与超时分开；批量请求不超过配置并发；浏览器不伪造直接TCP测试结果。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `node.speedtest`<br>**真实测速工作台** | 用固定mihomo版本提供代理吞吐、真连接延迟、出口IP、批量任务及历史。 | A；配合S+W<br>P4 → P6；[17](17-Agent运维测速与联邦设计.md) | 结果按实际字节/耗时计算；代理断开不回退直连伪造成功；取消释放进程/端口。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-speedtest)；未实机验证 |
| `node.home_endpoint`<br>**家用测速端** | 同Agent仓发布Windows/macOS/Linux家用测速端，反向配对和任务管理。 | A；配合S+W<br>P4 → P6；[17](17-Agent运维测速与联邦设计.md) | 三平台配对运行实测；离线转主控会标记实际来源；家用端不能执行服务器管理命令。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-speedtest)；未实机验证 |
| `node.external_probe`<br>**外部节点探测与重同步** | 对齐定时mihomo外部节点探测、主控/家用来源选择及失效订阅重同步。 | S；配合W<br>P4 → P6；[17](17-Agent运维测速与联邦设计.md) | 可选择执行来源；掉线触发与恢复行为按固定版本样本核对；告警阈值和重试次数不自行固定。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |

### 订阅源与转换（14项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `subscription.sources`<br>**外部订阅源管理** | 管理外部订阅源、抓取身份、所属用户、手动同步及删除影响。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | URL凭据不在日志显示；删除源可选择保留节点；普通成员不能读取他人源地址。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/subscribe-files)；未实机验证 |
| `subscription.sync`<br>**定时、按需与缓存刷新** | 按周期、按需和缓存策略同步，持久化任务去重及失败退避。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 相同源的定时与手动请求合并；抓取失败保留上次有效版本并显示陈旧时间。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/subscribe-files)；未实机验证 |
| `subscription.matching`<br>**同步匹配与保留策略** | 支持多种节点匹配键、仅更新/新增策略、保留名称和正则排除。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 地址端口相同但协议不同按所选键区分；保留名称不阻止密码更新；无效正则拒绝。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `subscription.external_traffic`<br>**外部流量聚合** | 解析源响应头额度和到期，按方向/标签汇总并生成名称提示。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 缺失或畸形响应头标记未知；同源多节点不重复计入源额度；剩余天数跨日一致。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `subscription.fetch_proxy`<br>**家用端中转抓取源** | 通过已配对家用端抓取指定订阅源，限制重定向与敏感凭据暴露。 | A；配合S+W<br>P4 → P6；[17](17-Agent运维测速与联邦设计.md) | 结果标明来源；恶意重定向不转发认证头到新域；端点断线按配置回退并提示。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；未实机验证 |
| `subscription.generate`<br>**订阅生成工作台** | 节点选择、模板、排序与说明共同生成可预览订阅文件。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 预览与保存同一输入生成相同配置；无权节点被拒绝；保存失败不留下半成品短码。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/generator)；未实机验证 |
| `subscription.formats`<br>**多客户端输出** | 维护列明客户端格式的独立输出器和版本化黄金样本。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 每类输出经对应客户端/公开校验器加载；未知协议有明确过滤记录；不能只验JSON语法。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/generator)；未实机验证 |
| `subscription.compatibility`<br>**自动客户端与兼容处理** | 自动UA识别和显式格式选择，执行协议过滤/严格报错与转换规则。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 显式格式优先UA；严格模式遇不支持节点整体报错；Egern输出块状YAML可加载。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `subscription.files`<br>**订阅文件维护** | 维护个人订阅文件、节点范围、模板、短码和流量展示覆写。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | A无法修改B文件；更改展示额度不改变真实账本；删除文件仅使对应短码失效。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/subscribe-files)；未实机验证 |
| `subscription.links`<br>**分发链接与独立域名** | 分离面板域名和订阅域名，在网页/TG/MiniApp统一生成授权链接。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 切换域名后新分发链接一致；订阅域不暴露管理API；旧域迁移策略可配置并记录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/generator)；未实机验证 |
| `subscription.info`<br>**订阅元信息展示** | 按客户端支持生成流量响应头、到期信息节点和可配置前缀。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 已用/总量/到期与实例账本一致；不支持信息节点客户端不产生无效代理条目。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `subscription.providers`<br>**代理集合** | 生成可混合本地节点的动态Proxy Provider及组引用。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 关闭Provider后展开或移除按规则执行；远程失败保留缓存；引用不会指向不存在的组。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `subscription.change_push`<br>**订阅变化即时通知** | 对齐subscription_changed事件和入口故障降级推送，客户端收到后重新获取订阅。<br>待核对/边界：私有客户端事件格式和断线补发机制须固定版本核对；能力仍在完整交付范围。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 真实客户端能感知变更并重拉；事件格式、合并、重试与断线恢复私有细节按固定版本核对。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；未实机验证 |
| `subscription.access`<br>**订阅访问策略** | 订阅校验账户/实例权限、IP白名单、限频与浏览器访问策略。 | S；配合W<br>P2 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 过期/吊销和换IP请求被相应拒绝；多代理头不能伪造可信来源；超限返回可解释重试时间。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |

### 模板与规则（13项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `template.versions`<br>**模板版本兼容** | 支持v1/v2/v3导入和确定性的内部规范化，保留原件及迁移记录。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 三个版本合法样本输出等效节点/组；不支持字段显式报告；迁移失败仍能用旧模板。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `template.library`<br>**模板库 CRUD 与共享** | 按客户端分类管理系统/个人模板和可见性、缺省与绑定关系。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 个人默认覆盖系统默认；私有模板不能被他人枚举；删除模板时列出依赖订阅。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.import`<br>**六类模板来源** | 上传、粘贴、空白、URL、V2转换及订阅提取进入同一预览流程。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 六入口各有样本；URL超时不保存空模板；提取保留有效组引用并指出不可移植字段。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.editor`<br>**可视化与代码编辑** | 可视化组编辑和YAML双向转换，保留用户字段并实时预览。 | W；配合S<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 组排序/引用/图标往返不变；引用环定位到组；代码语法错误不覆盖上次有效版本。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.selectors`<br>**动态匹配节点** | 解析动态包含/排除、类型筛选与变量引用，生成时移除模板专用字段。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | include后exclude按明确次序运算；空/递归变量拒绝；最终配置无模板扩展关键字。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.regions`<br>**区域组与空组处理** | 按名称地域规则生成分组及兜底，稳定处理空组和被引用空组。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 无匹配区域组移除后其引用同步修正；未知地区进入兜底；重复生成顺序稳定。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.policy_groups`<br>**代理组选路** | 支持选择、测速、回退、均衡、链式组与客户端专有参数。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 每种组选路由对应客户端真实验证；不兼容链式字段不静默丢弃；循环链拒绝。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `template.regeneration`<br>**订阅自动再生成** | 依赖变更触发订阅再生成，版本去重并保持最后有效产物。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 模板和节点同时改只发布完整新版本；编译失败保留旧文件并列出失败订阅。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/templates)；未实机验证 |
| `rules.overrides`<br>**DNS/规则/规则集覆写** | DNS/规则/规则集按全局或模板范围覆写，定义前置/追加/替换次序。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 相同输入的多条覆写顺序稳定；替换和追加不混用；无权用户不能写全局规则。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/custom-rules)；未实机验证 |
| `rules.scripts`<br>**JavaScript 覆写脚本** | 按官方开关在订阅生成链运行JavaScript覆写，修改节点、代理组和配置。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 公开脚本样本得到相同输出；错误、超时及脚本权限按固定版本核对，不把自建沙箱架构作为对齐事实。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `rules.group_catalog`<br>**远程代理组配置** | 同步远程组配置，规范化分级模板和Provider字段并缓存版本。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 远程404/坏格式保留现有配置；级别切换不残留旧Provider引用；路径字段不能写任意文件。 | partly_verified_public_files<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/proxy_groups/README.md)；未实机验证 |
| `rules.hosted`<br>**规则集托管** | 对齐规则集托管和独立规则集管理页，上传格式与维护行为按固定版本核对。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 有效样本可托管并由对应客户端读取；错误样本报错可比对；版本/替换/恢复模型未公开则不自定。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；未实机验证 |
| `rules.bundled`<br>**内置模板文件** | 分发默认Clash/Surge模板，仅初始化缺失文件并记录自定义状态。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 升级后用户改过模板哈希不变；缺失模板可重建；内置来源许可证随产物提供。 | partly_verified_public_files<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/rule_templates/embed.go)；未实机验证 |

### 中转与转发（10项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `relay.node_outbound`<br>**整节点链式出站** | 父入站全量经指定落地、新落地或均衡器转发并保留拓扑依赖。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 流量出口符合选定落地；删除被引用落地被阻止；故障不会未经策略改走直连。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/routed-outbound)；未实机验证 |
| `relay.package_children`<br>**套餐路由子节点** | 同父入站建立套餐路由子节点，每绑定独立凭据和用户路由。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 两用户同端口走不同出口并分别计量；删除子节点不误删父入站或其他用户路由。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/routed-outbound)；未实机验证 |
| `relay.private_children`<br>**成员私有路由子节点** | 成员自建仅本人可见的路由子节点，应用数量、每日次数和权益限制。 | S；配合W+A<br>P2 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 超配额并发创建不成功；到期停用专属路由；目标节点可见性变化触发重新授权。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/routed-outbound)；未实机验证 |
| `relay.client_group`<br>**客户端中转组** | 多中转生成客户端url-test与dialer-proxy链并显示兼容要求。 | S；配合W+A<br>P5 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 对应客户端能经最佳中转到落地；空中转组有明确降级；不支持链式的格式拒绝或过滤。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `relay.tunnels`<br>**Xray Tunnel 与端口转发** | 管理TCP/UDP Tunnel与端口转发，编译目标、入口替换及健康探测。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | TCP和UDP分别走到目标；换目标失败旧映射可用；源/目标回环导致的循环被拒绝。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `relay.reused_port`<br>**复用入站的目标转发** | 已有Tunnel按目标地址规则复用监听，记录原落地和关联转发。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 同端口不同目标按规则可达；重叠匹配提示冲突；删除一项不撤其他共享监听。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `relay.native_chains`<br>**Agent 转发组与链** | 入口/中转/出口组链支持排序、故障降级、DNS对账与拓扑修订。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 两跳链故障时只用批准备用路径；环路拒绝；DNS更新后所有涉及节点回执一致。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/nodes)；未实机验证 |
| `relay.member_forward`<br>**成员“我的转发”** | 成员在获授权入口链及配额内创建TCP/UDP目标转发、启停和换端口。 | S；配合W+A<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 成员不能借入口转发到禁用目的地址；换端口不占他人端口；失效套餐撤销新接入。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |
| `relay.ledger`<br>**转发计量与连接** | 按转发载体、链、端口、套餐和日期记录流量、连接及来源IP。 | S；配合W+A<br>P2 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 双跳同一次业务不重复计费；切换端口仍能追溯旧账；未归属字节单列原因。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.4)；未实机验证 |
| `relay.wireguard`<br>**WireGuard 中转隧道** | 管理WireGuard密钥、地址族、保活与探活，纳入链式路由。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | IPv4和双栈样本握手/断线恢复；重复地址拒绝；轮换密钥失败能回退旧隧道。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；未实机验证 |

### 共享与联邦（4项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `federation.share`<br>**跨主控分享与接入** | 消费方经拥有方联邦入口操作Agent；拥有方始终是唯一直接控制者，但转发链不读取消费方操作正文。 | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 真实两主控完成分享和自有入站操作；消费方不能直连Agent；拥有方转发日志/处理链不出现消费方正文或明文重编译。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/share-server)；未实机验证 |
| `federation.acl`<br>**联邦权限边界** | 消费方默认只管自身入站/节点和查看状态；禁止服务启停、安装、改服务器、再分享、直连Agent；仅完整Xray配置可显式授权。 | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 上述禁止操作逐项拒绝；完整配置开关关闭时无法读写全配置，打开后按官方范围生效；他方入站不能被前缀伪造访问。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/share-server)；未实机验证 |
| `federation.tokens`<br>**分享令牌管理** | 按官方一机多令牌、首次明文展示、SHA256存储、列表和即时吊销行为实现。 | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 令牌列表无法再取明文；吊销后消费方不能管理；已建入站按文档保留，不能以自定义清理状态机替代。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/share-server)；未实机验证 |
| `federation.security`<br>**联邦加密与白名单** | 按HTTPS、ECDH端到端加密、securechan及转发路径白名单对齐，拥有方不能读取消费方操作正文。<br>待核对/边界：加密密钥终点、私有封装、正文检查位置及旧版自动降级/新版强制加密描述冲突待核对。 | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 正常转发能到Agent且owner拿不到正文；越界路径/错误Token/篡改拒绝；密钥终点、私有封装和旧版降级冲突须固定版本核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/share-server)；未实机验证 |

### 证书与网站（7项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `cert.providers`<br>**DNS 供应商管理** | 管理四类公开DNS服务商适配器、加密凭据和最小权限验证。 | S；配合W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 各供应商在授权测试域完成DNS增删；保存后只返掩码；测试失败不覆盖可用凭据。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/certificates)；未实机验证 |
| `cert.issue`<br>**证书申请与续期** | ACME申请、DNS-01、根/通配符SAN、定时续期和失败重试记录。 | S；配合W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 测试CA签发含预期SAN证书；DNS清理失败可重试；续期失败仍使用未过期旧证书。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/certificates)；未实机验证 |
| `cert.manual`<br>**证书导入与导出** | 导入证书链/私钥，校验匹配后管理、导出和删除引用检查。 | S；配合W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 不匹配密钥拒绝；非授权角色不能导出私钥；删除在用证书前列明所有部署引用。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/certificates)；未实机验证 |
| `cert.deploy`<br>**证书部署与更新** | 将证书版本发布至面板/Xray/Nginx，续期后更新全部有效引用。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 每个目标指纹与期望一致才完成；一处失败单独重试；回滚配置前补齐引用证书。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/certificates)；未实机验证 |
| `cert.webhook`<br>**Certimate Webhook** | 提供Certimate兼容上传入口，支持PEM/旧Base64并触发同域版本部署。 | S；配合W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 有效令牌及匹配域可更新；超长/畸形请求拒绝；重复Webhook不重复部署同指纹。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/certificates)；未实机验证 |
| `site.nginx`<br>**Nginx 站点管理** | 扫描与认领站点，配置静态/反代、监听和证书，验证后重载。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 错误配置不重载；删除站点保留内容目录；80/443冲突明确定位到拥有者。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/website-management)；未实机验证 |
| `site.runtime`<br>**多种服务管理环境** | 以适配器覆盖systemd/OpenRC/SysV/直接进程/Docker管理模式。 | A；配合S+W<br>P3 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 每一支持环境独立运行启停重载用例；环境识别失败不猜测执行另一管理器；复用需明确认领。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/website-management)；未实机验证 |

### 监控与流量（10项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `monitor.dashboard`<br>**管理员流量总览** | 分别汇总自有/外部主机容量来源、Xray及用户账本的今日/周/月与30日趋势，明确当前口径。 | S；配合W+A<br>P5 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 固定时区样本跨午夜正确分桶；排除服务器后图表和总计同步；同机双源不相加，指标缺口不显示为0。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/traffic-accounting)；未实机验证 |
| `monitor.member`<br>**成员用量总览** | 成员查看各有效套餐及外部订阅合计、趋势和更新时间；自有探针状态与套餐计费分开展示。 | S；配合W<br>P5 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 同用户多实例卡片之和与同口径汇总相等；过期实例不加可用额度；公开主机指标不会变成成员已用流量。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/traffic-accounting)；未实机验证 |
| `monitor.live`<br>**实时系统与连接状态** | ASWired-Agent原生采集CPU、内存、磁盘、负载、uptime、OS/架构及网卡速率；运行时提供连接/IP；可选Komari数据独立标源。<br>覆盖：external_probe_komari_only | A；配合S+W<br>P1 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 无Komari环境逐项与宿主读数核对；网络断线、陈旧与缺失分别标识；同机双源不混算，连接数不叫设备数；字段权限过滤在服务端执行。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/probe-api)；未实机验证 |
| `monitor.probe`<br>**内置公开探针** | 对齐自有内置探针启停、字段选择、ASWired品牌/深色CSS、3D地球、隐蔽登录和屏蔽原登录页，用户登录采用JWT。<br>覆盖：dark_only、aswired_brand、user_auth_jwt | S；配合W+A<br>P5 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 无Komari可显示自有指标与历史；允许字段、地球及入口开关与参考一致；密码/Passkey登录和退出、过期重登按固定版本验证。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `monitor.external_probe`<br>**外置探针** | 对齐独立域名/Cloudflare Worker自有探针、只读API/WS代理、独立访问密钥及登录回接，可与内置探针并存。<br>覆盖：dark_only、user_auth_jwt<br>待核对/边界：独立展示端的密码/Passkey回接、JWT存放、退出与刷新细节未公开；不先规定强制BFF。 | S；配合W+A<br>P5 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 独立站显示所选指标，密钥失效后拒绝读取；密码/Passkey登录态能回接并使用JWT；不预先强制BFF、PKCE或单次码机制，按公开代码及固定版本核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/install-external-probe)；未实机验证 |
| `monitor.probe_api`<br>**探针API与历史** | 定义自有状态HTTP、默认5秒WS增量推送及1h/6h/24h系统和延迟历史；可选Token保护与字段白名单；Komari只作外部适配。<br>覆盖：external_probe_komari_only | S；配合W+A<br>P5 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 自有样本跨三个历史窗正确分桶，断流显示缺口；重连能按游标补齐或取得快照；已隐藏/撤销字段立即停止推送；无身份公开接口不泄露连接IP或管理凭据。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/probe-api)；未实机验证 |
| `monitor.network_quality`<br>**网络质量与回程** | 自有Agent执行受控Ping采样、延迟/丢包历史及回程诊断，附地区/运营商/线路标识；可叠加明确标源的Komari外部结果。<br>覆盖：external_probe_komari_only | S；配合W+A<br>P4 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 允许目标有延迟、丢包及时间桶；丢包与未采样不混淆；回程有来源/目标/时间；权限变更后停止禁用任务，双源不互相覆盖。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/probe-api)；未实机验证 |
| `monitor.accounting`<br>**多维流量对账** | 分开记录自有网卡容量、可选Komari主机来源、物理入站、路由子节点和加权用户用量及调整。<br>覆盖：external_probe_komari_only | S；配合W+A<br>P2 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 同一测试传输可追溯各口径；双源主机数据仅按选定来源计容量；倍率只影响账单；采样缺口和来源切换基线可见。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/traffic-accounting)；未实机验证 |
| `monitor.ledger`<br>**流量明细台账** | 对齐节点/用户明细、连接IP历史、峰值Top5、方向拆分、未归属原因及管理员自用分类。 | S；配合W+A<br>P2 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 同一日期筛选的列表/汇总一致；峰值与上下行有样本可复算；不规定上游未公开的分库或日志提交结构。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；未实机验证 |
| `monitor.ip_database`<br>**IP 地区库** | 管理IPv4/IPv6地区库版本及回退，为连接IP、线路标识和自有探针地图提供注明精度的查询。 | S；配合W<br>P3 → P6；[06](06-拼车套餐流量与账务规则.md) [12](12-Komari探针接入设计.md) [16](16-增强运行时与PRO执行设计.md) [18](18-自有探针与登录回接设计.md) | 无库显示未知地区且不伪造地图位置；损坏包不替换旧库；删除后不冒充新查询展示缓存；公开地图服从坐标字段权限。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.6)；未实机验证 |

### 限速与接入控制（5项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `limit.speed`<br>**用户与套餐限速** | 按官方内嵌模式推送用户/套餐/节点限速，支持热更新和VisionLimiterHook+splice路径。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 同一限速输入对比普通与Vision真实速率；0不限、空继承一致；用户/节点汇总口径及推送时机按固定版本核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-ratelimit)；未实机验证 |
| `limit.connection`<br>**并发连接数** | 按用户+物理节点聚合并发连接上限，区分连接与设备。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 上限N时并发竞争仅N条准入；释放后补位；降低上限默认保留已有连接并拒绝新连接。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-ratelimit)；未实机验证 |
| `limit.online_ips`<br>**同时在线IP数量** | 按预发布公开功能独立设置套餐/用户同时在线IP上限及覆写并下发。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 同IP多连接和跨IP连接达到上限时行为可复现；IPv6规范化、空闲释放和宽限期按固定版本核对。 | confirmed_release_notes<br>[证据](https://github.com/iluobei/miaomiaowuX/releases/tag/v0.5.5-beta.5)；未实机验证 |
| `limit.auto_rules`<br>**行为自动限速** | 按官方持续超速、窗口突发、全局默认/套餐覆写、限制速度和解除时间实现。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 低于/达到阈值的触发与通知结果一致；重连、缺样和重复触发期限按固定版本核对，不指定自创处罚状态机。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray)；未实机验证 |
| `limit.quota_throttle`<br>**超额度限速与恢复** | 对齐套餐超额降速与重置/扩额恢复，和行为自动限速分别配置。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 超额可降至配置速度，重置/扩额恢复；额度与行为规则同时命中时按固定版本核对优先级，不自行取最严值。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/packages)；未实机验证 |

### 通知与TG（7项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `notify.events`<br>**Telegram事件通知** | 以事件订阅驱动TG通知，按类型开关、接收者权限和去重发送。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 相同故障重传只通知一次；关闭某事件不关闭其他；敏感登录/IP数据不发给无权成员。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `notify.daily`<br>**日报与文案** | 对齐管理员定时日报、成员通知开关、到期7/3/1日提醒及续费确认按钮。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 时间、文本和接收者符合设置；续费按钮的通知/业务效果按固定版本核对，不预设付款审批流程。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `notify.announcements`<br>**公告中心** | 公告模板、套餐定向发送、Bot/MiniApp渠道及发布日志。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 只选套餐A则B成员收不到；预览列接收范围；部分发送失败仅重试失败接收者。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `tg.builtin`<br>**内置TG Bot生命周期** | 主控内置Bot生命周期、加密Token、管理员ID和热重连。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 掩码保存不覆盖真Token；改Token后旧连接关闭；配置错误不影响面板HTTP服务。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；未实机验证 |
| `tg.commands`<br>**成员TG命令** | 实现成员绑定、资料、订阅、流量、节点、通知与确认解绑命令。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | TG用户不能指定他人账号读订阅；解绑需一次确认；重复消息不重复注册。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；未实机验证 |
| `tg.admin`<br>**管理员TG命令** | 管理员名单约束邀请/兑换码管理及用户查询并限频。 | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 非管理员直接发命令被拒绝；多步交互会话不串人；重复确认只生成一组兑换码。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；未实机验证 |
| `tg.miniapp`<br>**Telegram Mini App** | 对齐Telegram initData登录与管理员/成员视图，ASWired用户认证采用JWT。<br>覆盖：user_auth_jwt | W；配合S<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) [18](18-自有探针与登录回接设计.md) | 过期或篡改initData不能登录；JWT过期重登；成员不能开关他人Xray，续费动作与网站固定版本行为一致。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/tool-mmwx-tgbot)；未实机验证 |

### 安全与外观（7项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `security.limits`<br>**登录与请求防护** | 登录/订阅/请求限流、可信代理来源解析、封禁和安全日志热更新。 | S；配合W<br>P1 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 伪造X-Forwarded-For不能绕封禁；阈值更新生效；解除封禁保留历史记录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `security.turnstile`<br>**Turnstile人机验证** | 完整配置启用Turnstile并有自测和服务端验证。 | S；配合W<br>P1 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 仅填SiteKey不能误报保护开启；无效/重放token拒绝；Secret不下发浏览器。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `security.silent`<br>**静默隐藏与本地监听** | 按官方静默404、合法订阅唤醒、本机监听、隐蔽探针入口及屏蔽原登录页设计，ASWired使用JWT登录。<br>覆盖：user_auth_jwt | S；配合W<br>P5 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) [18](18-自有探针与登录回接设计.md) | 未获准请求保持404；有效订阅触发规定唤醒；隐藏入口仍需密码/Passkey验证，过期Token重登；本地恢复路径实测可用。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `security.encryption`<br>**主控/Agent及客户端加密** | 用户JWT与Agent的token/master_public_key/securechan、客户端身份加密及联邦加密分别按公开说明核对，保留全部技术鉴权。<br>覆盖：user_auth_jwt<br>待核对/边界：技术安全校验完整保留；具体JWT/securechan实现参数待固定版本核对。 | S；配合W+A<br>P1 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) [18](18-自有探针与登录回接设计.md) | 错误JWT/Agent Token/主控公钥及加密消息均拒绝；去掉PRO商业检查不绕过任何技术身份校验；JWT和securechan未公开细节列待核对。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/remote-servers)；未实机验证 |
| `security.local_reset`<br>**管理员本地恢复** | 对齐本地SSH恢复管理员密码和TOTP的公开操作能力；引用脚本缺失部分待固定版本核对。 | S；配合W<br>P1 → P6；[01](01-产品与完整功能设计.md) [05](05-API与Agent协议.md) [07](07-前端页面与交互规范.md) | 授权本地恢复后可登录且旧密码无效；记录实际可用命令及TOTP处理，不将我们自造CLI当成上游兼容脚本。 | documented_but_referenced_script_unavailable<br>[证据](https://miaomiaowux.com/docs/faq-common-ops)；未实机验证 |
| `appearance.themes`<br>**主题、品牌与菜单** | 保留ASWired品牌、菜单、壁纸、色调、透明度和自定义CSS；管理、成员及内置/独立自有探针固定深色不可切换。<br>覆盖：dark_only、aswired_brand | W；配合S<br>P5 → P6；[07](07-前端页面与交互规范.md) [15](15-完整功能与PRO对齐矩阵.md) [18](18-自有探针与登录回接设计.md) | 系统浅色偏好、旧缓存和个人配置均不能切换白天；独立探针和登录页的CSS可预览/撤销；恢复默认后仍可进入登录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `appearance.mobile`<br>**移动端与多语言** | 管理、成员、MiniApp及自有探针实现响应式和多语言，独立展示及登录回接沿用固定深色规范。<br>覆盖：dark_only | W；配合S<br>P5 → P6；[07](07-前端页面与交互规范.md) [15](15-完整功能与PRO对齐矩阵.md) [18](18-自有探针与登录回接设计.md) | 手机宽度下地图、历史图表和登录操作不截断；语言切换不丢表单；移动密码/Passkey回接返回正确页面；无浅色或跟随系统选项。 | confirmed_documented<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；未实机验证 |

### 数据维护与集成（9项）

| 原ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 原事实状态 |
|---|---|---|---|---|
| `data.manual_backup`<br>**完整备份与恢复** | 对齐完整ZIP导出、上传校验恢复、初始化恢复及旧zip.enc通过原密码恢复。<br>待核对/边界：ASWired备份必须可恢复；历史zip.enc兼容依赖合法样本及原恢复凭据，不承诺解密未知格式。<br>待核对/边界：旧zip.enc需要合法样本及原密码；不伪称解密未知格式。 | S；配合W<br>P6 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 空环境恢复账户/订阅/证书引用；坏包与错误原密码拒绝；加密格式和版本迁移按合法样本核对，不强制全量备份另加加密。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/backup-restore)；未实机验证 |
| `data.remote_backup`<br>**定时远端备份** | 定时备份WebDAV/S3/GoogleDrive，支持连接测试、保留数和任务记录。 | S；配合W<br>P6 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 失败上传不删最后可用备份；保留数仅删自身目录；三后端各验证恢复而不只验证上传。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/backup-auto-sync)；未实机验证 |
| `data.database`<br>**SQLite/PostgreSQL** | 对齐主控SQLite/PostgreSQL选择、双向迁移、PG备份恢复及SQLite完整性检查。<br>待核对/边界：主控数据库能力已公开；Agent内部持久化方式未公开。 | S；配合W<br>P6 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 迁移前后关键用户/套餐/订阅数据一致；故障后的应急恢复按固定样本核对；不自行规定Agent本地账本数据库。 | partly_verified_public_files<br>[证据](https://miaomiaowux.com/docs/backup-restore)；未实机验证 |
| `data.migration`<br>**从妙妙屋迁移** | 合法导出样本进入分步迁移，映射用户/节点/短码/模板/证书并认领原服务。<br>待核对/边界：以用户合法导出备份及版本样本建立转换器；未知闭源结构标记待映射，不破坏原系统。 | S；配合W<br>P6 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 导入预览显示不可转换项；旧服务可继续；验收失败可回退；闭源未知格式不伪称兼容。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/upgrade-from-mmw)；未实机验证 |
| `data.logs`<br>**日志中心** | 对齐系统、Agent交互、定时任务和安全日志的级别/行数筛选、清空与自动清理。 | S；配合W<br>P3 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 四类日志可按官方条件查看/清理；Agent日志开关生效；秘密字段不泄露，不指定自创ACK事件日志结构。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/faq-common-ops)；未实机验证 |
| `data.scheduler`<br>**任务调度与运行记录** | 对齐流量/速度上报、同步、清理、备份周期、执行记录及孤儿/凭据修复任务。 | S；配合W<br>P3 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 各周期任务可调整并产生对应结果记录；重复/失败及重启恢复按固定版本核对，不预设多worker调度架构。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |
| `data.updates`<br>**安装、升级与渠道** | 对齐原生/Docker/单二进制、初始化、稳定/预发布渠道、网页检查更新及公开Guard参数。<br>待核对/边界：公开安装/Guard行为可核对，私有升级回滚机制未知。 | S；配合W<br>P6 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 固定版本的安装更新流程和版本展示可复现；升级失败与恢复行为有记录；不把自建updater或未公开自动回滚机制列为对齐事实。 | partly_verified_public_files<br>[证据](https://github.com/iluobei/miaomiaowuX/blob/f16a72407366c888e4c9685afc784e7f666e268f/README.md)；未实机验证 |
| `data.mcp`<br>**MCP自动化接口** | 提供Streamable HTTP MCP工具及个人权限继承，危险写操作显式确认。<br>待核对/边界：以公开工具目录和授权样本建立完整操作映射；109为上游版本数量记录，不以凑数代替逐动作验收。 | S；配合W<br>P5 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 完整工具目录逐项映射业务动作；低权Token不可越权；无确认参数危险写操作不执行。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/mcp)；未实机验证 |
| `data.license`<br>**许可证与PRO能力** | 保留本机版本、实际技术能力与资源配置；全部PRO功能不设付费墙、商业许可证或额度授权门槛。<br>覆盖：no_pro_license_gate | S；配合W<br>P5 → P6；[08](08-安全权限与可靠性.md) [09](09-实施里程碑与验收.md) [14](14-三仓拆分与协作设计.md) | 无商业许可状态也能使用内嵌、限速、测速、分享和CSS；错误技术凭据仍拒绝；许可证到期/商业配额不限制功能。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/system-settings)；未实机验证 |

## 5. 22个细化验收项

保留原有细化ID供追溯；它们分解原146项能力，不增加上游独立功能计数。此前以独立runtime、copy替代Vision或自创用户表机制定义的条目已改回官方公开目标。未公开接口和内部算法仍须核对。

| 细化ID/名称 | 对齐目标及未公开边界 | 仓库/阶段/设计 | 具体验收 | 证据关系 |
|---|---|---|---|---|
| `pro.runtime.embedded`<br>**增强运行时库集成** | xray-core直接编入Agent并在同一进程运行，同进程调用、共同退出和升级；外置模式另用独立Xray。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 检查进程/调用路径及Agent停止时核心退出；Docker镜像host+embedded真实启动；不以独立runtime进程替代embedded。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.runtime.dispatcher`<br>**身份感知调度与计量拦截** | 按官方内嵌路径注入自定义Dispatcher，集成RateWriter、统计、连接/IP追踪。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 普通流量实际经过Dispatcher及RateWriter，用户统计仍正确；具体接口与锁/数据结构未公开，不以自建内部模型宣称相同。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.runtime.vision`<br>**Vision快路径限速覆盖** | 按官方VisionLimiterHook在splice之前挂接限速；无限速规则时保留原始splice快路径。<br>覆盖：no_pro_license_gate<br>待核对/边界：公开确认Hook和splice目标；Hook完整接口及核心补丁需取得合法实现并进行真实路径验证。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 真实Vision连接验证Hook被调用且splice路径限速生效；取消限速后恢复快路径；仅改走copy不能通过此项。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.runtime.hot_users`<br>**用户与套餐变更执行** | 按公开套餐/用户启停、绑定、到期及限速推送行为对齐；具体用户热增删与会话处理按固定版本核对。<br>覆盖：no_pro_license_gate<br>待核对/边界：公开确认用户/套餐变更与限速推送；热增删事务、连接关闭和恢复内部机制未公开。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 逐个触发用户与套餐变更，检查入站用户和限速结果；是否重启、存量连接处理及失败恢复记录实测，不强制原子用户表方案。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.runtime.mode_migration`<br>**外置/内嵌配置迁移与回退** | 按官方切换模式、外置confdir合并、标准配置路径、geodata及停止外置服务流程对齐。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P1 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | embedded启动使用预期配置且不重复占端口；切回external后的服务状态可核对；未公开失败回退方式待实测。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.limit.effective_policy`<br>**可解释的继承与聚合策略** | 按公开用户每节点、用户全局、套餐每节点、套餐通用优先级解析空继承与0不限。<br>覆盖：no_pro_license_gate<br>待核对/边界：多套餐相同物理节点的速率/连接/IP冲突取舍待固定版本核对。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 四层空/0/数值组合结果及来源一致；多套餐共用节点的冲突规则按固定版本样本核对，不自创聚合算法。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/node-ratelimit/)；未实机验证 |
| `pro.limit.shared_bucket`<br>**节点与用户共享速率桶** | 按公开每入站用户速率桶及节点限速字段推送，普通流量和Vision均受相应限制。<br>覆盖：no_pro_license_gate<br>待核对/边界：并列桶、聚合方向、公平性和边界误差算法未公开。 | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 多连接实测总速度与固定版本一致；单用户/节点字段更改可见；并列桶、方向与公平算法未公开则列待核对。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.limit.sustained`<br>**持续超速规则** | 按官方sustained规则实现超阈速度持续到规定时长后限速，并在规定期限解除。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 输入低于阈值、连续达阈和中途回落三个样本，核对触发/解除时间；采样、重启及缺口规则按固定版本记录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.limit.burst`<br>**窗口突发规则** | 按官方burst规则对给定窗口内超阈次数判定并施加规定速度和时长。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 次数不足不触发，达到次数触发；窗口边界和处罚期限与固定样本一致，不自行确定重复触发续时算法。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.limit.policy_events`<br>**规则覆写与独立事件通知** | 全局默认、套餐覆写、触发/解除事件与通知开关分别保存。<br>覆盖：no_pro_license_gate | S；配合W+A<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 关闭行为限速通知不关闭到期通知；改套餐策略可见已生效版本；解除记录含原因。 | confirmed_release_notes<br>[证据](https://miaomiaowux.com/docs/changelog/)；未实机验证 |
| `pro.tracking.connections`<br>**连接登记与来源IP生命周期** | 按官方追踪每用户在线IP和连接数、上报状态并在达限时拒绝新连接。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P2 → P6；[13](13-子Agent详细设计.md) [16](16-增强运行时与PRO执行设计.md) [06](06-拼车套餐流量与账务规则.md) | 连接建立/断开后数量和IP更新；达限新连接拒绝且已有连接行为符合参考；UDP空闲回收和重启重建细则待核对。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |
| `pro.speed.queue`<br>**来源独立队列与下载时间窗** | 同一测速来源串行执行节点任务，允许单任务单/多连接；记录实际下载时间窗。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 同源批量不互相争抢带宽；两个不同来源可并行；任务字节与计费分类均有记录。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-speedtest/)；未实机验证 |
| `pro.speed.latency`<br>**真连接采样及出口验证** | 区分TCP可达与代理HTTP延迟，保存原始多次采样、选取算法和出口地址。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 坏代理无法借直连返回成功；冷启动离群样本按公开规则处理；结果可从原始样本复算。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-speedtest/)；未实机验证 |
| `pro.home.identity`<br>**家用端配对与权限隔离** | 一次配对换取限定测速身份，反向WSS只接受测速/允许抓取类型任务。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 重放配对失败；拿家用身份请求安装/停服被拒绝；吊销后重连不可接受新任务。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/node-speedtest/)；未实机验证 |
| `pro.home.lifecycle`<br>**跨平台家用端更新与回退** | 对齐Linux/Windows/macOS家用端发布、安装、自启动及从主控更新流程。<br>覆盖：no_pro_license_gate | A；配合S+W<br>P6 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 三平台安装启动、版本升级及卸载结果有真实记录；签名、回退和断电恢复机制以公开文件或固定版本验证为准。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/install-agent/)；未实机验证 |
| `pro.home.fallback`<br>**离线来源回退可追溯** | 端点离线可按已设策略转主控执行，新任务保存实际来源和回退原因。<br>覆盖：no_pro_license_gate | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 家用断线期间结果明确主控来源；在途任务不会标注为原家用成功；重连不重做已完成任务。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/node-speedtest/)；未实机验证 |
| `pro.federation.namespace`<br>**委托资源命名空间与配额** | 对齐消费方入站前缀、专属资源可见性和只管理自己入站的权限边界。<br>覆盖：no_pro_license_gate | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 两消费方同名资源不互改；前缀保存后固定复用；服务管理/再分享仍拒绝，底层资源隔离结构未公开则待核对。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/share-server/)；未实机验证 |
| `pro.federation.envelope`<br>**联邦加密转发与正文隔离** | 消费方加密操作经owner转发到Agent，保留owner令牌/路径控制且owner不能解密或明文编译正文。<br>覆盖：no_pro_license_gate<br>待核对/边界：保留owner不可读正文的目标；端到端密钥认证和授权校验位置须公开材料/固定版本核对。 | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 端到端操作成功；owner只有允许的路由元信息，正文在转发链不可读；密钥绑定、私有消息与授权核验位置按固定版本核对。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/share-server/)；未实机验证 |
| `pro.federation.revocation`<br>**分享吊销与残留资源治理** | 按官方吊销分享令牌立即阻止消费方管理、保留已经创建的入站。<br>覆盖：no_pro_license_gate | S；配合W+A<br>P4 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 吊销后新请求拒绝且既有入站仍存在；在途请求、继续流量和后续清理细节以固定版本验证结果为准。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/share-server/)；未实机验证 |
| `pro.appearance.css`<br>**自定义CSS与稳定样式钩子** | 管理员为登录、管理、成员及内置/独立自有探针配置CSS变量和稳定组件钩子，受固定深色约束。<br>覆盖：dark_only、aswired_brand、no_pro_license_gate | W；配合S<br>P5 → P6；[07](07-前端页面与交互规范.md) [15](15-完整功能与PRO对齐矩阵.md) [18](18-自有探针与登录回接设计.md) | 允许页面按作用域载入对应CSS版本；独立探针更新与撤回可验证；样式不能重新出现主题切换或破坏恢复入口。 | confirmed_documented<br>[证据](https://miaomiaowux.com/docs/custom-css/)；未实机验证 |
| `pro.appearance.css_recovery`<br>**CSS生效与恢复** | 按官方自定义CSS保存生效及写坏后的恢复方式设计，保持深色并不影响订阅。<br>覆盖：no_pro_license_gate | W；配合S<br>P5 → P6；[07](07-前端页面与交互规范.md) [15](15-完整功能与PRO对齐矩阵.md) | 登录/管理/成员/自有探针页面应用CSS；写坏后按核对的本地恢复步骤清除；不强制自创CSS版本发布机制。 | public_behavior_internal_mechanism_pending<br>[证据](https://miaomiaowux.com/docs/custom-css/)；未实机验证 |
| `pro.distribution.capabilities`<br>**统一发行与真实能力清单** | ASWired统一发行全部基础和PRO功能，不设许可证、付费墙或商业授权额度；展示真实版本及技术能力。<br>覆盖：no_pro_license_gate | S；配合W+A<br>P6 → P6；[13](13-子Agent详细设计.md) [17](17-Agent运维测速与联邦设计.md) | 未配置商业许可也可用全部PRO能力；技术依赖未就绪如实报错；Agent身份及消息鉴权仍然执行。 | aswired_distribution_decision<br>[证据](https://miaomiaowux.com/docs/embedded-xray/)；未实机验证 |

### 细化项归属

| 细化ID | 原功能ID |
|---|---|
| `pro.runtime.embedded` | `server.mode` |
| `pro.runtime.dispatcher` | `server.mode`、`limit.speed` |
| `pro.runtime.vision` | `limit.speed` |
| `pro.runtime.hot_users` | `identity.lifecycle`、`xray.inbounds` |
| `pro.runtime.mode_migration` | `server.mode`、`server.config_history` |
| `pro.limit.effective_policy` | `limit.speed`、`limit.connection`、`limit.online_ips` |
| `pro.limit.shared_bucket` | `limit.speed` |
| `pro.limit.sustained` | `limit.auto_rules` |
| `pro.limit.burst` | `limit.auto_rules` |
| `pro.limit.policy_events` | `limit.auto_rules`、`notify.events` |
| `pro.tracking.connections` | `limit.connection`、`limit.online_ips`、`monitor.ledger` |
| `pro.speed.queue` | `node.speedtest` |
| `pro.speed.latency` | `node.speedtest` |
| `pro.home.identity` | `node.home_endpoint` |
| `pro.home.lifecycle` | `node.home_endpoint`、`server.operations` |
| `pro.home.fallback` | `node.home_endpoint`、`subscription.fetch_proxy` |
| `pro.federation.namespace` | `federation.share`、`federation.acl` |
| `pro.federation.envelope` | `federation.security` |
| `pro.federation.revocation` | `federation.tokens`、`federation.acl` |
| `pro.appearance.css` | `appearance.themes` |
| `pro.appearance.css_recovery` | `appearance.themes` |
| `pro.distribution.capabilities` | `data.license`、`xray.protocols` |

## 6. 完整交付验收资料

1. 逐ID列出实现版本、固定上游对照版本、测试输入、可见结果和差异；未知项不能标完成。
2. 真实协议/传输/客户端矩阵，包括embedded同进程、external独立进程及Docker host+embedded。
3. 真实限速、连接/IP和自动规则结果；Vision必须验证VisionLimiterHook与splice，不用copy-only结果代替。
4. 两主控联邦测试，证明owner转发且不可读正文，技术鉴权及路径权限有效。
5. 无Komari自有探针、独立展示和密码/Passkey回接；JWT使用官方已公开请求头/过期行为，未公开参数核对后登记。
6. 真实安装、升级、配置历史、备份恢复和迁移结果；离线/故障内部机制不足时保留待核对，不能补写成上游已知保证。
7. 无PRO商业许可时全部PRO能力可用；错误Agent/用户/联邦技术凭据仍拒绝。

## 7. 维护规则

- 本文件与[结构化映射](reference/aswired-alignment.json)同步维护，146个原ID及原名称/领域不缺不重，22个细化ID不变。
- 上游原始事实：[原审计](reference/miaomiao-features.json)、[原覆盖概览](02-参考功能覆盖矩阵.md)。
- 具体设计：[Agent](13-子Agent详细设计.md)、[三仓](14-三仓拆分与协作设计.md)、[运行时/PRO](16-增强运行时与PRO执行设计.md)、[运维测速联邦](17-Agent运维测速与联邦设计.md)、[探针与登录](18-自有探针与登录回接设计.md)。
- 后续按公开资料和固定版本样本修订未知项；新增实现取舍必须明确标识，不能再以“对齐”名义默认替换官方设计。
