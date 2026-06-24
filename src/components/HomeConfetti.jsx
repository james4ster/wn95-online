import { useEffect, useRef } from 'react';

// ─── Confetti canvas ─────────────────────────────────────────────────────────
function ConfettiCanvas({ colors }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.parentElement.getBoundingClientRect().width;
        const h = canvas.parentElement.getBoundingClientRect().height;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const COLORS = colors?.length ? colors : ['#FFD700', '#FF8C00', '#FF4500', '#FFFFFF', '#87CEEB'];

    class Piece {
      constructor() { this.reset(true); }
      reset(initial = false) {
        this.x = Math.random() * canvas.offsetWidth;
        this.y = initial ? Math.random() * -canvas.offsetHeight : -10 - Math.random() * 40;
        this.w = Math.random() * 7 + 4;
        this.h = this.w * (Math.random() * 0.5 + 0.4);
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.vy = Math.random() * 1.6 + 1.2;
        this.vx = (Math.random() - 0.5) * 1.1;
        this.rot = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.12;
        this.flutter = Math.random() * Math.PI * 2;
        this.flutterSpeed = Math.random() * 0.05 + 0.02;
      }
      update() {
        this.flutter += this.flutterSpeed;
        this.x += this.vx + Math.sin(this.flutter) * 0.6;
        this.y += this.vy;
        this.rot += this.rotSpeed;
        if (this.y > canvas.offsetHeight + 20) this.reset();
      }
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
        ctx.restore();
      }
    }

    const pieces = Array.from({ length: 130 }, () => new Piece());
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      pieces.forEach((p) => { p.draw(ctx); p.update(); });
    };
    loop();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
    />
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
// Pass `active` from Home.jsx based on your own championship-window logic
// (e.g. currentSeason.status === 'offseason' && championTeam && within N days of end_date)
export default function ChampionshipFlair({
    active,
    teamCode,
    teamName,
    seasonLabel,
    colors,
    fullscreen = false,
  }) {
  if (!active || !teamCode) return null;

  return (
    <div
      style={{
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        width: fullscreen ? '100vw' : '100%',
        height: fullscreen ? '100vh' : '320px',
        marginBottom: fullscreen ? 0 : '.6rem',
        borderRadius: fullscreen ? 0 : '10px',
        overflow: 'hidden',
        background: fullscreen
          ? 'transparent'
          : 'linear-gradient(135deg, #00000a 0%, #0a0a18 100%)',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <ConfettiCanvas colors={colors} />

      {/* Centered banner + logo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
          gap: '.5rem',
        }}
      >
        <span
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 'clamp(9px, 1.3vw, 12px)',
            color: '#FFD700',
            letterSpacing: '4px',
            textShadow: '0 0 16px #FFD700, 0 0 34px rgba(255,215,0,.5)',
          }}
        >
          🏆 WE DID IT! {seasonLabel} CHAMPIONS
        </span>

        {/* Banner backdrop behind logo, same asset pattern as your hero/PEB tiles */}
        <div
          style={{
            position: 'relative',
            width: 'min(90vw, 760px)',
            height: 'min(50vw, 260px)',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#000',
            border: '2px solid rgba(255,215,0,.35)',
            boxShadow: '0 0 30px rgba(255,215,0,.25)',
          }}
        >
          <img
            src={`/assets/banners/${teamCode}.png`}
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'contain', opacity: 0.85, filter: 'saturate(1.3)',
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, transparent 30%, rgba(4,4,10,.92) 100%)',
            }}
          />
          <img
            src={`/assets/teamLogos/${teamCode}.png`}
            alt={teamName || teamCode}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '46%', maxWidth: '150px', objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px rgba(255,215,0,.65)) drop-shadow(0 6px 16px rgba(0,0,0,.6))',
            }}
            onError={(e) => { e.currentTarget.style.opacity = '0'; }}
          />
        </div>

        <span
          style={{
            fontFamily: "'VT323', monospace",
            fontSize: '20px',
            color: 'rgba(255,255,255,.7)',
            letterSpacing: '1px',
            textShadow: '0 0 10px rgba(255,215,0,.3)',
          }}
        >
          {teamName || teamCode}
        </span>
      </div>
    </div>
  );
}
