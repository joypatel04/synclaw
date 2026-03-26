export type LandingBandTokens = {
  base: string;
  surface: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  dim: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
};

export type LandingTheme = {
  dark: LandingBandTokens & {
    emerald: string;
    amber: string;
  };
  light: LandingBandTokens;
  transitions: {
    darkToLight: string;
    lightToDark: string;
  };
};

export const landingTheme: LandingTheme = {
  dark: {
    base: "#06080F",
    surface: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.09)",
    borderStrong: "rgba(255,255,255,0.16)",
    text: "#E8EDFF",
    muted: "#9AA3C2",
    dim: "#62708F",
    accent: "#6D5CFF",
    accentSoft: "rgba(109,92,255,0.14)",
    accentGlow: "rgba(109,92,255,0.30)",
    emerald: "#10C895",
    amber: "#FFB95B",
  },
  light: {
    base: "#F5F7FC",
    surface: "rgba(255,255,255,0.72)",
    border: "rgba(8,20,50,0.12)",
    borderStrong: "rgba(8,20,50,0.22)",
    text: "#0C1328",
    muted: "#4E5B80",
    dim: "#7E8BAD",
    accent: "#4E56E6",
    accentSoft: "rgba(78,86,230,0.12)",
    accentGlow: "rgba(78,86,230,0.20)",
  },
  transitions: {
    darkToLight:
      "linear-gradient(180deg, #06080F 0%, #151A40 42%, #8DA3FF 68%, #F5F7FC 100%)",
    lightToDark:
      "linear-gradient(180deg, #F5F7FC 0%, #D8DFFC 28%, #1C2248 60%, #06080F 100%)",
  },
};

export type HeroCarouselPalette = {
  surface: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDim: string;
  text: string;
  muted: string;
  dim: string;
  emerald: string;
  amber: string;
};

export function toHeroCarouselPalette(
  theme: LandingTheme,
): HeroCarouselPalette {
  return {
    surface: theme.dark.surface,
    border: theme.dark.border,
    borderStrong: theme.dark.borderStrong,
    accent: theme.dark.accent,
    accentDim: theme.dark.accentSoft,
    text: theme.dark.text,
    muted: theme.dark.muted,
    dim: theme.dark.dim,
    emerald: theme.dark.emerald,
    amber: theme.dark.amber,
  };
}
