export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        aria-hidden
        className="grid place-items-center h-8 w-8 rounded-lg bg-accent text-accent-ink shadow-[0_0_16px_-4px_var(--color-accent)]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M14.5 3.2c1.7 0 3 1.3 3 3 0 .5-.1 1-.3 1.4l1.9.8c.5.2.8.8.5 1.3l-1 1.9c1 1.2 1.6 2.7 1.6 4.4 0 .9-.7 1.6-1.6 1.6H6.2c-1.8 0-3.3-1.5-3.3-3.3 0-2.6 1.7-4.8 4-5.6.2-2.9 2.3-5.2 5-5.7-.1.2-.1.4-.1.6 0 .9.7 1.6 1.6 1.6.2 0 .3 0 .5-.1-.5.9-1.4 1.5-2.4 1.6.9.3 1.6 1 2 1.9.3-.3.5-.7.5-1.2 0-.9-.7-1.6-1.6-1.6z" />
          <circle cx="14.6" cy="6.1" r="1" fill="var(--color-accent-ink)" />
        </svg>
      </span>
      <span className="font-display text-xl font-extrabold tracking-tight leading-none">
        <span className="text-ink">CHICKEN</span>
        <span className="text-accent">ANDY</span>
      </span>
    </span>
  );
}
