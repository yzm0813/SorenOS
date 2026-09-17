# LAN Test Mode Security Debt

Phase 5.7.1 的 LAN Test Mode 是一次显式的同网真机测试能力。它没有 login、password、account、device authentication 或用户隔离。任何能访问该电脑 8787/TCP 端口的同网设备，都可能调用 SorenOS API、读取私人数据或执行现有功能。

因此它只能在用户完全信任的私人家庭 Wi-Fi 使用。咖啡店、酒店、公司共享网络、学校网络、公共热点和不可信访客网络一律禁止。启动命令会显示这一警告，但警告本身不构成访问控制。

出现以下任一需求前，必须先设计 authentication、access control、密钥轮换、请求来源保护和安全部署：

- 公网访问或端口转发
- Tailscale 或其他远程网络
- 私人云服务器
- 酒店、公司、学校或公共网络
- 多用户
- 长期 24/7 部署

本阶段不会自动配置路由器、UPnP、NAT-PMP、公网隧道、反向代理或永久防火墙放行，也不会用关闭 TLS 校验或浏览器安全机制来绕过证书问题。
