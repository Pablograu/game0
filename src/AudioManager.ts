import { CreateAudioEngineAsync, CreateSoundAsync } from '@babylonjs/core';

// Minimal local interfaces — avoids coupling to Babylon internal type names
interface IAudioEngine {
    unlockAsync(): Promise<void>;
}
interface ISound {
    play(): void;
    stop(): void;
    pause(): void;
    volume: number;
}

// ============================================================
//  SOUND KEYS
//  Add a new key here + an entry in SOUND_MANIFEST to register
//  any new sound. Everything else is automatic.
// ============================================================
export type SoundKey =
    // ── Player (files present in /audio/player/) ──────────────
    | 'player_walk'
    | 'player_jump'
    | 'player_dash'
    | 'player_punch'
    | 'player_take_damage'
    // ── Enemy (no files yet — will fail gracefully) ───────────
    | 'enemy_attack'
    | 'enemy_hit'
    | 'enemy_death'
    | 'enemy_alert'
    // ── UI / Game (no files yet — will fail gracefully) ───────
    | 'ui_start'
    | 'ui_pause'
    | 'ui_resume'
    | 'ui_game_over';

// ============================================================
//  SOUND MANIFEST
//  url       — path relative to /public
//  loop      — true = looping sound (use playLoop/stopLoop)
//  volume    — 0.0 – 1.0
//  spatial   — false = 2D (HUD/player), true = 3D world sound
// ============================================================
interface SoundDef {
    /** Single path or multiple variants — play() picks one at random */
    url: string | string[];
    loop: boolean;
    volume: number;
    spatial: boolean;
}

const SOUND_MANIFEST: Record<SoundKey, SoundDef> = {
    // Player — confirmed present
    player_walk: { url: '/audio/player/walking.mp3', loop: true, volume: 0.45, spatial: false },
    player_jump: { url: ['/audio/player/jump1.mp3', '/audio/player/jump2.mp3'], loop: false, volume: 0.6, spatial: false },
    player_dash: { url: '/audio/player/dash.mp3', loop: false, volume: 0.5, spatial: false },
    player_punch: { url: '/audio/player/punch.mp3', loop: false, volume: 0.7, spatial: false },
    player_take_damage: { url: '/audio/player/takeDamage.mp3', loop: false, volume: 0.8, spatial: false },

    // Enemy — no files yet; entries kept for when assets arrive
    enemy_attack: { url: '/audio/enemy/attack.mp3', loop: false, volume: 0.7, spatial: false },
    enemy_hit: { url: ['/audio/enemy/enemy-hit1.mp3', '/audio/enemy/enemy-hit2.mp3'], loop: false, volume: 0.6, spatial: false },
    enemy_death: { url: '/audio/enemy/death.mp3', loop: false, volume: 0.7, spatial: false },
    enemy_alert: { url: ['/audio/enemy/enemy-alert1.mp3', '/audio/enemy/enemy-alert2.mp3', '/audio/enemy/enemy-alert3.mp3', '/audio/enemy/enemy-alert4.mp3'], loop: false, volume: 0.5, spatial: false },

    // UI — no files yet
    ui_start: { url: '/audio/ui/start.mp3', loop: false, volume: 0.5, spatial: false },
    ui_pause: { url: '/audio/ui/pause.mp3', loop: false, volume: 0.4, spatial: false },
    ui_resume: { url: '/audio/ui/resume.mp3', loop: false, volume: 0.4, spatial: false },
    ui_game_over: { url: '/audio/ui/game_over.mp3', loop: false, volume: 0.8, spatial: false },
};

// ============================================================
//  AudioManager
//  Singleton. Mirror of EffectManager pattern.
//
//  Usage:
//    await AudioManager.init();          // once, in Game.initHavok()
//    AudioManager.play('player_jump');   // one-shot
//    AudioManager.playLoop('player_walk');
//    AudioManager.stopLoop('player_walk');
// ============================================================
class AudioManagerClass {
    private _isInitialized: boolean = false;
    private _audioEngine: IAudioEngine | null = null;
    private _sounds: Map<SoundKey, ISound[]> = new Map();

    // Dirty flag per looping sound — avoids polling sound.isPlaying every frame
    private _loopActive: Map<SoundKey, boolean> = new Map();

