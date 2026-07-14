import { useEffect, useRef, useState } from 'react';


// ─── Date helpers ────────────────────────────────────────────────────────────
// nth weekday of a month, e.g. 4th Thursday of November = Thanksgiving
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

// ─── Holiday definitions ─────────────────────────────────────────────────────
// `window` = days before+after the date that also show flair.
// `getDate(year)` lets us support floating dates (Thanksgiving, equinox/solstice).
const HOLIDAYS = [
  {
    id: 'newyear', tier: 'major',
    getDate: (y) => new Date(y, 0, 1),
    window: 1,
    effect: 'fireworks',
    banner: {
      emoji1: '🎉', emoji2: '🎊',
      lines: ['HAPPY NEW YEAR'],
      accent: '#FFD700',
      footer: 'FROM THE TICKLE CORP.',
    },
  },
  {
    id: 'spring', tier: 'minor',
    getDate: (y) => new Date(y, 2, 20), // approx. spring equinox
    window: 1,
    effect: 'petals',
    accent: '#FF8FB3',
  },
  {
    id: 'july4', tier: 'major',
    getDate: (y) => new Date(y, 6, 4),
    window: 1,
    effect: 'fireworks',
    banner: {
      emoji1: '🎆', emoji2: '🎇',
      lines: ['HAPPY BIRTHDAY', 'AMERICA'],
      accent: '#B22234',
      accent2: '#3C3B6E',
      footer: 'FROM THE WORLD NATIONAL',
      patriotic: true,
    },
  },
  {
    id: 'autumn', tier: 'minor',
    getDate: (y) => new Date(y, 8, 22), // approx. autumn equinox
    window: 1,
    effect: 'leaves',
    accent: '#D2691E',
  },
  {
    id: 'halloween', tier: 'major',
    getDate: (y) => new Date(y, 9, 31),
    window: 1,
    effect: 'spooky',
    banner: {
      emoji1: '🎃', emoji2: '👻',
      lines: ['HAPPY HALLOWEEN'],
      accent: '#FF7518',
      accent2: '#6B2FA0',
      footer: 'FROM THE TICKLEWEB STAFF',
    },
  },
  {
    id: 'thanksgiving', tier: 'major',
    getDate: (y) => nthWeekdayOfMonth(y, 10, 4, 4), // 4th Thursday of November
    window: 1,
    effect: 'harvest',
    banner: {
      emoji1: '🦃', emoji2: '🍂',
      lines: ['HAPPY THANKSGIVING'],
      accent: '#B5651D',
      footer: 'FROM THE FACE OF THE LEAGUE',
    },
  },
  { 
    id: 'winter', tier: 'major',
    getDate: (y) => new Date(y, 11, 21), // approx. winter solstice
    window: 1,
    effect: 'snow',
    banner: {
      emoji1: '❄️', emoji2: '☃️',
      lines: ['HAPPY FIRST DAY OF WINTER'],
      accent: '#87CEEB',
      footer: 'FROM THE WORLD NATIONAL',
    },
  },
  {
    id: 'christmas', tier: 'major',
    getDate: (y) => new Date(y, 11, 25),
    window: 1,
    effect: 'christmasMix', 
    banner: {
      emoji1: '🎄', emoji2: '🎁',
      lines: ['MERRY CHRISTMAS'],
      accent: '#C8102E',
      accent2: '#00693E',
      footer: 'SPONSORED BY BELL N BELL',
    },
  },
  {
    id: 'stpatricks', tier: 'minor',
    getDate: (y) => new Date(y, 2, 17),
    window: 1,
    accent: '#00A651',
  },
  {
    id: 'boxingday', tier: 'minor',
    getDate: (y) => new Date(y, 11, 26),
    window: 1,
    accent: ' #C0C0C0',
  },
];

// ===== Emoji List ======
const LEAF_EMOJIS = ['🍁', '🍂', '🍃'];
const PETAL_EMOJIS = ['🌸', '🌷', '🌺'];
const SPOOKY_EMOJIS = ['🎃', '🦇', '👻'];
const HARVEST_EMOJIS = ['🍂', '🎃', '🍁'];
const CHRISTMAS_EMOJIS = ['🎄', '🎁', '⭐', '🔔'];

// ── TEMP TEST TOGGLE — force a specific holiday to preview, delete when done ──
const FORCE_HOLIDAY_TEST = null; //'boxingday'; // set to a holiday id below to preview, e.g. 'halloween'

