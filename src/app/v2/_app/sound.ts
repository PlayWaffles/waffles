// Sound system (ported from waffles-celo).
//
// A tiny singleton audio manager — lazy-loaded <audio> elements for instant
// playback, a mute toggle persisted to localStorage, and an optional looping
// background track. SFX always play (mute only silences the bg music); the
// whole thing is a no-op on the server and fails silently if a file is missing
// or the browser blocks autoplay.
//
// Usage: `import { playSound } from "./sound"; playSound("click");`

export const SOUNDS = {
  // UI feedback
  click: "/sounds/click.wav",
  exitWarning: "/sounds/exit-warning.wav",
  // Invite code
  codeValid: "/sounds/code-valid.wav",
  codeInvalid: "/sounds/code-invalid.wav",
  // Purchase
  purchase: "/sounds/purchase.wav",
  // Chat
  chatSend: "/sounds/chat-send.wav",
  chatReceive: "/sounds/chat-receive.wav",
  // Game
  answerSubmit: "/sounds/answer-submit.wav",
  timerFinal: "/sounds/timer-final.wav",
  timeUp: "/sounds/time-up.wav",
  // Results
  victory: "/sounds/victory.wav",
  defeat: "/sounds/defeat.wav",
} as const;

export const BG_TRACK = "/sounds/bg-loop.wav";

export type SoundName = keyof typeof SOUNDS;

const STORAGE_KEY_MUTED = "waffles.v2.sound.muted";

const audioCache = new Map<SoundName, HTMLAudioElement>();

const getAudio = (name: SoundName): HTMLAudioElement | null => {
  if (typeof window === "undefined") return null;
  let audio = audioCache.get(name);
  if (!audio) {
    try {
      audio = new Audio(SOUNDS[name]);
      audio.preload = "auto";
      audio.onerror = () => audioCache.delete(name);
      audioCache.set(name, audio);
    } catch {
      return null;
    }
  }
  return audio;
};

class SoundManager {
  private _muted = false;
  private _volume = 0.7;
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

  // SFX always play; mute only silences the looping background track.
  play(name: SoundName) {
    this.init();
    const audio = getAudio(name);
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = this._volume;
    audio.play().catch(() => {
      /* autoplay blocked until first user gesture — ignore */
    });
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
}

export const soundManager = new SoundManager();

export const playSound = (name: SoundName) => soundManager.play(name);
