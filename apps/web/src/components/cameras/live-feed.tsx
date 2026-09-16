'use client';
import { useState } from 'react';
import { VideoOff, AlertTriangle } from 'lucide-react';

export function LiveFeed({ cameraId }: { cameraId: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-black text-white p-6 border-2 border-black select-none">
        <div className="border-2 border-neo-red bg-black p-4 text-center space-y-2 shadow-neo-sm max-w-sm">
          <div className="flex justify-center text-neo-red">
            <VideoOff className="h-8 w-8" strokeWidth={2.5} />
          </div>
          <div className="text-xs font-black uppercase tracking-widest text-neo-red">
            STREAM OFFLINE OR RECONNECTING
          </div>
          <p className="text-[11px] font-mono text-white/70">
            Check worker pipeline status or verify that camera analytics is started.
          </p>
          <button
            onClick={() => setError(false)}
            className="mt-2 border border-white bg-white text-black px-3 py-1 text-xs font-black uppercase hover:bg-neo-yellow"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <img
        src={`/api/v1/cameras/${cameraId}/stream`}
        alt="Real-time surveillance stream"
        onError={() => setError(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
