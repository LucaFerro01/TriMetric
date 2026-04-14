import { useSearchParams } from 'react-router-dom';

const ERROR_MESSAGES: Record<string, string> = {
  no_code: 'No authorization code was returned by Strava.',
  access_denied: 'Access was denied. Please authorize TriMetric to continue.',
  auth_failed: 'Authentication failed. Please try again.',
};

export default function AuthError() {
  const [params] = useSearchParams();
  const code = params.get('message') ?? 'auth_failed';
  const detail = params.get('detail');
  const message = ERROR_MESSAGES[code] ?? `Authentication error: ${code}`;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 border border-red-700 max-w-sm w-full text-center space-y-6">
        <div>
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-2xl font-bold text-red-400">Authentication Failed</h1>
          <p className="text-slate-300 mt-3">{message}</p>
          {detail && (
            <p className="text-slate-500 text-xs mt-2 font-mono">{detail}</p>
          )}
        </div>
        <a
          href="/login"
          className="inline-block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Try again
        </a>
      </div>
    </div>
  );
}
