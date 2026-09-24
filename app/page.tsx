import {redirect} from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {ArrowRight, Check, Gauge, Link2, Mic2, Type, WandSparkles} from "lucide-react";
import {LandingReveal} from "../components/landing-reveal";
import {TypeCycle} from "../components/type-cycle";
import {getCurrentUser} from "./auth";

export const dynamic = "force-dynamic";

const steps = [
  {number: "01", title: "Paste", copy: "Drop a YouTube Music link.", Icon: Link2},
  {number: "02", title: "Separate", copy: "Lead vocal off; backing stays.", Icon: Mic2},
  {number: "03", title: "Sync", copy: "Beat-aware lyric timeline.", Icon: Gauge},
  {number: "04", title: "Export", copy: "Download the karaoke video.", Icon: WandSparkles},
];

const wave = (seed: number, count: number, base = 10, span = 28) =>
  Array.from({length: count}, (_, i) => base + ((i * seed * 17 + seed * 9) % span));

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/studio");

  const actionHref = "/signin";
  const actionLabel = "Start free";
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
        <Link className="landing-wordmark" href="/" aria-label="AK Studio home">
          <span><Image src="/logoak.svg" alt="" width={1080} height={1080} /></span>
          <b>Studio</b>
        </Link>
        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#type">Type</a>
          <a href="#plans">Plans</a>
        </div>
        <div className="landing-nav-actions">
          <a className="nav-account" href="/signin">
            Sign in
          </a>
          <a className="nav-primary" href={actionHref}>
            {actionLabel}
            <ArrowRight />
          </a>
          <details className="landing-nav-menu">
            <summary aria-label="Open menu">Menu</summary>
            <div className="landing-nav-menu-panel">
              <a href="#product">Product</a>
              <a href="#type">Type</a>
              <a href="#plans">Plans</a>
              <a href="/signin">Sign in</a>
              <a className="nav-primary" href={actionHref}>
                {actionLabel}
                <ArrowRight />
              </a>
            </div>
          </details>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-copy landing-fade-in">
          <p className="eyebrow">Karaoke editor</p>
          <h1>Music in. Karaoke out.</h1>
          <p className="hero-lede">
            Paste a link. We find lyrics, isolate the lead vocal, and open a beat-aware timeline.
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href={actionHref}>
              {actionLabel}
              <ArrowRight />
            </a>
            <a className="text-cta" href="#product">
              How it works
            </a>
          </div>
          <p className="hero-note">Free · 1 video / week · No card</p>
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
              <PlayIcon />
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
              <b>Don&apos;t look back</b>
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
              <i style={{left: "82%", width: "14%"}}>Don&apos;t look</i>
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
              <span className="process-icon" aria-hidden="true">
                <step.Icon />
              </span>
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
            Two moves.
            <br />
            One video.
          </h2>
        </LandingReveal>

        <div className="story-grid">
          <LandingReveal as="article" className="story-card" delay={60}>
            <div className="story-visual paste-visual">
              <div className="glass-chip">
                <Link2 />
                <span>Paste link</span>
              </div>
              <div className="paste-field">
                <span>music.youtube.com/…</span>
                <b>Create</b>
              </div>
              <div className="paste-meta">
                <i />
                <div>
                  <strong>Neon Skyline</strong>
                  <small>Lyrics · 3:42</small>
                </div>
              </div>
            </div>
            <div className="story-copy">
              <span>01</span>
              <h3>Paste a link</h3>
              <p>Public YouTube or YouTube Music. Title, artist, and lyrics land in the editor.</p>
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
                  <Gauge /> Backing
                </div>
                <div className="stem-wave">
                  {wave(11, 36, 8, 26).map((h, i) => (
                    <span key={i} style={{height: `${h}px`}} />
                  ))}
                </div>
              </div>
              <div className="glass-chip stem-chip">Auto-separate</div>
            </div>
            <div className="story-copy">
              <span>02</span>
              <h3>Separate vocals</h3>
              <p>Lead vocal off the mix. Instrumental and backing stay on the timeline.</p>
            </div>
          </LandingReveal>
        </div>
      </section>

      <section className="landing-section type-section" id="type" aria-labelledby="type-title">
        <LandingReveal as="header">
          <p className="eyebrow">Typography</p>
          <h2 id="type-title">
            Type that
            <br />
            fits the song.
          </h2>
        </LandingReveal>
        <LandingReveal>
          <p className="type-lede">Three faces. Size, weight, and timing—yours.</p>
        </LandingReveal>
        <LandingReveal delay={80}>
          <TypeCycle />
        </LandingReveal>
      </section>

      <section className="landing-section product-section">
        <LandingReveal as="header">
          <p className="eyebrow">Built for finish</p>
          <h2>
            Link to
            <br />
            stage-ready.
          </h2>
        </LandingReveal>
        <div className="feature-grid">
          <LandingReveal as="article" delay={40}>
            <Link2 />
            <span>01</span>
            <h3>Link in</h3>
            <p>YouTube Music → lyrics + audio in one editor.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={100}>
            <Mic2 />
            <span>02</span>
            <h3>Vocal off</h3>
            <p>Lead isolated; backing and instrumental stay.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={160}>
            <Gauge />
            <span>03</span>
            <h3>On the beat</h3>
            <p>BPM markers and magnetic lyric snaps.</p>
          </LandingReveal>
          <LandingReveal as="article" delay={220}>
            <Type />
            <span>04</span>
            <h3>Your type</h3>
            <p>Restyle each line. Save font collections.</p>
          </LandingReveal>
        </div>
      </section>

      <section className="landing-section plans-section" id="plans">
        <LandingReveal as="header">
          <p className="eyebrow">Plans</p>
          <h2>
            Free first.
            <br />
            Pro when ready.
          </h2>
        </LandingReveal>
        <LandingReveal>
          <div className="landing-plans">
            <article>
              <div>
                <span>Free</span>
                <strong>
                  $0<small>/mo</small>
                </strong>
                <p>Try the full flow.</p>
              </div>
              <ul>
                <li>
                  <Check />1 video / week
                </li>
                <li>
                  <Check />
                  Open-source separation
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
                  $13<small>/mo</small>
                </strong>
                <p>Publish often.</p>
              </div>
              <ul>
                <li>
                  <Check />
                  Unlimited videos
                </li>
                <li>
                  <Check />
                  Best-quality separation
                </li>
                <li>
                  <Check />
                  No watermark
                </li>
              </ul>
              <a href={actionHref}>
                Start free
                <ArrowRight />
              </a>
            </article>
          </div>
        </LandingReveal>
      </section>

      <LandingReveal as="section" className="landing-final">
        <p className="eyebrow">Ready when you are</p>
        <h2>Make the words move.</h2>
        <a href={actionHref}>
          {actionLabel}
          <ArrowRight />
        </a>
      </LandingReveal>

      <footer className="landing-footer">
        <Link className="landing-wordmark" href="/" aria-label="AK Studio home">
          <span><Image src="/logoak.svg" alt="" width={1080} height={1080} /></span>
          <b>Studio</b>
        </Link>
        <p>Music in. Karaoke out.</p>
        <span>© 2026 AK Studio</span>
      </footer>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
