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

// A restrained cut of the site's "Neon Night" palette: near-black, soft lavender
// whites, and the violet → pink gradient reserved for accents.
export const colors = {
  night: "#08061a",
  cyc: "#d9d4ec",
  text: "#f5f3ff",
  muted: "#a5a0c8",
  faint: "rgba(245,243,255,0.5)",
  hairline: "rgba(255,255,255,0.12)",
  violet: "#8b5cf6",
  pink: "#ec4899",
  cyan: "#67e8f9",
  miss: "#fb7185",
};

export const accentGradient = "linear-gradient(100deg, #8b5cf6, #d946ef 55%, #ec4899)";
export const ease = [0.16, 1, 0.3, 1] as const; // expo-out, for entrances
export const glide = [0.65, 0, 0.35, 1] as const; // in-out, for camera moves
