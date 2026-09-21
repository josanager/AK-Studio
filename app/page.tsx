import {ArrowRight, Check, Gauge, Link2, Mic2, Play, Type} from "lucide-react";
import {LandingReveal} from "../components/landing-reveal";
import {getCurrentUser} from "./auth";

export const dynamic = "force-dynamic";

const steps = [
  {number: "01", title: "Paste", copy: "Add a YouTube or YouTube Music link."},
  {number: "02", title: "Separate", copy: "Remove the lead vocal while keeping the instrumental and backing vocals."},
  {number: "03", title: "Sync", copy: "Edit lyrics on a beat-aware timeline."},
  {number: "04", title: "Export", copy: "Download a finished karaoke video."},
];

const typefaces = [
  {
    name: "Condensed Bold",
    sample: "Sing it like you mean it",
    family: '"Avenir Next Condensed", "Avenir Next", sans-serif',
    weight: 800,
    style: "normal" as const,
    letter: "-0.04em",
  },
  {
    name: "Display Serif",
    sample: "Hold the night a little longer",
    family: "Georgia, 'Times New Roman', serif",
    weight: 700,
    style: "italic" as const,
    letter: "-0.02em",
  },
  {
    name: "Mono Punch",
    sample: "ONE MORE TIME",
    family: '"Courier New", Courier, monospace',
    weight: 700,
    style: "normal" as const,
    letter: "0.04em",
  },
  {
    name: "Heavy Impact",
    sample: "Don't stop now",
    family: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
    weight: 400,
    style: "normal" as const,
    letter: "0.01em",
  },
  {
    name: "Classic Book",
    sample: "Every word in place",
    family: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif",
    weight: 700,
    style: "normal" as const,
    letter: "-0.01em",
  },
  {
    name: "Clean Sans",
    sample: "Make the words move",
    family: '"Trebuchet MS", "Segoe UI", sans-serif',
    weight: 700,
    style: "normal" as const,
    letter: "-0.03em",
  },
];

const wave = (seed: number, count: number, base = 10, span = 28) =>
  Array.from({length: count}, (_, i) => base + ((i * seed * 17 + seed * 9) % span));

