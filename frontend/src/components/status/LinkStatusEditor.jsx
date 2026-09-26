import { useState } from "react";
import { Link2, ExternalLink, Globe, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { haptic } from "../../lib/haptics";

/**
 * A link, as a card.
 *
 * Only `http` and `https` are accepted, and the scheme is checked before the
 * value is stored, not just before it is rendered. `javascript:` in an href is
 * a stored script execution the moment anyone opens the status, and
 * `data:text/html` is the same thing wearing a different hat — so the
 * validation has to happen at the edge where the string first arrives.
 */
const normaliseUrl = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return { ok: false, reason: "Enter a link" };

  // A bare "example.com" is what people actually type, so it is not rejected
  // for being unhelpful — but it is normalised through the parser rather than
  // string-concatenated, so there is exactly one place a scheme can appear.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "That is not a valid link" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http and https links can be shared" };
  }
  if (!url.hostname.includes(".")) {
    return { ok: false, reason: "That does not look like a web address" };
  }
  return { ok: true, url };
};

const hostOf = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

const LinkStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("link");

  const [raw, setRaw] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const preview = () => {
    const result = normaliseUrl(raw);
    if (!result.ok) {
      haptic("error");
      setError(result.reason);
      return;
    }
    setError("");
    setUrl(result.url.href);
    if (!title.trim()) {
      setTitle(
        result.url.pathname === "/"
          ? hostOf(result.url.href)
          : decodeURIComponent(result.url.pathname.replace(/\/$/, "").split("/").pop() || "")
      );
    }
    haptic("tap");
  };

  const handlePost = async () => {
    const result = url ? { ok: true, url: new URL(url) } : normaliseUrl(raw);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "link",
          link: {
            url: result.url.href,
            title: title.trim() || hostOf(result.url.href),
            description: note.trim(),
            domain: result.url.hostname.replace(/^www\./, ""),
          },
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
          mentions: editor.mentions,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } finally {
      editor.setPosting(false);
    }
  };

  const canPost = Boolean(url || normaliseUrl(raw).ok);
  const host = url ? hostOf(url) : raw.trim() ? raw.trim().replace(/^https?:\/\//, "").split("/")[0] : "";

  return (
    <>
      <StatusEditorShell
        title="Link"
        onClose={onClose}
        onDiscard={raw.trim() ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={canPost}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        <div className="px-4 pt-4">
          <div className="relative">
            <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError("");
                if (url) setUrl("");
              }}
              onKeyDown={(e) => e.key === "Enter" && preview()}
              placeholder="Paste a link"
              className="field-flat w-full h-12 pl-10 pr-3 rounded-2xl bg-base-200 text-sm border-0"
            />
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          {/* Preview card. Rendered from what the author typed, not fetched:
              preview scraping would mean this app fetching a page the author
              never opened, and the card would be blank whenever it failed. */}
          {(url || raw.trim()) && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-base-200 bg-base-100">
              <div className="h-28 bg-base-200 flex items-center justify-center">
                {url ? (
                  <Globe size={28} className="text-base-content/25" />
                ) : (
                  <span className="text-[11px] text-base-content/40">Press enter to preview</span>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-[11px] text-primary font-medium truncate">
                  {host || "example.com"}
                </p>
                <p className="text-sm font-semibold text-base-content mt-0.5 line-clamp-2 break-words">
                  {title.trim() || (url ? hostOf(url) : "Link preview")}
                </p>
                {note.trim() && (
                  <p className="text-xs text-base-content/55 mt-1 line-clamp-3 break-words">
                    {note.trim()}
                  </p>
                )}
              </div>
            </div>
          )}

          {url && (
            <div className="mt-4 space-y-2.5">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Title"
                className="field-flat w-full h-11 px-3.5 rounded-2xl bg-base-200 text-sm border-0"
              />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Say something about it... (optional)"
                className="field-flat w-full px-3.5 py-3 rounded-2xl bg-base-200 text-sm border-0 resize-none"
              />
            </div>
          )}
        </div>

        <div className="px-4 py-4 flex items-center gap-2 text-[11px] text-base-content/40">
          <Sparkles size={13} className="flex-shrink-0" />
          <span>The link opens outside Chatty, in your browser.</span>
        </div>
      </StatusEditorShell>

      {editor.privacyOpen && (
        <PrivacySheet
          open
          onClose={() => editor.setPrivacyOpen(false)}
          privacy={editor.privacy}
          onChange={editor.setPrivacy}
        />
      )}
      {editor.scheduleOpen && (
        <ScheduleSheet
          open
          onClose={() => editor.setScheduleOpen(false)}
          scheduledFor={editor.scheduledFor}
          onChange={editor.setScheduledFor}
        />
      )}
    </>
  );
};

export default LinkStatusEditor;
export { normaliseUrl };
