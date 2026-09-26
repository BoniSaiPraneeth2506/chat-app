import { useEffect, useState } from "react";

/**
 * Whether a list has finished loading at least once.
 *
 * Every store this app reads from starts `isLoading…: false` and only flips to
 * true when the fetch is kicked off from an effect. Gating a skeleton purely on
 * that flag therefore shows the *empty* state for one frame on first paint —
 * which is the flash that made the old spinners look like they were appearing
 * after the list had already decided it was empty.
 *
 * Returns true until the flag has been seen false, so the first paint is a
 * skeleton. Once it has settled it stays settled, so a background refresh never
 * flashes a skeleton over a list that is already on screen.
 *
 * @param {boolean} isLoading
 * @returns {boolean} true while the skeleton should be shown
 */
export const useSkeletonGate = (isLoading) => {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!isLoading) setSettled(true);
  }, [isLoading]);

  return !settled;
};
