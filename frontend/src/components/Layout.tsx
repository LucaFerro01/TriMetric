import { Link, useLocation, Outlet } from 'react-router-dom';
import { Activity, BarChart2, User, Upload, Home, CalendarDays } from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: Home },
  { to: '/activities', label: 'Activities', icon: Activity },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/scheduling', label: 'Scheduling', icon: CalendarDays },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/profile', label: 'Profile', icon: User },
];

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <span className="text-orange-500 font-bold text-xl">⚡ TriMetric</span>
      </header>

      <main className="flex-1 p-4 pb-20 md:pb-4 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              pathname === to ? 'text-orange-500' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            <Icon size={18} />
            <span className="text-[9px] leading-tight truncate w-full text-center">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 bg-slate-800 border-r border-slate-700 flex-col pt-16 px-4 gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === to ? 'bg-orange-500/20 text-orange-400' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </aside>
    </div>
  );
}
