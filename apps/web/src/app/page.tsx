import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/landing-header';
import { Hero } from '@/components/landing/hero';
import { Pipeline, Capabilities } from '@/components/landing/system-sections';
import { EngineeringNumbers, PpeSection, Performance } from '@/components/landing/model-sections';
import { Architecture } from '@/components/landing/architecture';
import { ProductExperience, SecurityAndStack, FinalCta, LandingFooter } from '@/components/landing/product-sections';
import styles from '@/components/landing/landing.module.css';

const description = 'Real-time video analytics with object detection, multi-object tracking, spatial rules, stateful events, forensic evidence, and custom PPE safety analytics.';

export const metadata: Metadata = {
  title: 'VigilAI — Real-Time Computer Vision Analytics',
  description,
  openGraph: {
    title: 'VigilAI — Real-Time Computer Vision Analytics',
    description,
    type: 'website',
  },
};

export default function Home() {
  return (
    <div className={styles.landing}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <EngineeringNumbers />
        <Pipeline />
        <Capabilities />
        <PpeSection />
        <Performance />
        <Architecture />
        <ProductExperience />
        <SecurityAndStack />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
