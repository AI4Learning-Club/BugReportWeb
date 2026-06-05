# mac_mini 部署与 frp 穿透

## BugReportWeb 后端公网 API

| 用途 | 地址 |
|------|------|
| Web 应用（前后端同端口） | `http://bug.ai4learningwhu.cn:19876` |
| **API 直连（后端）** | `http://bug.ai4learningwhu.cn:3001` |

mac_mini 本机后端监听 `127.0.0.1:19876`（`backend/.env` 中 `PORT=19876`）。  
frpc 将 `localPort 19876` 映射到 frps（`1.13.190.7`）的 `remotePort 3001`，域名 `bug.ai4learningwhu.cn` 解析到该 frps。

浏览器访问 `http://bug.ai4learningwhu.cn:3001/login` 时，后端会 **302 重定向** 到 `http://bug.ai4learningwhu.cn:19876/login`（需配置 `WEB_APP_ORIGIN`）。

## 新增 / 修改 frp 规则

1. 编辑 `/Users/ai4learning/Tools/frpc/frpc.toml`，参考本目录 `frpc-snippet.toml`。
2. 重启 frpc：`/Users/ai4learning/Tools/frpc/restart-frp6-services.sh`
3. 在 frps 上确认端口已监听：`ss -tlnp | grep 3001`
4. 公网验证：`curl http://bug.ai4learningwhu.cn:3001/auth/login ...`

## 相关脚本

| 脚本 | 说明 |
|------|------|
| `bugreportweb-auto-sync.sh` | 从 GitHub 拉取 main 并自动部署 |
| `bugreportweb-sync-now.sh` | 手动触发同步 |
| `update-frontend-origin.sh` | 更新 `FRONTEND_ORIGIN` 并重启服务 |
| `frpc-snippet.toml` | frp 3001 穿透配置片段 |

## 注意

- **不要**用 Windows SSH `-R` 把本机 3001 转发到 mac_mini；公网 3001 由 frp 提供。
- 若腾讯云安全组未放行 3001，需在 frps 所在机器（`production2` / `1.13.190.7`）开放入站 TCP 3001。
