import { useEffect, useState } from 'react';
import { getActivities, type Activity } from '../api/activities';
import { getVO2MaxHistory, getFTP, getTDEE, getWeeklyMetrics } from '../api/metrics';
import type { WeeklyMetric } from '../api/metrics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts';

type Vo2MaxPoint = {
  date: string;
  vo2max: number;
  activityId: string;
};

type Vo2Mode = 'run' | 'bike';

function estimateRunVo2max(activity: Activity): number | null {
  if (!activity.distance || !activity.duration || activity.duration <= 0) return null;
  const speedMetersPerMinute = activity.distance / (activity.duration / 60);
  const oxygenCost = -4.60 + 0.182258 * speedMetersPerMinute + 0.000104 * speedMetersPerMinute * speedMetersPerMinute;
  return oxygenCost / 0.83;
}

function estimateBikeVo2max(activity: Activity, weightKg: number): number | null {
  if (!activity.avgPower || activity.avgPower <= 0 || weightKg <= 0) return null;
  const ftpWatts = activity.duration && activity.duration >= 60 * 60 ? activity.avgPower : activity.avgPower * 0.95;
  const oxygenCost = 10.8 * (ftpWatts / weightKg) + 7;
  return oxygenCost / 0.75;
}

function formatActivityLabel(activity: Activity): string {
  const date = new Date(activity.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const durationMinutes = activity.duration ? Math.round(activity.duration / 60) : 0;
  return `${activity.name ?? activity.activityType} • ${date} • ${durationMinutes} min`;
}

export default function Analytics() {
  const [activities, setActivities] = useState<{ run: Activity[]; bike: Activity[] }>({ run: [], bike: [] });
  const [vo2maxHistory, setVo2maxHistory] = useState<{ run: Vo2MaxPoint[]; bike: Vo2MaxPoint[] }>({ run: [], bike: [] });
  const [ftp, setFtp] = useState<{ ftp: number | null; basedOnRides?: number; message?: string } | null>(null);
  const [tdee, setTdee] = useState<{ tdee: number | null; weight?: number; age?: number; message?: string } | null>(null);
  const [weekly, setWeekly] = useState<WeeklyMetric[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedBikeId, setSelectedBikeId] = useState<string>('');
  const [activeVo2Mode, setActiveVo2Mode] = useState<Vo2Mode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getActivities({ type: 'run', limit: 100 }),
      getActivities({ type: 'ride', limit: 100 }),
      getVO2MaxHistory(),
      getFTP(),
      getTDEE(),
      getWeeklyMetrics(12),
    ])
      .then(([runs, rides, vo2, f, t, w]) => {
        setActivities({ run: runs, bike: rides });
        setVo2maxHistory({
          run: vo2.run.filter((v) => v.vo2max > 0 && v.vo2max < 80),
          bike: vo2.bike.filter((v) => v.vo2max > 0 && v.vo2max < 80),
        });
        setFtp(f);
        setTdee(t);
        setWeekly(w);
        setSelectedRunId((current) => current || runs[0]?.id || '');
        setSelectedBikeId((current) => current || rides[0]?.id || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Aggregate weekly totals
  const weeklyAgg = Object.values(
    weekly.reduce<Record<string, { week: string; distance: number; duration: number; calories: number; elevation: number }>>((acc, w) => {
      if (!acc[w.week]) acc[w.week] = { week: w.week, distance: 0, duration: 0, calories: 0, elevation: 0 };
      acc[w.week].distance += Number (w.totalDistance) || 0;
      acc[w.week].duration += Number (w.totalDuration)|| 0;
      acc[w.week].calories += Number (w.totalCalories) || 0;
      acc[w.week].elevation += Number (w.totalElevation) || 0;
      return acc;
    }, {})
  ).sort((a, b) => a.week.localeCompare(b.week));

  const runVo2 = [...vo2maxHistory.run].sort((a, b) => a.date.localeCompare(b.date));
  const bikeVo2 = [...vo2maxHistory.bike].sort((a, b) => a.date.localeCompare(b.date));
  const vo2Combined = Object.values(
    [...runVo2.map((point) => ({ date: point.date, run: point.vo2max, bike: null as number | null })),
      ...bikeVo2.map((point) => ({ date: point.date, run: null as number | null, bike: point.vo2max }))]
      .reduce<Record<string, { date: string; run: number | null; bike: number | null }>>((acc, entry) => {
        if (!acc[entry.date]) acc[entry.date] = { date: entry.date, run: null, bike: null };
        if (entry.run != null) acc[entry.date].run = entry.run;
        if (entry.bike != null) acc[entry.date].bike = entry.bike;
        return acc;
      }, {})
  ).sort((a, b) => a.date.localeCompare(b.date));

  const selectedRunActivity = activities.run.find((activity) => activity.id === selectedRunId) ?? activities.run[0] ?? null;
  const selectedBikeActivity = activities.bike.find((activity) => activity.id === selectedBikeId) ?? activities.bike[0] ?? null;
  const selectedRunVo2 = selectedRunActivity ? estimateRunVo2max(selectedRunActivity) : null;
  const selectedBikeVo2 = selectedBikeActivity ? estimateBikeVo2max(selectedBikeActivity, tdee?.weight ?? 70) : null;

  if (loading) return <div className="md:ml-56 animate-pulse text-slate-400 p-8">Loading analytics...</div>;

  return (
    <div className="space-y-6 md:ml-56">
      <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Estimated FTP</div>
          <div className="text-3xl font-bold text-orange-400">{ftp?.ftp ?? '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{ftp?.message || `from ${ftp?.basedOnRides} rides`}</div>
        </div>
        <button type="button" onClick={() => setActiveVo2Mode('run')} className="text-left bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-green-500/60 transition">
          <div className="text-slate-400 text-sm mb-1">VO₂max Run</div>
          <div className="text-3xl font-bold text-green-400">{selectedRunVo2 ? selectedRunVo2.toFixed(1) : '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{selectedRunActivity ? formatActivityLabel(selectedRunActivity) : 'Choose a run activity'}</div>
        </button>
        <button type="button" onClick={() => setActiveVo2Mode('bike')} className="text-left bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-cyan-500/60 transition">
          <div className="text-slate-400 text-sm mb-1">VO₂max Bike</div>
          <div className="text-3xl font-bold text-cyan-400">{selectedBikeVo2 ? selectedBikeVo2.toFixed(1) : '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{selectedBikeActivity ? formatActivityLabel(selectedBikeActivity) : 'Choose a ride activity'}</div>
        </button>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Daily TDEE</div>
          <div className="text-3xl font-bold text-blue-400">{tdee?.tdee ?? '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{tdee?.message || `kcal/day • ${tdee?.weight}kg • age ${tdee?.age}`}</div>
        </div>
      </div>

      {activeVo2Mode && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-slate-300 font-medium">{activeVo2Mode === 'run' ? 'Select run activity' : 'Select bike activity'}</h2>
              <p className="text-slate-500 text-sm">The VO₂max value updates based on the selected activity.</p>
            </div>
            <button type="button" className="text-sm text-slate-400 hover:text-slate-200" onClick={() => setActiveVo2Mode(null)}>
              Close
            </button>
          </div>

          {activeVo2Mode === 'run' && (
            <div className="space-y-4">
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={selectedRunActivity?.id ?? ''}
                onChange={(event) => setSelectedRunId(event.target.value)}
              >
                {activities.run.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {formatActivityLabel(activity)}
                  </option>
                ))}
              </select>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="text-slate-400 text-sm mb-2">Selected activity</div>
                  <div className="text-slate-100 font-medium">{selectedRunActivity ? selectedRunActivity.name ?? 'Run activity' : 'No run available'}</div>
                  <div className="text-slate-500 text-sm mt-1">{selectedRunActivity ? formatActivityLabel(selectedRunActivity) : 'Import a run to enable the estimate'}</div>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="text-slate-400 text-sm mb-2">Estimated VO₂max</div>
                  <div className="text-3xl font-bold text-green-400">{selectedRunVo2 ? selectedRunVo2.toFixed(1) : '–'}</div>
                  <div className="text-slate-500 text-sm mt-1">Daniels / pace-based estimate</div>
                </div>
              </div>
            </div>
          )}

          {activeVo2Mode === 'bike' && (
            <div className="space-y-4">
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                value={selectedBikeActivity?.id ?? ''}
                onChange={(event) => setSelectedBikeId(event.target.value)}
              >
                {activities.bike.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {formatActivityLabel(activity)}
                  </option>
                ))}
              </select>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="text-slate-400 text-sm mb-2">Selected activity</div>
                  <div className="text-slate-100 font-medium">{selectedBikeActivity ? selectedBikeActivity.name ?? 'Bike activity' : 'No ride available'}</div>
                  <div className="text-slate-500 text-sm mt-1">{selectedBikeActivity ? formatActivityLabel(selectedBikeActivity) : 'Import a ride to enable the estimate'}</div>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="text-slate-400 text-sm mb-2">Estimated VO₂max</div>
                  <div className="text-3xl font-bold text-cyan-400">{selectedBikeVo2 ? selectedBikeVo2.toFixed(1) : '–'}</div>
                  <div className="text-slate-500 text-sm mt-1">FTP / power-based estimate</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VO2max trend */}
      {vo2Combined.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">VO₂max Trend (run and bike)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={vo2Combined.map((v) => ({ ...v, run: v.run != null ? +v.run.toFixed(1) : null, bike: v.bike != null ? +v.bike.toFixed(1) : null }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} unit=" ml/kg" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Line type="monotone" dataKey="run" stroke="#22c55e" dot={false} strokeWidth={2} name="Run" connectNulls />
              <Line type="monotone" dataKey="bike" stroke="#06b6d4" dot={false} strokeWidth={2} name="Bike" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly training load */}
      {weeklyAgg.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">Weekly Training Load</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyAgg.map((w) => ({ ...w, distance: +(w.distance / 1000).toFixed(1), duration: +(w.duration / 3600).toFixed(1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Bar dataKey="distance" name="Distance (km)" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="duration" name="Duration (h)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
