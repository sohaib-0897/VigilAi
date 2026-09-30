import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom design tokens from tailwind.config.ts;
// otherwise `text-label` is mistaken for a colour and `shadow-hard-1` for a
// shadow colour, and conflicting classes are merged incorrectly.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-xl", "display-lg", "display-md", "heading", "title", "body-lg", "body", "body-sm", "table", "caption", "telemetry", "label", "micro"] }],
      shadow: [{ shadow: ["hard-1", "hard-2", "hard-3", "overlay"] }],
      "border-w": [{ border: ["hair", "heavy"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
