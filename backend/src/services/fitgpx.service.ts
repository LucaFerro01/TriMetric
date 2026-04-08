import * as fs from 'fs';

export interface ParsedActivity {
  activityType: string;
  startTime: Date;
  duration: number;
  distance: number;
  elevationGain: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgPower: number | null;
  calories: number | null;
  streams: {
    time?: number[];
    heartrate?: number[];
    power?: number[];
    cadence?: number[];
    altitude?: number[];
    latlng?: [number, number][];
  };
  rawData: Record<string, unknown>;
}

export async function parseFitFile(filePath: string): Promise<ParsedActivity> {
  const { default: FitParser } = await import('fit-file-parser');
  const fitParser = new FitParser({ 
    force: true, 
    speedUnit: 'km/h',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
  });

  const buffer = fs.readFileSync(filePath);

  return new Promise((resolve, reject) => {
    fitParser.parse(buffer, (err: Error | null, data: Record<string, unknown>) => {
      if (err) return reject(err);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records: any[] = (data.records as any[]) || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session: any = ((data.sessions as any[]) || [])[0] || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activity: any = ((data.activity as any) || {});

      const times: number[] = records.map((r) => r.elapsed_time || 0);
      const heartrates: number[] = records.map((r) => r.heart_rate).filter(Boolean);
      const powers: number[] = records.map((r) => r.power).filter(Boolean);
      const cadences: number[] = records.map((r) => r.cadence).filter(Boolean);
      const altitudes: number[] = records.map((r) => r.altitude).filter(Boolean);
      const latlngs: [number, number][] = records
        .filter((r) => r.position_lat != null && r.position_long != null)
        .map((r) => [r.position_lat, r.position_long]);

      const avgHr = heartrates.length > 0 ? Math.round(heartrates.reduce((a, b) => a + b, 0) / heartrates.length) : null;
      const maxHr = heartrates.length > 0 ? Math.max(...heartrates) : null;
      const avgPower = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null;

      resolve({
        activityType: (session.sport || 'workout').toLowerCase(),
        startTime: session.start_time ? new Date(session.start_time) : new Date(activity.timestamp || Date.now()),
        duration: session.total_elapsed_time || 0,
        distance: session.total_distance || 0,
        elevationGain: session.total_ascent || 0,
        avgHeartRate: avgHr,
        maxHeartRate: maxHr,
        avgPower,
        calories: session.total_calories || null,
        streams: { time: times, heartrate: heartrates, power: powers, cadence: cadences, altitude: altitudes, latlng: latlngs },
        rawData: data,
      });
    });
  });
}

export async function parseGpxFile(filePath: string): Promise<ParsedActivity> {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Simple GPX parser (key fields)
  const trkptRegex = /<trkpt lat="([\d.-]+)" lon="([\d.-]+)">([\s\S]*?)<\/trkpt>/g;
  const eleRegex = /<ele>([\d.]+)<\/ele>/;
  const timeRegex = /<time>([\s\S]+?)<\/time>/;
  const hrRegex = /<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/;
  const powerRegex = /<gpxtpx:PowerInWatts>(\d+)<\/gpxtpx:PowerInWatts>/;
  const cadenceRegex = /<gpxtpx:cad>(\d+)<\/gpxtpx:cad>/;
  const activityTypeRegex = /<type>([\s\S]+?)<\/type>/;
  const nameRegex = /<name>([\s\S]+?)<\/name>/;

  const activityTypeMatch = content.match(activityTypeRegex);

  const latlngs: [number, number][] = [];
  const altitudes: number[] = [];
  const heartrates: number[] = [];
  const powers: number[] = [];
  const cadences: number[] = [];
  const timestamps: Date[] = [];

  let match;
  while ((match = trkptRegex.exec(content)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];

    latlngs.push([lat, lon]);

    const eleMatch = inner.match(eleRegex);
    if (eleMatch) altitudes.push(parseFloat(eleMatch[1]));

    const timeMatch = inner.match(timeRegex);
    if (timeMatch) timestamps.push(new Date(timeMatch[1]));

    const hrMatch = inner.match(hrRegex);
    if (hrMatch) heartrates.push(parseInt(hrMatch[1]));

    const powerMatch = inner.match(powerRegex);
    if (powerMatch) powers.push(parseInt(powerMatch[1]));

    const cadMatch = inner.match(cadenceRegex);
    if (cadMatch) cadences.push(parseInt(cadMatch[1]));
  }

  const startTime = timestamps[0] || new Date();
  const endTime = timestamps[timestamps.length - 1] || startTime;
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  // Calculate distance from latlngs using Haversine
  let distance = 0;
  for (let i = 1; i < latlngs.length; i++) {
    distance += haversine(latlngs[i - 1], latlngs[i]);
  }

  // Calculate elevation gain
  let elevationGain = 0;
  for (let i = 1; i < altitudes.length; i++) {
    const diff = altitudes[i] - altitudes[i - 1];
    if (diff > 0) elevationGain += diff;
  }

  const avgHr = heartrates.length > 0 ? Math.round(heartrates.reduce((a, b) => a + b, 0) / heartrates.length) : null;
  const maxHr = heartrates.length > 0 ? Math.max(...heartrates) : null;
  const avgPower = powers.length > 0 ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : null;

  return {
    activityType: (activityTypeMatch?.[1] || 'workout').toLowerCase(),
    startTime,
    duration,
    distance,
    elevationGain,
    avgHeartRate: avgHr,
    maxHeartRate: maxHr,
    avgPower,
    calories: null,
    streams: {
      heartrate: heartrates,
      power: powers,
      cadence: cadences,
      altitude: altitudes,
      latlng: latlngs,
    },
    rawData: { name: content.match(nameRegex)?.[1] },
  };
}

function haversine([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
