import { useEffect, useMemo, useState } from "react";
import { Globe, Play, Star, GitFork, Eye } from "lucide-react";

const getYoutubeId = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.slice(1) || null;
    if (host.endsWith("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.match(/^\/(?:embed|shorts|v)\/([^/]+)/)?.[1];
      return id || null;
    }
  } catch {
    return null;
  }
  return null;
};

const getGithubRepo = (url) => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "github.com") return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
};

const LinkPreviewCard = ({ url }) => {
  const [preview, setPreview] = useState(null);
  const [repoInfo, setRepoInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const youtubeId = useMemo(() => getYoutubeId(url), [url]);
  const githubRepo = useMemo(() => getGithubRepo(url), [url]);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setRepoInfo(null);
    setLoading(!youtubeId && !githubRepo);

    if (youtubeId || !githubRepo) {
      if (youtubeId) return () => { active = false; };
      fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
        .then((res) => res.json())
        .then((data) => {
          if (active && data.status === "success" && data.data) setPreview(data.data);
        })
        .catch(() => setPreview(null))
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

    (async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${githubRepo.owner}/${githubRepo.repo}`);
        if (!res.ok) throw new Error("GitHub lookup failed");
        const data = await res.json();
        if (active) {
          setRepoInfo({
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.subscribers_count ?? data.watchers_count,
            language: data.language,
            description: data.description,
          });
        }
      } catch {
        try {
          const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
          const data = await res.json();
          if (active && data.status === "success" && data.data) setPreview(data.data);
        } catch {
          setPreview(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [url, youtubeId, githubRepo]);

  if (youtubeId) {
    return (
      <div className="mt-2 w-full max-w-[280px] overflow-hidden rounded-xl border border-base-300 bg-base-100">
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            title="YouTube video"
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 px-2.5 py-2 text-[11px] text-base-content/70 hover:bg-base-200 transition-colors"
        >
          <span className="font-semibold text-red-500">YouTube</span>
          <span className="truncate">Open in YouTube</span>
        </a>
      </div>
    );
  }

  if (githubRepo) {
    const formatCount = (n) => (typeof n === "number" ? (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n)) : null);
    const stars = formatCount(repoInfo?.stars);
    const forks = formatCount(repoInfo?.forks);
    const watchers = formatCount(repoInfo?.watchers);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 w-full max-w-[280px] rounded-xl border border-base-300 bg-base-100 p-2.5 hover:bg-base-200 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-base-300 text-[10px] font-bold text-base-content shrink-0">
            GH
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-primary truncate">
              {githubRepo.owner}/{githubRepo.repo}
            </span>
            <span className="block text-[10px] text-base-content/50 truncate">
              {loading ? "Loading repository..." : "GitHub repository"}
            </span>
          </span>
        </span>
        {repoInfo?.description && (
          <span className="block mt-2 text-[11px] leading-snug line-clamp-2 text-base-content/70">
            {repoInfo.description}
          </span>
        )}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {repoInfo?.language && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {repoInfo.language}
            </span>
          )}
          {stars && (
            <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[10px] text-base-content/70">
              <Star size={10} className="fill-current" /> {stars}
            </span>
          )}
          {forks && (
            <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[10px] text-base-content/70">
              <GitFork size={10} /> {forks}
            </span>
          )}
          {watchers && (
            <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-[10px] text-base-content/70">
              <Eye size={10} /> {watchers}
            </span>
          )}
        </span>
        {!repoInfo && !loading && preview?.description && (
          <span className="block mt-2 text-[11px] leading-snug line-clamp-2 text-base-content/70">
            {preview.description}
          </span>
        )}
      </a>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 mt-2 p-2.5 border rounded-xl animate-pulse w-full max-w-[280px] select-none">
        <div className="w-10 h-10 bg-base-300 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <div className="h-3 bg-base-300 rounded w-3/4" />
          <div className="h-2.5 bg-base-300 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!preview) {
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = url;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-2 p-2 hover:bg-base-200 border border-base-300 rounded-lg transition-colors text-left w-full max-w-[280px] text-xs"
      >
        <Globe size={16} className="text-primary shrink-0" />
        <span className="truncate font-medium text-primary underline">{hostname}</span>
      </a>
    );
  }

  const { title, description, image, logo, publisher } = preview;
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    hostname = publisher || "Link";
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col mt-2 hover:bg-base-200 border border-base-300 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left w-full max-w-[280px] group block"
    >
      {image?.url && (
        <div className="relative w-full h-32 overflow-hidden bg-base-300">
          <img
            src={image.url}
            alt={title || "Preview Card"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-2.5 select-none space-y-1">
        <div className="flex items-center gap-1.5">
          {logo?.url ? (
            <img src={logo.url} alt="Logo" className="w-3.5 h-3.5 object-contain rounded" />
          ) : (
            <Globe size={12} className="text-primary" />
          )}
          <span className="text-[10px] font-semibold truncate uppercase tracking-wider">{hostname}</span>
        </div>
        {title && (
          <h4 className="text-xs font-bold text-base-content leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h4>
        )}
        {description && <p className="text-[11px] leading-snug line-clamp-2">{description}</p>}
      </div>
    </a>
  );
};

export default LinkPreviewCard;
