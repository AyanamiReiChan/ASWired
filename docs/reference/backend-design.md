# RayNo1 后端实施设计

设计日期：2026-09-15。用途：Xray服务器管理、独立用户订阅、多套餐及多人AA拼车。**全文除明确引用的3X-UI行为外，均为建议架构和待实现契约，不代表已经开发或验证。** 建议接口统一使用RayNo1自己的 `/api/v1`、`/agent/v1`；不得与3X-UI现有 `/panel/api` 混用。

3X-UI事实依据见同目录 `3x-ui-audit.md` 和 `3x-ui-api-method-paths.txt`。兼容基线为官方v3.8.0，commit `837addf66e945a80080273b5d2a315dea765d748`。本设计不依赖旧版单机假设：该版本已有多节点、共享client全局统计、订阅和API；需要额外建设的是业务账务、可靠交付、权限和明确的离线配额策略。

## 1. 决策与部署结构

### 1.1 先用模块化单体，独立Agent与订阅网关

建议控制面使用Go、PostgreSQL及HTTP JSON API；异步worker与API可从同一代码库分别运行。前端只访问RayNo1。首先采用PostgreSQL事务Outbox和任务表，不把Redis、消息总线或微服务作为正确性的前提；Redis后续仅用于缓存、限速和短暂会话加速。系统设计时就区分以下模块：

| 模块 | 职责 | 状态权威 |
| --- | --- | --- |
| 身份与权限 | 登录、MFA、组织成员、角色、对象级授权 | 用户及角色关系 |
| 资源管理 | 服务器库存、管理后端、核心能力、入站/出站、证书和配置 | 期望配置及版本 |
| 套餐与权益 | 套餐版本、购买、有效期、节点范围、设备策略、暂停 | 哪个席位现在应获得什么服务 |
| 拼车与订单 | 拼车组、席位、暂留、账期、AA、付款确认、退款流程 | 名额与订单事实 |
| 金额账本 | 收入/费用/退款/应收及分摊记录 | 不可变金额分录 |
| 配额账本 | 授予、消耗观测、租约保留、调整、未知用量 | 流量预算与结算状态 |
| 交付worker | Outbox、版本交付、核对、重试、补偿 | 交付操作和节点回执 |
| 3X-UI适配器 | 版本探测、字段映射、完整写入、读回、错误归一 | 仅外部映射及观测结果 |
| 订阅网关 | 每席位独立token、格式渲染、缓存、撤销、下载记录 | 不自行改变权益 |
| 原生Agent | 受限部署、运行时管理、指标、证书部署、本地配额执行 | 实际运行态与计量来源 |

推荐初期部署：控制面API×2、worker×2、PostgreSQL主备、对象存储、订阅网关×2，每台受管机器一个Agent。两API实例共享数据库；任务用数据库抢占，不能把进程内锁当全局互斥。订阅网关不依赖每次请求实时访问节点，使用已验证的权益快照和配置版本。

```text
浏览器 ──登录/资源权限──> RayNo1 API ──事务──> PostgreSQL
                            │                   ├─Outbox / 操作 / 审计
                            │                   ├─金额账本 / 配额账本
                            │                   └─权益 / 发布 / 席位
                            ├──订阅网关 ──读取生效快照──> 订阅客户端
                            └──Worker
                                ├─3X-UI适配器─> 受管master─> 它的节点
                                └─Agent安全通道─> 原生Xray / sidecar
                                                  └─遥测和发布回执
```

### 1.2 必须坚持的边界

1. 每台节点/运行实例只有一个**配置写入权威**；RayNo1接管与3X-UI master同步不可并行写同一资源。
2. 登录用户、拼车席位、权益、代理凭证、订阅token是不同对象，不能共用一个UUID当所有主键。
3. 支付成功、权益授予、节点生效是三个状态；不能因为API返回200就显示“开通完成”。
4. 钱与流量是两套账本；流量清零、节点重启不产生退款或免费额度。
5. 控制面发“绝对目标状态+版本”，不发可以重复执行的“加30天/加100GB”业务命令。
6. 不向成员或团长浏览器下发3X-UI管理token、Agent私钥、节点证书私钥或其他席位凭据。
7. 将“最终一致配额”“具有明确上界的超额”“严格字节预算”作为不同产品能力，不用轮询冒充严格实时计费。

## 2. 身份、权限与安全边界

### 2.1 角色与资源范围

| 角色 | 允许 | 不能默认允许 |
| --- | --- | --- |
| 平台Owner | 组织、平台配置、角色授予、灾难恢复、密钥策略 | 日常操作不必使用Owner会话 |
| 运维Admin | 节点、模板、发布、证书、故障处理 | 修改金额账本、擅自确认付款 |
| 财务 | 账期、费用、付款核销、退款、AA分摊 | 读取代理密钥或任意部署配置 |
| 团长 | 自己拼车组、邀请、成员席位、费用建议、组健康 | 他人订阅明文、服务器root、直接修改节点API |
| 成员 | 自己席位、用量、账单、独立订阅、设备登记 | 其他成员IP/凭证/付款资料 |
| 只读审计 | 指定范围事件和脱敏账本 | 新增、删除、执行、读取密钥 |
| Agent主体 | 指定node的任务、自身指标和回执 | 查询全租户客户或其他node |

所有资源有 `tenant_id`；数据库外键和查询都限定租户，不能只在前端隐藏按钮。团长权限来自 `group_memberships` 对具体group的关系；服务器共享给某组须经过明确resource binding。高权限账号启用MFA，密钥/订阅重新显示可要求近期重新验证；普通列表默认仅返回fingerprint和尾部标识。

关键动作审计：actor、tenant、action、resource、request_id、operation_id、前后摘要hash、时间、结果、来源IP及授权理由。审计中不保留完整订阅URL、token、代理password或支付回调原始密钥。IP与设备元数据设置有限保留期，成员仅能查看自身信息。

### 2.2 控制面与Agent

- Agent主动建立HTTPS/mTLS连接到控制面，不把SSH或通用执行端口暴露为业务接口。
- 引导token一次性、短时、绑定node_id和预期主机指纹；Agent本地产生私钥，注册只上传CSR/公钥。
- 证书轮换允许短暂重叠；私钥不离开节点。吊销agent identity后旧连接和新任务授权都失效。
- Agent进程尽量非root。一个更小的本地特权helper通过本地套接字执行白名单：更换指定配置、管理指定服务、部署指定证书、应用预定义限流策略。无任意命令字符串、无任意路径写入。
- 面板token和代理凭证以KMS或离线master key封装加密；密钥解封装按用途授权；日志和错误只给credential id。

## 3. 核心数据模型与约束

下表字段省略通用 `id`、`tenant_id`、`created_at`、`updated_at`。业务主键建议UUID/ULID；金额为 `BIGINT amount_minor`+ISO货币代码；流量为非负 `BIGINT` bytes；时间存UTC，日历账期另存IANA时区。JSON API把可能超过JavaScript安全整数范围的bytes/amount以十进制字符串传输，避免静默舍入。

### 3.1 账户与资源

