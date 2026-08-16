// Saved accounts for fast switching.
//
// The app already keeps the active session's JWT in localStorage; this holds
// one entry per signed-in account so you can hop between them without typing a
// password again. Only accounts you have actually signed into on this device
// are ever stored, and "Remove" deletes the token immediately.
const KEY = "savedAccounts";
const MAX_ACCOUNTS = 5;

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (accounts) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)));
  } catch {
    // Storage full or unavailable — switching is a convenience, never fatal.
  }
};

/** Everything needed to render the switcher, without the tokens. */
export const listAccounts = () =>
  read().map(({ _id, fullName, email, profilePic }) => ({ _id, fullName, email, profilePic }));

export const getAccountToken = (userId) => read().find((a) => a._id === userId)?.token || null;

/**
 * Records (or refreshes) an account after a successful sign-in. Re-logging in
 * replaces the stored token, so a stale one never lingers.
 */
export const rememberAccount = (user, token) => {
  if (!user?._id || !token) return;
  const others = read().filter((a) => a._id !== user._id);
  write([
    {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic || "",
      token,
    },
    ...others,
  ]);
};

export const forgetAccount = (userId) => write(read().filter((a) => a._id !== userId));

export const clearAccounts = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
