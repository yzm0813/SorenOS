import { fileURLToPath } from 'node:url';
import { LAN_WARNING,certificateStatus,detectLanIpv4s,setupLanCertificate } from './lan.js';

const appRoot=fileURLToPath(new URL('../../../',import.meta.url)),command=process.argv[2]||'status',ips=detectLanIpv4s();
const header=(enabled=false)=>console.log(`\nSorenOS LAN Test ${enabled?'Mode':'Setup'}\n${enabled?`\n${LAN_WARNING}\n`:'\nThe server remains localhost-only until you run pnpm lan:start.\n'}`);
if(command==='setup'){header();const result=await setupLanCertificate(appRoot,ips);console.log(`LAN IP: ${result.lanIps.join(', ')}\nPhone URL: https://${result.lanIps[0]}:${process.env.SOREN_LAN_PORT||8788}\n\nCertificate created. Transfer this public CA file to your phone and trust it once:\n${result.caPath}\n\nPrivate keys stay in .lan/ and are ignored by Git.`);}
else if(command==='status'){header();const status=await certificateStatus(appRoot,ips);console.log(`LAN IP: ${ips.join(', ')||'Not detected'}\nHTTPS: ${status.ready?'READY':'NOT READY'}\n${status.reason}${ips[0]?`\nPhone URL: https://${ips[0]}:${process.env.SOREN_LAN_PORT||8788}`:''}`);if(!status.ready)process.exitCode=1;}
else if(command==='start'){header(true);const status=await certificateStatus(appRoot,ips);if(!status.ready)throw new Error(status.reason);process.env.SOREN_LAN_MODE='true';console.log(`Phone URL: https://${ips[0]}:${process.env.SOREN_LAN_PORT||8788}\nLAN only\nHTTPS: ON\nAuthentication: OFF\nKeep this computer awake during testing.\n`);await import('./server.js');}
else throw new Error(`未知命令：${command}`);