| 表 | 关键字段 | 约束/备注 |
| --- | --- | --- |
| tenants | name、status、default_currency、timezone | 跨币种不自动相加 |
| users | login_id、password_hash或identity_provider_id、mfa_state、status | login_id唯一；不用于代理email |
| tenant_memberships | user_id、role、status | UNIQUE(tenant_id,user_id) |
| servers | name、provider、region、address、cost_minor、currency、renewal_at、owner_tenant | 库存资源；可无Agent |
| node_runtimes | server_id、backend_kind、management_owner、owner_epoch、panel_guid、agent_id、capability_hash、desired_revision、observed_revision、observed_hash、last_seen_at | backend为native或3xui；panel_guid在适用范围唯一；owner_epoch单调增长 |
| backend_connections | backend_kind、base_url、base_path、credential_ref、tls_mode、ca_ref、cert_pin、version_profile | 只允许worker解密；不得在浏览器列表返回token |
| resources | node_id、kind、stable_key、desired_spec、desired_revision、enabled、deleted_at | 入站/出站/路由/证书绑定等；UNIQUE(node_id,kind,stable_key) |
| external_mappings | backend_id、resource_kind、rayno1_id、external_id、external_email、external_tag、panel_guid、last_observed_hash | 外部数字ID仅在panel域有效；不能按显示名称当主键 |
| config_templates | name、protocol、min_capabilities、latest_version_id | 模板名不决定兼容性 |
| template_versions | template_id、version、schema_version、content_hash、content_ref、created_by | 已发布版本不可变；UNIQUE(template_id,version) |
| certificates | domains、issuer、not_before、not_after、public_fingerprint、secret_ref、renewal_policy | 证书资产独立于面板路径；节点绑定另外存 |

`management_owner`建议值：`rayno1-native`、`rayno1-via-3xui-master`、`external-readonly`、`handover`。主从3X-UI关系保存在拓扑表，控制面禁止对同一受管子节点另开直接写连接。

### 3.2 套餐、权益、凭证、订阅

| 表 | 关键字段 | 约束/备注 |
| --- | --- | --- |
| plans | name、status、sale_scope | 产品目录 |
| plan_versions | plan_id、version、price_minor、currency、period_rule、quota_bytes、quota_mode、node_selector、protocol_policy、device_policy、expiry_policy、renew_policy | 售出后不可改；订单保存版本和完整快照 |
| entitlements | subject_type、subject_id、plan_version_id、start_at、end_at、status、desired_revision、policy_snapshot、source_order_line_id | 有效区间为[start,end)；同一订单行不能重复授予 |
| suspension_reasons | entitlement_id、reason_type、source_id、active、created_by、cleared_at | 手动/退款/过期/额度耗尽/安全分别保存；只清理自己原因 |
| credential_bundles | seat_id或personal_subject_id、scope、version、status、secret_ref、fingerprint、valid_from、revoked_at | 一席位一组独立凭证为底线；可以进一步按node/protocol独立 |
| credential_bindings | bundle_id、node_id、inbound_id、backend_client_id、credential_version、state | UNIQUE(bundle_id,node_id,inbound_id,credential_version)；active版本策略显式 |
| subscription_tokens | subject_id、token_hash、token_prefix、status、expires_at、rotation_parent_id、last_fetch_at | 32随机字节建议值；只存hash；一次返回明文；无法从token_hash重建token |
| subscription_snapshots | subject_id、entitlement_revision、credential_revision、format、body_hash、encrypted_body_ref、built_at、valid_until | 来自已核对配置；缓存键包含格式、策略版本和节点集合hash |

**凭证映射：** RayNo1用户邮箱只用于登录/通知。适配3X-UI时，使用不含PII的稳定外部email标识，例如 `r1_<opaque_binding_id>`。同一client关联多入站时3X-UI复用其身份；若要求不同节点不同UUID，应创建不同backend client identity并在RayNo1聚合，不强行塞进同一个外部client。各席位不共用凭证或subId。

**多套餐规则：** 同一个人可以拥有多个独立服务scope；节点访问范围按每个scope的有效权益计算。相同scope内基础流量包和加油包可以增加额度，但保留各grant独立到期日，按最早到期优先消耗。同scope多个接入套餐的设备限制默认取明确定义的计划优先级，不自行相加。不同scope的流量、席位与额度不互借，除非用户购买时明确选择可共享池。跨套餐续费不原地覆盖旧plan_version。

### 3.3 拼车、席位、订单

| 表 | 关键字段 | 约束/备注 |
| --- | --- | --- |
| carpool_groups | name、leader_id、status、capacity、quota_mode、currency、timezone、join_policy、node_scope、billing_policy_version | capacity变更必须有校验；历史账期不跟随新策略改写 |
| group_memberships | group_id、user_id、role、status | UNIQUE(group_id,user_id) |
| group_seat_slots | group_id、slot_no、occupancy_state、hold_id、active_seat_id、version | UNIQUE(group_id,slot_no)；每槽一次只能FREE/HELD/OCCUPIED之一 |
| seat_holds | group_id、slot_id、user_id、expires_at、state、checkout_id | ACTIVE暂留指向唯一slot；过期不是立即删记录 |
| seats | group_id、slot_id、member_id、status、joined_at、service_start_at、service_end_at、independent_subscription_subject_id | 在单slot上只允许一个未终止seat；凭证绑定seat而非slot号 |
| billing_periods | group_id、starts_at、ends_at、timezone、status、allocation_version、currency | UNIQUE(group_id,starts_at,ends_at)；相邻账期不得重叠 |
| orders | purchaser_id、status、currency、total_minor、hold_id、expires_at、pricing_snapshot、idempotency_key | 金额非负；每租户幂等键唯一 |
| order_lines | order_id、item_type、plan_version_id、seat_id、quantity、unit_minor、total_minor、policy_snapshot | quantity>0；sum(line totals)=order total |
| payment_attempts | order_id、provider、provider_payment_id、state、requested_minor、currency | UNIQUE(provider,provider_payment_id)；不存完整卡数据 |
| payment_events | provider、event_id、payload_hash、received_at、verified_at、applied_at、normalized_type | UNIQUE(provider,event_id)；同id不同hash为异常 |
| refunds | order_id、payment_id、amount_minor、reason、status、provider_refund_id、requested_by | 累计成功退款≤实际可退金额；退款失败不能记成功 |
| cost_items | period_id、category、supplier_ref、amount_minor、currency、evidence_ref、state | 服务器/流量/平台/调整等明确类别 |
| allocations | period_id、seat_id、rule_version、weight、amount_minor、remainder_rank、status | 已结算版本不可改；修正用新调整项 |

席位的“待支付”“待交付”“可用”不要塞入同一个含义混乱的字段。暂留、付款、权益、交付状态都可被单独查询，前端用组合摘要展示。

### 3.4 金额与配额账本

