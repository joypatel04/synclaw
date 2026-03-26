export function TransitionBand({
  direction,
}: {
  direction: "darkToLight" | "lightToDark";
}) {
  return (
    <div
      className="h-[24vh] min-h-40 w-full"
      style={{
        background:
          direction === "darkToLight"
            ? "var(--landing-transition-dark-light)"
            : "var(--landing-transition-light-dark)",
      }}
      aria-hidden
    />
  );
}
