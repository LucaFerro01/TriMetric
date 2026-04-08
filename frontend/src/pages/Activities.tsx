import { useEffect, useState } from 'react';
import { getActivities } from '../api/activities';
import type { Activity } from '../api/activities';
import ActivityCard from '../components/ActivityCard';
import { Search } from 'lucide-react';

const TYPES = ['all', 'run', 'ride', 'swim', 'walk', 'hike', 'strength', 'workout'];
const LIMIT = 20;

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [offset, setOffset] = useState(0);

  const loadMore = async () => {
    setLoading(true);
    try {
      const rows = await getActivities({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        limit: LIMIT,
        offset,
      });
      setActivities((prev) => [...prev, ...rows]);
      setOffset((prev) => prev + LIMIT);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    setActivities([]);
    setLoading(true);
    getActivities({
      type: typeFilter !== 'all' ? typeFilter : undefined,
      limit: LIMIT,
      offset: 0,
    })
      .then((rows) => setActivities(rows))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [typeFilter]);

  const filtered = search
    ? activities.filter((a) =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.activityType.includes(search.toLowerCase())
      )
    : activities;

  return (
    <div className="space-y-4 md:ml-56">
      <h1 className="text-2xl font-bold text-slate-100">Activities</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                typeFilter === t ? 'bg-orange-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading && offset === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-slate-800 rounded-xl h-28 animate-pulse border border-slate-700" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.map((a) => <ActivityCard key={a.id} activity={a} />)}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-500">No activities found</div>
          )}
          {!loading && filtered.length === activities.length && activities.length >= LIMIT && (
            <button onClick={loadMore} className="w-full py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-slate-100 text-sm transition-colors">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
