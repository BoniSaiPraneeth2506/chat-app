import { useEffect, useRef, useState } from "react";
import { Music4, Play, Pause, Search, X, Upload, ImagePlus } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  uploadStatusFile,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import { haptic } from "../../lib/haptics";

/**
 * iTunes Search, used as a catalogue.
 *
 * This is a lookup, not a download. "Add music" is for putting a named track
 * behind a status — the clip is the author's own upload, chosen with the file
 * picker, so this app is not redistributing anybody's audio. Keeping the two
 * apart also means the preview here is genuinely the song they picked: a search
 * result gives you a 30-second preview of a different master, which is how
 * people end up posting the wrong song.
 *
 * Nothing is sent anywhere: the title, artist, and artwork are stored so the
 * card can label itself without a lookup on the viewer's device.
 */
const searchMusic = async (term, signal) => {
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=20&term=${encodeURIComponent(
    term
  )}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Search failed");
  const data = await res.json();
  return (data?.results || []).map((track) => ({
    id: track.trackId,
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    artwork: track.artworkUrl100?.replace("100x100", "300x300") || "",
    previewUrl: track.previewUrl || "",
  }));
};

const MusicStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("music");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [track, setTrack] = useState(null);
  const [clip, setClip] = useState(null); // { file, url, duration }
  const [artworkFile, setArtworkFile] = useState(null);
  const [artworkUrl, setArtworkUrl] = useState("");
  const [background, setBackground] = useState("linear-gradient(135deg, #7f00ff, #e100ff)");

  const audioRef = useRef(null);
  const previewRef = useRef(null);
  const [playing, setPlaying] = useState("");
  const clipInputRef = useRef(null);
  const artworkInputRef = useRef(null);
  const abortRef = useRef(null);

  // One effect per resource, each releasing only its own previous value.
  //
  // A single effect over [clip, artworkUrl] that revoked both looked equivalent
  // and was not: choosing the artwork re-ran the cleanup, which revoked the clip
  // that was still on screen, and the audio preview went dead. Split this way
  // each cleanup can only ever touch the value it is responsible for, and it
  // still runs on unmount, which is the case that actually matters for a sheet
  // the author can dismiss at any moment.
  useEffect(
    () => () => {
      if (clip?.url) URL.revokeObjectURL(clip.url);
    },
    [clip]
  );
  useEffect(
    () => () => {
      if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    },
    [artworkUrl]
  );
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  // Search as the author types, but only once they have stopped: one request
  // per keystroke is a good way to get rate-limited and to show results for a
  // prefix they have already moved past.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearchError("");
      return undefined;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const found = await searchMusic(term, controller.signal);
        setResults(found);
        setSearchError("");
      } catch (err) {
        if (err?.name !== "AbortError") setSearchError("Could not search right now");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const chooseTrack = (candidate) => {
    haptic("tap");
    // Choosing a different track invalidates the clip picked for the old one.
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip(null);
    setTrack(candidate);
    if (artworkUrl) {
      URL.revokeObjectURL(artworkUrl);
      setArtworkUrl("");
    }
    setArtworkFile(null);
  };

  const pickClip = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("That is not an audio file");
      return;
    }
    haptic("tap");
    if (clip?.url) URL.revokeObjectURL(clip.url);
    setClip({ file, url: URL.createObjectURL(file), duration: 0 });
  };

  const pickArtwork = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file?.type?.startsWith("image/")) return;
    if (artworkUrl) URL.revokeObjectURL(artworkUrl);
    setArtworkFile(file);
    setArtworkUrl(URL.createObjectURL(file));
  };

  const togglePlay = (which) => {
    const el = which === "clip" ? audioRef.current : previewRef.current;
    if (!el) return;
    if (playing === which) {
      el.pause();
      setPlaying("");
      return;
    }
    (which === "clip" ? previewRef.current : audioRef.current)?.pause();
    el.play().catch(() => toast.error("Could not play that"));
    setPlaying(which);
  };

  const handlePost = async () => {
    if (!clip) return;
    editor.setPosting(true);
    editor.setProgress(0);

    try {
      const audio = await uploadStatusFile(clip.file, { onProgress: editor.setProgress });

      let albumArtKey = "";
      if (artworkFile) {
        const uploaded = await uploadStatusFile(artworkFile, { onProgress: editor.setProgress });
        albumArtKey = uploaded.key;
      }

      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "music",
          music: {
            // `key` is the author's own clip. The iTunes result only labels it.
            key: audio.key,
            contentType: audio.mime,
            size: audio.size,
            duration: clip.duration,
            title: track?.title || clip.file.name.replace(/\.[^.]+$/, ""),
            artist: track?.artist || "",
            albumArtKey,
          },
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
          mentions: editor.mentions,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } catch (err) {
      toast.error(err?.message || "Failed to post status");
    } finally {
      editor.setPosting(false);
    }
  };

  const artwork = artworkUrl || track?.artwork || "";
  const canPost = Boolean(clip);

  return (
    <>
      <StatusEditorShell
        title="Add music"
        onClose={onClose}
        onDiscard={canPost ? editor.discardDraft : null}
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
        {/* Now-playing card */}
        <div className="px-4 pt-4">
          <div
            className="relative rounded-3xl overflow-hidden p-5 min-h-[180px] flex items-end"
            style={{ background }}
          >
            {artwork && (
              <img src={artwork} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

            <div className="relative w-full">
              <div className="flex items-end gap-3">
                <div className="size-20 rounded-2xl overflow-hidden bg-black/30 flex-shrink-0 grid place-items-center">
                  {artwork ? (
                    <img src={artwork} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music4 size={26} className="text-white/50" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-white/90 text-[15px] font-semibold truncate">
                    {track?.title || (clip ? clip.file.name : "No track chosen")}
                  </p>
                  <p className="text-white/60 text-xs truncate">{track?.artist || "Pick an audio file"}</p>
                </div>

                <button
                  onClick={() => togglePlay("clip")}
                  disabled={!clip}
                  className="size-11 rounded-full bg-white/20 backdrop-blur text-white grid place-items-center disabled:opacity-40 transition-colors"
                  aria-label={playing === "clip" ? "Pause clip" : "Play clip"}
                >
                  {playing === "clip" ? <Pause size={19} /> : <Play size={19} fill="currentColor" />}
                </button>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => clipInputRef.current?.click()}
                  className="flex-1 h-9 rounded-xl bg-white/15 backdrop-blur text-xs font-medium text-white flex items-center justify-center gap-1.5 hover:bg-white/25 transition-colors"
                >
                  <Upload size={13} />
                  {clip ? "Change clip" : "Choose clip"}
                </button>
                <button
                  onClick={() => artworkInputRef.current?.click()}
                  className="h-9 px-3 rounded-xl bg-white/15 backdrop-blur text-white flex items-center justify-center hover:bg-white/25 transition-colors"
                  aria-label="Cover art"
                >
                  {artworkFile ? <X size={14} onClick={() => { if (artworkUrl) URL.revokeObjectURL(artworkUrl); setArtworkFile(null); setArtworkUrl(""); }} /> : <ImagePlus size={14} />}
                </button>
              </div>

              {track?.previewUrl && (
                <button
                  onClick={() => togglePlay("preview")}
                  className="mt-2 text-[11px] text-white/60 underline underline-offset-2 hover:text-white/90 transition-colors"
                >
                  {playing === "preview" ? "Pause song preview" : "Hear the song preview"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-4">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/35" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs and artists..."
              className="field-flat w-full h-11 pl-10 pr-9 rounded-2xl bg-base-200 text-sm border-0"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-base-300"
                aria-label="Clear search"
              >
                <X size={14} className="text-base-content/50" />
              </button>
            )}
          </div>

          {track && (
            <div className="mt-3 flex items-center gap-3 p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
              {track.artwork && <img src={track.artwork} alt="" className="size-10 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-base-content truncate">{track.title}</p>
                <p className="text-[11px] text-base-content/55 truncate">{track.artist}</p>
              </div>
              <button
                onClick={() => setTrack(null)}
                className="p-1.5 rounded-full hover:bg-base-300"
                aria-label="Remove track"
              >
                <X size={14} className="text-base-content/50" />
              </button>
            </div>
          )}

          {searching && (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="size-11 rounded-xl bg-base-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-base-200 w-1/2" />
                    <div className="h-2.5 rounded bg-base-200 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && searchError && (
            <p className="mt-3 text-xs text-red-500">{searchError}</p>
          )}

          {!searching && !searchError && results.length > 0 && (
            <ul className="mt-3 space-y-1">
              {results.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    onClick={() => chooseTrack(candidate)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${
                      track?.id === candidate.id ? "bg-primary/10" : "hover:bg-base-200"
                    }`}
                  >
                    {candidate.artwork && (
                      <img src={candidate.artwork} alt="" loading="lazy" className="size-11 rounded-xl object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-base-content truncate">{candidate.title}</p>
                      <p className="text-[11px] text-base-content/55 truncate">{candidate.artist}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!searching && !searchError && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-3 text-xs text-base-content/45 text-center py-4">
              No songs found for “{query.trim()}”
            </p>
          )}
        </div>

        {/* Backgrounds */}
        <div className="px-4 pb-4">
          <p className="text-[11px] uppercase tracking-wide text-base-content/40 mb-2">Background</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {[
              "linear-gradient(135deg, #7f00ff, #e100ff)",
              "linear-gradient(135deg, #f857a6, #ff5858)",
              "linear-gradient(135deg, #2193b0, #6dd5ed)",
              "linear-gradient(135deg, #134e5e, #71b280)",
              "linear-gradient(135deg, #f59e0b, #ef4444)",
              "linear-gradient(135deg, #0f2027, #2c5364)",
            ].map((css) => (
              <button
                key={css}
                onClick={() => {
                  haptic("tap");
                  setBackground(css);
                }}
                className={`size-9 rounded-xl flex-shrink-0 border-2 transition-transform ${
                  background === css ? "border-primary scale-105" : "border-transparent"
                }`}
                style={{ background: css }}
                aria-label="Background"
              />
            ))}
          </div>
        </div>

        <input ref={clipInputRef} type="file" accept="audio/*" onChange={pickClip} className="hidden" />
        <input ref={artworkInputRef} type="file" accept="image/*" onChange={pickArtwork} className="hidden" />

        {clip && <audio ref={audioRef} src={clip.url} onEnded={() => setPlaying("")} className="hidden" />}
        {track?.previewUrl && (
          <audio ref={previewRef} src={track.previewUrl} onEnded={() => setPlaying("")} className="hidden" />
        )}
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

export default MusicStatusEditor;