function getActiveHoliday() {

  if (FORCE_HOLIDAY_TEST) {
    return HOLIDAYS.find((h) => h.id === FORCE_HOLIDAY_TEST) || null;
  }

  const now = new Date();
  const year = now.getFullYear();

  let best = null;
  let bestDiff = Infinity;

  // Check this year and neighboring years' instances (handles Dec 31 → Jan 1 wraparound)
  for (const h of HOLIDAYS) {
    for (const y of [year - 1, year, year + 1]) {
      const hDate = h.getDate(y);
      const diffDays = Math.abs((now - hDate) / 86400000);
      if (diffDays <= h.window && diffDays < bestDiff) {
        best = h;
        bestDiff = diffDays;
      }
    }
  }
  return best;
}

// ─── "Seen today" gating for fullscreen takeover ────────────────────────────
function seenTodayKey(holidayId) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  return `wn95_flair_seen_${holidayId}_${dateStr}`;
}

function hasSeenToday(holidayId) {
  try {
    return localStorage.getItem(seenTodayKey(holidayId)) === '1';
  } catch {
    return false;
  }
}

function markSeenToday(holidayId) {
  try {
    localStorage.setItem(seenTodayKey(holidayId), '1');
  } catch {
    // ignore — worst case it shows again
  }
}


// ─── Fireworks canvas ────────────────────────────────────────────────────────
function FireworksCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let logicalW = window.innerWidth;
    let logicalH = window.innerHeight;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      logicalW = window.innerWidth;
      logicalH = window.innerHeight;
      canvas.width = logicalW * dpr;
      canvas.height = logicalH * dpr;
      canvas.style.width = logicalW + 'px';
      canvas.style.height = logicalH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', resize);

    const COLORS = [
      '#FFD700', '#FF8C00', '#FF4500',
      '#FF3B3B', '#FFFFFF', '#87CEEB',
      '#4488FF', '#FF69B4',
    ];

    class Particle {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.018 + 0.012;
        this.radius = Math.random() * 2.2 + 0.8;
        this.trail = [];
      }
      update() {
        this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
        if (this.trail.length > 6) this.trail.shift();
        this.x  += this.vx;
        this.y  += this.vy;
        this.vy += 0.055;
        this.vx *= 0.98;
        this.alpha -= this.decay;
      }
      draw(ctx) {
        this.trail.forEach((t, i) => {
          const a = (i / this.trail.length) * t.alpha * 0.4;
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.radius * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = this.color + Math.round(a * 255).toString(16).padStart(2, '0');
          ctx.fill();
        });
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color + Math.round(this.alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = this.color + Math.round(this.alpha * 0.18 * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
      isDead() { return this.alpha <= 0; }
    }

    class Shell {
      constructor() { this.reset(); }
      reset() {
        this.x = logicalW * (0.1 + Math.random() * 0.8);
        this.y = logicalH * (0.95 + Math.random() * 0.05);
        this.tx = logicalW * (0.1 + Math.random() * 0.8);
        this.ty = logicalH * (0.0 + Math.random() * 0.22);
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = 6 + Math.random() * 4;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.radius = 2.5;
        this.alpha = 1;
        this.trail = [];
        this.alive = true;
      }
      update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) this.trail.shift();
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.12;
        if (this.vy >= 0) this.alive = false;
      }
      draw(ctx) {
        this.trail.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.radius * 1.7, 0, Math.PI * 2);
          ctx.fillStyle = this.color + Math.round(this.alpha * 0.12 * 255).toString(16).padStart(2, '0');
          ctx.fill();
        });
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffcc';
        ctx.fill();
      }
      explode(particles) {
        const count = 80 + Math.floor(Math.random() * 60);
        for (let i = 0; i < count; i++) {
          particles.push(new Particle(this.x, this.y, this.color));
        }
        if (Math.random() > 0.45) {
          const c2 = COLORS[Math.floor(Math.random() * COLORS.length)];
          for (let i = 0; i < 30; i++) {
            const p = new Particle(this.x, this.y, c2);
            p.vx *= 0.55; p.vy *= 0.55;
            particles.push(p);
          }
        }
      }
    }

    const shells = [];
    const particles = [];
    let nextShell = 0;
    let raf;

    const launchShell = () => {
      const s = new Shell();
      s.ty = s.ty * 0.55;
      shells.push(s);
      if (Math.random() > 0.65) {
        setTimeout(() => {
          if (canvas) {
            const s2 = new Shell();
            s2.ty = s2.ty * 0.7;
            shells.push(s2);
          }
        }, 180);
      }
      nextShell = Date.now() + 1400 + Math.random() * 2200;
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, 0, logicalW, logicalH);
      if (Date.now() > nextShell) launchShell();
      for (let i = shells.length - 1; i >= 0; i--) {
        shells[i].draw(ctx);
        shells[i].update();
        if (!shells[i].alive) {
          shells[i].explode(particles);
          shells.splice(i, 1);
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].draw(ctx);
        particles[i].update();
        if (particles[i].isDead()) particles.splice(i, 1);
      }
    };

    const initTimer = setTimeout(() => {
      resize();
      launchShell();
      loop();
    }, 50);

    return () => {
      clearTimeout(initTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        borderRadius: '10px',
      }}
    />
  );
}

