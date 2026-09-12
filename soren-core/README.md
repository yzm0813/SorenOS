# Soren Core

统一连接层会在 `http://127.0.0.1:8787` 提供前端和 `/api/*`。Codex Runtime 使用当前 Codex 登录，不需要 API Key。依次启动 Codex app-server 和 Soren Core：

```powershell
codex app-server --listen ws://127.0.0.1:8765
node .\soren-core\server.mjs
```

Ombre Brain 使用 `http://127.0.0.1:18001/mcp`，Cyberboss 直接作为 Soren Core 模块加载。连接地址可按 `config.example.env` 调整；未配置的游戏和音乐 MCP 会保持“待配置”。
