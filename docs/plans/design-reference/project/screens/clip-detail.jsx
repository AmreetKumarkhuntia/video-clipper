// Clip detail — refine one segment. Waveform-ish bar + transcript + boundary controls.
const { Icons, TopBar } = window;

const ClipDetailScreen = ({ theme, onTheme }) => {
  // Fake waveform: 80 bars
  const bars = Array.from({ length: 80 }, (_, i) => {
    const center = 40;
    const dist = Math.abs(i - center) / 40;
    const base = 0.35 + Math.sin(i * 0.7) * 0.18 + Math.sin(i * 0.31) * 0.18;
    const env = 1 - dist * 0.5;
    return Math.max(0.12, Math.min(0.96, base * env + (i % 7 === 0 ? 0.18 : 0)));
  });

  return (
    <div className="screen-root" data-theme={theme}>
      <TopBar state="done" theme={theme} onTheme={onTheme} />
      <div className="shell shell--detail">
        <aside className="rail">
          <button className="vc-btn vc-btn--ghost vc-btn--sm" style={{ marginBottom: 16, justifyContent: "flex-start" }}>
            <Icons.ArrowLeft size={14} />Back to clips
          </button>
          <h4 className="rail__h">Segment 02</h4>
          <div className="rail__group">
            <div className="rail__row"><span className="label">Score</span><span className="val val--accent">9 / 10</span></div>
            <div className="rail__row"><span className="label">Start</span><span className="val">02:14.180</span></div>
            <div className="rail__row"><span className="label">End</span><span className="val">02:48.420</span></div>
            <div className="rail__row"><span className="label">Duration</span><span className="val">34.24s</span></div>
            <div className="rail__row"><span className="label">Aspect</span><span className="val">9:16</span></div>
            <div className="rail__row"><span className="label">Status</span><span className="val val--ok">cut · 02</span></div>
          </div>

          <h4 className="rail__h">Why it scored 9</h4>
          <div className="reasons">
            <div className="reason"><span className="reason__k">Transcript</span><span className="reason__v">Strong claim, controversial framing.</span></div>
            <div className="reason"><span className="reason__k">Audio</span><span className="reason__v">Crowd murmur at 02:46.</span></div>
            <div className="reason"><span className="reason__k">Pacing</span><span className="reason__v">Single thought, lands cleanly.</span></div>
          </div>

          <h4 className="rail__h">Pipeline</h4>
          <div className="mini-pipeline">
            <span className="mini-pipeline__step is-done">transcript</span>
            <span className="mini-pipeline__sep">·</span>
            <span className="mini-pipeline__step is-done">scored</span>
            <span className="mini-pipeline__sep">·</span>
            <span className="mini-pipeline__step is-done">refined</span>
            <span className="mini-pipeline__sep">·</span>
            <span className="mini-pipeline__step is-done">cut</span>
          </div>
        </aside>

        <div className="main main--detail">
          {/* Player */}
          <div className="player player--detail">
            <div className="player__bg"></div>
            <div className="player__title">
              <Icons.Youtube size={14} />
              <span>How to ship great products without protecting every legacy interface</span>
              <span style={{ marginLeft: "auto", opacity: 0.6 }}>02:14 → 02:48</span>
            </div>
            <div className="player__play"><Icons.PlayFilled size={28} style={{ marginLeft: 4 }} /></div>
            <div className="player__caption">"You can't ship great products and protect every legacy interface."</div>
          </div>

          {/* Waveform with handles */}
          <div className="wave">
            <div className="wave__head">
              <div className="wave__times">
                <span className="wave__t">02:08</span>
                <span className="wave__t">02:16</span>
                <span className="wave__t">02:24</span>
                <span className="wave__t">02:32</span>
                <span className="wave__t">02:40</span>
                <span className="wave__t">02:48</span>
                <span className="wave__t">02:56</span>
              </div>
            </div>
            <div className="wave__track">
              <div className="wave__bars">
                {bars.map((h, i) => {
                  const inSel = i >= 16 && i <= 60;
                  return <div key={i} className={`wave__bar ${inSel ? "is-sel" : ""}`} style={{ height: `${h * 100}%` }}></div>;
                })}
              </div>
              <div className="wave__sel" style={{ left: "20%", right: "25%" }}>
                <div className="wave__handle wave__handle--l"><span></span></div>
                <div className="wave__handle wave__handle--r"><span></span></div>
              </div>
              <div className="wave__cursor" style={{ left: "38%" }}></div>
            </div>
            <div className="wave__controls">
              <div className="wave__time-input">
                <label>Start</label>
                <input type="text" className="vc-input" defaultValue="02:14.180" />
              </div>
              <div className="wave__btns">
                <button className="vc-btn vc-btn--ghost vc-btn--icon vc-btn--sm" aria-label="Snap left"><Icons.ArrowLeft size={14} /></button>
                <button className="vc-btn vc-btn--secondary vc-btn--sm">Snap to sentence</button>
                <button className="vc-btn vc-btn--ghost vc-btn--icon vc-btn--sm" aria-label="Snap right"><Icons.ArrowRight size={14} /></button>
              </div>
              <div className="wave__time-input">
                <label>End</label>
                <input type="text" className="vc-input" defaultValue="02:48.420" />
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div className="sect">
            <div className="sect__h">
              <h3>Transcript</h3>
              <div className="meta">click a phrase to set boundary</div>
            </div>
            <div className="transcript">
              <p className="transcript__line transcript__line--out"><span className="transcript__t">02:08</span>And so this is where I think people get it wrong. They look at backwards compatibility…</p>
              <p className="transcript__line transcript__line--in"><span className="transcript__t">02:14</span><strong>You can't ship great products and protect every legacy interface.</strong> You have to choose.</p>
              <p className="transcript__line transcript__line--in"><span className="transcript__t">02:24</span>Every API surface you keep is a tax on the next decision. It compounds. By year three you're not building a product, you're maintaining a museum.</p>
              <p className="transcript__line transcript__line--in"><span className="transcript__t">02:38</span>The companies that ship — and I mean really ship — break things on purpose. They version aggressively. They tell users no.</p>
              <p className="transcript__line transcript__line--out"><span className="transcript__t">02:48</span>Now, that's not the same as being careless…</p>
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
            <label className="toggle-row">Burn captions<span className="vc-toggle"><input type="checkbox" defaultChecked /><span className="vc-toggle__track"></span><span className="vc-toggle__thumb"></span></span></label>
            <label className="toggle-row">Auto-zoom on speaker<span className="vc-toggle"><input type="checkbox" /><span className="vc-toggle__track"></span><span className="vc-toggle__thumb"></span></span></label>
            <label className="toggle-row">Padding 0.5s<span className="vc-toggle"><input type="checkbox" defaultChecked /><span className="vc-toggle__track"></span><span className="vc-toggle__thumb"></span></span></label>
          </div>

          <h4 className="side__h">Title</h4>
          <div className="side__group">
            <textarea className="vc-textarea" style={{ fontFamily: "var(--vc-font-body)", minHeight: 64 }} defaultValue="You can't ship great products and protect every legacy interface."></textarea>
          </div>

          <button className="vc-btn vc-btn--primary" style={{ width: "100%" }}>
            <Icons.Scissors size={14} />Re-cut clip
          </button>
          <button className="vc-btn vc-btn--ghost" style={{ width: "100%", marginTop: 6 }}>
            <Icons.Download size={14} />Download
          </button>
        </aside>
      </div>
    </div>
  );
};

window.ClipDetailScreen = ClipDetailScreen;
