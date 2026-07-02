import React, { useEffect, useRef, useState } from "react";

/**
 * ZamboniOffseasonBar
 * -----------------------------------------------------------------------
 * Drop-in replacement for the scores strip during the offseason. Renders
 * a static pixel-art rink (ice sheet, blue lines, faceoff circle, red
 * lines) with a pixel-sprite zamboni that drives a true round trip
 * across the full width of its container, pauses/flips at each end,
 * then drives back. Matches the WN95HL retro palette (dark bg, cyan/gold
 * accents) and uses crisp, blocky pixel-art rendering for an NHL95 vibe.
 *
 * Sits inline at a fixed 96px height, full width — same footprint as
 * the original bar. Intended usage: during the offseason, don't render
 * the scores strip at all, and render this in its place instead.
 * -----------------------------------------------------------------------
 */

// Zamboni sprite, local coordinate space 130 x 60, facing right.
// Driver sits on an OPEN platform (no roof, no window) so the whole
// dog is visible, the way a real ice resurfacer operator sits exposed.
// Color values below are TOKENS (keys into ZAMBONI_THEMES), not literal
// hex, wherever the part is themeable (body, stripe, tank, cab). Parts
// that stay constant across variants (undercarriage, wheels, driver)
// keep literal hex.
const ZAMBONI_RECTS = [
  // undercarriage / shadow
  [8, 44, 108, 3, "#111111"],

  // main body — stepped shading, themeable
  [10, 26, 105, 4, "bodyLight"],
  [10, 30, 105, 8, "bodyMain"],
  [10, 37, 105, 4, "stripe"],
  [10, 41, 105, 3, "stripeShadow"],

  // rear tank housing (raised box at back-left, holds shavings)
  [14, 18, 22, 10, "tank"],
  [14, 18, 22, 2, "tankLight"],
  [14, 26, 22, 2, "tankShade"],
  [18, 15, 3, 3, "#4a4a4a"], // vent stack (also exhaust source, see puffs below)
  [26, 15, 3, 3, "#4a4a4a"],

  // open driver platform (front-right) — no roof, no window, fully
  // exposed so the driver actually sits out in the open like a real
  // resurfacer operator
  [84, 22, 32, 10, "cab"],
  [84, 22, 32, 2, "cabLight"],
  [84, 30, 32, 2, "cabShade"],
  [82, 24, 2, 4, "#2c2c2c"], // side grab bar

  // steering wheel, mounted at the front edge of the platform
  [100, 15, 6, 1, "#c9cddb"],
  [100, 21, 6, 1, "#c9cddb"],
  [100, 15, 1, 7, "#c9cddb"],
  [105, 15, 1, 7, "#c9cddb"],
  [102, 22, 2, 3, "#4a4a4a"], // steering post down to deck

  // ===== driver: German shepherd, sitting fully exposed on the open platform =====
  // tail
  [83, 16, 2, 2, "#5a3d20"],
  [81, 18, 2, 2, "#5a3d20"],
  [82, 20, 2, 3, "#5a3d20"],
  // torso
  [92, 12, 12, 10, "#c8874a"],
  [92, 10, 12, 4, "#2b2118"], // saddle marking across back
  // back leg + paw (resting on deck)
  [92, 18, 4, 6, "#c8874a"],
  [90, 22, 6, 3, "#c8874a"],
  // front leg + paw (reaching to wheel)
  [104, 10, 3, 6, "#c8874a"],
  [102, 15, 5, 2, "#c8874a"],
  // head
  [94, 4, 10, 8, "#c8874a"],
  [94, 4, 10, 2, "#2b2118"], // forehead marking
  [96, 10, 6, 3, "#c8874a"], // snout
  [98, 12, 2, 1, "#1a1410"], // nose
  [95, 7, 1, 1, "#1a1410"], // left eye
  [101, 7, 1, 1, "#1a1410"], // right eye
  // ears — tapered points, German shepherd style
  [94, 0, 1, 1, "#2b2118"],
  [93, 1, 2, 1, "#2b2118"],
  [93, 2, 2, 2, "#2b2118"],
  [104, 0, 1, 1, "#2b2118"],
  [104, 1, 2, 1, "#2b2118"],
  [104, 2, 3, 2, "#2b2118"],
  // cigarette
  [102, 11, 4, 1, "#d8d3c4"],
  [106, 11, 1, 1, "#ff6b35"], // ember

  // sloped hood between platform and auger
  [78, 32, 34, 6, "bodyMain"],
  [78, 32, 34, 2, "bodyLight"],

  // front auger / brush (shaves & collects ice)
  [115, 34, 8, 11, "#2e2e2e"],
  [116, 36, 6, 7, "#4a4a4a"],
  [117, 38, 4, 3, "#666666"],

  // headlight (pulses via CSS class)
  [111, 30, 5, 5, "#ffd93d"],
  [111, 30, 5, 2, "#fff2b0"],

  // wheel wells (front + rear) — hub gets a spin-flicker CSS class
  [24, 43, 16, 12, "#0e0e0e"],
  [28, 47, 8, 8, "#0e0e0e"],
  [30, 49, 4, 4, "#8a8a8a", "wn95-hub"],

  [78, 43, 16, 12, "#0e0e0e"],
  [82, 47, 8, 8, "#0e0e0e"],
  [84, 49, 4, 4, "#8a8a8a", "wn95-hub"],
];

