import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { Camera, Mail, User, FileText, Globe, ImagePlus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  SOCIAL_PLATFORMS,
  toSocialLinksForm,
  getFilledSocialLinks,
  toDisplayHandle,
} from "../lib/social";
import SocialLinksRow from "../components/SocialLinksRow";
import ProfileQrCard from "../components/ProfileQrCard";
import QrScannerModal from "../components/QrScannerModal";

// Shared surface treatment.
//
// Nothing here draws an outline. Boxes with visible borders are what made this
// screen read as unfinished: every value sat inside its own rectangle, so the
// eye counted frames instead of content. Real chat apps group by *surface* —
// a section is a slightly lighter panel with no edge — and separate rows with
// a hairline, not a box.
//
// Fields follow the same rule: a single underline that lights up on focus,
// instead of a rectangle around every input.
const fieldClass =
  "w-full bg-transparent border-0 border-b border-base-content/15 rounded-none " +
  "text-base-content placeholder:text-base-content/30 outline-none " +
  "transition-colors focus:border-primary focus:ring-0";

// Solid base-200 rather than a translucent tint: the avatar ring and the cover
// gradient both blend to this exact colour, so there is no seam anywhere.
const cardClass = "rounded-2xl bg-base-200";

const sectionLabel = "text-[11px] font-semibold uppercase tracking-wider text-base-content/40 px-1";

