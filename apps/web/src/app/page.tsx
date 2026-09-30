import type { Metadata } from 'next';
import { LandingHeader } from '@/components/landing/landing-header';
import { Hero } from '@/components/landing/hero';
import { Pipeline, Capabilities } from '@/components/landing/system-sections';
import { EngineeringNumbers, PpeSection, Performance } from '@/components/landing/model-sections';
import { Architecture } from '@/components/landing/architecture';
import { ProductExperience, SecurityAndStack, FinalCta, LandingFooter } from '@/components/landing/product-sections';

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

// Page-wide landing behavior. Section anchors clear the sticky header, and reduced
// motion removes transitions outright (the global rule only shortens them to 1ms).
const landingShell = [
  'bg-background text-foreground [-webkit-tap-highlight-color:transparent] [&_*]:min-w-0',
  '[&_section[id]]:scroll-mt-[calc(var(--header-h)+2rem)]',
  'motion-reduce:[&_*]:![animation:none] motion-reduce:[&_*]:![transition:none]',
].join(' ');

export default function Home() {
  return (
    <div className={landingShell}>
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-[150%] border border-border-strong bg-signal px-4 py-3 font-semibold text-signal-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
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
