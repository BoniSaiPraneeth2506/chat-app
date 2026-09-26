import { useState } from "react";
import { AtSign, X, Bell, Smile } from "lucide-react";
import toast from "react-hot-toast";
import StatusEditorShell, {
  useStatusEditor,
  postStatusWithFeedback,
  PrivacyButton,
  ScheduleButton,
  PrivacySheet,
  useMyUser,
} from "./StatusEditorShell";
import ScheduleSheet from "./ScheduleSheet";
import ContactPickerSheet from "../ContactPickerSheet";
import EmojiPicker from "../EmojiPicker";
import { haptic } from "../../lib/haptics";

/**
 * A status addressed to specific people.
 *
 * Mentions are typed IDs, picked one at a time, never scanned out of the text.
 * Two reasons, and both are load-bearing:
 *
 *  - A name is not an identity. "@Sam" can be three different people, and
 *    matching it against contact names would notify a stranger because someone
 *    else in the group shares a first name. The ID is the only unambiguous
 *    thing available.
 *  - The people who get told are the people who can already see the status. A
 *    mention sends a notification, and a notification that leads to something
 *    the recipient cannot open is worse than no notification at all — so the
 *    audience is applied server-side first, and the mention is dropped for
 *    anyone outside it.
 *
 * The @handles in the text are decoration for readers. The names stored in
 * `mentions` are what the server acts on.
 */
const MentionStatusEditor = ({ onClose }) => {
  const editor = useStatusEditor("mention");
  const me = useMyUser();

  const [content, setContent] = useState("");
  const [emoji, setEmoji] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const mentioned = editor.mentions;

  const add = (user) => {
    haptic("tap");
    if (mentioned.some((u) => u._id === user._id)) {
      toast(`${user.fullName} is already mentioned`);
      return;
    }
    editor.setMentions([...mentioned, user]);
    setPickerOpen(false);
  };

  const remove = (id) => {
    haptic("tap");
    editor.setMentions(mentioned.filter((u) => u._id !== id));
  };

  const handlePost = async () => {
    const text = content.trim();
    if (!text) return;
    editor.setPosting(true);
    editor.setProgress(0);
    try {
      await postStatusWithFeedback(
        editor.createStatus,
        {
          type: "text",
          text: {
            content: text,
            font: "classic",
            fontSize: 34,
            color: "#ffffff",
            backgroundColor: "#0b1b3a",
            backgroundGradient: "",
            align: "center",
            position: "center",
            emoji,
          },
          caption: "",
          // IDs only. The server is what decides whether each of these people
          // can actually see it.
          mentions: mentioned.map((u) => u._id),
          privacy: editor.privacy,
          scheduledFor: editor.scheduledFor,
        },
        { onDone: editor.closeAll, draftMode: editor.mode }
      );
    } finally {
      editor.setPosting(false);
    }
  };

  const canPost = Boolean(content.trim());

  return (
    <>
      <StatusEditorShell
        title="Mention"
        onClose={onClose}
        onDiscard={canPost ? editor.discardDraft : null}
        onPost={handlePost}
        posting={editor.posting}
        progress={editor.progress}
        canPost={canPost}
        footerExtra={
          <>
            <PrivacyButton privacy={editor.privacy} onClick={() => editor.setPrivacyOpen(true)} />
            <ScheduleButton scheduledFor={editor.scheduledFor} onClick={() => editor.setScheduleOpen(true)} />
          </>
        }
      >
        <div
          className="mx-4 mt-4 rounded-3xl p-5 min-h-[34vh] flex flex-col justify-center"
          style={{ background: "#0b1b3a" }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={5}
            placeholder={`Say something to someone, ${(me?.fullName || "").split(" ")[0] || "everyone"}...`}
            className="field-flat w-full bg-transparent border-0 text-white placeholder-white/35 text-lg text-center resize-none outline-none leading-snug"
          />
          {emoji && <p className="text-center text-3xl mt-2">{emoji}</p>}
          <button
            onClick={() => setEmojiOpen((o) => !o)}
            className={`mx-auto mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              emoji
                ? "bg-primary text-primary-content"
                : "bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            <Smile size={13} />
            {emoji ? "Change emoji" : "Add emoji"}
          </button>
          {emojiOpen && (
            <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
              <EmojiPicker
                onPick={(picked) => {
                  setEmoji((e) => (e + picked).slice(0, 8));
                  setEmojiOpen(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Who this is for. Shown before posting, not after: the whole point of
            a mention is that the author knows who is being notified. */}
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-base-content/40">Notifying</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-base-200 text-xs font-medium text-base-content hover:bg-base-300 transition-colors"
            >
              <AtSign size={13} className="text-primary" />
              Add people
            </button>
          </div>

          {mentioned.length === 0 ? (
            <p className="text-xs text-base-content/40 text-center py-3">
              No one is notified. This posts to your audience like any other status.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {mentioned.map((user) => (
                <li
                  key={user._id}
                  className="flex items-center gap-2.5 p-2 rounded-2xl bg-base-200"
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt=""
                    className="size-9 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-base-content truncate">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] text-base-content/50 truncate">@{user.username}</p>
                  </div>
                  <Bell size={13} className="text-primary flex-shrink-0" />
                  <button
                    onClick={() => remove(user._id)}
                    className="p-1 rounded-full hover:bg-base-300 flex-shrink-0"
                    aria-label={`Stop notifying ${user.fullName}`}
                  >
                    <X size={13} className="text-base-content/45" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {mentioned.length > 0 && (
            <p className="text-[11px] text-base-content/40 leading-relaxed">
              Each person is notified only if this status's audience already includes them.
            </p>
          )}
        </div>
      </StatusEditorShell>

      {pickerOpen && <ContactPickerSheet onPick={add} onClose={() => setPickerOpen(false)} />}

      {editor.privacyOpen && (
        <PrivacySheet
          open
          onClose={() => editor.setPrivacyOpen(false)}
          privacy={editor.privacy}
          onChange={editor.setPrivacy}
        />
      )}
      {editor.scheduleOpen && (
        <ScheduleSheet
          open
          onClose={() => editor.setScheduleOpen(false)}
          scheduledFor={editor.scheduledFor}
          onChange={editor.setScheduledFor}
        />
      )}
    </>
  );
};

export default MentionStatusEditor;
