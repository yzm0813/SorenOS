import assert from 'node:assert/strict';
import test from 'node:test';
import type { WeatherLocation } from '@soren/shared';
import { OpenMeteoWeatherProvider } from './weather.js';

const location:WeatherLocation={name:'上海',admin1:'上海市',country:'中国',latitude:31.22,longitude:121.46,timezone:'Asia/Shanghai'};

test('normalizes Open-Meteo current weather', async()=>{
  const fetcher=async()=>new Response(JSON.stringify({current:{temperature_2m:24.4,apparent_temperature:25.1,weather_code:2,is_day:1,time:'2026-09-14T12:00'},daily:{temperature_2m_max:[28],temperature_2m_min:[20],precipitation_probability_max:[35]}}),{status:200});
  const weather=await new OpenMeteoWeatherProvider(fetcher as typeof fetch).current(location);
  assert.equal(weather.status,'ready');assert.equal(weather.label,'多云');assert.equal(weather.temperature,24.4);assert.equal(weather.precipitationProbability,35);
});

test('normalizes location search results',async()=>{
  const fetcher=async()=>new Response(JSON.stringify({results:[{name:'上海',admin1:'上海市',country:'中国',latitude:31.22,longitude:121.46,timezone:'Asia/Shanghai'}]}),{status:200});
  const locations=await new OpenMeteoWeatherProvider(fetcher as typeof fetch).search('上海');
  assert.deepEqual(locations,[location]);
});
