"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cn } from "./cn";

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    const SR = (typeof window !== "undefined") && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-GB";
    r.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((rr: any) => rr[0].transcript).join(" ").trim();
      if (transcript) cbRef.current(transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    return () => { try { r.stop(); } catch {} };
  }, []);

  if (!supported) return null;

  return (
    <button
      onClick={() => {
        if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); }
        else { try { recRef.current?.start(); setListening(true); } catch {} }
      }}
      className={cn(
        "rounded-lg border p-2 transition",
        listening
          ? "border-accent bg-accent text-white"
          : "border-ink-200 hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-900"
      )}
      title={listening ? "Stop recording" : "Dictate your adaptation"}
      aria-label={listening ? "Stop recording" : "Start voice dictation"}
    >
      {listening ? <Square size={18} /> : <Mic size={18} />}
    </button>
  );
}
