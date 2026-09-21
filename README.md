# ASWired

ASWired 是基于 Svelte 5 / SvelteKit 的服务器与代理管理网站，默认使用毛玻璃主题。Go 主控负责账户、套餐、订阅、节点任务和流量计量；ASWired Agent 执行代理管理，Komari 是唯一的主机监控来源。

## 部署 1.0

无需在服务器编译。请使用 [ASWired-Release](https://github.com/AyanamiReiChan/ASWired-Release) 的部署包、校验文件和完整中文教程。组合部署包含 ASWired 与修改版 Komari **1.2.5-fix2-aswired.1.0.0**。

首次访问网站由管理员填写自己的用户名和密码，并输入主控数据目录 `setup-token` 中的一次初始化令牌。没有默认账户或预设管理员密码。

| 仓库 | 内容 |
| --- | --- |
| [ASWired](https://github.com/AyanamiReiChan/ASWired) | 网站源代码和设计资料 |
| [ASWired-Server](https://github.com/AyanamiReiChan/ASWired-Server) | Go 主控、数据持久化、任务、账户与订阅 |
| [ASWired-Agent](https://github.com/AyanamiReiChan/ASWired-Agent) | 管理 Agent、内嵌 Xray、测速和维护工具 |
| [Komari fork](https://github.com/AyanamiReiChan/komari) | Komari 1.2.5-fix2 与 ASWired 统一身份集成 |
| [ASWired-Release](https://github.com/AyanamiReiChan/ASWired-Release) | 编译产物、部署脚本、配置模板与教程 |

## 当前功能

- 服务器支持 WebSocket、HTTP 直连、Pull 轮询和自动回退。监控需安装并绑定 Komari Agent；ASWired Agent 负责 Xray 配置、用户、流量和运维任务。
- 在具体服务器的 Xray 窗口管理入站、路由、证书和 SNI 探测。支持 VLESS、VMess、Trojan、传统 Shadowsocks、Hysteria2、SOCKS5、HTTP；配置了受校验的 Mihomo 后支持 AnyTLS 和 Snell，具体限制见主控的 [协议说明](https://github.com/AyanamiReiChan/ASWired-Server/blob/main/docs/managed-protocols.md)。导入支持范围和可管理协议范围分别校验。
- 账户、套餐、成员订阅、订阅生成、模板、证书、转发、任务、安全日志、数据库管理与备份恢复。
- Agent 日志按按钮手动读取，默认 100 行。更新由管理员手动检查 GitHub Release；Agent 不定时查询发行版。

## 开发

准备 Node.js 24、pnpm 11.19.0，以及按主控仓库说明启动的 Go 服务。

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm run dev
```

开发网站默认 `http://localhost:5174`，主控默认 `http://127.0.0.1:12889`。设置主控 `ASWIRED_PUBLIC_URL=http://localhost:5174`，前端可通过 `ASWIRED_API_TARGET` 指定主控地址。

```sh
pnpm run check
node --test tests/*.test.mjs
pnpm run build
```

生产构建包含内部设计页面隔离检查。`docs/` 中的早期设计与功能矩阵属于历史资料；部署步骤以 Release 教程为准，协议能力以当前代码和测试为准。测试通过不代表全部协议客户端与生产平台均已验收。

## 许可证与来源

ASWired 原创代码采用 MIT。Agent 的 Xray 修改保留 MPL-2.0，Komari 与其他第三方组件保留各自许可证。参考资料见 [来源说明](docs/REFERENCES.md)，参考不表示官方合作或私有协议兼容。
