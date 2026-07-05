export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* Exact mark extracted from chickenandy.vercel.app (gold chick on a rounded tile). */}
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <defs>
          <linearGradient id="ca-mark-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F0D680" />
            <stop offset="1" stopColor="#E3B23C" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#ca-mark-g)" />
        <g fill="#1A1206">
          <circle cx="23.5" cy="17" r="4" />
          <circle cx="30.5" cy="13.5" r="4.6" />
          <circle cx="37.5" cy="16.5" r="4.1" />
          <circle cx="30" cy="34" r="15.5" />
          <path d="M43 29.5 L56 34 L43 39 Z" />
          <circle cx="43.5" cy="42.5" r="3.6" />
        </g>
        <circle cx="34.5" cy="30" r="3.5" fill="#fff" />
        <circle cx="35.4" cy="30.4" r="1.5" fill="#1A1206" />
      </svg>
      <span className="font-display text-lg font-black tracking-tight leading-none">
        <span className="text-ink">CHICKEN</span>
        <span className="text-accent">ANDY</span>
      </span>
    </span>
  );
}
