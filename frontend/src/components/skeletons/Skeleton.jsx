/**
 * Skeleton primitives.
 *
 * The lists this app loads — statuses, groups, channels — each have their own
 * shape, but they should all shimmer the same way. Every block here is a
 * themed `skeleton` (daisyui's pulse over the app's own base-200/base-300), so
 * a loading screen reads as the same material as the loaded one rather than as
 * a spinner floating in a different app.
 */

/** A single shimmering block. `className` carries the shape and size. */
export const Block = ({ className = "" }) => (
  <div className={`skeleton bg-base-200 ${className}`} />
);

/** A shimmering circle — or `shape="rounded-2xl"` for the squarer avatars. */
export const Circle = ({ className = "", shape = "rounded-full" }) => (
  <div className={`skeleton ${shape} bg-base-200 ${className}`} />
);

/**
 * One list row: avatar plus two lines of text, the shape every row in this app
 * has. `pad` matches the row it stands in for, so a skeleton list lines up with
 * the real one the moment the data lands.
 */
export const RowSkeleton = ({ shape = "rounded-full", pad = "px-4" }) => (
  <div className={`w-full py-3.5 ${pad} flex items-center gap-3`}>
    <Circle className="size-12 flex-shrink-0" shape={shape} />
    <div className="flex-1 min-w-0">
      <Block className="h-3.5 w-2/5 rounded-full mb-2" />
      <Block className="h-2.5 w-3/5 rounded-full" />
    </div>
  </div>
);

/**
 * Placeholder status cards. They reuse the real `.status-card` class, so the
 * strip is already the right size and shape on the first paint and nothing
 * jumps when the statuses arrive.
 */
export const StatusCardsSkeleton = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="status-card status-card-skeleton" aria-hidden="true">
        <div className="absolute inset-0 skeleton bg-base-200" />
        <div className="absolute left-2 top-2 size-8 rounded-full skeleton bg-base-300" />
        <div className="absolute left-2 bottom-2 right-6 h-2.5 rounded-full skeleton bg-base-300" />
      </div>
    ))}
  </>
);