export default async function Home() {
  const user = await getCurrentUser();
  const actionHref = user ? "/studio" : "/signin";
  const actionLabel = user ? "Open studio" : "Start free";
  const backingBars = wave(3, 52);
  const vocalBars = wave(7, 52, 6, 22);

  return (
    <main className="landing">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital,wght@0,700;1,700&family=Space+Mono:wght@700&display=swap"
      />

      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-wordmark" href="/" aria-label="AK Studio home">
          <span>AK</span>
          <b>Studio</b>
        </a>
        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#type">Type</a>
          <a href="#plans">Plans</a>
        </div>
        <div className="landing-nav-actions">
          {user ? (
            <a className="nav-account" href="/account">
              Account
            </a>
          ) : (
            <a className="nav-account" href="/signin">
              Sign in
            </a>
          )}
          <a className="nav-primary" href={actionHref}>
            {actionLabel}
            <ArrowRight />
          </a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy landing-fade-in">
          <p className="eyebrow">Karaoke video editor</p>
          <h1>Turn any song into a karaoke video.</h1>
          <p className="hero-lede">
            Paste a music link. AK Studio finds the lyrics, isolates the lead vocal, and gives you a precise timeline to make it yours.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href={actionHref}>
              {actionLabel}
              <ArrowRight />
            </a>
            <a className="text-cta" href="#product">
              See how it works
            </a>
          </div>
          <p className="hero-note">One video every week on Free. No card required.</p>
        </div>

        <div className="product-frame landing-fade-in landing-fade-in-delay" aria-label="AK Studio editor preview">
          <div className="mock-top">
            <span>
              <i>AK</i> Neon Skyline — Karaoke
            </span>
            <b>
              118 <small>BPM</small>
            </b>
            <button type="button" aria-label="Play preview">
              <Play fill="currentColor" />
            </button>
          </div>

          <div className="mock-source">
            <Link2 />
            <span>music.youtube.com/watch?v=ak-studio-demo</span>
            <em>Ready</em>
          </div>

          <div className="mock-workspace">
            <div className="mock-dock" aria-hidden="true">
              <span className="active" />
              <span />
              <span />
              <span />
            </div>
            <div className="mock-stage">
              <div className="mock-stage-meta">
                <span>AK / PREVIEW</span>
                <span>16:9</span>
              </div>
              <p className="mock-prev">Hold the night</p>
              <strong>Sing it like you mean it</strong>
              <div className="mock-progress" aria-hidden="true">
                <i />
              </div>
              <p className="mock-next">One more time</p>
              <small>AK STUDIO</small>
            </div>
            <div className="mock-inspector">
              <span>LYRICS</span>
              <b>Hold the night</b>
              <b className="active">Sing it like you mean it</b>
              <b>One more time</b>
              <b>Don't look back</b>
              <div className="mock-type-panel">
                <span>TYPE</span>
                <em style={{fontFamily: '"Avenir Next Condensed", sans-serif'}}>Condensed</em>
                <div className="mock-type-row">
                  <i>72</i>
                  <i>Bold</i>
                </div>
              </div>
            </div>
          </div>

          <div className="mock-timeline">
            <div className="mock-ruler">
              <span>00:00</span>
              <span>00:15</span>
              <span>00:30</span>
              <span>00:45</span>
              <span>01:00</span>
            </div>
            <div className="mock-beats" aria-hidden="true">
              {Array.from({length: 16}).map((_, i) => (
                <i key={i} className={i % 4 === 0 ? "bar" : undefined} />
              ))}
            </div>
            <div className="mock-playhead" />
            <div className="mock-track lyrics">
              <em>LYRICS</em>
              <i style={{left: "6%", width: "18%"}}>Hold the night</i>
              <i className="selected" style={{left: "28%", width: "26%"}}>
                Sing it like
              </i>
              <i style={{left: "58%", width: "20%"}}>One more time</i>
              <i style={{left: "82%", width: "14%"}}>Don't look</i>
            </div>
            <div className="mock-track audio backing">
              <em>BACKING</em>
              <div>
                {backingBars.map((h, i) => (
                  <span key={i} style={{height: `${h}px`}} />
                ))}
              </div>
            </div>
            <div className="mock-track audio vocal">
              <em>VOCAL</em>
              <div>
                {vocalBars.map((h, i) => (
                  <span key={i} style={{height: `${h}px`}} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingReveal as="section" className="process-strip" delay={40}>
        <div id="product" className="process-strip-inner" aria-label="How it works">
          {steps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </LandingReveal>

      <section className="landing-section story-section" aria-labelledby="story-title">
        <LandingReveal as="header">
          <p className="eyebrow">The flow</p>
          <h2 id="story-title">
            Three moves.
            <br />
            One finished video.
          </h2>
        </LandingReveal>

        <div className="story-grid">
          <LandingReveal as="article" className="story-card" delay={60}>
            <div className="story-visual paste-visual">
              <div className="glass-chip">
                <Link2 />
                <span>Paste YouTube link</span>
              </div>
              <div className="paste-field">
                <span>https://music.youtube.com/watch?v=…</span>
                <b>Create</b>
              </div>
              <div className="paste-meta">
                <i />
                <div>
                  <strong>Neon Skyline</strong>
                  <small>Lyrics found · 3:42</small>
                </div>
              </div>
            </div>
            <div className="story-copy">
              <span>01</span>
              <h3>Just paste a YouTube link</h3>
              <p>Drop a public YouTube or YouTube Music URL. Title, artist, and lyrics arrive in the editor—no audio upload, no file prep.</p>
            </div>
          </LandingReveal>

          <LandingReveal as="article" className="story-card reverse" delay={120}>
            <div className="story-visual stem-visual">
              <div className="stem-panel">
                <div className="stem-label">
                  <Mic2 /> Lead vocal
                </div>
                <div className="stem-wave muted">
                  {wave(5, 36, 4, 18).map((h, i) => (
                    <span key={i} style={{height: `${h}px`}} />
                  ))}
                </div>
              </div>
              <div className="stem-panel active">
                <div className="stem-label">
                  <Gauge /> Backing + instrumental
                </div>
                <div className="stem-wave">
                  {wave(11, 36, 8, 26).map((h, i) => (
                    <span key={i} style={{height: `${h}px`}} />
                  ))}
                </div>
              </div>
              <div className="glass-chip stem-chip">Auto-detect · Separate</div>
            </div>
            <div className="story-copy">
              <span>02</span>
              <h3>Auto-detect and separate vocals</h3>
              <p>Lead vocal comes off the mix while the instrumental and backing vocals stay. Mix stems on a beat-aware timeline.</p>
            </div>
          </LandingReveal>
        </div>
      </section>

      <section className="landing-section type-section" id="type" aria-labelledby="type-title">
        <LandingReveal as="header">
          <p className="eyebrow">Typography</p>
          <h2 id="type-title">
            Edit karaoke type
            <br />
            until it feels right.
          </h2>
        </LandingReveal>
        <LandingReveal>
          <p className="type-lede">Pick a face, size, and weight. Save favorite collections to your account—projects stay ephemeral.</p>
        </LandingReveal>
        <div className="type-showcase">
          {typefaces.map((face, index) => (
            <LandingReveal as="article" key={face.name} className="type-card" delay={index * 70}>
              <div
                className="type-stage"
                style={{
                  fontFamily: face.family,
                  fontWeight: face.weight,
                  fontStyle: face.style,
                  letterSpacing: face.letter,
                }}
              >
                <span>{face.sample}</span>
                <i aria-hidden="true" />
              </div>
              <footer>
                <Type />
                <b>{face.name}</b>
              </footer>
            </LandingReveal>
          ))}
        </div>
        <div className="type-showcase type-showcase-web">
          <LandingReveal as="article" className="type-card" delay={80}>
            <div className="type-stage face-bebas">
              <span>TURN IT UP</span>
              <i aria-hidden="true" />
            </div>
            <footer>
              <Type />
              <b>Bebas Neue</b>
            </footer>
          </LandingReveal>
          <LandingReveal as="article" className="type-card" delay={140}>
            <div className="type-stage face-playfair">
              <span>Softly, for the room</span>
              <i aria-hidden="true" />
            </div>
            <footer>
              <Type />
              <b>Playfair Display</b>
            </footer>
          </LandingReveal>
          <LandingReveal as="article" className="type-card" delay={200}>
            <div className="type-stage face-mono">
              <span>SYNC_TO_BEAT</span>
              <i aria-hidden="true" />
            </div>
            <footer>
              <Type />
              <b>Space Mono</b>
            </footer>
          </LandingReveal>
        </div>
      </section>

      <section className="landing-section product-section">
        <LandingReveal as="header">
          <p className="eyebrow">Built for the last mile</p>
          <h2>
            From raw track to
            <br />
            stage-ready video.
          </h2>
        </LandingReveal>
        <div className="feature-grid">
          <LandingReveal as="article" delay={40}>
            <Link2 />
            <span>01</span>
            <h3>Link to timeline</h3>
            <p>Start from YouTube or YouTube Music. Lyrics and audio arrive together in the editor.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={100}>
            <Mic2 />
            <span>02</span>
            <h3>Lead vocal isolation</h3>
            <p>Keep the instrumental and backing vocals while separating the main performance.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={160}>
            <Gauge />
            <span>03</span>
            <h3>Beat-aware editing</h3>
            <p>BPM markers and magnetic snapping help every lyric land exactly where it should.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={220}>
            <Type />
            <span>04</span>
            <h3>Your type, your timing</h3>
            <p>Move, restyle, and refine each lyric. Save favorite font collections to your account.</p>
          </LandingReveal>
        </div>
      </section>

      <section className="landing-section plans-section" id="plans">
        <LandingReveal as="header">
          <p className="eyebrow">Simple plans</p>
          <h2>
            Start free.
            <br />
            Upgrade when ready.
          </h2>
        </LandingReveal>
        <LandingReveal>
          <div className="landing-plans">
            <article>
              <div>
                <span>Free</span>
                <strong>
                  $0<small>/month</small>
                </strong>
                <p>For trying the full workflow.</p>
              </div>
              <ul>
                <li>
                  <Check />1 karaoke video per week
                </li>
                <li>
                  <Check />
                  Open-source vocal separation
                </li>
                <li>
                  <Check />
                  Watermarked export
                </li>
              </ul>
              <a href={actionHref}>
                {actionLabel}
                <ArrowRight />
              </a>
            </article>
            <article className="pro-plan">
              <div>
                <span>Pro</span>
                <strong>
                  $13<small>/month</small>
                </strong>
                <p>For creators who publish regularly.</p>
              </div>
              <ul>
                <li>
                  <Check />
                  Unlimited karaoke videos
                </li>
                <li>
                  <Check />
                  Highest-quality separation
                </li>
                <li>
                  <Check />
                  Exports without a watermark
                </li>
              </ul>
              <a href={actionHref}>
                Start with Free
                <ArrowRight />
              </a>
            </article>
          </div>
        </LandingReveal>
      </section>

      <LandingReveal as="section" className="landing-final">
        <p className="eyebrow">Your next song is ready</p>
        <h2>Make the words move.</h2>
        <a href={actionHref}>
          {actionLabel}
          <ArrowRight />
        </a>
      </LandingReveal>

      <footer className="landing-footer">
        <a className="landing-wordmark" href="/">
          <span>AK</span>
          <b>Studio</b>
        </a>
        <p>Music in. Karaoke out.</p>
        <span>© 2026 AK Studio</span>
      </footer>
    </main>
  );
}
