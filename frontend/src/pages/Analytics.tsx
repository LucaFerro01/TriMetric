import { useEffect, useState } from 'react';
import { getVO2MaxHistory, getFTP, getTDEE, getWeeklyMetrics } from '../api/metrics';
import type { WeeklyMetric } from '../api/metrics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from 'recharts';

export default function Analytics() {
  const [vo2maxHistory, setVo2maxHistory] = useState<{ date: string; vo2max: number }[]>([]);
  const [ftp, setFtp] = useState<{ ftp: number | null; basedOnRides?: number; message?: string } | null>(null);
  const [tdee, setTdee] = useState<{ tdee: number | null; weight?: number; age?: number; message?: string } | null>(null);
  const [weekly, setWeekly] = useState<WeeklyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getVO2MaxHistory(), getFTP(), getTDEE(), getWeeklyMetrics(12)])
      .then(([vo2, f, t, w]) => {
        setVo2maxHistory(vo2.filter((v) => v.vo2max > 0 && v.vo2max < 80));
        setFtp(f);
        setTdee(t);
        setWeekly(w);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Aggregate weekly totals
  const weeklyAgg = Object.values(
    weekly.reduce<Record<string, { week: string; distance: number; duration: number; calories: number; elevation: number }>>((acc, w) => {
      if (!acc[w.week]) acc[w.week] = { week: w.week, distance: 0, duration: 0, calories: 0, elevation: 0 };
      acc[w.week].distance += w.totalDistance || 0;
      acc[w.week].duration += w.totalDuration || 0;
      acc[w.week].calories += w.totalCalories || 0;
      acc[w.week].elevation += w.totalElevation || 0;
      return acc;
    }, {})
  ).sort((a, b) => a.week.localeCompare(b.week));

  if (loading) return <div className="md:ml-56 animate-pulse text-slate-400 p-8">Loading analytics...</div>;

  return (
    <div className="space-y-6 md:ml-56">
      <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Estimated FTP</div>
          <div className="text-3xl font-bold text-orange-400">{ftp?.ftp ?? '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{ftp?.message || `from ${ftp?.basedOnRides} rides`}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="text-slate-400 text-sm mb-1">Daily TDEE</div>
          <div className="text-3xl font-bold text-blue-400">{tdee?.tdee ?? '–'}</div>
          <div className="text-slate-500 text-xs mt-1">{tdee?.message || `kcal/day • ${tdee?.weight}kg • age ${tdee?.age}`}</div>
        </div>
      </div>

      {/* VO2max trend */}
      {vo2maxHistory.length > 1 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">VO₂max Trend (from runs)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={vo2maxHistory.map((v) => ({ ...v, vo2max: +v.vo2max.toFixed(1) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={['auto', 'auto']} unit=" ml/kg" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
              <Line type="monotone" dataKey="vo2max" stroke="#22c55e" dot={false} strokeWidth={2} name="VO₂max" />
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
