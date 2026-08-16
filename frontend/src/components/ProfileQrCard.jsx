import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { Copy, Download, ScanLine, QrCode } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { buildChatLink } from "../lib/utils";

// The QR is rendered locally with `qrcode` instead of being fetched as an
// <img> from a public QR web service. That keeps it working offline, removes
// a third-party dependency from a page showing account data, avoids the
// backend CSP's img-src rules, and — the reason it matters here — gives us a
// real canvas to export as a PNG.

const PREVIEW_SIZE = 200;
const EXPORT_SIZE = 720;

/** Clipboard API needs a secure context; keep a legacy path for the rest. */
const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission/security failure — fall through to the textarea path.
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

const ProfileQrCard = ({ user, onScanClick }) => {
  const canvasRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const chatLink = buildChatLink(user._id);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, chatLink, {
      width: PREVIEW_SIZE,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).catch((err) => console.error("QR render failed:", err));
  }, [chatLink]);

  const handleCopy = async () => {
    const ok = await copyText(chatLink);
    if (ok) toast.success("Chat link copied!");
    else toast.error("Couldn't copy — long-press the link to copy it manually");
  };

  const handleDownload = async () => {
    setIsSaving(true);
    try {
      // Re-render at export resolution so the saved PNG is sharp rather than
      // an upscale of the small on-screen preview.
      const dataUrl = await QRCode.toDataURL(chatLink, {
        width: EXPORT_SIZE,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" },
      });
      const fileName = `chatty-qr-${(user.fullName || "profile").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

      if (Capacitor.isNativePlatform()) {
        // An `<a download>` is inert inside the Android WebView — it silently
        // does nothing. Write the file natively, then hand it to the system
        // share sheet so the user can save it to Photos/Files or send it on.
        const base64 = dataUrl.split(",")[1];
        const written = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });

        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (canShare?.value) {
          await Share.share({
            title: "My Chatty QR code",
            text: chatLink,
            url: written.uri,
            dialogTitle: "Save or share your QR code",
          });
        } else {
          // No share target available — the file is still on disk.
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents,
          });
          toast.success(`Saved as Documents/${fileName}`);
        }
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("QR code downloaded");
      }
    } catch (err) {
      // A dismissed native share sheet rejects too — that isn't a failure.
      const message = String(err?.message || "");
      if (!/cancel/i.test(message) && !/abort/i.test(message)) {
        console.error("QR download failed:", err);
        toast.error("Could not save the QR image");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-base-content/45 px-1">
        Share your profile
      </span>

      <div className="rounded-2xl bg-base-200 p-6 flex flex-col items-center text-center">
        <h2 className="text-[15px] font-semibold flex items-center gap-2 text-base-content">
          <QrCode size={16} className="text-primary" />
          My QR code
        </h2>
        <p className="mt-1 text-xs text-base-content/45 max-w-xs">
          Others can scan this to open a chat with you instantly.
        </p>

        {/* The code itself stays on white — QR contrast is a scanning
            requirement, not a style choice. The ring softens it into the card. */}
        <div className="mt-5 bg-white p-3.5 rounded-2xl shadow-lg ring-1 ring-black/5">
          <canvas
            ref={canvasRef}
            aria-label="Your profile QR code"
            className="block select-none size-40"
          />
        </div>

        <p className="mt-4 text-[11px] text-base-content/35 break-all max-w-xs select-all">
          {chatLink}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 w-full max-w-xs">
          <button
            onClick={handleCopy}
            className="h-11 rounded-xl bg-base-300/70 hover:bg-base-300 text-[13px] font-medium text-base-content active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
          >
            <Copy size={14} />
            Copy link
          </button>
          <button
            onClick={handleDownload}
            disabled={isSaving}
            className="h-11 rounded-xl bg-primary text-primary-content text-[13px] font-semibold shadow-lg shadow-primary/20 active:scale-[0.97] transition-all disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-1.5"
          >
            <Download size={14} />
            {isSaving ? "Saving…" : "Download"}
          </button>
          <button
            onClick={onScanClick}
            className="col-span-2 h-11 rounded-xl bg-base-300/70 hover:bg-base-300 text-[13px] font-medium text-base-content active:scale-[0.97] transition-all flex items-center justify-center gap-1.5"
          >
            <ScanLine size={14} />
            Scan someone&apos;s code
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileQrCard;
