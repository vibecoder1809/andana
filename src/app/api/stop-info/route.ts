import { fetchAirQuality, fetchWeather } from '@/lib/gtfs'
import type { StopDetail } from '@/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const stopId = searchParams.get('stopId')
  if (!stopId || stopId.length > 20 || !/^[A-Za-z0-9_-]+$/.test(stopId))
    return Response.json({ error: 'invalid stopId' }, { status: 400 })

  const baseCode = stopId.replace(/\d+$/, '')

  const [airMap, weatherMap] = await Promise.all([
    fetchAirQuality().catch(() => new Map<string, StopDetail['air']>()),
    fetchWeather().catch(() => new Map<string, StopDetail['weather']>()),
  ])

  const result: StopDetail = {
    stopId,
    name: '',
    air: airMap.get(baseCode) ?? null,
    weather: weatherMap.get(baseCode) ?? null,
  }

  return Response.json(result)
}