| 表 | 关键字段 | 约束/备注 |
| --- | --- | --- |
| ledger_accounts | owner_type、owner_id、purpose、currency | 每个账户单币种 |
| ledger_transactions | source_type、source_id、event_kind、occurred_at、reversal_of | UNIQUE(source_type,source_id,event_kind) |
| ledger_entries | transaction_id、account_id、debit_minor、credit_minor | 每笔交易同币种借贷和相等；分录不可修改/删除 |
| quota_pools | scope_id、mode、period_id、status、grant_total_bytes、observed_used_bytes、reserved_bytes、guard_bytes、version | 所有值≥0；新分配不能超过可用余额 |
| quota_grants | pool_id、source_order_line_id、bytes、valid_from、valid_until、priority、state | 同来源不能重复发放；到期未消费额度冻结，不能回溯挪用 |
| quota_events | pool_id、grant_id、event_type、bytes、source_type、source_id、epoch_id、occurred_at | 追加记录；UNIQUE(source_type,source_id,event_type) |
| quota_leases | pool_id、grant_id、node_id、subject_id、lease_epoch、budget_revision、authorized_total_bytes、settled_total_bytes、expires_at、state | 同epoch授权累计上限单调不减；结算≤授权+明确的guard观测范围 |
| meter_epochs | node_id、runtime_instance_id、subject_binding_id、source、epoch_id、started_at、closed_at、close_reason、confidence | epoch唯一；每条epoch同时跟踪上传/下载；重启/重置/迁移分别结束旧epoch |
| meter_samples | meter_epoch_id、sequence、upload_cumulative_bytes、download_cumulative_bytes、sampled_at、payload_hash、received_at、quality | UNIQUE(epoch_id,sequence)；同epoch各方向累计值分别单调不减 |
| usage_postings | sample_id或结算batch_id、pool_id、grant_id、delta_bytes、quality、adjustment_of | 不重复记账；不能因样本回退自动记负消费 |

`guard_bytes`是为了上界预留的预算，不是已消费也不是可退款金额。失去的计量窗口放入unknown/disputed，用明确更正记录处理，不能静默把未知当0。

### 3.5 发布、任务与可靠消息

| 表 | 关键字段 | 约束/备注 |
| --- | --- | --- |
| operations | operation_id、kind、resource_id、desired_revision、state、request_hash、started_at、finished_at | UNIQUE(resource_id,kind,desired_revision) |
| operation_targets | operation_id、node_id、state、before_hash、desired_hash、observed_hash、attempt、last_error、last_seen_at | 每目标独立状态；保留部分成功 |
| deployments | revision、template_version、manifest_hash、policy_revision、rollout_policy、created_by | 版本不可变；回滚也生成新revision |
| agent_commands | node_id、command_id、owner_epoch、node_sequence、kind、body_hash、expires_at、state | UNIQUE(node_id,node_sequence)；同command_id不同hash拒绝 |
| agent_receipts | command_id、phase、observed_hash、runtime_id、result_code、details、at | 回执追加；同phase允许幂等重传 |
| outbox | event_id、aggregate_id、aggregate_version、type、payload、published_at、attempt | 与业务事务一起提交 |
| inbox | consumer、event_id、payload_hash、processed_at | UNIQUE(consumer,event_id) |
| audit_events | actor、action、resource、before_hash、after_hash、operation_id、result、at | 追加、脱敏、可外部归档 |
| backups | backup_id、scope、manifest_ref、checksum、encrypted、state、created_at、restore_test_at | 必须记录可恢复性验证 |

初期业务行采用明确 `version BIGINT` 乐观锁；热点预算和最后席位采用数据库行锁。所有跨表写在一个事务中按一致顺序加锁，例如 tenant→group→slot→order→pool→grant，减少死锁。外部HTTP调用不持有数据库事务锁。

## 4. 状态机与组合状态

### 4.1 拼车组、席位、账期

```text
拼车组: DRAFT → OPEN → ACTIVE → CLOSING → CLOSED
                   ↘ PAUSED ↗
slot:  FREE → HELD → OCCUPIED → FREE
              └过期/取消→ FREE
hold:  ACTIVE → CONSUMED | EXPIRED | CANCELLED
seat:  RESERVED → ASSIGNED → PROVISIONING → ACTIVE → ENDING → ENDED
                                 ↘ SUSPENDED ↗
账期:  DRAFT → OPEN → CALCULATED → APPROVED → SETTLED → CLOSED
```

暂停原因另表保存；清除“欠费”不能清除“管理员安全停用”。seat ENDED后不能恢复复用同一个代理凭证；slot可重新出租但必须创建新seat及凭证。

### 4.2 订单、付款、权益、交付

```text
订单: CREATED → AWAITING_PAYMENT → PAID → FULFILLING → FULFILLED
           └→ CANCELLED/EXPIRED      └→ PAID_UNALLOCATED/REVIEW_REQUIRED
付款: INITIATED → PENDING → SUCCEEDED | FAILED | CANCELLED
退款: REQUESTED → APPROVED → SUBMITTED → SUCCEEDED | FAILED
权益: PENDING → ACTIVE → EXPIRED/REVOKED；SUSPENDED为有效区间内暂停
交付: QUEUED → APPLYING → VERIFYING → APPLIED
                 ├→ PARTIAL → RETRYING → VERIFYING
                 ├→ NODE_PENDING → RETRYING
                 └→ BLOCKED/CANCELLED
```

支付回调只确认付款事实；Outbox触发分配席位、授予权益和交付。支付在hold过期后到达且无空位，订单必须进入PAID_UNALLOCATED；不得抢占其他人的slot或凭空增加capacity。能按已授权策略分配其他可用slot时重新事务分配，否则待财务/用户解决或走退款。

续费生成新的订单行、权益区间和quota grant；只在生成绝对目标快照时合成新end_at。退款审批、退款平台成功、代理停止服务分别记录，不用一笔退款删除历史订单。

## 5. 最后席位并发、支付去重与AA分账

### 5.1 暂留和分配伪代码

```text
reserveSeat(groupId, userId, idemKey):
  BEGIN
  if saved_result(idemKey): return saved_result
  lock group FOR UPDATE
  require group accepts joining
  release expired HELD slots under this group, preserve hold history
  slot = choose first FREE slot FOR UPDATE
  if none: fail SEAT_CAPACITY_EXHAUSTED
  hold = create ACTIVE hold(expiresAt = databaseNow + configuredTTL)
  update slot FREE → HELD only if current state is FREE
  create order with immutable price and policy snapshot
  save idempotent result and outbox event
  COMMIT

applyVerifiedPayment(event):
  verify provider signature/merchant/order/currency/amount outside business lock
  BEGIN
  insert payment_event(provider,eventId,payloadHash); duplicate same hash → no-op
  lock group, slot, order in canonical order
  if this payment success already applied: COMMIT and return
  append balanced monetary transaction and set payment SUCCEEDED
  if slot still HELD by this valid hold:
      create seat; slot → OCCUPIED; hold → CONSUMED
      create entitlement and quota grants, each unique by order line
      order → FULFILLING; outbox → entitlement.changed
  else if policy allows and FREE slot exists:
      allocate another FREE slot under the same locks; same grant flow
  else:
      order → PAID_UNALLOCATED; outbox → allocation.attention_required
  COMMIT
```

数据库时间决定hold是否过期。重试同幂等键但不同请求body返回409，不能悄悄创建另一个订单。付款回调ack丢失后重送不能再次记款或发额度。外部付款通知中的用户输入不能直接当套餐价格依据。

### 5.2 AA整数分账

