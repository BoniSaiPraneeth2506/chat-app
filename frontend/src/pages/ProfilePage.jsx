import { useState } from "react";
import useAuthStore from "../store/useAuthStore";
import { Camera, Mail, User, FileText, Globe } from "lucide-react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: authUser?.fullName || "",
    email: authUser?.email || "",
    bio: authUser?.bio || "",
    link: authUser?.link || "",
    onlinePrivacy: authUser?.onlinePrivacy !== false,
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

  const handleStartEdit = () => {
    setFormData({
      fullName: authUser?.fullName || "",
      email: authUser?.email || "",
      bio: authUser?.bio || "",
      link: authUser?.link || "",
      onlinePrivacy: authUser?.onlinePrivacy !== false,
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
      });
      setIsEditing(false);
    } catch (error) {
      // errors are handled inside authStore toast.error
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-10">
      <div className="max-w-2xl p-4 py-8 mx-auto">
        <div className="p-6 space-y-8 bg-base-300 rounded-xl">
          <div className="text-center">
            <h1 className="text-2xl font-semibold ">Profile</h1>
            <p className="mt-2">Your profile information & settings</p>
          </div>

          {/* avatar upload section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="object-cover border-4 border-base-200 rounded-full size-32"
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
            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
            </p>
          </div>

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
            <div className="p-6 bg-base-200/50 rounded-xl border border-base-200 flex flex-col items-center text-center space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">My Shareable QR Code</h2>
                <p className="text-xs opacity-70">Allow others to scan and open a direct chat conversation with you instantly.</p>
              </div>
              <div className="bg-white p-3 rounded-xl shadow-md border border-zinc-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/chat-with/${authUser._id}`)}`}
                  alt="Profile QR Code"
                  className="size-36 select-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/chat-with/${authUser._id}`);
                    toast.success("Profile link copied!");
                  }}
                  className="btn btn-sm btn-outline text-xs px-4"
                >
                  Copy Chat Link
                </button>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/chat-with/${authUser._id}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary text-xs text-white px-4"
                >
                  View Large
                </a>
              </div>
            </div>
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
  );
};
export default ProfilePage;