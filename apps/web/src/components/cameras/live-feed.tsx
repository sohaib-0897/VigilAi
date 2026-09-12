'use client';
import { useState } from 'react';

export function LiveFeed({ cameraId }: { cameraId: string }) {
  const [error, setError] = useState(false);
  
  if (error) {
    return <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">Stream unavailable</div>;
  }

  return (
    <img 
      src={`/api/v1/cameras/${cameraId}/stream`} 
      alt="Live Stream" 
      onError={() => setError(true)}
      className="w-full h-full object-contain bg-black"
    />
  );
}