// Themeable color palettes for the sprite body/stripe/tank/cab.
// `themed` uses CSS custom properties so a wrapping component can set
// --team-primary / --team-secondary (same pattern already used in
// StreamOverlayPlayoff.jsx) and the zamboni will pick up team colors.
const ZAMBONI_THEMES = {
  classic: {
    bodyLight: "#fbfaf5",
    bodyMain: "#f0eee3",
    stripe: "#2f6fb5",
    stripeShadow: "#1f4d80",
    tank: "#f0eee3",
    tankLight: "#fbfaf5",
    tankShade: "#d8d5c8",
    cab: "#f0eee3",
    cabLight: "#fbfaf5",
    cabShade: "#d8d5c8",
  },
  wn95: {
    bodyLight: "#2a3550",
    bodyMain: "#1c2740",
    stripe: "#87CEEB",
    stripeShadow: "#4a8fa8",
    tank: "#1c2740",
    tankLight: "#3a4a70",
    tankShade: "#12192b",
    cab: "#1c2740",
    cabLight: "#FFD700",
    cabShade: "#12192b",
  },
  night: {
    bodyLight: "#3a2f52",
    bodyMain: "#241d38",
    stripe: "#9d6bff",
    stripeShadow: "#5f3fa3",
    tank: "#241d38",
    tankLight: "#4a3a6e",
    tankShade: "#15101f",
    cab: "#241d38",
    cabLight: "#c9a8ff",
    cabShade: "#15101f",
  },
  themed: {
    bodyLight: "var(--team-primary-light, #e9e5d8)",
    bodyMain: "var(--team-primary, #e9e5d8)",
    stripe: "var(--team-secondary, #c0392b)",
    stripeShadow: "var(--team-secondary-shade, #9c2d22)",
    tank: "var(--team-primary, #d9d5c6)",
    tankLight: "var(--team-primary-light, #f5f2e8)",
    tankShade: "var(--team-primary-shade, #b8b4a6)",
    cab: "var(--team-primary, #e9e5d8)",
    cabLight: "var(--team-secondary, #f5f2e8)",
    cabShade: "var(--team-primary-shade, #b8b4a6)",
  },
};

// Coordinate space the art is authored in (don't touch — every rect above
// is placed against this). Rendered size is scaled up separately below so
// the driver reads clearly, without having to re-plot any coordinates.
const ZAMBONI_WIDTH = 130;
const ZAMBONI_HEIGHT = 60;

// Slightly enlarge the whole machine so the open-air driver is easy to see.
const ZAMBONI_SCALE = 1.15;
const ZAMBONI_RENDER_WIDTH = Math.round(ZAMBONI_WIDTH * ZAMBONI_SCALE); // 150
const ZAMBONI_RENDER_HEIGHT = Math.round(ZAMBONI_HEIGHT * ZAMBONI_SCALE); // 69

