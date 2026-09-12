# Soren Core

统一连接层会在 `http://127.0.0.1:8787` 提供前端和 `/api/*`。直接运行：

```powershell
node .\soren-core\server.mjs
```

连接外部模块时，按 `config.example.env` 提供对应地址。未配置的模块会保持“待配置”，不会返回模拟成功状态。
