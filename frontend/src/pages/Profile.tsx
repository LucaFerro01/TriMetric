import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateProfile, logout } from '../api/auth';
import { CheckCircle } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', weight: '', height: '', birthDate: '' });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        weight: user.weight ? String(user.weight) : '',
        height: user.height ? String(user.height) : '',
        birthDate: user.birthDate || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: form.name || undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        birthDate: form.birthDate || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <div className="md:ml-56 text-slate-400 p-8">Loading...</div>;

  return (
    <div className="space-y-6 md:ml-56 max-w-lg">
      <h1 className="text-2xl font-bold text-slate-100">Profile</h1>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-orange-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Weight (kg)</label>
            <input type="number" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Height (cm)</label>
            <input type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-orange-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Birth Date</label>
          <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-orange-500" />
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
          {saved ? <><CheckCircle size={16} /> Saved!</> : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-slate-300 font-medium mb-3">Connected Accounts</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">S</div>
            <div>
              <div className="text-slate-200 text-sm font-medium">Strava</div>
              <div className="text-slate-500 text-xs">{user.stravaId ? `Connected (ID: ${user.stravaId})` : 'Not connected'}</div>
            </div>
          </div>
          {!user.stravaId && (
            <a href="/api/auth/strava" className="text-orange-400 text-sm hover:text-orange-300">Connect</a>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-slate-300 font-medium mb-1">Account</h3>
        <p className="text-slate-500 text-sm mb-3">{user.email}</p>
        <button onClick={logout} className="text-red-400 text-sm hover:text-red-300 transition-colors">Sign out</button>
      </div>
    </div>
  );
}