每个账期先冻结参与者、权重、费用项、币种和规则版本。默认等权；按天加入/退出或特殊席位可指定整数权重（例如有效分钟数），但须在组策略中公开，不能结算时临时调整。

给定总额 `C ≥ 0`（分）、席位权重 `w[i] ≥ 0`，`W=Σw[i]>0`：

```text
base[i] = floor(C * w[i] / W)
remainder[i] = (C * w[i]) mod W
left = C - Σbase[i]
按 remainder降序、稳定seat_id升序排序
前left个席位各加1分
assert Σallocated[i] == C
```

例如100.00元三人等分：33.34、33.33、33.33。谁拿余数由冻结的稳定排序决定，预览和结算一致。乘法使用足够精度的整数/数据库numeric，不能先转浮点。负数调整先对绝对值分配再统一取负；跨币种禁止直接均摊，若需换汇，另存汇率来源、时点和明确舍入策略。

费用处理分开：已付费用、预估下期费用、应收AA、实际收款。总退款按原付款可退余额约束；组中途退出的按日退款是新计算快照和负调整分录，不能修改已经SETTLED的AA分配。欠款与代理停用的宽限期也要版本化。

## 6. 单一配置写入者与3X-UI过渡

### 6.1 原生节点的写入者隔离

控制面为每个node保存 `owner_epoch`，所有命令携带该值。Agent持久化已接受最大epoch，拒绝更小epoch；相同epoch内按 `node_sequence` 顺序执行。控制面worker需要取得数据库任务租约，但真正防止旧worker继续写的是Agent端epoch校验，而不是worker自觉停止。

节点接管流程：锁定node→进入HANDOVER→停止旧方新任务→等待在途任务完成或标记未知→读取现状与计量切换点→撤销旧凭证/写入通道→递增owner_epoch→新所有者全量核对→切换managed状态。接管期间不接收一般配置发布，只允许明确的恢复和安全撤销。

本地配置目录由Agent独占管理，手工更改检测为DRIFT。系统策略可以选择“告警并冻结发布”或“恢复RayNo1目标”，不得不留记录地双向自动合并。紧急本地接管需要break-glass标记，恢复时再次走handover。

### 6.2 3X-UI模式的真实限制

3X-UI API没有本设计的owner_epoch/If-Match契约。**不能仅给HTTP请求附加一个自定义epoch，就声称外部面板已具备强fencing。** 该模式通过限制写入口、每backend串行队列、独立面板凭证和操作后核对降低风险；在途未知请求必须等其结果或进入维护核对流程，再开展冲突操作。若外部操作者仍能同时改面板，必须显示“外部可写，可能漂移”的状态。

支持两种独立拓扑，不能混杂：

- **经master管理：** RayNo1只写一个3X-UI master，master继续管理它的nodes；本地Agent可只上报主机指标及做明确划分的系统维护，不直接写Xray配置/客户。由master提供的聚合流量只能记一次。
- **独立面板管理：** 解除旧master对目标节点的同步，RayNo1为每个独立面板建连接和映射，通过适配器写其API。跨面板权益与流量由RayNo1汇总。

每个profile记录版本、OpenAPI hash、已测试能力。v3.8.0适配必须处理：`email`查找、客户端完整替换、read侧数字`id`/`uuid`到write侧UUID`id`映射、`totalGB`为bytes、到期毫秒、`success:false`仍可部分成功、`nodePending`、cookie CSRF和token scope限制。调用后读回实际凭证，不能假设服务端不会生成或调整密钥。

部分成功不是通用回滚错误：更新前快照保存在operation_target；只对确认成功目标执行必要补偿。外部请求超时后先读回，若恰好等于desired则标已生效，不再盲创建；若旧值则重试；若第三种状态则标DRIFT/CONFLICT。3X-UI周期重置会尝试重新启用客户，因此适配器必须重算所有暂停原因，禁止清除业务停用。

参考官方实现：[API鉴权](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/api.go)、[客户端API](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/controller/client.go)、[重置行为](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/client_traffic.go)。

## 7. 原生Agent协议

### 7.1 命令信封

以下为RayNo1拟议协议示例，字段值为示意，bytes和大整数以字符串传递：

```json
{
  "schemaVersion": "1",
  "commandId": "op-target-opaque-id",
  "nodeId": "node-opaque-id",
  "ownerEpoch": "7",
  "nodeSequence": "184",
  "kind": "PREPARE_CONFIG",
  "desiredRevision": "42",
  "expectedObservedHash": "sha256:previous",
  "manifestHash": "sha256:desired",
  "manifestRef": "artifact-opaque-id",
  "policyRevision": "91",
  "issuedAt": "2026-09-15T04:00:00Z",
  "expiresAt": "2026-09-15T04:05:00Z",
  "signingKeyId": "control-signing-key-3",
  "signature": "base64-detached-signature"
}
```

命令签名覆盖规范化序列化的固定字段和manifest hash；不签名不稳定的JSON空白。manifest包含核心/sidecar版本与校验和、配置内容hash、资源版本、所需capabilities、secret引用、证书引用、健康检查计划、回滚参考及兼容范围。Secret通过node专属加密信封传递，不能放在可公共下载的artifact里。

Agent的动作枚举应窄化：`PREPARE_CONFIG`、`ACTIVATE_CONFIG`、`ABORT_PREPARED`、`ROLLBACK_CONFIG`、`UPDATE_ENTITLEMENTS`、`REVOKE_CREDENTIALS`、`ROTATE_CERTIFICATE`、`INSTALL_RUNTIME`、`COLLECT_DIAGNOSTICS`。不提供`RUN_SHELL`或任意下载后执行。

### 7.2 握手、能力与时钟

Agent握手上报：agent_version、protocol_version、node身份、公钥、OS/arch、boot_id、已接受owner_epoch、last_command_sequence、runtime列表及instance_id、observed_revision/hash、本地日志最后ack、能力集合及已测试quota_mode。

能力必须描述行为而非仅版本字符串，例如支持的protocol/transport、安全方式、增删用户是否无需重启、是否能关闭既有会话、计量粒度、单用户速率硬限制、lease到期本地停用、配置验证、可用磁盘和时钟偏差。未实测的能力上报UNKNOWN而非true。

租约时间使用控制面签名的绝对截止时间，Agent握手计算允许的时钟误差并转换成本地单调时钟截止点；运行期间时钟回拨不能延长租约。重启无法恢复可信剩余期限或时间偏差超过容忍值时，严格配额模式先停止对应服务再重新握手；不能自动给一份新离线预算。

### 7.3 持久化与重放

```text
receive(command):
  verify mTLS subject, signature, nodeId, schema and expiry
  reject ownerEpoch < durableMaxOwnerEpoch
  if commandId exists:
      if bodyHash differs: reject COMMAND_ID_CONFLICT
      return stored receipt; if incomplete, resume by probing actual state
  if nodeSequence has gap: request missing commands; do not apply out of order
  if expectedObservedHash differs: reject CONFIG_DRIFT
  persist journal RECEIVED + envelope + bodyHash; fsync
  execute the allowed action with bounded timeout
  independently inspect files, runtime and health
  persist receipt + observedHash + runtimeInstanceId; fsync
  report receipt; repeat report until acknowledged
```

