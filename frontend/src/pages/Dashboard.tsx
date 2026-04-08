import { useEffect, useState } from 'react';
import { Activity as ActivityIcon, TrendingUp, Clock, Flame } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getSummary } from '../api/activities';
import type { ActivitySummary } from '../api/activities';
import { getWeeklyMetrics } from '../api/metrics';
import type { WeeklyMetric } from '../api/metrics';
import StatCard from '../components/StatCard';
import { formatDistance, formatDuration } from '../utils/format';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ActivitySummary[]>([]);
  const [weekly, setWeekly] = useState<WeeklyMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSummary('30d'), getWeeklyMetrics(8)])
      .then(([s, w]) => { setSummary(s); setWeekly(w); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totals = summary.reduce(
    (acc, s) => ({
      distance: acc.distance + (s.totalDistance || 0),
      duration: acc.duration + (s.totalDuration || 0),
      calories: acc.calories + (s.totalCalories || 0),
      count: acc.count + (s.count || 0),
    }),
    { distance: 0, duration: 0, calories: 0, count: 0 }
  );

  // Aggregate weekly data for chart
  const weeklyChart = Object.values(
    weekly.reduce<Record<string, { week: string; distance: number; duration: number }>>((acc, w) => {
      if (!acc[w.week]) acc[w.week] = { week: w.week, distance: 0, duration: 0 };
      acc[w.week].distance += w.totalDistance || 0;
      acc[w.week].duration += w.totalDuration || 0;
      return acc;
    }, {})
  ).sort((a, b) => a.week.localeCompare(b.week));

  if (loading) return <div className="animate-pulse text-slate-400 p-8">Loading dashboard...</div>;

  return (
    <div className="space-y-6 md:ml-56">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
        </h1>
        <p className="text-slate-400 mt-1">Last 30 days overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Activities" value={totals.count} icon={<ActivityIcon size={16} />} color="orange" />
        <StatCard label="Distance" value={formatDistance(totals.distance)} icon={<TrendingUp size={16} />} color="blue" />
        <StatCard label="Time" value={formatDuration(totals.duration)} icon={<Clock size={16} />} color="green" />
        <StatCard label="Calories" value={totals.calories > 0 ? `${totals.calories.toLocaleString()}` : '–'} unit={totals.calories > 0 ? 'kcal' : ''} icon={<Flame size={16} />} color="purple" />
      </div>

      {weeklyChart.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">Weekly Distance (km)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyChart.map(w => ({ ...w, distance: +(w.distance / 1000).toFixed(2) }))}>
              <defs>
                <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" km" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
              <Area type="monotone" dataKey="distance" stroke="#f97316" fill="url(#distGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {summary.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">Activities by Type</h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={summary.map(s => ({ type: s.activityType, count: s.count }))}>
              <XAxis dataKey="type" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {summary.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-8 border border-dashed border-slate-600 text-center">
          <p className="text-slate-400">No activities yet.</p>
          <p className="text-slate-500 text-sm mt-1">Connect Strava or upload a FIT/GPX file to get started.</p>
        </div>
      )}
    </div>
  );
}
