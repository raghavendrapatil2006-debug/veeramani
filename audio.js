/**
 * Veeramani Run - Audio & Voice Engine
 * Supports:
 * 1. REAL MP3/WAV AUDIO FILES placed in assets/audio/ or loaded via user file picker
 * 2. The viral "Veeramani Era" meme audio
 * 3. Fallback Web Speech API + Web Audio Synthesizer
 */

class VeeramaniAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.sfxEnabled = true;
    this.voiceEnabled = true;
    this.masterVolume = 0.95;

    this.bgmEnabled = false;
    this.bgmAudio = null;

    // Cooldown trackers for situational voice triggers
    this.lastVoiceTime = 0;
    this.lastDangerVoiceTime = 0;
    this.lastEscapeVoiceTime = 0;
    this.lastSweetVoiceTime = 0;
    this.lastOrderVoiceTime = 0;
    this.lastDamageVoiceTime = 0;
    this.currentVoiceClip = null;
    this.currentVoicePriority = 0;

    // Real audio clips registry (featuring all 8 authentic Instagram Reels!)
    this.clips = {
      meme: null,           // 1. Viral "Veeramani Era" meme (veeramani_reel.mp3)
      chase_core: null,     // 2. 89s Core Highway Running Chase Track (reel_dewiuweia4q.mp3)
      swiggy_danger: null,  // 3. Veeramani running panic shout when Swiggy closes in (reel_ded_mxwqgug.mp3)
      escape_shout: null,   // 4. Close shave & Hosur escape shouts (reel_ded_mxwqgug.mp3)
      sweet_blessing: null, // 5. Instamart & sweet boost dialogue (reel_delpwdqmokx.mp3)
      mega_order: null,     // 6. Cannon & 1.8L iPhone COD order frenzy (reel_dezcmqum_m6.mp3)
      gameover: null,       // 7. Official "All game over,,,," dialogue (reel_dedh1dflxej.mp3)
      chase_intro: null,    // 8. Delivery agents running behind Veeramani (reel_degcrm_ndxn.mp3)
      jump: null,
      duck: null,
      swiggy: null,
      order_cancel: null
    };

    // Attempt to load default audio files from assets/audio/
    this.preloadOriginalAudios();

    this.initVoices();
  }

  preloadOriginalAudios() {
    const fileMap = {
      meme: [
        'assets/audio/veeramani_reel.mp3',
        'assets/audio/meme.mp3',
        'assets/audio/veeramani_meme.mp3'
      ],
      chase_core: [
        'assets/audio/reel_dewiuweia4q.mp3'
      ],
      swiggy_danger: [
        'assets/audio/reel_ded_mxwqgug.mp3'
      ],
      escape_shout: [
        'assets/audio/reel_ded_mxwqgug.mp3'
      ],
      sweet_blessing: [
        'assets/audio/reel_delpwdqmokx.mp3'
      ],
      mega_order: [
        'assets/audio/reel_dezcmqum_m6.mp3'
      ],
      gameover: [
        'assets/audio/reel_dedh1dflxej.mp3',
        'assets/audio/veeramani_gameover.mp3',
        'assets/audio/gameover.mp3'
      ],
      chase_intro: [
        'assets/audio/reel_degcrm_ndxn.mp3'
      ],
      jump: ['assets/audio/veeramani_jump.mp3', 'assets/audio/jump.mp3'],
      duck: ['assets/audio/veeramani_duck.mp3', 'assets/audio/duck.mp3'],
      swiggy: ['assets/audio/swiggy_delivery.mp3', 'assets/audio/swiggy.mp3'],
      order_cancel: ['assets/audio/veeramani_order_cancel.mp3', 'assets/audio/order_cancel.mp3']
    };

    Object.keys(fileMap).forEach(key => {
      const candidates = fileMap[key];
      this.tryLoadAudioCandidates(key, candidates, 0);
    });
  }

  tryLoadAudioCandidates(key, candidates, index) {
    if (index >= candidates.length) return;
    const url = candidates[index];
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';

    let resolved = false;
    const markLoaded = () => {
      if (resolved) return;
      resolved = true;
      console.log(`[AudioEngine] Loaded real audio for "${key}": ${url}`);
      this.clips[key] = audio;

      if (key === 'chase_core' || (key === 'meme' && !this.bgmAudio)) {
        // Prepare BGM clone so BGM loop runs without interfering with SFX
        const bgm = new Audio();
        bgm.src = url;
        bgm.preload = 'auto';
        bgm.loop = true;
        this.bgmAudio = bgm;
      }

      window.dispatchEvent(new CustomEvent('veeramani-audio-loaded', { detail: { key, url } }));
    };

    audio.oncanplay = markLoaded;
    audio.oncanplaythrough = markLoaded;
    audio.onloadeddata = markLoaded;

    audio.onerror = () => {
      if (!resolved) {
        this.tryLoadAudioCandidates(key, candidates, index + 1);
      }
    };
  }

  // Load a user-provided audio file (via File input, drag & drop, or URL)
  loadUserAudioFile(key, fileOrUrl) {
    const audio = new Audio();
    if (typeof fileOrUrl === 'string') {
      audio.src = fileOrUrl;
    } else {
      audio.src = URL.createObjectURL(fileOrUrl);
    }
    audio.preload = 'auto';
    audio.oncanplaythrough = () => {
      console.log(`[AudioEngine] Successfully loaded custom audio for "${key}"!`);
      this.clips[key] = audio;
    };
    audio.load();
    return audio;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  initVoices() {
    if ('speechSynthesis' in window) {
      const load = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          this.tamilVoice = voices.find(v => v.lang.startsWith('ta')) || null;
          this.indianVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('ta')) || voices[0] || null;
        }
      };
      load();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = load;
      }
    }
  }

  getNoiseBufferSource() {
    if (!this.noiseBuffer && this.ctx) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.6);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    return src;
  }

  playTone(type, startFreq, endFreq, duration, gainVal, delay = 0) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    gain.gain.setValueAtTime(gainVal * this.masterVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  playNoise(filterType, startFreq, endFreq, duration, gainVal, delay = 0) {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;

    const startTime = this.ctx.currentTime + delay;
    const src = this.getNoiseBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, startTime);
    filter.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    gain.gain.setValueAtTime(gainVal * this.masterVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  // ================= SOUND FX =================
  playJump() {
    this.playTone('square', 300, 720, 0.11, 0.07, 0);
  }

  playDuck() {
    this.playNoise('lowpass', 600, 180, 0.12, 0.25, 0);
  }

  playFallingWhistle() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.55);

    gain.gain.setValueAtTime(0.25 * this.masterVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.56);
  }

  playParcelCrash() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.35);
    oscGain.gain.setValueAtTime(0.6 * this.masterVolume, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.36);

    this.playNoise('lowpass', 1200, 80, 0.38, 0.5, 0);
  }

  playSwiggyHorn() {
    this.playTone('square', 520, 520, 0.09, 0.08, 0);
    this.playTone('square', 520, 520, 0.09, 0.08, 0.14);
  }

  playMilestone() {
    this.playTone('triangle', 880, 880, 0.09, 0.12, 0);
    this.playTone('triangle', 1320, 1320, 0.14, 0.12, 0.09);
  }

  playSweetCollect() {
    this.playTone('triangle', 659.25, 659.25, 0.06, 0.15, 0);
    this.playTone('triangle', 987.77, 987.77, 0.08, 0.15, 0.06);
    this.playTone('triangle', 1318.51, 1318.51, 0.12, 0.18, 0.12);
  }

  playGameOver() {
    this.playNoise('lowpass', 1400, 120, 0.55, 0.7, 0);
    this.playTone('sine', 130, 35, 0.45, 0.6, 0);
  }

  // ================= VEERAMANI AUDIO & VOICE =================

  playClip(clipName) {
    if (!this.voiceEnabled && clipName !== 'meme') return false;
    const clip = this.clips[clipName];
    if (clip) {
      try {
        clip.currentTime = 0;
        clip.volume = this.masterVolume;
        clip.play().catch((err) => {
          console.warn('[AudioEngine] Play failed:', err);
        });
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  stopClip(clipName) {
    const clip = this.clips[clipName];
    if (clip) {
      try {
        clip.pause();
        clip.currentTime = 0;
      } catch (e) {}
    }
  }

  isClipPlaying(clipName) {
    const clip = this.clips[clipName];
    return !!(clip && !clip.paused && clip.currentTime > 0);
  }

  // Looping Reel Background Music
  startBgm() {
    if (!this.bgmAudio) return false;
    try {
      this.bgmAudio.currentTime = 0;
      this.bgmAudio.volume = Math.min(0.5, this.masterVolume * 0.55);
      this.bgmAudio.loop = true;
      this.bgmAudio.play().catch(e => console.warn('BGM play blocked:', e));
      this.bgmEnabled = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  stopBgm() {
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
      } catch (e) {}
    }
    this.bgmEnabled = false;
  }

  pauseBgm() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      try { this.bgmAudio.pause(); } catch(e) {}
    }
  }

  resumeBgm() {
    if (this.bgmAudio && this.bgmEnabled) {
      try {
        this.bgmAudio.volume = Math.min(0.5, this.masterVolume * 0.55);
        this.bgmAudio.play().catch(() => {});
      } catch(e) {}
    }
  }

  duckBgm() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.volume = 0.04 * this.masterVolume;
    }
  }

  unduckBgm() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.volume = Math.min(0.5, this.masterVolume * 0.55);
    }
  }

  // Stop ALL voice clips immediately so NEVER more than ONE voice plays at once
  stopAllVoiceClips() {
    Object.keys(this.clips).forEach(k => {
      const c = this.clips[k];
      if (c && !c.paused) {
        try {
          c.pause();
          c.currentTime = 0;
        } catch (e) {}
      }
    });
    this.currentVoiceClip = null;
    this.currentVoicePriority = 0;
  }

  // Complete audio silence (for Game Over & Restart)
  stopAllAudios() {
    this.stopAllVoiceClips();
    this.stopBgm();
  }

  toggleBgm() {
    if (this.bgmEnabled) {
      this.stopBgm();
      return false;
    } else {
      return this.startBgm();
    }
  }

  // ================= SITUATIONAL AUDIO COORDINATOR =================
  // Strict Single-Audio Channel: Plays situational reels ONE BY ONE without mixing!
  playSituationalVoice(key, priority = 1, options = {}) {
    if (!this.voiceEnabled) return false;
    const clip = this.clips[key];
    if (!clip) return false;

    const now = Date.now();
    // Do not cut off a higher priority voice (e.g. Game Over / Meme) with lower priority
    if (this.currentVoiceClip && !this.currentVoiceClip.paused && this.currentVoicePriority > priority) {
      return false;
    }

    // STRICT SINGLE-CHANNEL: Stop any currently playing voice clip!
    this.stopAllVoiceClips();

    // Duck BGM so the situational voice is heard 100% cleanly without mixing
    this.duckBgm();

    try {
      clip.currentTime = options.startTime || 0;
      clip.volume = (options.volume !== undefined ? options.volume : 1.0) * this.masterVolume;
      clip.loop = false;

      // When clip finishes, release voice channel and restore BGM volume
      clip.onended = () => {
        if (this.currentVoiceClip === clip) {
          this.currentVoiceClip = null;
          this.currentVoicePriority = 0;
          if (this.bgmEnabled) {
            this.unduckBgm();
          }
        }
      };

      const p = clip.play();
      if (p) p.catch(e => {
        console.warn(`[AudioEngine] Voice "${key}" blocked:`, e);
        this.unduckBgm();
      });

      this.currentVoiceClip = clip;
      this.currentVoicePriority = priority;
      this.lastVoiceTime = now;
      return true;
    } catch (e) {
      this.unduckBgm();
      return false;
    }
  }

  // 1. Swiggy Danger Situation (<7m chase panic - Veeramani real shouting)
  playSwiggyDanger() {
    const now = Date.now();
    if (now - this.lastDangerVoiceTime < 11000) return null; // 11s cooldown
    this.lastDangerVoiceTime = now;

    const played = this.playSituationalVoice('swiggy_danger', 2, { volume: 0.95 });
    return {
      ta: "சுவிக்கி கிட்ட வந்துருச்சு! நான் ஓடிக்கிட்டே இருப்பேன்!",
      en: "Swiggy is closing in! Keep on running!",
      playedReal: played
    };
  }

  // 2. Hosur Escape & Dodging Shouts Situation (Veeramani real running shout)
  playEscapeShout() {
    const now = Date.now();
    if (now - this.lastEscapeVoiceTime < 8000) return null; // 8s cooldown
    this.lastEscapeVoiceTime = now;

    const played = this.playSituationalVoice('escape_shout', 1, { volume: 0.9 });
    return {
      ta: "ஹோசூரில் வீரமணி தப்பிக்கும் ஓட்டம்!",
      en: "Veeramani escape sprint in Hosur! Watch the TV!",
      playedReal: played
    };
  }

  // 3. Sweet Box Boost & Instamart Blessing Situation (Veeramani real voice)
  playSweetBlessing() {
    const now = Date.now();
    if (now - this.lastSweetVoiceTime < 6000) return null; // 6s cooldown
    this.lastSweetVoiceTime = now;

    const played = this.playSituationalVoice('sweet_blessing', 1, { volume: 0.9 });
    return {
      ta: "இன்ஸ்டாமார்ட் ஸ்வீட் பாக்ஸ்! வேகம் கூடுது பா!",
      en: "Instamart sweet energy boost! Widening the gap!",
      playedReal: played
    };
  }

  // 4. Mega COD Order / Cannon Frenzy (Veeramani real voice)
  playMegaOrder() {
    const now = Date.now();
    if (now - this.lastOrderVoiceTime < 15000) return null; // 15s cooldown
    this.lastOrderVoiceTime = now;

    const played = this.playSituationalVoice('mega_order', 3, { volume: 0.95 });
    return {
      ta: "1.8 லட்சம் ஐபோன் & பீரங்கி ஆர்டர் வருது பா!",
      en: "1.8 Lakh iPhone & Cannon COD order dispatched to Dharmapuri!",
      playedReal: played
    };
  }

  // 5. Official Veeramani "All Game Over,,,," Dialogue
  playGameOverOfficial() {
    this.stopAllAudios(); // Silence all other audio immediately!
    const played = this.playSituationalVoice('gameover', 10, { volume: 1.0 }); // Priority 10 locks channel
    return {
      ta: "அய்யய்யோ... ஆல் கேம் ஓவர்! என்கிட்ட காசு இல்ல பா!",
      en: "All game over,,,, Please cancel the Cash-on-Delivery orders!",
      playedReal: played
    };
  }

  // 6. Game Start Pursuit Intro (Delivery Agents Chasing Veeramani)
  playChaseIntro(onComplete) {
    this.init();
    this.stopAllAudios(); // Silence everything before starting intro!

    const clip = this.clips['chase_intro'];
    if (clip) {
      clip.currentTime = 0;
      clip.volume = 0.95 * this.masterVolume;
      clip.loop = false;
      this.currentVoiceClip = clip;
      this.currentVoicePriority = 3;

      clip.onended = () => {
        this.currentVoiceClip = null;
        this.currentVoicePriority = 0;
        // Start highway BGM only after intro finishes so they NEVER mix!
        if (onComplete) onComplete();
        else this.startBgm();
      };

      const p = clip.play();
      if (p) p.catch(e => {
        console.warn(`[AudioEngine] Intro blocked:`, e);
        if (onComplete) onComplete();
        else this.startBgm();
      });

      return {
        ta: "டெலிவரி ஏஜென்ட்ஸ் வீரமணி பின்னாடி ஓடுறாங்க! கேஷ் ஆன் டெலிவரி ஆர்டர கேன்சல் பண்றேன்னு சொல்லிட்டு ஓடுறாரு!",
        en: "Delivery agents running behind Veeramani for pending COD payments!",
        playedReal: true
      };
    } else {
      if (onComplete) onComplete();
      else this.startBgm();
      return null;
    }
  }

  // 7. Veeramani Damage / Heart Loss Scream
  playDamageShout() {
    const now = Date.now();
    if (now - this.lastDamageVoiceTime < 1800) return null;
    this.lastDamageVoiceTime = now;
    const played = this.playSituationalVoice('swiggy_danger', 4, { volume: 1.0 });
    this.playNoise('lowpass', 1100, 90, 0.35, 0.6, 0);
    return {
      ta: "அடி ஆத்தி! நெஞ்சில அடிச்சிட்டான்!",
      en: "Ouch! Lost a heart! Keep moving!",
      playedReal: played
    };
  }

  // 8. Town Bus 1.5s Advance Air Horn Warning
  playBusWarningHorn() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    // Heavy dual-tone air-horn blast (G4 392Hz + C5 523Hz)
    this.playTone('sawtooth', 392, 392, 0.35, 0.42, 0);
    this.playTone('sawtooth', 523, 523, 0.35, 0.38, 0);
    this.playTone('sawtooth', 392, 392, 0.45, 0.48, 0.4);
    this.playTone('sawtooth', 523, 523, 0.45, 0.42, 0.4);
  }

  // 9. Veeramani Auto Horn Pedal Blast
  playVeeramaniHorn() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    // Punchy auto horn dual pulse
    this.playTone('sawtooth', 440, 440, 0.16, 0.38, 0);
    this.playTone('sawtooth', 587, 587, 0.16, 0.32, 0);
    this.playTone('sawtooth', 440, 440, 0.22, 0.42, 0.18);
    this.playTone('sawtooth', 587, 587, 0.22, 0.36, 0.18);
  }

  // 10. Desi Cow Moo Sound
  playCowMoo() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    this.playTone('triangle', 190, 115, 0.55, 0.35, 0);
  }

  // 11. Slide & Duck Whoosh Under High Banners
  playSlideWhoosh() {
    if (!this.sfxEnabled) return;
    this.init();
    if (!this.ctx) return;
    this.playNoise('bandpass', 1100, 280, 0.22, 0.32, 0);
  }

  speak() {
    // Disabled entirely - 100% Veeramani authentic audio only, no synthetic/female voices!
    return;
  }

  // THE VIRAL VEERAMANI ERA MEME
  // "You can find someone who is hiding, but you can never find someone who's running!"
  playVeeramaniEraMeme() {
    this.init();
    // Play with priority 5 and automatic BGM ducking so it plays strictly alone!
    const playedRealAudio = this.playSituationalVoice('meme', 5, { volume: 1.0 });

    const memeTa = "ஒளிஞ்சிருக்கிறவன கூட கண்டுபிடிச்சிரலாம், ஆனா ஓடிக்கிட்டே இருக்கிறவன கண்டுபிடிக்கவே முடியாது! நான் ஓடிக்கிட்டே தான் இருப்பேன்!";
    const memeEn = "You can find someone who's hiding, but you can never find someone who's running! I'll just keep on running!";

    return {
      ta: memeTa,
      en: memeEn,
      usingRealAudio: playedRealAudio
    };
  }

  swiggyChaseShout() {
    if (this.playClip('swiggy')) {
      return { ta: "சுவிக்கி டெலிவரி சார்!", en: "Swiggy delivery sir!" };
    }
    const quotes = [
      { ta: "சார் உங்க 1.69 லட்சம் டிவி வந்துருச்சு! நில்லுங்க!", en: "Sir your 1.69 lakh TV is here! Stop!" },
      { ta: "சுவிக்கி டெலிவரி சார்! கேஷ் ஆன் டெலிவரி!", en: "Swiggy delivery sir! Cash on delivery!" },
      { ta: "பார்சல் விழுந்துட்டே இருக்கு சார்!", en: "Parcels are falling, take it sir!" }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    this.speak(q.ta, q.en, 1.3, 1.1);
    return q;
  }

  veeramaniJump() {
    if (this.playClip('jump')) {
      return { ta: "ஹப்!", en: "Hup!" };
    }
    const quotes = [
      { ta: "அடி ஆத்தி!", en: "Adi Aathi!" },
      { ta: "குதி!", en: "Jump!" },
      { ta: "நான் ஓடுவேன்!", en: "I will run!" }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    this.speak(q.ta, q.en);
    return q;
  }

  veeramaniDuck() {
    if (this.playClip('duck')) {
      return { ta: "அம்மாடி!", en: "Ammadi!" };
    }
    const quotes = [
      { ta: "அம்மாடி டிவி விழுது!", en: "TV falling! Duck!" },
      { ta: "கீழ படு!", en: "Slide under!" }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    this.speak(q.ta, q.en);
    return q;
  }

  veeramaniSweet() {
    const res = this.playSweetBlessing();
    if (res) return res;
    const quotes = [
      { ta: "ஆஹா ஸ்வீட் பாக்ஸ்!", en: "Aaha Sweet Box!" },
      { ta: "லட்டு எனக்கு தான்!", en: "Laddu is mine!" }
    ];
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    this.speak(q.ta, q.en);
    return q;
  }

  veeramaniGameOver() {
    return this.playGameOverOfficial();
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    try { localStorage.setItem('vm_sfx', this.sfxEnabled ? '1' : '0'); } catch(e) {}
    return this.sfxEnabled;
  }

  toggleVoice() {
    this.voiceEnabled = !this.voiceEnabled;
    try { localStorage.setItem('vm_voice', this.voiceEnabled ? '1' : '0'); } catch(e) {}
    return this.voiceEnabled;
  }
}

window.audioEngine = new VeeramaniAudio();
