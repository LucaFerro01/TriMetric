import { useState, useRef } from 'react';
import { uploadFile } from '../api/activities';
import { Upload as UploadIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(fit|gpx)$/i)) {
      setStatus('error');
      setMessage('Only .fit and .gpx files are supported');
      return;
    }
    setStatus('uploading');
    setMessage('');
    try {
      const activity = await uploadFile(file);
      setStatus('success');
      setMessage(`Uploaded "${activity.name || activity.activityType}" successfully!`);
      setTimeout(() => navigate(`/activities/${activity.id}`), 1500);
    } catch {
      setStatus('error');
      setMessage('Failed to upload file. Please check the file format and try again.');
    }
  };

  return (
    <div className="space-y-6 md:ml-56">
      <h1 className="text-2xl font-bold text-slate-100">Upload Activity</h1>
      <p className="text-slate-400">Upload a FIT or GPX file from your GPS device or app.</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-orange-500 bg-orange-500/5' : 'border-slate-600 hover:border-orange-500/50 hover:bg-slate-800/50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".fit,.gpx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {status === 'idle' && (
          <>
            <UploadIcon size={40} className="mx-auto text-slate-500 mb-3" />
            <p className="text-slate-300 font-medium">Drop your FIT or GPX file here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse</p>
          </>
        )}
        {status === 'uploading' && (
          <div className="space-y-2">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400">Uploading and parsing...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="space-y-2">
            <CheckCircle size={40} className="mx-auto text-green-400" />
            <p className="text-green-400 font-medium">{message}</p>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-2">
            <AlertCircle size={40} className="mx-auto text-red-400" />
            <p className="text-red-400">{message}</p>
            <button className="text-slate-400 text-sm underline" onClick={(e) => { e.stopPropagation(); setStatus('idle'); }}>Try again</button>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-slate-300 font-medium mb-2">Supported Formats</h3>
        <ul className="space-y-1 text-sm text-slate-400">
          <li>• <strong className="text-slate-200">.fit</strong> — Garmin, Wahoo, Polar, Bryton, and most GPS devices</li>
          <li>• <strong className="text-slate-200">.gpx</strong> — Standard GPS exchange format, exported from most apps</li>
        </ul>
      </div>
    </div>
  );
}
