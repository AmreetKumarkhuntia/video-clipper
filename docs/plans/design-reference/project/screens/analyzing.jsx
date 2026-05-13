// Analyzing state — pipeline is the hero. Player shows skeleton, segments stream in.
const { Icons, TopBar, Pipeline, Player, SAMPLE_TIMELINE } = window;

const AnalyzingScreen = ({ theme, onTheme }) => {
  const partialSegs = [
    { rank: "01", start: "01:14", end: "01:42", dur: "28s", title: "Cold open setup", reason: "funny storytelling moment · transcript", score: 9 },
    { rank: "02", start: "02:14", end: "02:48", dur: "34s", title: "Strong controversial opinion", reason: "“You can't ship great products and protect every legacy interface.”", score: 9 },
    { rank: "03", start: "06:42", end: "07:14", dur: "32s", title: "Audience reaction · laugh", reason: "audio event · spike at 07:01", score: 8 },
  ];

  return (
    <div className="screen-root" data-theme={theme}>
      <TopBar state="running" theme={theme} onTheme={onTheme} />
      <div className="shell">
        <aside className="rail rail--running">
          <h4 className="rail__h">Pipeline <span className="rail__h__chip">running</span></h4>
          <Pipeline steps={[
            { name: "Fetch transcript", t: "1.2s", state: "done", detail: "12,481 chars · 22 chunks" },
            { name: "LLM analysis", t: "11.4s", state: "done", detail: "22 chunks · gpt-4o-mini · $0.0042" },
            { name: "Refine boundaries", t: "14 / 22", state: "running", progress: 64, detail: "snapping to sentence breaks" },
            { name: "Cut clips", state: "pending", detail: "ffmpeg · 4 clips queued" },
          ]} />

          <h4 className="rail__h" style={{ marginTop: 28 }}>Live log</h4>
          <div className="log">
            <div className="log__line"><span className="log__t">14:02:11</span><span className="log__msg log__msg--dim">→ fetch transcript</span></div>
            <div className="log__line"><span className="log__t">14:02:12</span><span className="log__msg">  done · 12,481 chars</span></div>
            <div className="log__line"><span className="log__t">14:02:12</span><span className="log__msg log__msg--dim">→ chunk · k=22</span></div>
            <div className="log__line"><span className="log__t">14:02:14</span><span className="log__msg log__msg--dim">→ score chunks · gpt-4o-mini</span></div>
            <div className="log__line"><span className="log__t">14:02:25</span><span className="log__msg">  done · 11.4s · $0.0042</span></div>
            <div className="log__line"><span className="log__t">14:02:25</span><span className="log__msg log__msg--dim">→ refine boundaries · 22 chunks</span></div>
            <div className="log__line"><span className="log__t">14:02:31</span><span className="log__msg log__msg--accent">  refining 14 / 22 …</span></div>
          </div>
        </aside>

        <div className="main">
          <Player />
          <div className="timeline">
            <div className="timeline__head">
              <div><span className="now">—:—</span> <span style={{ marginLeft: 8 }}>/ 30:23</span></div>
              <div>3 of ~10 segments · streaming</div>
            </div>
            <div className="timeline__track">
              {SAMPLE_TIMELINE.slice(0, 3).map((s, i) => (
                <div key={i} className="timeline__seg" style={{ left: `${s.left}%`, width: `${s.width}%` }}>
                  <span className="timeline__seg__label">{String(i + 1).padStart(2, "0")}</span>
                </div>
              ))}
              <div className="timeline__skeleton" style={{ left: "26%", right: "0" }}></div>
            </div>
            <div className="timeline__ticks">
              <span>00:00</span><span>05:00</span><span>10:00</span><span>15:00</span><span>20:00</span><span>25:00</span><span>30:00</span>
            </div>
          </div>

          <div className="sect">
            <div className="sect__h">
              <h3>Top segments</h3>
              <div className="meta">streaming as they're scored</div>
            </div>
            <div className="segments">
              {partialSegs.map((s) => (
                <div key={s.rank} className="segment segment--streaming">
                  <div className="segment__rank">{s.rank}</div>
                  <div className="segment__time">{s.start} → {s.end}<span className="dur">{s.dur}</span></div>
                  <div className="segment__body">
                    <div className="segment__body__title">{s.title}</div>
                    <div className="segment__body__reason">{s.reason}</div>
                  </div>
                  <div className="segment__right">
                    <div className="vc-score">{s.score}<span className="vc-score__den">/10</span></div>
                  </div>
                </div>
              ))}
              {[0, 1, 2, 3].map((i) => (
                <div key={`sk-${i}`} className="segment segment--skeleton">
                  <div className="sk sk--rank"></div>
                  <div className="sk sk--time"></div>
                  <div className="sk sk--body"><div className="sk sk--line"></div><div className="sk sk--line sk--short"></div></div>
                  <div className="sk sk--score"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="side">
          <h4 className="side__h">Run</h4>
          <div className="side__group">
            <div className="rail__row"><span className="label">Started</span><span className="val">14:02:11</span></div>
            <div className="rail__row"><span className="label">Elapsed</span><span className="val val--accent">00:18</span></div>
            <div className="rail__row"><span className="label">ETA</span><span className="val">~10s</span></div>
            <div className="rail__row"><span className="label">Tokens</span><span className="val">14.2k in / 2.1k out</span></div>
            <div className="rail__row"><span className="label">Cost</span><span className="val">$0.0042</span></div>
          </div>

          <h4 className="side__h">Status</h4>
          <div className="side__group side__group--status">
            <div className="status-line"><span className="dot dot--ok"></span>Transcript fetched</div>
            <div className="status-line"><span className="dot dot--ok"></span>22 chunks scored</div>
            <div className="status-line"><span className="dot dot--run"></span>Refining 14 / 22</div>
            <div className="status-line status-line--dim"><span className="dot"></span>Cutting clips (queued)</div>
          </div>

          <button className="vc-btn vc-btn--secondary" style={{ width: "100%" }}>Cancel run</button>
        </aside>
      </div>
    </div>
  );
};

window.AnalyzingScreen = AnalyzingScreen;
