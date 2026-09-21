# 第三方来源与素材说明

项目根目录的 MIT 许可证适用于 ASWired 原创代码和文档。下列第三方内容保留各自的归属和许可证。

## 随仓库提供的字体

| 文件 | 来源 | 许可证 |
| --- | --- | --- |
| `frontend/static/fonts/inter.woff2` | The Inter Project Authors；[Inter](https://github.com/rsms/inter) | [SIL Open Font License 1.1](frontend/static/fonts/Inter-OFL.txt) |
| `frontend/static/fonts/lora.woff2` | The Lora Project Authors；[Lora](https://github.com/cyrealtype/Lora-Cyrillic) | [SIL Open Font License 1.1](frontend/static/fonts/Lora-OFL.txt)，保留字体名称 Lora |

请在分发字体时保留对应的版权和许可证文件。

## 应用依赖

`frontend/static/flags/` 包含 [flag-icons 7.5.0](https://github.com/lipis/flag-icons/tree/v7.5.0) 的 4:3 SVG 国旗，采用 MIT 许可；原版权和许可保存在该目录的 `LICENSE`。国旗由本站直接提供，不依赖第三方图片服务或系统 emoji 字体。

Svelte、SvelteKit、Bits UI、Lucide、Tailwind CSS、qrcode、yaml 及构建工具通过包管理器安装。直接依赖在 `frontend/package.json`，精确依赖树在 `frontend/pnpm-lock.yaml`；各依赖的授权以对应包附带的许可证为准。`node_modules/` 不提交至仓库。

## 设计参考

主控与 Agent 已拆为独立仓库。Agent 保留修改后的 Xray MPL 2.0 源码与修改说明；mihomo 作为独立进程使用，遵循 GPL 许可证，不合并为 MIT 代码。主控 MMDB 测试数据及其 MIT 许可保存在主控仓库。各仓库的第三方说明和原始许可证一起维护。

妙妙屋 X、3X-UI 和 Komari 的公开资料用于能力审计与接口设计；AcoFork 用于视觉风格参考。来源、固定版本、已知限制及原始链接见 [来源与版本基线](docs/11-来源与版本基线.md)。ASWired 不是上述项目的官方产品，参考资料不构成官方集成或兼容认证。

公开仓库保留原创分析、功能矩阵和来源元数据，不包含本地提取的官网文档全文或发布说明全文。详见 [参考资料说明](docs/reference/README.md)。

## 项目标识

`frontend/static/aswired-logo.gif` 由项目维护者提供，用于本项目界面。该素材的提供事实不构成对第三方权利或可再授权范围的独立核验；复用前请向维护者确认素材授权范围。
