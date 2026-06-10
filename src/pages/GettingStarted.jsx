import React, { useState } from 'react';

const sections = [
  {
    id: 'overview',
    icon: '🗺️',
    label: 'OVERVIEW',
    color: '#FFB347',
  },
  {
    id: 'retroarch',
    icon: '🕹️',
    label: 'RETROARCH SETUP',
    color: '#87CEEB',
  },
  {
    id: 'netplay',
    icon: '🌐',
    label: 'NETPLAY & FIREWALL',
    color: '#87CEEB',
  },
  {
    id: 'rom',
    icon: '💾',
    label: 'ROM & TESTING',
    color: '#87CEEB',
  },
  {
    id: 'twitch',
    icon: '📡',
    label: 'STREAMING (TWITCH)',
    color: '#9146FF',
  },
  {
    id: 'overlays',
    icon: '🎬',
    label: 'STREAM OVERLAYS',
    color: '#FFD700',
  },
];

const stepData = {
  overview: {
    title: 'OVERVIEW',
    subtitle: 'Getting started is easy',
    description:
      'Start here to get the lay of the land. The following is an overview of what each tab is for...',
    steps: [
      {
        num: '01',
        heading: 'RetroArch Setup',
        body: (
          <>
            RetroArch is the emulator that runs NHL '95. We'll walk you through
            downloading our preconfigured build and getting it running — no
            tinkering required out of the box.
          </>
        ),
      },
      {
        num: '02',
        heading: 'Netplay & Firewall',
        body: (
          <>
            <p>
              Netplay is a part of Retroarch and used to connect players
              together.
            </p>
            <p>
              To play online, your router needs to have a port opened for
              RetroArch. We'll cover exactly which port to forward and how to
              verify your connection is ready for netplay.
            </p>
            <p>Retroarch must be allowed through your Firewall</p>
          </>
        ),
      },
      {
        num: '03',
        heading: 'ROM & Testing',
        body: (
          <>
            <p>ROM = The game file; What you load to launch NHL 95</p>
            <p>
              This tab explains how to get the NHL 95 ROM, how to launch it in
              RetroArch, and how to test it.
            </p>
          </>
        ),
      },
      {
        num: '04',
        heading: 'Streaming (Twitch)',
        body: (
          <>
            This tab is completely optional but encouraged if you decide to join
            the league — if you want to broadcast your games to Twitch, this tab
            shows a basic setup guide to stream your games live.
          </>
        ),
      },
      {
        num: '05',
        heading: 'Stream Overlays',
        body: (
          <>
            If you're announcing or streaming WN95HL games, this tab walks you
            through adding the league's live overlays to your stream — covering
            both the regular season and playoff overlays, for OBS and
            Streamlabs.
          </>
        ),
      },
    ],
  },
  retroarch: {
    title: 'RETROARCH SETUP',
    subtitle: 'Get up and running with version 1.17',
    sections: [
      {
        id: 'downloads',
        label: '⬇️ STEP 1 — GET THE FILES',
        steps: [
          {
            num: '01',
            heading: 'Download RetroArch',
            body: (
              <>
                <p>
                  Download the preconfigured RetroArch v1.17 build below. This
                  build is pre-configured for NHL '95 netplay — no tweaking
                  required out of the box.
                </p>
                <a
                  href="https://github.com/james4ster/wn95-online/releases/download/retroarch-1.17-Winx64/RetroArch-1.17-Win64.zip"
                  className="guide-link"
                  download
                >
                  💾 Download RetroArch v1.17 (Win64) →
                </a>
              </>
            ),
          },
          {
            num: '02',
            heading: 'Extract & Save',
            body: (
              <>
                Extract the downloaded zip file and save the folder somewhere
                easy to access.
              </>
            ),
          },
          {
            num: '03',
            heading: 'Create Shortcut',
            body: (
              <>
                <p>
                  Open the unzipped folder and find the retroarch.exe
                  application file.
                </p>
                <img
                  src="/assets/screenshots/guide/RA-exe.png"
                  alt="RetroArch file"
                  className="guide-screenshot"
                />
                <p>
                  <b>
                    Create a shortcut to this file, and place it on your Desktop
                    or Taskbar; The shortcut will be how you'll launch RA going
                    forward
                  </b>
                </p>
              </>
            ),
          },
        ],
      },
      {
        id: 'configuration',
        label: '⚙️ STEP 2 — CONFIGURE',
        steps: [
          {
            num: '01',
            heading: 'Launch Retroarch',
            body: (
              <>
                <p>Open Retroarch using the shortcut</p>
                <img
                  src="/assets/screenshots/guide/RA-main-screen.png"
                  alt="RetroArch Main Menu"
                  className="guide-screenshot"
                />
                <p>
                  <i>
                    Since you're using the preconfigured build, most settings
                    are already dialed in.
                  </i>
                </p>
              </>
            ),
          },

          {
            num: '02',
            heading: 'Navigation Controls',
            body: (
              <>
                <p>Move Selection - Arrows on keyboard </p>
                <p>Select - ENTER key </p>
                <p>Back - Backspace key </p>
                <p>Exit RetroArch - ESC key</p>
              </>
            ),
          },

          {
            num: '03',
            heading: 'Controller Configuration',
            body: (
              <>
                <p>
                  RetroArch contains many common controller configuration files,
                  so there is a very good chance your controller will work "out
                  of the box".{' '}
                </p>
                <p>
                  If you see a message that says "controller not configured",
                  you will need to configure it manually. Follow the
                  instructions put together from the NHL 94 community:{' '}
                  <a
                    href="https://nhl94online.com/html/controller.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="guide-link"
                  >
                    Controller Configuration Guide →
                  </a>
                </p>
                <br></br>
                <h5>
                  If you are new to emulator games and need to purchase a
                  controller there are 2 popular options:
                </h5>

                <p>
                  <a
                    href="https://amzn.to/4oNhQ8a"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="guide-link"
                  >
                    Retrobit Genesis Controller →
                  </a>{' '}
                  — cheaper option, works fine, won't last as long as the next
                  option. Suggest buying 2 at a time. Doesn't always require
                  controller configuration.
                </p>
                <p>
                  <a
                    href="https://amzn.to/47EvSlv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="guide-link"
                  >
                    8bitDo M30 Controller →
                  </a>{' '}
                  — more expensive but lasts much longer than Retrobit.
                  Controller configuration is more complicated and usually
                  requires someone to share a picture of the setup. Comes with a
                  wire even though not shown on Amazon, but some use wireless.
                  Note that newer versions of 8bitDo may not work — multiple
                  cases reported.
                </p>
              </>
            ),
          },

          {
            num: '04',
            heading: 'Setup User Name',
            body: (
              <>
                <p>
                  In RetroArch, go to Settings ~ User. Set a User Name. This is
                  how opponents will find you.
                </p>
                <img
                  src="/assets/screenshots/guide/RA-set-user-name.png"
                  alt="RetroArch User Menu"
                  className="guide-screenshot"
                />

                <p>
                  <i>
                    This only needs to be done once. Spaces are allowed, but do
                    not use any special characters (like an underscore). Once
                    you set it, please exit RetroArch and restart it so it saves
                    your name.
                  </i>
                </p>
              </>
            ),
          },

          {
            num: '05',
            heading: 'Port Forwarding',
            body: (
              <>
                <p>
                  Port forwarding is done within your home router — outside of
                  RetroArch itself. Each ISP has slightly different menus but
                  the process is the same for everyone.
                </p>
                <p>
                  Google <em>"how to port forward [your router model]"</em> for
                  step-by-step instructions, or drop a message in{' '}
                  <span className="channel-tag">#help</span> on Discord and
                  someone will get you sorted.
                </p>
              </>
            ),
          },
        ],
      },
    ],
  },
  netplay: {
    title: 'NETPLAY & FIREWALL',
    subtitle: 'Connect with opponents online',
    steps: [
      {
        num: '01',
        heading: 'What is Netplay?',
        body: "Netplay is the built-in online component of RetroArch that lets two players connect and play head-to-head over the internet. One player hosts the session, the other joins. It's the backbone of all WN95 league games.",
      },
      {
        num: '02',
        heading: 'Netplay Setup Guide',
        body: (
          <>
            The NHL94 forum has a detailed walkthrough on configuring Netplay
            for RetroArch. Despite the length of the guide, the actual setup is
            pretty painless once you've done it once.{' '}
            <a
              href="https://forum.nhl94.com/index.php?/topic/18461-how-to-netplay-over-retroarch/"
              target="_blank"
              rel="noopener noreferrer"
              className="guide-link"
            >
              Netplay Over RetroArch Guide →
            </a>
          </>
        ),
      },
      {
        num: '03',
        heading: 'Windows Firewall',
        body: (
          <>
            You'll need to allow <strong>RetroArch.exe</strong> through your
            Windows Firewall so incoming connections can reach you when you
            host. The easiest way to find these steps is to Google{' '}
            <em>"allow an app through Windows firewall"</em>. Takes about 60
            seconds. This is the most common stumbling block for new players —
            if games aren't connecting, this is usually why.
          </>
        ),
      },
      {
        num: '04',
        heading: 'Pro Tip',
        body: (
          <>
            The RetroArch and Netplay setup looks more complicated than it
            actually is. Most players are up and running within 20 minutes. If
            you're running into connection issues, the{' '}
            <span className="channel-tag">#help</span> channel on Discord is
            active and experienced players check it regularly.
          </>
        ),
      },
    ],
  },
  rom: {
    title: 'ROM & TESTING',
    subtitle: 'Get your game file and verify your connection',
    steps: [
      {
        num: '01',
        heading: 'Download the ROM',
        body: (
          <>
            Download the league ROM from the link below. This is the game file
            that RetroArch will load. Both players must be running the same ROM
            for Netplay to work.{' '}
            <span className="placeholder-badge">⚠ ROM LINK COMING SOON</span>
          </>
        ),
      },
      {
        num: '02',
        heading: 'Test Your Connection',
        body: (
          <>
            It's easy to find someone to run a test game with in the{' '}
            <span className="channel-tag">#exis</span> channel. Exis (i.e.
            Exhibitions) is the perfect place to confirm new players can host
            and join a host without issues. Exis can also be used to play games
            for fun at any time. Just type #exis in the channel to let people
            know you want to play.
          </>
        ),
      },
      {
        num: '03',
        heading: 'Joining A League',
        body: (
          <>
            Once you've tested successfully, feel free to reach out to Segathon
            and/or UltraMagnus directly to ask about joining a league. Everyone
            in the Discord is incredibly cool, and if you're already playing
            exis you've probably already figured that out....
            <span className="placeholder-badge">
              📝 MORE DETAILS COMING SOON
            </span>
          </>
        ),
      },
    ],
  },
  twitch: {
    title: 'STREAMING ON TWITCH',
    subtitle: 'Broadcast your WN95 games live',
    steps: [
      {
        num: '01',
        heading: 'Create a Twitch Account',
        body: (
          <>
            If you don't already have one, head to{' '}
            <a
              href="https://twitch.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="guide-link"
            >
              twitch.tv →
            </a>{' '}
            and create a free account. Your channel name will be how other
            players and viewers find your stream.{' '}
            <span className="placeholder-badge">
              📝 DETAILED STEPS COMING SOON
            </span>
          </>
        ),
      },
      {
        num: '02',
        heading: 'Download OBS Studio',
        body: (
          <>
            OBS (Open Broadcaster Software) is the standard free tool for
            streaming. Download it at{' '}
            <a
              href="https://obsproject.com"
              target="_blank"
              rel="noopener noreferrer"
              className="guide-link"
            >
              obsproject.com →
            </a>
            . It's free, powerful, and what most WN95 streamers use.{' '}
            <span className="placeholder-badge">
              📝 OBS CONFIG GUIDE COMING SOON
            </span>
          </>
        ),
      },
      {
        num: '03',
        heading: 'Connect OBS to Twitch',
        body: (
          <>
            In OBS, go to <strong>Settings → Stream</strong>, select Twitch as
            the service, and connect your account. You can use the built-in
            Twitch integration or paste your stream key manually from your
            Twitch dashboard.{' '}
            <span className="placeholder-badge">
              📝 DETAILED STEPS COMING SOON
            </span>
          </>
        ),
      },
      {
        num: '04',
        heading: 'Capture RetroArch',
        body: (
          <>
            In OBS, add a <strong>Game Capture</strong> source and select
            RetroArch as the target application. This captures the game window
            cleanly. You can also add a microphone for commentary and a webcam
            if you want to show your reaction.
          </>
        ),
      },
    ],
  },
  overlays: {
    title: 'STREAM OVERLAYS',
    subtitle: 'Add WN95HL live overlays to your stream',
    description:
      "The WN95HL overlays are browser-based and work in both OBS and Streamlabs. Once set up it only takes a few seconds before each game to configure — pick your two teams and you're live.",

    sections: [
      {
        id: 'obs-setup',
        label: '⚙️ ONE-TIME SETUP — OBS STUDIO',
        steps: [
          {
            num: '01',
            heading: 'Create a New Scene',
            body: (
              <>
                <p>
                  In OBS, look at the <strong>Scenes</strong> panel in the
                  bottom-left. Click the <strong>+</strong> button and name it
                  something like <em>WN95HL Game</em>.
                </p>
                <p>
                  This will be your dedicated scene for league games. You can
                  switch back to your other scenes anytime.
                </p>
              </>
            ),
          },
          {
            num: '02',
            heading: 'Add the Overlay (Browser Source)',
            body: (
              <>
                <p>
                  In the <strong>Sources</strong> panel, click{' '}
                  <strong>+</strong> and choose <strong>Browser</strong>.
                </p>
                <p>
                  Give it a name and click OK. In the properties window that
                  opens:
                </p>
                <ul className="guide-list">
                  <li>
                    Paste the overlay URL into the <strong>URL</strong> field —
                    use the Regular Season or Playoff URL from the sections
                    below
                  </li>
                  <li>
                    Set <strong>Width</strong> to <strong>1920</strong>
                  </li>
                  <li>
                    Set <strong>Height</strong> to <strong>1080</strong>
                  </li>
                  <li>
                    Check <strong>"Shutdown source when not visible"</strong>
                  </li>
                  <li>
                    Click <strong>OK</strong>
                  </li>
                </ul>
              </>
            ),
          },
          {
            num: '03',
            heading: 'Fit the Overlay to Your Canvas',
            body: (
              <>
                <p>
                  Right-click the overlay source in the preview window and
                  select <strong>Transform → Fit to Screen</strong>. The overlay
                  will expand to fill your canvas.
                </p>
                <p>
                  <i>
                    The overlay background is fully transparent — it won't block
                    your game capture.
                  </i>
                </p>
              </>
            ),
          },
          {
            num: '04',
            heading: 'Add Your Game Capture (if you created a new scene)',
            body: (
              <>
                <p>
                  Click <strong>+</strong> in Sources again and choose{' '}
                  <strong>Game Capture</strong>. Set it to capture{' '}
                  <strong>RetroArch</strong>.
                </p>
                <p>
                  In the Sources panel, drag the Game Capture source so it sits{' '}
                  <strong>below</strong> the WN95HL Overlay. This puts the game
                  behind the overlay, not on top of it.
                </p>
                <p>
                  Resize and position the Game Capture so the game fills the
                  open center rectangle of the overlay — drag the corners until
                  it fits snugly inside the frame.
                </p>
                <div className="guide-callout guide-callout-info">
                  <div className="callout-title">
                    💡 TIP — RESIZING INDIVIDUAL SIDES
                  </div>
                  <div className="callout-body">
                    Hold <strong>Shift</strong> while dragging any edge or
                    corner handle of the Game Capture source to resize a single
                    side independently — without locking the aspect ratio. This
                    makes it easy to adjust just the height or just the width to
                    fit the frame precisely.
                  </div>
                </div>
              </>
            ),
          },
          {
            num: '05',
            heading: 'Lock the Overlay Source',
            body: (
              <>
                <p>
                  In the Sources panel, click the <strong>lock icon</strong>{' '}
                  next to the WN95HL Overlay source. This prevents you from
                  accidentally moving it during a stream.
                </p>
              </>
            ),
          },
        ],
      },
      {
        id: 'streamlabs-setup',
        label: '⚙️ ONE-TIME SETUP — STREAMLABS',
        steps: [
          {
            num: '01',
            heading: 'Create a New Scene',
            body: (
              <>
                <p>
                  In Streamlabs, find the <strong>Scenes</strong> panel and
                  click <strong>+</strong> to add a new scene. Name it.
                </p>
              </>
            ),
          },
          {
            num: '02',
            heading: 'Add the Overlay (Browser Source)',
            body: (
              <>
                <p>
                  Click <strong>+</strong> in the Sources panel and choose{' '}
                  <strong>Browser Source</strong>.
                </p>
                <p>In the properties:</p>
                <ul className="guide-list">
                  <li>
                    Paste the overlay URL into the <strong>URL</strong> field —
                    use the Regular Season or Playoff URL from the sections
                    below
                  </li>{' '}
                  <li>
                    Set <strong>Width</strong> to <strong>1920</strong>
                  </li>
                  <li>
                    Set <strong>Height</strong> to <strong>1080</strong>
                  </li>
                  <li>
                    Click <strong>Done</strong>
                  </li>
                </ul>
              </>
            ),
          },
          {
            num: '03',
            heading: 'Fit the Overlay to Your Canvas',
            body: (
              <>
                <p>
                  Right-click the overlay in the preview and choose{' '}
                  <strong>Transform → Fit to Screen</strong>.
                </p>
              </>
            ),
          },
          {
            num: '04',
            heading: 'Add Your Game Capture (if you created a new scene)',
            body: (
              <>
                <p>
                  Click <strong>+</strong> in Sources and choose{' '}
                  <strong>Game Capture</strong>. Select{' '}
                  <strong>RetroArch</strong> as the application.
                </p>
                <p>
                  In the Sources list, drag Game Capture so it sits{' '}
                  <strong>below</strong> the WN95HL Overlay. Resize it to fill
                  the open center area of the overlay.
                </p>
                <div className="guide-callout guide-callout-info">
                  <div className="callout-title">
                    💡 TIP — RESIZING INDIVIDUAL SIDES
                  </div>
                  <div className="callout-body">
                    Hold <strong>Shift</strong> while dragging any edge or
                    corner handle of the Game Capture source to resize a single
                    side independently — without locking the aspect ratio. This
                    makes it easy to adjust just the height or just the width to
                    fit the frame precisely.
                  </div>
                </div>
              </>
            ),
          },
          {
            num: '05',
            heading: 'Lock the Overlay Source',
            body: (
              <>
                <p>
                  Click the <strong>lock icon</strong> next to the WN95HL
                  Overlay in the Sources panel so it can't be accidentally
                  moved.
                </p>
              </>
            ),
          },
        ],
      },
      {
        id: 'regular-season-overlay',
        label: '📅 REGULAR SEASON OVERLAY',
        steps: [
          {
            num: '01',
            heading: 'What It Shows',
            body: (
              <>
                <p>
                  The regular season overlay displays live head-to-head matchup
                  info, standings, and player stats current matchup. It pulls
                  the live data from the WN95HL database when the button is
                  pushed after team selection.
                </p>

                <div className="guide-callout guide-callout-warning">
                  <div className="callout-title">⚠ IMPORTANT</div>

                  <div className="callout-body">
                    Copy & paste the desired URL below into your OBS/StreamLabs
                    browser source setting.
                  </div>
                </div>

                <div className="overlay-url-list">
                  <div className="overlay-url-row">
                    <span className="overlay-url-label">🎮 Default Theme</span>

                    <a
                      href="/overlay-matchup-default"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-link overlay-url-link"
                    >
                      wn95-online.vercel.app/overlay-matchup-default
                    </a>
                  </div>

                  <div className="overlay-url-row">
                    <span className="overlay-url-label">❄️ Icey Theme</span>

                    <a
                      href="/overlay-matchup-icey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-link overlay-url-link"
                    >
                      wn95-online.vercel.app/overlay-matchup-icey
                    </a>
                  </div>

                  <div className="overlay-url-row">
                    <span className="overlay-url-label">
                      📊 Standings & Leaders
                    </span>

                    <a
                      href="/overlay-standings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-link overlay-url-link"
                    >
                      wn95-online.vercel.app/overlay-standings
                    </a>
                  </div>
                </div>
              </>
            ),
          },
          {
            num: '02',
            heading: 'Configuring Before Each Game',
            body: (
              <>
                <p>
                  Once your scene is set up, configuring the overlay before each
                  game takes about 10 seconds:
                </p>
                <ul className="guide-list">
                  <li>Switch to your WN95HL Game scene in OBS/Streamlabs</li>
                  <li>
                    Click on the Browser Source to give it focus, then press{' '}
                    <strong>~</strong> (tilde key, top-left of keyboard) to open
                    the setup panel
                  </li>
                  <li>
                    Select <strong>Screen Ratio</strong>, <strong>Team A</strong> and <strong>Team B</strong>{' '}
                    from the dropdowns
      
                  </li>
                  <li>
                    Click <strong>APPLY</strong>
                  </li>
                  <li>
                    Press <strong>~</strong> again to close the panel
                  </li>
                </ul>
                <p>
                  <i>
                    To change the teams/matchup going forward, simply right
                    click on the browser source, select Interact, and push '~'
                    to display the team selection panel again.
                  </i>
                </p>
              </>
            ),
          },
        ],
      },
      {
        id: 'playoff-overlay',
        label: '🏆 PLAYOFF OVERLAY',
        steps: [
          {
            num: '01',
            heading: 'What It Shows',
            body: (
              <>
                <p>
                  The playoff overlay shows the series score, win dots,
                  seedings, skater stats, team series stats, and a scrolling
                  ticker with game-by-game scores, team stats, and head-to-head
                  history.
                </p>
            
                <div className="guide-callout guide-callout-warning">
                  <div className="callout-title">⚠ IMPORTANT</div>
                  <div className="callout-body">
                    Copy & paste the URL below into your OBS/StreamLabs browser
                    source setting.
                  </div>
                </div>
            
                <div className="guide-callout guide-callout-info" style={{ marginTop: '10px' }}>
                  <div className="callout-title">📺 PLAYING IN 4:3?</div>
                  <div className="callout-body">
                    If your screen ratio is <strong>4:3</strong>, use the dedicated 4:3 version of the overlay instead — it's
                    optimized for that aspect ratio and will fit your stream properly.
                    The default URL below is for <strong>16:9</strong>.
                  </div>
                </div>
            
                <div className="overlay-url-list" style={{ marginTop: '14px' }}>
                  <div className="overlay-url-row">
                    <span className="overlay-url-label">🖥️ 16:9 (Default)</span>
                    <a
                      href="/overlay-playoff"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-link overlay-url-link"
                    >
                      wn95-online.vercel.app/overlay-playoff
                    </a>
                  </div>
                  <div className="overlay-url-row">
                    <span className="overlay-url-label">📺 4:3</span>
                    <a
                      href="/overlay-playoff-43"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="guide-link overlay-url-link"
                    >
                      wn95-online.vercel.app/overlay-playoff-43
                    </a>
                  </div>
                </div>
              </>
            ),
          },
          {
            num: '02',
            heading: 'Configuring Before Each Game',
            body: (
              <>
                <p>
                  <i>Same process as the regular season overlay:</i>
                </p>
                <ul className="guide-list">
                  <li>Switch to your WN95HL Game scene</li>
                  <li>
                    Press <strong>~</strong> to open the setup panel
                  </li>
                  <li>Select the two teams in the series</li>
                  <li>
                    Click <strong>APPLY</strong>
                  </li>
                </ul>

                <div className="guide-callout guide-callout-warning">
                  <div className="callout-title">⚠ IMPORTANT</div>

                  <div className="callout-body">
                    The team selection panel is only required at the beginning
                    of the series. <br></br>The playoff overlay automatically
                    refreshes (within 30 seconds) all the screen elements when a
                    new state is posted.
                  </div>
                </div>
              </>
            ),
          },
          {
            num: '03',
            heading: 'Ticker Sections',
            body: (
              <>
                <p>
                  The scrolling ticker at the bottom of the playoff overlay has
                  three sections that cycle continuously:
                </p>
                <ul className="guide-list">
                  <li>
                    <strong>PLAYOFF SERIES</strong> — scores and team stats for
                    each completed game in the series (appears once Game 2 is
                    complete)
                  </li>
                  <li>
                    <strong>SEASON H2H</strong> — the two teams' regular season
                    record against each other, individual game scores, and
                    aggregate stats
                  </li>
                  <li>
                    <strong>ALL TIME H2H</strong> — all-time head-to-head record
                    and career stats between the two teams
                  </li>
                </ul>
              </>
            ),
          },
        ],
      },
      {
        id: 'overlay-tips',
        label: '💡 TIPS & TROUBLESHOOTING',
        steps: [
          {
            num: '01',
            heading: 'Overlay Not Loading?',
            body: (
              <>
                <p>
                  Right-click the Browser Source in OBS/Streamlabs and choose{' '}
                  <strong>Refresh</strong>. If it still doesn't load, make sure
                  you have an active internet connection and that the URL is
                  entered correctly with no extra spaces.
                </p>
              </>
            ),
          },
          {
            num: '02',
            heading: "Setup Panel Won't Open",
            body: (
              <>
                <p>
                  The <strong>~</strong> key only works when the browser source
                  has focus. Click directly on the overlay preview in
                  OBS/Streamlabs first, then press <strong>~</strong>. In OBS
                  you may need to click <strong>"Interact"</strong> (right-click
                  the source) to give the browser source keyboard focus.
                </p>
              </>
            ),
          },
          {
            num: '03',
            heading: 'Game Capture Not Fitting Right',
            body: (
              <>
                <p>
                  The game window goes in the open center rectangle between the
                  two side panels, below the top bar and series info, above the
                  ticker. Drag the corners of the Game Capture source until it
                  fills that area cleanly. The overlay side panels will sit on
                  top of it automatically since they're on a higher layer.
                </p>
              </>
            ),
          },
          {
            num: '04',
            heading: 'Still Stuck?',
            body: (
              <>
                Post in <span className="channel-tag">#help</span> on Discord
                with a screenshot of your OBS/Streamlabs scene and someone will
                get you sorted quickly.
              </>
            ),
          },
        ],
      },
    ],
  },
  leagues: {
    title: 'OTHER LEAGUES',
    subtitle: 'More WN95 communities to explore',
    leagues: [
      {
        code: 'W LEAGUE',
        description:
          'Description coming soon — check back for details on the W League format, schedule, and how to join.',
        discord: 'https://discord.gg/xHKErSWN',
        color: '#87CEEB',
      },
    ],
  },
};

