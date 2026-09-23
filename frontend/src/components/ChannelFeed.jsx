import { useEffect, useMemo, useRef, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import { getWallpaperStyle } from "../pages/SettingsPage";
import {
  ArrowLeft, Send, Image as ImageIcon, X, Heart, MessageSquare, Pin,
  Trash2, Megaphone, Users, Link as LinkIcon, Bell, BellOff, MoreVertical,
  Loader2, Eye, Pencil, ShieldCheck, Share2, CornerUpRight, Sparkles, Smile
} from "lucide-react";
import toast from "react-hot-toast";
import { uploadAttachment } from "../lib/attachments";
import { formatMessageTime } from "../lib/utils";
import CreateChannelModal from "./CreateChannelModal";

const REACTIONS = ["❤️", "👍", "🔥", "😂", "😮", "😢"];

const ChannelFeed = () => {
  const {
    selectedChannel,
    posts,
    isPostsLoading,
    createPost,
    deletePost,
    pinPost,
    reactToPost,
    viewPost,
    unfollowChannel,
    muteChannel,
    reportChannel,
    generateInvite,
    revokeInvite,
    closeChannel,
    openChannelInfo,
    openEditChannel,
  } = useChannelStore();
  const authUser = useAuthStore((s) => s.authUser);
  const { wallpaper, theme } = useThemeStore();

  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [viewed, setViewed] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeReactionPostId, setActiveReactionPostId] = useState(null);
  const fileRef = useRef(null);
  const messagesEndRef = useRef(null);

  const channel = selectedChannel;
  const channelId = channel?._id;
  const myId = String(authUser?._id);

  const canPost = Boolean(channel) && (
    channel.isOwner ||
    String(channel.owner?._id || channel.owner) === myId ||
    channel.isAdmin
  );
  const recentPosts = useMemo(() => posts || [], [posts]);
  const pinnedPost = useMemo(() => recentPosts.find((p) => p.pinned), [recentPosts]);

  // Record impression for each visible post
  useEffect(() => {
    if (!channelId) return;
    recentPosts.forEach((p) => {
      if (!viewed.has(p._id)) {
        setViewed((prev) => new Set(prev).add(p._id));
        viewPost(channelId, p._id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, recentPosts.length]);

  if (!channel) {
    return (
      <div className="h-full w-full flex flex-col min-h-0 min-w-0 bg-base-100">
        <div className="px-3 py-3 border-b border-base-300/60 flex items-center gap-3 flex-shrink-0">
          <div className="p-1.5 -ml-1 rounded-full text-base-content/40">
            <ArrowLeft size={20} />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-base-200 animate-pulse flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 rounded-lg bg-base-200 animate-pulse" />
              <div className="h-3 w-20 rounded-lg bg-base-200 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="text-xs text-base-content/40">Loading channel updates…</p>
        </div>
      </div>
    );
  }

  const handlePickFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setMediaUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !mediaFile) || sending) return;
    setSending(true);
    try {
      let media = null;
      if (mediaFile) {
        const kind = mediaFile.type.startsWith("video/") ? "video" : "image";
        const { key, name, size } = await uploadAttachment({
          file: mediaFile,
          kind,
          onProgress: () => {},
        });
        media = {
          type: kind,
          key,
          fileName: name,
          contentType: mediaFile.type,
          size,
          duration: kind === "video" ? mediaFile.duration || 0 : 0,
        };
      }
      await createPost(channelId, { text: trimmed, media });
      setText("");
      setMediaFile(null);
      setMediaUrl("");
      toast.success("Broadcast published");
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not publish broadcast");
    } finally {
      setSending(false);
    }
  };

  const copyInvite = async () => {
    let code = channel.inviteCode;
    if (!code) code = await generateInvite(channelId);
    if (!code) return;
    const link = `${window.location.origin}/join-channel/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast(link);
    }
  };

  const handleSharePost = async (post) => {
    const shareText = `${channel.name}:\n${post.text || "Check out this update"}\n\nJoin channel: ${window.location.origin}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: channel.name,
          text: shareText,
        });
      } catch {
        // user cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Copied post to clipboard");
      } catch {
        toast.error("Could not share post");
      }
    }
  };

  const wallpaperStyle = getWallpaperStyle ? getWallpaperStyle(wallpaper, theme) : {};

  return (
    <div className="h-full w-full flex flex-col min-h-0 min-w-0 bg-base-100">
      {/* Premium Chat-style Header */}
      <div className="px-3.5 py-2.5 border-b border-base-300/70 bg-base-100/90 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            onClick={closeChannel}
            className="p-1.5 -ml-1 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <button
            onClick={() => {
              setMenuOpen(false);
              openChannelInfo();
            }}
            className="flex items-center gap-3 min-w-0 rounded-2xl hover:bg-base-200/60 p-1 -ml-1 transition-all text-left select-none group"
            title="View channel info"
          >
            <div className="relative flex-shrink-0">
              {channel.avatar ? (
                <img
                  src={channel.avatar}
                  alt={channel.name}
                  className="object-cover rounded-2xl size-10.5 ring-1 ring-base-300/70 group-hover:ring-primary/40 transition-all"
                />
              ) : (
                <div className="flex items-center justify-center rounded-2xl size-10.5 bg-primary/10 border border-primary/20 text-primary group-hover:scale-105 transition-transform">
                  <Megaphone size={19} />
                </div>
              )}
              {/* Broadcast indicator badge */}
              <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-primary text-primary-content flex items-center justify-center ring-2 ring-base-100 text-[8px] font-bold">
                📢
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-base-content truncate text-[15px] leading-tight flex items-center gap-1.5">
                <span className="truncate">{channel.name}</span>
                <ShieldCheck size={14} className="text-primary flex-shrink-0" />
              </div>
              <div className="text-[11.5px] text-base-content/55 truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-medium">{channel.followerCount || 0} followers</span>
                {channel.category && (
                  <>
                    <span className="text-base-content/30">•</span>
                    <span className="truncate">{channel.category}</span>
                  </>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="relative flex items-center gap-1 flex-shrink-0">
          <button
            onClick={copyInvite}
            className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            title="Share channel link"
            aria-label="Share channel link"
          >
            <LinkIcon size={18} />
          </button>

          <button
            onClick={async () => {
              await muteChannel(channelId, !channel.isMuted);
              toast.success(channel.isMuted ? "Notifications enabled" : "Notifications muted");
            }}
            className={`p-2 rounded-full active:scale-95 transition-all ${
              channel.isMuted
                ? "text-base-content/40 hover:bg-base-200"
                : "text-primary hover:bg-primary/10"
            }`}
            title={channel.isMuted ? "Unmute updates" : "Mute updates"}
          >
            {channel.isMuted ? <BellOff size={18} /> : <Bell size={18} />}
          </button>

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
            title="Options"
            aria-label="Options"
          >
            <MoreVertical size={18} />
          </button>

          {/* Glassmorphic Dropdown Menu */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-2xl bg-base-100 border border-base-300 shadow-xl py-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openChannelInfo();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-base-content hover:bg-base-200/70 transition-colors"
                >
                  <Users size={15} className="text-primary" /> Channel Details
                </button>
                {canPost && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openEditChannel(channel);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-base-content hover:bg-base-200/70 transition-colors"
                  >
                    <Pencil size={15} /> Edit channel
                  </button>
                )}
                {canPost && (
                  <button
                    onClick={async () => {
                      await revokeInvite(channelId);
                      toast.success("Invite link revoked");
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-base-content hover:bg-base-200/70 transition-colors"
                  >
                    <LinkIcon size={15} /> Revoke invite
                  </button>
                )}
                <div className="h-[1px] bg-base-300/60 my-1" />
                <button
                  onClick={async () => {
                    await muteChannel(channelId, !channel.isMuted);
                    toast.success(channel.isMuted ? "Notifications unmuted" : "Notifications muted");
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-base-content hover:bg-base-200/70 transition-colors"
                >
                  {channel.isMuted ? <Bell size={15} /> : <BellOff size={15} />}
                  {channel.isMuted ? "Unmute updates" : "Mute updates"}
                </button>
                {!channel.isOwner && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await unfollowChannel(channelId);
                      toast.success(`Unfollowed ${channel.name}`);
                      closeChannel();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-error hover:bg-error/10 transition-colors"
                  >
                    <Users size={15} /> Unfollow channel
                  </button>
                )}
                {channel.isOwner && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      if (window.confirm(`Delete "${channel.name}" and all posts permanently?`)) {
                        await useChannelStore.getState().deleteChannel(channelId);
                        toast.success("Channel deleted");
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 size={15} /> Delete channel
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pinned Broadcast Banner (matching ChatContainer pinned banner) */}
      {pinnedPost && (
        <div 
          onClick={() => {
            const el = document.getElementById(`channel-post-${pinnedPost._id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="hover:bg-base-200/80 border-b border-base-300/80 px-4 py-2 flex items-center justify-between cursor-pointer transition-colors z-10 shadow-xs text-left bg-base-100/95 backdrop-blur-sm animate-in slide-in-from-top duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Pin size={14} className="text-amber-500 flex-shrink-0 fill-amber-500/20" />
            <div className="text-xs min-w-0">
              <span className="font-bold text-amber-500 block text-[10px] uppercase tracking-wider">
                Pinned Update
              </span>
              <p className="truncate font-medium text-base-content/80 text-xs">
                {pinnedPost.text || (pinnedPost.media?.type === "video" ? "🎬 Video" : "🖼️ Photo")}
              </p>
            </div>
          </div>
          {canPost && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                pinPost(channelId, pinnedPost._id, false);
              }}
              className="p-1 hover:bg-base-300 rounded-full transition-colors text-base-content/40 hover:text-base-content"
              title="Unpin"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Posts Feed Area (rendered as Chat Broadcast Bubbles) */}
      <div 
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4"
        style={wallpaperStyle}
      >
        {channel.description && (
          <div className="mx-auto max-w-xl p-3.5 rounded-2xl bg-base-200/80 backdrop-blur-md border border-base-300/60 text-center shadow-xs">
            <p className="text-xs text-base-content/70 leading-relaxed font-medium">
              📢 {channel.description}
            </p>
          </div>
        )}

        {isPostsLoading && recentPosts.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-xs text-base-content/40">Fetching channel broadcasts…</p>
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto">
            <div className="size-16 rounded-3xl bg-base-200/80 backdrop-blur-sm border border-base-300/80 flex items-center justify-center text-primary shadow-sm">
              <Megaphone size={28} />
            </div>
            <h4 className="text-base font-bold text-base-content">No broadcasts yet</h4>
            <p className="text-xs text-base-content/50 leading-relaxed">
              {canPost
                ? "You're in broadcast mode! Write your first update below to reach your followers."
                : "This channel hasn't posted any updates yet. Turn on notifications to be alerted when they post."}
            </p>
          </div>
        ) : (
          recentPosts.map((post) => {
            const isMyPost = Boolean(canPost);
            return (
              <div
                id={`channel-post-${post._id}`}
                key={post._id}
                className="mx-auto max-w-2xl w-full"
              >
                {/* Broadcast Message Bubble */}
                <div className="rounded-3xl bg-base-100/95 backdrop-blur-md border border-base-300/70 p-4 shadow-sm hover:border-base-300 transition-all duration-200 space-y-3">
                  {/* Top Bar of Bubble: Channel/Author identity + Pin indicator + Time */}
                  <div className="flex items-center justify-between gap-2 border-b border-base-300/40 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                        <Megaphone size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-base-content truncate block leading-none">
                          {channel.name}
                        </span>
                        <span className="text-[10px] text-base-content/40 block mt-0.5 leading-none">
                          Broadcast by {post.author?.fullName || "Admin"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {post.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      <span className="text-[11px] text-base-content/40">
                        {formatMessageTime(post.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.text && (
                    <div className="text-[14.5px] text-base-content whitespace-pre-wrap break-words leading-relaxed font-normal">
                      {post.text}
                    </div>
                  )}

                  {/* Media Content */}
                  {post.media?.key && (
                    <div className="rounded-2xl overflow-hidden bg-base-200 border border-base-300/60 relative">
                      {post.media?.url ? (
                        post.media.type === "video" ? (
                          <video
                            src={post.media.url}
                            controls
                            className="w-full max-h-96 object-contain bg-black rounded-2xl"
                          />
                        ) : (
                          <img
                            src={post.media.url}
                            alt=""
                            className="w-full max-h-96 object-contain bg-base-200/50 rounded-2xl"
                          />
                        )
                      ) : (
                        <div className="py-12 text-center text-xs text-base-content/40 flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin text-primary" />
                          <span>Loading attachment…</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Footer: Reactions + Impression count + Share + Admin Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-base-300/30 text-xs">
                    {/* Reactions Pill Row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Heart button */}
                      <button
                        onClick={() => reactToPost(channelId, post._id, post.myReaction === "❤️" ? "" : "❤️")}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                          post.myReaction === "❤️"
                            ? "bg-red-500/10 text-red-500 border-red-500/30"
                            : "bg-base-200 text-base-content/60 border-base-300/60 hover:bg-base-300"
                        }`}
                      >
                        <Heart size={13} fill={post.myReaction === "❤️" ? "currentColor" : "none"} />
                        <span>{post.reactions?.length || 0}</span>
                      </button>

                      {/* Other emoji reactions list */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveReactionPostId((cur) => (cur === post._id ? null : post._id))
                          }
                          className="p-1.5 rounded-full hover:bg-base-200 text-base-content/40 hover:text-base-content transition-colors"
                          title="React with emoji"
                        >
                          <Smile size={15} />
                        </button>

                        {activeReactionPostId === post._id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setActiveReactionPostId(null)}
                            />
                            <div className="absolute bottom-full left-0 mb-1 z-40 flex gap-1 bg-base-100 border border-base-300 rounded-full px-2.5 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                              {REACTIONS.map((r) => (
                                <button
                                  key={r}
                                  onClick={() => {
                                    reactToPost(channelId, post._id, r);
                                    setActiveReactionPostId(null);
                                  }}
                                  className="text-lg hover:scale-125 transition-transform p-1"
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side: Views + Share + Pin/Delete */}
                    <div className="flex items-center gap-2 text-base-content/40 flex-shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-medium" title="Views">
                        <Eye size={13} />
                        <span>{post.views?.length || 0}</span>
                      </span>

                      <button
                        onClick={() => handleSharePost(post)}
                        className="p-1.5 rounded-full hover:bg-base-200 text-base-content/50 hover:text-base-content transition-colors active:scale-95"
                        title="Share update"
                      >
                        <CornerUpRight size={14} />
                      </button>

                      {canPost && (
                        <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-base-300">
                          <button
                            onClick={() => pinPost(channelId, post._id, !post.pinned)}
                            className={`p-1.5 rounded-full transition-colors ${
                              post.pinned
                                ? "text-amber-500 hover:bg-amber-500/10"
                                : "hover:text-base-content hover:bg-base-200"
                            }`}
                            title={post.pinned ? "Unpin broadcast" : "Pin broadcast"}
                          >
                            <Pin size={14} />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm("Delete this broadcast update?")) {
                                await deletePost(channelId, post._id);
                                toast.success("Broadcast removed");
                              }
                            }}
                            className="p-1.5 rounded-full hover:text-error hover:bg-error/10 transition-colors"
                            title="Delete broadcast"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer Area (Styled cleanly like MessageInput.jsx) */}
      {canPost ? (
        <div className="p-3 border-t border-base-300/80 bg-base-100/95 backdrop-blur-md flex-shrink-0">
          {mediaUrl && (
            <div className="mb-2 relative inline-block">
              {mediaFile?.type.startsWith("video/") ? (
                <video src={mediaUrl} className="h-16 w-16 rounded-xl object-cover bg-black border border-base-300" muted />
              ) : (
                <img src={mediaUrl} alt="" className="h-16 w-16 rounded-xl object-cover border border-base-300" />
              )}
              <button
                onClick={() => {
                  setMediaFile(null);
                  setMediaUrl("");
                }}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-base-300 text-base-content hover:bg-error hover:text-white flex items-center justify-center shadow-sm transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2.5 rounded-full text-base-content/60 hover:text-primary hover:bg-base-200 active:scale-95 transition-all flex-shrink-0"
              title="Attach Photo / Video"
            >
              <ImageIcon size={20} />
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handlePickFile} className="hidden" />

            <div className="flex-1 relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Broadcast an update to followers…"
                className="w-full resize-none field-flat bg-base-200 rounded-2xl pl-4 pr-10 py-2.5 text-sm text-base-content ph-dim border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32 transition-all"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !mediaFile)}
              className="p-2.5 rounded-full bg-primary text-primary-content disabled:opacity-40 hover:opacity-90 active:scale-95 shadow-md shadow-primary/25 transition-all flex-shrink-0 flex items-center justify-center"
              title="Send broadcast"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      ) : (
        /* Modern Read-Only Broadcast Footer */
        <div className="px-4 py-3 border-t border-base-300/70 bg-base-100/90 backdrop-blur-md flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Megaphone size={16} />
            </div>
            <div className="text-xs min-w-0">
              <span className="font-semibold text-base-content block leading-tight truncate">
                Broadcast Only Channel
              </span>
              <span className="text-[11px] text-base-content/50 block leading-tight truncate">
                Posts are sent by channel administrators
              </span>
            </div>
          </div>

          <button
            onClick={async () => {
              await muteChannel(channelId, !channel.isMuted);
              toast.success(channel.isMuted ? "Notifications on" : "Notifications muted");
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0 ${
              channel.isMuted
                ? "bg-base-200 text-base-content/70 border-base-300 hover:bg-base-300"
                : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            }`}
          >
            {channel.isMuted ? <Bell size={13} /> : <BellOff size={13} />}
            <span>{channel.isMuted ? "Unmute" : "Muted"}</span>
          </button>
        </div>
      )}

      <CreateChannelModal />
    </div>
  );
};

export default ChannelFeed;
