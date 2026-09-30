import Link from 'next/link';
import type { Camera } from '@/lib/types';

const link = 'inline-flex min-h-11 items-center underline decoration-1 underline-offset-4 hover:decoration-2 sm:min-h-8';

/** Cameras / {camera} [/ Zones & lines]. The last item is the current page. */
export function CameraBreadcrumb({ camera, current }: { camera?: Pick<Camera, 'id' | 'name'>; current?: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="vg-label flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground">
        <li><Link href="/cameras" className={link}>Cameras</Link></li>
        {camera && (
          <>
            <li aria-hidden="true">/</li>
            <li className="min-w-0 truncate">
              {current ? (
                <Link href={`/cameras/${camera.id}`} className={link}>{camera.name}</Link>
              ) : (
                <span aria-current="page" className="text-foreground">{camera.name}</span>
              )}
            </li>
          </>
        )}
        {camera && current && (
          <>
            <li aria-hidden="true">/</li>
            <li><span aria-current="page" className="text-foreground">{current}</span></li>
          </>
        )}
      </ol>
    </nav>
  );
}
