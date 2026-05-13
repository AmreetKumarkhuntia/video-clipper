// Shared topbar — used by main app screens.
const { Icons } = window;

const TopBar = ({ url = "https://youtube.com/watch?v=dQw4w9WgXcQ", model = "OpenAI · gpt-4o-mini", state = "idle", onTheme, theme = "light" }) => {
  const stateChip = {
    idle:      { dotColor: "var(--vc-text-subtle)", text: model, anim: false },
    running:   { dotColor: "var(--vc-clay-500)",    text: model, anim: true  },
    done:      { dotColor: "var(--vc-success)",     text: model, anim: false },
    error:     { dotColor: "var(--vc-error)",       text: model, anim: false },
  }[state];

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <span className="vc-wordmark" style={{ fontSize: 18 }}>
          Video Clipper<span className="vc-wordmark__dot" style={{ width: 5, height: 5 }}></span>
        </span>
      </div>
      <div className="topbar__url">
        <div className="vc-input-wrap">
          <Icons.Link />
          <input className="vc-input vc-input--with-icon" defaultValue={url} />
        </div>
      </div>
      <div className="topbar__actions">
        <span className="topbar__chip">
          <span className="dot" style={{ background: stateChip.dotColor, animation: stateChip.anim ? "vc-pulse 1.6s ease-in-out infinite" : "none" }}></span>
          {stateChip.text}
        </span>
        {state === "running" ? (
          <button className="vc-btn vc-btn--secondary vc-btn--sm">Cancel run</button>
        ) : null}
        <button className={`vc-btn ${state === "running" ? "vc-btn--secondary" : "vc-btn--primary"}`} disabled={state === "running"}>
          <Icons.Sparkles />
          {state === "running" ? "Analyzing…" : state === "done" ? "Re-analyze" : "Analyze"}
        </button>
        <button className="vc-btn vc-btn--ghost vc-btn--icon" aria-label="Theme" onClick={onTheme}>
          {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
        </button>
      </div>
    </div>
  );
};

window.TopBar = TopBar;
