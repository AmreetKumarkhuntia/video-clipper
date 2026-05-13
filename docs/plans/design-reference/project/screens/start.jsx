// Start state — no URL pasted yet. Pipeline rail is dimmed/preview.
const { Icons, TopBar, Pipeline } = window;

const StartScreen = ({ theme, onTheme }) => (
  <div className="screen-root" data-theme={theme}>
    <TopBar url="" state="idle" theme={theme} onTheme={onTheme} />
    <div className="shell">
      <aside className="rail">
        <h4 className="rail__h">Pipeline</h4>
        <Pipeline steps={[
          { name: "Fetch transcript", state: "pending", detail: "yt-dlp · youtube-transcript-api" },
          { name: "LLM analysis", state: "pending", detail: "chunked · score 0–10" },
          { name: "Refine boundaries", state: "pending", detail: "snap to sentence breaks" },
          { name: "Cut clips", state: "pending", detail: "ffmpeg · mp4" },
        ]} />
      </aside>

      <div className="main main--empty">
        <div className="empty">
          <div className="empty__glyph">
            <span className="vc-wordmark" style={{ fontSize: 56, letterSpacing: "-0.03em" }}>
              Video Clipper<span className="vc-wordmark__dot" style={{ width: 14, height: 14, marginLeft: 8 }}></span>
            </span>
          </div>
          <p className="empty__lede">Paste a YouTube URL to begin. We'll fetch the transcript, score chunks with an LLM, and cut the best moments.</p>
          <div className="empty__url">
            <div className="vc-input-wrap" style={{ flex: 1 }}>
              <Icons.Link />
              <input className="vc-input vc-input--with-icon vc-input--lg" placeholder="https://youtube.com/watch?v=…" autoFocus />
            </div>
            <button className="vc-btn vc-btn--primary vc-btn--lg"><Icons.Sparkles />Analyze</button>
          </div>
          <div className="empty__hints">
            <span className="empty__hint"><Icons.Database size={14} />Cache hit returns in &lt;1s</span>
            <span className="empty__hint"><Icons.Clock size={14} />Typical run: 15–30s</span>
            <span className="empty__hint"><Icons.Key size={14} />Bring your own key</span>
          </div>

          <div className="recents">
            <div className="recents__h">
              <h4>Recent runs</h4>
              <button className="vc-btn vc-btn--ghost vc-btn--sm">Clear</button>
            </div>
            <div className="recents__list">
              {[
                { title: "How to ship great products without protecting every legacy interface", chan: "Stripe Press · 30:23", segs: 10, score: "9 · 8 · 8", when: "2h ago" },
                { title: "What we learned shipping Claude Code to a million developers", chan: "Anthropic · 48:11", segs: 12, score: "9 · 9 · 8", when: "yesterday" },
                { title: "The bitter lesson, revisited (10y on)", chan: "DeepLearning.AI · 1:02:44", segs: 14, score: "8 · 8 · 7", when: "3 days ago" },
              ].map((r, i) => (
                <div key={i} className="recent">
                  <div className="recent__thumb"><Icons.Youtube size={18} /></div>
                  <div className="recent__body">
                    <div className="recent__title">{r.title}</div>
                    <div className="recent__meta">{r.chan} · {r.segs} segments · top {r.score}</div>
                  </div>
                  <div className="recent__when">{r.when}</div>
                  <Icons.ChevronRight size={16} style={{ color: "var(--vc-text-subtle)" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <aside className="side">
        <h4 className="side__h">Defaults</h4>
        <div className="side__group">
          <div className="rail__row"><span className="label">Model</span><span className="val">gpt-4o-mini</span></div>
          <div className="rail__row"><span className="label">Threshold</span><span className="val">7</span></div>
          <div className="rail__row"><span className="label">Top N</span><span className="val">10</span></div>
          <div className="rail__row"><span className="label">Profile</span><span className="val">general</span></div>
          <div className="rail__row"><span className="label">Aspect</span><span className="val">9:16</span></div>
        </div>
        <button className="vc-btn vc-btn--ghost" style={{ width: "100%", justifyContent: "flex-start" }}>
          <Icons.Settings size={14} />Edit defaults
        </button>

        <h4 className="side__h">Tips</h4>
        <div className="side__group side__group--tips">
          <p className="tip"><span className="tip__k">⌘V</span>Paste URL anywhere to start.</p>
          <p className="tip"><span className="tip__k">⌘K</span>Open the command palette.</p>
          <p className="tip"><span className="tip__k">?</span>Keyboard shortcuts.</p>
        </div>
      </aside>
    </div>
  </div>
);

window.StartScreen = StartScreen;