// ─── Snow canvas ─────────────────────────────────────────────────────────────
function SnowCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const flakes = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2.5 + 0.8,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 0.7 + 0.3,
      alpha: Math.random() * 0.5 + 0.3,
    }));

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      flakes.forEach(f => {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,230,255,${f.alpha})`;
        ctx.fill();
        f.x += f.vx; f.y += f.vy;
        if (f.y > canvas.height) { f.y = -4; f.x = Math.random() * canvas.width; }
        if (f.x > canvas.width)  f.x = 0;
        if (f.x < 0)             f.x = canvas.width;
      });
    };
    loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0, borderRadius:'10px' }} />
  );
}

// ─── Falling emoji canvas — powers leaves, petals, pumpkins/bats, harvest ────
function FallingEmojiCanvas({ emojis, count = 34, minSize = 16, maxSize = 30, spin = true, speedMult = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const items = Array.from({ length: count }, () => ({
      x: Math.random() * (canvas.width || window.innerWidth),
      y: Math.random() * (canvas.height || window.innerHeight),
      size: Math.random() * (maxSize - minSize) + minSize,
      vy: (Math.random() * 0.6 + 0.4) * speedMult,
      vx: (Math.random() - 0.5) * 0.6,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 2,
      sway: Math.random() * Math.PI * 2,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      alpha: Math.random() * 0.35 + 0.65,
    }));

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      items.forEach((it) => {
        ctx.save();
        ctx.globalAlpha = it.alpha;
        ctx.translate(it.x, it.y);
        if (spin) ctx.rotate((it.rot * Math.PI) / 180);
        ctx.font = `${it.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.emoji, 0, 0);
        ctx.restore();

        it.sway += 0.02;
        it.x += it.vx + Math.sin(it.sway) * 0.5;
        it.y += it.vy;
        it.rot += it.vr;

        if (it.y > canvas.height + 20) {
          it.y = -20;
          it.x = Math.random() * canvas.width;
        }
        if (it.x > canvas.width + 20) it.x = -20;
        if (it.x < -20) it.x = canvas.width + 20;
      });
    };
    loop();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [emojis, count, minSize, maxSize, spin, speedMult]);

  return (
    <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0, borderRadius:'10px' }} />
  );
}