function ZamboniSprite({ variant = "classic" }) {
  const theme = ZAMBONI_THEMES[variant] || ZAMBONI_THEMES.classic;

  return (
    <svg
      viewBox={`0 0 ${ZAMBONI_WIDTH} ${ZAMBONI_HEIGHT}`}
      width={ZAMBONI_RENDER_WIDTH}
      height={ZAMBONI_RENDER_HEIGHT}
      shapeRendering="crispEdges"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* exhaust puffs, rising off the tank vent stacks, animated via CSS */}
      <rect className="wn95-puff wn95-puff-1" x="19" y="10" width="3" height="3" fill="#8a94a0" />
      <rect className="wn95-puff wn95-puff-2" x="20" y="9" width="4" height="4" fill="#8a94a0" />
      <rect className="wn95-puff wn95-puff-3" x="21" y="8" width="3" height="3" fill="#8a94a0" />

      {ZAMBONI_RECTS.map(([x, y, w, h, fill, cls], i) => {
        const resolvedFill = theme[fill] || fill; // token lookup, else literal hex
        return <rect key={i} className={cls} x={x} y={y} width={w} height={h} fill={resolvedFill} />;
      })}

      {/* ice-shaving spray kicked up behind the auger, animated via CSS */}
      <rect className="wn95-spray wn95-spray-1" x="123" y="32" width="2" height="2" fill="#dff3f8" />
      <rect className="wn95-spray wn95-spray-2" x="126" y="30" width="2" height="2" fill="#dff3f8" />
      <rect className="wn95-spray wn95-spray-3" x="122" y="28" width="2" height="2" fill="#dff3f8" />

      {/* driver's cigarette smoke, small wisp drifting up off the ember */}
      <rect className="wn95-cig-puff wn95-cig-puff-1" x="107" y="9" width="1" height="1" fill="#b8bcc2" />
      <rect className="wn95-cig-puff wn95-cig-puff-2" x="108" y="9" width="1" height="1" fill="#b8bcc2" />
      <rect className="wn95-cig-puff wn95-cig-puff-3" x="107" y="8" width="1" height="1" fill="#b8bcc2" />
    </svg>
  );
}

function RinkBackground({ championLogoUrl }) {
  return (
    <svg
      viewBox="0 0 1360 96"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="wn95-ice" width="40" height="96" patternUnits="userSpaceOnUse">
          <rect width="40" height="96" fill="#0b1018" />
          <rect width="20" height="96" fill="#0e1420" />
        </pattern>
        {championLogoUrl && (
          <clipPath id="wn95-center-logo-clip">
            <circle cx="680" cy="48" r="24" />
          </clipPath>
        )}
      </defs>
      <rect width="1360" height="96" fill="url(#wn95-ice)" />
      <line x1="0" y1="8" x2="1360" y2="8" stroke="#1c2740" strokeWidth="2" />
      <line x1="0" y1="88" x2="1360" y2="88" stroke="#1c2740" strokeWidth="2" />
      <line x1="120" y1="8" x2="120" y2="88" stroke="#c0483f" strokeWidth="3" opacity="0.55" />
      <line x1="1240" y1="8" x2="1240" y2="88" stroke="#c0483f" strokeWidth="3" opacity="0.55" />
      <line x1="680" y1="8" x2="680" y2="88" stroke="#3f6fb0" strokeWidth="3" opacity="0.55" />
      <circle cx="680" cy="48" r="28" fill="none" stroke="#3f6fb0" strokeWidth="2" opacity="0.5" />

      {championLogoUrl ? (
        <image
          href={championLogoUrl}
          x="656"
          y="24"
          width="48"
          height="48"
          clipPath="url(#wn95-center-logo-clip)"
          style={{ imageRendering: "auto" }}
          //style={{ imageRendering: "pixelated" }}
          opacity="0.9"
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <circle cx="680" cy="48" r="2" fill="#3f6fb0" opacity="0.6" />
      )}
    </svg>
  );
}

