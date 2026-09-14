import type { WeatherLocation, WeatherSnapshot } from '@soren/shared';

type Fetcher = typeof fetch;

export interface WeatherProvider {
  search(query: string): Promise<WeatherLocation[]>;
  current(location: WeatherLocation): Promise<WeatherSnapshot>;
}

const weatherLabels: Record<number, string> = {
  0:'晴朗',1:'大致晴朗',2:'多云',3:'阴天',45:'有雾',48:'雾凇',51:'细雨',53:'细雨',55:'较强细雨',
  56:'冻雨',57:'较强冻雨',61:'小雨',63:'中雨',65:'大雨',66:'冻雨',67:'较强冻雨',71:'小雪',
  73:'中雪',75:'大雪',77:'米雪',80:'阵雨',81:'阵雨',82:'强阵雨',85:'阵雪',86:'强阵雪',95:'雷雨',96:'雷雨伴冰雹',99:'强雷雨伴冰雹'
};

async function json(fetcher: Fetcher, url: string) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
  return response.json() as Promise<any>;
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  constructor(private readonly fetcher: Fetcher = fetch) {}

  async search(query: string): Promise<WeatherLocation[]> {
    const name=query.trim();if(name.length<2)return [];
    const data=await json(this.fetcher,`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=zh&format=json`);
    return (data.results||[]).map((item:any)=>({name:String(item.name),admin1:String(item.admin1||''),country:String(item.country||''),latitude:Number(item.latitude),longitude:Number(item.longitude),timezone:String(item.timezone||'auto')}));
  }

  async current(location: WeatherLocation): Promise<WeatherSnapshot> {
    const params=new URLSearchParams({latitude:String(location.latitude),longitude:String(location.longitude),current:'temperature_2m,apparent_temperature,weather_code,is_day',daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max',forecast_days:'1',timezone:'auto'});
    const data=await json(this.fetcher,`https://api.open-meteo.com/v1/forecast?${params}`);const current=data.current||{},daily=data.daily||{};const code=Number(current.weather_code);
    return {status:'ready',location,temperature:Number(current.temperature_2m),apparentTemperature:Number(current.apparent_temperature),minimum:Number(daily.temperature_2m_min?.[0]),maximum:Number(daily.temperature_2m_max?.[0]),precipitationProbability:Number(daily.precipitation_probability_max?.[0]),weatherCode:code,label:weatherLabels[code]||'天气变化中',isDay:Number(current.is_day)===1,observedAt:String(current.time||'')||null};
  }
}

export const emptyWeather = (status: 'unconfigured'|'unavailable', location: WeatherLocation|null=null): WeatherSnapshot => ({status,location,temperature:null,apparentTemperature:null,minimum:null,maximum:null,precipitationProbability:null,weatherCode:null,label:status==='unconfigured'?'选择一座城市':'天气暂时没有回应',isDay:null,observedAt:null});