Agent断电可能发生在执行成功但回执写入前；恢复时通过文件hash、运行instance_id与期望状态判断，不能把“没有回执”一概等同未执行。对不可逆步骤设计单独prepare/commit和检测标记。控制面收到重复回执按 `(command_id, phase, result_hash)` 去重。

命令队列保留终态和结果摘要；历史裁剪仅在双方确认ack watermark且有归档后进行。日志磁盘满时不能悄悄丢掉用量或命令账本：上报PRESSURE并按quota策略停止新预算/新发布，严格模式到当前租约截止点停用。

## 8. 配置发布、健康检查与回滚

### 8.1 准备与激活

1. **编译：** 控制面把模板、节点资源、有效权益和凭证绑定编译成不可变manifest；输出人可读diff、端口变化、重启影响和目标节点。
2. **静态验证：** JSON/schema、重复端口、路由tag存在性、证书时间、secret可解析、核心capabilities、资源范围。
3. **PREPARE：** Agent下载限定artifact到同一文件系统的staging，校验hash/signature；调用固定版本核心的配置验证模式；验证路径、监听端口、证书权限、磁盘空间；不修改当前运行服务。
4. **ACTIVATE：** 再验证owner_epoch、expected hash和准备结果；同文件系统原子替换活动指针/文件；采用已测试的热更新路径，必要时按计划重启。记录新runtime_instance_id及meter epoch。
5. **VERIFY：** 检查进程状态、实际版本、监听、核心API、代表性协议连接、订阅渲染、目标出站连通性和本地指标；不只检查HTTP `/health`。
6. **COMMIT：** Agent持久化last_known_good；控制面仅在预定目标和健康策略通过后发布新订阅快照。

不支持热更新时，前端要明确预计中断；单端口切换不能假装蓝绿无损。证书、核心、模板三者升级尽量解耦；若必须绑定，manifest明确版本组合。

### 8.2 分批策略

默认先一台低影响canary，观察通过后分地区/小批次继续；每批有最大失败数/比例、最长验证时间、是否需要人工继续等参数。提交集定义 `required_nodes` 和 `optional_nodes`：只允许optional节点故障时形成“降级可用”，required节点未生效则不能显示全部成功。

示例默认参数是可调整初值：一台canary、观察120秒、后续批量10%、任一严重连通性失败暂停、连续两批无新异常再扩大；这些不是已测SLO。发布操作具备暂停、继续、取消未执行目标和回滚已执行目标四种动作。

### 8.3 回滚语义

回滚创建新revision，引用上一版配置，但重新合并**最新权益和撤销水位**。不能用旧配置把退款用户、已泄露凭证或安全停用复活。Agent持久化credential撤销集合/最低credential版本，拒绝旧manifest重新启用。

恢复配置、恢复runtime二进制、恢复证书各自有hash与结果；已有配置不能被旧核心解析时，先准备兼容核心再切换。数据库升级采用兼容窗口和向前修复，不能把整库旧备份当任意发布的常规回滚。

3X-UI模板保存成功后运行协调仍可能失败，故适配器同时记录“持久化模板hash”和“实际运行状态”，不能只靠read API判断。跨节点部分失败不具分布式原子性：操作保持PARTIAL，继续未完成目标或显式补偿已成功目标，直到符合发布策略。

## 9. 流量统计协议与计数器epoch

### 9.1 数据来源和方向

计费/额度口径必须在套餐版本中固定：建议使用代理用户上传+下载bytes，不把网卡流量再加一遍。Xray、sidecar、内核网卡的统计层次可能重叠；各protocol指定唯一权威source，旁路指标仅用于核对。

方向定义使用“成员→代理”为upload，“代理→成员”为download；Agent适配各runtime时显式转换。3X-UI映射依据固定版本字段和实测。一个client多入站返回的累计量先按权威身份去重；master汇总和node明细不能同时入账。

拟议样本：

```json
{
  "nodeId": "node-id",
  "runtimeInstanceId": "core-instance-id",
  "bindingId": "seat-node-inbound-binding",
  "epochId": "meter-epoch-id",
  "sequence": "9041",
  "sampledAt": "2026-09-15T04:10:00Z",
  "monotonicNanos": "12345678900",
  "uploadCumulativeBytes": "1024000",
  "downloadCumulativeBytes": "7340032",
  "source": "xray-user-stats",
  "scope": "local-only",
  "quality": "observed",
  "payloadHash": "sha256:sample",
  "leaseUsage": [
    {"leaseId": "lease-id", "leaseEpoch": "3", "budgetRevision": "6", "spentCumulativeBytes": "8364032"}
  ]
}
```

### 9.2 Agent采样和本地日志

- 尽量读取累计统计而不是reset-on-read；每个runtime启动建立新instance和epoch，动态重建计量实体也产生新epoch。
- 建议初值：本地1秒采样、5秒批量上传；这些只是默认参数，实际调整依性能和超额上界。样本先写本地WAL，再上传；控制面按批确认最高连续sequence。
- Agent重传未ack样本，控制面按sample唯一键去重。重复sequence但不同payload_hash为METER_SEQUENCE_CONFLICT，不能覆盖原数据。
- 禁止让多采集器同时重置同一底层counter。3X-UI模式由面板作为唯一counter消费方，RayNo1只读其对外累计快照。

`leaseUsage`用于支持lease的原生模式，3X-UI METERED模式可省略。底层counter只给总量时，Agent按冻结的grant优先级把每次观测差值分配到当前有效lease桶，并同时持久化分桶结果；控制面核对这些桶的总差值与原始计量一致。不能为同一字节向两个grant都上报消费。一个样本跨越账期/授权截止且无法确定归属时，记录边界不确定量；到期切换尽量先采样，再结束旧区间，并用明确策略处理不可测的小窗口。

### 9.3 控制面处理伪代码

```text
ingest(sample):
  verify node owns binding and sample source is approved
  BEGIN
  insert sample(epoch,sequence,hash) ON CONFLICT:
      equal hash → return previous ack
      unequal hash → quarantine and fail
  lock meter_cursor(epoch)
  if sequence <= cursor.sequence: preserve raw sample, do not post usage again
  if epoch unknown:
      accept only with registered epoch_start provenance and baseline
  if either direction cumulative < its previous value in same epoch:
      mark COUNTER_REGRESSION; no negative usage or free-credit event
      require epoch transition evidence / reconciliation
  else:
      delta = (upload - cursor.upload) + (download - cursor.download)
      post usage(delta, unique source = this sample)
      advance cursor and lease settlement in same transaction
  COMMIT
  acknowledge durable sequence watermark
```

乱序处理策略：累计采样可接受较新的sequence并记差值，随后到达的旧样本保存但不再增记；ack只承诺持久化范围，若协议要求连续watermark则还需保存缺口集合。不能把“见过最大的sequence”等同“所有之前数据均已落库”；确认模式写进协议版本。

### 9.4 重启、重置、恢复和迁移

