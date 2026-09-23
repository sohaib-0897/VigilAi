import type { ReactNode } from 'react';
import styles from './landing.module.css';

export function SectionHeading({ index, label, children, description }: {
  index: string; label: string; children: ReactNode; description?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}><span>{index}</span>{' // '}{label}</p>
        <h2>{children}</h2>
      </div>
      {description && <p className={styles.sectionDescription}>{description}</p>}
    </div>
  );
}
