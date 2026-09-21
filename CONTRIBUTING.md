# 参与 ASWired 开发

ASWired 网站、主控和 Agent 在三个独立仓库维护。当前网站使用真实主控，功能对齐状态见 [实现核对](docs/reference/implementation-audit.json)；提交时请区分设计目标、实际实现和已执行的验证。

## 开始修改

1. 按 [README](README.md) 安装依赖并运行项目。
2. 从主分支创建用途明确的开发分支。
3. 保持一次 Pull Request 聚焦一个问题；较大的架构或范围调整先通过 Issue 讨论。
4. 更新相应文档，并在 Pull Request 中说明问题、修改后的行为和验证结果。

## 提交前验证

前端变更在 `frontend` 目录运行：

```sh
pnpm check
node --test tests/*.test.mjs
pnpm build
```

对修改过的交互，实际验证对应页面、异常输入和窄屏表现。集成测试使用隔离的临时数据库与测试账户，避免把真实业务数据用作测试样本。普通文字修改检查内容和链接即可。

网站包含行为测试，主控和 Agent 仓库包含单元、事务及可选真实进程集成测试。请在提交说明中记录执行过的验证、日期和范围；构建成功不代表所有生产平台及客户端已验收。

## 文档与数据同步

- 普通代码说明写入 Markdown；源码只保留必要的构建/工具指令、生成标记、版权和许可声明。参考项目与链接集中在 [参考来源](docs/REFERENCES.md)，不要写入界面文案和可执行代码。
- 主设计文档位于 `docs/00-*.md` 至 `docs/20-*.md`；修改后同步至 `frontend/static/docs/` 的同名文件。
- 参考功能集的研究版本在 `docs/reference/miaomiao-features.json`，页面版本在 `frontend/src/lib/coverage.json`。修改功能时保留稳定 ID 和版本边界；出处原值保存在 `docs/reference/reference-records.md`，并通过 Markdown 链接关联。
- 设计契约位于 `docs/contracts/openapi.yaml`。未实现的接口和未验证的第三方兼容行为应继续明确标注。
- 当前实现证据记录在 `docs/reference/implementation-audit.json`，其中 `server/`、`agent/` 路径分别相对独立仓库；同步页面下载副本。Agent 通道合同变更需同时更新主控 `pkg/agentwire`、Agent `internal/wire` 并验证双端兼容。
- 保留第三方许可证和来源说明。新增第三方素材时同步更新 `THIRD_PARTY_NOTICES.md`。

## 提交内容

提交源码、配置、锁文件和维护文档。依赖目录、构建产物、预览日志、浏览器导出数据、本地环境文件、服务器凭据和完整第三方资料缓存不应提交；根 `.gitignore` 已覆盖常见本地文件。

复现问题请使用演示数据或脱敏样本，不要在 Issue、Pull Request、截图或日志中包含订阅令牌、服务器密码、支付信息或用户资料。上报潜在安全问题时，只提供足以说明问题的最小脱敏示例。

## Pull Request 建议内容

- 要解决的问题及相关 Issue。
- 用户能观察到的行为变化。
- 验证方式和结果；界面调整可附截图。
- 尚未实现或仍需实机确认的部分。
