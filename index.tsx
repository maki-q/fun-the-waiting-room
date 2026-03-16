"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* ── constants ─────────────────────────────────────────────────────── */

const ROUNDS = [10, 30, 45, 60, 90] as const;

const TIME_FACTS = [
  "Time feels 20% slower when you're bored.",
  "Adrenaline can slow perceived time by up to 36%.",
  "Your brain processes 'now' about 80ms in the past.",
  "Body temperature affects time perception — fevers make seconds feel longer.",
  "Humans consistently overestimate durations when anxious.",
  "Dopamine release makes time seem to pass faster.",
  "Children perceive time as slower because each moment is a larger fraction of their life.",
  "Astronauts on the ISS experience time slightly faster due to lower gravity.",
  "The 'oddball effect' makes novel stimuli seem to last longer.",
  "Meditation practitioners tend to be more accurate at estimating time.",
  "Your brain compresses time in memory — routine days feel shorter in hindsight.",
  "Musicians tend to have better internal timekeeping than non-musicians.",
];

const RATINGS: [number, string][] = [
  [95, "Human Atomic Clock"],
  [90, "Chronometric Savant"],
  [80, "Surprisingly Precise"],
  [70, "Decent Internal Timer"],
  [60, "Close Enough"],
  [50, "Rough Estimator"],
  [0, "Time is an Illusion"],
];

const LS_KEY = "waiting-room-highscore";

/* ── types ─────────────────────────────────────────────────────────── */

type Phase = "intro" | "waiting" | "reveal" | "summary";

interface RoundResult {
  target: number;
  actual: number;
  accuracy: number;
}

/* ── helpers ────────────────────────────────────────────────────────── */

function calcAccuracy(target: number, actual: number): number {
  const diff = Math.abs(actual - target);
  const pct = Math.max(0, 100 - (diff / target) * 100);
  return Math.round(pct * 10) / 10;
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 90) return "#4ade80"; // green
  if (accuracy >= 75) return "#facc15"; // yellow
  return "#f87171"; // red
}

function getRating(avg: number): string {
  for (const [threshold, title] of RATINGS) {
    if (avg >= threshold) return title;
  }
  return "Time is an Illusion";
}

