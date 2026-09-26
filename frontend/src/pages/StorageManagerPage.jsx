import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, HardDrive, Trash2, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Dexie from "dexie";
import useAuthStore from "../store/useAuthStore";
import { updateCachedMessage, deleteUserDb } from "../lib/db";
import toast from "react-hot-toast";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

const openUserDb = (userId) => {
  if (!userId) return null;
  const db = new Dexie(`chatty_cache_${userId}`);
  db.version(1).stores({
    messages: "_id, conversationKey, createdAt",
    conversationsMeta: "key",
    outbox: "tempId, conversationKey, createdAt",
  });
  return db;
};

const StatCard = ({ label, value, sub }) => (
  <div className="flex-1 min-w-[120px] rounded-xl p-3 text-center" style={{ backgroundColor: "var(--color-base-200)" }}>
    <span className="block text-lg font-bold" style={{ color: "var(--color-primary)" }}>{value}</span>
    <span className="block text-[11px] font-medium opacity-70">{label}</span>
    {sub && <span className="block text-[10px] opacity-50 mt-0.5">{sub}</span>}
  </div>
);

const StorageManagerPage = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.authUser);
  const userId = authUser?._id;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSize: 0, messageCount: 0, mediaCount: 0, conversationCount: 0 });
  const [duplicates, setDuplicates] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const scan = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const db = openUserDb(userId);
      const messages = await db.messages.toArray();
      const convKeys = new Set(messages.map((m) => m.conversationKey));

      let totalSize = 0;
      let mediaCount = 0;
      const keyMap = {};

      for (const msg of messages) {
        const attachments = msg.attachments || [];
        for (const att of attachments) {
          if (att.size) totalSize += att.size;
          mediaCount++;
          if (att.key) {
            if (!keyMap[att.key]) {
              keyMap[att.key] = { key: att.key, name: att.name, mime: att.mime, count: 0, size: att.size || 0 };
            }
            keyMap[att.key].count++;
          }
        }
        if (msg.image) { mediaCount++; }
        if (msg.images && Array.isArray(msg.images)) { mediaCount += msg.images.length; }
        if (msg.voice) { mediaCount++; }
      }

      setStats({
        totalSize,
        messageCount: messages.length,
        mediaCount,
        conversationCount: convKeys.size,
      });

      const dupGroups = Object.values(keyMap)
        .filter((g) => g.count > 1)
        .sort((a, b) => b.count - a.count);
      setDuplicates(dupGroups);
      setLastScan(new Date());
      db.close();
    } catch (e) {
      console.warn("Storage scan failed:", e);
      toast.error("Failed to scan storage");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { scan(); }, [scan]);

  const cleanDuplicates = async () => {
    if (!userId || duplicates.length === 0) return;
    setCleaning(true);
    try {
      const db = openUserDb(userId);
      const messages = await db.messages.toArray();
      const seenKeys = new Set();
      let cleaned = 0;

      for (const msg of messages) {
        if (!msg.attachments || msg.attachments.length === 0) continue;
        const before = msg.attachments.length;
        const after = [];
        for (const att of msg.attachments) {
          const k = att.key || `${att.name}-${att.mime}`;
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            after.push(att);
          }
        }
        if (after.length < before) {
          await updateCachedMessage(userId, msg._id, { attachments: after });
          cleaned++;
        }
      }

      db.close();
      toast.success(`Cleaned ${cleaned} message(s) — duplicates removed`);
      await scan();
    } catch (e) {
      console.warn("Clean duplicates failed:", e);
      toast.error("Failed to clean duplicates");
    } finally {
      setCleaning(false);
    }
  };

  const clearAllData = async () => {
    if (!userId) return;
    const ok = window.confirm(
      "This will permanently delete ALL cached messages, media metadata, and conversation data on this device.\n\nYou can still access chats online. Continue?"
    );
    if (!ok) return;
    setClearingAll(true);
    try {
      await deleteUserDb(userId);
      setStats({ totalSize: 0, messageCount: 0, mediaCount: 0, conversationCount: 0 });
      setDuplicates([]);
      setLastScan(new Date());
      toast.success("All cached data cleared");
    } catch (e) {
      console.warn("Clear all data failed:", e);
      toast.error("Failed to clear data");
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div
      className="container min-h-screen max-w-3xl px-4 pt-8 pb-12 mx-auto"
      style={{ backgroundColor: "var(--color-base-100)", color: "var(--color-neutral)" }}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full transition-colors hover:bg-base-200"
            title="Back to settings"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid rounded-full place-items-center size-10 bg-primary/10">
              <HardDrive size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Storage Manager</h1>
              <p className="text-xs opacity-60">Manage media cache and duplicate files</p>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ backgroundColor: "var(--color-base-200)" }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-50">
            Cache Summary
          </span>
          <div className="flex gap-3 flex-wrap">
            <StatCard
              label="Estimated Storage"
              value={formatBytes(stats.totalSize)}
              sub="from attachment metadata"
            />
            <StatCard label="Messages" value={stats.messageCount} />
            <StatCard label="Media Items" value={stats.mediaCount} />
            <StatCard label="Conversations" value={stats.conversationCount} />
          </div>
          {lastScan && (
            <p className="text-[10px] opacity-40">
              Last scanned: {lastScan.toLocaleString()}
            </p>
          )}
        </div>

        {/* Duplicate Media Cleaner */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "var(--color-base-200)" }}
        >
          <div className="px-4 pt-4 pb-2 space-y-1">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-50">
                Duplicate Media Cleaner
              </span>
            </div>
            <p className="text-xs opacity-60">
              Identical R2 keys appearing in multiple messages are counted as duplicates below.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md text-primary" />
            </div>
          ) : duplicates.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm opacity-60">
              <CheckCircle size={16} className="text-success shrink-0" />
              No duplicate media found — your cache is clean.
            </div>
          ) : (
            <div className="divide-y divide-base-300/40 max-h-64 overflow-y-auto">
              {duplicates.map((dup) => (
                <div key={dup.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{dup.name || dup.key}</p>
                    <p className="text-[10px] opacity-50 truncate">
                      {dup.mime} &middot; {formatBytes(dup.size)} each
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-base-100)" }}
                  >
                    &times;{dup.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={cleanDuplicates}
            disabled={loading || cleaning || duplicates.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-base-100)" }}
          >
            {cleaning ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <Search size={16} />
            )}
            {cleaning ? "Cleaning duplicates…" : "Clean Duplicates"}
          </button>

          <button
            onClick={clearAllData}
            disabled={loading || clearingAll}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border border-error/40 text-error hover:bg-error/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {clearingAll ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <AlertTriangle size={16} />
            )}
            {clearingAll ? "Clearing all data…" : "Clear All Cached Data"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StorageManagerPage;
