// â”€â”€ Translation / script / listen actions for the selected message â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Rendered inside the selection-toolbar overflow (three-dot) menu whenever a
// single text message is selected â€” the user's own or someone else's. The
// required actions work on any text message, while "Message info" stays gated
// to the user's own messages in ChatHeader.

import { useState } from "react";
import { ArrowLeft, Languages, Loader2, Volume2 } from "lucide-react";
import { haptic } from "../../lib/haptics";
import {
  translateText,
  transliterateText,
  textToSpeech,
  AI_LANGUAGES,
  aiError,
} from "../../lib/sarvamApi";
import { useAiStore } from "../../store/useAiStore";
import { playAudio } from "../../lib/aiAudio";
import toast from "react-hot-toast";

const AiActionMenu = ({ message, onFinish }) => {
  const [view, setView] = useState("root"); // "root" | "languages"
  const [mode, setMode] = useState(null); // "translate" | "transliterate"
  const [busy, setBusy] = useState(null); // "translate" | "transliterate" | "listen"

  const setTranslation = useAiStore((s) => s.setTranslation);
  const setTransliteration = useAiStore((s) => s.setTransliteration);
  const setAudio = useAiStore((s) => s.setAudio);

  const text = message?.text || "";

  const closeMenu = () => {
    setView("root");
    setMode(null);
    setBusy(null);
    if (onFinish) onFinish();
  };

  const openLanguages = (m) => {
    haptic("tap");
    setMode(m);
    setView("languages");
  };

  const pickLanguage = async (code) => {
    setBusy(mode);
    haptic("tap");
    try {
      if (mode === "translate") {
        const res = await translateText(text, code);
        setTranslation(message._id, {
          translatedText: res.translatedText,
          sourceLanguage: res.sourceLanguage,
          targetLanguage: res.targetLanguage,
        });
        toast.success("Translated");
      } else {
        const res = await transliterateText(text, code);
        setTransliteration(message._id, {
          text: res.transliteratedText,
          sourceLanguage: res.sourceLanguage,
          sourceScript: res.sourceScript,
          targetLanguage: res.targetLanguage,
        });
        toast.success("Script changed");
      }
      setBusy(null);
      closeMenu();
    } catch (err) {
      setBusy(null);
      haptic("reject");
      toast.error(await aiError(err));
    }
  };

  const listen = async () => {
    if (!text) {
      toast.error("Nothing to listen to");
      return;
    }
    setBusy("listen");
    haptic("tap");
    try {
      // No language supplied -> the backend auto-detects the source language.
      const { url } = await textToSpeech(text);
      setAudio(message._id, {
        audioUrl: url,
        audioLanguage: null,
        audioLoading: false,
        audioPlaying: true,
      });
      playAudio(
        message._id,
        url,
        () => setAudio(message._id, { audioPlaying: false }),
        () => setAudio(message._id, { audioPlaying: false })
      );
      setBusy(null);
      closeMenu();
    } catch (err) {
      setBusy(null);
      haptic("reject");
      toast.error(await aiError(err));
    }
  };

  if (view === "languages") {
    const isTrans = mode === "translate";
    return (
      <>
        <li>
          <button
            onClick={() => { haptic("tap"); setView("root"); setMode(null); }}
            className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium flex items-center gap-2"
          >
            <ArrowLeft size={14} />
            {isTrans ? "Translate toâ€¦" : "Change script toâ€¦"}
          </button>
        </li>
        <li className="menu-title opacity-60 text-[10px]">Target language</li>
        {AI_LANGUAGES.map((l) => (
          <li key={l.code}>
            <button
              disabled={busy === mode}
              onClick={() => pickLanguage(l.code)}
              className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium"
            >
              {busy === mode ? <Loader2 className="animate-spin" size={13} /> : null}
              {l.name}
            </button>
          </li>
        ))}
      </>
    );
  }

  return (
    <>
      <li className="menu-title opacity-60 text-[10px]">AI</li>
      <li>
        <button
          disabled={busy === "listen"}
          onClick={listen}
          className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium flex items-center gap-2"
        >
          {busy === "listen" ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Volume2 size={14} />
          )}
          Listen
        </button>
      </li>
      <li>
        <button
          onClick={() => openLanguages("translate")}
          className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium flex items-center gap-2"
        >
          <Languages size={14} />
          Translate
        </button>
      </li>
      <li>
        <button
          onClick={() => openLanguages("transliterate")}
          className="hover:bg-primary/15 focus:bg-primary/15 active:bg-primary/25 hover:text-primary focus:text-primary py-2 text-left font-medium flex items-center gap-2"
        >
          <Languages size={14} />
          Change Script
        </button>
      </li>
    </>
  );
};

export default AiActionMenu;
