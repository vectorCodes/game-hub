import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { normalizeGuess } from "@shadow/shared";
import { play, type Sound } from "../../../lib/sound";
import type { SubmitResult } from "../store";

const FEEDBACK: Partial<Record<SubmitResult, string>> = {
  wrong: "Not quite. The light moves…",
  close: "Ooh, close! You're on the right track…",
  duplicate: "You already tried that one.",
  error: "Couldn't reach the server. Try again.",
};
const MAX_SUGGESTIONS = 6;

type Tone = "miss" | "warm" | "info";
const TONES: Record<Tone, string> = { miss: "text-ember-300", warm: "text-lamp-300", info: "text-stone-400" };
const TONE_OF: Partial<Record<SubmitResult, Tone>> = { wrong: "miss", close: "warm" };
const SOUND_OF: Partial<Record<SubmitResult, Sound>> = { wrong: "miss", close: "close", duplicate: "duplicate" };

interface Props {
  names: string[];
  /** Earlier wrong guesses; they're left out of the suggestions. */
  tried: string[];
  disabled: boolean;
  onGuess: (text: string) => Promise<SubmitResult>;
  onSkip: () => Promise<void>;
}

function suggest(names: string[], query: string, tried: Set<string>): string[] {
  const q = normalizeGuess(query);
  if (!q) return [];
  const matches = names.filter((n) => !tried.has(normalizeGuess(n)) && normalizeGuess(n).includes(q));
  // Prefix matches first ("ca" → Car, Cactus before Birthday cake).
  matches.sort((a, b) => Number(!normalizeGuess(a).startsWith(q)) - Number(!normalizeGuess(b).startsWith(q)));
  if (matches.length === 1 && normalizeGuess(matches[0]) === q) return [];
  return matches.slice(0, MAX_SUGGESTIONS);
}

/** Bolds the part of `name` that matches what was typed. */
function Highlight({ name, query }: { name: string; query: string }) {
  const at = name.toLowerCase().indexOf(query.trim().toLowerCase());
  if (!query.trim() || at < 0) return <>{name}</>;
  const end = at + query.trim().length;
  return (
    <>
      {name.slice(0, at)}
      <span className="font-semibold text-white">{name.slice(at, end)}</span>
      {name.slice(end)}
    </>
  );
}

export function GuessInput({ names, tried, disabled, onGuess, onSkip }: Props) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{ text: string; tone: Tone } | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const locked = disabled || busy;

  const triedSet = useMemo(() => new Set(tried.map(normalizeGuess)), [tried]);
  const suggestions = useMemo(() => suggest(names, text, triedSet), [names, text, triedSet]);
  const showList = open && !disabled && suggestions.length > 0;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function submit(value: string) {
    if (!value.trim() || locked) return;
    setOpen(false);
    void run(async () => {
      const result = await onGuess(value);
      const message = FEEDBACK[result];
      setFeedback(message ? { text: message, tone: TONE_OF[result] ?? "info" } : null);
      const sound = SOUND_OF[result];
      if (sound) play(sound);
      const missed = result === "wrong" || result === "close";
      if (missed || result === "duplicate") setShake((n) => n + 1);
      if (missed || result === "correct") setText("");
    });
  }

  function choose(name: string) {
    setText(name);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(text);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div key={shake} className={`relative ${shake ? "animate-shake" : ""}`}>
        {showList && (
          // Opens upward so the on-screen keyboard never covers it on phones.
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 bottom-full z-20 mb-2 animate-rise overflow-hidden rounded-2xl bg-stone-900/95 p-1.5 shadow-2xl ring-1 shadow-black/60 ring-white/10 backdrop-blur-xl [animation-duration:180ms]"
          >
            {suggestions.map((name, i) => (
              <li
                key={name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown (not click) fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-stone-300 transition-colors ${i === active ? "bg-white/10" : ""}`}
              >
                <Highlight name={name} query={text} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-white/10 transition focus-within:bg-white/[0.06] focus-within:ring-lamp-400/70 focus-within:shadow-[0_0_30px_-10px_rgba(244,185,78,0.9)]">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="What casts this shadow?"
            disabled={disabled}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={80}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-white outline-none placeholder:text-stone-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={locked || !text.trim()}
            className="rounded-xl btn-primary px-4 py-2 font-semibold  active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? "…" : "Guess"}
          </button>
        </div>
      </div>
      <div className="flex h-6 items-center justify-between gap-3 px-1 text-sm">
        <p
          key={feedback?.text}
          aria-live="polite"
          className={`animate-fade truncate ${TONES[feedback?.tone ?? "info"]}`}
        >
          {feedback?.text}
        </p>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              setFeedback(null);
              await onSkip();
            })
          }
          disabled={locked}
          className="shrink-0 text-stone-400 transition hover:text-white disabled:opacity-40"
        >
          Skip angle →
        </button>
      </div>
    </form>
  );
}
