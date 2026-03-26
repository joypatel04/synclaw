export function TransitionBand({
  direction,
}: {
  direction: "darkToLight" | "lightToDark";
}) {
  const isDarkToLight = direction === "darkToLight";

  return (
    <div
      className="relative h-[20vh] min-h-32 w-full overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background: isDarkToLight
            ? "var(--landing-transition-dark-light)"
            : "var(--landing-transition-light-dark)",
        }}
      />
      <div
        className="absolute inset-0 opacity-45"
        style={{
          background: isDarkToLight
            ? "radial-gradient(110% 70% at 50% 100%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 68%)"
            : "radial-gradient(110% 70% at 50% 0%, rgba(25,31,56,0.32) 0%, rgba(25,31,56,0) 68%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isDarkToLight
            ? "linear-gradient(180deg, rgba(8,11,20,0.24) 0%, rgba(8,11,20,0.03) 34%, rgba(245,247,252,0.03) 68%, rgba(245,247,252,0.18) 100%)"
            : "linear-gradient(180deg, rgba(245,247,252,0.20) 0%, rgba(245,247,252,0.03) 34%, rgba(8,11,20,0.03) 68%, rgba(8,11,20,0.22) 100%)",
        }}
      />
    </div>
  );
}