function randomFact(exclude?: string): string {
  const pool = exclude ? TIME_FACTS.filter((f) => f !== exclude) : TIME_FACTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatTime(seconds: number): string {
  return seconds.toFixed(2) + "s";
}

/* ── styles (CSS-in-JS object map) ─────────────────────────────────── */

const S = {
  root: {
    position: "fixed" as const,
    top: 64,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: "#e0e0e0",
    overflow: "hidden",
    textAlign: "center" as const,
    padding: "1.5rem",
  },
  target: {
    fontSize: "clamp(2rem, 8vw, 4.5rem)",
    fontWeight: 300 as const,
    lineHeight: 1.3,
    marginBottom: "3rem",
    letterSpacing: "-0.02em",
  },
  button: {
    background: "transparent",
    color: "#c0c0c0",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "4px",
    padding: "0.85rem 2rem",
    fontSize: "clamp(0.95rem, 2.5vw, 1.15rem)",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "border-color 0.3s, color 0.3s",
    lineHeight: 1.4,
  },
  resultNumber: {
    fontSize: "clamp(2.5rem, 10vw, 5rem)",
    fontWeight: 300 as const,
    lineHeight: 1.2,
    marginBottom: "0.5rem",
    fontVariantNumeric: "tabular-nums" as const,
  },
  label: {
    fontSize: "clamp(0.85rem, 2vw, 1rem)",
    color: "#888",
    marginBottom: "1.5rem",
    lineHeight: 1.6,
  },
  fact: {
    fontSize: "clamp(0.8rem, 2vw, 0.95rem)",
    color: "#666",
    fontStyle: "italic" as const,
    maxWidth: "28rem",
    lineHeight: 1.6,
    marginTop: "2rem",
    marginBottom: "2rem",
  },
  summaryRow: {
    display: "flex" as const,
    justifyContent: "space-between" as const,
    width: "100%",
    maxWidth: "20rem",
    padding: "0.4rem 0",
    fontSize: "clamp(0.9rem, 2vw, 1rem)",
    lineHeight: 1.6,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  highScore: {
    fontSize: "clamp(0.75rem, 1.8vw, 0.85rem)",
    color: "#555",
    marginTop: "1rem",
  },
} as const;

/* ── keyframes injected once ───────────────────────────────────────── */

const STYLE_ID = "waiting-room-styles";

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes wr-gradient {
      0%   { background: #1a1a2e; }
      25%  { background: #1b1a2f; }
      50%  { background: #1a1b2e; }
      75%  { background: #1c1a2e; }
      100% { background: #1a1a2e; }
    }
    @keyframes wr-breathe {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.01); }
    }
    .wr-bg {
      animation: wr-gradient 150s ease-in-out infinite;
    }
    .wr-btn {
      animation: wr-breathe 4s ease-in-out infinite;
    }
    .wr-btn:hover {
      border-color: rgba(255,255,255,0.35) !important;
      color: #e0e0e0 !important;
    }
    .wr-btn:focus-visible {
      outline: 2px solid rgba(99, 179, 237, 0.8);
      outline-offset: 2px;
    }
    .wr-fadein {
      animation: wr-fi 0.6s ease-out both;
    }
    @keyframes wr-fi {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

/* ── counting animation hook ───────────────────────────────────────── */

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef(0);
  const targetRef = useRef(target);
  const durationRef = useRef(duration);

  useEffect(() => {
    targetRef.current = target;
    durationRef.current = duration;
  }, [target, duration]);

  useEffect(() => {
    if (!active) {
      return;
    }
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / (durationRef.current * 1000), 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(eased * targetRef.current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return active ? value : 0;
}

/* ── main component ────────────────────────────────────────────────── */

export default function TheWaitingRoom() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [fact, setFact] = useState("");
  const [highScore, setHighScore] = useState<number | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LS_KEY);
        if (stored) return parseFloat(stored);
      }
    } catch { /* noop */ }
    return null;
  });
  const [countActive, setCountActive] = useState(false);

  const startTimeRef = useRef(0);

  // inject CSS once
  useEffect(() => {
    injectStyles();
  }, []);

  const countValue = useCountUp(lastResult?.actual ?? 0, 1, countActive);

  const startGame = useCallback(() => {
    setResults([]);
    setRoundIndex(0);
    setLastResult(null);
    setCountActive(false);
    setPhase("waiting");
    startTimeRef.current = performance.now();
  }, []);

  const handleGuess = useCallback(() => {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const target = ROUNDS[roundIndex];
    const accuracy = calcAccuracy(target, elapsed);
    const result: RoundResult = { target, actual: elapsed, accuracy };
    setLastResult(result);
    setResults((prev) => [...prev, result]);
    setFact(randomFact());
    setPhase("reveal");
    setCountActive(true);
  }, [roundIndex]);

  const nextRound = useCallback(() => {
    setCountActive(false);
    const next = roundIndex + 1;
    if (next >= ROUNDS.length) {
      // compute and save high score
      const allResults = [...results];
      const avg =
        allResults.reduce((s, r) => s + r.accuracy, 0) / allResults.length;
      try {
        const prev = localStorage.getItem(LS_KEY);
        if (!prev || avg > parseFloat(prev)) {
          localStorage.setItem(LS_KEY, avg.toFixed(1));
          setHighScore(avg);
        }
      } catch { /* noop */ }
      setPhase("summary");
    } else {
      setRoundIndex(next);
      setLastResult(null);
      setPhase("waiting");
      startTimeRef.current = performance.now();
    }
  }, [roundIndex, results]);

  /* ── render ── */

  // INTRO
  if (phase === "intro") {
    return (
      <div className="wr-bg" style={S.root}>
        <div className="wr-fadein">
          <p style={{ ...S.target, marginBottom: "1rem" }}>The Waiting Room</p>
          <p style={{ ...S.label, maxWidth: "24rem", margin: "0 auto 2.5rem" }}>
            How well do you know the passage of time? No clocks. No timers. Just
            you and your internal sense of duration.
          </p>
          <button
            className="wr-btn"
            style={S.button}
            onClick={startGame}
          >
            Begin
          </button>
        </div>
      </div>
    );
  }

  // WAITING
  if (phase === "waiting") {
    const target = ROUNDS[roundIndex];
    return (
      <div className="wr-bg" style={S.root}>
        <div className="wr-fadein" key={roundIndex}>
          <p style={S.label}>Round {roundIndex + 1} of {ROUNDS.length}</p>
          <p style={S.target}>Wait {target} seconds</p>
          <button
            className="wr-btn"
            style={S.button}
            onClick={handleGuess}
          >
            I think it has been {target} seconds
          </button>
        </div>
      </div>
    );
  }

  // REVEAL
  if (phase === "reveal" && lastResult) {
    const { target, accuracy } = lastResult;
    const diff = countValue - target;
    const color = accuracyColor(accuracy);
    return (
      <div className="wr-bg" style={S.root}>
        <div className="wr-fadein" key={`reveal-${roundIndex}`}>
          <p style={S.label}>You waited</p>
          <p style={{ ...S.resultNumber, color }}>{formatTime(countValue)}</p>
          <p style={S.label}>
            Target: {target}s &nbsp;&middot;&nbsp;{" "}
            {diff >= 0 ? "+" : ""}
            {formatTime(diff)} &nbsp;&middot;&nbsp; {accuracy}% accurate
          </p>
          <p style={S.fact}>{fact}</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" as const, justifyContent: "center" }}>
            <button
              className="wr-btn"
              style={S.button}
              onClick={nextRound}
            >
              {roundIndex + 1 < ROUNDS.length ? "Next round" : "See results"}
            </button>
            <button
              className="wr-btn"
              style={{ ...S.button, color: "#888" }}
              onClick={() => {
                setCountActive(false);
                setLastResult(null);
                setPhase("waiting");
                startTimeRef.current = performance.now();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUMMARY
  if (phase === "summary") {
    const avg =
      results.reduce((s, r) => s + r.accuracy, 0) / results.length;
    const best = results.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
    const worst = results.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));
    const rating = getRating(avg);
    return (
      <div className="wr-bg" style={S.root}>
        <div className="wr-fadein">
          <p style={{ ...S.target, marginBottom: "0.5rem" }}>{rating}</p>
          <p style={{ ...S.label, marginBottom: "2rem" }}>
            Your average accuracy across {ROUNDS.length} rounds
          </p>
          <p
            style={{
              ...S.resultNumber,
              color: accuracyColor(avg),
              marginBottom: "2rem",
            }}
          >
            {avg.toFixed(1)}%
          </p>

          <div style={{ marginBottom: "1.5rem" }}>
            <div style={S.summaryRow}>
              <span style={{ color: "#888" }}>Best round</span>
              <span style={{ color: accuracyColor(best.accuracy) }}>
                {best.target}s — {best.accuracy}%
              </span>
            </div>
            <div style={S.summaryRow}>
              <span style={{ color: "#888" }}>Worst round</span>
              <span style={{ color: accuracyColor(worst.accuracy) }}>
                {worst.target}s — {worst.accuracy}%
              </span>
            </div>
            {highScore !== null && (
              <p style={S.highScore}>Personal best: {highScore.toFixed(1)}%</p>
            )}
          </div>

          <button
            className="wr-btn"
            style={S.button}
            onClick={startGame}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
