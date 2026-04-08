import type { Activity } from '../api/activities';
import { formatDuration, formatDistance, formatDate } from '../utils/format';
import { Link } from 'react-router-dom';

const typeEmoji: Record<string, string> = {
  run: '🏃', ride: '🚴', swim: '🏊', walk: '🚶', hike: '🥾',
  strength: '🏋️', yoga: '🧘', workout: '💪',
};

interface Props {
  activity: Activity;
}

export default function ActivityCard({ activity }: Props) {
  const emoji = typeEmoji[activity.activityType] || '🏅';

  return (
    <Link to={`/activities/${activity.id}`} className="block bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-orange-500/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{emoji}</span>
            <span className="font-medium text-slate-100 capitalize">{activity.activityType}</span>
            <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full text-slate-400">{activity.source}</span>
          </div>
          {activity.name && <p className="text-slate-400 text-sm mt-1">{activity.name}</p>}
        </div>
        <span className="text-slate-500 text-sm">{formatDate(activity.startTime)}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        {activity.distance && (
          <div>
            <div className="text-slate-400">Distance</div>
            <div className="font-medium">{formatDistance(activity.distance)}</div>
          </div>
        )}
        {activity.duration && (
          <div>
            <div className="text-slate-400">Duration</div>
            <div className="font-medium">{formatDuration(activity.duration)}</div>
          </div>
        )}
        {activity.avgHeartRate && (
          <div>
            <div className="text-slate-400">Avg HR</div>
            <div className="font-medium">{activity.avgHeartRate} bpm</div>
          </div>
        )}
        {activity.calories && (
          <div>
            <div className="text-slate-400">Calories</div>
            <div className="font-medium">{activity.calories} kcal</div>
          </div>
        )}
        {activity.elevationGain && (
          <div>
            <div className="text-slate-400">Elevation</div>
            <div className="font-medium">+{Math.round(activity.elevationGain)} m</div>
          </div>
        )}
        {activity.avgPower && (
          <div>
            <div className="text-slate-400">Avg Power</div>
            <div className="font-medium">{activity.avgPower} W</div>
          </div>
        )}
      </div>
    </Link>
  );
}
