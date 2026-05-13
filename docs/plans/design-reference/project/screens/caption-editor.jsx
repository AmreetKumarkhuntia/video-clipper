// Caption Editor — refine subtitles, overlays, and reframe before render.
// Mirrors the existing Caption Editor.html layout but tightens components against
// the Video Clipper design system: seg-controls for reframe/fill, vc-toggle for
// outline, vc-badge for the aspect chip, vc-slider everywhere, and unified labels.

const { Icons } = window;

/* ────────────────────────────────────────────────────────────────
   Small primitives — kept local to the caption editor so they don't
   pollute the global scope or other screens.
   ──────────────────────────────────────────────────────────────── */

const CapField = ({ label, children, className = "" }) => (
  <div className={`ce-field ${className}`}>
    <label className="ce-field__label">{label}</label>
    {children}
  </div>
);

const SliderField = ({ label, min, max, step = 1, value, suffix, onChange }) => (
  <CapField label={label}>
    <div className="ce-slider-row">
      <input
        type="range"
        className="vc-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange?.(Number(e.target.value))}
      />
      <span className="ce-slider-row__v">{value}{suffix ?? ""}</span>
    </div>
  </CapField>
);

const Swatch = ({ kind, label, onClick }) => (
  <button className={`ce-swatch ce-swatch--${kind}`} onClick={onClick} aria-label={label}>
    <span className="ce-swatch__chip"></span>
    <span className="ce-swatch__label">{label}</span>
  </button>
);

const PanelH = ({ children, hint }) => (
  <div className="ce-panel-h">
    <span>{children}</span>
    {hint && <span className="ce-panel-h__hint">{hint}</span>}
  </div>
);

/* ────────────────────────────────────────────────────────────────
   Caption preset cards
   ──────────────────────────────────────────────────────────────── */

const PRESETS = [
  { id: "bold-white",  label: "Bold White" },
  { id: "yellow-pop",  label: "Yellow Pop" },
  { id: "subtle",      label: "Subtle" },
  { id: "hooked",      label: "Hooked" },
  { id: "karaoke",     label: "Karaoke" },
];

const CaptionPreset = ({ preset, active, onClick }) => (
  <button
    className={`ce-preset ce-preset--${preset.id} ${active ? "is-active" : ""}`}
    onClick={onClick}
    type="button"
  >
    {preset.id === "karaoke" && <span className="ce-preset__karaoke-fill"></span>}
    <span className="ce-preset__text">{preset.label}</span>
    {active && <span className="ce-preset__dot" aria-hidden></span>}
  </button>
);

/* ────────────────────────────────────────────────────────────────
   Topbar — workflow stepper + actions
   ──────────────────────────────────────────────────────────────── */

const STEPS = [
  { id: "analyze",  label: "Analyze",  state: "done" },
  { id: "clip",     label: "Clip",     state: "done" },
  { id: "connect",  label: "Connect",  state: "done" },
  { id: "prepare",  label: "Prepare",  state: "current" },
  { id: "publish",  label: "Publish",  state: "locked" },
];

const Stepper = () => (
  <div className="ce-stepper">
    <span className="ce-stepper__meta">Step 4 of 5</span>
    <ol className="ce-stepper__list">
      {STEPS.map((s, i) => (
        <li key={s.id} className={`ce-stepper__item is-${s.state}`}>
          <span className="ce-stepper__bullet">
            {s.state === "done" ? <Icons.Check size={11} /> : i + 1}
          </span>
          <span className="ce-stepper__label">{s.label}</span>
        </li>
      ))}
    </ol>
  </div>
);

