import React from 'react';


export default function CenteredAd({ visible, gameNum, adImage, style = {} }) {

  const safeImage = adImage?.trim();

  if (!visible || !safeImage) return null;

  return (
    <>
      <div className={`po-center-ad${visible ? ' visible' : ''}`} style={style}>
        <div className="po-center-ad-inner">
          <div className="po-center-ad-title">
          Game {gameNum} Coming Up
            <span className="po-center-ad-presented">PRESENTED BY</span>
          </div>
          {visible && adImage?.trim() && (
            <img
              src={`/assets/ads/${adImage}`}
              alt="Sponsor"
              className="po-center-ad-img"
              //onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="po-center-ad-footer">
            Brought To You By{' '}
            <span className="po-center-ad-brand">TickleWeb Overlays</span>
            <span className="po-center-ad-div">, A Division Of TickleCorp</span>
          </div>
        </div>
      </div>
      <CenteredAdStyles />
    </>
  );
}

function CenteredAdStyles() {
  return <style>{`
    .po-center-ad {
      position: absolute;
      left: 210px; right: 210px;
      top: 44px; bottom: 36px;
      z-index: 50;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.92);
      transition: opacity 0.45s ease, transform 0.45s ease;
    }
    .po-center-ad.visible {
      opacity: 1;
      transform: scale(1);
    }
    .po-center-ad-inner {
      background: linear-gradient(160deg, rgba(4,2,20,.97), rgba(10,6,30,.97));
      border: 2px solid rgba(255,215,0,.55);
      border-radius: 10px;
      padding: 1.4rem 2rem;
      display: flex; flex-direction: column; align-items: center; gap: 1rem;
      box-shadow: 0 0 60px rgba(255,140,0,.2), 0 0 120px rgba(0,0,0,.8);
      width: 100%; max-width: 680px;
    }
    .po-center-ad-title {
      font-family: 'Press Start 2P', monospace; font-size: .78rem;
      color: #FFD700; letter-spacing: 3px;
      text-shadow: 0 0 12px rgba(255,215,0,.5);
      text-align: center;
    }
    .po-center-ad-presented {
      color: rgba(255,255,255,.45);
      font-size: .62rem;
      letter-spacing: 2px;
      margin-left: 8px;
    }
    .po-center-ad-img {
      max-width: 520px; max-height: 260px;
      width: auto; height: auto;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid rgba(255,215,0,.18);
      filter: drop-shadow(0 0 16px rgba(255,215,0,.15));
    }
    .po-center-ad-footer {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 600;
      font-size: .95rem; color: rgba(255,255,255,.35);
      letter-spacing: 1px; text-align: center;
    }
    .po-center-ad-brand {
      color: #FF8C00;
      font-weight: 800;
    }
    .po-center-ad-div {
      color: rgba(255,255,255,.25);
    }
  `}</style>;
}
