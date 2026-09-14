'use client';
// ============================================================================
//  المُسمِع — recitation as the clock of the journey.
//
//  The audio is not a soundtrack laid over a moving canvas. It is the pacing:
//  an āyah is held while it is being recited, the silence after it is the
//  tempo's own, and the journey moves on when the reciter does. تَرْتِيل
//  therefore *is* a slow flight, and حَدْر *is* an unbroken one — the same
//  three words that name the recitation name the motion.
//
//  Two elements, swapped. The next āyah is fetched while the current one is
//  still sounding, so a leg never waits on the network; on a phone that is the
//  difference between a journey and a stutter.
// ============================================================================
import * as React from 'react';
import type { CosmosNode } from '@/lib/cosmos';
import {
  ayahAudioUrl,
  AVAILABLE_RECITERS,
  TEMPO_BY_ID,
  type Reciter,
  type TempoId,
} from '@/lib/cosmos/recitation';

export interface RecitationState {
  /** Is the reciter sounding right now. */
  playing: boolean;
  /** 0…1 through the current āyah, or 0 while in the gap. */
  progress: number;
  /** Seconds remaining of audio, then of silence. */
  remaining: number;
  /** True while holding the tempo's silence after an āyah. */
  resting: boolean;
  /** The device refused autoplay until a gesture. */
  blocked: boolean;
  /** No recording could be fetched for this āyah. */
  missing: boolean;
  duration: number;
}

export interface RecitationControls {
  state: RecitationState;
  reciter: Reciter;
  setReciter: (r: Reciter) => void;
  tempo: TempoId;
  setTempo: (t: TempoId) => void;
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  /** Called from a user gesture; unlocks autoplay on mobile. */
  unlock: () => void;
}

const SILENT =
  'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNJsYSCBGYlZjawkEJ0kRjIvBhN0KgpQTMHKmQIiEkgLc4TzTvXTX6ycY5IIDDgQgZQLBwSCLpCQBDQTlBMHDYEBGRBABBJgEWLBIKAQAAhRlLjSQ1gSCQiIxJIFAo0lBQEIBAKAgUBAIBAIBAICAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQCAQ==';

export function useRecitation(
  node: CosmosNode | null,
  /** Fired when the reciter and the tempo's silence are both finished. */
  onFinished: () => void,
): RecitationControls {
  const [reciter, setReciter] = React.useState<Reciter>(AVAILABLE_RECITERS[0]);
  const [tempo, setTempo] = React.useState<TempoId>('tadweer');
  const [enabled, setEnabled] = React.useState(true);
  const [state, setState] = React.useState<RecitationState>({
    playing: false,
    progress: 0,
    remaining: 0,
    resting: false,
    blocked: false,
    missing: false,
    duration: 0,
  });

  const current = React.useRef<HTMLAudioElement | null>(null);
  const ahead = React.useRef<HTMLAudioElement | null>(null);
  const restTimer = React.useRef<number | null>(null);
  const unlocked = React.useRef(false);
  // `onFinished` changes identity every render in the caller; holding it in a
  // ref keeps the audio effect from tearing down and restarting the āyah.
  const finish = React.useRef(onFinished);
  finish.current = onFinished;

  const makeAudio = React.useCallback(() => {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    return a;
  }, []);

  React.useEffect(() => {
    current.current = makeAudio();
    ahead.current = makeAudio();
    return () => {
      current.current?.pause();
      ahead.current?.pause();
      current.current = null;
      ahead.current = null;
      if (restTimer.current !== null) window.clearTimeout(restTimer.current);
    };
  }, [makeAudio]);

  /** A muted play() inside a real gesture is what buys autoplay afterwards. */
  const unlock = React.useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    const a = current.current;
    if (!a) return;
    const src = a.src;
    a.src = SILENT;
    void a
      .play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        if (src) a.src = src;
        setState((s) => ({ ...s, blocked: false }));
      })
      .catch(() => undefined);
  }, []);

  // ── the leg ───────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const a = current.current;
    if (!a) return;
    if (restTimer.current !== null) {
      window.clearTimeout(restTimer.current);
      restTimer.current = null;
    }
    a.pause();

    if (!node || !enabled) {
      setState((s) => ({ ...s, playing: false, progress: 0, resting: false }));
      return;
    }

    const t = TEMPO_BY_ID.get(tempo)!;
    const url = ayahAudioUrl(reciter, node.s, node.a);
    if (!url) {
      setState((s) => ({ ...s, missing: true, playing: false }));
      // No recording is still a leg: hold the tempo's silence and move on, so
      // a gap in the sources never strands the journey.
      restTimer.current = window.setTimeout(() => finish.current(), t.gap * 1000 + 1200);
      return;
    }

    a.src = url;
    a.playbackRate = t.rate;
    // Without this, slowing the recitation drops the reciter's voice an octave.
    const anyA = a as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean };
    anyA.preservesPitch = true;
    anyA.mozPreservesPitch = true;
    a.currentTime = 0;

    const onMeta = () => setState((s) => ({ ...s, duration: a.duration || 0, missing: false }));
    const onTime = () => {
      const d = a.duration || 0;
      setState((s) => ({
        ...s,
        progress: d ? a.currentTime / d : 0,
        remaining: d ? (d - a.currentTime) / t.rate : 0,
        playing: !a.paused,
      }));
    };
    const onEnd = () => {
      setState((s) => ({ ...s, playing: false, resting: true, progress: 1, remaining: t.gap }));
      restTimer.current = window.setTimeout(() => {
        setState((s) => ({ ...s, resting: false }));
        if (t.autoAdvance) finish.current();
      }, t.gap * 1000);
    };
    const onErr = () => {
      setState((s) => ({ ...s, missing: true, playing: false }));
      restTimer.current = window.setTimeout(() => finish.current(), 900);
    };

    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('error', onErr);

    void a.play().catch(() => setState((s) => ({ ...s, blocked: true, playing: false })));

    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('error', onErr);
    };
  }, [node, reciter, tempo, enabled]);

  return {
    state,
    reciter,
    setReciter,
    tempo,
    setTempo,
    enabled,
    setEnabled: (on: boolean) => {
      if (!on) current.current?.pause();
      setEnabled(on);
    },
    unlock,
  };
}

/** Warm the next āyah's file while the current one is still sounding. */
export function prefetchAyah(reciter: Reciter, surah: number, ayah: number) {
  const url = ayahAudioUrl(reciter, surah, ayah);
  if (!url) return;
  const a = new Audio();
  a.preload = 'auto';
  a.crossOrigin = 'anonymous';
  a.src = url;
}
