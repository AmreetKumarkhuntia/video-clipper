// Settings — full preferences screen.
const { Icons, TopBar } = window;

const SettingsScreen = ({ theme, onTheme }) => (
  <div className="screen-root" data-theme={theme}>
    <TopBar state="idle" theme={theme} onTheme={onTheme} />
    <div className="settings-shell">
      <aside className="settings-nav">
        <h4 className="settings-nav__h">Settings</h4>
        <button className="settings-nav__item is-active">
          <Icons.Sparkles size={16} />
          LLM provider
        </button>
        <button className="settings-nav__item">
          <Icons.Gauge size={16} />
          Scoring
        </button>
        <button className="settings-nav__item">
          <Icons.Crop size={16} />
          Output
        </button>
        <button className="settings-nav__item">
          <Icons.Captions size={16} />
          Captions
        </button>
        <button className="settings-nav__item">
          <Icons.Key size={16} />
          Auth &amp; cookies
        </button>
        <button className="settings-nav__item">
          <Icons.Database size={16} />
          Cache
        </button>
        <button className="settings-nav__item">
          <Icons.Terminal size={16} />
          Advanced
        </button>
        <div className="settings-nav__sep"></div>
        <button className="settings-nav__item">
          <Icons.Type size={16} />
          Appearance
        </button>
      </aside>

      <div className="settings-main">
        <div className="settings-head">
          <h2>LLM provider</h2>
          <p className="settings-head__sub">
            Which model scores transcript chunks and refines clip boundaries.
          </p>
        </div>

        <section className="settings-section">
          <div className="settings-section__h">
            <h3>Provider</h3>
            <span className="meta">used for scoring + refinement</span>
          </div>
          <div className="provider-grid">
            {[
              { name: 'OpenAI', model: 'gpt-4o-mini', chip: 'default', active: true, k: 'openai' },
              { name: 'Anthropic', model: 'claude-haiku-4-5', chip: 'fastest', k: 'anthropic' },
              { name: 'Local', model: 'llama-3.2 · ollama', chip: 'free', k: 'local' },
              { name: 'Google', model: 'gemini-2.5-flash', k: 'google' },
            ].map((p) => (
              <div key={p.k} className={`provider ${p.active ? 'is-active' : ''}`}>
                <div className="provider__head">
                  <span className="provider__name">{p.name}</span>
                  {p.chip ? <span className="vc-badge vc-badge--clay">{p.chip}</span> : null}
                </div>
                <div className="provider__model">{p.model}</div>
                {p.active ? (
                  <div className="provider__check">
                    <Icons.Check size={14} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__h">
            <h3>Credentials</h3>
            <span className="meta">stored locally · never leaves your machine</span>
          </div>
          <div className="settings-form">
            <div className="vc-field">
              <label className="vc-label">API key</label>
              <input
                type="password"
                className="vc-input"
                defaultValue="sk-proj-••••••••••••••••••••••••"
                style={{ fontFamily: 'var(--vc-font-mono)' }}
              />
              <span className="vc-help">
                Stored in <code>~/.config/video-clipper/keys</code>
              </span>
            </div>
            <div className="vc-field">
              <label className="vc-label">Organization (optional)</label>
              <input type="text" className="vc-input" placeholder="org-…" />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__h">
            <h3>Run defaults</h3>
            <span className="meta">applied to every new run</span>
          </div>
          <div className="settings-form settings-form--two">
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
                <option>general</option>
                <option>valorant</option>
                <option>fps</option>
                <option>boss_fight</option>
              </select>
            </div>
            <div className="vc-field">
              <label className="vc-label">Chunk size</label>
              <input
                type="text"
                className="vc-input"
                defaultValue="600 tokens"
                style={{ fontFamily: 'var(--vc-font-mono)' }}
              />
            </div>
          </div>

          <div className="settings-toggles">
            <label className="toggle-row">
              <div>
                <div className="toggle-row__t">Audio event detection</div>
                <div className="toggle-row__d">
                  Boost segments with audible reactions (laughter, applause).
                </div>
              </div>
              <span className="vc-toggle">
                <input type="checkbox" defaultChecked />
                <span className="vc-toggle__track"></span>
                <span className="vc-toggle__thumb"></span>
              </span>
            </label>
            <label className="toggle-row">
              <div>
                <div className="toggle-row__t">Refine clip boundaries</div>
                <div className="toggle-row__d">
                  Second LLM pass to snap cuts to sentence breaks.
                </div>
              </div>
              <span className="vc-toggle">
                <input type="checkbox" defaultChecked />
                <span className="vc-toggle__track"></span>
                <span className="vc-toggle__thumb"></span>
              </span>
            </label>
            <label className="toggle-row">
              <div>
                <div className="toggle-row__t">Cache transcripts</div>
                <div className="toggle-row__d">
                  Re-runs on the same URL skip the fetch + scoring step.
                </div>
              </div>
              <span className="vc-toggle">
                <input type="checkbox" defaultChecked />
                <span className="vc-toggle__track"></span>
                <span className="vc-toggle__thumb"></span>
              </span>
            </label>
          </div>
        </section>

        <div className="settings-foot">
          <span className="meta">Changes are saved automatically.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="vc-btn vc-btn--ghost">Reset to defaults</button>
            <button className="vc-btn vc-btn--primary">Test connection</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.SettingsScreen = SettingsScreen;
