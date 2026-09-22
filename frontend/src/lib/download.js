import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Hands the user a file to keep.
 *
 * An `<a download>` is inert inside the Android WebView — it silently does
 * nothing — so native writes the file and offers the system share sheet
 * instead. Same split the QR export already uses; kept here so both callers
 * share one implementation.
 */
export const saveTextFile = async (fileName, contents, mimeType = "application/json") => {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Cache,
      encoding: "utf8",
    });

    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare?.value) {
      await Share.share({
        title: fileName,
        url: written.uri,
        dialogTitle: "Save or send this file",
      });
      return { shared: true };
    }

    // No share target — leave it somewhere the user can actually find.
    await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Documents,
      encoding: "utf8",
    });
    return { savedTo: `Documents/${fileName}` };
  }

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { downloaded: true };
};

/**
 * Saves a binary file (base64 payload) to local storage — used for PDF exports
 * which saveTextFile cannot handle (it is utf8/text only).
 *
 * On native it writes to the Cache directory then hands it to the share sheet,
 * mirroring the text path; on the web it triggers an `<a download>`.
 */
export const saveBinaryFile = async (fileName, base64, mimeType = "application/pdf") => {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    const canShare = await Share.canShare().catch(() => ({ value: false }));
    if (canShare?.value) {
      await Share.share({
        title: fileName,
        url: written.uri,
        dialogTitle: "Save or send this file",
      });
      return { shared: true };
    }

    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Documents,
    });
    return { savedTo: `Documents/${fileName}` };
  }

  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { downloaded: true };
};
