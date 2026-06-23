// Sound system (ported from waffles-celo).
//
// SFX use pre-decoded Web Audio buffers so taps start immediately. Background
// music stays on <audio> because it is long, looping media rather than a short
// latency-sensitive effect.
//
// Usage: `import { playSound } from "./sound"; playSound("click");`

export const SOUNDS = {
  // UI feedback
  click: "/sounds/click.mp3",
  exitWarning: "/sounds/exit-warning.mp3",
  // Invite code
  codeValid: "/sounds/code-valid.mp3",
  codeInvalid: "/sounds/code-invalid.mp3",
  // Purchase
  purchase: "/sounds/purchase.mp3",
  // Chat
  chatSend: "/sounds/chat-send.mp3",
  chatReceive: "/sounds/chat-receive.mp3",
  // Game
  answerSubmit: "/sounds/answer-submit.mp3",
  timerFinal: "/sounds/timer-final.mp3",
  timeUp: "/sounds/time-up.mp3",
  // Results
  victory: "/sounds/victory.mp3",
  defeat: "/sounds/defeat.mp3",
} as const;

export const BG_TRACK = "/sounds/bg-loop.mp3";

export type SoundName = keyof typeof SOUNDS;

// Per-sound volume multipliers (applied on top of the global SFX volume).
// Defaults to 1; the ubiquitous click is quieter so it doesn't fatigue.
const SOUND_GAIN: Partial<Record<SoundName, number>> = {
  click: 0.5,
};

const STORAGE_KEY_MUTED = "waffles.v2.sound.muted";

const bufferCache = new Map<SoundName, AudioBuffer>();
const bufferPromises = new Map<SoundName, Promise<AudioBuffer | null>>();

let audioContext: AudioContext | null = null;
let unlockBound = false;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  return audioContext;
};

const unlockAudio = () => {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
};

const bindUnlock = () => {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  window.addEventListener("pointerdown", unlockAudio, { passive: true, capture: true });
  window.addEventListener("keydown", unlockAudio, { passive: true, capture: true });
};

const loadBuffer = (name: SoundName): Promise<AudioBuffer | null> => {
  const cached = bufferCache.get(name);
  if (cached) return Promise.resolve(cached);

  const pending = bufferPromises.get(name);
  if (pending) return pending;

  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(null);

  const promise = fetch(SOUNDS[name])
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load sound ${name}`);
      return response.arrayBuffer();
    })
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      bufferCache.set(name, buffer);
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      bufferPromises.delete(name);
    });

  bufferPromises.set(name, promise);
  return promise;
};

const playBuffer = (name: SoundName, volume: number) => {
  const ctx = getAudioContext();
  const buffer = bufferCache.get(name);
  if (!ctx || !buffer) {
    void loadBuffer(name);
    return;
  }

  if (ctx.state === "suspended") void ctx.resume();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
  };
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const stopSfx = () => {
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
    bufferCache.clear();
    bufferPromises.clear();
    for (const name of Object.keys(SOUNDS) as SoundName[]) {
      void loadBuffer(name);
    }
  }
};

class SoundManager {
  private _muted = false;
  private _volume = 0.45;
  private _initialized = false;
  private _bgAudio: HTMLAudioElement | null = null;
  private _bgWanted = false;
  private _listeners = new Set<() => void>();

  // Subscription so React views (the mute toggle) can read isMuted via
  // useSyncExternalStore and re-render when it flips — no setState-in-effect.
  subscribe = (cb: () => void): (() => void) => {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  };

  private emit() {
    this._listeners.forEach((l) => l());
  }

  private init() {
    if (this._initialized || typeof window === "undefined") return;
    try {
      this._muted = localStorage.getItem(STORAGE_KEY_MUTED) === "true";
    } catch {
      /* storage disabled — keep default */
    }
    this._initialized = true;
  }

  /** Warm the SFX cache so the FIRST play of each sound is instant — otherwise
   *  the browser has to fetch the audio on first use, which shows up as a delay
   *  between the trigger and the sound. Safe to call repeatedly; no-op on SSR. */
  preload() {
    if (typeof window === "undefined") return;
    for (const name of Object.keys(SOUNDS) as SoundName[]) {
      void loadBuffer(name);
    }
    bindUnlock();
  }

  // SFX always play; mute only silences the looping background track.
  play(name: SoundName) {
    this.init();
    if (this._muted) return;
    playBuffer(name, this._volume * (SOUND_GAIN[name] ?? 1));
  }

  get isMuted() {
    this.init();
    return this._muted;
  }

  toggleMute(): boolean {
    this.init();
    this._muted = !this._muted;
    try {
      localStorage.setItem(STORAGE_KEY_MUTED, String(this._muted));
    } catch {
      /* storage disabled */
    }
    if (this._muted) this._bgAudio?.pause();
    else if (this._bgWanted) this.playBgMusic();
    this.emit();
    return this._muted;
  }

  playBgMusic() {
    this.init();
    this._bgWanted = true;
    if (this._muted || typeof window === "undefined") return;
    if (!this._bgAudio) {
      this._bgAudio = new Audio(BG_TRACK);
      this._bgAudio.loop = true;
      this._bgAudio.preload = "auto";
      this._bgAudio.onerror = () => {
        this._bgAudio = null;
      };
    }
    this._bgAudio.volume = this._volume * 0.4;
    this._bgAudio.play().catch(() => {
      /* autoplay blocked — will start after first gesture */
    });
  }

  stopBgMusic() {
    this._bgWanted = false;
    if (this._bgAudio) {
      this._bgAudio.pause();
      this._bgAudio.currentTime = 0;
    }
  }

  stopSfx() {
    stopSfx();
  }
}

export const soundManager = new SoundManager();

export const playSound = (name: SoundName) => soundManager.play(name);

/** Warm the SFX cache (call once on app mount) so first plays are instant. */
export const preloadSounds = () => soundManager.preload();
