# Xray 路由管理

实现依据：[妙妙屋 X 路由管理文档](https://miaomiaowux.com/docs/xray-routing/)，2026-09-18 核对。界面和主控协议为 ASWired 自行实现。

## 使用

在服务器、受管入站或自建节点的「路由规则」入口进入，也可直接打开 `/routing`。外部导入节点没有本机可管理的入站，不提供路由入口。

- 左侧按实际 first-match 顺序列出规则，右侧编辑选中规则；拖动或上下按钮排序后自动保存并下发。API 规则只读且固定在最前面。
- 选择入站时同时显示该入站专属规则与全局规则，保留实际顺序。新增默认带当前入站标签，清空标签即为全局规则。专属 catch-all 会提示它之后的全局规则及默认出站失效。
- 快捷规则包括禁止 BT、大陆 IP、内网访问、OpenAI 直连、RFC EMBY 和 TikTok；有实际 `warp-v4` 出站才显示「防止送中」。快捷添加先进入可编辑草稿，确认后「保存并发布」。
- 支持 domain、ip、protocol、port、sourcePort、network、source、user、inboundTag、attrs，空字段省略。单规则内不同条件是 AND，数组字段内部通常为 OR。高级 JSON 保留额外 Xray 字段，由 Agent 的实际核心校验。
- 未匹配的流量走所选默认出站，编译时调整为 `outbounds[0]`。
- 均衡器按出站 tag 前缀匹配，支持 random、roundRobin、leastPing、leastLoad。leastPing 自动生成 observatory；leastLoad 生成 burstObservatory。混合策略共享 burst 观测，随机/轮询指定备用出站时也需观测。可在预览中检查实际生成配置。
- DNS 保留独立 JSON 编辑和发布。规则修改、删除与排序通过真实配置任务下发，Agent 校验后重启核心，失败保留旧配置或回滚。页面显示任务状态与错误，并链接完整执行结果。

## 状态与边界

编辑器显示主控的期望配置。Agent 离线时任务等待接入；「已保存」不表示已应用。主控结构校验与 Agent 核心校验分别执行。多人同时编辑时旧 revision 会被拒绝，应重新载入再修改。服务器路由优先于历史 policies，避免旧策略覆盖新编辑。

首次使用 GeoIP/GeoSite 时 Agent 下载缺失数据文件，核对 SHA-256 和内容后使用；默认目录为 `<data_dir>/geo`。可通过 `XRAY_LOCATION_ASSET` 指定已有目录，离线节点需预先放入数据。下载失败时任务明确失败，不删除旧配置；数据文件不会自动定时更新。ext: 自定义数据库自行维护。

不会凭空创建 WARP 出口或 Reality 防盗 tunnel。已有高级字段会保留，具体引用须与实际出入站一致。此功能不会新增其他受管代理协议，入站仍限 VLESS TCP REALITY。
