import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Same type pairing as apps/web (index.css).
export const { fontFamily: displayFont } = loadBricolage("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});
export const { fontFamily: bodyFont } = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

// "Lamplight Forest", matching apps/web/src/index.css: a night forest lit by one warm
// lamp. Lamp amber is the primary accent, moss green the secondary.
export const colors = {
  night: "#0e1411",
  cyc: "#e6dcc4",
  ink: "#16201b",
  text: "#f6f3ea",
  muted: "#9ea596",
  faint: "rgba(246,243,234,0.5)",
  hairline: "rgba(255,255,255,0.12)",
  lamp: "#f4b94e",
  lampDeep: "#e9a03a",
  moss: "#b3d993",
  miss: "#ec7a5f",
};

export const accentGradient = "linear-gradient(180deg, #f8cf72, #e9a03a)";
export const ease = [0.16, 1, 0.3, 1] as const; // expo-out, for entrances
export const glide = [0.65, 0, 0.35, 1] as const; // in-out, for camera moves
