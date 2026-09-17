# Mobile Presence & Push

Phase 5.7A 的链路是：`CyberDaddy / 主动事件 → EventService → Chat 消息 + system notification → 持久化 delivery queue → SystemNotificationProvider → WebPushNotificationProvider → Service Worker → 设备通知`。Chat 和领域事件先成功落库，Push 后送达；网络失败不会撤销 Chat。

`SystemNotificationProvider` 隔离了通知领域与具体通道。第一版实现标准 Web Push，未来更换 APNs、FCM、ntfy 或 Gotify 时，不需要改 CyberDaddy 或 EventService。每个 `notification + subscription` 只有一条 delivery，临时失败最多尝试三次，404/410 会停用失效设备。subscription endpoint、密钥只存本地 SQLite，不写日志；VAPID 私钥只来自环境变量。

通知类型严格分离。Home Note 和 Moment 只产生应用内状态；主动 Soren Chat、CyberDaddy follow-up、重要 reminder 在设置开启时同时产生 Chat 与 system channel。推送正文复用写入 Chat 的同一条文字，发送者始终显示 Soren，payload 只含通知 ID、类型、短正文、会话/消息 ID、深链和时间。

PWA 由 `manifest.webmanifest`、静态 shell cache 与 Service Worker 构成。API 从不缓存；离线时只能打开最近缓存的外壳，不能发送 Chat。点击通知会优先聚焦已打开的 SorenOS，并进入对应会话。Badging API 可用时显示 badge，不支持时静默降级。

默认 Core 仍只监听 `127.0.0.1:8787`。Phase 5.7.1 增加显式 `SOREN_LAN_MODE=true`：同一 Core 保留电脑的 localhost HTTP 入口，同时在 `0.0.0.0:8788` 增加带当前私人 LAN IP SAN 的 HTTPS 入口。前端 API、Chat SSE 流和 Push deep link 都使用相对 origin，因此手机与电脑各自留在自己的同源地址；不需要 `Access-Control-Allow-Origin: *`。

LAN Test Mode 没有认证，只允许可信家庭 Wi-Fi。`lan:setup` 生成本地 CA 与一年期 server certificate，全部保存在 Git 忽略的 `.lan/`；`lan:status` 在 DHCP 地址改变时报告 SAN 不匹配，`lan:start` 会拒绝用错误证书启动。该模式不创建公网隧道、不修改路由器，也不自动关闭或永久放开 Windows 防火墙。
