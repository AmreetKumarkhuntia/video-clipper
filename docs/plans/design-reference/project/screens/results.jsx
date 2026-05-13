// Results-heavy state — all 10 cut, clips downloaded. Clip grid takes the bulk.
const { Icons, TopBar, Pipeline, Player, Timeline, SAMPLE_TIMELINE, SAMPLE_SEGMENTS } = window;

const ClipCard = ({ rank, start, end, dur, title, score, status = "ready" }) => (
  <div className="clipcard">
    <div className="clipcard__thumb">
      <div className="clipcard__thumb-bg" />
      <div className="clipcard__thumb-time">{start} → {end}</div>
      <div className="clipcard__thumb-play"><Icons.PlayFilled size={20} style={{ marginLeft: 2 }} /></div>
      <div className="clipcard__thumb-aspect">9:16</div>
    </div>
    <div className="clipcard__body">
      <div className="clipcard__row">
        <span className="clipcard__rank">{rank}</span>
        <div className="vc-score">{score}<span className="vc-score__den">/10</span></div>
        <span className="clipcard__dur">{dur}</span>
      </div>
      <div className="clipcard__title">{title}</div>
      <div className="clipcard__actions">
        <button className="vc-btn vc-btn--secondary vc-btn--sm" style={{ flex: 1 }}>
          <Icons.Maximize size={14} />Refine
        </button>
        <button className="vc-btn vc-btn--ghost vc-btn--sm vc-btn--icon" aria-label="Download"><Icons.Download size={14} /></button>
        <button className="vc-btn vc-btn--ghost vc-btn--sm vc-btn--icon" aria-label="More"><Icons.MoreHorizontal size={14} /></button>
      </div>
    </div>
  </div>
);

const ResultsScreen = ({ theme, onTheme }) => {
  const allCut = SAMPLE_SEGMENTS.concat([
    { rank: "07", start: "19:48", end: "20:24", dur: "36s", title: "Crisp summary of the framework", reason: "key insight · transcript", score: 7 },
    { rank: "08", start: "23:12", end: "23:46", dur: "34s", title: "Founder anecdote · the API rewrite", reason: "narrative beat · transcript", score: 7 },
  ]).map((s, i) => ({ ...s, cut: true, cutNum: String(i + 1).padStart(2, "0") }));

  return (
    <div className="screen-root" data-theme={theme}>
      <TopBar state="done" theme={theme} onTheme={onTheme} />
      <div className="shell">
        <aside className="rail">
          <h4 className="rail__h">Pipeline <span className="rail__h__chip rail__h__chip--ok">complete · 22.5s</span></h4>
          <Pipeline steps={[
            { name: "Fetch transcript", t: "1.2s", state: "done", detail: "12,481 chars" },
            { name: "LLM analysis", t: "11.4s", state: "done", detail: "22 chunks · $0.0042" },
            { name: "Refine boundaries", t: "3.8s", state: "done", detail: "10 segments scored" },
            { name: "Cut clips", t: "6.1s", state: "done", detail: "8 clips · ffmpeg" },
          ]} />

          <h4 className="rail__h" style={{ marginTop: 28 }}>Run summary</h4>
          <div className="rail__group">
            <div className="rail__row"><span className="label">Total</span><span className="val">22.5s</span></div>
            <div className="rail__row"><span className="label">Tokens</span><span className="val">22.4k</span></div>
            <div className="rail__row"><span className="label">Cost</span><span className="val">$0.0042</span></div>
            <div className="rail__row"><span className="label">Clips</span><span className="val">8 · 4.6 MB</span></div>
            <div className="rail__row"><span className="label">Cache</span><span className="val">stored</span></div>
          </div>
          <button className="vc-btn vc-btn--primary" style={{ width: "100%", marginTop: 12 }}>
            <Icons.Download size={14} />Download all
          </button>
          <button className="vc-btn vc-btn--ghost" style={{ width: "100%", marginTop: 6, justifyContent: "flex-start" }}>
            <Icons.Folder size={14} />Open in Finder
          </button>
        </aside>

        <div className="main">
          <div className="vc-tabs" style={{ marginBottom: 20 }}>
            <button className="vc-tab is-active">Clips <span className="tab-count">8</span></button>
            <button className="vc-tab">Segments <span className="tab-count">10</span></button>
            <button className="vc-tab">Transcript</button>
            <button className="vc-tab">Logs</button>
          </div>

          <Timeline segments={SAMPLE_TIMELINE.map(s => ({ ...s, cut: true }))} cutCount={8} />

          <div className="sect">
            <div className="sect__h">
              <h3>Cut clips</h3>
              <div className="meta">8 ready · sorted by score</div>
            </div>
            <div className="clipgrid">
              {allCut.map((s) => (
                <ClipCard key={s.rank} {...s} />
              ))}
            </div>
          </div>
        </div>

        <aside className="side">
          <h4 className="side__h">Export</h4>
          <div className="side__group">
            <div className="vc-field">
              <label className="vc-label">Aspect</label>
              <div className="seg-control">
                <button className="seg-control__btn">16:9</button>
                <button className="seg-control__btn is-active">9:16</button>
                <button className="seg-control__btn">1:1</button>
              </div>
            </div>
            <div className="vc-field">
              <label className="vc-label">Format</label>
              <select className="vc-select" defaultValue="mp4">
                <option>mp4</option>
                <option>webm</option>
                <option>mov</option>
              </select>
            </div>
            <label className="toggle-row">Burn captions<span className="vc-toggle"><input type="checkbox" defaultChecked /><span className="vc-toggle__track"></span><span className="vc-toggle__thumb"></span></span></label>
            <label className="toggle-row">Add 0.5s padding<span className="vc-toggle"><input type="checkbox" defaultChecked /><span className="vc-toggle__track"></span><span className="vc-toggle__thumb"></span></span></label>
          </div>

          <h4 className="side__h">Filter</h4>
          <div className="side__group">
            <div className="vc-field">
              <label className="vc-label">Min score</label>
              <input type="range" className="vc-slider" min="1" max="10" defaultValue="7" />
              <div className="slider-labels"><span>1</span><span className="active">7</span><span>10</span></div>
            </div>
            <div className="vc-field">
              <label className="vc-label">Max length</label>
              <input type="text" className="vc-input" defaultValue="60s" style={{ fontFamily: "var(--vc-font-mono)" }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

window.ResultsScreen = ResultsScreen;
window.ClipCard = ClipCard;
