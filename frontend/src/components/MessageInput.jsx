import { useRef, useState, useEffect } from "react";
import GifPicker from "./GifPicker";
import AttachMenu from "./AttachMenu";
import ContactPickerSheet from "./ContactPickerSheet";
import LocationPicker from "./LocationPicker";
import {
  fetchUploadLimits,
  validateFile,
  formatBytes,
  createLocalUrl,
  releaseLocalUrl,
  captureVideoPoster,
} from "../lib/attachments";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import useAuthStore from "../store/useAuthStore";
import { Image, Send, X, CornerDownLeft, Mic, Trash2, Lock, Clock, BarChart3, Pencil, EyeOff, Paperclip, FileText, Video, Loader, ShieldCheck, MoreHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { haptic } from "../lib/haptics";
import { focusWithKeyboard } from "../lib/keyboard";
import ImageEditorModal from "./ImageEditorModal";
import CreatePollModal from "./CreatePollModal";
import SchedulePicker from "./SchedulePicker";
import { transcribeSpeech } from "../lib/sarvamApi";

// About five lines; past that the field scrolls instead of pushing the chat up.
const MAX_INPUT_HEIGHT = 112;

const MessageInput = () => {
  const [text, setText] = useState("");
  // Mentions are tracked explicitly rather than re-parsed from the text, so a
  // name that merely looks like "@someone" never notifies a real person.
  const [mentionIds, setMentionIds] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // null = picker closed

  // The GIF command the composer is currently showing, or null.
  //
  //   /giphy            trending GIFs
  //   /giphy happy      GIFs for "happy"
  //   /stickers         trending stickers
  //   /stickers cat     stickers for "cat"
  //   /cat              GIFs for "cat" — any other single word is read as a search
  //
  // Only ever recognised when the whole composer holds just the command, so a "/"
  // typed in the middle of a sentence is left alone.
  const [gifCommand, setGifCommand] = useState(null);
  const [imagePreviews, setImagePreviews] = useState([]);
  // Index of the preview being edited, or null. Held by index rather than by
  // value so the edited result can be written straight back into place.
  const [editingIndex, setEditingIndex] = useState(null);
  // Armed per message rather than sticky, so a member cannot forget it is on and
  // post the rest of a conversation namelessly by accident.
  const [askAnonymously, setAskAnonymously] = useState(false);
  const [isOneView, setIsOneView] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [isSendingAnimation, setIsSendingAnimation] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  // Captured-on-device media: a live-camera photo and a short video note. These
  // keep their own inputs so they can force `capture` without changing what the
  // Gallery / Videos pickers offer.
  const cameraInputRef = useRef(null);
  const videoNoteInputRef = useRef(null);

  // The attachment menu, the contact picker, and the one large file being sent.
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  // Mobile-only: Forward and Schedule collapse into one toggle, so a small
  // screen keeps the composer from crowding. Desktop keeps both inline.
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [limits, setLimits] = useState({ enabled: false });
  // A chosen video or document waiting to be sent: { file, kind, previewUrl }.
  // Nothing is uploaded until the send button is pressed, the same as a photo.
  const [stagedFile, setStagedFile] = useState(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  // Whether the other side has already been told we're typing. Without this every
  // keystroke emitted its own socket event, and each one made the recipient's
  // sidebar and chat header re-render.
  const typingSentRef = useRef(false);
  // A draft write goes into the shared store, which the sidebar reads for its
  // preview — so writing per keystroke re-rendered the whole conversation list on
  // every character. Held here and flushed on a trailing timer instead; a preview
  // a third of a second behind is invisible, the stutter was not.
  const draftTimerRef = useRef(null);
  const pendingDraftRef = useRef(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  // HD default used when a photo is picked straight (no edits); the pencil edit
  // screen lets it be switched to Standard per photo before sending.
  const [hdQuality] = useState(
    () => localStorage.getItem("chat-hd-quality") === "1"
  );
  // Long-press voice dictation (tap = voice note, hold = speak-to-text).
  // Where the Web Speech API exists (Chrome / Android Chrome), words stream
  // straight into the composer as they are said; otherwise a MediaRecorder
  // clip is transcribed once on release, exactly as before.
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecorderRef = useRef(null);
  const dictationStreamRef = useRef(null);
  const dictationChunksRef = useRef([]);
  const dictationLongPressRef = useRef(null);
  const dictationActiveRef = useRef(false);
  const dictationLiveRef = useRef(null); // SpeechRecognition instance
  const dictationStartedAtRef = useRef(0);
  const dictationReleasedAtRef = useRef(0);
  const dictationBaseTextRef = useRef(""); // composer text when dictation began
  const dictationVoiceRef = useRef(""); // recognised words (final results)
  const dictationInterimRef = useRef(""); // words still being recognised
  // Poll composer
  const [showPollModal, setShowPollModal] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  // Scheduling states
  const [scheduledAt, setScheduledAt] = useState(""); // format: yyyy-MM-ddTHH:mm (datetime-local)
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  
  const { 
    sendMessage, 
    replyingToMessage, 
    setReplyingToMessage, 
    editingMessage,
    setEditingMessage,
    editMessage,
    sendTypingStatus, 
    sendAttachmentMessage,
    selectedUser,
    drafts,
    setDraft
  } = useChatStore();

  const {
    selectedGroup,
    sendGroupMessage,
    sendGroupTypingStatus,
  } = useGroupStore();

  const { authUser } = useAuthStore();

  const isBlocked = authUser?.blockedUsers?.includes(selectedUser?._id);

  // Evaluate Read-Only Group Restrictions
  let isReadOnlyRestricted = false;
  if (selectedGroup && selectedGroup.isReadOnly) {
    const member = selectedGroup.members?.find((m) => (m.user?._id || m.user)?.toString() === authUser?._id?.toString());
    if (member && member.role === "member") {
      isReadOnlyRestricted = true;
    }
  }

  // Load draft when switching users.
  //
  // Keyed on the id, not the object: selectedUser is replaced wholesale whenever
  // the sidebar refreshes or the contact's presence changes, and re-running this
  // then would overwrite whatever is currently being typed. The cleanup commits
  // any draft still waiting on its timer, so leaving a chat mid-sentence keeps it.
  useEffect(() => {
    if (selectedUser) {
      setText(drafts[selectedUser._id] || "");
    } else {
      setText("");
    }
    setGifCommand(null);
    setStagedFile((current) => {
      if (current?.previewUrl) releaseLocalUrl(current.previewUrl);
      return null;
    });
    return () => flushDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?._id]);

  // Never carries across groups: leaving with it armed and returning later would
  // silently anonymise the next thing typed.
  useEffect(() => {
    setAskAnonymously(false);
  }, [selectedGroup?._id]);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
      if (replyingToMessage) setReplyingToMessage(null); // Cancel reply if editing
      // Raise the keyboard, and put the caret after the existing text so the
      // edit can be continued rather than overtyped.
      requestAnimationFrame(() => focusWithKeyboard(inputRef.current));
    }
  }, [editingMessage]);

  // Replying always surfaces the composer, whether triggered by a swipe or by
  // tapping the reply action. Raising the keyboard here makes the gesture feel
  // deliberate (WhatsApp does the same): the moment a reply is armed the caret
  // lands in an already-focused field instead of the user having to tap again.
  // With the caret at the end, continued typing prefaces the quoted message.
  useEffect(() => {
    if (!replyingToMessage) return;
    requestAnimationFrame(() => focusWithKeyboard(inputRef.current));
  }, [replyingToMessage?._id]);

  useEffect(() => {
    // Reset typing status and recording on unmount
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);

  // Height is recomputed from scrollHeight rather than tracked as a line count:
  // wrapping depends on the rendered width, which only the browser knows. Reset
  // to auto first, or scrollHeight keeps reporting the previous larger height and
  // the field can only ever grow.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || el.tagName !== "TEXTAREA") return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [text]);

  const handleKeyDown = (e) => {
    // A textarea does not submit on Enter the way an input in a form does, so
    // that behaviour is restored explicitly. Shift+Enter is what a multi-line
    // field needs for a deliberate newline.
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !isMobile) {
      e.preventDefault();
      handleSendMessage({ preventDefault: () => {} });
      return;
    }

    if (isMobile) return;
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      // simulate submit
      const fakeEvent = { preventDefault: () => {} };
      handleSendMessage(fakeEvent);
    }
    // ArrowUp to edit last message when input empty
    if (e.key === 'ArrowUp' && !text.trim()) {
      try {
        const last = useChatStore.getState().messages?.slice().reverse().find(m => (m.senderId?._id || m.senderId) === useAuthStore.getState().authUser?._id && m.text);
        if (last) setEditingMessage(last);
      } catch (err) {}
    }
  };

  const addImageFiles = (files) => {
    if (files.length === 0) return;

    if (imagePreviews.length + files.length > 5) {
      toast.error("You can select up to 5 images per message");
      return;
    }

    const nonImage = files.find(f => !f.type.startsWith("image/"));
    if (nonImage) {
      toast.error("Please select only image files");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        compressImage(reader.result);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = (e) => {
    addImageFiles(Array.from(e.target.files));
  };

  // Ctrl/Cmd+V of files anywhere in the chat: images go to the image tray,
  // videos and documents are staged for send (one at a time, same as the
  // attachment menu).
  const handlePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length === 0) return;
    e.preventDefault();
    routeDroppedFiles(files);
  };

  const handleDragOver = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    setIsDraggingFiles(true);
  };

  const handleDrop = (e) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    setIsDraggingFiles(false);
    routeDroppedFiles(Array.from(e.dataTransfer.files));
  };

  /**
   * Routes pasted or dropped files to the right place: images are batched
   * into the image tray (up to 5), while a video or document replaces
   * whatever is already staged.
   */
  const routeDroppedFiles = (files) => {
    if (files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith("image/"));
    const others = files.filter((f) => !f.type.startsWith("image/"));

    if (images.length > 0) addImageFiles(images);

    if (others.length > 0 && limits.enabled) {
      const file = others[others.length - 1];
      const check = validateFile(file, limits);
      if (!check.valid) {
        toast.error(check.reason);
        return;
      }
      setStagedFile((current) => {
        if (current?.previewUrl) releaseLocalUrl(current.previewUrl);
        return {
          file,
          kind: check.kind,
          previewUrl: check.kind === "document" ? "" : createLocalUrl(file),
          poster: "",
        };
      });
      if (check.kind === "video") {
        captureVideoPoster(file).then((poster) => {
          if (!poster) return;
          setStagedFile((current) =>
            current && current.file === file ? { ...current, poster } : current
          );
        });
      }
    } else if (others.length > 0 && !limits.enabled) {
      toast.error("File sharing is not set up on this server yet");
    }
  };

  // Paste and drag-and-drop are window level so the whole chat window is a drop target.
  useEffect(() => {
    if (isBlocked || isReadOnlyRestricted) return;

    const onDragLeave = (e) => {
      if (e.relatedTarget === null) setIsDraggingFiles(false);
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [imagePreviews, isBlocked, isReadOnlyRestricted, limits]);

  const compressImage = (base64, quality = hdQuality ? 0.95 : 0.6) => {
    const img = document.createElement("img");
    img.src = base64;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      // HD keeps more of the source detail (a 1400px cap); Standard stays at the
      // historical 600px so a chat full of photos stays fast to open.
      const maxSize = hdQuality ? 1400 : 600;

      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      setImagePreviews(prev => [...prev, { src: compressedBase64, hd: hdQuality }].slice(0, 5));
    };
  };

  const removeImage = (indexToRemove) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (imagePreviews.length <= 1) {
      setIsOneView(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // The caps and allowed types come from the server so the composer refuses
  // exactly what the server would, rather than keeping its own copy that can drift.
  useEffect(() => {
    let cancelled = false;
    fetchUploadLimits().then((next) => {
      if (!cancelled) setLimits(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Stages a chosen video or document.
   *
   * Nothing is uploaded here. A file gets the same two steps a photo already had —
   * see it first, then send it — which also leaves room to type a caption, and
   * means picking the wrong file costs nothing. The upload starts on send, and its
   * progress appears on the bubble in the conversation.
   */
  const handleBucketFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so picking the same file twice still fires
    if (!file) return;

    const check = validateFile(file, limits);
    if (!check.valid) {
      toast.error(check.reason);
      return;
    }

    // Replaces anything already staged: one file at a time keeps the composer
    // honest about what pressing send will do.
    setStagedFile((current) => {
      if (current?.previewUrl) releaseLocalUrl(current.previewUrl);
      return {
        file,
        kind: check.kind,
        previewUrl: check.kind === "document" ? "" : createLocalUrl(file),
        poster: "",
      };
    });

    // A frame off the video, so the card and then the bubble show the clip rather
    // than a black rectangle. Runs alongside rather than blocking the preview.
    if (check.kind === "video") {
      captureVideoPoster(file).then((poster) => {
        if (!poster) return;
        setStagedFile((current) =>
          current && current.file === file ? { ...current, poster } : current
        );
      });
    }
  };

  const clearStagedFile = () => {
    setStagedFile((current) => {
      if (current?.previewUrl) releaseLocalUrl(current.previewUrl);
      return null;
    });
  };

  /** What the attachment menu does with each choice. */
  const handleAttachPick = (id) => {
    setIsAttachOpen(false);
    if (id === "gallery") {
      fileInputRef.current?.click();
      return;
    }
    if (id === "camera") {
      cameraInputRef.current?.click();
      return;
    }
    if (id === "contact") {
      setIsContactOpen(true);
      return;
    }
    if (id === "location") {
      setIsLocationOpen(true);
      return;
    }
    // GIFs and stickers never upload a file — the bubble keeps GIPHY's URL — so
    // they do not need the bucket-based file sharing the other kinds do.
    if (id === "gifs" || id === "stickers") {
      setGifCommand({ kind: id === "gifs" ? "gifs" : "stickers", query: "" });
      return;
    }
    if (!limits.enabled) {
      toast.error("File sharing is not set up on this server yet");
      return;
    }
    if (id === "video") videoInputRef.current?.click();
    if (id === "video_note") videoNoteInputRef.current?.click();
    if (id === "document") docInputRef.current?.click();
  };

  /** Sends a contact card. No upload — it is a reference to an account. */
  const handleContactPick = async (user) => {
    setIsContactOpen(false);
    try {
      const payload = { contact: { user: user._id } };
      if (selectedGroup) {
        await sendGroupMessage({ ...payload, replyTo: replyingToMessage?._id || null, mentions: [] });
      } else {
        await sendMessage(payload);
      }
      if (replyingToMessage) setReplyingToMessage(null);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not share that contact");
    }
  };

  /** Writes whatever draft is waiting, for the chat it was typed in. */
  const flushDraft = () => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const pending = pendingDraftRef.current;
    pendingDraftRef.current = null;
    if (pending) setDraft(pending.userId, pending.text);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const command = parseGifCommand(val);
    setGifCommand(command);
    if (selectedUser) {
      // The id is captured now, so a draft still in flight when the user switches
      // chats lands under the conversation it was actually typed in. A command is
      // stored as an empty draft rather than skipped, so it also clears whatever
      // was there before — the composer no longer holds that text either.
      pendingDraftRef.current = { userId: selectedUser._id, text: command ? "" : val };
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(flushDraft, 350);
    }

    // Emit typing status to socket — once when it starts, not once per character.
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      sendTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      typingSentRef.current = false;
      sendTypingStatus(false);
    }, 1500);
  };

  /**
   * Reads a slash command out of the composer.
   *
   * Deliberately strict: the text has to be nothing but the command, so "10/giphy"
   * or "see /cat later" are ordinary text. A bare "/" shows nothing until there is
   * a word after it, which keeps the picker from flashing open on the keystroke
   * that starts a command.
   */
  /**
   * Sends a picked GIF.
   *
   * It travels as the message's image, which is what lets every existing part of
   * the app treat it as one: the bubble renders it, the lightbox opens it, reply,
   * forward, delete and the sidebar preview all work untouched. The URL is
   * GIPHY's own and stays that way — the server accepts it from an allowlisted
   * host rather than copying the file into our storage.
   */
  const sendGif = async (item) => {
    const wasCommand = text;
    setText("");
    setGifCommand(null);

    try {
      if (selectedGroup) {
        await sendGroupMessage({
          image: item.url,
          replyTo: replyingToMessage?._id || null,
          mentions: [],
        });
      } else {
        await sendMessage({ image: item.url });
      }
      if (replyingToMessage) setReplyingToMessage(null);
    } catch (error) {
      console.error("Failed to send GIF", error);
      toast.error("Could not send that GIF");
      // Put the command back so the picker reopens where it was.
      setText(wasCommand);
      setGifCommand(parseGifCommand(wasCommand));
    }
  };

  const parseGifCommand = (value) => {
    const match = /^\/([a-z0-9_-]{1,24})(?:\s+(.{0,50}))?$/i.exec(value.trim());
    if (!match) return null;

    const word = match[1].toLowerCase();
    const rest = (match[2] || "").trim();

    if (word === "giphy" || word === "gif" || word === "gifs") {
      return { kind: "gifs", query: rest };
    }
    if (word === "stickers" || word === "sticker") {
      return { kind: "stickers", query: rest };
    }
    // Anything else is the search itself, which is what makes "/cat" work.
    return { kind: "gifs", query: rest ? `${word} ${rest}` : word };
  };

  // Opens the picker when the caret sits on an "@word" and we're in a group.
  const handleMentionScan = (value) => {
    if (!selectedGroup) return setMentionQuery(null);
    const match = /(?:^|\s)@([\w]*)$/.exec(value);
    setMentionQuery(match ? match[1].toLowerCase() : null);
  };

  const mentionCandidates =
    selectedGroup && mentionQuery !== null
      ? (selectedGroup.members || [])
          .map((m) => m.user)
          .filter(Boolean)
          .filter((u) => u._id !== authUser?._id)
          .filter((u) => (u.fullName || "").toLowerCase().includes(mentionQuery))
          .slice(0, 6)
      : [];

  const applyMention = (user) => {
    // Replace the partial "@word" the caret is sitting on with the full name.
    const next = text.replace(/(?:^|\s)@[\w]*$/, (m) =>
      `${m.startsWith(" ") ? " " : ""}@${user.fullName} `
    );
    setText(next);
    setMentionIds((prev) => (prev.includes(user._id) ? prev : [...prev, user._id]));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // One tap opens the themed picker; tapping again closes it, or clears an
  // armed schedule. The native datetime-local popup was dropped because it is
  // drawn by the browser and cannot be styled to match the app.
  const openSchedulePicker = () => {
    if (scheduledAt) {
      setScheduledAt("");
      setIsSchedulerOpen(false);
      return;
    }
    setIsSchedulerOpen((open) => !open);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && imagePreviews.length === 0 && !stagedFile) return;

    haptic("tap");

    const messageText = text.trim();
    const currentImages = [...imagePreviews];
    const currentStaged = stagedFile;
    const messageOneView = isOneView;
    const messageSensitive = sensitive;
    const currentEditing = editingMessage;

    // A bare slash command is the picker's input, not a message. Sending it would
    // post the literal "/giphy" into the conversation.
    if (gifCommand && imagePreviews.length === 0 && !stagedFile) return;

    // Clear text & draft instantly
    setText("");
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    pendingDraftRef.current = null;
    if (selectedUser) {
      setDraft(selectedUser._id, "");
    }
    // Cleared straight away, including for an upload still in flight: the picture
    // is already in the conversation as a sending bubble, and leaving the
    // thumbnails above the input showed it in two places at once.
    setImagePreviews([]);
    setIsOneView(false);
    setSensitive(false);
    setShowMoreOptions(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingSentRef.current = false;
    sendTypingStatus(false);
    
    setIsSendingAnimation(true);
    setTimeout(() => setIsSendingAnimation(false), 250);

    try {
      if (currentStaged) {
        // The file goes to the conversation as a sending bubble; the typed text
        // rides along as its caption.
        setStagedFile(null);
        if (replyingToMessage) setReplyingToMessage(null);
        await sendAttachmentMessage({
          file: currentStaged.file,
          kind: currentStaged.kind,
          text: messageText,
          localUrl: currentStaged.previewUrl,
          posterUrl: currentStaged.poster || "",
          restricted: messageSensitive,
        });
      } else if (currentEditing) {
        // Checked ahead of selectedGroup: an edit is an edit in both DMs and
        // groups. With the group branch first, submitting an edit in a group
        // sent a brand new message instead, which is where the duplicates came
        // from.
        await editMessage(currentEditing._id, messageText);
        setEditingMessage(null);
      } else if (selectedGroup) {
        await sendGroupMessage({
          text: messageText,
          image: currentImages[0]?.src || "",
          images: currentImages.length > 1 ? currentImages.map((i) => i.src) : [],
          replyTo: replyingToMessage?._id || null,
          mentions: mentionIds,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          isAnonymous: askAnonymously && selectedGroup?.allowAnonymousQuestions === true,
        });
        setAskAnonymously(false);
        setMentionIds([]);
        setScheduledAt("");
        if (replyingToMessage) setReplyingToMessage(null);
      } else {
        if (currentImages.length > 0) {
          // Progress and cancel live on the bubble in the conversation now, so
          // nothing about the upload is held here.
          try {
            await useChatStore.getState().sendMessageWithProgress({
              text: messageText,
              image: currentImages[0]?.src || "",
              images: currentImages.length > 1 ? currentImages.map((i) => i.src) : [],
              isOneView: messageOneView,
              restricted: messageSensitive,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            });
            setScheduledAt("");
          } catch (err) {
            if (err.message === 'aborted') {
              toast.error('Upload cancelled');
            } else {
              console.error('Failed to send message with progress', err);
              toast.error('Failed to send');
            }
          } finally {
            setImagePreviews([]);
            setIsOneView(false);
            setSensitive(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        } else {
          if (currentImages.length > 1) {
            await sendMessage({
              text: messageText,
              images: currentImages.map((i) => i.src),
              isOneView: false, // Multi-image doesn't use View Once
              restricted: messageSensitive,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            });
            setScheduledAt("");
          } else {
            await sendMessage({
              text: messageText,
              image: currentImages[0] || "",
              isOneView: messageOneView,
              restricted: messageSensitive,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
            });
            setScheduledAt("");
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      const sentAFile = Boolean(currentStaged) || currentImages.length > 0;
      if (!sentAFile) {
        // Send moves focus to the button, which drops the keyboard on Android.
        // Returning focus keeps it up until the user dismisses it themselves,
        // matching how sending a normal message behaves.
        inputRef.current?.focus();
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          try {
            await sendMessage({
              voice: base64Audio
            });
          } catch (error) {
            console.error("Failed to send voice message:", error);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      typingSentRef.current = false;
      sendTypingStatus("recording");

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev + 1 > MAX_VOICE_SECONDS) {
            stopRecording(true);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    typingSentRef.current = false;
    sendTypingStatus(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {
          // Discard
        };
      }
      mediaRecorderRef.current.stop();
    }
  };

  // Voice-note clips cap at fifteen seconds — the visualizer counts up to the
  // 00:15 limit and the clip is sent automatically the moment it is reached.
  const MAX_VOICE_SECONDS = 15;
  const formatTimer = (secs) =>
    `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  // Uneven on purpose: a constant pulse reads as an alert, a ragged wave reads
  // as the voice being heard. The animation adds the motion on top.
  const BAR_HEIGHTS = [42, 78, 55, 92, 38, 66, 82, 48, 96, 46, 70, 34, 86, 58, 74, 40, 100, 62, 44, 78, 50, 88, 60, 36, 72];

  // ── Voice dictation (long-press the mic) ──────────────────────────────────
  //
  // Preferred path: the Web Speech API, which hands words back live — every
  // result rebuilds the composer text from the recogniser's full transcript so
  // what you said enters the input as you are still saying it (finals stay,
  // half-spoken words flash in and settle). If the WebView has no Speech
  // Recognition, it falls back to a MediaRecorder clip that is transcribed
  // once on release through /api/ai/speech-to-text (Sarvam saaras:v3).
  const startLiveDictation = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    try {
      const rec = new SR();
      rec.lang = "en-IN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      dictationBaseTextRef.current = text;
      dictationVoiceRef.current = "";
      dictationInterimRef.current = "";

      rec.onresult = (e) => {
        // Rebuild the whole recognised text every event — no accumulation, so
        // a word that goes interim→final can only ever appear once.
        let finals = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const alt = e.results[i]?.[0];
          const chunk = (alt?.transcript || "").trim();
          if (!chunk) continue;
          if (e.results[i].isFinal) finals += (finals ? " " : "") + chunk;
          else interim += (interim ? " " : "") + chunk;
        }
        dictationVoiceRef.current = finals;
        dictationInterimRef.current = interim;
        setText([dictationBaseTextRef.current, finals, interim].filter(Boolean).join(" "));
      };

      rec.onerror = (e) => {
        const code = e?.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          toast.error("Microphone access was blocked");
        }
        // no-speech / aborted / audio-capture end silently — onend finalises.
      };

      rec.onend = () => {
        // The recogniser may end without a final event for the last words; keep
        // whatever was heard either way, then release the UI.
        setText([dictationBaseTextRef.current, dictationVoiceRef.current, dictationInterimRef.current].filter(Boolean).join(" "));
        dictationInterimRef.current = "";
        if (dictationLiveRef.current === rec) dictationLiveRef.current = null;
        setIsDictating(false);
        dictationActiveRef.current = false;
        sendTypingStatus(false);
      };

      rec.start();
      dictationLiveRef.current = rec;
      dictationStartedAtRef.current = Date.now();
      setIsDictating(true);
      dictationActiveRef.current = true;
      haptic("tap");
      return true;
    } catch (err) {
      console.error("Live dictation failed to start:", err);
      dictationLiveRef.current = null;
      setIsDictating(false);
      dictationActiveRef.current = false;
      return false;
    }
  };

  const stopLiveDictation = () => {
    const rec = dictationLiveRef.current;
    if (!rec) return;
    try {
      rec.stop(); // onend commits the final text and releases the UI
    } catch {
      dictationLiveRef.current = null;
      setIsDictating(false);
      dictationActiveRef.current = false;
    }
  };

  const startDictation = async () => {
    if (startLiveDictation()) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      dictationChunksRef.current = [];
      const mime =
        typeof MediaRecorder.isTypeSupported === "function"
          && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      dictationRecorderRef.current = mediaRecorder;
      dictationStreamRef.current = stream;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) dictationChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        dictationStreamRef.current = null;
        dictationRecorderRef.current = null;
        finishDictation(mime);
      };
      mediaRecorder.start();
      setIsDictating(true);
      dictationActiveRef.current = true;
      sendTypingStatus("recording");
    } catch (err) {
      console.error("Dictation mic error:", err);
      toast.error("Could not access microphone");
      setIsDictating(false);
    }
  };

  const stopDictation = () => {
    if (dictationLiveRef.current) {
      stopLiveDictation();
      return;
    }
    const rec = dictationRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else finishDictation("audio/webm");
  };

  const finishDictation = async (mime) => {
    setIsDictating(false);
    dictationActiveRef.current = false;
    sendTypingStatus(false);
    const blob = new Blob(dictationChunksRef.current, { type: mime });
    dictationChunksRef.current = [];
    if (blob.size === 0) return;
    try {
      const reader = new FileReader();
      const base64Audio = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { text: spoken } = await transcribeSpeech(base64Audio, mime);
      if (spoken && spoken.trim()) {
        setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")} ${spoken.trim()}` : spoken.trim()));
      }
    } catch (err) {
      console.error("Dictation transcription error:", err);
      toast.error("Couldn't hear that — try speaking a little closer");
    }
  };

  const dictationHoldStart = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    // Touch already armed the press (mousedown is a later synthetic echo on
    // Android); keep a single timer so a real long-press never cancels itself.
    if (dictationLongPressRef.current) return;
    const t = setTimeout(() => {
      dictationLongPressRef.current = null;
      startDictation();
    }, 420);
    dictationLongPressRef.current = t;
  };

  const dictationHoldEnd = () => {
    if (dictationLongPressRef.current) {
      clearTimeout(dictationLongPressRef.current);
      dictationLongPressRef.current = null;
    }
  };

  // Releasing the press commits whatever was recognised. Remembers the moment
  // so the synthetic click that follows a long-press never sends or re-triggers.
  const releaseDictation = () => {
    dictationHoldEnd();
    if (dictationActiveRef.current) {
      stopDictation();
      dictationReleasedAtRef.current = Date.now();
    }
  };

  if (isBlocked) {
    return (
      <div className="w-full px-4 py-4 flex items-center justify-center text-sm font-medium border-t border-base-300">
        <span>You have blocked this user. Unblock to send messages.</span>
      </div>
    );
  }

  if (isReadOnlyRestricted) {
    return (
      <div className="w-full px-4 py-4 flex items-center justify-center text-sm text-amber-500 font-medium border-t border-base-300 gap-2 select-none">
        <Lock size={16} />
        <span>Only Admins and Moderators can send messages in this group.</span>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-3 flex flex-col gap-2 relative border-t border-base-300 lg:border-t-0">
      {editingIndex !== null && imagePreviews[editingIndex] && (
        <ImageEditorModal
          key={editingIndex}
          src={imagePreviews[editingIndex].src}
          initialHd={imagePreviews[editingIndex].hd ?? hdQuality}
          onCancel={() => setEditingIndex(null)}
          onSave={(edited, chosenHd) => {
            setImagePreviews((prev) =>
              prev.map((v, i) =>
                i === editingIndex ? { src: edited, hd: Boolean(chosenHd) } : v
              )
            );
            setEditingIndex(null);
          }}
        />
      )}

      {showPollModal && <CreatePollModal onClose={() => setShowPollModal(false)} />}
      {isDraggingFiles && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 px-8 py-6 border-2 border-dashed border-primary rounded-2xl bg-base-100 shadow-xl">
            <Paperclip size={28} className="text-primary" />
            <span className="text-sm font-semibold">Drop files to attach</span>
            <span className="text-xs">Images, videos, or documents</span>
          </div>
        </div>
      )}
      {/* Quoted Reply Banner */}
        {replyingToMessage && (
          <div className="flex items-center justify-between px-4 py-2 border-l-4 border-primary rounded-r-lg mb-1 relative text-left">
            <div className="text-xs">
              <span className="text-primary font-semibold select-none flex items-center gap-1">
                <CornerDownLeft size={10} />
                Replying to {replyingToMessage.senderId === authUser?._id ? "yourself" : selectedUser?.fullName}
              </span>
              <p className="truncate max-w-[200px] sm:max-w-[400px] mt-0.5">
                {replyingToMessage.text || (replyingToMessage.image ? "📷 Photo" : replyingToMessage.voice ? "🎙️ Voice Message" : "Message")}
              </p>
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setReplyingToMessage(null);
              }}
              onClick={() => setReplyingToMessage(null)}
              className="p-3 -m-1 hover:bg-base-300 active:bg-base-300 rounded-full transition-colors flex items-center justify-center"
              title="Cancel reply"
              aria-label="Cancel reply"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {/* Editing Message Banner */}
        {editingMessage && (
          <div className="flex items-center justify-between px-4 py-2 border-l-4 border-warning rounded-r-lg mb-1 relative text-left">
            <div className="text-xs">
              <span className="text-warning font-semibold select-none flex items-center gap-1">
                Editing Message
              </span>
              <p className="truncate max-w-[200px] sm:max-w-[400px] mt-0.5">
                {editingMessage.text}
              </p>
            </div>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setEditingMessage(null);
              }}
              onClick={() => setEditingMessage(null)}
              className="p-3 -m-1 hover:bg-base-300 active:bg-base-300 rounded-full transition-colors flex items-center justify-center"
              title="Cancel edit"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {sensitive && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl s-tile">
            <ShieldCheck size={14} className="text-error shrink-0" />
            <span className="flex-1 text-xs text-base-content">
              Forwarding, downloads &amp; copy disabled for this message
            </span>
            <button
              type="button"
              onClick={() => setSensitive(false)}
              className="p-1 rounded-full t-dim hover:text-base-content"
              aria-label="Cancel sensitive mode"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {askAnonymously && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-xl s-tile">
            <EyeOff size={14} className="text-primary shrink-0" />
            <span className="flex-1 text-xs text-base-content">
              Your name will not be shown on this message
            </span>
            <button
              type="button"
              onClick={() => setAskAnonymously(false)}
              className="p-1 rounded-full t-dim hover:text-base-content"
              aria-label="Cancel anonymous"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {imagePreviews.length > 0 && (
          <div className="flex items-center gap-2 mb-1 overflow-x-auto pb-1 max-w-full animate-in slide-in-from-bottom duration-200">
            {imagePreviews.map((img, idx) => (
              <div key={idx} className="relative shrink-0">
                <img
                  src={img.src}
                  alt={`Preview ${idx + 1}`}
                  className="object-cover w-24 h-24 rounded-xl"
                />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm
                  flex items-center justify-center hover:bg-black/75 transition-colors"
                  type="button"
                  title="Remove"
                >
                  <X className="size-3.5 text-white" />
                </button>
                {(
                  <button
                    onClick={() => { haptic("tap"); setEditingIndex(idx); }}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition-colors"
                    type="button"
                    title="Edit photo"
                  >
                    <Pencil className="size-3.5 text-white" />
                  </button>
                )}
                {/* Quality of this photo: set in the pencil editor, or the
                    remembered default when it was picked straight. */}
                <span
                  className={`absolute bottom-1 left-1 w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-[10px] tracking-wide select-none ${
                    img.hd
                      ? "bg-emerald-500 text-white"
                      : "bg-base-300/85 backdrop-blur-sm text-base-content"
                  }`}
                  title={img.hd ? "HD photo" : "Standard photo"}
                >
                  {img.hd ? "HD" : "SD"}
                </span>
                {imagePreviews.length === 1 && (
                  <button
                    onClick={() => setIsOneView(!isOneView)}
                    className={`absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-all select-none
                      ${isOneView
                        ? "bg-emerald-500 text-white scale-110"
                        : "bg-black/55 backdrop-blur-sm text-white hover:bg-black/75"
                      }
                    `}
                    title={isOneView ? "View Once Photo enabled" : "Set as View Once Photo"}
                    type="button"
                  >
                    1
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* A staged video or document: seen before it is sent, exactly like a
            photo, and not uploaded until the send button is pressed. */}
        {stagedFile && (
          <div className="relative flex items-center gap-3 px-3 py-2.5 mb-1 rounded-2xl s-chip">
            {stagedFile.kind === "video" ? (
              stagedFile.poster ? (
                <img
                  src={stagedFile.poster}
                  alt=""
                  className="object-cover w-20 h-20 rounded-xl bg-black shrink-0"
                />
              ) : (
                <video
                  src={stagedFile.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="object-cover w-20 h-20 rounded-xl bg-black shrink-0"
                />
              )
            ) : stagedFile.kind === "image" ? (
              <img
                src={stagedFile.previewUrl}
                alt=""
                className="object-cover w-20 h-20 rounded-xl shrink-0"
              />
            ) : (
              <span className="grid w-20 h-20 rounded-xl place-items-center s-tile shrink-0">
                <FileText size={22} className="text-primary" />
              </span>
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-[12.5px] font-medium truncate text-base-content">
                {stagedFile.file.name}
              </span>
              <span className="block text-[10.5px] mt-0.5 t-dim">
                {formatBytes(stagedFile.file.size)} · ready to send
              </span>
              <span className="block text-[10.5px] mt-1 t-dim">
                Add a caption, or press send
              </span>
            </span>
            <button
              type="button"
              onClick={clearStagedFile}
              className="icon-btn grid size-7 shrink-0 place-items-center rounded-full"
              title="Remove"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {isAttachOpen && (
          <AttachMenu onPick={handleAttachPick} onClose={() => setIsAttachOpen(false)} />
        )}

        {isLocationOpen && (
          <LocationPicker onClose={() => setIsLocationOpen(false)} />
        )}

        {isContactOpen && (
          <ContactPickerSheet
            onPick={handleContactPick}
            onClose={() => setIsContactOpen(false)}
          />
        )}

        {/* GIF and sticker picker — floats above the composer, so nothing in the
            conversation moves to make room for it. */}
        {gifCommand && (
          <GifPicker
            kind={gifCommand.kind}
            query={gifCommand.query}
            onPick={sendGif}
            onClose={() => {
              setGifCommand(null);
              // With the /gif or /stickers slash command the command text lives
              // in the composer and must go; opened from the attach menu there is
              // no command, so leave any draft the user was typing untouched.
              if (text.startsWith("/")) setText("");
              inputRef.current?.focus();
            }}
          />
        )}

        {/* Mention picker — floats above the composer, group chats only */}
        {mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 rounded-2xl bg-base-100 shadow-2xl overflow-hidden z-30">
            {mentionCandidates.map((user) => (
              <button
                key={user._id}
                type="button"
                onClick={() => applyMention(user)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-base-200 transition-colors text-left"
              >
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt=""
                  className="object-cover rounded-full size-8 flex-shrink-0"
                />
                <span className="text-sm text-base-content truncate">{user.fullName}</span>
              </button>
            ))}
          </div>
        )}

        {scheduledAt && (
          <div className="flex items-center gap-2 px-3 pb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-primary text-[11px] font-medium">
              <Clock size={12} />
              Sends {new Date(scheduledAt).toLocaleString([], {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              <button
                type="button"
                onClick={() => setScheduledAt("")}
                className="ml-0.5 hover:opacity-70"
                aria-label="Cancel scheduled send"
              >
                <X size={11} />
              </button>
            </span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-3">
        <div className="flex-1 min-w-0 flex items-end gap-3 bg-base-100 rounded-3xl px-4 py-1.5 min-h-[42px] border field-hair shadow-sm">
          {isRecording ? (
            <div className="flex items-center justify-between w-full px-2 py-1">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Pulsing red dot */}
                <span className="rec-dot" aria-hidden="true" />
                {/* 00:15-style count-up timer */}
                <span className="text-xs font-semibold text-red-500 tabular-nums shrink-0">
                  {formatTimer(recordingTime)}
                </span>
                {/* Live sound-wave visualizer */}
                <span className="voice-viz" aria-hidden="true">
                  {BAR_HEIGHTS.map((h, i) => (
                    <span
                      key={i}
                      className="voice-bar"
                      style={{ "--i": i, height: `${h}%` }}
                    />
                  ))}
                </span>
              </div>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="text-red-500 hover:text-red-600 transition-colors p-1 hover:bg-base-200 rounded-full"
                title="Discard recording"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* The photo icon became a paperclip: photos are now one of four
                  things that can be attached rather than the only one. Tapping it
                  opens the menu; choosing Gallery from there still opens exactly
                  the picker this button used to. */}
              <button
                type="button"
                className={`p-1 hover:bg-base-200 rounded-full transition-colors flex items-center justify-center ${
                  imagePreviews.length > 0 ? "text-emerald-500" : "hover:text-base-content"
                }`}
                onClick={() => setIsAttachOpen((open) => !open)}
                title="Attach"
              >
                <Paperclip size={18} />
              </button>

              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageChange}
              />

              {/* One input per bucket-backed kind, so the file dialog offers the
                  right types instead of everything. */}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                ref={videoInputRef}
                onChange={handleBucketFile}
              />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                className="hidden"
                ref={docInputRef}
                onChange={handleBucketFile}
              />

              {/* Live-capture inputs: the Camera option forces the rear camera
                  for a photo straight into the image tray; Video note opens the
                  front camera to record a short clip that goes through the same
                  bucket staging as a picked video. */}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={cameraInputRef}
                onChange={handleImageChange}
              />
              <input
                type="file"
                accept="video/*"
                capture="user"
                className="hidden"
                ref={videoNoteInputRef}
                onChange={handleBucketFile}
              />

              {selectedGroup && (
                <button
                  type="button"
                  onClick={() => setShowPollModal(true)}
                  title="Create a poll"
                  className="p-1 hover:bg-base-200 rounded-full transition-colors flex items-center justify-center hover:text-base-content"
                >
                  <BarChart3 size={18} />
                </button>
              )}

              {/* Only appears where an admin has enabled it, so the control is
                  never a dead end. */}
              {selectedGroup?.allowAnonymousQuestions && (
                <button
                  type="button"
                  onClick={() => { haptic("tap"); setAskAnonymously((v) => !v); }}
                  title={askAnonymously ? "Sending anonymously — tap to turn off" : "Ask anonymously"}
                  className={`p-1 rounded-full transition-colors flex items-center justify-center ${
                    askAnonymously
                      ? "bg-primary text-primary-content"
                      : "hover:bg-base-200 t-dim hover:text-base-content"
                  }`}
                >
                  <EyeOff size={18} />
                </button>
              )}

              {/* A textarea rather than an input: a single-line input scrolls
                  sideways, so everything but the tail of a long message becomes
                  invisible while typing. This grows downward instead and wraps,
                  the way Instagram and WhatsApp do, then scrolls internally once
                  it hits its ceiling. rows=1 keeps a short message on one line. */}
              <textarea
                id="message-input"
                ref={inputRef}
                rows={1}
                aria-label="Write a message"
                aria-describedby="msg-help"
                className="flex-1 min-w-0 bg-transparent text-sm text-base-content ph-dim focus:outline-none py-1 resize-none leading-5 max-h-[112px] overflow-y-auto cg-scroll-x"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => { handleTextChange(e); handleMentionScan(e.target.value); }}
                onKeyDown={handleKeyDown}
              />
              <div id="msg-help" className="sr-only">Press Ctrl+Enter to send on desktop. Use Arrow Up to edit your last message.</div>
              {/* Forward + Schedule now live inside one toggle on every size, so
                  the composer never crowds. Tapping it lifts a small list above
                  the input; tapping it again (or picking an option, or tapping
                  anywhere else) closes it. Functions unchanged. */}
              <div className="relative flex items-center ml-2">
                <button
                  type="button"
                  aria-expanded={showMoreOptions}
                  aria-pressed={sensitive || isSchedulerOpen || Boolean(scheduledAt)}
                  title={showMoreOptions ? "Close more options" : "More options"}
                  onClick={() => { haptic("tap"); setShowMoreOptions((v) => !v); }}
                  className={`p-1 rounded-full transition-colors ${
                    sensitive || isSchedulerOpen || scheduledAt
                      ? "text-primary"
                      : "hover:bg-base-200 t-dim hover:text-base-content"
                  }`}
                >
                  <MoreHorizontal size={18} />
                </button>

                {showMoreOptions && (
                  <>
                    {/* Backdrop: any tap outside the card closes it. Must sit
                        above the Leaflet mini-maps (their panes run up to
                        z-800), so it dismisses even over a map bubble. */}
                    <div
                      className="fixed inset-0 z-[1000]"
                      onClick={() => setShowMoreOptions(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-2 z-[1100] w-64 rounded-2xl bg-base-100 shadow-2xl cg-dialog">
                      {!selectedGroup && (
                        <button
                          type="button"
                          onClick={() => { haptic("tap"); setSensitive((v) => !v); setShowMoreOptions(false); }}
                          className={`flex items-center w-full gap-3 px-3.5 py-2.5 text-left transition-colors s-row border-b border-base-300/40 ${
                            sensitive ? "bg-error/5" : ""
                          }`}
                        >
                          <span className={`grid place-items-center size-9 shrink-0 rounded-full ${
                            sensitive ? "bg-error/15 text-error" : "bg-base-200 t-dim"
                          }`}>
                            {sensitive ? <ShieldCheck size={17} /> : <Lock size={17} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium text-base-content">
                              {sensitive ? "Forwarding off" : "Forwarding on"}
                            </span>
                            <span className="block text-[11px] truncate t-dim">
                              {sensitive
                                ? "Blocked forwarding, downloads & screenshots"
                                : "Disable forward + screenshot lock for this message"}
                            </span>
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { openSchedulePicker(); setShowMoreOptions(false); }}
                        className={`flex items-center w-full gap-3 px-3.5 py-2.5 text-left transition-colors s-row ${
                          scheduledAt || isSchedulerOpen ? "bg-primary/5" : ""
                        }`}
                      >
                        <span className={`grid place-items-center size-9 shrink-0 rounded-full ${
                          scheduledAt || isSchedulerOpen ? "bg-primary/15 text-primary" : "bg-base-200 t-dim"
                        }`}>
                          <Clock size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-base-content">
                            {scheduledAt ? "Clear schedule" : "Schedule send"}
                          </span>
                          <span className="block text-[11px] truncate t-dim">
                            {scheduledAt
                              ? `Sends ${new Date(scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                              : "Pick a time for this message"}
                          </span>
                        </span>
                      </button>
                    </div>
                  </>
                )}

                {/* The picker itself pops above the composer and stays open even
                    though the option list above has closed. */}
                {isSchedulerOpen && (
                  <SchedulePicker
                    value={scheduledAt}
                    onConfirm={(v) => { setScheduledAt(v); setIsSchedulerOpen(false); setShowMoreOptions(false); }}
                    onClose={() => setIsSchedulerOpen(false)}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {isDictating ? (
          <button
            type="button"
            onClick={() => stopDictation()}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0 bg-primary text-primary-content hover:scale-105 active:scale-95"
            title="Stop dictation"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-content opacity-60"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-content"></span>
            </span>
          </button>
        ) : isRecording ? (
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0 bg-red-500 text-white hover:scale-105 active:scale-95"
            title="Stop & Send Voice Note"
          >
            <Send size={16} className="ml-0.5" />
          </button>
        ) : (
          <button
            type={text.trim() || imagePreviews.length > 0 || stagedFile || isSendingAnimation ? "submit" : "button"}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0 overflow-hidden
              ${
                text.trim() || imagePreviews.length > 0 || stagedFile || isSendingAnimation
                  ? "bg-primary text-primary-content hover:scale-105 active:scale-95"
                  : "bg-base-100 border hover:bg-base-200"
              }
            `}
            onMouseDown={(e) => {
              e.preventDefault();
              if (!text.trim() && imagePreviews.length === 0 && !stagedFile && !isSendingAnimation) {
                dictationHoldStart(e);
              }
            }}
            onMouseUp={releaseDictation}
            onMouseLeave={dictationHoldEnd}
            onTouchStart={() => {
              if (!text.trim() && imagePreviews.length === 0 && !stagedFile && !isSendingAnimation) {
                dictationHoldStart();
              }
            }}
            onTouchEnd={releaseDictation}
            onClick={(e) => {
              if (dictationActiveRef.current) {
                stopDictation();
                return;
              }
              // The click a long-press emits on release must not send the text
              // it just dictated, or start a voice note over it.
              if (Date.now() - dictationReleasedAtRef.current < 600) {
                e.preventDefault();
                return;
              }
              if (dictationStartedAtRef.current && Date.now() - dictationStartedAtRef.current < 800) {
                e.preventDefault();
                return;
              }
              if (!text.trim() && imagePreviews.length === 0 && !stagedFile && !isSendingAnimation) {
                e.preventDefault();
                startRecording();
              }
            }}
          >
            {text.trim() || imagePreviews.length > 0 || stagedFile || isSendingAnimation ? (
              <Send 
                size={16} 
                className={`ml-0.5 transition-all duration-300 ease-in-out ${isSendingAnimation ? "translate-x-5 -translate-y-5 opacity-0 scale-50" : "translate-x-0 translate-y-0 opacity-100 scale-100"}`} 
              />
            ) : (
              <Mic size={18} />
            )}
            <span className="sr-only">
              {dictationActiveRef.current ? "Listening — release to type" : "Tap for voice note, hold to type by voice"}
            </span>
          </button>
        )}
      </form>
    </div>
  );
};
export default MessageInput;


