import { useEffect, useRef } from 'react';

// ─── Holiday definitions ─────────────────────────────────────────────────────
// Add more here as needed. `window` = days before+after the date that also show flair.
const HOLIDAYS = [
  { month: 7,  day: 4,  window: 2, effect: 'fireworks' },
  { month: 10, day: 31, window: 2, effect: 'snow'      }, // placeholder — swap for spooky later
  { month: 12, day: 25, window: 2, effect: 'snow'      },
  { month: 1,  day: 1,  window: 2, effect: 'fireworks' },
];

function getActiveEffect() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  for (const h of HOLIDAYS) {
    const hDate = new Date(now.getFullYear(), h.month - 1, h.day);
    const diff = Math.abs((now - hDate) / 86400000);
    if (diff <= h.window) return h.effect;
  }
  return null;
}

// ─── Fireworks canvas ────────────────────────────────────────────────────────
function FireworksCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    console.log('[fw] canvas ref:', canvas);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    console.log('[fw] ctx:', ctx);
    if (!ctx) return;
  
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
        this.trail.forEach((t, i) => {
          const a = (i / this.trail.length) * 0.55;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 1.7, 0, Math.PI * 2);
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

    let logicalW = window.innerWidth;
    let logicalH = window.innerHeight;
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

    // ← KEY CHANGE: delay init so fixed/fullscreen parent has laid out on mobile
    const initTimer = setTimeout(() => {
      console.log('[fw] init firing, window:', window.innerWidth, window.innerHeight);
    
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

// ─── Snow canvas (placeholder for winter holidays) ───────────────────────────
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

// ─── Banner label ────────────────────────────────────────────────────────────
const LABELS = {
  fireworks: { text: '🎆 HAPPY BIRTHDAY AMERICA', color: '#FF4500' },
  snow:      { text: '❄️ HAPPY HOLIDAYS', color: '#87CEEB' },
};

// ─── Main export ─────────────────────────────────────────────────────────────
export default function SeasonalFlair({ fullscreen = false }) {
  const effect = getActiveEffect();
  if (!effect) return null;

  const label = LABELS[effect];

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
      {effect === 'fireworks' && <FireworksCanvas />}
      {effect === 'snow'      && <SnowCanvas />}

      {/* Overlay label — sits above canvas */}
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
  border: '2px solid rgba(178,34,52,0.6)',
  position: 'relative',
  overflow: 'hidden',
}}>
  {/* Top stripe */}
  <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'linear-gradient(90deg,#B22234 0%,#B22234 33%,#FFFFFF 33%,#FFFFFF 66%,#3C3B6E 66%,#3C3B6E 100%)' }} />
  
  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
    <span style={{ fontSize:20 }}>🎆</span>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <span style={{ color:'#FFFFFF', textShadow:'0 0 12px #B22234, 0 0 24px #B22234' }}>HAPPY BIRTHDAY</span>
      <span style={{ color:'#FFFFFF', textShadow:'0 0 12px #3C3B6E, 0 0 24px #3C3B6E' }}>AMERICA</span>
    </div>
    <span style={{ fontSize:20 }}>🎇</span>
  </div>

  <div style={{ display:'flex', alignItems:'center', gap:6, width:'100%', justifyContent:'center' }}>
    <div style={{ height:1, flex:1, background:'linear-gradient(90deg,transparent,#B22234)' }} />
    <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)', letterSpacing:2 }}>★ ★ ★</span>
    <div style={{ height:1, flex:1, background:'linear-gradient(90deg,#3C3B6E,transparent)' }} />
  </div>

  <span style={{ fontSize:'0.65em', color:'rgba(255,255,255,.35)', letterSpacing:'2px' }}>FROM THE WN95HL</span>

  {/* Bottom stripe */}
  <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:'linear-gradient(90deg,#3C3B6E 0%,#3C3B6E 33%,#FFFFFF 33%,#FFFFFF 66%,#B22234 66%,#B22234 100%)' }} />
</span>
      </div>
    </div>
  );
}