/** Quiet secondary action — a filled surface, never an outlined box. */
const ghostButton =
  "bg-base-300/70 hover:bg-base-300 text-base-content font-medium " +
  "active:scale-[0.97] transition-all";

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [selectedImg, setSelectedImg] = useState(null);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: authUser?.fullName || "",
    email: authUser?.email || "",
    bio: authUser?.bio || "",
    link: authUser?.link || "",
    onlinePrivacy: authUser?.onlinePrivacy !== false,
    socialLinks: toSocialLinksForm(authUser),
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedBanner(base64Image);
      setIsUploadingBanner(true);
      try {
        await updateProfile({ bannerPic: base64Image });
      } catch {
        // The store already toasts; drop the optimistic preview so the card
        // doesn't keep showing a banner that was never saved.
        setSelectedBanner(null);
      } finally {
        setIsUploadingBanner(false);
      }
    };
    // Allow re-picking the same file after a failed attempt.
    e.target.value = "";
  };

  const handleRemoveBanner = async () => {
    setIsUploadingBanner(true);
    try {
      await updateProfile({ bannerPic: "" });
      setSelectedBanner(null);
    } catch {
      // handled by the store's toast
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleStartEdit = () => {
    setFormData({
      fullName: authUser?.fullName || "",
      email: authUser?.email || "",
      bio: authUser?.bio || "",
      link: authUser?.link || "",
      onlinePrivacy: authUser?.onlinePrivacy !== false,
      socialLinks: toSocialLinksForm(authUser),
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!formData.fullName.trim()) {
      return toast.error("Full Name cannot be empty");
    }
    if (!formData.email.trim()) {
      return toast.error("Email cannot be empty");
    }
    try {
      await updateProfile({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        bio: formData.bio.trim(),
        link: formData.link.trim(),
        onlinePrivacy: formData.onlinePrivacy,
        socialLinks: Object.fromEntries(
          Object.entries(formData.socialLinks).map(([key, value]) => [key, value.trim()])
        ),
      });
      setIsEditing(false);
    } catch {
      // errors are handled inside authStore toast.error
    }
  };

  const bannerSrc = selectedBanner || authUser?.bannerPic || "";
  const websiteHref = authUser?.link
    ? authUser.link.startsWith("http")
      ? authUser.link
      : `https://${authUser.link}`
    : "";
  // Shown without the scheme so a long URL reads as a name, not a address bar.
  const websiteLabel = toDisplayHandle(authUser?.link);
  const hasSocials = getFilledSocialLinks(authUser).length > 0;
  const hasAbout = Boolean(authUser?.bio || websiteHref || hasSocials);

  return (
    <div className="min-h-screen pt-20 pb-14">
      <div className="max-w-2xl px-4 mx-auto space-y-5">

        {/* ── Hero: cover, avatar, identity ── */}
        <div className={`${cardClass} overflow-hidden`}>
          <div className="relative w-full h-36 sm:h-44 overflow-hidden bg-gradient-to-br from-primary/25 via-secondary/20 to-accent/25">
            {bannerSrc && (
              <img src={bannerSrc} alt="Profile banner" className="object-cover w-full h-full" />
            )}
            {/* Fades the cover into the card so the avatar never sits on a hard seam */}
            <div className="absolute inset-0 bg-gradient-to-t from-base-200 via-base-200/25 to-transparent" />

            <div className="absolute flex gap-2 top-3 right-3">
              <label
                htmlFor="banner-upload"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-full bg-base-100/80 hover:bg-base-100 text-base-content backdrop-blur-md shadow-sm cursor-pointer transition-all active:scale-95
                  ${isUploadingBanner ? "animate-pulse pointer-events-none" : ""}`}
              >
                <ImagePlus className="w-3.5 h-3.5" />
                {isUploadingBanner ? "Uploading…" : bannerSrc ? "Change cover" : "Add cover"}
                <input
                  type="file"
                  id="banner-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={isUploadingBanner || isUpdatingProfile}
                />
              </label>
              {bannerSrc && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  disabled={isUploadingBanner || isUpdatingProfile}
                  className="flex items-center px-2.5 py-1.5 rounded-full bg-base-100/80 hover:bg-base-100 text-error backdrop-blur-md shadow-sm transition-all active:scale-95"
                  title="Remove cover photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* relative + z-10 so the avatar sits on top of the cover photo.
              The banner above is positioned, so a static sibling overlapping
              it gets painted underneath — the cover was slicing across the
              profile picture. */}
          <div className="relative z-10 flex flex-col items-center px-6 pb-6 -mt-16">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="object-cover rounded-full shadow-xl ring-4 ring-base-200 bg-base-200 size-28"
              />
              <label
                htmlFor="avatar-upload"
                className={`absolute bottom-0 right-0 grid place-items-center size-9 rounded-full bg-primary text-primary-content ring-4 ring-base-200 cursor-pointer transition-transform hover:scale-105 active:scale-95
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}`}
              >
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>

            <h1 className="mt-3 text-xl font-semibold text-base-content">{authUser?.fullName}</h1>
            <p className="text-sm text-base-content/45">{authUser?.email}</p>
            <p className="mt-1 text-[11px] text-base-content/35">
              {isUpdatingProfile ? "Uploading…" : "Tap the camera to change your photo"}
            </p>

            {!isEditing && (
              <div className="pt-3">
                <SocialLinksRow user={authUser} variant="icons" emptyText="" />
              </div>
            )}
          </div>
        </div>

        {isEditing ? (
          /* ── Edit mode ── */
          <>
            <div className="space-y-2">
              <span className={sectionLabel}>Your details</span>
              <div className={`${cardClass} p-4 space-y-4`}>
                <div className="space-y-1.5">
                  <label htmlFor="pf-name" className="flex items-center gap-2 text-xs font-medium text-base-content/55">
                    <User className="w-3.5 h-3.5" />
                    Full name
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    className={`${fieldClass} h-11 px-1 text-[15px]`}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pf-email" className="flex items-center gap-2 text-xs font-medium text-base-content/55">
                    <Mail className="w-3.5 h-3.5" />
                    Email address
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    className={`${fieldClass} h-11 px-1 text-[15px]`}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pf-bio" className="flex items-center gap-2 text-xs font-medium text-base-content/55">
                    <FileText className="w-3.5 h-3.5" />
                    Bio
                  </label>
                  <textarea
                    id="pf-bio"
                    rows={3}
                    className={`${fieldClass} px-1 py-2 text-[15px] resize-none`}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell people a little about yourself"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pf-link" className="flex items-center gap-2 text-xs font-medium text-base-content/55">
                    <Globe className="w-3.5 h-3.5" />
                    Website
                  </label>
                  <input
                    id="pf-link"
                    type="text"
                    className={`${fieldClass} h-11 px-1 text-[15px]`}
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    placeholder="yourname.dev"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className={sectionLabel}>Social &amp; portfolio</span>
              <div className={`${cardClass} p-4 space-y-3`}>
                {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, colorClass, placeholder }) => (
                  <div key={key} className="relative">
                    <Icon
                      className={`absolute w-4 h-4 -translate-y-1/2 left-0 top-1/2 ${colorClass} pointer-events-none`}
                    />
                    <input
                      type="text"
                      aria-label={label}
                      className={`${fieldClass} h-11 pl-8 pr-1 text-[15px]`}
                      value={formData.socialLinks[key]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          socialLinks: { ...formData.socialLinks, [key]: e.target.value },
                        })
                      }
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <p className="text-[11px] text-base-content/35 px-1">
                  Leave a field empty to hide that platform.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className={sectionLabel}>Privacy</span>
              <label className={`${cardClass} flex items-center justify-between gap-4 px-4 py-3.5 cursor-pointer`}>
                <span className="min-w-0">
                  <span className="block text-[15px] text-base-content">Show online status</span>
                  <span className="block text-xs text-base-content/45 mt-0.5">
                    Let others see when you&apos;re active
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm flex-shrink-0"
                  checked={formData.onlinePrivacy}
                  onChange={(e) => setFormData({ ...formData, onlinePrivacy: e.target.checked })}
                />
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isUpdatingProfile}
                className={`flex-1 h-12 rounded-2xl text-[15px] disabled:opacity-40 ${ghostButton}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isUpdatingProfile}
                className="flex-1 h-12 rounded-2xl bg-primary text-primary-content font-semibold text-[15px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none"
              >
                {isUpdatingProfile ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        ) : (
          /* ── View mode ── */
          <>
            {/* About — content first.
                No dividers, no repeated micro-labels: the bio is just read as
                text, links are tappable pills, and the status is a quiet
                footnote. Empty blocks are omitted entirely rather than shown
                as "not added yet" rows, which is what made this look like a
                half-filled form. */}
            <div className="space-y-2">
              <span className={sectionLabel}>About</span>
              <div className={`${cardClass} p-5`}>
                {hasAbout ? (
                  <div className="space-y-4">
                    {authUser?.bio && (
                      <p className="text-[15px] leading-relaxed text-base-content whitespace-pre-wrap">
                        {authUser.bio}
                      </p>
                    )}

                    {/* Flush left, no pill: a tinted pill's background is nearly
                        invisible on this surface, so only its padded contents
                        read — which made the link look indented against the
                        bio. Plain icon + text lines up exactly. */}
                    {websiteHref && (
                      <a
                        href={websiteHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 max-w-full group"
                      >
                        <Globe size={15} className="text-primary flex-shrink-0" />
                        <span className="text-[14px] font-medium text-primary truncate group-hover:underline">
                          {websiteLabel}
                        </span>
                      </a>
                    )}

                    {hasSocials && <SocialLinksRow user={authUser} variant="chips" emptyText="" />}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="w-full text-left text-[15px] text-base-content/40 hover:text-base-content/60 transition-colors"
                  >
                    Add a bio and your links so people know who you are.
                  </button>
                )}

                <div className="flex items-center gap-2 pt-5">
                  <span
                    className={`size-1.5 rounded-full flex-shrink-0 ${
                      authUser?.onlinePrivacy !== false ? "bg-green-500" : "bg-base-content/30"
                    }`}
                  />
                  <span className="text-xs text-base-content/45">
                    {authUser?.onlinePrivacy !== false
                      ? "Online status visible to everyone"
                      : "Online status hidden — you always appear offline"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartEdit}
              className="w-full h-12 rounded-2xl bg-primary text-primary-content font-semibold text-[15px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
            >
              Edit profile
            </button>

            <ProfileQrCard user={authUser} onScanClick={() => setIsScannerOpen(true)} />

            <div className="space-y-2">
              <span className={sectionLabel}>Account</span>
              <div className={`${cardClass} divide-y divide-base-content/5`}>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-[15px] text-base-content/70">Member since</span>
                  <span className="text-[15px] text-base-content tabular-nums">
                    {authUser.createdAt?.split("T")[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <span className="text-[15px] text-base-content/70">Status</span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green-500">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    Active
                  </span>
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      <QrScannerModal
        open={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onResult={(userId) => {
          setIsScannerOpen(false);
          if (userId === authUser._id) {
            toast("That's your own chat link");
            return;
          }
          // Reuse the existing deep-link route so a scan behaves exactly like
          // opening a shared link — it resolves the user and opens the chat.
          navigate(`/chat-with/${userId}`);
        }}
      />
    </div>
  );
};
export default ProfilePage;
