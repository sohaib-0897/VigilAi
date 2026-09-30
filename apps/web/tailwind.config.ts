import type { Config } from "tailwindcss";

// Every colour resolves to a CSS variable in src/app/globals.css so paper
// (light) and optical (dark / .surface-optical) surfaces share one vocabulary.
const token = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const typeRole = (size: string, lineHeight: string, letterSpacing = "0em", fontWeight?: string) =>
  [size, fontWeight ? { lineHeight, letterSpacing, fontWeight } : { lineHeight, letterSpacing }] as [
    string,
    { lineHeight: string; letterSpacing: string; fontWeight?: string },
  ];

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // lib/status.ts holds the tone → class maps used by StatusIndicator and badges.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        surface: { DEFAULT: token("surface"), foreground: token("surface-foreground") },
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground") },
        secondary: { DEFAULT: token("secondary"), foreground: token("secondary-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: { DEFAULT: token("accent"), foreground: token("accent-foreground") },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        inactive: token("inactive"),
        border: { DEFAULT: token("border"), strong: token("border-strong") },
        input: token("input"),
        ring: token("ring"),

        // Operational palette — reserved for state, never decoration.
        signal: { DEFAULT: token("signal"), foreground: token("signal-foreground"), ink: token("signal-ink") },
        track: { DEFAULT: token("track"), foreground: token("track-foreground"), ink: token("track-ink") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground"), ink: token("success-ink") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground"), ink: token("warning-ink") },
        danger: { DEFAULT: token("danger"), foreground: token("danger-foreground"), ink: token("danger-ink") },
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "display-xl": typeRole("var(--text-display-xl)", "0.86", "-0.045em", "800"),
        "display-lg": typeRole("var(--text-display-lg)", "0.9", "-0.04em", "800"),
        "display-md": typeRole("var(--text-display-md)", "0.98", "-0.03em", "700"),
        heading: typeRole("var(--text-heading)", "1.08", "-0.02em", "700"),
        title: typeRole("var(--text-title)", "1.3", "-0.01em", "600"),
        "body-lg": typeRole("var(--text-body-lg)", "1.6"),
        body: typeRole("var(--text-body)", "1.6"),
        "body-sm": typeRole("var(--text-body-sm)", "1.55"),
        table: typeRole("var(--text-table)", "1.45"),
        caption: typeRole("var(--text-caption)", "1.45", "0.01em"),
        telemetry: typeRole("var(--text-telemetry)", "1.4", "0.01em"),
        label: typeRole("var(--text-label)", "1.4", "0.08em", "500"),
        micro: typeRole("var(--text-micro)", "1.35", "0.08em", "500"),
      },
      spacing: {
        gutter: "var(--gutter)",
        section: "var(--section)",
        "section-dense": "var(--section-dense)",
        "section-atmos": "var(--section-atmos)",
        header: "var(--header-h)",
      },
      maxWidth: {
        content: "var(--content)",
        "content-wide": "var(--content-wide)",
        "content-narrow": "var(--content-narrow)",
        measure: "var(--measure)",
      },
      borderWidth: {
        hair: "var(--rule-hair)",
        heavy: "var(--rule-heavy)",
      },
      borderRadius: {
        none: "0px",
        DEFAULT: "var(--radius)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-xs)",
        md: "var(--radius-sm)",
        lg: "var(--radius-sm)",
        full: "9999px",
      },
      boxShadow: {
        "hard-1": "var(--shadow-hard-1)",
        "hard-2": "var(--shadow-hard-2)",
        "hard-3": "var(--shadow-hard-3)",
        overlay: "var(--shadow-overlay)",
      },
      transitionDuration: {
        micro: "var(--dur-micro)",
        ui: "var(--dur-ui)",
        section: "var(--dur-section)",
        cinematic: "var(--dur-cinematic)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        acquire: "var(--ease-acquire)",
        mechanical: "var(--ease-mechanical)",
        exit: "var(--ease-exit)",
      },
      keyframes: {
        "signal-blink": { "0%, 100%": { opacity: "1" }, "50%": { opacity: ".25" } },
      },
      animation: {
        "signal-blink": "signal-blink 1.6s var(--ease-mechanical) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
