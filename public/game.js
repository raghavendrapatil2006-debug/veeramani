/**
 * Veeramani Run - Swiggy Chase & Falling Parcels Edition
 * 
 * Game Mechanics:
 * - Swiggy Delivery Agent actively chasing Veeramani from behind on an orange scooter / running.
 * - Dynamic Chase Distance: Tripping or colliding causes Swiggy to close in!
 * - Parcels Falling From Above: 1.69 Lakh Smart TVs, Double-Door Refrigerators,
 *   Washing Machines, and COD Packages plummet from the sky with ground target shadows!
 * - Landed parcels become ground hurdles that roll back, requiring timed jumps!
 * - Festive Sweet Boxes (+50 pts, +sprint boost to widen Swiggy gap!)
 * - Features the viral "Veeramani Era" meme:
 *   "You can find someone who's hiding, but you can never find someone who's running!"
 */

class VeeramaniGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.V_WIDTH = 960;
    this.V_HEIGHT = 380;
    this.CANVAS_WIDTH = 960;
    this.CANVAS_HEIGHT = 380;
    this.GROUND_Y = 310;
    this.animFrameId = null;
    this._lastRestartTime = 0;

    // Load Veeramani face
    this.faceImg = new Image();
    this.faceImg.src = 'assets/images/veeramani-face.png';
    this.faceLoaded = false;
    this.faceImg.onload = () => { this.faceLoaded = true; };

    // Game state
    this.state = 'START';
    this.mode = 'endless';
    this.paceMultiplier = 1.0;

    // Timing & Distance
    this.lastTime = 0;
    this.gameTime = 0;
    this.countdownTime = 60.0;
    this.distance = 0;
    this.score = 0;
    this.bestScore = 0;
    this.sweetsCollected = 0;
    this.parcelsDodged = 0;
    this.streak = 0;

    // Swiggy Chase System
    this.swiggyDistance = 22.0; // Distance in meters (0 = caught!)
    this.swiggyMinX = -80;
    this.swiggyShoutTimer = 8.0;

    // FX
    this.screenShake = 0;
    this.slowMoTimer = 0;
    this.slowMoScale = 1.0;

    // Dynamic Situational System
    this.currentSituation = 'normal'; // 'normal' | 'danger' | 'boost' | 'sigma' | 'barrage'
    this.situationTimer = 0;

    // Auto Rush Reference Features (3 Hearts, Coins, Horn with Cooldown, Power-ups, Zones)
    this.hearts = 3;
    this.invulnerableTimer = 0;
    this.coinsCollected = 0;
    this.hornCooldown = 0;
    this.hornCooldownMax = 8.0;
    this.powerups = { magnet: 0, shield: 0, slowmo: 0 };
    this.zone = 1; // 1: Day (0-500m), 2: Rain (500-1000m), 3: Night (1000m+)
    this.coins = [];
    this.powerupItems = [];
    this.hornShockwaves = [];

    // Load best score
    try {
      this.bestScore = parseInt(localStorage.getItem('vm_best') || '0', 10);
    } catch (e) {
      this.bestScore = 0;
    }

    // Veeramani Player
    this.player = {
      x: 210, // positioned ahead of chasing Swiggy
      y: this.GROUND_Y - 74,
      baseY: this.GROUND_Y - 74,
      width: 44,
      height: 74,
      duckHeight: 38,
      velocityY: 0,
      jumpVelocity: -14.5,
      isGrounded: true,
      isDucking: false,
      isJumping: false,
      runFrame: 0,
      speechBubble: null,
      sigmaGlow: 0
    };

    // Swiggy Chaser
    this.swiggy = {
      x: 30,
      y: this.GROUND_Y - 60,
      wheelRot: 0,
      scooterOffset: 0
    };

    // Parallax background
    this.bgOffsetFar = 0;
    this.bgOffsetNear = 0;
    this.groundOffset = 0;

    // Entities
    this.fallingParcels = []; // dropping from sky
    this.groundObstacles = []; // landed parcels on road
    this.sweets = [];
    this.particles = [];
    this.floatingTexts = [];

    // Spawners
    this.skySpawnTimer = 1.4;
    this.obstacleSpawnTimer = 3.5;
    this.busScheduleTimer = 22.0;
    this.busWarningActive = false;
    this.busWarningTimer = 0;

    // Input handlers
    this.keys = {};
    this.setupInputs();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.ensureLoopRunning();
  }

  ensureLoopRunning() {
    if (!this.animFrameId) {
      this.lastTime = null;
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.scaleX = (rect.width * dpr) / this.V_WIDTH;
    this.scaleY = (rect.height * dpr) / this.V_HEIGHT;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'chill') this.paceMultiplier = 0.8;
    else if (mode === 'cod_rush') this.paceMultiplier = 1.35;
    else this.paceMultiplier = 1.0;
  }

  setPace(multiplier) {
    this.paceMultiplier = multiplier;
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        this.keys['jump'] = true;
        this.handleJumpPress();
      }
      if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        this.keys['duck'] = true;
        this.handleDuckPress();
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this.keys['sprint'] = true;
      }
      if (['KeyH', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        this.blastHorn();
      }
      if (e.code === 'KeyP') {
        this.togglePause();
      }
      if (['Space', 'Enter', 'KeyR'].includes(e.code) && (this.state === 'START' || this.state === 'GAMEOVER')) {
        e.preventDefault();
        this.startOrRestart();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        this.keys['jump'] = false;
        this.player.isJumping = false;
      }
      if (['ArrowDown', 'KeyS'].includes(e.code)) {
        this.keys['duck'] = false;
        this.handleDuckRelease();
      }
      if (['ArrowRight', 'KeyD'].includes(e.code)) {
        this.keys['sprint'] = false;
      }
    });

    // Touch Virtual Buttons
    const btnJump = document.getElementById('btn-jump');
    const btnDuck = document.getElementById('btn-duck');
    const btnHorn = document.getElementById('btn-horn');

    if (btnHorn) {
      btnHorn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.blastHorn();
      });
    }

    if (btnJump) {
      btnJump.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.keys['jump'] = true;
        this.handleJumpPress();
      });
      btnJump.addEventListener('pointerup', () => {
        this.keys['jump'] = false;
        this.player.isJumping = false;
      });
      btnJump.addEventListener('pointercancel', () => {
        this.keys['jump'] = false;
        this.player.isJumping = false;
      });
    }

    if (btnDuck) {
      btnDuck.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.keys['duck'] = true;
        this.handleDuckPress();
      });
      btnDuck.addEventListener('pointerup', () => {
        this.keys['duck'] = false;
        this.handleDuckRelease();
      });
      btnDuck.addEventListener('pointercancel', () => {
        this.keys['duck'] = false;
        this.handleDuckRelease();
      });
    }

    // Canvas click/touch
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state === 'PLAYING') {
        const rect = this.canvas.getBoundingClientRect();
        const clientY = e.clientY - rect.top;
        if (clientY > rect.height * 0.75) {
          this.keys['duck'] = true;
          this.handleDuckPress();
        } else {
          this.keys['jump'] = true;
          this.handleJumpPress();
        }
      } else if (this.state === 'START' || this.state === 'GAMEOVER') {
        e.preventDefault();
        this.startOrRestart();
      }
    });

    this.canvas.addEventListener('pointermove', () => {
      if (this.state === 'GAMEOVER' || this.state === 'START') {
        this.canvas.style.cursor = 'pointer';
      } else {
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('pointerup', () => {
      this.keys['jump'] = false;
      this.keys['duck'] = false;
      this.handleDuckRelease();
    });
  }

  handleJumpPress() {
    if (this.state === 'START' || this.state === 'GAMEOVER') {
      this.startOrRestart();
      return;
    }
    if (this.state !== 'PLAYING') return;

    if (this.player.isGrounded) {
      this.player.isGrounded = false;
      this.player.isJumping = true;
      this.player.isDucking = false;
      this.player.velocityY = this.player.jumpVelocity;

      window.audioEngine.playJump();
      if (Math.random() < 0.28) {
        const q = window.audioEngine.veeramaniJump();
        this.showSpeechBubble(q.ta, q.en, 2.0);
      }
      this.spawnDust(this.player.x + 20, this.GROUND_Y, 8);
    }
  }

  handleDuckPress() {
    if (this.state !== 'PLAYING') return;

    if (!this.player.isGrounded) {
      // Fast drop in air
      this.player.velocityY = 14;
      this.spawnDust(this.player.x + 20, this.player.y + this.player.height, 4);
    } else {
      if (!this.player.isDucking) {
        this.player.isDucking = true;
        window.audioEngine.playDuck();
        if (Math.random() < 0.25) {
          const q = window.audioEngine.veeramaniDuck();
          this.showSpeechBubble(q.ta, q.en, 2.0);
        }
        this.spawnDust(this.player.x + 10, this.GROUND_Y, 5);
      }
    }
  }

  handleDuckRelease() {
    if (this.player.isDucking) {
      this.player.isDucking = false;
    }
  }

  showSpeechBubble(textTa, textEn, duration = 2.4, isMeme = false) {
    this.player.speechBubble = {
      textTa,
      textEn,
      timer: duration,
      maxTime: duration,
      isMeme
    };
    if (isMeme) {
      this.player.sigmaGlow = duration;
    }
  }

  // Dynamic Situational UI & Audio Coordinator
  setSituation(name, duration = 0, message = null, icon = '🚨') {
    this.currentSituation = name;
    this.situationTimer = duration;

    const wrapper = document.getElementById('stage-wrapper');
    if (wrapper) {
      wrapper.classList.remove('situation-danger', 'situation-boost', 'situation-sigma', 'situation-barrage');
      if (name !== 'normal') {
        wrapper.classList.add(`situation-${name}`);
      }
    }

    const banner = document.getElementById('situational-banner');
    const bText = document.getElementById('sit-text');
    const bIcon = document.getElementById('sit-icon');
    if (banner) {
      banner.classList.remove('danger', 'boost', 'sigma', 'barrage');
      if (name !== 'normal' && message) {
        banner.classList.remove('hidden');
        banner.classList.add(name);
        if (bText) bText.textContent = message;
        if (bIcon) bIcon.textContent = icon;
      } else if (name === 'normal') {
        banner.classList.add('hidden');
      }
    }
  }

  startOrRestart() {
    // Debounce rapid repeated triggers (e.g. keydown + click or touch double fire)
    const now = performance.now();
    if (this._lastRestartTime && now - this._lastRestartTime < 250) {
      return;
    }
    this._lastRestartTime = now;

    // Reset frame delta timing and guarantee unkillable loop is running
    this.lastTime = null;
    this.ensureLoopRunning();

    window.audioEngine.init();
    this.state = 'PLAYING';
    this.gameTime = 0;
    this.countdownTime = 60.0;
    this.distance = 0;
    this.score = 0;
    this.sweetsCollected = 0;
    this.parcelsDodged = 0;
    this.streak = 0;
    this.swiggyDistance = 22.0; // 22 meters lead
    this.slowMoTimer = 0;
    this.slowMoScale = 1.0;
    this.screenShake = 0;

    // Auto Rush resets
    this.hearts = 3;
    this.invulnerableTimer = 0;
    this.coinsCollected = 0;
    this.hornCooldown = 0;
    this.powerups = { magnet: 0, shield: 0, slowmo: 0 };
    this.zone = 1;
    this.coins = [];
    this.powerupItems = [];
    this.hornShockwaves = [];

    // Reset 3 Hearts UI
    for (let i = 1; i <= 3; i++) {
      const hEl = document.getElementById('heart-' + i);
      if (hEl) hEl.classList.remove('lost');
    }

    this.player.y = this.GROUND_Y - this.player.height;
    this.player.velocityY = 0;
    this.player.isGrounded = true;
    this.player.isDucking = false;
    this.player.speechBubble = null;
    this.player.sigmaGlow = 0;

    this.fallingParcels = [];
    this.groundObstacles = [];
    this.sweets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.skySpawnTimer = 1.2;
    this.obstacleSpawnTimer = 3.5;
    this.busScheduleTimer = 22.0;
    this.busWarningActive = false;
    this.busWarningTimer = 0;
    this.swiggyShoutTimer = 6.0;

    // Hide overlays & sticky restart bar
    const startOverlay = document.getElementById('start-overlay');
    const overOverlay = document.getElementById('over-overlay');
    const pauseOverlay = document.getElementById('pause-overlay');
    const stickyBar = document.getElementById('sticky-restart-bar');
    if (startOverlay) startOverlay.classList.add('hidden');
    if (overOverlay) overOverlay.classList.add('hidden');
    if (pauseOverlay) pauseOverlay.classList.add('hidden');
    if (stickyBar) stickyBar.classList.add('hidden');
    this.canvas.style.cursor = 'default';

    // Stop all lingering audios cleanly before starting
    if (window.audioEngine) {
      window.audioEngine.stopAllAudios();
      const intro = window.audioEngine.playChaseIntro(() => {
        // Callback when intro finishes: start BGM cleanly so they never mix!
        if (this.state === 'PLAYING') {
          window.audioEngine.startBgm();
        }
      });

      if (intro && intro.playedReal) {
        this.showSpeechBubble(intro.ta, intro.en, 3.8, true);
      } else {
        window.audioEngine.startBgm();
      }
    }
    this.setSituation('normal', 3.0, '🏃‍♂️ ESCAPE COMMENCED! DODGE OBSTACLES & JUMP!', '🏃‍♂️');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      if (window.audioEngine) window.audioEngine.pauseBgm();
      const pauseOverlay = document.getElementById('pause-overlay');
      if (pauseOverlay) pauseOverlay.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      if (window.audioEngine && window.audioEngine.bgmEnabled) window.audioEngine.resumeBgm();
      const pauseOverlay = document.getElementById('pause-overlay');
      if (pauseOverlay) pauseOverlay.classList.add('hidden');
    }
  }

  getCurrentSpeed() {
    let base = 8.0;
    if (this.mode === 'cod_rush') base = 11.0;
    if (this.mode === 'chill') base = 6.5;

    // Sprint key boost
    if (this.keys['sprint']) base += 2.5;

    const accel = Math.min(this.gameTime * 0.08, 8.0);
    return (base + accel) * this.paceMultiplier * this.slowMoScale;
  }

  gameOver(reason = 'swiggy_caught') {
    this.state = 'GAMEOVER';
    this.canvas.style.cursor = 'pointer';

    let quote = {
      ta: "அய்யய்யோ... ஆல் கேம் ஓவர்! என்கிட்ட காசு இல்ல பா!",
      en: "All game over,,,, Please cancel the Cash-on-Delivery orders!"
    };

    if (window.audioEngine) {
      window.audioEngine.stopAllAudios();
      window.audioEngine.playGameOver();
      const res = window.audioEngine.veeramaniGameOver();
      if (res && res.ta) quote = res;
    }

    const isNewBest = this.distance > this.bestScore;
    if (isNewBest) {
      this.bestScore = Math.floor(this.distance);
      try {
        localStorage.setItem('vm_best', this.bestScore.toString());
      } catch (e) {}
    }

    this.screenShake = 16;

    // Show Sticky Restart Bar Viewport Banner
    const stickyBar = document.getElementById('sticky-restart-bar');
    if (stickyBar) stickyBar.classList.remove('hidden');

    // Show Game Over Overlay
    const overOverlay = document.getElementById('over-overlay');
    if (overOverlay) {
      overOverlay.classList.remove('hidden');

      const elTitle = document.getElementById('over-title');
      if (elTitle) {
        if (reason === 'crushed_by_parcel') elTitle.textContent = "CRUSHED BY 1.69 LAKH TV!";
        else if (reason === 'swiggy_caught') elTitle.textContent = "SWIGGY CAUGHT VEERAMANI! COD DELIVERED!";
        else elTitle.textContent = "TRIPPED ON PARCEL!";
      }

      const elScore = document.getElementById('final-score');
      const elBest = document.getElementById('final-best');
      const elTime = document.getElementById('final-time');
      const elSweets = document.getElementById('final-sweets');
      const elDodges = document.getElementById('final-dodges');
      const elBadge = document.getElementById('new-best-badge');
      const elTaQuote = document.getElementById('over-quote-ta');
      const elEnQuote = document.getElementById('over-quote-en');
      const elCodTotal = document.getElementById('final-cod-total');

      if (elScore) elScore.textContent = `${Math.floor(this.distance)}m`;
      if (elBest) elBest.textContent = `${this.bestScore}m`;
      if (elTime) elTime.textContent = this.formatTime(this.gameTime);
      if (elSweets) elSweets.textContent = this.sweetsCollected;
      if (elDodges) elDodges.textContent = this.parcelsDodged;
      if (elBadge) elBadge.style.display = isNewBest ? 'inline-block' : 'none';

      if (elCodTotal) {
        const codTotalVal = 169000 + (this.parcelsDodged * 42000) + Math.floor(this.distance * 85);
        elCodTotal.textContent = `₹${codTotalVal.toLocaleString('en-IN')}`;
      }

      if (elTaQuote) elTaQuote.textContent = `"${quote.ta}"`;
      if (elEnQuote) elEnQuote.textContent = `— ${quote.trans || quote.en}`;
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  loop(currentTime) {
    // Schedule next frame upfront so the loop NEVER dies under any condition
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));

    try {
      if (!this.lastTime) this.lastTime = currentTime;
      let dt = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Guard against abnormal dt (tab switches, pause lag, negative jumps)
      if (dt > 0.1) dt = 0.1;
      if (dt < 0) dt = 0;

      this.update(dt);
      this.draw();
    } catch (err) {
      console.error("[Veeramani Run Loop Error]:", err);
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= dt;
      if (this.slowMoTimer <= 0) this.slowMoScale = 1.0;
    }

    // Auto Rush timer decays
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.hornCooldown > 0) this.hornCooldown = Math.max(0, this.hornCooldown - dt);

    if (this.powerups.shield > 0) this.powerups.shield -= dt;
    if (this.powerups.magnet > 0) {
      this.powerups.magnet -= dt;
      this.attractPickups(dt);
    }
    if (this.powerups.slowmo > 0) {
      this.powerups.slowmo -= dt;
      this.slowMoScale = 0.6;
    } else if (this.slowMoTimer <= 0) {
      this.slowMoScale = 1.0;
    }

    const currentSpeed = this.getCurrentSpeed();

    this.gameTime += dt * this.slowMoScale;
    this.distance += (currentSpeed * dt * 10);
    this.score = Math.floor(this.distance);

    // Auto Rush Dynamic Zones (every ~500m: Day -> Rain -> Night)
    const prevZone = this.zone;
    if (this.distance < 500) {
      this.zone = 1; // Highway Sunset Day
    } else if (this.distance < 1000) {
      this.zone = 2; // Monsoon Rain storm
    } else {
      this.zone = 3; // Cyber Neon Midnight
    }

    if (this.zone !== prevZone) {
      if (this.zone === 2) {
        this.setSituation('boost', 3.5, '🌧️ ZONE 2: MONSOON HIGHWAY PURSUIT!', '🌧️');
        this.showSpeechBubble("மழை பெய்யுது பா! வழுக்கிடாம ஓடு!", "Monsoon rain storm! Watch the wet road!", 3.0);
      } else if (this.zone === 3) {
        this.setSituation('sigma', 3.5, '🌙 ZONE 3: CYBER NEON MIDNIGHT CHASE!', '🌙');
        this.showSpeechBubble("நைட் ஆயிருச்சு! வீரமணி எரா ஓட்டம்!", "Cyber midnight zone! The Veeramani Era continues!", 3.0);
      }
    }

    // Swiggy Chase Gap calculations
    // Base pursuit: Swiggy tries to maintain 18m, closing in if Veeramani is ducking or slow
    let gapRate = (this.keys['sprint'] ? 2.8 : 0) - (this.player.isDucking ? 2.2 : 0.25);
    this.swiggyDistance = Math.min(30.0, Math.max(0, this.swiggyDistance + gapRate * dt));

    // Dynamic Situational Timer Decay
    if (this.situationTimer > 0) {
      this.situationTimer -= dt;
      if (this.situationTimer <= 0) {
        if (this.swiggyDistance < 7.0) {
          this.setSituation('danger', 0, `🚨 EMERGENCY! SWIGGY WITHIN ${this.swiggyDistance.toFixed(1)}M! SPRINT!`, '🚨');
        } else {
          this.setSituation('normal');
        }
      }
    }

    // Swiggy Danger Situation (< 7m gap trigger)
    if (this.swiggyDistance < 7.0) {
      if (this.currentSituation !== 'danger' && this.situationTimer <= 0) {
        this.setSituation('danger', 0, `🚨 EMERGENCY! SWIGGY WITHIN ${this.swiggyDistance.toFixed(1)}M! SPRINT!`, '🚨');
      }
      const dangerVoice = window.audioEngine.playSwiggyDanger();
      if (dangerVoice && dangerVoice.playedReal) {
        this.showSpeechBubble(dangerVoice.ta, dangerVoice.en, 3.5, false);
      }
    } else if (this.currentSituation === 'danger' && this.situationTimer <= 0) {
      this.setSituation('normal');
    }

    // If Swiggy catches Veeramani!
    if (this.swiggyDistance <= 1.0) {
      this.gameOver('swiggy_caught');
      return;
    }

    // Time Attack countdown
    if (this.mode === 'time_attack') {
      this.countdownTime -= dt * this.slowMoScale;
      if (this.countdownTime <= 0) {
        this.countdownTime = 0;
        this.gameOver('timeout');
        return;
      }
    }

    // Milestone sound & situational triggers (every 250m)
    if (Math.floor(this.distance / 250) > Math.floor((this.distance - currentSpeed * dt * 10) / 250)) {
      window.audioEngine.playMilestone();
      this.addFloatingText("+VEERAMANI ERA BONUS!", this.player.x + 20, this.player.y - 25, '#ffd600');
      this.spawnConfetti();
      this.swiggyDistance = Math.min(30.0, this.swiggyDistance + 6.0); // widen gap

      const milestoneIdx = Math.floor(this.distance / 250);
      if (milestoneIdx % 2 === 1) {
        // Odd milestones (250m, 750m...): Mega Order Frenzy
        const orderVoice = window.audioEngine.playMegaOrder();
        if (orderVoice && orderVoice.playedReal) {
          this.showSpeechBubble(orderVoice.ta, orderVoice.en, 3.5, true);
        }
        this.setSituation('barrage', 3.0, '💣 MEGA COD DISPATCH! CANNONS & 1.8L IPHONES!', '💣');
      } else {
        // Even milestones (500m, 1000m...): "VEERAMANI ERA" Untouchable Sigma Mode
        const memeVoice = window.audioEngine.playVeeramaniEraMeme();
        this.showSpeechBubble(
          "ஒளிஞ்சிருக்கிறவன கூட கண்டுபிடிச்சிரலாம், ஆனா ஓடிக்கிட்டே இருக்கிறவன கண்டுபிடிக்கவே முடியாது!",
          "You can find someone who is hiding, but never someone who is running!",
          4.2,
          true
        );
        this.setSituation('sigma', 3.5, '👑 "VEERAMANI ERA" ACTIVATED - UNTOUCHABLE! 👑', '👑');
      }
    }

    // Swiggy Shouts from behind
    this.swiggyShoutTimer -= dt;
    if (this.swiggyShoutTimer <= 0) {
      this.swiggyShoutTimer = 8.0 + Math.random() * 6.0;
      window.audioEngine.playSwiggyHorn();
      const sq = window.audioEngine.swiggyChaseShout();
      this.addFloatingText("SWIGGY: " + sq.en, 60, this.GROUND_Y - 90, '#fc8019');
    }

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake -= dt * 30;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    // Parallax
    this.bgOffsetFar += currentSpeed * 0.15 * dt * 60;
    this.bgOffsetNear += currentSpeed * 0.45 * dt * 60;
    this.groundOffset += currentSpeed * dt * 60;

    // Player, Falling Parcels, Ground Obstacles, Coins, Sweets, Powerups
    this.updatePlayer(dt);
    this.updateFallingParcels(dt, currentSpeed);
    this.updateGroundObstacles(dt, currentSpeed);
    this.updateCoins(dt, currentSpeed);
    this.updateSweets(dt, currentSpeed);
    this.updatePowerupItems(dt, currentSpeed);
    this.updateHornShockwaves(dt);
    this.updateParticles(dt);
    this.updateHUD();
  }

  updatePlayer(dt) {
    const p = this.player;

    if (p.isJumping && this.keys['jump'] && p.velocityY < 0) {
      p.velocityY += 18 * dt;
    } else {
      p.velocityY += 42 * dt;
    }

    p.y += p.velocityY;

    if (p.y >= p.baseY) {
      p.y = p.baseY;
      p.velocityY = 0;
      p.isGrounded = true;
      p.isJumping = false;
    }

    if (p.isGrounded && !p.isDucking) {
      p.runFrame += dt * 14 * (this.getCurrentSpeed() / 8.0);
    }

    if (p.speechBubble) {
      p.speechBubble.timer -= dt;
      if (p.speechBubble.timer <= 0) p.speechBubble = null;
    }

    if (p.sigmaGlow > 0) {
      p.sigmaGlow -= dt;
    }

    if (p.isGrounded && Math.random() < 0.25) {
      this.spawnDust(p.x + 5, this.GROUND_Y - 2, 2);
    }
  }

  // ================= FALLING PARCELS ENGINE =================
  updateFallingParcels(dt, currentSpeed) {
    // Spawner for sky deliveries
    this.skySpawnTimer -= dt * this.slowMoScale;
    if (this.skySpawnTimer <= 0) {
      // Speed curve: no obstacles for the first 5 seconds
      if (this.gameTime >= 5.0) {
        this.spawnFallingParcel();
      }
      const baseInt = Math.max(0.85, 2.3 - (this.gameTime * 0.015));
      this.skySpawnTimer = (baseInt + Math.random() * 0.8) / this.paceMultiplier;
    }

    for (let i = this.fallingParcels.length - 1; i >= 0; i--) {
      const fp = this.fallingParcels[i];

      // Falling physics
      fp.y += fp.fallSpeed * dt * 60;
      fp.rot += fp.rotSpeed * dt * 60;

      // Ground horizontal movement with road
      fp.targetX -= currentSpeed * dt * 60;
      fp.x -= currentSpeed * dt * 40; // falls with slight forward momentum

      // Check collision with Veeramani in mid-air (uses 3 Hearts life system!)
      if (this.checkCollision(this.player, fp)) {
        this.takeDamage('crushed_by_parcel');
        this.fallingParcels.splice(i, 1);
        continue;
      }

      // Check ground impact!
      if (fp.y >= this.GROUND_Y - fp.height) {
        fp.y = this.GROUND_Y - fp.height;
        // Impact crash!
        window.audioEngine.playParcelCrash();
        this.screenShake = 10;
        this.parcelsDodged++;
        this.distance += 40; // Bonus for dodging the drop!

        // Close shave / near miss escape shouting (Hosur audio)
        if (Math.abs(fp.targetX - this.player.x) < 85) {
          const esc = window.audioEngine.playEscapeShout();
          if (esc && esc.playedReal) {
            this.showSpeechBubble(esc.ta, esc.en, 2.5);
            this.addFloatingText("💨 NARROW ESCAPE!", this.player.x + 20, this.player.y - 35, '#ff9100');
          }
        }

        // Debris & dust burst
        for (let d = 0; d < 10; d++) {
          this.particles.push({
            x: fp.targetX + fp.width / 2,
            y: this.GROUND_Y - 4,
            vx: (Math.random() - 0.5) * 6,
            vy: -(Math.random() * 4 + 2),
            radius: Math.random() * 3.5 + 1.5,
            color: '#bcaaa4',
            life: 0.45,
            maxLife: 0.45
          });
        }

        // Convert into ground obstacle hurdle!
        this.groundObstacles.push({
          x: fp.targetX,
          y: this.GROUND_Y - fp.height,
          width: fp.width,
          height: fp.height,
          label: fp.label,
          subLabel: fp.subLabel,
          color: fp.color,
          dodged: false
        });

        this.fallingParcels.splice(i, 1);
      }
    }
  }

  spawnFallingParcel() {
    window.audioEngine.playFallingWhistle();

    // Appliance Types
    const types = [
      { label: "1.69L TV", sub: "COD ₹1,69,000", w: 66, h: 42, color: "#263238", speed: 5.8 },
      { label: "FRIDGE", sub: "COD ₹48,000", w: 46, h: 62, color: "#90a4ae", speed: 6.5 },
      { label: "WASHING MACHINE", sub: "COD ₹34,000", w: 50, h: 50, color: "#cfd8dc", speed: 6.0 },
      { label: "AIR COOLER", sub: "COD ₹18,000", w: 44, h: 48, color: "#b0bec5", speed: 5.5 }
    ];

    const chosen = types[Math.floor(Math.random() * types.length)];

    // Target landing point on ground (between 380 and 860px ahead)
    const targetX = 400 + Math.random() * 440;

    this.fallingParcels.push({
      x: targetX + 140, // drops from top-right towards targetX
      y: -70,
      targetX: targetX,
      width: chosen.w,
      height: chosen.h,
      label: chosen.label,
      subLabel: chosen.sub,
      color: chosen.color,
      fallSpeed: chosen.speed,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 0.08
    });

    // Occasional Sweet Box drop
    if (Math.random() < 0.35) {
      this.spawnSweetBox();
    }

    // Auto Rush: Collectible Coins spawn along the road
    if (Math.random() < 0.45) {
      this.spawnCoins(targetX + 60, 4);
    }

    // Auto Rush: Power-up capsule (Shield, Magnet, Slow-Mo)
    if (Math.random() < 0.2) {
      this.spawnPowerupItem(targetX + 140);
    }

    // Speed curve: Pair / multi-lane drops at higher distance
    if (this.distance > 800 && Math.random() < 0.3) {
      setTimeout(() => {
        if (this.state === 'PLAYING') {
          const secondType = types[Math.floor(Math.random() * types.length)];
          const secTargetX = 520 + Math.random() * 320;
          this.fallingParcels.push({
            x: secTargetX + 120,
            y: -60,
            targetX: secTargetX,
            width: secondType.w,
            height: secondType.h,
            label: secondType.label,
            subLabel: secondType.sub,
            color: secondType.color,
            fallSpeed: secondType.speed,
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 0.08
          });
        }
      }, 400);
    }
  }

  updateGroundObstacles(dt, currentSpeed) {
    // 1. Spawner for Ground & High Obstacles (Low, Mid, High)
    if (this.gameTime >= 5.0) {
      this.obstacleSpawnTimer -= dt * this.slowMoScale;
      if (this.obstacleSpawnTimer <= 0) {
        const baseInterval = Math.max(1.6, 3.2 - (this.distance / 1200) * 1.3);
        this.obstacleSpawnTimer = (baseInterval + Math.random() * 0.8) / this.paceMultiplier;
        this.spawnGroundObstacle();
      }
    }

    // 2. Special Town Bus Scheduler & 1.6s Advance Air Horn Warning
    if (this.gameTime >= 10.0) {
      if (!this.busWarningActive) {
        this.busScheduleTimer -= dt * this.slowMoScale;
        if (this.busScheduleTimer <= 0) {
          this.busWarningActive = true;
          this.busWarningTimer = 1.6;
          if (window.audioEngine) window.audioEngine.playBusWarningHorn();
          this.setSituation('danger', 2.8, '⚠️ WARNING: MADURAI 101 TOWN BUS INCOMING! JUMP OR HORN!', '🚌');
          this.addFloatingText("📢 HONK HONK! BUS APPROACHING!", this.player.x + 30, this.player.y - 45, '#ffd600');
        }
      } else {
        this.busWarningTimer -= dt * this.slowMoScale;
        if (this.busWarningTimer <= 0) {
          this.busWarningActive = false;
          this.busScheduleTimer = 26.0 + Math.random() * 14.0; // Next bus in 26-40s
          this.spawnTownBus();
        }
      }
    }

    // 3. Update active obstacles
    for (let i = this.groundObstacles.length - 1; i >= 0; i--) {
      const obs = this.groundObstacles[i];

      // Handle scattered animation (when blown away by Horn)
      if (obs.scattered) {
        obs.x += (obs.vx || 12) * dt * 60;
        obs.y += (obs.vy || -6) * dt * 60;
        obs.vy = (obs.vy || -6) + 14 * dt;
        if (obs.x > this.V_WIDTH + 240 || obs.y > this.V_HEIGHT + 100 || obs.x < -240) {
          this.groundObstacles.splice(i, 1);
        }
        continue;
      }

      const moveSpeed = obs.speedMult ? currentSpeed * obs.speedMult : currentSpeed;
      obs.x -= moveSpeed * dt * 60;

      // Check collision with player (uses 3 Hearts life system!)
      if (this.checkObstacleCollision(obs)) {
        let reason = 'tripped';
        if (obs.category === 'high') reason = 'hit_banner';
        else if (obs.category === 'low') reason = 'tripped_pothole';
        else if (obs.type === 'cow') reason = 'hit_cow';
        else if (obs.type === 'bus') reason = 'hit_bus';

        this.takeDamage(reason);
        this.groundObstacles.splice(i, 1);
        continue;
      }

      // Check clean jump over hurdle
      if (!obs.dodged && obs.x + obs.width < this.player.x) {
        obs.dodged = true;
        this.parcelsDodged++;
        this.streak++;
        if (this.streak >= 3 && this.streak % 3 === 0) {
          this.addFloatingText(`STREAK x${this.streak}!`, this.player.x + 20, this.player.y - 25, '#00e676');
        }
      }

      if (obs.x + obs.width < -120) {
        this.groundObstacles.splice(i, 1);
      }
    }
  }

  checkObstacleCollision(obs) {
    if (this.invulnerableTimer > 0) return false;
    if (obs.scattered) return false;

    if (obs.category === 'high') {
      // High obstacles: Hanging Diwali Banner, Flying Kite
      // If player is ducking / sliding, height is reduced so player slides right under safely!
      if (this.player.isDucking) {
        if (!obs.dodged && obs.x + obs.width < this.player.x + 30) {
          obs.dodged = true;
          this.parcelsDodged++;
          this.streak++;
          this.distance += 35;
          if (window.audioEngine) window.audioEngine.playSlideWhoosh();
          this.addFloatingText("💨 SLIDE UNDER! +35m", this.player.x + 20, this.player.y - 25, '#00e5ff');
        }
        return false; // Cleared cleanly by sliding!
      }
      return this.checkCollision(this.player, obs);
    }

    if (obs.category === 'low') {
      // Low obstacles: Pothole, Speed Breaker
      // Must jump over! If player is in air jumping, clears over it!
      if (this.player.isJumping && this.player.y < this.GROUND_Y - 65) {
        if (!obs.dodged && obs.x + obs.width < this.player.x + 30) {
          obs.dodged = true;
          this.parcelsDodged++;
          this.streak++;
          this.distance += 25;
          this.addFloatingText("🦘 CLEAN JUMP! +25m", this.player.x + 20, this.player.y - 25, '#00e676');
        }
        return false; // Cleared cleanly by jumping!
      }
      return this.checkCollision(this.player, obs);
    }

    // Mid obstacles (Cow, Scooter, Tea Cart, Landed Parcel) & Special Bus
    // If player jumped high enough to clear its top:
    if (this.player.y + this.player.height <= obs.y + 14) {
      if (!obs.dodged && obs.x + obs.width < this.player.x + 30) {
        obs.dodged = true;
        this.parcelsDodged++;
        this.streak++;
        this.distance += 30;
        if (obs.type === 'cow' && window.audioEngine) window.audioEngine.playCowMoo();
        this.addFloatingText("🦘 HURDLE CLEARED! +30m", this.player.x + 20, this.player.y - 25, '#00e676');
      }
      return false;
    }

    return this.checkCollision(this.player, obs);
  }

  spawnGroundObstacle() {
    const r = Math.random();
    let newObs = null;
    const startX = this.V_WIDTH + 60;

    if (r < 0.34) {
      // LOW OBSTACLES (Pothole or Speed Breaker) - Must JUMP
      const isPothole = Math.random() < 0.55;
      newObs = {
        type: isPothole ? 'pothole' : 'speed_breaker',
        category: 'low',
        x: startX,
        y: isPothole ? this.GROUND_Y - 14 : this.GROUND_Y - 16,
        width: isPothole ? 54 : 62,
        height: isPothole ? 14 : 16,
        label: isPothole ? '🕳️ POTHOLE' : '🟡 SPEED BUMP',
        subLabel: 'JUMP!',
        color: isPothole ? '#1c1b22' : '#fbc02d',
        dodged: false
      };
    } else if (r < 0.68) {
      // HIGH OBSTACLES (Diwali Banner or Kite) - Must SLIDE / DUCK
      const isBanner = Math.random() < 0.65;
      newObs = {
        type: isBanner ? 'banner' : 'kite',
        category: 'high',
        x: startX,
        y: isBanner ? this.GROUND_Y - 84 : this.GROUND_Y - 76,
        width: isBanner ? 92 : 44,
        height: isBanner ? 42 : 36,
        label: isBanner ? '🚩 DIWALI BANNER' : '🪁 KITE',
        subLabel: 'SLIDE / DUCK [↓]',
        color: isBanner ? '#d32f2f' : '#ab47bc',
        dodged: false
      };
    } else {
      // MID OBSTACLES (Desi Cow, Delivery Scooter, Tea Pushcart) - JUMP or HORN
      const midTypes = [
        { type: 'cow', w: 66, h: 48, label: '🐄 MADURAI COW', sub: 'JUMP / HORN', color: '#8d6e63' },
        { type: 'scooter', w: 56, h: 46, label: '🛵 SCOOTER', sub: 'JUMP / HORN', color: '#ff7043' },
        { type: 'cart', w: 58, h: 52, label: '🛒 TEA CART', sub: 'JUMP / HORN', color: '#6d4c41' }
      ];
      const chosen = midTypes[Math.floor(Math.random() * midTypes.length)];
      newObs = {
        type: chosen.type,
        category: 'mid',
        x: startX,
        y: this.GROUND_Y - chosen.h,
        width: chosen.w,
        height: chosen.h,
        label: chosen.label,
        subLabel: chosen.sub,
        color: chosen.color,
        dodged: false
      };
    }

    if (newObs) {
      this.groundObstacles.push(newObs);
    }
  }

  spawnTownBus() {
    this.groundObstacles.push({
      type: 'bus',
      category: 'special',
      x: this.V_WIDTH + 80,
      y: this.GROUND_Y - 68,
      width: 140,
      height: 68,
      speedMult: 1.32,
      label: '🚌 101 MATTUTHAVANI',
      subLabel: 'HORN / JUMP!',
      color: '#1b5e20',
      dodged: false
    });
  }

  spawnSweetBox() {
    this.sweets.push({
      x: this.V_WIDTH + 80,
      y: Math.random() < 0.5 ? this.GROUND_Y - 95 : this.GROUND_Y - 32,
      width: 28,
      height: 28,
      bobOffset: Math.random() * Math.PI * 2
    });
  }

  updateSweets(dt, currentSpeed) {
    for (let i = this.sweets.length - 1; i >= 0; i--) {
      const sw = this.sweets[i];
      sw.x -= currentSpeed * dt * 60;
      sw.bobOffset += dt * 4;

      const visualY = sw.y + Math.sin(sw.bobOffset) * 4;

      if (this.checkCollision(this.player, { x: sw.x, y: visualY, width: sw.width, height: sw.height })) {
        this.sweetsCollected++;
        this.distance += 75;
        // Sweets give Veeramani a sprint surge, widening the Swiggy gap!
        this.swiggyDistance = Math.min(30.0, this.swiggyDistance + 4.5);
        this.addFloatingText("+4.5m GAP! SPEED BOOST!", this.player.x + 20, this.player.y - 30, '#00e676');

        window.audioEngine.playSweetCollect();
        const q = window.audioEngine.veeramaniSweet();
        if (q) {
          this.showSpeechBubble(q.ta, q.en, 2.5);
        }
        this.setSituation('boost', 2.5, '⚡ SWEET HYPERDRIVE! +4.5M ESCAPE GAP!', '⚡');

        this.sweets.splice(i, 1);
      } else if (sw.x + sw.width < -60) {
        this.sweets.splice(i, 1);
      }
    }
  }

  // ================= AUTO RUSH DAMAGE & LIFE SYSTEM (3 HEARTS) =================
  takeDamage(reason = 'tripped') {
    if (this.powerups.shield > 0) {
      this.powerups.shield = 0;
      this.invulnerableTimer = 1.2;
      this.screenShake = 10;
      this.addFloatingText("🛡️ SHIELD BLOCKED DAMAGE!", this.player.x + 20, this.player.y - 30, '#00e5ff');
      window.audioEngine.playJump();
      return;
    }

    if (this.invulnerableTimer > 0) return;

    this.hearts--;
    const hEl = document.getElementById('heart-' + (this.hearts + 1));
    if (hEl) hEl.classList.add('lost');

    this.screenShake = 16;
    window.audioEngine.playParcelCrash();

    // Swiggy closes in upon impact
    this.swiggyDistance = Math.max(0, this.swiggyDistance - 6.5);

    if (this.hearts <= 0 || this.swiggyDistance <= 1.0) {
      this.gameOver(reason);
      return;
    }

    this.invulnerableTimer = 1.8; // 1.8s invulnerability grace
    this.streak = 0;

    // Situational vocal scream!
    const shout = window.audioEngine.playDamageShout();
    if (shout && shout.playedReal) {
      this.showSpeechBubble(shout.ta, shout.en, 2.5);
    } else {
      const esc = window.audioEngine.playEscapeShout();
      if (esc && esc.playedReal) {
        this.showSpeechBubble(esc.ta, esc.en, 2.5);
      }
    }

    let alertText = "DAMAGE!";
    if (reason === 'hit_banner') alertText = "HIT BANNER! SLIDE [↓] NEXT TIME!";
    else if (reason === 'tripped_pothole') alertText = "TRIPPED IN POTHOLE! JUMP [↑]!";
    else if (reason === 'hit_cow') alertText = "HIT COW! JUMP OR HORN [H]!";
    else if (reason === 'hit_bus') alertText = "HIT BUS! HORN [H] EARLY!";
    this.addFloatingText(`💔 HEART LOST! ${alertText}`, this.player.x + 20, this.player.y - 35, '#ff1744');
  }

  // ================= AUTO RUSH HORN SCATTER MECHANIC =================
  blastHorn() {
    if (this.state !== 'PLAYING') return;
    if (this.hornCooldown > 0) return;

    this.hornCooldown = this.hornCooldownMax;
    window.audioEngine.playVeeramaniHorn();

    this.screenShake = 8;
    this.hornShockwaves.push({
      x: this.player.x + 35,
      y: this.GROUND_Y - 30,
      radius: 14,
      maxRadius: 360,
      life: 0.45,
      maxLife: 0.45
    });

    let scattered = 0;

    // Scatter falling parcels ahead
    for (let i = this.fallingParcels.length - 1; i >= 0; i--) {
      const fp = this.fallingParcels[i];
      if (fp.x >= this.player.x - 30 && fp.x <= this.player.x + 360) {
        this.spawnParcelScatterParticles(fp.x + fp.width / 2, fp.y + fp.height / 2);
        this.parcelsDodged++;
        this.fallingParcels.splice(i, 1);
        scattered++;
      }
    }

    // Scatter ground obstacles ahead
    for (let i = this.groundObstacles.length - 1; i >= 0; i--) {
      const obs = this.groundObstacles[i];
      if (obs.x >= this.player.x - 30 && obs.x <= this.player.x + 360) {
        if (obs.type === 'cow') {
          obs.scattered = true;
          obs.vx = 14;
          obs.vy = -6;
          window.audioEngine.playCowMoo();
          this.addFloatingText("MOOOOO! 🐄💨", obs.x, obs.y - 20, '#fff');
        } else if (obs.type === 'bus') {
          obs.scattered = true;
          obs.vx = -5;
          obs.vy = -5;
          this.addFloatingText("BUS SWERVED! 🚌💨", obs.x, obs.y - 20, '#ffd600');
        } else {
          this.spawnParcelScatterParticles(obs.x + obs.width / 2, obs.y + obs.height / 2);
          this.groundObstacles.splice(i, 1);
        }
        this.parcelsDodged++;
        scattered++;
      }
    }

    if (scattered > 0) {
      this.distance += scattered * 40;
      this.addFloatingText(`📢 HORN SCATTERED x${scattered}! +${scattered * 40}m`, this.player.x + 20, this.player.y - 35, '#ffd600');
    } else {
      this.addFloatingText("📢 HORN HONK!", this.player.x + 20, this.player.y - 30, '#00e5ff');
    }

    const esc = window.audioEngine.playEscapeShout();
    if (esc && esc.playedReal) {
      this.showSpeechBubble(esc.ta, esc.en, 2.0);
    }
  }

  spawnParcelScatterParticles(x, y) {
    const colors = ['#fc8019', '#ffd600', '#00e5ff', '#ff1744', '#76ff03'];
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: -(Math.random() * 6 + 2),
        radius: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  // ================= AUTO RUSH COINS & POWER-UPS =================
  spawnCoins(startX, count = 4) {
    for (let i = 0; i < count; i++) {
      this.coins.push({
        x: startX + i * 36,
        y: this.GROUND_Y - 26,
        radius: 9,
        bobOffset: Math.random() * Math.PI * 2
      });
    }
  }

  updateCoins(dt, currentSpeed) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.x -= currentSpeed * dt * 60;
      c.bobOffset += dt * 5;

      const visualY = c.y + Math.sin(c.bobOffset) * 3;

      if (this.checkCollision(this.player, { x: c.x - c.radius, y: visualY - c.radius, width: c.radius * 2, height: c.radius * 2 })) {
        this.coinsCollected++;
        this.distance += 25;
        this.addFloatingText("+🪙", c.x, visualY - 15, '#ffd600');
        window.audioEngine.playJump();
        this.coins.splice(i, 1);
      } else if (c.x < -40) {
        this.coins.splice(i, 1);
      }
    }
  }

  drawCoins(ctx) {
    ctx.save();
    this.coins.forEach(c => {
      const visualY = c.y + Math.sin(c.bobOffset) * 3;
      ctx.fillStyle = '#ffd600';
      ctx.shadowColor = 'rgba(255, 214, 0, 0.7)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(c.x, visualY, c.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff6f00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, visualY, c.radius - 2.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ff6f00';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', c.x, visualY + 3);
    });
    ctx.restore();
  }

  spawnPowerupItem(startX) {
    const types = ['shield', 'magnet', 'slowmo'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerupItems.push({
      x: startX,
      y: this.GROUND_Y - 48,
      type: type,
      width: 30,
      height: 30,
      bobOffset: Math.random() * Math.PI * 2
    });
  }

  updatePowerupItems(dt, currentSpeed) {
    for (let i = this.powerupItems.length - 1; i >= 0; i--) {
      const pu = this.powerupItems[i];
      pu.x -= currentSpeed * dt * 60;
      pu.bobOffset += dt * 4;
      const visualY = pu.y + Math.sin(pu.bobOffset) * 5;

      if (this.checkCollision(this.player, { x: pu.x, y: visualY, width: pu.width, height: pu.height })) {
        if (pu.type === 'shield') {
          this.powerups.shield = 10.0;
          this.addFloatingText("🛡️ SHIELD EQUIPPED!", this.player.x + 20, this.player.y - 30, '#00e5ff');
          this.showSpeechBubble("கவசம் ஆக்டிவேட் ஆயிருச்சு பா!", "Protective shield active!", 2.5);
        } else if (pu.type === 'magnet') {
          this.powerups.magnet = 8.0;
          this.addFloatingText("🧲 COIN MAGNET ACTIVE!", this.player.x + 20, this.player.y - 30, '#ff4081');
          this.showSpeechBubble("காந்தம்! ஸ்வீட்டும் காயினும் இழுக்குது!", "Magnet pulling all treats!", 2.5);
        } else if (pu.type === 'slowmo') {
          this.powerups.slowmo = 6.0;
          this.addFloatingText("⏱️ MATRIX SLOW-MO!", this.player.x + 20, this.player.y - 30, '#ba68c8');
        }

        window.audioEngine.playMilestone();
        this.powerupItems.splice(i, 1);
      } else if (pu.x < -60) {
        this.powerupItems.splice(i, 1);
      }
    }
  }

  drawPowerupItems(ctx) {
    ctx.save();
    this.powerupItems.forEach(pu => {
      const visualY = pu.y + Math.sin(pu.bobOffset) * 5;
      ctx.shadowBlur = 12;

      let color = '#00e5ff';
      let icon = '🛡️';
      if (pu.type === 'magnet') { color = '#ff4081'; icon = '🧲'; }
      if (pu.type === 'slowmo') { color = '#ab47bc'; icon = '⏱️'; }

      ctx.shadowColor = color;
      ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pu.x, visualY, pu.width, pu.height, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(icon, pu.x + pu.width / 2, visualY + 21);
    });
    ctx.restore();
  }

  attractPickups(dt) {
    const px = this.player.x + 20;
    const py = this.player.y + 35;

    this.coins.forEach(c => {
      const dx = px - c.x;
      const dy = py - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 260) {
        c.x += (dx / dist) * 12 * dt * 60;
        c.y += (dy / dist) * 12 * dt * 60;
      }
    });

    this.sweets.forEach(sw => {
      const dx = px - sw.x;
      const dy = py - sw.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 260) {
        sw.x += (dx / dist) * 10 * dt * 60;
        sw.y += (dy / dist) * 10 * dt * 60;
      }
    });
  }

  updateHornShockwaves(dt) {
    for (let i = this.hornShockwaves.length - 1; i >= 0; i--) {
      const hw = this.hornShockwaves[i];
      hw.life -= dt;
      hw.radius += (hw.maxRadius - hw.radius) * 10 * dt;
      if (hw.life <= 0) this.hornShockwaves.splice(i, 1);
    }
  }

  drawHornShockwaves(ctx) {
    ctx.save();
    this.hornShockwaves.forEach(hw => {
      const alpha = Math.max(0, hw.life / hw.maxLife);
      ctx.strokeStyle = `rgba(255, 214, 0, ${alpha * 0.9})`;
      ctx.lineWidth = 4 * alpha;
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(hw.x, hw.y, hw.radius, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 0.7})`;
      ctx.lineWidth = 2 * alpha;
      ctx.beginPath();
      ctx.arc(hw.x, hw.y, hw.radius * 0.85, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawRain(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(128, 216, 255, 0.45)';
    ctx.lineWidth = 1.5;
    const rainCount = 45;
    const t = this.gameTime * 20;

    for (let i = 0; i < rainCount; i++) {
      const rx = (i * 27 + (t * 18)) % (this.V_WIDTH + 60) - 30;
      const ry = (i * 43 + (t * 35)) % this.V_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  checkCollision(player, entity) {
    const pHitbox = {
      x: player.x + 8,
      y: player.isDucking ? player.y + (player.height - player.duckHeight) : player.y + 4,
      width: player.width - 16,
      height: player.isDucking ? player.duckHeight - 4 : player.height - 8
    };

    const entHitbox = {
      x: entity.x + 4,
      y: entity.y + 4,
      width: entity.width - 8,
      height: entity.height - 8
    };

    return (
      pHitbox.x < entHitbox.x + entHitbox.width &&
      pHitbox.x + pHitbox.width > entHitbox.x &&
      pHitbox.y < entHitbox.y + entHitbox.height &&
      pHitbox.y + pHitbox.height > entHitbox.y
    );
  }

  spawnDust(x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: -(Math.random() * 2.5 + 1),
        vy: -(Math.random() * 1.5),
        radius: Math.random() * 3 + 1.5,
        color: 'rgba(217, 191, 140, 0.7)',
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  spawnConfetti() {
    const colors = ['#fc8019', '#ffeb3b', '#2196f3', '#00e676', '#ff4081'];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: this.player.x + 20 + (Math.random() - 0.5) * 60,
        y: this.player.y - 20,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 5 + 3),
        radius: Math.random() * 4 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0.8,
        maxLife: 0.8
      });
    }
  }

  addFloatingText(text, x, y, color = '#fff') {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -1.2,
      color,
      alpha: 1.0,
      life: 1.1,
      maxLife: 1.1
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.life -= dt;
      ft.alpha = ft.life / ft.maxLife;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  updateHUD() {
    const elDistance = document.getElementById('hud-distance');
    const elBest = document.getElementById('hud-best');
    const elTime = document.getElementById('hud-time');
    const elSpeed = document.getElementById('hud-speed');
    const elSweets = document.getElementById('hud-sweets');
    const elChase = document.getElementById('hud-chase-gap');
    const elThreatFill = document.getElementById('hud-threat-fill');
    const elCodSaved = document.getElementById('hud-cod-saved');
    const elRadarSwiggy = document.getElementById('radar-blip-swiggy');

    if (elDistance) elDistance.textContent = `${Math.floor(this.distance)}m`;
    if (elBest) elBest.textContent = `🏆 ${this.bestScore}m`;
    if (elSweets) elSweets.textContent = `🍬 ${this.sweetsCollected}`;

    // Auto Rush 3 Hearts UI
    for (let i = 1; i <= 3; i++) {
      const hEl = document.getElementById('heart-' + i);
      if (hEl) {
        if (i <= this.hearts) hEl.classList.remove('lost');
        else hEl.classList.add('lost');
      }
    }

    // Auto Rush Zone Badge UI
    const elZoneBadge = document.getElementById('hud-zone-badge');
    const elZoneIcon = document.getElementById('zone-icon');
    const elZoneTitle = document.getElementById('zone-title');
    if (elZoneTitle && elZoneIcon) {
      if (this.zone === 1) {
        elZoneIcon.textContent = '☀️';
        elZoneTitle.textContent = 'ZONE 1: DAY';
        if (elZoneBadge) elZoneBadge.style.borderColor = 'rgba(255, 214, 0, 0.5)';
      } else if (this.zone === 2) {
        elZoneIcon.textContent = '🌧️';
        elZoneTitle.textContent = 'ZONE 2: RAIN';
        if (elZoneBadge) elZoneBadge.style.borderColor = 'rgba(0, 229, 255, 0.7)';
      } else {
        elZoneIcon.textContent = '🌙';
        elZoneTitle.textContent = 'ZONE 3: NIGHT';
        if (elZoneBadge) elZoneBadge.style.borderColor = 'rgba(233, 30, 99, 0.7)';
      }
    }

    // Auto Rush Coins
    const elCoins = document.getElementById('hud-coins');
    if (elCoins) elCoins.textContent = `🪙 ${this.coinsCollected}`;

    // Auto Rush Horn Cooldown UI
    const elHornOverlay = document.getElementById('horn-cooldown-overlay');
    const elHornBtn = document.getElementById('btn-horn');
    const elHornText = document.getElementById('horn-status-text');
    if (elHornOverlay && elHornBtn) {
      if (this.hornCooldown > 0) {
        const pct = (this.hornCooldown / this.hornCooldownMax) * 100;
        elHornOverlay.style.height = `${pct}%`;
        elHornBtn.classList.add('on-cooldown');
        if (elHornText) elHornText.textContent = `${this.hornCooldown.toFixed(1)}s [H]`;
      } else {
        elHornOverlay.style.height = '0%';
        elHornBtn.classList.remove('on-cooldown');
        if (elHornText) elHornText.textContent = 'SCATTER [H]';
      }
    }

    // Auto Rush Power-ups Tray UI
    const puShieldEl = document.getElementById('pu-shield');
    const puShieldVal = document.getElementById('pu-shield-val');
    if (puShieldEl && puShieldVal) {
      if (this.powerups.shield > 0) {
        puShieldEl.classList.remove('hidden');
        puShieldVal.textContent = `${Math.ceil(this.powerups.shield)}s`;
      } else {
        puShieldEl.classList.add('hidden');
      }
    }

    const puMagEl = document.getElementById('pu-magnet');
    const puMagVal = document.getElementById('pu-magnet-val');
    if (puMagEl && puMagVal) {
      if (this.powerups.magnet > 0) {
        puMagEl.classList.remove('hidden');
        puMagVal.textContent = `${Math.ceil(this.powerups.magnet)}s`;
      } else {
        puMagEl.classList.add('hidden');
      }
    }

    const puSlowEl = document.getElementById('pu-slowmo');
    const puSlowVal = document.getElementById('pu-slowmo-val');
    if (puSlowEl && puSlowVal) {
      if (this.powerups.slowmo > 0) {
        puSlowEl.classList.remove('hidden');
        puSlowVal.textContent = `${Math.ceil(this.powerups.slowmo)}s`;
      } else {
        puSlowEl.classList.add('hidden');
      }
    }

    // Dynamic COD Debt Escaped counter
    if (elCodSaved) {
      const savedVal = (this.parcelsDodged * 45000) + Math.floor(this.distance * 120);
      elCodSaved.textContent = `₹${savedVal.toLocaleString('en-IN')}`;
    }

    // Swiggy Chase Distance & Threat Meter
    if (elChase) {
      const d = this.swiggyDistance.toFixed(1);
      elChase.textContent = `🛵 ${d}m GAP`;
      if (this.swiggyDistance < 6) elChase.style.color = '#ff1744';
      else if (this.swiggyDistance < 12) elChase.style.color = '#ff9100';
      else elChase.style.color = '#00e676';
    }

    // Mini-Radar Blip update (Swiggy blip slides toward player blip as gap closes)
    if (elRadarSwiggy) {
      const radarFraction = Math.max(0.12, Math.min(1.0, this.swiggyDistance / 30.0));
      elRadarSwiggy.style.left = `${Math.floor(50 - radarFraction * 40)}%`;
    }

    // Threat Meter Fill Bar (0% at 30m, 100% at 0m)
    if (elThreatFill) {
      const threatPct = Math.max(0, Math.min(100, Math.floor((1 - (this.swiggyDistance / 30.0)) * 100)));
      elThreatFill.style.width = `${threatPct}%`;
      if (threatPct > 70) {
        elThreatFill.style.background = 'linear-gradient(90deg, #ff9100, #ff1744)';
      } else if (threatPct > 40) {
        elThreatFill.style.background = 'linear-gradient(90deg, #ffeb3b, #ff9100)';
      } else {
        elThreatFill.style.background = 'linear-gradient(90deg, #00e676, #00e5ff)';
      }
    }

    if (elTime) {
      if (this.mode === 'time_attack') {
        elTime.textContent = `⏱️ ${this.countdownTime.toFixed(1)}s`;
        elTime.style.color = this.countdownTime < 10 ? '#ff1744' : '#00e676';
      } else {
        elTime.textContent = `⏳ ${this.formatTime(this.gameTime)}`;
        elTime.style.color = '#fff';
      }
    }

    if (elSpeed) {
      const spdKmh = (this.getCurrentSpeed() * 2.8).toFixed(1);
      elSpeed.textContent = `${spdKmh}`;
    }
  }

  // ================= RENDER ENGINE =================
  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scaleX, this.scaleY);

    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Sky, Madurai City Hills, Road
    this.drawSky(ctx);
    this.drawHills(ctx);
    this.drawRoad(ctx);

    // Weather Effects (Monsoon Rain in Zone 2)
    if (this.zone === 2) {
      this.drawRain(ctx);
    }

    // Falling Parcels Target Landing Reticles on road
    this.drawLandingTargets(ctx);

    // Collectibles: Coins, Sweets, Power-Up Capsules
    this.drawCoins(ctx);
    this.drawSweets(ctx);
    this.drawPowerupItems(ctx);

    // Landed Parcels on Ground (Hurdles)
    this.drawGroundObstacles(ctx);

    // Falling Parcels from Sky
    this.drawFallingParcels(ctx);

    // Chasing Swiggy Delivery Executive
    this.drawSwiggyChaser(ctx);

    // Veeramani Character
    this.drawVeeramani(ctx);

    // Horn Sonic Shockwaves
    this.drawHornShockwaves(ctx);

    // Particles, Bus Advance Warning Beacon & Speech
    this.drawParticles(ctx);
    this.drawBusWarning(ctx);
    this.drawSpeechBubble(ctx);
    this.drawFloatingTexts(ctx);

    // In-game Canvas Arcade Game Over Screen with bold interactive restart button
    if (this.state === 'GAMEOVER') {
      this.drawGameOverScreen(ctx);
    }

    ctx.restore();
  }

  // Draw arcade Game Over screen directly onto Canvas
  drawGameOverScreen(ctx) {
    ctx.save();
    // 1. Semi-transparent dark vignette scrim
    ctx.fillStyle = 'rgba(6, 9, 18, 0.78)';
    ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

    // 2. Alert Badge at top
    const bannerY = 46;
    ctx.fillStyle = 'rgba(255, 23, 68, 0.25)';
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(this.V_WIDTH / 2 - 250, bannerY - 24, 500, 38, 8);
    } else {
      ctx.rect(this.V_WIDTH / 2 - 250, bannerY - 24, 500, 38);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 20px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 23, 68, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillText('🚨 SWIGGY CAUGHT VEERAMANI! 🚨', this.V_WIDTH / 2, bannerY - 5);

    // 3. Score Telemetry
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(`DISTANCE: ${Math.floor(this.distance)}m   |   BEST: ${this.bestScore}m   |   SWEETS: ${this.sweetsCollected} 🍬`, this.V_WIDTH / 2, bannerY + 36);

    // 4. Large Glowing Arcade Restart Button on Canvas
    const btnW = 460;
    const btnH = 64;
    const btnX = (this.V_WIDTH - btnW) / 2;
    const btnY = this.V_HEIGHT / 2 + 10;
    this.canvasRestartBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    const pulse = Math.sin(Date.now() * 0.007) * 0.04 + 1.0;
    ctx.save();
    ctx.translate(btnX + btnW / 2, btnY + btnH / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-(btnX + btnW / 2), -(btnY + btnH / 2));

    ctx.shadowColor = 'rgba(255, 109, 0, 0.95)';
    ctx.shadowBlur = 28;

    const grad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
    grad.addColorStop(0, '#ff9100');
    grad.addColorStop(0.5, '#ff3d00');
    grad.addColorStop(1, '#d50000');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(btnX, btnY, btnW, btnH, 16);
    } else {
      ctx.rect(btnX, btnY, btnW, btnH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 21px "Outfit", system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText('🔄 CLICK / TAP TO RESTART ESCAPE RUN', btnX + btnW / 2, btnY + btnH / 2 - 4);

    ctx.fillStyle = '#ffd54f';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText('⌨️ PRESS [SPACE], [ENTER] OR [R] TO RESTART', btnX + btnW / 2, btnY + btnH / 2 + 18);
    ctx.restore();

    // 5. Quote Preview at bottom
    ctx.fillStyle = 'rgba(255, 214, 0, 0.95)';
    ctx.font = 'italic 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('"அய்யய்யோ... ஆல் கேம் ஓவர்! என்கிட்ட காசு இல்ல பா!"', this.V_WIDTH / 2, this.V_HEIGHT - 32);

    ctx.restore();
  }

  drawSky(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, this.GROUND_Y);

    if (this.zone === 1) {
      // Zone 1: Daylight / Sunset Highway
      grad.addColorStop(0, '#f57c00');
      grad.addColorStop(0.38, '#ffb300');
      grad.addColorStop(0.72, '#ffe082');
      grad.addColorStop(1, '#fff8e1');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

      // Bright Sun
      ctx.save();
      ctx.fillStyle = 'rgba(255, 235, 59, 0.9)';
      ctx.beginPath();
      ctx.arc(820, 65, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(820, 65, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (this.zone === 2) {
      // Zone 2: Monsoon Rain Storm Sky
      grad.addColorStop(0, '#101726');
      grad.addColorStop(0.45, '#1e293b');
      grad.addColorStop(0.85, '#334155');
      grad.addColorStop(1, '#64748b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

      // Distant storm clouds
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.beginPath();
      ctx.arc(300, 45, 65, 0, Math.PI * 2);
      ctx.arc(360, 35, 75, 0, Math.PI * 2);
      ctx.arc(430, 45, 60, 0, Math.PI * 2);
      ctx.arc(750, 40, 70, 0, Math.PI * 2);
      ctx.arc(820, 30, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else {
      // Zone 3: Cosmic Cyber Neon Midnight
      grad.addColorStop(0, '#070919');     // Cosmic midnight indigo
      grad.addColorStop(0.38, '#1d0b30');  // Royal Madurai night purple
      grad.addColorStop(0.72, '#4a1240');  // Neon magenta twilight haze
      grad.addColorStop(1, '#fc8019');     // Highway sunset orange glow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.V_WIDTH, this.V_HEIGHT);

      // Shimmering Cyber Stars in Night Sky
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      const starCoords = [
        [80, 35, 1.8], [140, 65, 1.2], [220, 25, 2.0], [310, 50, 1.4],
        [420, 30, 1.6], [510, 70, 1.3], [620, 40, 2.2], [710, 25, 1.5],
        [760, 60, 1.2], [880, 35, 2.0], [930, 55, 1.4]
      ];
      starCoords.forEach(([sx, sy, sr], idx) => {
        const pulse = 0.5 + Math.sin(this.gameTime * 3 + idx) * 0.45;
        ctx.globalAlpha = Math.max(0.2, Math.min(1.0, pulse));
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Crescent Moon with Atmospheric Halo
      ctx.save();
      ctx.fillStyle = 'rgba(255, 214, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(830, 65, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.arc(830, 65, 22, 0, Math.PI * 2);
      ctx.fill();

      // Dark cutout for sharp crescent
      ctx.fillStyle = '#0f0a22';
      ctx.beginPath();
      ctx.arc(822, 60, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHills(ctx) {
    ctx.save();

    // 1. Distant Parallax: Madurai Meenakshi Temple Gopurams & City Silhouette
    const fOffset = (this.bgOffsetFar % 480);
    ctx.fillStyle = '#1a102a';
    ctx.beginPath();
    ctx.moveTo(0, this.GROUND_Y);

    for (let x = -480; x < this.V_WIDTH + 480; x += 240) {
      const gX = x - fOffset;
      // Flat base
      ctx.lineTo(gX, this.GROUND_Y);
      // Stepped Meenakshi Amman Temple Gopuram
      ctx.lineTo(gX + 30, this.GROUND_Y - 30);
      ctx.lineTo(gX + 45, this.GROUND_Y - 55);
      ctx.lineTo(gX + 60, this.GROUND_Y - 80);
      ctx.lineTo(gX + 70, this.GROUND_Y - 105);
      // Gopuram Kalasam (Spire peak)
      ctx.lineTo(gX + 75, this.GROUND_Y - 120);
      ctx.lineTo(gX + 80, this.GROUND_Y - 105);
      ctx.lineTo(gX + 90, this.GROUND_Y - 80);
      ctx.lineTo(gX + 105, this.GROUND_Y - 55);
      ctx.lineTo(gX + 120, this.GROUND_Y - 30);
      ctx.lineTo(gX + 150, this.GROUND_Y);
      // City buildings / palm trees silhouette
      ctx.lineTo(gX + 170, this.GROUND_Y - 45);
      ctx.lineTo(gX + 200, this.GROUND_Y - 45);
      ctx.lineTo(gX + 220, this.GROUND_Y);
    }
    ctx.lineTo(this.V_WIDTH, this.GROUND_Y);
    ctx.fill();

    // Glowing Gopuram Spire Kalasams
    ctx.fillStyle = '#ffd600';
    for (let x = -480; x < this.V_WIDTH + 480; x += 240) {
      const gX = x - fOffset;
      ctx.beginPath();
      ctx.arc(gX + 75, this.GROUND_Y - 120, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Near Parallax: Highway Gantry Signs & Sodium Streetlamps
    const nOffset = (this.bgOffsetNear % 320);

    // Highway Streetlamps with dynamic sodium illumination cones
    for (let x = -320; x < this.V_WIDTH + 320; x += 160) {
      const lx = x - nOffset;

      // Lamp pole
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(lx, this.GROUND_Y);
      ctx.lineTo(lx, this.GROUND_Y - 85);
      ctx.quadraticCurveTo(lx + 8, this.GROUND_Y - 100, lx + 26, this.GROUND_Y - 95);
      ctx.stroke();

      // Lamp fixture bulb
      ctx.fillStyle = '#ffe082';
      ctx.beginPath();
      ctx.arc(lx + 26, this.GROUND_Y - 95, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Sodium light cone onto road
      ctx.save();
      const lightGrad = ctx.createRadialGradient(lx + 26, this.GROUND_Y - 95, 5, lx + 26, this.GROUND_Y + 10, 85);
      lightGrad.addColorStop(0, 'rgba(255, 224, 130, 0.18)');
      lightGrad.addColorStop(1, 'rgba(255, 224, 130, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(lx + 26, this.GROUND_Y - 95);
      ctx.lineTo(lx - 25, this.GROUND_Y + 15);
      ctx.lineTo(lx + 75, this.GROUND_Y + 15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Highway Overhead Gantry Billboard Signs ("NH-44 MADURAI ➔ DHARMAPURI")
    const gantryInterval = 640;
    const gantryOffset = (this.bgOffsetFar * 1.5) % gantryInterval;
    const gx = gantryInterval - gantryOffset;

    if (gx > -120 && gx < this.V_WIDTH + 120) {
      // Gantry green sign board
      ctx.fillStyle = '#1b5e20';
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gx, this.GROUND_Y - 145, 140, 36, 4);
      ctx.fill();
      ctx.stroke();

      // Highway Sign Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NH-44 MADURAI ➔ DHARMAPURI', gx + 70, this.GROUND_Y - 131);
      ctx.fillStyle = '#ffd600';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('⚠️ CAUTION: FALLING COD PARCELS', gx + 70, this.GROUND_Y - 118);

      // Support pillars
      ctx.strokeStyle = '#546e7a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(gx + 10, this.GROUND_Y - 109);
      ctx.lineTo(gx + 10, this.GROUND_Y);
      ctx.moveTo(gx + 130, this.GROUND_Y - 109);
      ctx.lineTo(gx + 130, this.GROUND_Y);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawRoad(ctx) {
    ctx.save();
    // Premium Asphalt Surface
    const asphaltGrad = ctx.createLinearGradient(0, this.GROUND_Y, 0, this.V_HEIGHT);
    asphaltGrad.addColorStop(0, '#1c222a');
    asphaltGrad.addColorStop(1, '#0e1217');
    ctx.fillStyle = asphaltGrad;
    ctx.fillRect(0, this.GROUND_Y, this.V_WIDTH, this.V_HEIGHT - this.GROUND_Y);

    // Hazard Rumble Strip / Road Curb (Alternating Red and White Chevrons)
    const curbH = 7;
    const blockW = 20;
    const cOffset = (this.groundOffset % (blockW * 2));
    for (let x = -blockW * 2; x < this.V_WIDTH + blockW * 2; x += blockW) {
      const idx = Math.floor((x + cOffset) / blockW);
      ctx.fillStyle = (Math.abs(idx) % 2 === 0) ? '#ff1744' : '#ffffff';
      ctx.fillRect(x - cOffset, this.GROUND_Y - 1, blockW, curbH);
    }

    // Double Glowing Yellow Highway Dashed Centerlines
    ctx.fillStyle = '#ffd600';
    ctx.shadowColor = 'rgba(255, 214, 0, 0.7)';
    ctx.shadowBlur = 6;
    const dashLen = 32;
    const gapLen = 28;
    const totalDash = dashLen + gapLen;
    const dOffset = (this.groundOffset % totalDash);

    for (let x = -totalDash; x < this.V_WIDTH + totalDash; x += totalDash) {
      // Top lane line
      ctx.fillRect(x - dOffset, this.GROUND_Y + 28, dashLen, 3);
      // Bottom lane line
      ctx.fillRect(x - dOffset, this.GROUND_Y + 34, dashLen, 3);
    }

    // Roadside Embedded Reflective Cat-Eye Studs
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00e5ff';
    for (let x = -totalDash; x < this.V_WIDTH + totalDash; x += totalDash * 2) {
      ctx.fillRect(x - dOffset + 14, this.GROUND_Y + 11, 4, 3);
    }

    ctx.restore();
  }

  // Draw red landing shadow target where parcels will hit
  drawLandingTargets(ctx) {
    this.fallingParcels.forEach(fp => {
      ctx.save();
      const progress = Math.min(1.0, (fp.y + 70) / (this.GROUND_Y - 70));
      const targetW = fp.width * (0.4 + progress * 0.6);

      // Red pulsing landing reticle
      ctx.fillStyle = 'rgba(255, 61, 0, ' + (0.2 + progress * 0.45) + ')';
      ctx.beginPath();
      ctx.ellipse(fp.targetX + fp.width / 2, this.GROUND_Y + 3, targetW / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Warning exclamation mark
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('⚠️', fp.targetX + fp.width / 2 - 8, this.GROUND_Y - 8);
      ctx.restore();
    });
  }

  // Draw parcels falling from sky
  drawFallingParcels(ctx) {
    this.fallingParcels.forEach(fp => {
      ctx.save();
      ctx.translate(fp.x + fp.width / 2, fp.y + fp.height / 2);
      ctx.rotate(fp.rot);

      // Appliance Box
      ctx.fillStyle = fp.color;
      ctx.beginPath();
      ctx.roundRect(-fp.width / 2, -fp.height / 2, fp.width, fp.height, 4);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bold Appliance Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fp.label, 0, -4);

      // Red COD Stamp
      ctx.fillStyle = '#ff1744';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(fp.subLabel, 0, 8);

      ctx.restore();
    });
  }

  // Draw categorized ground and overhead obstacles
  drawGroundObstacles(ctx) {
    this.groundObstacles.forEach(obs => {
      ctx.save();
      if (obs.type === 'pothole') {
        this.drawPothole(ctx, obs);
      } else if (obs.type === 'speed_breaker') {
        this.drawSpeedBreaker(ctx, obs);
      } else if (obs.type === 'cow') {
        this.drawDesiCow(ctx, obs);
      } else if (obs.type === 'scooter') {
        this.drawScooter(ctx, obs);
      } else if (obs.type === 'cart') {
        this.drawTeaCart(ctx, obs);
      } else if (obs.type === 'banner') {
        this.drawDiwaliBanner(ctx, obs);
      } else if (obs.type === 'kite') {
        this.drawKite(ctx, obs);
      } else if (obs.type === 'bus') {
        this.drawTownBus(ctx, obs);
      } else {
        this.drawParcelObstacle(ctx, obs);
      }
      ctx.restore();
    });
  }

  drawPothole(ctx, obs) {
    // Road cavity
    ctx.save();
    ctx.fillStyle = '#0a0d12';
    ctx.beginPath();
    ctx.ellipse(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner jagged crack
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(obs.x + 8, obs.y + 6);
    ctx.lineTo(obs.x + 22, obs.y + 10);
    ctx.lineTo(obs.x + 40, obs.y + 5);
    ctx.stroke();

    // Mini orange traffic cone on rim
    const cx = obs.x + obs.width - 12;
    const cy = obs.y - 12;
    ctx.fillStyle = '#212121';
    ctx.fillRect(cx - 3, cy + 12, 16, 3);
    ctx.fillStyle = '#ff6d00';
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.lineTo(cx - 2, cy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + 1, cy + 5, 8, 3);

    // Warning Tag
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🕳️ POTHOLE [JUMP]', obs.x + obs.width / 2, obs.y - 4);
    ctx.restore();
  }

  drawSpeedBreaker(ctx, obs) {
    ctx.save();
    // Asphalt bump
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.width, obs.height, [8, 8, 2, 2]);
    ctx.fill();

    // Diagonal black & yellow stripes
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.width, obs.height, [8, 8, 2, 2]);
    ctx.clip();
    for (let s = -20; s < obs.width + 20; s += 14) {
      ctx.fillStyle = '#ffd600';
      ctx.beginPath();
      ctx.moveTo(obs.x + s, obs.y + obs.height);
      ctx.lineTo(obs.x + s + 8, obs.y + obs.height);
      ctx.lineTo(obs.x + s + 16, obs.y);
      ctx.lineTo(obs.x + s + 8, obs.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // White reflector studs
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(obs.x + 10, obs.y + 2, 4, 3);
    ctx.fillRect(obs.x + obs.width / 2 - 2, obs.y + 2, 4, 3);
    ctx.fillRect(obs.x + obs.width - 14, obs.y + 2, 4, 3);

    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🟡 SPEED BUMP [JUMP]', obs.x + obs.width / 2, obs.y - 4);
    ctx.restore();
  }

  drawDesiCow(ctx, obs) {
    ctx.save();
    if (obs.scattered) {
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.rotate(0.3);
      ctx.translate(-(obs.x + obs.width / 2), -(obs.y + obs.height / 2));
    }

    // Legs
    ctx.fillStyle = '#424242';
    ctx.fillRect(obs.x + 8, obs.y + 28, 6, 20);
    ctx.fillRect(obs.x + 20, obs.y + 28, 6, 20);
    ctx.fillRect(obs.x + 40, obs.y + 28, 6, 20);
    ctx.fillRect(obs.x + 50, obs.y + 28, 6, 20);

    // Body
    ctx.fillStyle = '#f5f5f0';
    ctx.beginPath();
    ctx.roundRect(obs.x + 6, obs.y + 10, 48, 24, 8);
    ctx.fill();

    // Brown patches
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.ellipse(obs.x + 22, obs.y + 18, 10, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(obs.x + 42, obs.y + 20, 8, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#f5f5f0';
    ctx.beginPath();
    ctx.roundRect(obs.x + 44, obs.y + 4, 18, 20, 6);
    ctx.fill();

    // Pink muzzle
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.ellipse(obs.x + 58, obs.y + 16, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#212121';
    ctx.fillRect(obs.x + 58, obs.y + 14, 2, 2);
    ctx.fillRect(obs.x + 61, obs.y + 14, 2, 2);

    // Eye
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(obs.x + 50, obs.y + 10, 2, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obs.x + 48, obs.y + 5);
    ctx.quadraticCurveTo(obs.x + 48, obs.y - 8, obs.x + 42, obs.y - 4);
    ctx.moveTo(obs.x + 54, obs.y + 5);
    ctx.quadraticCurveTo(obs.x + 58, obs.y - 8, obs.x + 64, obs.y - 4);
    ctx.stroke();

    // Red tilak on forehead
    ctx.fillStyle = '#d50000';
    ctx.beginPath();
    ctx.arc(obs.x + 52, obs.y + 8, 2, 0, Math.PI * 2);
    ctx.fill();

    // Brass bell collar
    ctx.strokeStyle = '#d50000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(obs.x + 44, obs.y + 16);
    ctx.lineTo(obs.x + 47, obs.y + 24);
    ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(obs.x + 47, obs.y + 26, 3, 0, Math.PI * 2);
    ctx.fill();

    // Swishing Tail
    const tailWiggle = Math.sin(this.gameTime * 8) * 4;
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obs.x + 6, obs.y + 14);
    ctx.lineTo(obs.x - 4 + tailWiggle, obs.y + 26);
    ctx.stroke();

    // Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐄 COW [JUMP/HORN]', obs.x + obs.width / 2, obs.y - 6);
    ctx.restore();
  }

  drawScooter(ctx, obs) {
    ctx.save();
    // Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(obs.x + 12, obs.y + obs.height - 8, 8, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 12, obs.y + obs.height - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cfd8dc';
    ctx.beginPath();
    ctx.arc(obs.x + 12, obs.y + obs.height - 8, 3.5, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 12, obs.y + obs.height - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Scooter Body
    ctx.fillStyle = obs.color || '#ff7043';
    ctx.beginPath();
    ctx.roundRect(obs.x + 8, obs.y + 18, 38, 14, 4);
    ctx.fill();

    // Headlight & Handlebars
    ctx.fillStyle = '#37474f';
    ctx.fillRect(obs.x + 38, obs.y + 6, 4, 14);
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.arc(obs.x + 42, obs.y + 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Delivery Box on Back
    ctx.fillStyle = '#fc8019';
    ctx.beginPath();
    ctx.roundRect(obs.x + 6, obs.y + 4, 20, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SWIGGY', obs.x + 16, obs.y + 15);

    // Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('🛵 SCOOTER [JUMP/HORN]', obs.x + obs.width / 2, obs.y - 4);
    ctx.restore();
  }

  drawTeaCart(ctx, obs) {
    ctx.save();
    // Spoked Wheels
    ctx.fillStyle = '#3e2723';
    ctx.beginPath();
    ctx.arc(obs.x + 14, obs.y + obs.height - 8, 9, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 14, obs.y + obs.height - 8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.arc(obs.x + 14, obs.y + obs.height - 8, 4, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 14, obs.y + obs.height - 8, 4, 0, Math.PI * 2);
    ctx.fill();

    // Wooden cart body
    ctx.fillStyle = '#6d4c41';
    ctx.beginPath();
    ctx.roundRect(obs.x + 4, obs.y + 22, obs.width - 8, 16, 3);
    ctx.fill();

    // Roof pillars
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obs.x + 8, obs.y + 22);
    ctx.lineTo(obs.x + 8, obs.y + 8);
    ctx.moveTo(obs.x + obs.width - 8, obs.y + 22);
    ctx.lineTo(obs.x + obs.width - 8, obs.y + 8);
    ctx.stroke();

    // Striped Awning Roof
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.roundRect(obs.x + 2, obs.y + 4, obs.width - 4, 8, [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#fbc02d';
    ctx.fillRect(obs.x + 12, obs.y + 4, 8, 8);
    ctx.fillRect(obs.x + 32, obs.y + 4, 8, 8);

    // Silver Samovar Tea Kettle
    ctx.fillStyle = '#b0bec5';
    ctx.fillRect(obs.x + 24, obs.y + 14, 12, 10);
    // Steam puff
    const steamY = obs.y + 10 - (Math.sin(this.gameTime * 6) * 4);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(obs.x + 30, steamY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🛒 TEA CART [JUMP/HORN]', obs.x + obs.width / 2, obs.y - 4);
    ctx.restore();
  }

  drawDiwaliBanner(ctx, obs) {
    ctx.save();
    // Two roadside utility poles extending down to road
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(obs.x + 4, obs.y);
    ctx.lineTo(obs.x + 4, this.GROUND_Y);
    ctx.moveTo(obs.x + obs.width - 4, obs.y);
    ctx.lineTo(obs.x + obs.width - 4, this.GROUND_Y);
    ctx.stroke();

    // Ropes to banner
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(obs.x + 4, obs.y + 6);
    ctx.lineTo(obs.x + 10, obs.y + 6);
    ctx.moveTo(obs.x + obs.width - 4, obs.y + 6);
    ctx.lineTo(obs.x + obs.width - 10, obs.y + 6);
    ctx.stroke();

    // High Cloth Banner
    const flutter = Math.sin(this.gameTime * 8) * 2;
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.roundRect(obs.x + 6, obs.y + flutter, obs.width - 12, obs.height - 8, 4);
    ctx.fill();

    // Gold Border
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Tamil Banner Text
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💥 தீபாவளி வாழ்த்துகள் 💥', obs.x + obs.width / 2, obs.y + 14 + flutter);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('VEERAMANI FANS CLUB', obs.x + obs.width / 2, obs.y + 26 + flutter);

    // Slide instruction arrow below banner
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('▼ SLIDE / DUCK [↓] UNDER! ▼', obs.x + obs.width / 2, obs.y + obs.height + 12);
    ctx.restore();
  }

  drawKite(ctx, obs) {
    ctx.save();
    const bob = Math.sin(this.gameTime * 7) * 3;
    const kx = obs.x + obs.width / 2;
    const ky = obs.y + obs.height / 2 + bob;

    // Diamond kite
    ctx.fillStyle = '#ab47bc';
    ctx.beginPath();
    ctx.moveTo(kx, ky - 16);
    ctx.lineTo(kx + 14, ky);
    ctx.lineTo(kx, ky + 16);
    ctx.lineTo(kx - 14, ky);
    ctx.closePath();
    ctx.fill();

    // Inner bright yellow diamond
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.moveTo(kx, ky - 8);
    ctx.lineTo(kx + 7, ky);
    ctx.lineTo(kx, ky + 8);
    ctx.lineTo(kx - 7, ky);
    ctx.closePath();
    ctx.fill();

    // Cross spars
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kx, ky - 16);
    ctx.lineTo(kx, ky + 16);
    ctx.moveTo(kx - 14, ky);
    ctx.lineTo(kx + 14, ky);
    ctx.stroke();

    // Tail ribbon
    ctx.strokeStyle = '#ff4081';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(kx, ky + 16);
    const tw = Math.sin(this.gameTime * 10) * 8;
    ctx.quadraticCurveTo(kx - 6 + tw, ky + 26, kx - 14 + tw, ky + 34);
    ctx.stroke();

    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪁 KITE [DUCK ↓]', kx, obs.y - 4);
    ctx.restore();
  }

  drawTownBus(ctx, obs) {
    ctx.save();
    if (obs.scattered) {
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.rotate(-0.15);
      ctx.translate(-(obs.x + obs.width / 2), -(obs.y + obs.height / 2));
    }

    // Bus Rubber Wheels
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(obs.x + 25, obs.y + obs.height - 10, 11, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 25, obs.y + obs.height - 10, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath();
    ctx.arc(obs.x + 25, obs.y + obs.height - 10, 5, 0, Math.PI * 2);
    ctx.arc(obs.x + obs.width - 25, obs.y + obs.height - 10, 5, 0, Math.PI * 2);
    ctx.fill();

    // Upper Body (Cream)
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.width, 32, [8, 8, 0, 0]);
    ctx.fill();

    // Lower Body (TNSTC Deep Green)
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y + 30, obs.width, obs.height - 38, [0, 0, 4, 4]);
    ctx.fill();

    // Red Accent Stripe
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(obs.x, obs.y + 28, obs.width, 3.5);

    // Front Windshield
    ctx.fillStyle = 'rgba(128, 222, 234, 0.75)';
    ctx.beginPath();
    ctx.roundRect(obs.x + 4, obs.y + 6, 22, 20, 2);
    ctx.fill();

    // Passenger Windows
    for (let w = 32; w < obs.width - 8; w += 26) {
      ctx.fillStyle = 'rgba(178, 235, 242, 0.65)';
      ctx.beginPath();
      ctx.roundRect(obs.x + w, obs.y + 8, 20, 16, 2);
      ctx.fill();

      // Passenger silhouette
      ctx.fillStyle = '#37474f';
      ctx.beginPath();
      ctx.arc(obs.x + w + 10, obs.y + 17, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // LED Destination Board
    ctx.fillStyle = '#000000';
    ctx.fillRect(obs.x + 4, obs.y + 2, 42, 6);
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('101 MATTUTHAVANI', obs.x + 6, obs.y + 7);

    // Front Glowing Headlights & Beams
    ctx.fillStyle = '#fff59d';
    ctx.beginPath();
    ctx.arc(obs.x + 4, obs.y + 40, 4, 0, Math.PI * 2);
    ctx.fill();

    // Headlight cone onto road
    ctx.save();
    const beamGrad = ctx.createLinearGradient(obs.x, obs.y + 40, obs.x - 70, obs.y + 40);
    beamGrad.addColorStop(0, 'rgba(255, 245, 157, 0.35)');
    beamGrad.addColorStop(1, 'rgba(255, 245, 157, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(obs.x + 4, obs.y + 36);
    ctx.lineTo(obs.x - 70, obs.y + 20);
    ctx.lineTo(obs.x - 70, obs.y + 60);
    ctx.lineTo(obs.x + 4, obs.y + 44);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bus Tag
    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚌 101 MADURAI EXP [HORN/JUMP!]', obs.x + obs.width / 2, obs.y - 6);
    ctx.restore();
  }

  drawParcelObstacle(ctx, obs) {
    ctx.save();
    ctx.fillStyle = obs.color;
    ctx.beginPath();
    ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 4);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obs.label, obs.x + obs.width / 2, obs.y + obs.height / 2 - 2);

    ctx.fillStyle = '#ff5252';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(obs.subLabel, obs.x + obs.width / 2, obs.y + obs.height / 2 + 10);
    ctx.restore();
  }

  drawBusWarning(ctx) {
    if (!this.busWarningActive) return;
    const pulse = Math.sin(this.gameTime * 16);
    if (pulse < 0) return; // Flash effect

    ctx.save();
    const bx = this.V_WIDTH - 250;
    const by = this.GROUND_Y - 95;

    ctx.fillStyle = 'rgba(255, 23, 68, 0.92)';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.roundRect(bx, by, 235, 44, 8);
    ctx.fill();

    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ BUS INCOMING! 🚌', bx + 117, by + 18);

    ctx.fillStyle = '#ffd600';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('PRESS [H] HORN OR JUMP EARLY!', bx + 117, by + 34);

    ctx.restore();
  }

  // Draw chasing Swiggy Delivery Executive on scooter
  drawSwiggyChaser(ctx) {
    ctx.save();
    // Swiggy position based on distance gap
    // If distance = 20m, x ≈ 25px. If distance = 3m, x ≈ 150px (very close to player at 210px)
    const swiggyX = Math.max(10, this.player.x - (this.swiggyDistance * 8.5));
    const swiggyY = this.GROUND_Y - 56;

    // Scooter Body (Bright Swiggy Orange!)
    ctx.fillStyle = '#fc8019';
    ctx.beginPath();
    ctx.roundRect(swiggyX, swiggyY + 22, 54, 20, 6);
    ctx.fill();

    // Scooter Wheels
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(swiggyX + 10, swiggyY + 44, 9, 0, Math.PI * 2);
    ctx.arc(swiggyX + 46, swiggyY + 44, 9, 0, Math.PI * 2);
    ctx.fill();

    // Swiggy Thermal Delivery Backpack
    ctx.fillStyle = '#fc8019';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(swiggyX + 6, swiggyY - 6, 26, 26, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('SWIGGY', swiggyX + 8, swiggyY + 10);

    // Swiggy Driver (Orange T-shirt & Helmet)
    ctx.fillStyle = '#fc8019'; // Shirt
    ctx.fillRect(swiggyX + 24, swiggyY + 4, 14, 18);
    // Helmet
    ctx.fillStyle = '#e65100';
    ctx.beginPath();
    ctx.arc(swiggyX + 31, swiggyY - 4, 9, 0, Math.PI * 2);
    ctx.fill();
    // Visor
    ctx.fillStyle = '#212121';
    ctx.fillRect(swiggyX + 33, swiggyY - 7, 7, 6);

    // Emergency Siren on Helmet in Danger Mode
    if (this.currentSituation === 'danger') {
      const isRed = (Math.floor(Date.now() / 120) % 2 === 0);
      ctx.fillStyle = isRed ? '#ff1744' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(swiggyX + 31, swiggyY - 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dynamic Headlight Beam (Expands into intense red-orange alert beam in danger mode)
    ctx.save();
    const beamDist = (this.currentSituation === 'danger') ? 220 : 110;
    const beamColor = (this.currentSituation === 'danger') ? 'rgba(255, 23, 68, 0.85)' : 'rgba(255, 235, 59, 0.7)';
    const g = ctx.createLinearGradient(swiggyX + 54, swiggyY + 24, swiggyX + 54 + beamDist, swiggyY + 24);
    g.addColorStop(0, beamColor);
    g.addColorStop(1, 'rgba(255, 235, 59, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(swiggyX + 54, swiggyY + 24);
    ctx.lineTo(swiggyX + 54 + beamDist, swiggyY + ((this.currentSituation === 'danger') ? -12 : 12));
    ctx.lineTo(swiggyX + 54 + beamDist, swiggyY + ((this.currentSituation === 'danger') ? 56 : 36));
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // Draw Veeramani character
  drawVeeramani(ctx) {
    const p = this.player;
    ctx.save();

    // Boost situation: Motion trail speed echoes
    if (this.currentSituation === 'boost') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(p.x - 22, p.y, p.width, p.height);
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#ffd600';
      ctx.fillRect(p.x - 42, p.y, p.width, p.height);
      ctx.restore();
    }

    // Danger situation: Panic sweat droplets flying off head
    if (this.currentSituation === 'danger') {
      ctx.save();
      ctx.fillStyle = '#80d8ff';
      const sweatX = p.x - 10 + Math.sin(Date.now() / 60) * 4;
      const sweatY = p.y + 12;
      ctx.beginPath();
      ctx.arc(sweatX, sweatY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sigma glow if meme or sigma situation active!
    if (p.sigmaGlow > 0 || this.currentSituation === 'sigma') {
      ctx.shadowColor = '#ffd600';
      ctx.shadowBlur = 28;
    }

    const suitNavy = '#152238';
    const suitNavyDark = '#0e1726';
    const shirtWhite = '#f5f5f5';
    const tieRed = '#d32f2f';
    const shoeBlack = '#1a1a1a';
    const skinTone = '#c68642';

    if (p.isDucking) {
      // Diving slide under parcels
      const duckY = this.GROUND_Y - p.duckHeight;
      ctx.fillStyle = suitNavy;
      ctx.beginPath();
      ctx.roundRect(p.x - 10, duckY + 12, 48, 22, 8);
      ctx.fill();

      // Tie flapping behind
      ctx.fillStyle = tieRed;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, duckY + 14);
      ctx.lineTo(p.x - 16, duckY + 8 + Math.sin(this.gameTime * 20) * 3);
      ctx.lineTo(p.x + 8, duckY + 18);
      ctx.fill();

      // Legs
      ctx.fillStyle = suitNavyDark;
      ctx.fillRect(p.x - 28, duckY + 16, 22, 10);
      ctx.fillStyle = shoeBlack;
      ctx.fillRect(p.x - 34, duckY + 14, 10, 12);

      // Arms
      ctx.fillStyle = suitNavy;
      ctx.fillRect(p.x + 28, duckY + 18, 16, 8);
      ctx.fillStyle = skinTone;
      ctx.fillRect(p.x + 42, duckY + 18, 7, 7);

      this.drawVeeramaniFace(ctx, p.x + 32, duckY + 12, 0.28, -0.2);

    } else {
      // Running / Jumping
      const bob = p.isGrounded ? Math.sin(p.runFrame * 2) * 2 : 0;
      const legAngle = p.isGrounded ? Math.sin(p.runFrame) * 0.75 : (p.velocityY < 0 ? -0.4 : 0.4);
      const hipX = p.x + 20;
      const hipY = p.y + 44 + bob;

      // Back Leg
      ctx.save();
      ctx.translate(hipX, hipY);
      ctx.rotate(-legAngle);
      ctx.fillStyle = suitNavyDark;
      ctx.fillRect(-5, 0, 10, 18);
      ctx.fillRect(-4, 16, 8, 16);
      ctx.fillStyle = shoeBlack;
      ctx.fillRect(-4, 30, 14, 6);
      ctx.restore();

      // Torso & Navy Suit
      ctx.fillStyle = suitNavy;
      ctx.beginPath();
      ctx.roundRect(p.x + 8, p.y + 22 + bob, 24, 25, 4);
      ctx.fill();

      // White Shirt Collar
      ctx.fillStyle = shirtWhite;
      ctx.beginPath();
      ctx.moveTo(p.x + 16, p.y + 22 + bob);
      ctx.lineTo(p.x + 20, p.y + 32 + bob);
      ctx.lineTo(p.x + 24, p.y + 22 + bob);
      ctx.fill();

      // Red Tie
      ctx.fillStyle = tieRed;
      ctx.beginPath();
      ctx.moveTo(p.x + 19, p.y + 25 + bob);
      ctx.lineTo(p.x + 21, p.y + 25 + bob);
      const tieFlutter = Math.sin(this.gameTime * 24) * 4;
      ctx.lineTo(p.x + 17 - tieFlutter, p.y + 39 + bob);
      ctx.lineTo(p.x + 21, p.y + 41 + bob);
      ctx.fill();

      // Suit Coat Tails
      ctx.fillStyle = suitNavyDark;
      ctx.beginPath();
      ctx.moveTo(p.x + 10, p.y + 42 + bob);
      ctx.lineTo(p.x + 4 - Math.sin(this.gameTime * 18) * 4, p.y + 49 + bob);
      ctx.lineTo(p.x + 18, p.y + 47 + bob);
      ctx.fill();

      // Front Leg
      ctx.save();
      ctx.translate(hipX, hipY);
      ctx.rotate(legAngle);
      ctx.fillStyle = suitNavy;
      ctx.fillRect(-5, 0, 10, 18);
      ctx.fillRect(-4, 16, 8, 16);
      ctx.fillStyle = shoeBlack;
      ctx.fillRect(-4, 30, 14, 6);
      ctx.restore();

      // Front Arm
      ctx.save();
      const armAngle = -legAngle * 0.9;
      ctx.translate(p.x + 20, p.y + 26 + bob);
      ctx.rotate(armAngle);
      ctx.fillStyle = suitNavy;
      ctx.fillRect(-4, 0, 8, 18);
      ctx.fillStyle = shirtWhite;
      ctx.fillRect(-4, 16, 8, 2);
      ctx.fillStyle = skinTone;
      ctx.fillRect(-3, 18, 6, 6);
      ctx.restore();

      const headTilt = p.isGrounded ? Math.sin(p.runFrame) * 0.08 : (p.velocityY * 0.02);
      this.drawVeeramaniFace(ctx, p.x + 20, p.y + 14 + bob, 0.32, headTilt);
    }

    ctx.restore();
  }

  drawVeeramaniFace(ctx, centerX, centerY, scale, rotation) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    if (this.faceLoaded) {
      const w = 90 * scale;
      const h = 120 * scale;
      ctx.drawImage(this.faceImg, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#c68642';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawSpeechBubble(ctx) {
    const sb = this.player.speechBubble;
    if (!sb) return;

    ctx.save();
    const bx = this.player.x + 35;
    const by = this.player.y - 52;

    ctx.font = 'bold 13px system-ui, sans-serif';
    const textWidth = Math.max(ctx.measureText(sb.textTa).width, ctx.measureText(sb.textEn).width) + 24;
    const bubbleW = Math.max(140, textWidth);
    const bubbleH = 50;

    const alpha = Math.min(1.0, sb.timer / 0.3);
    ctx.globalAlpha = alpha;

    ctx.fillStyle = sb.isMeme ? '#fff8e1' : '#ffffff';
    ctx.strokeStyle = sb.isMeme ? '#ff6f00' : '#1a237e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx - 10, by, bubbleW, bubbleH, 12);
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(bx + 12, by + bubbleH);
    ctx.lineTo(bx - 4, by + bubbleH + 10);
    ctx.lineTo(bx + 24, by + bubbleH);
    ctx.fillStyle = sb.isMeme ? '#fff8e1' : '#ffffff';
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(bx + 11, by + bubbleH - 2, 14, 4);

    ctx.fillStyle = '#d32f2f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(sb.textTa, bx + 2, by + 20);

    ctx.fillStyle = '#1a237e';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(sb.textEn, bx + 2, by + 38);

    ctx.restore();
  }

  drawSweets(ctx) {
    this.sweets.forEach(sw => {
      ctx.save();
      const visualY = sw.y + Math.sin(sw.bobOffset) * 4;

      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.roundRect(sw.x, visualY, sw.width, sw.height, 5);
      ctx.fill();

      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(sw.x + sw.width / 2 - 2, visualY, 4, sw.height);
      ctx.fillRect(sw.x, visualY + sw.height / 2 - 2, sw.width, 4);

      ctx.restore();
    });
  }

  drawParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawFloatingTexts(ctx) {
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 15px "Black Ops One", Impact, sans-serif';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}

window.VeeramaniGame = VeeramaniGame;
