import { useEffect, useMemo, useRef, useState } from "react";
import { useChannelStore } from "../store/useChannelStore";
import useAuthStore from "../store/useAuthStore";
import {
  ArrowLeft, Send, Image as ImageIcon, X, Heart, MessageSquare, Pin,
  Trash2, Megaphone, Users, Link as LinkIcon, Bell, BellOff, MoreVertical,
  Loader2, Eye, Pencil,
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

  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [viewed, setViewed] = useState(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const fileRef = useRef(null);

  const channel = selectedChannel;
  const channelId = channel?._id;
  const myId = String(authUser?._id);

  const canPost = Boolean(channel) && (String(channel.owner?._id || channel.owner) === myId || channel.isAdmin);
  const recentPosts = useMemo(() => posts || [], [posts]);

  // Record a read (impression) for each visible post, once per session.
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

  // Details are still loading (openChannel sets the feed open immediately, so
  // showing a skeleton here avoids a blank flash).
  if (!channel) {
    return (
      <div className="h-full flex flex-col min-h-0 min-w-0 bg-base-100">
        <div className="px-3 py-2.5 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
          <div className="p-1.5 -ml-1 rounded-full">
            <ArrowLeft size={20} className="text-base-content/30" />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="size-10 rounded-full bg-base-200 animate-pulse flex-shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-32 rounded bg-base-200 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-base-200 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <span className="loading loading-spinner loading-md text-primary" />
          <p className="text-xs text-base-content/40">Opening channel…</p>
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
          poster,
        };
      }
      await createPost(channelId, { text: trimmed, media });
      setText("");
      setMediaFile(null);
      setMediaUrl("");
      toast.success("Posted");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not post");
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

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 bg-base-100">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-base-300 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={closeChannel}
          className="p-1.5 -ml-1 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 active:scale-95 transition-all"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <button
            onClick={() => {
              setMenuOpen(false);
              openChannelInfo();
            }}
            className="flex items-center gap-3 min-w-0 rounded-xl active:bg-base-200/70 px-1 py-1 -ml-1 transition-colors text-left select-none"
            title="Channel info"
          >
            {channel.avatar ? (
              <img
                src={channel.avatar}
                alt={channel.name}
                className="object-cover rounded-full size-10 flex-shrink-0"
              />
            ) : (
              <div className="flex items-center justify-center rounded-full size-10 bg-secondary/10 border border-secondary/20 text-secondary flex-shrink-0">
                <Megaphone size={18} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-base-content truncate leading-tight">
                {channel.name}
              </div>
              <div className="text-[11px] text-base-content/50 truncate flex items-center gap-1">
                <span>{channel.followerCount || 0} followers</span>
                {channel.category && <span>· {channel.category}</span>}
              </div>
            </div>
          </button>
        </div>

        {/* Actions */}
        <div className="relative flex items-center gap-0.5">
          {canPost && (
            <button
              onClick={copyInvite}
              className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 transition-colors"
              title="Copy invite link"
            >
              <LinkIcon size={18} />
            </button>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-full text-base-content/70 hover:text-base-content hover:bg-base-200 transition-colors"
            title="More"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl bg-base-100 border border-base-300 shadow-xl py-1.5">
                {canPost && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openEditChannel(channel);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-base-content hover:bg-base-200/70 transition-colors"
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
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-base-content hover:bg-base-200/70 transition-colors"
                  >
                    <LinkIcon size={15} /> Revoke invite
                  </button>
                )}
                <button
                  onClick={async () => {
                    await muteChannel(channelId, !channel.isMuted);
                    toast.success(channel.isMuted ? "Notifications on" : "Notifications muted");
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-base-content hover:bg-base-200/70 transition-colors"
                >
                  {channel.isMuted ? <Bell size={15} /> : <BellOff size={15} />}
                  {channel.isMuted ? "Unmute notifications" : "Mute notifications"}
                </button>
                {channel.isOwner && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      if (window.confirm(`Delete "${channel.name}" and all its posts?`)) {
                        await useChannelStore.getState().deleteChannel(channelId);
                        toast.success("Channel deleted");
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-error hover:bg-base-200/70 transition-colors"
                  >
                    <Trash2 size={15} /> Delete channel
                  </button>
                )}
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    if (await reportChannel(channelId, "Inappropriate channel content")) {
                      toast.success("Thanks — we'll review this channel");
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-error hover:bg-base-200/70 transition-colors"
                >
                  <MessageSquare size={15} /> Report channel
                </button>
                {!channel.isOwner && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await unfollowChannel(channelId);
                      toast.success(`Unfollowed ${channel.name}`);
                      closeChannel();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-error hover:bg-base-200/70 transition-colors"
                  >
                    <Users size={15} /> Unfollow
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Posts */}
      <div className="flex-1 overflow-y-auto">
        {channel.description && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm text-base-content/50">{channel.description}</p>
          </div>
        )}

        {isPostsLoading && recentPosts.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center px-8">
            <span className="loading loading-spinner loading-md text-primary" />
            <p className="text-xs text-base-content/40">Loading posts…</p>
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center px-8">
            <div className="size-14 rounded-full bg-base-200 flex items-center justify-center">
              <Megaphone size={22} className="text-base-content/30" />
            </div>
            <p className="text-sm font-medium text-base-content/70">No posts yet</p>
            <p className="text-xs text-base-content/40">
              {canPost
                ? "Write the first post for your followers."
                : "The channel owner hasn't posted yet."}
            </p>
          </div>
        ) : (
          recentPosts.map((post) => (
            <div key={post._id} className="px-4 py-3 border-b border-base-content/5">
              {post.pinned && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary mb-1.5">
                  <Pin size={12} /> Pinned
                </div>
              )}

              {/* Author / time */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-base-content/40">
                  {post.author?.fullName || "Admin"} · {formatMessageTime(post.createdAt)}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-base-content/35">
                  <Eye size={11} /> {post.views?.length || 0}
                </span>
              </div>

              {/* Text */}
              {post.text && (
                <p className="text-[15px] text-base-content whitespace-pre-wrap break-words">
                  {post.text}
                </p>
              )}

              {/* Media */}
              {post.media?.key && (
                <div className="mt-2 rounded-2xl overflow-hidden bg-base-200 relative">
                  {post.media?.url ? (
                    post.media.type === "video" ? (
                      <video
                        src={post.media.url}
                        controls
                        className="w-full max-h-80 object-contain bg-black"
                      />
                    ) : (
                      <img
                        src={post.media.url}
                        alt=""
                        className="w-full max-h-80 object-contain"
                      />
                    )
                  ) : (
                    <div className="py-10 text-center text-xs text-base-content/40 flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Loading media…
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-2.5 flex items-center gap-4">
                {/* Reaction */}
                <div className="relative group">
                  <button
                    onClick={() => reactToPost(channelId, post._id, post.myReaction ? "" : "❤️")}
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      post.myReaction ? "text-primary" : "text-base-content/50 hover:text-base-content"
                    }`}
                  >
                    <Heart size={16} fill={post.myReaction ? "currentColor" : "none"} />
                    <span>{post.reactions?.length || 0}</span>
                  </button>
                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex gap-0.5 bg-base-100 border border-base-300 rounded-full px-2 py-1 shadow-xl">
                    {REACTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => reactToPost(channelId, post._id, r)}
                        className="text-lg hover:scale-125 transition-transform"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin controls */}
                {canPost && (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => pinPost(channelId, post._id, !post.pinned)}
                      className={`p-1.5 rounded-full transition-colors ${
                        post.pinned
                          ? "text-primary"
                          : "text-base-content/40 hover:text-base-content hover:bg-base-200"
                      }`}
                      title={post.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm("Delete this post?")) {
                          await deletePost(channelId, post._id);
                          toast.success("Post deleted");
                        }
                      }}
                      className="p-1.5 rounded-full text-base-content/40 hover:text-error hover:bg-base-200 transition-colors"
                      title="Delete post"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer — only admins/owner can post (one-way broadcast) */}
      {canPost ? (
        <div className="p-2.5 border-t border-base-300 flex items-end gap-2 flex-shrink-0">
          {mediaUrl && (
            <div className="relative flex-shrink-0">
              {mediaFile?.type.startsWith("video/") ? (
                <video src={mediaUrl} className="h-10 w-10 rounded-lg object-cover bg-black" muted />
              ) : (
                <img src={mediaUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <button
                onClick={() => {
                  setMediaFile(null);
                  setMediaUrl("");
                }}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-base-300 text-base-content flex items-center justify-center"
              >
                <X size={11} />
              </button>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="p-2.5 rounded-full text-base-content/60 hover:text-primary hover:bg-base-200 transition-colors flex-shrink-0"
            title="Add photo or video"
          >
            <ImageIcon size={20} />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handlePickFile} className="hidden" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            placeholder="Write a post..."
            className="flex-1 resize-none field-flat bg-base-200 rounded-2xl px-3.5 py-2.5 text-sm text-base-content ph-dim focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && !mediaFile)}
            className="p-2.5 rounded-full bg-primary text-primary-content disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
            title="Send"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      ) : (
        <div className="p-2.5 border-t border-base-content/8 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 py-1 text-xs text-base-content/45">
            <Megaphone size={14} />
            <span>One-way broadcast — posts are read-only</span>
          </div>
        </div>
      )}

      <CreateChannelModal />
    </div>
  );
};

export default ChannelFeed;
