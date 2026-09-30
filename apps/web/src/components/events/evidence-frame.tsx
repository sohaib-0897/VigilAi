'use client';
import { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import type { Evidence } from '@/lib/types';
import { ViewportFrame } from '@/components/primitives/viewport-frame';

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

/**
 * One stored evidence file. The image is served by the API after an ownership
 * and evidence-directory check; if it cannot be read, the frame says so rather
 * than showing a placeholder.
 */
export function EvidenceFrame({ eventId, evidence, index, alt }: { eventId: string; evidence: Evidence; index: number; alt: string }) {
  const [failed, setFailed] = useState(false);
  const src = `/api/v1/events/${eventId}/evidence/${evidence.id}/file`;
  const size = evidence.width && evidence.height ? `${evidence.width}×${evidence.height}` : null;
  const aspect = evidence.width && evidence.height ? `${evidence.width} / ${evidence.height}` : '16 / 9';

  return (
    <ViewportFrame
      as="figure"
      brackets={false}
      label={`${evidence.evidence_type} ${String(index + 1).padStart(2, '0')}`}
      meta={
        !failed && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="vg-label inline-flex min-h-11 items-center gap-1.5 underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-8"
          >
            Full size <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )
      }
      footer={
        <>
          <span>{size ?? 'SIZE NOT RECORDED'}</span>
          <span>{[evidence.mime_type, evidence.file_size ? kb(evidence.file_size) : null].filter(Boolean).join(' · ')}</span>
        </>
      }
    >
      <div className="surface-optical bg-background" style={{ aspectRatio: aspect }}>
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-foreground">
            <ImageOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-body-sm font-semibold">The snapshot file could not be loaded.</p>
            <p className="max-w-xs text-body-sm text-muted-foreground">
              The evidence record exists, but the API did not return the image. The file may have been removed from evidence storage.
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API file, not a static asset
          <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-contain" />
        )}
      </div>
    </ViewportFrame>
  );
}