export default function ZamboniOffseasonBar({ variant = "classic", championLogoUrl }) {
  const barRef = useRef(null);
  const [trackPx, setTrackPx] = useState(0);

  // CSS `%` inside `transform: translateX(calc(100% - ...))` resolves
  // against the ANIMATED ELEMENT's own box, not its parent container —
  // that's why the zamboni previously only crept a few pixels and
  // looked like it was turning around near the left edge. To make it
  // travel the true width of the bar, we measure the container in real
  // pixels and drive the keyframes off that value instead.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const update = () => setTrackPx(el.clientWidth);
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const travelPx = Math.max(trackPx - ZAMBONI_RENDER_WIDTH, 0);

  return (
    <div className="wn95-zamboni-bar" ref={barRef}>
      <style>{`
        .wn95-zamboni-bar {
          position: relative;
          width: 100%;
          height: 96px;
          overflow: hidden;
          border: 1px solid #1c2740;
          image-rendering: pixelated;
        }
        .wn95-zamboni-label {
          position: absolute;
          top: 8px;
          left: 16px;
          font-family: "Press Start 2P", monospace;
          font-size: 9px;
          letter-spacing: 0.5px;
          color: #4a6a9a;
          z-index: 2;
        }
        .wn95-zamboni-sprite-wrap {
          --travel: ${travelPx}px;
          position: absolute;
          top: 17px;
          left: 0;
          width: ${ZAMBONI_RENDER_WIDTH}px;
          height: ${ZAMBONI_RENDER_HEIGHT}px;
          animation: ${travelPx > 0 ? "wn95-zamboni-roundtrip 40.6s ease-in-out infinite" : "none"};
          will-change: transform;
        }

        /* Single, non-conflicting keyframe list, driven off --travel,
           a real pixel value measured from the container — not a CSS
           percentage (which would resolve against this element itself,
           not the bar). */
        @keyframes wn95-zamboni-roundtrip {
          0%    { transform: translateX(0) scaleX(1); }
          45%   { transform: translateX(var(--travel)) scaleX(1); }
          50%   { transform: translateX(var(--travel)) scaleX(-1); }
          95%   { transform: translateX(0) scaleX(-1); }
          100%  { transform: translateX(0) scaleX(1); }
        }

        /* hub "spin" flicker — swaps shade to fake rotation while moving */
        .wn95-hub {
          animation: wn95-hub-spin 0.18s steps(2) infinite;
        }
        @keyframes wn95-hub-spin {
          0%   { fill: #8a8a8a; }
          50%  { fill: #cfcfcf; }
          100% { fill: #8a8a8a; }
        }

        /* headlight pulse */
        .wn95-zamboni-bar svg rect[fill="#fff2b0"] {
          animation: wn95-headlight 1.1s steps(2) infinite;
        }
        @keyframes wn95-headlight {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }

        /* exhaust puffs rising + fading, staggered, blocky steps (no smooth fades) */
        .wn95-puff {
          animation: wn95-puff-rise 1.6s steps(4) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .wn95-puff-1 { animation-delay: 0s; }
        .wn95-puff-2 { animation-delay: 0.4s; }
        .wn95-puff-3 { animation-delay: 0.8s; }
        @keyframes wn95-puff-rise {
          0%   { transform: translateY(0) scale(1); opacity: 0.9; }
          75%  { transform: translateY(-10px) scale(1.6); opacity: 0.25; }
          100% { transform: translateY(-12px) scale(1.8); opacity: 0; }
        }

        /* ice-shaving spray off the front auger, blocky steps */
        .wn95-spray {
          animation: wn95-spray-kick 0.5s steps(3) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .wn95-spray-1 { animation-delay: 0s; }
        .wn95-spray-2 { animation-delay: 0.12s; }
        .wn95-spray-3 { animation-delay: 0.24s; }
        @keyframes wn95-spray-kick {
          0%   { transform: translate(0, 0); opacity: 1; }
          60%  { transform: translate(6px, -4px); opacity: 0.6; }
          100% { transform: translate(9px, -1px); opacity: 0; }
        }

        /* driver's cigarette smoke — thin, slow, drifting wisp */
        .wn95-cig-puff {
          animation: wn95-cig-smoke 2.2s steps(5) infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        .wn95-cig-puff-1 { animation-delay: 0s; }
        .wn95-cig-puff-2 { animation-delay: 0.7s; }
        .wn95-cig-puff-3 { animation-delay: 1.4s; }
        @keyframes wn95-cig-smoke {
          0%   { transform: translate(0, 0) scale(1); opacity: 0.8; }
          70%  { transform: translate(1px, -6px) scale(1.8); opacity: 0.3; }
          100% { transform: translate(2px, -8px) scale(2.2); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .wn95-zamboni-sprite-wrap {
            animation: none;
            transform: translateX(${Math.round(travelPx * 0.35)}px);
          }
          .wn95-hub, .wn95-puff, .wn95-spray, .wn95-cig-puff,
          .wn95-zamboni-bar svg rect[fill="#fff2b0"] {
            animation: none;
          }
        }
      `}</style>

      <RinkBackground championLogoUrl={championLogoUrl} />
      <span className="wn95-zamboni-label">OFFSEASON · ICE BEING RESURFACED</span>

      <div className="wn95-zamboni-sprite-wrap">
        <ZamboniSprite variant={variant} />
      </div>
    </div>
  );
}

/**
 * EXAMPLE INTEGRATION — swap the whole strip during the offseason:
 *
 * function TopBar() {
 *   return isOffseason
 *     ? (
 *       <ZamboniOffseasonBar
 *         variant="classic"                      // "classic" (light) | "wn95" | "themed" | "night"
 *         championLogoUrl="/logos/thunderbay.png" // optional, painted at center ice
 *       />
 *     )
 *     : <ScoresBar />;
 * }
 *
 * For the "themed" variant, set --team-primary / --team-secondary
 * (and optionally --team-primary-light / --team-primary-shade) on an
 * ancestor element, the same way StreamOverlayPlayoff.jsx does it,
 * and the zamboni body/stripe will pick up the team's colors.
 */