const CETopBar = ({ theme, onTheme }) => (
  <header className="ce-topbar">
    <div className="ce-topbar__brand">
      <span className="vc-wordmark" style={{ fontSize: 16 }}>
        Video Clipper<span className="vc-wordmark__dot" style={{ width: 4, height: 4 }}></span>
      </span>
    </div>

    <span className="ce-divider" />

    <div className="ce-topbar__file">
      <span className="ce-topbar__file__name">ttXHdaDTjnk_356_420.mp4</span>
      <span className="ce-topbar__file__meta">5:56 → 7:00 · 1:04</span>
      <span className="vc-badge vc-badge--mono" style={{ padding: "2px 8px" }}>9:16</span>
    </div>

    <Stepper />

    <div className="ce-topbar__spacer" />

    <div className="ce-topbar__actions">
      <button className="vc-btn vc-btn--secondary vc-btn--sm">Save draft</button>
      <button className="vc-btn vc-btn--primary vc-btn--sm">
        <Icons.Scissors size={14} />Render &amp; Save
      </button>
      <button className="vc-btn vc-btn--ghost vc-btn--icon vc-btn--sm" aria-label="Theme" onClick={onTheme}>
        {theme === "dark" ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
      </button>
      <button className="vc-btn vc-btn--ghost vc-btn--icon vc-btn--sm" aria-label="Close">
        <Icons.X size={14} />
      </button>
    </div>
  </header>
);

/* ────────────────────────────────────────────────────────────────
   Center stage — face cam over game, playback bar, sub actions
   ──────────────────────────────────────────────────────────────── */

const VideoStage = () => (
  <div className="ce-stage">
    <div className="ce-output">
      {/* Face cam */}
      <div className="ce-frame ce-frame--face">
        <div className="ce-frame__ph">
          <div className="ce-frame__avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <span className="ce-frame__phlabel">face cam</span>
        </div>
        <div className="ce-caption-over">
          <div className="ce-caption-over__t">
            <span className="hl">She's</span> a coward.
          </div>
        </div>
      </div>

      {/* Game footage */}
      <div className="ce-frame ce-frame--game">
        <div className="ce-frame__ph ce-frame__ph--dim">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 15 12 10 15 10 9"/>
          </svg>
        </div>
        <div className="ce-game-subs">
          Ishikawa: (Sighs.) She'll be long gone by the time we get there.
        </div>
      </div>
    </div>
  </div>
);

const Playback = () => (
  <div className="ce-playback">
    <button className="ce-play-btn" aria-label="Play">
      <Icons.Play size={11} />
    </button>
    <span className="ce-pb-time"><span className="now">0:12</span> / 1:04</span>
    <div className="ce-pb-track">
      <div className="ce-pb-fill" style={{ width: "18%" }}>
        <span className="ce-pb-thumb"></span>
      </div>
    </div>
    <span className="ce-pb-meta">29.97 fps · 1080p</span>
  </div>
);

const SubActions = () => (
  <div className="ce-sub-actions">
    <button className="vc-btn vc-btn--secondary vc-btn--sm">
      <Icons.Plus size={13} />Subtitle
    </button>
    <button className="vc-btn vc-btn--secondary vc-btn--sm">
      <Icons.Plus size={13} />Banner
    </button>
    <button className="vc-btn vc-btn--ghost vc-btn--sm">
      <Icons.FileText size={13} />Auto-import transcript
    </button>
    <span className="ce-sub-actions__hint">
      <Icons.Sparkles size={12} />3 banners suggested from transcript
    </span>
  </div>
);

/* ────────────────────────────────────────────────────────────────
   Right panel — text, words, style, color, position
   ──────────────────────────────────────────────────────────────── */

const WORDS = [
  ">>", "She's", "a", "coward.", "No,", "she's", "mocking", "me.",
  "She", "knows", "the", "last", "student", "I", "trained"
];

const RightPanel = () => {
  const [hl, setHl] = React.useState(new Set([1])); // She's
  const [size, setSize] = React.useState(56);
  const [weight, setWeight] = React.useState(800);
  const [outline, setOutline] = React.useState(true);
  const [outlineW, setOutlineW] = React.useState(3);
  const [pos, setPos] = React.useState(0.85);

  const toggleWord = i => {
    setHl(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <aside className="ce-right">
      {/* Selection header */}
      <div className="ce-right__sel">
        <span className="ce-right__sel__k">Editing</span>
        <span className="ce-right__sel__v">Subtitle · 02</span>
        <span className="vc-badge vc-badge--clay vc-badge--mono" style={{ marginLeft: "auto" }}>karaoke</span>
      </div>

      <div className="ce-rg">
        <PanelH>Text</PanelH>
        <textarea
          className="vc-textarea"
          style={{ minHeight: 60, fontFamily: "var(--vc-font-body)", fontSize: 13 }}
          defaultValue=">> She's a coward. No, she's mocking me. She knows the last student I trained"
        />
        <div className="ce-time-row">
          <CapField label="Start">
            <input className="vc-input ce-mono-input" defaultValue="00:03.966" />
          </CapField>
          <CapField label="End">
            <input className="vc-input ce-mono-input" defaultValue="00:10.150" />
          </CapField>
        </div>
      </div>

      <div className="ce-rg">
        <PanelH hint="tap a word to highlight">Words</PanelH>
        <div className="ce-words">
          {WORDS.map((w, i) => (
            <button
              key={i}
              type="button"
              className={`ce-word ${hl.has(i) ? "is-hl" : ""}`}
              onClick={() => toggleWord(i)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="ce-rg">
        <PanelH>Style</PanelH>
        <div className="ce-grid-2">
          <SliderField label="Font size" min={12} max={120} value={size} onChange={setSize} suffix="px" />
          <SliderField label="Weight" min={100} max={900} step={100} value={weight} onChange={setWeight} />
        </div>
        <CapField label="Align">
          <div className="seg-control">
            <button className="seg-control__btn">Left</button>
            <button className="seg-control__btn is-active">Center</button>
            <button className="seg-control__btn">Right</button>
          </div>
        </CapField>
      </div>

      <div className="ce-rg">
        <PanelH>Color</PanelH>
        <div className="ce-grid-2">
          <Swatch kind="white" label="White" />
          <Swatch kind="yellow" label="Highlight" />
        </div>

        <label className="ce-toggle-row">
          <span>Outline</span>
          <span className="vc-toggle">
            <input type="checkbox" checked={outline} onChange={e => setOutline(e.target.checked)} />
            <span className="vc-toggle__track"></span>
            <span className="vc-toggle__thumb"></span>
          </span>
        </label>

        {outline && (
          <div className="ce-grid-2">
            <Swatch kind="black" label="Outline" />
            <SliderField label="Width" min={0} max={10} value={outlineW} onChange={setOutlineW} suffix="px" />
          </div>
        )}

        <Swatch kind="transparent" label="Background" />
      </div>

      <div className="ce-rg">
        <PanelH>Position</PanelH>
        <div className="ce-pos-head">
          <span>Vertical</span>
          <span className="ce-pos-head__v">{pos.toFixed(2)}</span>
        </div>
        <input
          type="range"
          className="vc-slider"
          min={0}
          max={1}
          step={0.01}
          value={pos}
          onChange={e => setPos(Number(e.target.value))}
          style={{ width: "100%", marginTop: 8 }}
        />
        <div className="ce-pos-sub">
          <span>top</span>
          <span>bottom</span>
        </div>
      </div>
    </aside>
  );
};

/* ────────────────────────────────────────────────────────────────
   Bottom timeline
   ──────────────────────────────────────────────────────────────── */

const SUBS = [
  { left: 0,  w: 14, t: ">> She's a co…", hl: true },
  { left: 15, w: 9,  t: "in who…" },
  { left: 25, w: 14, t: "there her was mi Naged…" },
  { left: 40, w: 7,  t: "i was t…" },
  { left: 48, w: 5,  t: "defin…" },
  { left: 54, w: 4,  t: "Import…" },
  { left: 59, w: 4,  t: "to in…" },
  { left: 64, w: 5,  t: "full, but st…" },
  { left: 71, w: 5,  t: "Export…" },
  { left: 77, w: 3,  t: "the…" },
  { left: 81, w: 3,  t: "film…" },
  { left: 85, w: 4,  t: "main…" },
  { left: 90, w: 3,  t: "fill…" },
  { left: 94, w: 3,  t: "still…" },
];

const Timeline = () => (
  <div className="ce-timeline">
    <div className="ce-tl-top">
      <button className="vc-btn vc-btn--secondary vc-btn--sm" style={{ padding: "3px 10px" }}>Fit all</button>
      <span className="ce-tl-range">0:00 – 1:04</span>
      <span className="ce-tl-cursor">cursor 00:12.413</span>
      <span style={{ flex: 1 }} />
      <button className="vc-btn vc-btn--ghost vc-btn--sm">−</button>
      <button className="vc-btn vc-btn--ghost vc-btn--sm">+</button>
    </div>

    <div className="ce-tl-tracks">
      <div className="ce-tl-track">
        <span className="ce-tl-lbl">Subs</span>
        <div className="ce-tl-body">
          {SUBS.map((s, i) => (
            <div
              key={i}
              className={`ce-tl-seg ${s.hl ? "is-hl" : ""}`}
              style={{ left: `${s.left}%`, width: `${s.w}%` }}
            >{s.t}</div>
          ))}
        </div>
      </div>

      <div className="ce-tl-track">
        <span className="ce-tl-lbl">Ovlys</span>
        <div className="ce-tl-body">
          <div className="ce-tl-seg ce-tl-seg--ovly" style={{ left: "0%", width: "62%" }}>
            Hook banner
          </div>
        </div>
      </div>

      <div className="ce-tl-track">
        <span className="ce-tl-lbl">Trim</span>
        <div className="ce-tl-body">
          <div className="ce-tl-trim"></div>
        </div>
      </div>
    </div>

    <div className="ce-tl-ticks">
      <span>0:00</span><span>0:15</span><span>0:30</span><span>0:45</span><span>1:00</span>
    </div>

    <div className="ce-tl-cursor-line" style={{ left: "calc(60px + 18% * (100% - 60px - 16px))" }}></div>
  </div>
);

/* ────────────────────────────────────────────────────────────────
   Root
   ──────────────────────────────────────────────────────────────── */

const CaptionEditorScreen = ({ theme, onTheme }) => {
  const [preset, setPreset] = React.useState("karaoke");
  const [aspect, setAspect] = React.useState("9:16");
  const [fill, setFill] = React.useState("crop");

  return (
    <div className="screen-root ce-root" data-theme={theme}>
      <CETopBar theme={theme} onTheme={onTheme} />

      <div className="ce-body">
        {/* LEFT */}
        <aside className="ce-left">
          <div className="ce-rg">
            <PanelH>Captions</PanelH>
            <div className="ce-presets">
              {PRESETS.map(p => (
                <CaptionPreset key={p.id} preset={p} active={preset === p.id} onClick={() => setPreset(p.id)} />
              ))}
            </div>
          </div>

          <div className="ce-rg">
            <PanelH>Reframe</PanelH>
            <div className="seg-control seg-control--col">
              {["9:16", "1:1", "16:9"].map(a => (
                <button
                  key={a}
                  className={`seg-control__btn ${aspect === a ? "is-active" : ""}`}
                  onClick={() => setAspect(a)}
                >{a}</button>
              ))}
            </div>
          </div>

          <div className="ce-rg">
            <PanelH>Fill</PanelH>
            <div className="seg-control seg-control--col">
              {[["crop","Crop"], ["blur","Blur"], ["black","Black"]].map(([id, label]) => (
                <button
                  key={id}
                  className={`seg-control__btn ${fill === id ? "is-active" : ""}`}
                  onClick={() => setFill(id)}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="ce-rg">
            <PanelH>Speaker zoom</PanelH>
            <label className="ce-toggle-row">
              <span>Auto-zoom on speaker</span>
              <span className="vc-toggle">
                <input type="checkbox" defaultChecked />
                <span className="vc-toggle__track"></span>
                <span className="vc-toggle__thumb"></span>
              </span>
            </label>
          </div>
        </aside>

        {/* CENTER */}
        <div className="ce-center">
          <VideoStage />
          <Playback />
          <SubActions />
        </div>

        {/* RIGHT */}
        <RightPanel />
      </div>

      <Timeline />
    </div>
  );
};

window.CaptionEditorScreen = CaptionEditorScreen;