| 事件 | 正确处理 |
| --- | --- |
| Agent重启、核心没重启 | 恢复本地cursor，核对runtime instance；沿用epoch继续累计 |
| 核心重启、counter归零 | 关闭旧epoch，建新epoch，记录最后已知累计与可能丢失窗口；不冲销旧用量 |
| 管理员流量reset | 必须通过RayNo1操作记录；结束旧epoch/账期展示基线，历史usage保留 |
| 从旧数据库恢复面板 | backend_generation变化；冻结自动结算并重新对齐基线；旧低counter不能当免费额度 |
| 节点迁移 | 先取最终样本/不确定区间，冻结旧lease，建立新node binding和epoch；凭证/订阅切换有明确时点 |
| counter无说明下降 | UNKNOWN/RECONCILING，不自动设baseline=0继续当正常计费 |
| 节点长期失联 | 保留最后已知用量和未结算保留额度；前端显示采样时点/未知窗口 |

底层counter常驻内存时，Agent崩溃与核心崩溃之间可能丢失尚未持久化的字节。仅靠重试协议无法凭空恢复它们；必须记录confidence、用保留预算覆盖风险，或使用具有持久化/前置计量的数据面。不得把估算用量未经标识当精确财务账单。

## 10. 配额分配与跨节点超额上界

### 10.1 三种模式

| 模式 | 实现与承诺 | 适用 |
| --- | --- | --- |
| METERED | 周期采样、达到阈值停用、全局汇总；超额可能受断线/连接存活影响，无严格字节上界 | 3X-UI过渡默认、友好提醒与轻运营 |
| BOUNDED | 有限节点lease+经验证速率上限+采样和停用时限+guard预算；按公式给出上界 | 完成条件测试的原生Agent节点 |
| STRICT | 每字节先经过可执行的本地budget gate，预算耗尽即拒绝继续传输；所有活跃数据路径都受gate控制 | 需要专门数据面/隔离设计，不能仅靠Xray统计API承诺 |

即使有lease，如果Agent只能停止新增连接、既有连接仍继续传输，停用时限就不成立。普通共享Xray入站不能在未实测前承诺可逐用户强制断开既有会话。要得到BOUND/STRICT能力，必须实现能覆盖该席位全部数据路径的限额执行点，或经过验证的进程/入站隔离和强制终止；必要时以整个隔离运行实例停用作为fail-closed代价。

### 10.2 绝对累计授权lease

每个 `(pool,grant,node,subject,lease_epoch)` 只有一个累计授权上限 `authorized_total_bytes`。追加预算使 `budget_revision`增加、累计上限增加；重复发送相同revision不会重复增加额度。Agent记本epoch累计spent，不把每次下发数当“再加多少”。

拟议lease字段：lease_id、pool_id、grant_id、subject_binding_id、node_id、owner_epoch、lease_epoch、budget_revision、authorized_total_bytes、already_spent_floor、expires_at、mode、hard_rate_bytes_per_second、max_sample_gap_ms、max_enforcement_delay_ms、guard_bytes、signature。lease截止不得晚于grant截止或权益截止。

控制面在一个事务中锁定pool和grant，计算：

```text
available = effectiveGranted - settledObservedUsed - outstandingReserved - guardReserved
require requestedLeaseIncrement <= available
append RESERVE event
increase lease.authorized_total_bytes by requestedLeaseIncrement
increase pool.reserved_bytes by requestedLeaseIncrement
emit signed new lease revision through Outbox
```

节点报告新spent后：正常范围内已观察消费增加Δ，未结算lease保留减Δ，二者总和不因结算而增减。若Δ超过该lease尚未结算保留，只扣减现存保留，其余从专属guard结转；超出guard仍完整保存usage并标记OVERRUN，不让reserved变负，也不丢弃真实观测。已撤销或过期的lease不能仅因为TTL到就释放保留额度：旧节点可能已消费但报告未到。只有得到可信final settlement、明确作损失保留，或按审计批准处理后才能释放；否则新节点会重复获得同一预算。

Agent仅在本地持久化新授权revision后生效。恢复备份不能重新使用旧lease的“未花余额”：必须保留durable spent或联系控制面重建；无法证明spent时旧授权冻结，严格模式停用。新lease epoch不能让旧lease同时继续消费。

### 10.3 有界超额公式

对每节点i，必须实际验证并强制执行：

- `R_i`：该预算涉及数据路径的最大合计速率，bytes/s；不能把订阅页面里的标称带宽当硬上限。
- `Δ_i`：允许的最大采样/判定间隔，包含最坏调度延迟。
- `τ_i`：超过额度或lease截止后，全部既有连接停止计量流量的最长执行时间。
- `W_i`：最大不可恢复计量窗口，用来覆盖本地WAL/核心counter丢失。
- `K_i`：运行时/内核已接受而未统计的最大缓冲字节。

保守误差预算可取 `E_i = ceil(R_i × (Δ_i + τ_i + W_i)) + K_i`，整个池 `E = ΣE_i`。若某一项无有限上界，则不能向用户承诺有限E。速率限流器失效、Agent死亡未有watchdog、停用只能阻止新连接，都使这一保证失效。

有两种产品政策：

1. **允许有限超额：** 正常lease预算不超过Q，最大传输预算按条件承诺不超过Q+E；明确E和适用条件。
2. **总量保守封顶：** 从Q中先保留E，不把这部分正常发成可用lease；满足所有条件时，最多Q。前端分别显示已消费、可分配、节点保留、安全保留，不能显示完整Q都可立即用。

例：两个节点每个硬上限5MiB/s、Δ=1s、τ=1s、W=1s、K=1MiB，则每节点保留16MiB，总32MiB。该例只是公式演示；如没有强制速率和已验证终止时限，不能用于宣传。

跨节点共享100GiB绝不能在两台独立服务器各发100GiB；应按lease分配，例如40GiB+40GiB，保留20GiB用于后续调配。用户流量突增时可以补发更高revision，但补发前锁住全局余额。节点离线保持其原有限lease，到期本地停止，不允许无限宽限。

### 10.4 3X-UI兼容模式

