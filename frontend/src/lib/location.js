import { Capacitor } from "@capacitor/core";
import useLocationModalStore from "../store/useLocationModalStore";

/**
 * Opens the interactive map modal for a location message.
 *
 * @param {object} message  The location message (has `.location {lat,lng,...}`).
 * @param {boolean} isLive  Whether it's a live share.
 */
export function openLocationModal(message, isLive = false) {
  const loc = message?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
  useLocationModalStore.getState().openModal(message, isLive);
}

/**
 * Opens the modal in "draft" mode so the user can preview their own live share
 * before it starts (used by the composer's Live Location flow).
 */
export function openLiveDraft({ lat, lng, duration, senderName }) {
  useLocationModalStore.getState().openModal(
    null,
    true,
    { drafting: { lat, lng, isLive: true, duration }, senderName }
  );
}

export function closeLocationModal() {
  useLocationModalStore.getState().closeModal();
}

/**
 * Requests the user's current coordinates. Uses the native Capacitor
 * geolocation plugin when available, otherwise the browser API.
 */
export async function getCurrentPosition() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (err) {
      // Fall through to the browser API.
      console.warn("Capacitor geolocation unavailable:", err?.message);
    }
  }
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Location unavailable")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}
