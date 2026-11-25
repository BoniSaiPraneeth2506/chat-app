import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";

const EMPTY_QUALITY = { level: "good", loss: 0, latency: 0 };

export function useCallQuality(remoteStream) {
  const [quality, setQuality] = useState(EMPTY_QUALITY);

  useEffect(() => {
    if (!remoteStream) {
      setQuality(EMPTY_QUALITY);
      return;
    }

    let previous = null;
    let cancelled = false;

    const readStats = async () => {
      const peerConnection = useChatStore.getState().peerConnection;
      if (!peerConnection || peerConnection.connectionState === "closed") {
        if (!cancelled) setQuality(EMPTY_QUALITY);
        return;
      }

      try {
        const stats = await peerConnection.getStats();
        if (cancelled) return;

        let packetsLost = 0;
        let packetsReceived = 0;
        let latency = 0;

        stats.forEach((report) => {
          const kind = report.kind || report.mediaType;
          if (report.type === "inbound-rtp" && (kind === "video" || kind === "audio")) {
            packetsLost += Number(report.packetsLost) || 0;
            packetsReceived += Number(report.packetsReceived) || 0;
          }

          if (
            report.type === "candidate-pair" &&
            (report.nominated || report.selected) &&
            report.state === "succeeded"
          ) {
            const rtt = Number.isFinite(report.currentRoundTripTime)
              ? report.currentRoundTripTime
              : report.roundTripTime;
            if (Number.isFinite(rtt)) latency = rtt * 1000;
          }
        });

        const total = packetsLost + packetsReceived;
        let loss = 0;
        if (previous && total > previous.total) {
          const lostDelta = Math.max(0, packetsLost - previous.lost);
          const totalDelta = total - previous.total;
          loss = (lostDelta / totalDelta) * 100;
        }
        previous = { lost: packetsLost, total };

        const roundedLoss = Math.round(loss * 10) / 10;
        const roundedLatency = Math.round(latency);
        const level =
          roundedLoss >= 5 || roundedLatency >= 300
            ? "poor"
            : roundedLoss >= 2 || roundedLatency >= 150
              ? "fair"
              : "good";

        setQuality({ level, loss: roundedLoss, latency: roundedLatency });
      } catch {
        if (!cancelled) setQuality(EMPTY_QUALITY);
      }
    };

    readStats();
    const intervalId = setInterval(readStats, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [remoteStream]);

  return quality;
}
