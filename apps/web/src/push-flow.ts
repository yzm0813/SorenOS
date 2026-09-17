export type PushStage='permission_request'|'permission_granted'|'service_worker_ready'|'push_subscription_created'|'subscription_post_started'|'subscription_post_success';
export type PushStageStatus='started'|'success'|'failed';
export type PushProgress={stage:PushStage;status:PushStageStatus;permission?:string;message?:string};

export class PushConnectionError extends Error{
  stage:PushStage;
  constructor(stage:PushStage,message:string){super(message);this.name='PushConnectionError';this.stage=stage;}
}

type PushRegistration={pushManager:Pick<PushManager,'getSubscription'|'subscribe'>};
type PushFlowOptions={permission:string;requestPermission():Promise<string>;serviceWorkerReady():Promise<PushRegistration>;applicationServerKey:BufferSource;postSubscription(subscription:any):Promise<void>;onProgress?(progress:PushProgress):void;};

const safeFailure=(stage:PushStage,error:unknown)=>{const name=error instanceof Error?error.name:'';if(stage==='permission_request')return '浏览器没有完成通知授权';if(stage==='service_worker_ready')return 'Service Worker 没有成功激活';if(stage==='push_subscription_created')return name==='AbortError'||name==='TypeError'?'浏览器无法连接 Android 推送服务，请检查手机网络后重试':'浏览器没有创建 Push subscription';if(stage==='subscription_post_started')return 'Push subscription 已创建，但没有成功保存到 Soren Core';return '连接此设备失败';};

export async function runPushConnection(options:PushFlowOptions){
  const emit=(stage:PushStage,status:PushStageStatus,extra:Partial<PushProgress>={})=>options.onProgress?.({stage,status,...extra});let stage:PushStage='permission_request';
  try{
    emit(stage,'started',{permission:options.permission});const permission=options.permission==='granted'?'granted':await options.requestPermission();if(permission!=='granted')throw new PushConnectionError(stage,permission==='denied'?'通知权限已被浏览器拒绝，请在站点设置中修改':'没有获得通知权限');emit('permission_granted','success',{permission});
    stage='service_worker_ready';emit(stage,'started');const registration=await options.serviceWorkerReady();emit(stage,'success');
    stage='push_subscription_created';emit(stage,'started');let subscription=await registration.pushManager.getSubscription();if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:options.applicationServerKey});emit(stage,'success');
    stage='subscription_post_started';emit(stage,'started');await options.postSubscription(subscription);emit('subscription_post_success','success');return subscription;
  }catch(error){const known=error instanceof PushConnectionError?error:new PushConnectionError(stage,safeFailure(stage,error));emit(known.stage,'failed',{message:known.message});throw known;}
}
