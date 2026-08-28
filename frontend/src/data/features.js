import {
  MessageSquare,
  StickyNote,
  CircleDashed,
  Users,
  Phone,
  Lock,
  Timer,
  Palette,
  ShieldCheck,
  BellRing,
  SwitchCamera,
  WifiOff,
} from "lucide-react";

// The app's main features, ordered from the most used down to the least used.
// Each entry is static "what it does" + "how to use it" content for the in-app
// manual (Settings → Features). Nothing here reads live state — it is a guide.
export const FEATURES = [
  {
    id: "chats",
    icon: MessageSquare,
    title: "Chats & Messaging",
    tagline: "Send messages, photos and voice notes",
    summary:
      "This is the heart of Chatty — private one-to-one conversations with the people in your contact list.",
    steps: [
      "Open the Chats tab at the bottom, then tap New chat to start a conversation.",
      "Type in the box at the bottom and press Enter (or the send button) to deliver your message.",
      "Tap the + button to attach photos or voice notes from your device.",
      "Watch the check marks: one tick = sent, two ticks = delivered, two blue ticks = read.",
      "Messages you send while offline are saved on your device and go out automatically when you're back online.",
    ],
    tip: "Tap any message to reply, react, edit, forward or delete it.",
  },
  {
    id: "notes",
    icon: StickyNote,
    title: "Personal Notes",
    tagline: "A private space that only you can see",
    summary:
      "The 'You' entry at the very top of your chats is your own private note — like texting yourself.",
    steps: [
      "Find the 'You' row at the top of the Chats list and open it.",
      "Send messages, links or reminders into it whenever you need to note something down.",
      "Only you can ever see this conversation — it is never shown to anyone else.",
    ],
    tip: "Great place to save links, to-do lists or ideas that you want in one place.",
  },
  {
    id: "status",
    icon: CircleDashed,
    title: "Status & Updates",
    tagline: "Share fleeting updates that disappear",
    summary:
      "Post a photo or short text that your contacts can view, and it automatically disappears after 24 hours.",
    steps: [
      "Open the Updates tab and tap your own preview to post a new status.",
      "Pick a photo or type a short text update, then tap Send.",
      "View what your contacts have posted by tapping their name in the Updates list.",
      "Your status vanishes on its own after 24 hours — nothing to clean up.",
    ],
    tip: "Statuses are only visible to people you've chosen in your privacy settings.",
  },
  {
    id: "groups",
    icon: Users,
    title: "Groups",
    tagline: "Chat with many people at once",
    summary:
      "Bring friends, family or teammates into one conversation with shared controls.",
    steps: [
      "Tap New chat and choose to create a group, then add the people you want.",
      "Give the group a name and optional photo so it's easy to find.",
      "Use the group info screen to manage members, roles and permissions.",
      "Mention someone with @ to get their attention, even if they were away.",
    ],
    tip: "Group admins can control who can post, add members or change the group.",
  },
  {
    id: "calls",
    icon: Phone,
    title: "Voice & Video Calls",
    tagline: "Talk face to face, one to one or in a group",
    summary:
      "Real-time voice and video calls powered by WebRTC, right from any chat.",
    steps: [
      "Open a chat and tap the phone icon for a voice call, or the video icon for a video call.",
      "While in a call, use the in-call controls to mute, switch camera or end the call.",
      "Group calls let you bring multiple people into one room.",
      "Missed calls show up in the Calls tab so you can call back easily.",
    ],
    tip: "You can keep chatting in the background while a call runs in a floating window.",
  },
  {
    id: "lock",
    icon: Lock,
    title: "Locked Chats",
    tagline: "Hide sensitive chats behind a password",
    summary:
      "Move chosen chats out of your main list so nothing on the home screen hints they exist.",
    steps: [
      "Open Settings → Privacy & Security → Locked Chats and turn on the lock.",
      "Set a password (and a security question in case you forget it).",
      "From a chat's menu, choose to lock it — it leaves your normal list.",
      "Double-tap the Chatty logo in the top bar to open your locked chats.",
    ],
    tip: "Optionally unlock with your fingerprint on supported devices.",
  },
  {
    id: "disappear",
    icon: Timer,
    title: "Disappearing Messages",
    tagline: "Messages that erase themselves",
    summary:
      "Set a timer so new messages automatically delete after a chosen time.",
    steps: [
      "Go to Settings → Privacy & Security → Disappearing Messages.",
      "Pick a default timer (1 hour, 24 hours, 7 or 30 days) for all new chats.",
      "You can also set a one-off timer for a single chat from its header.",
    ],
    tip: "Use this for anything you don't want to leave a permanent trace.",
  },
  {
    id: "appearance",
    icon: Palette,
    title: "Themes & Wallpaper",
    tagline: "Make Chatty look the way you like",
    summary:
      "Choose from many color themes and set a background for every chat.",
    steps: [
      "Open Settings → Appearance → Theme and tap any theme to preview it live.",
      "Open Settings → Appearance → Chat Wallpaper to pick a preset or a photo.",
      "A wallpaper you pick applies to all your chats at once.",
    ],
    tip: "The whole app follows your chosen theme — pick one that's easy on your eyes.",
  },
  {
    id: "privacy",
    icon: ShieldCheck,
    title: "Privacy Controls",
    tagline: "Decide who sees your activity",
    summary:
      "Control what other people can see about you and your activity.",
    steps: [
      "Open Settings → App Preferences to toggle read receipts, online status and typing status.",
      "Open Settings → Privacy & Security → Blocked Contacts to manage who can't reach you.",
      "Turning off read receipts stops others from seeing your blue ticks.",
    ],
    tip: "Settings sync to your account, so they apply on every device you use.",
  },
  {
    id: "notifications",
    icon: BellRing,
    title: "Notifications",
    tagline: "Tune alerts to your liking",
    summary:
      "Choose which kinds of activity you get notified about and how you're alerted.",
    steps: [
      "Open Settings → Appearance → Notifications.",
      "Turn message, group, call and status notifications on or off.",
      "Choose whether previews show message text, and whether you get sound or vibration.",
    ],
    tip: "Turn off previews if you don't want message content on your lock screen.",
  },
  {
    id: "accounts",
    icon: SwitchCamera,
    title: "Multiple Accounts",
    tagline: "Switch between saved accounts",
    summary:
      "Keep several accounts signed in on one device and move between them instantly.",
    steps: [
      "From the account switcher, add another account the first time you sign in.",
      "Tap a saved account to switch to it without typing your details again.",
      "Your chat lists and settings are kept separate per account.",
    ],
    tip: "Handy for keeping work and personal conversations apart.",
  },
  {
    id: "offline",
    icon: WifiOff,
    title: "Works Offline",
    tagline: "Keeps going without signal",
    summary:
      "Recent conversations are cached on your device so you can read them anywhere.",
    steps: [
      "Open the app without internet — your recent chats and messages are still there.",
      "Anything you type or send while offline is queued and delivered when you reconnect.",
      "No special setup needed; it happens automatically.",
    ],
    tip: "Your wallpaper, photos and any applied themes also stay available offline.",
  },
];
