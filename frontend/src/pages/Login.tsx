import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStravaAuthUrl, getToken, saveToken } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle OAuth callback: /auth/callback?token=xxx
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      saveToken(token);
      navigate('/', { replace: true });
      return;
    }
    if (getToken()) navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 max-w-sm w-full text-center space-y-6">
        <div>
          <div className="text-5xl mb-3">⚡</div>
          <h1 className="text-3xl font-bold text-slate-100">TriMetric</h1>
          <p className="text-slate-400 mt-2">Unified sport analytics platform</p>
        </div>

        <div className="space-y-3">
          <a
            href={getStravaAuthUrl()}
            className="flex items-center justify-center gap-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z"/><path d="M8.842 11.828l2.089-4.116 2.089 4.116H8.842z" opacity=".5"/></svg>
            Continue with Strava
          </a>
        </div>

        <p className="text-slate-500 text-xs">
          TriMetric aggregates your training data from Strava, Bryton (via Strava), Zepp/Amazfit, and FIT/GPX file uploads.
        </p>
      </div>
    </div>
  );
}
