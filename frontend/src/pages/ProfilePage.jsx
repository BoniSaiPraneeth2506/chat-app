import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/useAuthStore";
import { Camera, Mail, User, FileText, Globe, ImagePlus, Trash2, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import { SOCIAL_PLATFORMS, toSocialLinksForm } from "../lib/social";
import SocialLinksRow from "../components/SocialLinksRow";
import ProfileQrCard from "../components/ProfileQrCard";
import QrScannerModal from "../components/QrScannerModal";

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

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="max-w-2xl p-4 py-8 mx-auto">
        <div className="space-y-8 overflow-hidden bg-base-300 rounded-xl">
          {/* Cover banner + overlapping avatar (Discord/LinkedIn style header) */}
          <div className="relative">
            <div className="relative w-full h-36 sm:h-44 overflow-hidden bg-gradient-to-r from-primary/30 via-secondary/25 to-accent/30">
              {bannerSrc && (
                <img
                  src={bannerSrc}
                  alt="Profile banner"
                  className="object-cover w-full h-full"
                />
              )}
              {/* Keeps the avatar and buttons legible over any uploaded photo */}
              <div className="absolute inset-0 bg-gradient-to-t from-base-300/80 via-base-300/10 to-transparent" />

              <div className="absolute flex gap-2 top-3 right-3">
                <label
                  htmlFor="banner-upload"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-base-100/85 hover:bg-base-100 text-base-content backdrop-blur-sm shadow-sm cursor-pointer transition-all
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
                    className="flex items-center px-2 py-1.5 rounded-lg bg-base-100/85 hover:bg-base-100 text-error backdrop-blur-sm shadow-sm transition-all"
                    title="Remove cover photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* avatar upload section — overlaps the banner's lower edge */}
            <div className="flex flex-col items-center gap-2 px-6 -mt-16">
              <div className="relative">
                <img
                  src={selectedImg || authUser.profilePic || "/avatar.png"}
                  alt="Profile"
                  className="object-cover border-4 rounded-full shadow-lg border-base-300 bg-base-300 size-32"
                />
                <label
                  htmlFor="avatar-upload"
                  className={`
                    absolute bottom-0 right-0
                    bg-base-content hover:scale-105
                    p-2 rounded-full cursor-pointer
                    transition-all duration-200
                    ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                  `}
                >
                  <Camera className="w-5 h-5 text-base-200" />
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
              <h1 className="text-xl font-semibold">{authUser?.fullName}</h1>
              <p className="text-xs text-zinc-400">
                {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
              </p>
              {!isEditing && (
                <div className="pt-1">
                  <SocialLinksRow user={authUser} variant="icons" emptyText="" />
                </div>
              )}
            </div>
          </div>

          <div className="px-6 pb-6 space-y-8">

          {/* Details form/static display */}
          {isEditing ? (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <User className="w-4 h-4" />
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base-content"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <Mail className="w-4 h-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base-content"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileText className="w-4 h-4" />
                  Bio
                </label>
                <textarea
                  className="w-full px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base-content h-24 resize-none"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Write a brief bio about yourself..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <Globe className="w-4 h-4" />
                  Website / Social Link
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base-content"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="e.g. https://github.com/myprofile"
                />
              </div>

              {/* Structured social & portfolio links */}
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <Link2 className="w-4 h-4" />
                    Social Links & Portfolio
                  </label>
                  <p className="text-[10px] opacity-60">
                    Leave a field empty to hide that platform from your profile.
                  </p>
                </div>
                {SOCIAL_PLATFORMS.map(({ key, label, icon: Icon, colorClass, placeholder }) => (
                  <div key={key} className="relative">
                    <Icon
                      className={`absolute w-4 h-4 -translate-y-1/2 left-3.5 top-1/2 ${colorClass} pointer-events-none`}
                    />
                    <input
                      type="text"
                      aria-label={label}
                      className="w-full py-2.5 pl-10 pr-3 bg-base-200 rounded-lg border border-base-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base-content"
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
              </div>

              {/* Online Privacy Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-base-200 border border-base-300/40">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-base-content">Show Online Status</span>
                  <p className="text-[10px] opacity-70">Let other users see when you are online</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={formData.onlinePrivacy}
                  onChange={(e) => setFormData({ ...formData, onlinePrivacy: e.target.checked })}
                />
              </div>

              </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <User className="w-4 h-4" />
                  Full Name
                </div>
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/10 text-sm text-base-content">
                  {authUser?.fullName}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Mail className="w-4 h-4" />
                  Email Address
                </div>
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/10 text-sm text-base-content">
                  {authUser?.email}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <FileText className="w-4 h-4" />
                  Bio
                </div>
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/10 text-sm text-base-content min-h-[42px] whitespace-pre-wrap">
                  {authUser?.bio || <span className="text-zinc-500 italic">No bio added yet</span>}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Globe className="w-4 h-4" />
                  Website / Social Link
                </div>
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/10 text-sm text-base-content min-h-[42px] truncate">
                  {authUser?.link ? (
                    <a
                      href={authUser.link.startsWith("http") ? authUser.link : `https://${authUser.link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      {authUser.link}
                    </a>
                  ) : (
                    <span className="text-zinc-500 italic">No website link added yet</span>
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Link2 className="w-4 h-4" />
                  Social Links & Portfolio
                </div>
                <SocialLinksRow user={authUser} variant="list" />
              </div>

              <div className="space-y-1.5">
                <div className="text-sm text-zinc-400">Online Status Privacy</div>
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300/10 text-sm text-base-content">
                  {authUser?.onlinePrivacy !== false ? "Visible to everyone" : "Hidden (Always Offline)"}
                </p>
              </div>


            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-2 border-t border-base-200">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-base-200 hover:bg-base-300 text-base-content transition-colors"
                  disabled={isUpdatingProfile}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/95 text-primary-content transition-all shadow-md flex items-center justify-center min-w-[100px]"
                  disabled={isUpdatingProfile}
                >
                  {isUpdatingProfile ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/95 text-primary-content transition-all shadow-md"
              >
                Edit Profile Settings
              </button>
            )}
          </div>

          {/* QR Code Profile Sharing */}
          {!isEditing && (
            <ProfileQrCard user={authUser} onScanClick={() => setIsScannerOpen(true)} />
          )}

          <div className="p-6 bg-base-200/50 rounded-xl border border-base-200">
            <h2 className="mb-4 text-lg font-medium">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-base-200">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="text-green-500 font-medium">Active</span>
              </div>
            </div>
          </div>
          </div>
        </div>
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
