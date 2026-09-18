# 手机通知测试指南

## 第一次用手机测试 SorenOS

只在自己的家庭 Wi-Fi 使用。这个测试模式没有登录、密码或设备认证，不能用于公司、学校、酒店、咖啡店、公共热点或访客网络。

1. 让电脑和手机连接同一个家庭 Wi-Fi；正常情况下两台设备显示同一个网络名称。
2. 在电脑的 SorenOS 目录运行 `pnpm lan:setup`；正常会看到当前 LAN IP、手机访问地址和一个 `soren-lan-ca.crt` 文件位置。
3. 把这个 `.crt` 公共证书文件通过 USB、AirDrop 或自己的私人文件传输方式放到手机，按下文步骤安装并信任。它不是私钥；`.lan/soren-lan-key.pem` 绝对不要传出电脑。
4. 运行 `pnpm lan:start`；正常会看到 `LAN Test Mode: ENABLED`、`HTTPS: ON` 和以 `https://` 开头的 Phone URL。测试期间保持窗口运行、电脑不休眠。
5. 手机浏览器打开显示的 Phone URL；正常应直接显示 SorenOS，地址栏没有证书警告。不要通过“忽略警告”继续。
6. Android 在浏览器菜单中选择“安装应用/添加到主屏幕”；iPhone/iPad 使用分享菜单的“添加到主屏幕”，然后从桌面图标打开 SorenOS。
7. 在手机 SorenOS 打开 `Settings → 通知`；确认显示 `LAN Test Mode`、`HTTPS Secure` 和 `Push Supported`。
8. 打开“系统通知”，保存，再点“连接此设备”并允许通知；正常显示“这台设备已连接”。
9. 点“发送测试通知”，切到后台或锁屏；正常应收到发送者为 `Soren` 的测试通知，点击后回到 SorenOS。
10. Test Push 成功后，进入 `Timeline → CyberDaddy`，开启监督与一个领域，创建截止时间约五分钟后的一次性承诺。保持电脑 Core 运行并锁屏手机；需要跟进时，Soren 会先写入 Chat，再发送同一句话的系统通知。

Test Push 没成功前，不进行 CyberDaddy 验收。Home Note、Soren Moment、用户 Moment、评论和点赞都只产生应用内状态，手机不应弹出系统通知。

## 手机证书怎么信任

### iPhone / iPad

打开传到手机的 `soren-lan-ca.crt`，按提示下载描述文件；进入“设置 → 已下载描述文件”完成安装。随后进入“设置 → 通用 → 关于本机 → 证书信任设置”，为 **SorenOS LAN Test CA** 打开完全信任。Apple 明确说明手动安装的根证书不会自动获得 SSL 信任，必须完成第二步：[Apple 证书信任说明](https://support.apple.com/102390)。

iOS/iPadOS 的 Web Push 只提供给添加到主屏幕的 Web App，且通知权限必须由用户点击按钮触发；因此要从桌面图标打开 SorenOS 后再连接设备：[WebKit 官方说明](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)。

### Android

不同品牌菜单名称略有差异。通常进入“设置 → 安全与隐私 → 更多安全设置 → 从存储设备安装 → CA 证书”，选择 `soren-lan-ca.crt`。系统可能要求先设置锁屏。安装后用支持 PWA 与 Web Push 的现代浏览器重新打开 Phone URL。

## 常见失败

- **手机打不开地址**：确认两台设备在同一家庭 Wi-Fi；运行 `pnpm lan:status` 检查当前 IP；确认 `pnpm lan:start` 的窗口仍在运行。访客 Wi-Fi 常会隔离设备，不能用于本测试。
- **Certificate not trusted**：不要忽略警告。确认安装的是 `.lan/soren-lan-ca.crt`，不是 server certificate；iPhone 还要单独打开“完全信任”。
- **Windows 防火墙拦截**：不要关闭防火墙。用管理员 PowerShell 添加仅限 Private profile、LocalSubnet、TCP 8788 的入站规则：`New-NetFirewallRule -DisplayName "SorenOS LAN Test 8788" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8788 -Profile Private -RemoteAddress LocalSubnet`。测试结束可用 `Remove-NetFirewallRule -DisplayName "SorenOS LAN Test 8788"` 删除。
- **Push Unsupported**：确认页面是 HTTPS。iPhone/iPad 必须先添加到主屏幕并从桌面图标打开；浏览器和系统本身也必须支持 Web Push。
- **Permission Denied**：SorenOS 不会反复弹窗。到手机的应用/网站通知设置中重新允许，再回到 Settings。
- **Test Push 收不到**：按顺序检查 Settings 是否显示 Secure、Supported、Granted、Subscribed、System Notifications On；再确认电脑 Core 在线。不要继续测 CyberDaddy。
- **Delivery 显示 sent 但手机没有通知**：`sent` 只表示 Web Push 服务已接受；Settings 的通知诊断还会分别显示 `received`（Android Service Worker 收到）和 `displayed`（`showNotification` 成功）。没有 `received` 时检查手机网络/后台限制；有 `received` 但没有 `displayed` 时查看安全错误码。
- **Core Offline**：重新运行 `pnpm lan:start`。离线 PWA 只显示缓存外壳，不会发送 Chat，也不会凭空产生 Push。
- **Core Online、Chat Runtime Offline**：Core 已运行，但本机 Codex app-server 没有就绪。查看启动窗口中的 `Chat runtime offline` 提示并重新运行 `pnpm lan:start`；不要把 8765 改成 LAN IP，也不要开放防火墙端口。
- **LAN IP 变了**：`pnpm lan:status` 会显示证书不匹配。重新运行 `pnpm lan:setup`，重新安装新的 CA 后再 `pnpm lan:start`。

停止 Core 后，PWA 不应崩溃，但不会产生主动消息。重新启动后，Chat、Memory 和订阅记录仍保存在电脑中；只要浏览器 subscription 仍有效，就不需要重新授权。
