# 参考资料说明

参考项目与链接统一见 [参考来源](../REFERENCES.md)。结构化资料中迁出的出处原值完整保存在 [历史参考记录](reference-records.md)，功能 ID 与原始记录保留供追溯。

当前范围以 [当前实施范围](../CURRENT-SCOPE.md) 为准：服务器只通过 ASWired Agent 接入，面板 API 适配已移出当前实施范围。历史适配审计与出处继续保留，不代表现有能力；168 项功能核对的数量与状态不因本次移除而改变。

本目录公开维护 ASWired 的原创审计、功能设计和来源元数据。审计基线及原始来源入口见 [来源与版本基线](../11-来源与版本基线.md)。文件中沿用的 RayNo1 是本项目早期工作名称。

## 公开文件

- `miaomiao-audit.md`、`miaomiao-features.json`：功能核对、ASWired 设计映射和逐项证据 URL。
- `3x-ui-audit.md`、`3x-ui-api-method-paths.txt`：固定版本能力审计和接口方法／路径索引，不包含上游后端实现。
- `backend-design.md`：ASWired 后端设计合卷，接口与行为仍需实现。
- `audit-manifest.json`：研究时间、版本、来源文件名和散列值，用于追溯当时的研究基线。

## 本地研究快照

以下文件是研究时取得的第三方全文资料，保留在原研究环境并由根 `.gitignore` 排除，不随公开仓库分发：

- `docs-extracted/`：官网搜索语料提取的 59 篇文档。
- `releases.json`、`releases-notes.md`：GitHub Releases 元数据和发布说明正文。

审计文字或 JSON 的快照字段可能提到这些路径；它们记录历史证据的位置，不表示公开仓库中包含对应文件。核查内容时请使用条目中的官方 URL 与固定版本。`audit-manifest.json` 的散列值记录原研究快照，不作为当前文件校验清单。

运行前端无需这些研究快照：前端使用 `frontend/src/lib/coverage.json` 和 `frontend/static/docs/` 中的静态资料。维护来源记录时，请继续区分上游已公开行为、ASWired 设计与尚待实机验证的内容。
