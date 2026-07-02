export default function PagePlaceholder({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-accent">
        {eyebrow}
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold uppercase sm:text-4xl">{title}</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-dim">{children}</div>
    </div>
  );
}
