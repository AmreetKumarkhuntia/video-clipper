// Main improved app screen — the canonical view: pipeline rail (left), player+timeline+segments (center), run details (right)
const { Icons, TopBar } = window;

const Pipeline = ({ steps, vertical = true }) => (
  <div className={`pipeline ${vertical ? 'pipeline--vertical' : ''}`}>
    {steps.map((s, i) => (
      <div key={i} className={`pipeline__step is-${s.state}`}>
        <div className="pipeline__icon">
          {s.state === 'done' ? (
            <Icons.Check size={12} style={{ strokeWidth: 2.5 }} />
          ) : s.state === 'running' ? (
            <Icons.Loader size={12} style={{ strokeWidth: 2 }} />
          ) : (
            <span>{i + 1}</span>
          )}
        </div>
        <div className="pipeline__body">
          <div className="pipeline__name">{s.name}</div>
          {s.detail ? <div className="pipeline__detail">{s.detail}</div> : null}
          {s.state === 'running' && s.progress != null ? (
            <div className="vc-progress" style={{ marginTop: 8 }}>
              <div className="vc-progress__fill" style={{ width: `${s.progress}%` }}></div>
            </div>
          ) : null}
        </div>
        <div className="pipeline__t">{s.t || ''}</div>
      </div>
    ))}
  </div>
);

const SegmentRow = ({ rank, start, end, dur, title, reason, score, active, cut, cutNum }) => (
  <div className={`segment ${active ? 'is-active' : ''}`}>
    <div className="segment__rank">{rank}</div>
    <div className="segment__time">
      {start} → {end}
      <span className="dur">{dur}</span>
    </div>
    <div className="segment__body">
      <div className="segment__body__title">{title}</div>
      <div className="segment__body__reason">{reason}</div>
    </div>
    <div className="segment__right">
      {cut ? <span className="vc-badge vc-badge--success">cut · {cutNum}</span> : null}
      <div className="vc-score">
        {score}
        <span className="vc-score__den">/10</span>
      </div>
      {active ? (
        <button className="vc-btn vc-btn--primary vc-btn--sm">
          <Icons.Scissors size={14} />
          Cut clip
        </button>
      ) : (
        <button className="vc-btn vc-btn--secondary vc-btn--sm">
          <Icons.Play size={14} />
          Play
        </button>
      )}
    </div>
  </div>
);

const Player = ({
  title = 'How to ship great products without protecting every legacy interface',
  duration = '30:23',
}) => (
  <div className="player">
    <div className="player__bg"></div>
    <div className="player__title">
      <Icons.Youtube size={14} />
      <span>{title}</span>
      <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{duration}</span>
    </div>
    <div className="player__play">
      <Icons.PlayFilled size={28} style={{ marginLeft: 4 }} />
    </div>
  </div>
);

const Timeline = ({
  segments,
  currentPct = 14,
  current = '02:14',
  duration = '30:23',
  cutCount = 4,
}) => (
  <div className="timeline">
    <div className="timeline__head">
      <div>
        <span className="now">{current}</span> <span style={{ marginLeft: 8 }}>/ {duration}</span>
      </div>
      <div>
        {segments.length} segments · {cutCount} cut
      </div>
    </div>
    <div className="timeline__track">
      {segments.map((s, i) => (
        <div
          key={i}
          className={`timeline__seg ${s.active ? 'timeline__seg--active' : ''} ${s.cut ? 'timeline__seg--cut' : ''}`}
          style={{ left: `${s.left}%`, width: `${s.width}%` }}
        >
          <span className="timeline__seg__label">{String(i + 1).padStart(2, '0')}</span>
        </div>
      ))}
      <div className="timeline__head__cursor" style={{ left: `${currentPct}%` }}></div>
    </div>
    <div className="timeline__ticks">
      <span>00:00</span>
      <span>05:00</span>
      <span>10:00</span>
      <span>15:00</span>
      <span>20:00</span>
      <span>25:00</span>
      <span>30:00</span>
    </div>
  </div>
);

// Default sample data
const SAMPLE_SEGMENTS = [
  {
    rank: '01',
    start: '01:14',
    end: '01:42',
    dur: '28s',
    title: 'Cold open setup',
    reason: 'funny storytelling moment · transcript',
    score: 9,
  },
  {
    rank: '02',
    start: '02:14',
    end: '02:48',
    dur: '34s',
    title: 'Strong controversial opinion',
    reason: "“You can't ship great products and protect every legacy interface.”",
    score: 9,
    active: true,
  },
  {
    rank: '03',
    start: '06:42',
    end: '07:14',
    dur: '32s',
    title: 'Audience reaction · laugh',
    reason: 'audio event · spike at 07:01',
    score: 8,
  },
  {
    rank: '04',
    start: '09:36',
    end: '10:18',
    dur: '42s',
    title: 'Counter-argument from the host',
    reason: 'debate moment · transcript + audio',
    score: 8,
    cut: true,
    cutNum: '02',
  },
  {
    rank: '05',
    start: '13:22',
    end: '13:54',
    dur: '32s',
    title: 'Reframe of the original question',
    reason: 'key insight · transcript',
    score: 8,
  },
  {
    rank: '06',
    start: '16:08',
    end: '16:35',
    dur: '27s',
    title: 'Callback to the cold open',
    reason: 'narrative payoff · transcript',
    score: 7,
  },
];

