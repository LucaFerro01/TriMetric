import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getActivity, deleteActivity } from '../api/activities';
import type { Activity } from '../api/activities';
import { formatDuration, formatDistance, formatDate, formatTime } from '../utils/format';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowLeft, Trash2 } from 'lucide-react';

function formatGapPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.floor(secondsPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')} /km`;
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<(Activity & { streams?: Record<string, unknown> }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) getActivity(id).then(setActivity).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id || !confirm('Delete this activity?')) return;
    await deleteActivity(id);
    navigate('/activities');
  };

  if (loading) return <div className="md:ml-56 animate-pulse text-slate-400 p-8">Loading...</div>;
  if (!activity) return <div className="md:ml-56 text-slate-400 p-8">Activity not found</div>;

  const streams = activity.streams as Record<string, number[]> | undefined;
  const chartData = streams?.time?.map((t: number, i: number) => ({
    time: Math.floor(t / 60),
    heartRate: streams.heartrate?.[i],
    power: streams.power?.[i],
    cadence: streams.cadence?.[i],
  })) || [];

  return (
    <div className="space-y-6 md:ml-56">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors">
          <ArrowLeft size={18} /> Back
        </button>
        <button onClick={handleDelete} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm">
          <Trash2 size={16} /> Delete
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-slate-100 capitalize">{activity.activityType}</h1>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-400">{activity.source}</span>
        </div>
        {activity.name && <p className="text-slate-400">{activity.name}</p>}
        <p className="text-slate-500 text-sm">{formatDate(activity.startTime)} at {formatTime(activity.startTime)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {activity.distance && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Distance</div>
            <div className="text-xl font-bold mt-1">{formatDistance(activity.distance)}</div>
          </div>
        )}
        {activity.duration && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Duration</div>
            <div className="text-xl font-bold mt-1">{formatDuration(activity.duration)}</div>
          </div>
        )}
        {activity.elevationGain && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Elevation Gain</div>
            <div className="text-xl font-bold mt-1">+{Math.round(activity.elevationGain)} m</div>
          </div>
        )}
        {activity.avgHeartRate && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Avg Heart Rate</div>
            <div className="text-xl font-bold mt-1">{activity.avgHeartRate} <span className="text-sm font-normal">bpm</span></div>
          </div>
        )}
        {activity.avgPower && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Avg Power</div>
            <div className="text-xl font-bold mt-1">{activity.avgPower} <span className="text-sm font-normal">W</span></div>
          </div>
        )}
        {activity.activityType === 'run' && activity.gapPace && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">GAP</div>
            <div className="text-xl font-bold mt-1">{formatGapPace(activity.gapPace)}</div>
          </div>
        )}
        {activity.calories && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-slate-400 text-sm">Calories</div>
            <div className="text-xl font-bold mt-1">{activity.calories} <span className="text-sm font-normal">kcal</span></div>
          </div>
        )}
      </div>

      {chartData.length > 0 && (streams?.heartrate?.length || streams?.power?.length) && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-slate-300 font-medium mb-4">Activity Data</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" min" />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              {streams?.heartrate?.length && <Line type="monotone" dataKey="heartRate" stroke="#ef4444" dot={false} name="Heart Rate (bpm)" strokeWidth={1.5} />}
              {streams?.power?.length && <Line type="monotone" dataKey="power" stroke="#f97316" dot={false} name="Power (W)" strokeWidth={1.5} />}
              {streams?.cadence?.length && <Line type="monotone" dataKey="cadence" stroke="#22c55e" dot={false} name="Cadence (rpm)" strokeWidth={1.5} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
