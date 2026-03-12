<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SOUNDWAVE — Music Player</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <!-- SC Widget API must load synchronously before any SC.Widget() calls -->
  <script src="https://w.soundcloud.com/player/api.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0a0a0f;
      --surface: #13131a;
      --card: #1c1c28;
      --accent: #ff4f1f;
      --accent2: #ffb347;
      --text: #f0eee8;
      --muted: #6b6880;
      --glow: rgba(255,79,31,0.35);
    }

    html, body {
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: 'Space Mono', monospace;
      overflow-x: hidden;
    }

    /* Animated grain overlay */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 9999;
      opacity: 0.4;
    }

    /* Background accent blob */
    .bg-blob {
      position: fixed;
      width: 600px; height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,79,31,0.12) 0%, transparent 70%);
      top: -100px; right: -150px;
      pointer-events: none;
      animation: pulse 6s ease-in-out infinite alternate;
    }
    .bg-blob2 {
      position: fixed;
      width: 400px; height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,179,71,0.08) 0%, transparent 70%);
      bottom: -80px; left: -100px;
      pointer-events: none;
      animation: pulse 8s 2s ease-in-out infinite alternate;
    }
    @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.15); } }

    /* Layout */
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      max-width: 1100px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* Header */
    header {
      padding: 32px 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .logo {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 1.4rem;
      letter-spacing: 0.12em;
      color: var(--text);
    }
    .logo span { color: var(--accent); }
    .live-badge {
      background: var(--accent);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.15em;
      padding: 4px 10px;
      border-radius: 2px;
    }

    /* Main content */
    main {
      padding: 40px 0;
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 32px;
      align-items: start;
    }

    /* Embed section */
    .embed-area { display: flex; flex-direction: column; gap: 20px; }

    .now-playing-label {
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      color: var(--muted);
      text-transform: uppercase;
    }

    .track-title {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: clamp(1.5rem, 3vw, 2.4rem);
      line-height: 1.1;
      color: var(--text);
      min-height: 2.4em;
      transition: all 0.4s ease;
    }
    .track-title .artist { color: var(--accent); font-size: 0.6em; display: block; margin-top: 4px; font-weight: 400; }

    .sc-wrapper {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: var(--surface);
      border: 1px solid rgba(255,255,255,0.07);
    }
    .sc-wrapper iframe {
      display: block;
      width: 100%;
      border: none;
    }
    /* Hide SoundCloud iframe visually but keep it for API */
  .sc-iframe-hidden {
    position: fixed;
    left: -9999px;
    top: 0;
    width: 300px;
    height: 166px;
    border: none;
    visibility: hidden;
  }

    /* Custom Control Panel */
    .control-panel {
      background: var(--card);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 28px 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      position: sticky;
      top: 24px;
    }

    .panel-header {
      font-size: 0.6rem;
      letter-spacing: 0.25em;
      color: var(--muted);
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding-bottom: 14px;
    }

    /* Waveform visualizer (CSS-only bars) */
    .visualizer {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 48px;
      justify-content: center;
    }
    .bar {
      width: 4px;
      background: var(--accent);
      border-radius: 2px 2px 0 0;
      transition: height 0.15s ease;
      opacity: 0.7;
    }
    .playing .bar { animation: bounce var(--dur, 0.8s) ease-in-out infinite alternate; }
    @keyframes bounce { from { height: var(--min, 4px); } to { height: var(--max, 32px); } }

    /* Song info in panel */
    .panel-track { text-align: center; }
    .panel-track .title {
      font-family: 'Syne', sans-serif;
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .panel-track .artist-name {
      font-size: 0.72rem;
      color: var(--muted);
      margin-top: 4px;
    }

    /* Progress bar */
    .progress-section { display: flex; flex-direction: column; gap: 8px; }
    .progress-track {
      position: relative;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      cursor: pointer;
      overflow: visible;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      border-radius: 2px;
      width: 0%;
      transition: width 0.5s linear;
      position: relative;
    }
    .progress-fill::after {
      content: '';
      position: absolute;
      right: -5px; top: 50%;
      transform: translateY(-50%);
      width: 12px; height: 12px;
      background: var(--text);
      border-radius: 50%;
      box-shadow: 0 0 8px var(--glow);
      opacity: 0;
      transition: opacity 0.2s;
    }
    .progress-track:hover .progress-fill::after { opacity: 1; }
    .time-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.65rem;
      color: var(--muted);
    }

    /* Volume */
    .volume-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .vol-icon { font-size: 1rem; color: var(--muted); cursor: pointer; }
    .volume-slider {
      -webkit-appearance: none;
      flex: 1;
      height: 3px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: var(--accent2);
      cursor: pointer;
    }

    /* Transport controls */
    .controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }
    .btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: color 0.2s, transform 0.15s;
      font-size: 1.1rem;
      display: flex; align-items: center; justify-content: center;
    }
    .btn:hover { color: var(--text); transform: scale(1.1); }
    .btn.active { color: var(--accent); }

    .btn-play {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--accent);
      color: #fff !important;
      font-size: 1.4rem;
      box-shadow: 0 0 24px var(--glow);
      transition: transform 0.15s, box-shadow 0.2s;
    }
    .btn-play:hover { transform: scale(1.08); box-shadow: 0 0 36px var(--glow); }
    .btn-play:active { transform: scale(0.96); }

    /* Playlist */
    .playlist-section { display: flex; flex-direction: column; gap: 0; }
    .playlist-label {
      font-size: 0.6rem;
      letter-spacing: 0.2em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .playlist { display: flex; flex-direction: column; gap: 4px; }
    .track-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
      border: 1px solid transparent;
    }
    .track-item:hover { background: rgba(255,255,255,0.04); }
    .track-item.active {
      background: rgba(255,79,31,0.1);
      border-color: rgba(255,79,31,0.25);
    }
    .track-num {
      font-size: 0.65rem;
      color: var(--muted);
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }
    .track-item.active .track-num { color: var(--accent); }
    .track-info { flex: 1; overflow: hidden; }
    .track-info .t { font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track-info .a { font-size: 0.65rem; color: var(--muted); }
    .track-dur { font-size: 0.62rem; color: var(--muted); flex-shrink: 0; }

    /* Shuffle/repeat row */
    .extra-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .icon-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 4px 8px;
      border-radius: 4px;
      transition: color 0.2s;
      font-family: 'Space Mono', monospace;
      letter-spacing: 0.08em;
      font-size: 0.6rem;
    }
    .icon-btn:hover, .icon-btn.on { color: var(--accent2); }

    /* Footer */
    footer {
      padding: 20px 0;
      border-top: 1px solid rgba(255,255,255,0.06);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.62rem;
      color: var(--muted);
    }

    /* Responsive */
    @media (max-width: 720px) {
      main { grid-template-columns: 1fr; }
      .control-panel { position: static; }
    }

    /* ── URL Search Box ── */
    .search-bar {
      display: flex;
      align-items: center;
      gap: 0;
      background: var(--surface);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      max-width: 680px;
      margin: 18px auto 0;
    }
    .search-bar:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255,79,31,0.15);
    }
    .search-icon {
      padding: 0 14px;
      color: var(--muted);
      font-size: 1rem;
      flex-shrink: 0;
      user-select: none;
    }
    .search-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text);
      font-family: 'Space Mono', monospace;
      font-size: 0.78rem;
      padding: 13px 0;
      min-width: 0;
    }
    .search-input::placeholder { color: var(--muted); }
    .search-btn {
      background: var(--accent);
      border: none;
      color: #fff;
      font-family: 'Space Mono', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      font-weight: 700;
      padding: 0 18px;
      height: 100%;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
      flex-shrink: 0;
      min-height: 46px;
    }
    .search-btn:hover { background: #e8401a; }
    .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .search-hint {
      font-size: 0.6rem;
      color: var(--muted);
      text-align: center;
      margin-top: 7px;
      letter-spacing: 0.05em;
    }
    .search-hint a { color: var(--accent2); text-decoration: none; }

    .search-feedback {
      font-size: 0.68rem;
      text-align: center;
      margin-top: 6px;
      min-height: 1.2em;
      transition: color 0.3s;
    }
    .search-feedback.ok  { color: #66bb6a; }
    .search-feedback.err { color: #ef5350; }
    .search-feedback.loading { color: var(--muted); }

    /* Reload spinner */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { display: inline-block; animation: spin 0.7s linear infinite; }

    /* ── AI Search Box ── */
    .ai-search-wrap {
      padding: 12px 0 4px;
      border-top: 1px solid rgba(255,255,255,0.05);
      margin-top: 4px;
    }
    .ai-search-label-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .ai-label {
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      color: var(--muted);
      text-transform: uppercase;
    }
    .beta-badge {
      font-size: 0.55rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      background: linear-gradient(90deg, #7c3aed, #a855f7);
      color: #fff;
      padding: 2px 7px;
      border-radius: 20px;
      text-transform: uppercase;
    }
    .ai-model-tag {
      font-size: 0.55rem;
      color: var(--muted);
      margin-left: auto;
      opacity: 0.6;
    }
    .ai-search-bar {
      display: flex;
      align-items: center;
      gap: 0;
      background: var(--surface);
      border: 1px solid rgba(168,85,247,0.25);
      border-radius: 8px;
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
    }
    .ai-search-bar:focus-within {
      border-color: #a855f7;
      box-shadow: 0 0 0 3px rgba(168,85,247,0.15);
    }
    .ai-search-icon {
      padding: 0 14px;
      color: #a855f7;
      font-size: 1rem;
      flex-shrink: 0;
      user-select: none;
    }
    .ai-search-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--text);
      font-family: 'Space Mono', monospace;
      font-size: 0.78rem;
      padding: 13px 0;
      min-width: 0;
    }
    .ai-search-input::placeholder { color: var(--muted); }
    .ai-search-btn {
      background: linear-gradient(90deg, #7c3aed, #a855f7);
      border: none;
      color: #fff;
      font-family: 'Space Mono', monospace;
      font-size: 0.65rem;
      letter-spacing: 0.12em;
      font-weight: 700;
      padding: 0 18px;
      height: 100%;
      cursor: pointer;
      transition: opacity 0.2s;
      flex-shrink: 0;
      min-height: 46px;
    }
    .ai-search-btn:hover { opacity: 0.85; }
    .ai-search-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .ai-feedback {
      font-size: 0.68rem;
      text-align: center;
      margin-top: 7px;
      min-height: 1.2em;
      transition: color 0.3s;
      line-height: 1.5;
    }
    .ai-feedback.ok   { color: #66bb6a; }
    .ai-feedback.err  { color: #ef5350; }
    .ai-feedback.loading { color: #a855f7; }

    /* AI thinking animation */
    .ai-dots span {
      display: inline-block;
      animation: ai-blink 1.2s infinite;
      opacity: 0;
    }
    .ai-dots span:nth-child(2) { animation-delay: 0.2s; }
    .ai-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ai-blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }

    /* ── AI Results Panel ── */
    .ai-results {
      display: none;
      flex-direction: column;
      gap: 4px;
      margin-top: 10px;
      background: var(--card);
      border: 1px solid rgba(168,85,247,0.3);
      border-radius: 10px;
      overflow: hidden;
      animation: fadeSlideIn 0.25s ease;
    }
    .ai-results.show { display: flex; }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ai-results-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .ai-results-title {
      font-size: 0.58rem;
      letter-spacing: 0.18em;
      color: #a855f7;
      text-transform: uppercase;
    }
    .ai-results-close {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 4px;
      transition: color 0.2s;
    }
    .ai-results-close:hover { color: var(--text); }
    .ai-result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid rgba(255,255,255,0.03);
    }
    .ai-result-item:last-child { border-bottom: none; }
    .ai-result-item:hover { background: rgba(168,85,247,0.1); }
    .ai-result-num {
      font-size: 0.6rem;
      color: #a855f7;
      width: 18px;
      flex-shrink: 0;
      text-align: center;
      opacity: 0.7;
    }
    .ai-result-info { flex: 1; overflow: hidden; }
    .ai-result-info .t {
      font-size: 0.8rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ai-result-info .a {
      font-size: 0.65rem;
      color: var(--muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ai-result-play {
      font-size: 0.7rem;
      color: var(--muted);
      flex-shrink: 0;
      transition: color 0.15s, transform 0.15s;
    }
    .ai-result-item:hover .ai-result-play {
      color: #a855f7;
      transform: scale(1.2);
    }

    /* Loading state */
    .loading-msg {
      font-size: 0.75rem;
      color: var(--muted);
      text-align: center;
      padding: 8px;
      display: none;
    }
    .loading-msg.show { display: block; }

    /* Scrolling title animation */
    @keyframes marquee {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .marquee-wrap { overflow: hidden; }
    .marquee-inner { display: inline-block; white-space: nowrap; }
    .marquee-inner.scrolling { animation: marquee 12s linear infinite; }
  </style>
</head>
<body>

<div class="bg-blob"></div>
<div class="bg-blob2"></div>

<!-- Hidden SoundCloud iframe (SC Widget API requires an iframe) -->
<iframe id="sc-iframe"
  class="sc-iframe-hidden"
  src="about:blank"
  allow="autoplay">
</iframe>

<div class="app">
  <header>
    <div class="logo">SOUND<span>WAVE</span></div>
    <div style="display:flex;gap:12px;align-items:center;">
      <span id="conn-status" style="font-size:0.62rem;color:var(--muted);">connecting…</span>
      <div class="live-badge">SC PLAYER</div>
    </div>
  </header>

  <!-- URL Search -->
  <div style="padding: 20px 0 4px;">
    <div class="search-bar">
      <span class="search-icon">🔗</span>
      <input
        class="search-input"
        id="search-input"
        type="url"
        placeholder="Paste a SoundCloud track or playlist URL…"
        autocomplete="off"
        spellcheck="false"
      />
      <button class="search-btn" id="search-btn">LOAD</button>
    </div>
    <div class="search-hint">
      e.g. <a href="#" id="hint-example" tabindex="-1">soundcloud.com/artist/track-name</a>
      &nbsp;·&nbsp; tracks &amp; playlists supported
    </div>
    <div class="search-feedback" id="search-feedback"></div>
  </div>

  <!-- AI Search -->
  <div class="ai-search-wrap">
    <div class="ai-search-label-row">
      <span class="ai-label">AI Song Search</span>
      <span class="beta-badge">beta</span>
      <span class="ai-model-tag">llama-3.1-8b · Workers AI</span>
    </div>
    <div class="ai-search-bar">
      <span class="ai-search-icon">✦</span>
      <input
        class="ai-search-input"
        id="ai-search-input"
        type="text"
        placeholder="Type a song name, artist, or describe a track…"
        autocomplete="off"
        spellcheck="false"
      />
      <button class="ai-search-btn" id="ai-search-btn">ASK AI</button>
    </div>
    <div class="ai-feedback" id="ai-feedback"></div>

    <!-- AI Results Panel -->
    <div class="ai-results" id="ai-results">
      <div class="ai-results-header">
        <span class="ai-results-title">✦ AI Results — Click to load</span>
        <button class="ai-results-close" id="ai-results-close" title="Close">✕</button>
      </div>
      <div id="ai-results-list"></div>
    </div>
  </div>

  <main>
    <!-- Left: now playing display -->
    <div class="embed-area">
      <div class="now-playing-label">Now Playing</div>
      <div class="track-title" id="main-title">
        Loading…
        <span class="artist" id="main-artist"></span>
      </div>

      <!-- Visual waveform art (decorative) -->
      <div style="display:flex;gap:2px;height:80px;align-items:flex-end;margin:8px 0;" id="bigvis">
        <!-- generated by JS -->
      </div>

      <!-- Playlist that doubles as track list -->
      <div style="margin-top:8px;">
        <div style="font-size:0.6rem;letter-spacing:0.2em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">Tracklist</div>
        <div id="big-playlist" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
    </div>

    <!-- Right: control panel -->
    <div class="control-panel">
      <div class="panel-header">Control Panel</div>

      <!-- Visualizer -->
      <div class="visualizer" id="visualizer">
        <!-- bars injected by JS -->
      </div>

      <!-- Track info -->
      <div class="panel-track">
        <div class="marquee-wrap">
          <div class="marquee-inner" id="panel-title">—</div>
        </div>
        <div class="artist-name" id="panel-artist">—</div>
      </div>

      <!-- Progress -->
      <div class="progress-section">
        <div class="progress-track" id="progress-track">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <div class="time-row">
          <span id="time-current">0:00</span>
          <span id="time-total">0:00</span>
        </div>
      </div>

      <!-- Volume -->
      <div class="volume-row">
        <span class="vol-icon" id="vol-icon" title="Toggle mute">🔊</span>
        <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="80">
      </div>

      <!-- Transport -->
      <div class="controls">
        <button class="btn" id="btn-prev" title="Previous">⏮</button>
        <button class="btn btn-play" id="btn-play" title="Play / Pause">▶</button>
        <button class="btn" id="btn-next" title="Next">⏭</button>
      </div>

      <!-- Extra controls -->
      <div class="extra-controls">
        <button class="icon-btn" id="btn-shuffle">⇄ SHUFFLE</button>
        <button class="icon-btn" id="btn-repeat">↺ REPEAT</button>
      </div>

      <!-- Playlist -->
      <div class="playlist-section">
        <div class="playlist-label">Queue</div>
        <div class="playlist" id="playlist"></div>
      </div>

      <div class="loading-msg" id="loading-msg">Loading track data…</div>
    </div>
  </main>

  <footer>
    <span>SOUNDWAVE PLAYER</span>
    <span>Powered by SoundCloud Widget API</span>
  </footer>
</div>

<script>
// ─── State ───────────────────────────────────────────────────────────────────
const state = {
  playing: false,
  shuffle: false,
  repeat: false,
  muted: false,
  currentIndex: 0,
  duration: 0,
  position: 0,
  volume: 80,
  tracks: [],
  totalTracks: 0,
};

// ─── SC Widget ───────────────────────────────────────────────────────────────
const iframe = document.getElementById('sc-iframe');
let widget = null;

function initWidget() {
  if (typeof SC === 'undefined') {
    setTimeout(initWidget, 100);
    return;
  }
  // Don't init widget yet — wait until user loads a real URL
  document.getElementById('conn-status').textContent = 'paste a URL';
  document.getElementById('main-title').childNodes[0].nodeValue = 'Welcome\n';
  document.getElementById('main-artist').textContent = '';
  document.getElementById('panel-title').textContent = 'Paste a URL to begin';
  document.getElementById('panel-artist').textContent = '';
  buildVisualizer();
  buildBigVis();
}

document.addEventListener('DOMContentLoaded', initWidget);

function onReady() {
  document.getElementById('conn-status').textContent = 'ready';
  document.getElementById('conn-status').style.color = '#66bb6a';
  widget.setVolume(state.volume);
  widget.getSounds(sounds => {
    if (!sounds || sounds.length === 0) {
      // No tracks loaded yet — show welcome state
      document.getElementById('main-title').childNodes[0].nodeValue = 'Welcome\n';
      document.getElementById('main-artist').textContent = '';
      document.getElementById('panel-title').textContent = 'Paste a URL to begin';
      document.getElementById('panel-artist').textContent = '';
      document.getElementById('loading-msg').classList.remove('show');
      return;
    }
    state.tracks = sounds;
    state.totalTracks = sounds.length;
    renderPlaylist();
    renderBigPlaylist();
    updateTrackDisplay();
    document.getElementById('loading-msg').classList.remove('show');
  });
}

function loadCurrentTrack() {
  widget.skip(state.currentIndex);
  updateTrackDisplay();
}

function updateTrackDisplay() {
  widget.getCurrentSound(sound => {
    if (!sound) return;
    const title = sound.title || 'Unknown Track';
    const artist = sound.user ? sound.user.username : '';

    document.getElementById('main-title').childNodes[0].nodeValue = title + '\n';
    document.getElementById('main-artist').textContent = artist;

    const panelTitleEl = document.getElementById('panel-title');
    panelTitleEl.textContent = title;
    document.getElementById('panel-artist').textContent = artist;

    // Marquee if long
    if (title.length > 22) {
      panelTitleEl.textContent = title + '   ' + title;
      panelTitleEl.classList.add('scrolling');
    } else {
      panelTitleEl.classList.remove('scrolling');
    }

    document.title = `♪ ${title} — SOUNDWAVE`;
    highlightActive();
  });

  widget.getDuration(dur => {
    state.duration = dur;
    document.getElementById('time-total').textContent = msToTime(dur);
  });
}

function onPlay() {
  state.playing = true;
  document.getElementById('btn-play').textContent = '⏸';
  document.getElementById('visualizer').classList.add('playing');
  updateTrackDisplay();
}

function onPause() {
  state.playing = false;
  document.getElementById('btn-play').textContent = '▶';
  document.getElementById('visualizer').classList.remove('playing');
}

function onProgress(e) {
  state.position = e.currentPosition;
  const pct = state.duration > 0 ? (state.position / state.duration) * 100 : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('time-current').textContent = msToTime(state.position);

  // Get current index
  widget.getCurrentSoundIndex(idx => {
    if (idx !== state.currentIndex) {
      state.currentIndex = idx;
      highlightActive();
    }
  });
}

function onFinish() {
  if (state.totalTracks === 0) return;
  if (state.repeat) {
    widget.seekTo(0);
    widget.play();
    return;
  }
  if (state.shuffle) {
    state.currentIndex = Math.floor(Math.random() * state.totalTracks);
  } else {
    state.currentIndex = (state.currentIndex + 1) % state.totalTracks;
  }
  widget.skip(state.currentIndex);
  widget.play();
}

function onError(e) {
  console.warn('SC Widget error (possibly invalid/private URL)', e);
  document.getElementById('conn-status').textContent = 'error';
  document.getElementById('conn-status').style.color = '#ef5350';
  document.getElementById('main-title').childNodes[0].nodeValue = 'Load Failed\n';
  document.getElementById('main-artist').textContent = 'Check the URL or try another track';
  document.getElementById('panel-title').textContent = 'Load failed';
  document.getElementById('panel-artist').textContent = '';
  document.getElementById('btn-play').textContent = '▶';
  document.getElementById('visualizer').classList.remove('playing');
  state.playing = false;
  state.tracks = [];
  state.totalTracks = 0;
}

// ─── Controls ────────────────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => {
  if (!widget) return;
  widget.isPaused(paused => {
    if (paused) { widget.play(); } else { widget.pause(); }
  });
});

document.getElementById('btn-prev').addEventListener('click', () => {
  if (!widget || state.totalTracks === 0) return;
  if (state.position > 2000) {
    widget.seekTo(0);
  } else {
    state.currentIndex = (state.currentIndex - 1 + state.totalTracks) % state.totalTracks;
    widget.skip(state.currentIndex);
  }
  updateTrackDisplay();
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (!widget || state.totalTracks === 0) return;
  if (state.shuffle) {
    state.currentIndex = Math.floor(Math.random() * state.totalTracks);
  } else {
    state.currentIndex = (state.currentIndex + 1) % state.totalTracks;
  }
  widget.skip(state.currentIndex);
  updateTrackDisplay();
});

// Progress seek
document.getElementById('progress-track').addEventListener('click', (e) => {
  if (!widget || !state.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  widget.seekTo(pct * state.duration);
});

// Volume
document.getElementById('volume-slider').addEventListener('input', (e) => {
  state.volume = parseInt(e.target.value);
  if (widget) widget.setVolume(state.volume);
  state.muted = state.volume === 0;
  updateVolIcon();
});

document.getElementById('vol-icon').addEventListener('click', () => {
  state.muted = !state.muted;
  if (widget) widget.setVolume(state.muted ? 0 : state.volume);
  document.getElementById('volume-slider').value = state.muted ? 0 : state.volume;
  updateVolIcon();
});

function updateVolIcon() {
  const v = state.muted ? 0 : state.volume;
  document.getElementById('vol-icon').textContent = v === 0 ? '🔇' : v < 40 ? '🔉' : '🔊';
}

// Shuffle / Repeat
document.getElementById('btn-shuffle').addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  document.getElementById('btn-shuffle').classList.toggle('on', state.shuffle);
});

document.getElementById('btn-repeat').addEventListener('click', () => {
  state.repeat = !state.repeat;
  document.getElementById('btn-repeat').classList.toggle('on', state.repeat);
});

// ─── URL Loader ──────────────────────────────────────────────────────────────
function isSoundCloudUrl(url) {
  try {
    const u = new URL(url.trim());
    return u.hostname === 'soundcloud.com' || u.hostname === 'www.soundcloud.com' ||
           u.hostname === 'm.soundcloud.com' || u.hostname === 'on.soundcloud.com';
  } catch { return false; }
}

function setFeedback(msg, type) {
  const el = document.getElementById('search-feedback');
  el.textContent = msg;
  el.className = 'search-feedback' + (type ? ' ' + type : '');
}

function loadFromUrl(rawUrl) {
  const url = rawUrl.trim();
  if (!url) { setFeedback('Please paste a SoundCloud URL.', 'err'); return; }
  if (!isSoundCloudUrl(url)) { setFeedback('⚠ That doesn\'t look like a SoundCloud URL.', 'err'); return; }

  setFeedback('<span class="spin">⟳</span> Loading…', 'loading');
  document.getElementById('search-btn').disabled = true;

  // Reset state
  state.playing = false;
  state.currentIndex = 0;
  state.duration = 0;
  state.position = 0;
  state.tracks = [];
  state.totalTracks = 0;
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('time-current').textContent = '0:00';
  document.getElementById('time-total').textContent = '0:00';
  document.getElementById('btn-play').textContent = '▶';
  document.getElementById('visualizer').classList.remove('playing');
  document.getElementById('playlist').innerHTML = '';
  document.getElementById('big-playlist').innerHTML = '';
  document.getElementById('panel-title').textContent = '—';
  document.getElementById('panel-artist').textContent = '—';
  document.getElementById('main-title').childNodes[0].nodeValue = 'Loading…\n';
  document.getElementById('main-artist').textContent = '';
  document.getElementById('conn-status').textContent = 'loading…';
  document.getElementById('conn-status').style.color = 'var(--muted)';

  // Unbind old widget events to avoid ghost callbacks
  if (widget) {
    try {
      widget.unbind(SC.Widget.Events.READY);
      widget.unbind(SC.Widget.Events.PLAY);
      widget.unbind(SC.Widget.Events.PAUSE);
      widget.unbind(SC.Widget.Events.PLAY_PROGRESS);
      widget.unbind(SC.Widget.Events.FINISH);
      widget.unbind(SC.Widget.Events.ERROR);
    } catch(e) {}
    widget = null;
  }

  // Build new widget iframe src
  const encoded = encodeURIComponent(url);
  const newSrc = `https://w.soundcloud.com/player/?url=${encoded}&color=%23ff4f1f&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;

  // Replace iframe entirely (reassigning src alone sometimes doesn't re-trigger READY)
  const oldIframe = document.getElementById('sc-iframe');
  const newIframe = document.createElement('iframe');
  newIframe.id = 'sc-iframe';
  newIframe.className = 'sc-iframe-hidden';
  newIframe.allow = 'autoplay';
  newIframe.src = newSrc;
  oldIframe.replaceWith(newIframe);

  // Re-init widget after a short delay so iframe DOM is ready
  setTimeout(() => {
    widget = SC.Widget(document.getElementById('sc-iframe'));
    widget.bind(SC.Widget.Events.READY, () => {
      widget.getSounds(sounds => {
        if (!sounds || sounds.length === 0) {
          setFeedback('✗ Track not found or is private/unavailable.', 'err');
          document.getElementById('search-btn').disabled = false;
          document.getElementById('conn-status').textContent = 'error';
          document.getElementById('conn-status').style.color = '#ef5350';
          document.getElementById('main-title').childNodes[0].nodeValue = 'Load Failed\n';
          document.getElementById('main-artist').textContent = 'Try another URL';
          return;
        }
        state.tracks = sounds;
        state.totalTracks = sounds.length;
        renderPlaylist();
        renderBigPlaylist();
        updateTrackDisplay();
        setFeedback('✓ Loaded! Press ▶ to play.', 'ok');
        setTimeout(() => setFeedback(''), 4000);
        document.getElementById('search-btn').disabled = false;
        document.getElementById('conn-status').textContent = 'ready';
        document.getElementById('conn-status').style.color = '#66bb6a';
      });
    });
    widget.bind(SC.Widget.Events.PLAY, onPlay);
    widget.bind(SC.Widget.Events.PAUSE, onPause);
    widget.bind(SC.Widget.Events.PLAY_PROGRESS, onProgress);
    widget.bind(SC.Widget.Events.FINISH, onFinish);
    widget.bind(SC.Widget.Events.ERROR, () => {
      onError();
      setFeedback('✗ Failed to load. Check the URL or try another track.', 'err');
      document.getElementById('search-btn').disabled = false;
    });
  }, 200);
}

// Wire up search box
document.getElementById('search-btn').addEventListener('click', () => {
  loadFromUrl(document.getElementById('search-input').value);
});

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadFromUrl(e.target.value);
});

// Clear error on typing
document.getElementById('search-input').addEventListener('input', () => {
  setFeedback('');
});

// Fill hint example on click
document.getElementById('hint-example').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('search-input').value = 'https://soundcloud.com/odesza/sets/in-return-1';
  document.getElementById('search-input').focus();
});


function renderPlaylist() {
  const pl = document.getElementById('playlist');
  pl.innerHTML = '';
  state.tracks.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = 'track-item' + (i === state.currentIndex ? ' active' : '');
    item.dataset.index = i;
    const dur = track.duration ? msToTime(track.duration) : '--:--';
    const artist = track.user ? track.user.username : '';
    item.innerHTML = `
      <div class="track-num">${i + 1}</div>
      <div class="track-info">
        <div class="t">${track.title || 'Track ' + (i+1)}</div>
        <div class="a">${artist}</div>
      </div>
      <div class="track-dur">${dur}</div>
    `;
    item.addEventListener('click', () => {
      state.currentIndex = i;
      widget.skip(i);
      widget.play();
      highlightActive();
      updateTrackDisplay();
    });
    pl.appendChild(item);
  });
}

function renderBigPlaylist() {
  const pl = document.getElementById('big-playlist');
  pl.innerHTML = '';
  state.tracks.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = 'track-item' + (i === state.currentIndex ? ' active' : '');
    item.dataset.bigindex = i;
    const dur = track.duration ? msToTime(track.duration) : '--:--';
    const artist = track.user ? track.user.username : '';
    item.innerHTML = `
      <div class="track-num">${i + 1}</div>
      <div class="track-info">
        <div class="t">${track.title || 'Track ' + (i+1)}</div>
        <div class="a">${artist}</div>
      </div>
      <div class="track-dur">${dur}</div>
    `;
    item.addEventListener('click', () => {
      state.currentIndex = i;
      widget.skip(i);
      widget.play();
      highlightActive();
      updateTrackDisplay();
    });
    pl.appendChild(item);
  });
}

function highlightActive() {
  document.querySelectorAll('#playlist .track-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.index) === state.currentIndex);
  });
  document.querySelectorAll('#big-playlist .track-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.bigindex) === state.currentIndex);
  });

  // update panel track number
  document.querySelectorAll('#playlist .track-item').forEach(n => {
    const isActive = parseInt(n.dataset.index) === state.currentIndex;
    n.querySelector('.track-num').style.color = isActive ? 'var(--accent)' : 'var(--muted)';
  });
}

// ─── Visualizer bars ─────────────────────────────────────────────────────────
function buildVisualizer() {
  const vis = document.getElementById('visualizer');
  const count = 24;
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const min = 4 + Math.random() * 8;
    const max = 16 + Math.random() * 30;
    const dur = 0.4 + Math.random() * 0.8;
    const delay = Math.random() * 0.5;
    bar.style.cssText = `height:${min}px;--min:${min}px;--max:${max}px;--dur:${dur}s;animation-delay:${delay}s;`;
    vis.appendChild(bar);
  }
}

function buildBigVis() {
  const vis = document.getElementById('bigvis');
  const count = 80;
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    const h = 8 + Math.abs(Math.sin(i * 0.18 + Math.random())) * 60;
    bar.style.cssText = `width:6px;flex-shrink:0;height:${h}px;border-radius:2px 2px 0 0;
      background:${Math.random() > 0.7 ? 'var(--accent)' : 'rgba(255,255,255,0.08)'};`;
    vis.appendChild(bar);
  }
}

// ─── AI Search ───────────────────────────────────────────────────────────────
function setAiFeedback(html, type) {
  const el = document.getElementById('ai-feedback');
  el.innerHTML = html;
  el.className = 'ai-feedback' + (type ? ' ' + type : '');
}

function closeAiResults() {
  document.getElementById('ai-results').classList.remove('show');
  document.getElementById('ai-results-list').innerHTML = '';
}

function renderAiResults(tracks, query) {
  const list = document.getElementById('ai-results-list');
  list.innerHTML = '';

  tracks.forEach((track, i) => {
    const item = document.createElement('div');
    item.className = 'ai-result-item';
    // Escape to prevent XSS
    const safeTitle = track.title.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeArtist = track.artist.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const safeUrl = track.url.replace(/"/g,'&quot;');
    item.innerHTML = `
      <div class="ai-result-num">${i + 1}</div>
      <div class="ai-result-info">
        <div class="t">${safeTitle}</div>
        <div class="a">${safeArtist}</div>
      </div>
      <div class="ai-result-play">▶</div>
    `;
    item.addEventListener('click', () => {
      // Fill URL box and load
      document.getElementById('search-input').value = track.url;
      setAiFeedback(`✓ Loading: <strong>${safeTitle}</strong>`, 'ok');
      closeAiResults();
      loadFromUrl(track.url);
    });
    list.appendChild(item);
  });

  document.getElementById('ai-results').classList.add('show');
}

async function doAiSearch(query) {
  if (!query.trim()) {
    setAiFeedback('Please type a song name or artist.', 'err');
    return;
  }

  closeAiResults();
  const btn = document.getElementById('ai-search-btn');
  btn.disabled = true;
  setAiFeedback(
    '✦ AI is thinking<span class="ai-dots"><span>.</span><span>.</span><span>.</span></span>',
    'loading'
  );

  try {
    const res = await fetch('/api/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim() })
    });

    const data = await res.json();

    if (!res.ok) {
      setAiFeedback('✗ ' + (data.error || 'Server error, please try again.'), 'err');
      btn.disabled = false;
      return;
    }

    if (data.notFound || !data.tracks || data.tracks.length === 0) {
      setAiFeedback('✦ No results found. Try a different search.', 'err');
      btn.disabled = false;
      return;
    }

    setAiFeedback(`✦ Found ${data.tracks.length} result${data.tracks.length > 1 ? 's' : ''} — select one to play`, 'ok');
    renderAiResults(data.tracks, query);

  } catch (err) {
    setAiFeedback('✗ Network error. Make sure the Pages Function is deployed.', 'err');
  }

  btn.disabled = false;
}

document.getElementById('ai-search-btn').addEventListener('click', () => {
  doAiSearch(document.getElementById('ai-search-input').value);
});

document.getElementById('ai-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doAiSearch(e.target.value);
});

document.getElementById('ai-search-input').addEventListener('input', () => {
  setAiFeedback('', '');
});

document.getElementById('ai-results-close').addEventListener('click', () => {
  closeAiResults();
  setAiFeedback('', '');
});

function msToTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
</script>
</body>
</html>
