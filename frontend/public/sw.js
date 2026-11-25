const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const notifyClients = async (detail) => {
  const message = { type: "chatty:share", detail };
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
};

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (
    event.request.method !== "POST" ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname !== "/" ||
    requestUrl.searchParams.get("share") !== "1"
  ) return;

  event.respondWith((async () => {
    const formData = await event.request.formData();
    const text = [formData.get("text"), formData.get("title"), formData.get("url")]
      .filter((value) => typeof value === "string" && value.trim())
      .join("\n");
    const files = [];
    for (const file of formData.getAll("files")) {
      if (!file || typeof file.arrayBuffer !== "function") continue;
      files.push({
        name: file.name || "shared-file",
        type: file.type || "application/octet-stream",
        bytes: arrayBufferToBase64(await file.arrayBuffer()),
      });
    }
    await notifyClients({ text, files });
    return Response.redirect(new URL("/", self.location.origin).href, 303);
  })());
});
