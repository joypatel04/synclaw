import { cn } from "@/lib/utils";

export function SynClawMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      aria-hidden
      className={cn("h-6 w-8", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>SynClaw mark</title>
      <defs>
        <linearGradient
          id="synclaw-left"
          x1="8"
          y1="6"
          x2="30"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9BA8CB" />
          <stop offset="1" stopColor="#5D6B92" />
        </linearGradient>
        <linearGradient
          id="synclaw-right"
          x1="56"
          y1="6"
          x2="34"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C0CAE0" />
          <stop offset="1" stopColor="#7280A5" />
        </linearGradient>
        <linearGradient
          id="synclaw-sync"
          x1="24"
          y1="18"
          x2="40"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8D7CFF" />
          <stop offset="1" stopColor="#63CFFF" />
        </linearGradient>
      </defs>

      <g opacity="0.98">
        <path
          d="M8 24C8 14.6 15.6 7 25 7H29.5C25.4 10.1 22.8 14.9 22.8 20.3C22.8 25.8 25.4 30.4 29.5 33.6H25C15.6 33.6 8 26 8 24Z"
          fill="url(#synclaw-left)"
        />
        <path
          d="M56 24C56 14.6 48.4 7 39 7H34.5C38.6 10.1 41.2 14.9 41.2 20.3C41.2 25.8 38.6 30.4 34.5 33.6H39C48.4 33.6 56 26 56 24Z"
          fill="url(#synclaw-right)"
        />
      </g>

      <g>
        <path
          d="M26 20.8C27.4 18.6 29.9 17.2 32.7 17.2C35.3 17.2 37.7 18.5 39.1 20.5"
          stroke="url(#synclaw-sync)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M38.9 20.4L38.2 17.8L40.9 18.5"
          stroke="url(#synclaw-sync)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M38 27.2C36.5 29.4 34.1 30.8 31.3 30.8C28.7 30.8 26.3 29.5 24.9 27.5"
          stroke="url(#synclaw-sync)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M25.1 27.6L25.8 30.2L23.1 29.5"
          stroke="url(#synclaw-sync)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <path
        d="M22.8 20.4C22.8 14.4 27.7 9.6 33.7 9.6"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M41.2 20.4C41.2 14.4 36.3 9.6 30.3 9.6"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
