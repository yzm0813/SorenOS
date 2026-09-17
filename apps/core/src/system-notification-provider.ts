export interface SystemNotificationPayload{notificationId:string;type:string;title:'Soren';body:string;conversationId:string|null;messageId:string|null;deepLink:string;createdAt:string;}
export interface ProviderSubscription{endpoint:string;p256dh:string;auth:string;}
export interface DeliveryResult{status:'sent'|'temporary_failure'|'invalid_subscription';errorCode?:string;}
export interface SystemNotificationProvider{readonly id:string;configured():boolean;publicKey():string;send(subscription:ProviderSubscription,payload:SystemNotificationPayload):Promise<DeliveryResult>;}