const SAMPLE_TIMELINE = [
  { left: 4, width: 5 },
  { left: 11, width: 6, active: true },
  { left: 22, width: 4 },
  { left: 32, width: 7, cut: true },
  { left: 44, width: 4 },
  { left: 53, width: 5 },
  { left: 63, width: 6 },
  { left: 75, width: 4, cut: true },
  { left: 84, width: 5, cut: true },
  { left: 92, width: 5, cut: true },
];

const MainScreen = ({ theme, onTheme }) => (
  <div className="screen-root" data-theme={theme}>
    <TopBar state="done" theme={theme} onTheme={onTheme} />
    <div className="shell">
      {/* LEFT — pipeline rail (hero) */}
      <aside className="rail">
        <h4 className="rail__h">Pipeline</h4>
        <Pipeline
          steps={[
            {
              name: 'Fetch transcript',
              t: '1.2s',
              state: 'done',
              detail: 'youtube-transcript-api',
            },
            { name: 'LLM analysis', t: '11.4s', state: 'done', detail: '22 chunks · gpt-4o-mini' },
            { name: 'Refine boundaries', t: '3.8s', state: 'done', detail: '10 segments scored' },
            { name: 'Cut clips', t: '6.1s', state: 'done', detail: '4 clips · ffmpeg' },
          ]}
        />
        <h4 className="rail__h" style={{ marginTop: 28 }}>
          Run summary
        </h4>
        <div className="rail__group">
          <div className="rail__row">
            <span className="label">Duration</span>
            <span className="val">30:23</span>
          </div>
          <div className="rail__row">
            <span className="label">Chunks</span>
            <span className="val">22</span>
          </div>
          <div className="rail__row">
            <span className="label">Segments</span>
            <span className="val">10</span>
          </div>
          <div className="rail__row">
            <span className="label">Clips cut</span>
            <span className="val">4</span>
          </div>
          <div className="rail__row">
            <span className="label">Cache</span>
            <span className="val">hit</span>
          </div>
        </div>
        <button className="vc-btn vc-btn--secondary" style={{ width: '100%', marginTop: 12 }}>
          <Icons.Download size={14} />
          Download all clips
        </button>
      </aside>

      {/* CENTER — player + segments */}
      <div className="main">
        <Player />
        <Timeline segments={SAMPLE_TIMELINE} />
        <div className="sect">
          <div className="sect__h">
            <h3>Top segments</h3>
            <div className="meta">10 results · sorted by score</div>
          </div>
          <div className="segments">
            {SAMPLE_SEGMENTS.map((s) => (
              <SegmentRow key={s.rank} {...s} />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — settings */}
      <aside className="side">
        <h4 className="side__h">Settings</h4>
        <div className="side__group">
          <div className="vc-field">
            <label className="vc-label">Score threshold</label>
            <input type="range" className="vc-slider" min="1" max="10" defaultValue="7" />
            <div className="slider-labels">
              <span>1</span>
              <span className="active">7</span>
              <span>10</span>
            </div>
          </div>
          <div className="vc-field">
            <label className="vc-label">Top N segments</label>
            <input
              type="number"
              className="vc-input"
              defaultValue="10"
              style={{ fontFamily: 'var(--vc-font-mono)' }}
            />
          </div>
          <div className="vc-field">
            <label className="vc-label">Profile</label>
            <select className="vc-select" defaultValue="general">
              <option value="general">general</option>
              <option>valorant</option>
              <option>fps</option>
              <option>boss_fight</option>
            </select>
          </div>
          <label className="toggle-row">
            Audio event detection
            <span className="vc-toggle">
              <input type="checkbox" defaultChecked />
              <span className="vc-toggle__track"></span>
              <span className="vc-toggle__thumb"></span>
            </span>
          </label>
          <label className="toggle-row">
            Refine boundaries
            <span className="vc-toggle">
              <input type="checkbox" defaultChecked />
              <span className="vc-toggle__track"></span>
              <span className="vc-toggle__thumb"></span>
            </span>
          </label>
        </div>

        <h4 className="side__h">Output</h4>
        <div className="side__group">
          <div className="rail__row">
            <span className="label">Format</span>
            <span className="val">mp4</span>
          </div>
          <div className="rail__row">
            <span className="label">Aspect</span>
            <span className="val">9:16</span>
          </div>
          <div className="rail__row">
            <span className="label">Folder</span>
            <span className="val val--ellipsis">~/clips/ship</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

window.MainScreen = MainScreen;
window.Pipeline = Pipeline;
window.SegmentRow = SegmentRow;
window.Player = Player;
window.Timeline = Timeline;
window.SAMPLE_SEGMENTS = SAMPLE_SEGMENTS;
window.SAMPLE_TIMELINE = SAMPLE_TIMELINE;