    constructor() { }

    // ----------------------------------------------------------
    //  init()
    //  Must be awaited once before anything else.
    //  Safe to call multiple times (guarded).
    // ----------------------------------------------------------
    async init(): Promise<void> {
        if (this._isInitialized) return;

        try {
            this._audioEngine = await CreateAudioEngineAsync();
            this._isInitialized = true;

            // Unlock on first user gesture (browser autoplay policy)
            const unlock = async () => {
                try {
                    await this._audioEngine.unlockAsync();
                    console.log('[AudioManager] Audio engine unlocked');
                } catch (e) {
                    console.warn('[AudioManager] Unlock failed:', e);
                }
            };
            window.addEventListener('pointerdown', unlock, { once: true });
            window.addEventListener('keydown', unlock, { once: true });

            console.log('[AudioManager] Engine created. Preloading sounds...');
            await this._preloadAll();
        } catch (e) {
            console.warn('[AudioManager] Failed to initialize audio engine:', e);
        }
    }

    // ----------------------------------------------------------
    //  Internal: load all sounds from the manifest in parallel.
    //  Missing files are warned and skipped — never crash.
    // ----------------------------------------------------------
    private async _preloadAll(): Promise<void> {
        const entries = Object.entries(SOUND_MANIFEST) as [SoundKey, SoundDef][];

        await Promise.allSettled(
            entries.map(async ([key, def]) => {
                const urls = Array.isArray(def.url) ? def.url : [def.url];
                const loaded: ISound[] = [];

                await Promise.allSettled(
                    urls.map(async (url, i) => {
                        try {
                            const sound = await CreateSoundAsync(`${key}_${i}`, url, {
                                loop: def.loop,
                                volume: def.volume,
                                spatialEnabled: def.spatial,
                            });
                            loaded[i] = sound;
                        } catch {
                            console.warn(`[AudioManager] Missing audio: "${key}" variant ${i} (${url})`);
                        }
                    }),
                );

                const variants = loaded.filter(Boolean);
                if (variants.length > 0) {
                    this._sounds.set(key, variants);
                    this._loopActive.set(key, false);
                }
            }),
        );

        console.log(
            `[AudioManager] ${this._sounds.size}/${entries.length} sounds loaded`,
        );
    }

    // ----------------------------------------------------------
    //  play()  — fire-and-forget one-shot
    // ----------------------------------------------------------
    play(key: SoundKey): void {
        if (!this._isInitialized) return;
        const variants = this._sounds.get(key);
        if (!variants?.length) return;
        const pick = variants[Math.floor(Math.random() * variants.length)];
        pick.play();
    }

    // ----------------------------------------------------------
    //  stop()  — hard stop, resets position
    // ----------------------------------------------------------
    stop(key: SoundKey): void {
        if (!this._isInitialized) return;
        this._sounds.get(key)?.forEach(s => s.stop());
    }

    // ----------------------------------------------------------
    //  playLoop()  — idempotent: starts only if not already active
    // ----------------------------------------------------------
    playLoop(key: SoundKey): void {
        if (!this._isInitialized) return;
        if (this._loopActive.get(key)) return;
        const variants = this._sounds.get(key);
        if (!variants?.length) return;
        variants[0].play(); // looping sounds use first variant
        this._loopActive.set(key, true);
    }

    // ----------------------------------------------------------
    //  stopLoop()  — idempotent: pauses (keeps position) if active
    // ----------------------------------------------------------
    stopLoop(key: SoundKey): void {
        if (!this._isInitialized) return;
        if (!this._loopActive.get(key)) return;
        const variants = this._sounds.get(key);
        if (!variants?.length) return;
        variants[0].pause(); // pause preserves loop position — avoids click on resume
        this._loopActive.set(key, false);
    }

    // ----------------------------------------------------------
    //  setVolume()  — runtime volume adjustment
    // ----------------------------------------------------------
    setVolume(key: SoundKey, volume: number): void {
        if (!this._isInitialized) return;
        this._sounds.get(key)?.forEach(s => (s.volume = volume));
    }
}

// Single exported instance — import anywhere, init once.
export const AudioManager = new AudioManagerClass();
