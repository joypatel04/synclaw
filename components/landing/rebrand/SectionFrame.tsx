import { cn } from "@/lib/utils";

export function SectionFrame({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}
    >
      {children}
    </section>
  );
}