export default function GettingStarted() {
  const [activeSection, setActiveSection] = useState('overview');

  const current = stepData[activeSection];

  return (
    <div className="gs-page">
      {/* ── PAGE HEADER ── */}
      <div className="gs-header">
        <div className="gs-header-inner">
          <h1 className="gs-title">GETTING STARTED</h1>
          <p className="gs-subtitle">
            Everything you need play NHL 95, join the league and play your first
            game.
          </p>
        </div>
      </div>

      {/* ── SECTION TABS ── */}
      <div className="gs-tabs-wrap">
        <div className="gs-tabs">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`gs-tab ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
              style={{ '--tab-color': s.color }}
            >
              <span className="tab-icon">{s.icon}</span>
              <span className="tab-label">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="gs-content">
        <div className="gs-section-header">
          <h2 className="gs-section-title">{current.title}</h2>
          <p className="gs-section-subtitle">{current.subtitle}</p>
        </div>

        {/* ── PAGE DESCRIPTION ── */}
        {current.description && (
          <p className="gs-description">{current.description}</p>
        )}

        {/* ONLY SHOW FOR STREAM OVERLAYS */}
        {activeSection === 'overlays' && (
          <div className="guide-callout-orange">
            <div className="callout-title">🟧 SETUP NOTES</div>
            <div className="callout-body">
              • Setup is one-time only for OBS/Streamlabs
              <br />
              • Begin with the OBS/StreamLabs one-time setup, however the URL
              (found in later step) is required to complete the setup.
              <br />• Monitor and screen sizes vary, so resizing of the game
              capture screen and overlay may be required (also one-time task)
            </div>
          </div>
        )}

        {/* Steps layout */}
        {current.steps && (
          <div className="gs-steps">
            {current.steps.map((step) => (
              <div className="gs-step" key={step.num + step.heading}>
                <div className="step-num">{step.num}</div>
                <div className="step-body">
                  <h3 className="step-heading">{step.heading}</h3>
                  <div className="step-text">{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sections layout  */}
        {current.sections && (
          <div className="gs-sections">
            {current.sections.map((section) => (
              <div className="gs-subsection" key={section.id}>
                <div className="gs-subsection-header">
                  <span className="gs-subsection-label">{section.label}</span>
                </div>
                <div className="gs-steps">
                  {section.steps.map((step) => (
                    <div className="gs-step" key={step.num + step.heading}>
                      <div className="step-num">{step.num}</div>
                      <div className="step-body">
                        <h3 className="step-heading">{step.heading}</h3>
                        <div className="step-text">{step.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leagues layout */}
        {current.leagues && (
          <div className="gs-leagues">
            {current.leagues.map((league) => (
              <div
                className="league-card"
                key={league.code}
                style={{ '--lc-color': league.color }}
              >
                <div className="lc-header">
                  <div className="lc-code">{league.code}</div>
                  <a
                    href={league.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lc-discord-btn"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="lc-discord-icon"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.01.043.027.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    JOIN DISCORD
                  </a>
                </div>
                <p className="lc-description">{league.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Help callout */}
        <div className="gs-help-callout">
          <span className="help-icon">💬</span>
          <div className="help-text">
            <strong>Need help?</strong> The{' '}
            <span className="channel-tag">#help</span> channel on our Discord is
            the fastest way to get unstuck. Experienced players check it
            regularly.
          </div>
          <a
            href="https://discord.gg/QxRDBgz3"
            target="_blank"
            rel="noopener noreferrer"
            className="help-discord-btn"
          >
            OPEN DISCORD →
          </a>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Barlow+Condensed:wght@400;600;700&display=swap');

        .gs-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #0d0d1a 0%, #07070f 100%);
          color: #e8e8f0;
          font-family: 'Barlow Condensed', sans-serif;
        }

        /* ── HEADER ── */
        .gs-header {
          background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
          border-bottom: 3px solid #FF8C00;
          box-shadow: 0 4px 30px rgba(255,140,0,0.3);
          padding: 3.5rem 0 2.5rem;
        }

        .gs-header-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .gs-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(1.4rem, 3vw, 2.2rem);
          color: #FFD700;
          letter-spacing: 4px;
          margin: 0 0 1rem 0;
          text-shadow: 0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,140,0,0.2);
        }

        .gs-subtitle {
          font-size: 1.25rem;
          color: #87CEEB;
          font-weight: 400;
          letter-spacing: 1px;
          margin: 0;
          opacity: 0.85;
        }

        /* ── TABS ── */
        .gs-tabs-wrap {
          background: #0a0a18;
          border-bottom: 1px solid rgba(255,140,0,0.2);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .gs-tabs-wrap::-webkit-scrollbar { display: none; }

        .gs-tabs {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          gap: 0;
        }

        .gs-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.4rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          color: rgba(135,206,235,0.5);
          letter-spacing: 1.5px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .gs-tab:hover {
          color: var(--tab-color, #87CEEB);
          background: rgba(135,206,235,0.05);
        }

        .gs-tab.active {
          color: var(--tab-color, #87CEEB);
          border-bottom-color: var(--tab-color, #87CEEB);
          background: rgba(135,206,235,0.06);
          text-shadow: 0 0 12px var(--tab-color, #87CEEB);
        }

        .tab-icon { font-size: 1rem; }

        /* ── CONTENT ── */
        .gs-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 3rem 2rem 4rem;
        }

        .gs-section-header {
          margin-bottom: 2.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255,140,0,0.15);
        }

        .gs-section-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(0.85rem, 2vw, 1.1rem);
          color: #FFD700;
          letter-spacing: 3px;
          margin: 0 0 0.75rem 0;
          text-shadow: 0 0 15px rgba(255,215,0,0.3);
        }

        .gs-section-subtitle {
          font-size: 1.1rem;
          color: #87CEEB;
          opacity: 0.75;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .gs-description {
          font-size: 1.1rem;
          line-height: 1.75;
          color: #a0a0bc;
          margin: 0 0 2.5rem 0;
          letter-spacing: 0.3px;
          font-style: italic;
        }

        .gs-subsection {
          margin-bottom: 3rem;
        }
        
        .gs-subsection-header {
          margin-bottom: 1.5rem;
          padding: 0.75rem 1.25rem;
          background: rgba(135, 206, 235, 0.06);
          border-left: 3px solid #87CEEB;
          border-radius: 0 6px 6px 0;
        }

        /* Gold accent for overlay subsections */
        .gs-subsection:nth-child(n+3) .gs-subsection-header {
          background: rgba(255, 215, 0, 0.05);
          border-left-color: #FFD700;
        }
        .gs-subsection:nth-child(n+3) .gs-subsection-label {
          color: #FFD700;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
        }
        
        .gs-subsection-label {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.6rem;
          color: #87CEEB;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(135, 206, 235, 0.5);
        }

        .guide-screenshot {
          display: block;
          width: 100%;
          max-width: 700px;
          border: 1px solid rgba(135, 206, 235, 0.2);
          border-radius: 6px;
          margin: 1rem 0;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }

        .guide-callout {
          margin-top: 14px;
          padding: 14px 16px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
        }
        
        .guide-callout-warning {
          background: rgba(255, 193, 7, 0.08);
          border: 1px solid rgba(255, 193, 7, 0.35);
          border-left: 4px solid #FFD700;
          color: #EEF2F8;
        }

        .guide-callout-info {
          background: rgba(135, 206, 235, 0.06);
          border: 1px solid rgba(135, 206, 235, 0.25);
          border-left: 4px solid #87CEEB;
          color: #EEF2F8;
        }
        .guide-callout-info .callout-title {
          color: #87CEEB;
        }
        
        .callout-title {
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #FFD700;
        }
        
        .callout-body {
          color: #EEF2F8;
          opacity: 0.95;
        }

        .guide-callout-orange {
          margin-top: 14px;
          margin-bottom: 50px;
          padding: 14px 16px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(255, 140, 0, 0.08);
          border: 1px solid rgba(255, 140, 0, 0.35);
          border-left: 4px solid #FF8C00;
          color: #EEF2F8;
          box-shadow: 0 0 18px rgba(255, 140, 0, 0.08);
        }

        /* ── GUIDE LIST ── */
        .guide-list {
          margin: 0.75rem 0 0.75rem 1.25rem;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .guide-list li {
          font-size: 1.05rem;
          line-height: 1.65;
          color: #c8c8dc;
          letter-spacing: 0.3px;
        }
        .guide-list li strong {
          color: #FFD700;
          font-weight: 700;
        }

        /* ── STEPS ── */
        .gs-steps {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .gs-step {
          display: flex;
          gap: 2rem;
          padding: 2rem 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          position: relative;
        }

        .gs-step::before {
          content: '';
          position: absolute;
          left: 2.6rem;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, rgba(135,206,235,0.0), rgba(135,206,235,0.15), rgba(135,206,235,0.0));
        }

        .step-num {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.4rem;
          color: rgba(135,206,235,0.2);
          min-width: 3.2rem;
          padding-top: 0.2rem;
          flex-shrink: 0;
          line-height: 1;
          letter-spacing: -1px;
        }

        .step-body {
          flex: 1;
        }

        .step-heading {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.65rem;
          color: #87CEEB;
          letter-spacing: 2px;
          margin: 0 0 0.9rem 0;
        }

        .step-text {
          font-size: 1.05rem;
          line-height: 1.75;
          color: #c8c8dc;
          margin: 0;
          font-weight: 400;
          letter-spacing: 0.3px;
        }

        .step-text p { margin: 0 0 0.6rem 0; }
        .step-text p:last-child { margin-bottom: 0; }

        /* ── LEAGUES ── */
        .gs-leagues {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .league-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          border-top: 3px solid var(--lc-color, #87CEEB);
          border-radius: 10px;
          padding: 1.75rem;
          transition: all 0.25s ease;
        }

        .league-card:hover {
          border-color: var(--lc-color, #87CEEB);
          box-shadow: 0 0 24px rgba(135,206,235,0.1);
          transform: translateY(-2px);
        }

        .lc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }

        .lc-code {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.7rem;
          color: var(--lc-color, #87CEEB);
          letter-spacing: 2px;
          text-shadow: 0 0 10px var(--lc-color, #87CEEB);
        }

        .lc-discord-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.9rem;
          background: rgba(88,101,242,0.12);
          border: 1px solid rgba(114,137,218,0.4);
          border-radius: 6px;
          color: rgba(114,137,218,0.9);
          font-family: 'Press Start 2P', monospace;
          font-size: 0.42rem;
          letter-spacing: 1px;
          text-decoration: none;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .lc-discord-btn:hover {
          background: rgba(88,101,242,0.28);
          border-color: rgba(114,137,218,0.8);
          color: #fff;
          box-shadow: 0 0 12px rgba(88,101,242,0.4);
        }

        .lc-discord-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .lc-description {
          font-size: 1rem;
          line-height: 1.7;
          color: #a0a0bc;
          margin: 0;
          font-style: italic;
        }

        /* URL LIST */
        .overlay-url-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }
        
        .overlay-url-row {
          display: grid;
          grid-template-columns: 220px 1fr;
          align-items: center;
          gap: 14px;
        }
        
        .overlay-url-label {
          font-weight: 700;
          color: #EEF2F8;
          letter-spacing: 0.03em;
        }
        
        .overlay-url-link {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 1.05rem;
          white-space: nowrap;
        }

        /* ── HELP CALLOUT ── */
        .gs-help-callout {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          margin-top: 3rem;
          padding: 1.5rem 1.75rem;
          background: rgba(255,140,0,0.05);
          border: 1px solid rgba(255,140,0,0.25);
          border-left: 4px solid #FF8C00;
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .help-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .help-text {
          flex: 1;
          font-size: 1rem;
          line-height: 1.6;
          color: #c8c8dc;
          min-width: 200px;
        }

        .help-text strong {
          color: #FF8C00;
          font-weight: 700;
        }

        .help-discord-btn {
          display: inline-block;
          padding: 0.6rem 1.25rem;
          background: rgba(88,101,242,0.15);
          border: 1px solid rgba(114,137,218,0.5);
          border-radius: 6px;
          color: rgba(114,137,218,0.9);
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          letter-spacing: 1px;
          text-decoration: none;
          transition: all 0.2s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .help-discord-btn:hover {
          background: rgba(88,101,242,0.3);
          border-color: rgba(114,137,218,0.9);
          color: #fff;
          box-shadow: 0 0 16px rgba(88,101,242,0.4);
        }

        /* ── INLINE HELPERS ── */
        .guide-link {
          color: #87CEEB;
          text-decoration: none;
          border-bottom: 1px solid rgba(135,206,235,0.35);
          transition: all 0.2s ease;
          padding-bottom: 1px;
        }

        .guide-link:hover {
          color: #FFD700;
          border-bottom-color: #FFD700;
          text-shadow: 0 0 8px rgba(255,215,0,0.4);
        }

        .channel-tag {
          display: inline-block;
          padding: 0.1em 0.5em;
          background: rgba(135,206,235,0.1);
          border: 1px solid rgba(135,206,235,0.25);
          border-radius: 4px;
          color: #87CEEB;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.55em;
          letter-spacing: 1px;
          vertical-align: middle;
        }

        .placeholder-badge {
          display: inline-block;
          padding: 0.15em 0.7em;
          background: rgba(255,140,0,0.1);
          border: 1px dashed rgba(255,140,0,0.4);
          border-radius: 4px;
          color: #FF8C00;
          font-size: 0.85em;
          letter-spacing: 0.5px;
          font-style: normal;
        }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .gs-header { padding: 2rem 0 1.5rem; }
          .gs-title { font-size: 1rem; }
          .gs-content { padding: 2rem 1rem 3rem; }
          .gs-step { gap: 1rem; }
          .step-num { font-size: 1rem; min-width: 2.2rem; }
          .gs-tabs { padding: 0 0.75rem; }
          .gs-tab { padding: 0.85rem 0.85rem; }
          .tab-label { display: none; }
          .tab-icon { font-size: 1.2rem; }
          .gs-help-callout { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