官方全局统计推送约30秒，节点将最近全局数据作为禁用依据，超过24小时的全局记录不再参与；这是最终一致控制而非本设计的lease协议。[全局同步](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/job/node_traffic_sync_job.go#L20)、[全局失效窗口](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/internal/web/service/inbound_disable.go#L35)

过渡方案：METERED默认；更保守时按节点拆分固定额度和固定到期，停止额外自动续期，预留同步裕量。若把额度设为“当前已用+新本地预算”，必须先解决原client累计统计和跨节点overlay的来源，不能直接盲加totalGB。没有Agent或其他能本地执行截止的组件时，不宣称离线有界安全。

共享池与个人池可同时存在，但每条binding在一个计量区间只能归属一个计费池；变更归属先结束旧计量区间。对于基础包+加油包，lease绑定具体grant，按到期顺序发放，防止把快到期的额度迁移为永久预算。

实际观察到的超额仍必须完整入账并标记OVERRUN；不能为了维持预算不变量拒绝保存或截断真实usage。预算检查约束的是**授权发放**，观测值超出承诺时是需处理的异常事实。

## 11. 订阅、独立凭据和撤销

### 11.1 订阅入口

建议公共入口为 `GET /s/{opaqueToken}?format=auto|raw|mihomo|xray-json`，只在订阅域名提供；管理API与订阅域名分离。token对应一个个人主体或一个seat，无明文用户邮箱。显式format优先，auto按有限UA规则检测；UA不决定权益和权限。

网关处理：hash token→校验token和subject→读取最新权益/暂停水位→过滤已验证可交付节点→按客户端能力渲染→设置用量/到期头→审计脱敏下载事件。命中缓存前也要检查撤销水位；缓存key包含entitlement、credential、node-selection、renderer版本。公共反向代理访问日志对路径token掩码；不能用完整订阅URL作为监控标签。

订阅头中的 `upload/download/total` 为bytes，`expire`为Unix秒。个人池展示个人权益；共享组池可以展示“全车共享池剩余”，但需在信息页说明，不展示其他成员身份。过期/暂停不返回仍能连接的配置；原始客户端响应与人类信息页分开，禁止把管理系统HTML错误页当订阅正文。

### 11.2 凭据轮换流程

```text
申请轮换 → 创建新credential version → 各目标节点prepare
→ 分批应用并验证 → 新订阅snapshot生效 → 撤销旧credential
→ 确认旧凭证不能新连且既有会话按策略终止 → 标记完成
```

正常轮换可短时并存以降低断线，但窗口必须显式；安全泄露撤销默认无宽限。离线节点撤销尚未执行时，状态为REVOKE_PENDING并可采取上游防火墙/隔离实例停用等已经授权的应急方式。订阅token旋转与代理credential旋转分别记录，操作界面说明二者区别。

HWID只适用于配合发送设备标识的客户端；IP上限不是硬件数；未使用受控客户端和数据面绑定时不要宣传“绝对不可转发”。第一版可做设备登记管理、异常IP提醒及每席位独立凭据，硬设备绑定作为单独研发能力。

## 12. RayNo1管理API草案

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
| 连接测试 | `POST /api/v1/nodes/{id}/probes` | 目标由授权模板/资源限定，限制任意内网探测 |
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
| 配额 | `GET /api/v1/quota-pools/{id}`；`GET .../{id}/leases`；`POST .../{id}/adjustment-previews`；`POST .../{id}/adjustments` | 清晰区分观测、保留、guard、可分配 |
| 凭据 | `POST /api/v1/subjects/{id}/credential-rotations`；`POST .../{id}/revocations` | 长任务，逐目标回执 |
| 订阅token | `POST /api/v1/subjects/{id}/subscription-tokens`；`POST /api/v1/subscription-tokens/{id}/revoke` | 明文只在授权创建响应显示一次 |
| 设备 | `GET /api/v1/subjects/{id}/devices`；`DELETE /api/v1/devices/{id}` | 删除登记与撤销代理权限是不同动作 |
| 证书 | `GET/POST /api/v1/certificates`；`POST .../{id}/renewals`；`GET .../{id}/bindings` | 后端Agent/ACME工作流；不虚构3X-UI证书签发API |
| 备份 | `POST /api/v1/backups`；`GET /api/v1/backups/{id}`；`POST /api/v1/restores/preview`；`POST /api/v1/restores` | 恢复为独立高影响任务，输出审计和验证结果 |
| 操作 | `GET /api/v1/operations/{id}`；`POST .../{id}/retry`；`POST .../{id}/cancel` | retry不改变原目标；要改目标应生成新revision |
| 审计 | `GET /api/v1/audit-events`；`GET /api/v1/audit-exports/{id}` | 范围授权、脱敏、导出过期 |

配置preview不是外部执行许可；当用户已授权创建/编辑时可以直接完成可逆交付，是否人工批准由组织策略与操作影响决定。所有服务端副作用由后端授权检查，前端disabled状态只作体验。

## 13. Agent API与错误约定

### 13.1 Agent传输接口草案

| 方法/路径 | 用途 |
| --- | --- |
| `POST /agent/v1/enroll` | 单次引导token换取受限身份 |
| `POST /agent/v1/handshake` | 版本、epoch、能力、时钟及状态协商 |
| `GET /agent/v1/commands?after=` | HTTPS长轮询/流式命令获取，断连续传 |
| `POST /agent/v1/receipts` | 命令阶段回执；幂等 |
| `POST /agent/v1/telemetry` | 批量累计样本；返回持久化ack与缺口 |
| `POST /agent/v1/heartbeat` | health、压力、最后seen、观察版本 |
| `POST /agent/v1/lease-requests` | 请求额度；返回绝对预算revision或拒绝 |
| `POST /agent/v1/lease-settlements` | 最终spent及闭合证据；释放未用保留 |
| `POST /agent/v1/certificate-renewals` | 身份证书轮换 |
| `GET /agent/v1/artifacts/{id}` | 仅可读取分配给该node且未过期artifact |

控制面与Agent双向证明node绑定。命令、遥测和大artifact分别设消息大小上限及压缩限制；超限返回413，不能无限解压。不在同一长连接上因大日志阻塞紧急撤销。紧急撤销是独立的、只增不减的denylist水位通道，以单独的revocation_sequence和owner_epoch排序；它不能让普通配置命令跳过node_sequence缺口，也不能清除旧撤销。解除安全撤销必须使用更高权益版本的新凭证，不重用已撤销密钥。

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

## 14. 备份、恢复与密钥灾难恢复

### 14.1 备份范围

- PostgreSQL基线备份与WAL，覆盖业务、金额/配额账本、Outbox、操作、映射和审计。
- 不可变模板、manifest、已发布配置、证书、凭据封装和备份manifest；对象存储版本化。
- KMS配置/离线恢复材料与密钥版本清单；恢复材料与加密数据分地保存，不能把唯一解密密钥放在同一份数据库。
- 各节点核心/sidecar版本、配置hash、meter epoch、最后ack、当前lease、Agent身份；3X-UI模式另外备份数据库、证书文件、环境设置、节点token加密keyring。

建议初始目标可设控制面RPO≤5分钟、RTO≤60分钟，前提是部署并验证WAL及恢复流程；这是验收目标，不是当前保证。凭证撤销事件和付款事实尽量有独立追加归档，避免恢复旧库复活旧权限或重复确认付款。

### 14.2 恢复流程

1. 选定备份和恢复点，校验签名/hash/可解密，计算会丢失的事件窗口；隔离环境恢复验证后再切生产。
2. 冻结新销售、配额发放和配置发布；已有节点按现有有限lease运行，到期执行本地策略。
3. 恢复数据库、对象和密钥引用，校验迁移版本、账本借贷、订单合计、quota不变量和Outbox/inbox。
4. 提高控制面恢复generation/owner_epoch，撤销旧worker写权限，防止旧实例恢复联网继续写。
5. 向付款渠道核对恢复窗口内实际付款/退款，按原event/receipt ID补入；绝不能从旧数据库状态推断外部付款没有发生。
6. 从每个node收取运行hash、计量epoch、未ack样本和lease终态。所有旧未结算预算先保留；不能按备份中的旧低usage继续发新额度。
7. 合并最新撤销与权限记录，再重建订阅快照；完整复测后恢复销售/发布。

复制数据库到另一台服务器时必须处理node identity、panel GUID和密钥归属；克隆实例不得以旧节点身份同时在线。备份恢复造成计数器回退，必须标记backend generation，重建统计基线。

3X-UI整库restore会重启，且数据库不等于全部外部证书和加密材料。[官方备份说明](https://github.com/MHSanaei/3x-ui/blob/837addf66e945a80080273b5d2a315dea765d748/docs/content/docs/en/operations/backup-restore.mdx)。恢复演练至少覆盖空白机器、错误证书、丢失keyring、旧schema、对象缺失以及部分节点离线，不以“备份上传成功”代替恢复成功。

## 15. 观测性、故障处理与前端投影

核心指标：发布成功率/耗时、target待同步数、凭证撤销未确认数、sample延迟/缺口、计量未知字节、lease余额与过期数、guard占比、订单PAID_UNALLOCATED、付款去重冲突、账本不平、后台任务积压、订阅渲染失败、节点clock skew。

业务事件均携带request/operation/aggregate correlation id。告警按状态变化去重和恢复闭合；节点短暂断连不要每5秒重复通知。关键事件可发送Telegram/邮件，但发送失败不能撤销已成功的付款或权益事务；通知worker使用自己的Outbox消费记录。

前端读模型建议：

| 页面 | 应展示的独立状态 |
| --- | --- |
| 总览 | 活跃用户/席位、节点在线、服务可用、统计时间、收入/成本/待收各自口径 |
| 服务器 | 管理者、backend/core版本、最近心跳、desired/observed配置、drift、发布历史、证书到期 |
| 拼车组 | 已占/暂留/空位、账期、共享或独立池、已消费/保留/guard/可分配、AA应收与实收 |
| 订单 | 付款、名额、权益、交付四栏；“已支付待分配”有明确处理入口 |
| 成员订阅 | 本人独立链接、套餐scope、可用节点、截止、额度口径、设备登记与最近IP分别展示 |
| 操作中心 | 每目标结果、重试、待恢复、部分失败、是否可用、最近核对时间 |
| 账务 | 不可变明细、费用证据、分摊算法和余数分配、退款状态、调整记录 |

演示页面可以采用这些真实状态和字段，但所有示例值都应标注为演示数据；API未接入时不能把“实时连接”“付款已到账”“节点已部署”当事实。

## 16. 必须通过的验收场景

| 场景 | 通过条件 |
| --- | --- |
| 两用户争最后一个slot | 只一人获得hold；另一方409；capacity不超售 |
| 同用户重复提交订单 | 同幂等键同body得到同订单；不同body409 |
| 付款回调重送10次 | 只一笔付款分录、一次权益和一次quota grant |
| hold过期后付款到达 | 无空slot则PAID_UNALLOCATED；不抢占，不假开通 |
| 100元三人AA | 33.34/33.33/33.33且总额精确100；重复计算排序一致 |
| 中途加入、退出、退款 | 依据冻结策略计算；旧结算不可修改；退款不超可退余额 |
| 多套餐基础+加油包 | 独立grant到期、最早到期优先、不同scope不互借 |
| 手动停用后续费/清零 | 手动原因仍在，不被自动enable复活 |
| 成员越权访问另一席位 | 服务端拒绝或隐藏；无其他凭证、IP、账单泄露 |
| 3X-UI client完整替换 | 未修改字段/凭证/subId/续期参数保持正确 |
| 3X-UI两入站一处失败 | PARTIAL且保存成功集合；重试不重复身份、不多加额度 |
| API超时实际已创建 | 先读回确认，复用凭证，不再创建重复client |
| master与直连同时接管 | ownership校验拒绝；必须先handover |
| 旧worker延迟命令到Agent | owner_epoch低则拒绝；不覆盖新配置 |
| 3X-UI外部并发修改 | 检测drift并停止冲突发布；不宣称If-Match强保护 |
| Agent执行后断电未回执 | 恢复探测实际hash，重发回执，不重复不可逆步骤 |
| 配置校验失败 | 活跃配置/进程未被替换；返回具体验证错误 |
| canary失败 | 后续批次停止；已经激活节点按策略回滚 |
| 回滚碰到最新撤销 | 旧配置不复活已吊销credential/已退款权益 |
| 遥测重复/乱序/缺口 | 不重记、不漏确认缺口；同seq不同hash隔离 |
| Xray重启counter归零 | 新epoch，原usage保留，未知窗口标识，不发免费额度 |
| 面板恢复旧数据库 | generation变化、暂停自动结算、对齐后恢复，不重复预算 |
| 两节点争最后额度 | 事务仅一方得剩余预算；授权+保留+guard不超可发总额 |
| lease消息重送 | 相同revision幂等，不二次增加authorized_total |
| lease过期节点失联 | 中心不释放未结算保留；Agent按已声明策略本地停用 |
| BOUNDED节点超额测试 | 在最大速率/延迟/断电/缓冲测试下实测不超过E；缺条件降级METERED |
| 既有长连接跨限额 | 必须验证其终止时限；不能只测新连接被拒绝 |
| Agent时钟回拨/重启 | lease有效期不延长；不可信时钟按模式停用 |
| 本地日志满 | 告警、不悄悄丢样本；严模式不无限继续发预算 |
| 订阅token轮换 | 旧URL停止拉取；若代理凭证未撤销，明确其仍是另一工作流 |
| 每席位独立credential | A退出或泄露轮换不迫使B修改其凭证 |
| 格式不兼容 | 输出明确支持集合；JSON对象/数组、Mihomo等用真实客户端导入验证 |
| 完整恢复演练 | 空白环境恢复业务、密钥、配置、账本与节点映射；支付与配额差异闭合 |

## 17. 实施顺序与完成标准

### 第一阶段：可演示、可接入、业务不丢

完成组织权限、服务器库存、3X-UI只读导入、计划版本、拼车slot/hold、订单与人工付款核销、AA预览、金额账本、独立订阅、操作中心。演示可以先用样例连接，但读模型与真实API契约一致；付款按钮不能直接把provider_payment标成功。

### 第二阶段：可靠交付与运营

完成v3.8.0适配、Outbox/inbox、单backend串行队列、完整字段读写、partial/nodePending、绝对权益、计量epoch、多套餐grant、METERED配额、凭证轮换、告警、备份恢复。以两个隔离面板和至少两种核心协议完成失败注入测试后再开放真实业务。

### 第三阶段：原生Agent与受控发布

完成mTLS引导/轮换、owner_epoch、持久化命令日志、prepare/activate/verify、canary、回滚不复活撤销、独立遥测、本地lease、时钟异常和磁盘压力处理；保留3X-UI适配作为一种backend。

### 第四阶段：有界配额和规模扩展

先实现真实可执行速率/终止控制并验证公式条件，再开放BOUNDED；STRICT只有在完整数据路径的字节budget gate实现后才能标支持。随后按实际任务吞吐、PostgreSQL写压力、指标保留量拆分worker和遥测存储，不先为假定规模引入复杂分布式事务。

**交付完成标准：** 可从管理员建节点/建组/建套餐开始，经成员抢位付款、独立凭据交付、消费统计、AA结算、续费/退款/退出，完整走通并具备失败恢复；每一处UI“完成/已停用/已退款/已恢复”都有后端事实和可追溯回执支持。
