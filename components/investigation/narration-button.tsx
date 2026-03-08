"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

export function NarrationButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  function toggleSpeech() {
    if (!supported) {
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleSpeech}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-4 text-sm font-semibold"
      aria-label={speaking ? "Stop narration" : "Read this step aloud"}
    >
      {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? "Stop audio" : "Read aloud"}
    </button>
  );
}