// ─── Flash canvas — emojis pop in/out at random screen positions ────────────
// ─── Flash canvas — emojis pop in/out at random screen positions ────────────
function FlashEmojiCanvas({ emojis, count = 10, minSize = 26, maxSize = 46, frantic = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const respawn = (f) => {
      f.x = Math.random() * canvas.width;
      f.y = Math.random() * canvas.height;
      f.size = Math.random() * (maxSize - minSize) + minSize;
      f.emoji = emojis[Math.floor(Math.random() * emojis.length)];
      if (frantic) {
        f.delay = Math.random() * 400;         // almost no wait
        f.fadeIn = 50 + Math.random() * 60;     // snappy fade in
        f.hold = 90 + Math.random() * 180;      // brief hold
        f.fadeOut = 70 + Math.random() * 90;    // quick fade out
      } else {
        f.delay = Math.random() * 1800;
        f.fadeIn = 120 + Math.random() * 150;
        f.hold = 250 + Math.random() * 500;
        f.fadeOut = 200 + Math.random() * 250;
      }
      f.t = 0;
      f.phase = 'delay';
    };

    const flashers = Array.from({ length: count }, () => {
      const f = {};
      respawn(f);
      f.t = Math.random() * (frantic ? 600 : 2000);
      return f;
    });

    let last = performance.now();
    let raf;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = now - last;
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      flashers.forEach((f) => {
        f.t += dt;
        let alpha = 0;

        if (f.phase === 'delay') {
          if (f.t >= f.delay) { f.t = 0; f.phase = 'in'; }
        } else if (f.phase === 'in') {
          alpha = Math.min(1, f.t / f.fadeIn);
          if (f.t >= f.fadeIn) { f.t = 0; f.phase = 'hold'; }
        } else if (f.phase === 'hold') {
          alpha = 1;
          if (f.t >= f.hold) { f.t = 0; f.phase = 'out'; }
        } else if (f.phase === 'out') {
          alpha = Math.max(0, 1 - f.t / f.fadeOut);
          if (f.t >= f.fadeOut) { respawn(f); }
        }

        if (alpha > 0) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `${f.size}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(255,120,0,0.6)';
          ctx.shadowBlur = 14 * alpha;
          ctx.fillText(f.emoji, f.x, f.y);
          ctx.restore();
        }
      });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [emojis, count, minSize, maxSize, frantic]);

  return (
    <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0, borderRadius:'10px' }} />
  );
}

// ─── Effect → canvas mapping ─────────────────────────────────────────────────
function EffectCanvas({ effect }) {
  switch (effect) {
    case 'fireworks':
      return <FireworksCanvas />;
    case 'snow':
      return <SnowCanvas />;
    case 'christmasMix':
      return (
        <>
          <SnowCanvas />
          <FallingEmojiCanvas emojis={CHRISTMAS_EMOJIS} count={18} minSize={18} maxSize={28} speedMult={0.6} />
        </>
      );
    case 'leaves':
      return <FallingEmojiCanvas emojis={LEAF_EMOJIS} />;
    case 'petals':
      return <FallingEmojiCanvas emojis={PETAL_EMOJIS} minSize={14} maxSize={22} speedMult={0.7} />;
    case 'spooky':
        return <FlashEmojiCanvas emojis={SPOOKY_EMOJIS} count={22} minSize={22} maxSize={48} frantic />;
    case 'harvest':
      return <FallingEmojiCanvas emojis={HARVEST_EMOJIS} count={28} spin={false} />;
    default:
      return null;
  }
}

// ─── Banner ──────────────────────────────────────────────────────────────────
function HolidayBanner({ banner }) {
  const { emoji1, emoji2, lines, accent, accent2, footer, patriotic } = banner;
  const acc2 = accent2 || accent;

  return (
    <div style={{
      position: 'absolute',
      top: '25px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100000,
      pointerEvents: 'none',
    }}>
      <span style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 'clamp(9px, 1.5vw, 13px)',
        letterSpacing: '3px',
        textAlign: 'center',
        lineHeight: 1.6,
        padding: '18px 28px',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.18)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `2px solid ${accent}99`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: patriotic
            ? `linear-gradient(90deg,${accent} 0%,${accent} 33%,#FFFFFF 33%,#FFFFFF 66%,${acc2} 66%,${acc2} 100%)`
            : `linear-gradient(90deg,${accent},${acc2})`,
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontSize: 20 }}>{emoji1}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {lines.map((line, i) => (
              <span
                key={i}
                style={{
                  color: '#FFFFFF',
                  textShadow: `0 0 12px ${i % 2 === 0 ? accent : acc2}, 0 0 24px ${i % 2 === 0 ? accent : acc2}`,
                }}
              >
                {line}
              </span>
            ))}
          </div>
          <span style={{ fontSize: 20 }}>{emoji2}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,transparent,${accent})` }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2 }}>★ ★ ★</span>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg,${acc2},transparent)` }} />
        </div>

        <span style={{ fontSize: '0.65em', color: 'rgba(255,255,255,.35)', letterSpacing: '2px' }}>{footer}</span>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
          background: patriotic
            ? `linear-gradient(90deg,${acc2} 0%,${acc2} 33%,#FFFFFF 33%,#FFFFFF 66%,${accent} 66%,${accent} 100%)`
            : `linear-gradient(90deg,${acc2},${accent})`,
        }} />
      </span>
    </div>
  );
}

// ─── Minor-tier holidays: site-wide accent color swap, no canvas/banner ─────
export function HolidayAccent() {
  const holiday = FORCE_HOLIDAY_TEST
    ? HOLIDAYS.find((h) => h.id === FORCE_HOLIDAY_TEST)
    : getActiveHoliday();

    useEffect(() => {
      if (holiday?.tier === 'minor' && holiday.accent) {
        document.documentElement.style.setProperty('--holiday-accent', holiday.accent);
      } else {
        document.documentElement.style.removeProperty('--holiday-accent');
      }
    return () => {
      document.documentElement.style.removeProperty('--holiday-accent');
    };
  }, [holiday?.id]);

  return null;
}


// ─── Main export ─────────────────────────────────────────────────────────────
export default function SeasonalFlair({ fullscreen = false }) {
  const holiday = getActiveHoliday();
  if (!holiday || holiday.tier !== 'major') return null; // ← only majors get the takeover

  const [seen, setSeen] = useState(
    fullscreen && holiday ? hasSeenToday(holiday.id) : false
  );

  useEffect(() => {
    if (fullscreen && holiday && !hasSeenToday(holiday.id)) {
      markSeenToday(holiday.id);
    }
  }, [fullscreen, holiday?.id]);

  if (!holiday) return null;
  if (fullscreen && seen) return null;

  return (
    <div
      style={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        width: fullscreen ? '100vw' : '100%',
        height: fullscreen ? '100vh' : '160px',
        marginBottom: fullscreen ? 0 : '.6rem',
        borderRadius: fullscreen ? 0 : '10px',
        overflow: 'hidden',
        background: 'transparent',
        border: 'none',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <EffectCanvas effect={holiday.effect} />
      <HolidayBanner banner={holiday.banner} />
    </div>
  );
}
