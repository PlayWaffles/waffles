/**
 * Sound System for Waffles Game
 *
 * Lightweight audio manager with:
 * - Lazy-loaded Audio objects for instant playback
 * - Volume control with mute toggle
 * - LocalStorage persistence for user preferences
 * - Proper cleanup on game phase transitions
 */

// ============================================
// SOUND CATALOG
// ============================================

export const SOUNDS = {
  // UI Feedback
  click: "/sounds/click.wav",
  exitWarning: "/sounds/exit-warning.wav",

  // Invite Code
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

// Background music (looping)
export const BG_TRACK = "/sounds/bg-loop.wav";

export type SoundName = keyof typeof SOUNDS;

// ============================================
// AUDIO CACHE
// ============================================

const audioCache = new Map<SoundName, HTMLAudioElement>();

// Track all currently playing audio for cleanup
const activeAudioSet = new Set<HTMLAudioElement>();

/**
 * Get or create an Audio element for a sound
 */
function getAudio(name: SoundName): HTMLAudioElement | null {
  // Only run in browser
  if (typeof window === "undefined") return null;

  if (!audioCache.has(name)) {
    try {
      const audio = new Audio(SOUNDS[name]);
      audio.preload = "auto";

      // Suppress errors for missing/unsupported audio files
      audio.onerror = () => {
        // Silently fail - audio file may not exist or format not supported
        audioCache.delete(name);
      };

      audioCache.set(name, audio);
    } catch {
      // Audio construction failed
      return null;
    }
  }

  return audioCache.get(name) ?? null;
}

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEY_MUTED = "waffles-bg-muted";
const STORAGE_KEY_VOLUME = "waffles-sound-volume";

// ============================================
// SOUND MANAGER CLASS
// ============================================

class SoundManager {
  private _isMuted: boolean = false;
  private _volume: number = 0.7;
  private _initialized: boolean = false;
  private _bgAudio: HTMLAudioElement | null = null;
  private _bgPlaying: boolean = false;
  private _bgWanted: boolean = false;

  constructor() {
    // Defer initialization to first access (client-side only)
  }

  private init() {
    if (this._initialized || typeof window === "undefined") return;

    // Load preferences from localStorage
    const storedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
    const storedVolume = localStorage.getItem(STORAGE_KEY_VOLUME);

    if (storedMuted !== null) {
      this._isMuted = storedMuted === "true";
    }

    if (storedVolume !== null) {
      const vol = parseFloat(storedVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        this._volume = vol;
      }
    }

    this._initialized = true;
  }

  /**
   * Play a sound effect (always plays regardless of mute — mute only affects bg music)
   */
  play(name: SoundName): void {
    this.init();

    const audio = getAudio(name);
    if (!audio) return;

    // Reset to start if already playing
    audio.currentTime = 0;
    audio.volume = this._volume;

    // Track active audio
    activeAudioSet.add(audio);

    // Remove from tracking when ended
    const handleEnded = () => {
      activeAudioSet.delete(audio);
      audio.removeEventListener("ended", handleEnded);
    };
    audio.addEventListener("ended", handleEnded);

    // Play with error handling (browsers may block autoplay)
    audio
      .play()
      .catch(() => {
        activeAudioSet.delete(audio);
      });
  }

  /**
   * Stop ALL currently playing sound effects.
   * Useful for clean transitions between questions/phases.
   */
  stopAllAudio(): void {
    // Stop all tracked active audio
    activeAudioSet.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activeAudioSet.clear();

    // Stop cached SFX that might be playing
    audioCache.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  /**
   * Get muted state
   */
  get isMuted(): boolean {
    this.init();
    return this._isMuted;
  }

  /**
   * Set muted state
   */
  set isMuted(value: boolean) {
    this.init();
    this._isMuted = value;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MUTED, String(value));
    }
  }

  /**
   * Toggle mute state — also pauses/resumes background music
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this._isMuted) {
      this._bgAudio?.pause();
    } else if (this._bgWanted) {
      this.playBgMusic();
    }
    return this.isMuted;
  }

  /**
   * Get volume (0-1)
   */
  get volume(): number {
    this.init();
    return this._volume;
  }

  /**
   * Set volume (0-1)
   */
  set volume(value: number) {
    this.init();
    const clamped = Math.max(0, Math.min(1, value));
    this._volume = clamped;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
    }
  }

  /**
   * Preload commonly used sounds
   */
  preload(sounds: SoundName[] = ["click", "chatSend", "answerSubmit"]): void {
    sounds.forEach((name) => getAudio(name));
  }

  // ============================================
  // BACKGROUND MUSIC
  // ============================================

  /**
   * Play looping background music
   */
  playBgMusic(): void {
    this.init();
    this._bgWanted = true;

    if (this._isMuted) return;

    if (typeof window === "undefined") return;

    if (!this._bgAudio) {
      this._bgAudio = new Audio(BG_TRACK);
      this._bgAudio.loop = true;
      this._bgAudio.preload = "auto";
      this._bgAudio.onerror = () => {
        this._bgAudio = null;
      };
    }

    if (!this._bgAudio) return;

    this._bgAudio.volume = this._volume * 0.4;

    this._bgAudio
      .play()
      .then(() => {
        this._bgPlaying = true;
      })
      .catch(() => {
        this._bgPlaying = false;
      });
  }

  /**
   * Stop background music
   */
  stopBgMusic(): void {
    this._bgWanted = false;
    if (this._bgAudio) {
      this._bgAudio.pause();
      this._bgAudio.currentTime = 0;
    }
    this._bgPlaying = false;
  }

  /**
   * Pause background music (without resetting)
   */
  pauseBgMusic(): void {
    this._bgAudio?.pause();
    this._bgPlaying = false;
  }

  /**
   * Check if background music is playing
   */
  get isBgPlaying(): boolean {
    return this._bgPlaying;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const soundManager = new SoundManager();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Play a sound effect (convenience function)
 */
export function playSound(name: SoundName): void {
  soundManager.play(name);
}

/**
 * Stop all sound effects - use when transitioning between questions/phases
 */
export function stopAllAudio(): void {
  soundManager.stopAllAudio();
}
