import webpush from 'web-push';
import type { DeliveryResult,ProviderSubscription,SystemNotificationPayload,SystemNotificationProvider } from './system-notification-provider.js';

export interface WebPushConfig{publicKey:string;privateKey:string;subject:string;}

export class WebPushNotificationProvider implements SystemNotificationProvider{
  readonly id='web-push';
  constructor(private readonly config:WebPushConfig){if(this.configured())webpush.setVapidDetails(config.subject,config.publicKey,config.privateKey);}
  configured(){return Boolean(this.config.publicKey&&this.config.privateKey&&/^(mailto:|https:\/\/)/.test(this.config.subject));}
  publicKey(){return this.configured()?this.config.publicKey:'';}
  async send(subscription:ProviderSubscription,payload:SystemNotificationPayload):Promise<DeliveryResult>{if(!this.configured())return{status:'temporary_failure',errorCode:'vapid_not_configured'};try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload),{TTL:3600,urgency:'normal'});return{status:'sent'};}catch(error:any){const code=String(error?.statusCode||error?.code||'push_failed');return error?.statusCode===404||error?.statusCode===410?{status:'invalid_subscription',errorCode:code}:{status:'temporary_failure',errorCode:code};}}
}
