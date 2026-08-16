import { getFilledSocialLinks } from "../lib/social";

// Read-only renderer for a user's social/portfolio links. Shared by the
// profile page and the contact-info panel so both stay in sync.
//
// External links stay plain `<a target="_blank">`: Capacitor's WebView routes
// those out to the system browser on Android, which is the same behaviour the
// existing website link already relies on — no native plugin needed.
const SocialLinksRow = ({ user, variant = "list", emptyText = "No social links added yet" }) => {
  const links = getFilledSocialLinks(user);

  if (links.length === 0) {
    return <span className="text-zinc-500 italic text-sm">{emptyText}</span>;
  }

  if (variant === "icons") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {links.map(({ key, label, icon: Icon, colorClass, href }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className="p-2 rounded-full bg-base-200 border border-base-300/40 hover:bg-base-300 hover:scale-105 transition-all shadow-sm"
          >
            <Icon size={16} className={colorClass} />
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {links.map(({ key, label, icon: Icon, colorClass, href, handle }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-base-200/50 border border-base-300/30 hover:bg-base-200 transition-colors group"
        >
          <Icon size={15} className={`${colorClass} flex-shrink-0`} />
          <span className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/40 leading-none">
              {label}
            </span>
            <span className="text-xs text-base-content/80 truncate group-hover:text-primary transition-colors mt-0.5">
              {handle}
            </span>
          </span>
        </a>
      ))}
    </div>
  );
};

export default SocialLinksRow;
