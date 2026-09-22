/* Self-hosted Capacitor Updater: publish a new OTA bundle.
 *
 * Usage:  node scripts/publish-update.cjs <version>
 * Example: node scripts/publish-update.cjs 1.0.1
 *
 * Steps:
 *   1. Build the frontend (npm run build).
 *   2. Zip dist/ (index.html at the zip root — required by the updater).
 *   3. Compute the SHA-256 of the zip (the plugin verifies `checksum`).
 *   4. Stage the bundle + manifest.json under backend/updates/.
 *   5. Commit + push, then the installed app picks it up on next launch.
 *
 * Version strings must only ever increase (the plugin treats any difference as
 * an update and applies it by version inequality on self-hosted feeds).
 */
const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const frontendDir = path.resolve(__dirname, "..");
const updatesDir = path.resolve(__dirname, "../../backend/updates");
const distDir = path.join(frontendDir, "dist");
const manifestPath = path.join(updatesDir, "manifest.json");

const version = process.argv[2];
if (!version || version.startsWith("-")) {
  console.error("Usage: node scripts/publish-update.cjs <version>");
  console.error("Example: node scripts/publish-update.cjs 1.0.1");
  process.exit(1);
}

const bundleName = `bundle-${version}.zip`;
const bundlePath = path.join(updatesDir, bundleName);

console.log(`[publish] building frontend (version ${version})...`);
const build = spawnSync("npm", ["run", "build"], { cwd: frontendDir, stdio: "inherit", shell: process.platform === "win32" });
if (build.status !== 0) {
  console.error("[publish] frontend build failed — aborting.");
  process.exit(build.status ?? 1);
}
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error(`[publish] ${path.join(distDir, "index.html")} missing after build — aborting.`);
  process.exit(1);
}

fs.mkdirSync(updatesDir, { recursive: true });
console.log(`[publish] zipping ${distDir} -> ${bundlePath}...`);
try {
  execFileSync("tar", ["-a", "-cf", bundlePath, "-C", distDir, "."], { stdio: "inherit" });
} catch (err) {
  console.error("[publish] zip failed (needs bsdtar, bundled with Windows 10+ / macOS / Linux):", err.message);
  process.exit(1);
}

const zipBytes = fs.readFileSync(bundlePath);
const checksum = crypto.createHash("sha256").update(zipBytes).digest("hex");

for (const old of fs.existsSync(updatesDir) ? fs.readdirSync(updatesDir) : []) {
  if (/^bundle-.*\.zip$/.test(old) && old !== bundleName) {
    fs.unlinkSync(path.join(updatesDir, old));
  }
}

const manifest = {
  version,
  file: bundleName,
  checksum,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log("[publish] done.");
console.log("  version :", version);
console.log("  bundle  :", path.relative(process.cwd(), bundlePath));
console.log("  sha256  :", checksum);
console.log("");
console.log("Next: commit backend/updates + push to main, and Render picks it up.");
console.log("Installed apps then GET the bundle from /updates/check on next launch.");