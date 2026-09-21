# ASWired 独立探针

独立静态页面复用网站的深色探针组件，Cloudflare Worker 仅代理公开指标、外观以及登录回接所需接口。它不代理管理后台资源或 Agent 控制接口，也不保存主控密钥。

## 构建与部署

1. 在 `frontend` 目录安装锁文件依赖，运行 `node node_modules/vite/bin/vite.js build --config vite.probe.config.ts`。
2. 复制 `worker/wrangler.toml.example` 为 `worker/wrangler.toml`，填写真实 `ASWIRED_MASTER_ORIGIN`，仅允许 HTTPS 来源。
3. 在主控 `ASWIRED_ALLOWED_ORIGINS` 中增加独立探针的完整 HTTPS 来源，重启主控。保留主站来源。
4. 使用 Cloudflare 官方 Wrangler 在 `worker` 目录部署该配置。静态资源由 `ASSETS` 提供，所有请求先经过 Worker。
5. 主控开启公开探针并选择公开服务器。验证独立域名 `/`、`/auth/callback` 与登录回接。

本次实现只提供可部署产物，不会自动创建 Cloudflare 资源或公开现有项目。

如果主控配置了 `probeAccessKey`，通过 Worker Secret 配置同值 `ASWIRED_PROBE_TOKEN`。Worker 只向两个探针指标接口附加该凭据，不向浏览器、`probe-config.json`、登录回接或身份接口公开。不要把密钥放进 `wrangler.toml` 的普通变量或静态构建环境。这个密钥验证 Worker 到主控的读取；Worker 页面仍按其部署访问策略公开展示。

## 登录与数据边界

浏览器生成随机 state 和 PKCE verifier，并将 verifier 留在当前探针来源的 sessionStorage。登录跳转到主控 `/auth/authorize`；用户确认回接来源后，主控返回 120 秒单次 code。探针在自己的来源核对 state、兑换 JWT 并移除地址栏 code/state。Worker 保留真实 Origin，主控必须显式允许该来源。

JWT 仅留在探针 sessionStorage，身份读取使用 `/api/me`，不下载后台完整 `/api/state`。回接来源、verifier、期限或一次性使用验证失败时不会登录。

自定义 CSS 来自主控 `customCSS`，通过 `style.textContent` 加载。访问 `/?nocss=1` 跳过自定义 CSS；页面固定深色，无主题切换。Worker CSP 禁止外部脚本、字体、图片与连接，样式无法加载第三方资源。

同样的静态产物可由 Nginx 等服务部署，但必须对上述小范围 `/api` 路径反向代理、保留 Origin，并将 `/auth/callback` 回退到 `probe/index.html`。不要把全部 `/api` 代理开放到独立探针。
