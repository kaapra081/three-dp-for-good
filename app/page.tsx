"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type View = "home" | "work" | "classes" | "sponsors" | "team" | "contact";

const navItems: Array<{ id: View; label: string }> = [
  { id: "home", label: "Home" },
  { id: "work", label: "Our work" },
  { id: "classes", label: "Classes" },
  { id: "sponsors", label: "Sponsors" },
  { id: "team", label: "About the team" },
  { id: "contact", label: "Contact" },
];

const galleryImages = [
  { src: "/assets/class-workshop-01.png", alt: "Students learning CAD together during a 3DP for Good workshop" },
  { src: "/assets/class-workshop-02.png", alt: "" },
  { src: "/assets/class-workshop-03.png", alt: "" },
  { src: "/assets/class-workshop-05.png", alt: "" },
  { src: "/assets/class-workshop-06.png", alt: "" },
  { src: "/assets/class-workshop-07.png", alt: "" },
];

function Wordmark({ footer = false }: { footer?: boolean }) {
  return (
    <button className={`wordmark${footer ? " footer-wordmark" : ""}`} type="button">
      <span>3DP FOR GOOD<span className="wordmark-dot">.</span></span>
    </button>
  );
}

function PageLabel({ number, title, aside }: { number: string; title: string; aside?: string }) {
  return <div className="page-label">{number} / {title} {aside ? <span>{aside}</span> : null}</div>;
}

function Arrow() {
  return <span aria-hidden="true" className="arrow">↗</span>;
}

type Point3 = [number, number, number];
type Triangle = [Point3, Point3, Point3];

function parseStl(buffer: ArrayBuffer): Triangle[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const triangleCount = bytes.length >= 84 ? view.getUint32(80, true) : 0;
  const isBinary = triangleCount > 0 && 84 + triangleCount * 50 <= bytes.length;
  if (isBinary) {
    const triangles: Triangle[] = [];
    let offset = 84;
    for (let i = 0; i < triangleCount; i += 1) {
      offset += 12;
      const points: Point3[] = [];
      for (let j = 0; j < 3; j += 1) {
        points.push([view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)]);
        offset += 12;
      }
      triangles.push(points as Triangle);
      offset += 2;
    }
    return triangles;
  }
  const text = new TextDecoder().decode(bytes);
  const vertices = [...text.matchAll(/vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g)].map(
    (match) => [Number(match[1]), Number(match[2]), Number(match[3])] as Point3,
  );
  const triangles: Triangle[] = [];
  for (let i = 0; i + 2 < vertices.length; i += 3) triangles.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  return triangles;
}

function ModelViewer({ file, label }: { file: string; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trianglesRef = useRef<Triangle[]>([]);
  const rotationRef = useRef({ x: -0.35, y: 0.55 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [solid, setSolid] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch(`/assets/${file}`)
      .then((response) => response.arrayBuffer())
      .then((buffer) => {
        if (!mounted) return;
        trianglesRef.current = parseStl(buffer);
        setLoaded(true);
      })
      .catch(() => setLoaded(false));
    return () => { mounted = false; };
  }, [file]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * dpr));
    const height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    context.fillStyle = "#e6e5df";
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = "rgba(82,103,201,.18)";
    context.lineWidth = 1;
    for (let x = 0; x < bounds.width; x += 20) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, bounds.height); context.stroke(); }
    for (let y = 0; y < bounds.height; y += 20) { context.beginPath(); context.moveTo(0, y); context.lineTo(bounds.width, y); context.stroke(); }
    const triangles = trianglesRef.current;
    if (!triangles.length) {
      context.fillStyle = "#5267c9";
      context.font = "800 11px SFMono-Regular, Consolas, monospace";
      context.textAlign = "center";
      context.fillText("LOADING MODEL", bounds.width / 2, bounds.height / 2);
      return;
    }
    const points = triangles.flat();
    const mins: Point3 = [Infinity, Infinity, Infinity];
    const maxs: Point3 = [-Infinity, -Infinity, -Infinity];
    for (const point of points) for (let axis = 0; axis < 3; axis += 1) { mins[axis] = Math.min(mins[axis], point[axis]); maxs[axis] = Math.max(maxs[axis], point[axis]); }
    const center: Point3 = [(mins[0] + maxs[0]) / 2, (mins[1] + maxs[1]) / 2, (mins[2] + maxs[2]) / 2];
    const span = Math.max(maxs[0] - mins[0], maxs[1] - mins[1], maxs[2] - mins[2]) || 1;
    const scale = Math.min(bounds.width, bounds.height) * 0.72 / span;
    const { x: rotX, y: rotY } = rotationRef.current;
    const project = (point: Point3) => {
      const x = point[0] - center[0]; const y = point[1] - center[1]; const z = point[2] - center[2];
      const cy = Math.cos(rotY); const sy = Math.sin(rotY); const cx = Math.cos(rotX); const sx = Math.sin(rotX);
      const x1 = x * cy - z * sy; const z1 = x * sy + z * cy; const y1 = y * cx - z1 * sx; const z2 = y * sx + z1 * cx;
      return { x: bounds.width / 2 + x1 * scale, y: bounds.height / 2 - y1 * scale, z: z2 };
    };
    const projected = triangles.map((triangle) => {
      const projectedTriangle = triangle.map(project);
      return { triangle: projectedTriangle, depth: projectedTriangle.reduce((sum, point) => sum + point.z, 0) / 3 };
    }).sort((a, b) => a.depth - b.depth);
    for (const item of projected) {
      const [a, b, c] = item.triangle;
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.closePath();
      if (solid) { const shade = Math.max(0, Math.min(25, Math.round((item.depth / span) * 18))); context.fillStyle = `rgb(${244 - shade}, ${242 - shade}, ${235 - shade})`; context.fill(); }
      context.strokeStyle = solid ? "#151719" : "#5267c9"; context.lineWidth = solid ? 0.65 : 0.9; context.stroke();
    }
  }, [solid]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    const frame = window.requestAnimationFrame(() => draw());
    return () => { window.removeEventListener("resize", handleResize); window.cancelAnimationFrame(frame); };
  }, [draw, loaded]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const deltaX = event.clientX - dragRef.current.x; const deltaY = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    rotationRef.current.y += deltaX * 0.012; rotationRef.current.x += deltaY * 0.012; draw();
  };
  const stopDragging = () => { dragRef.current = null; };

  return (
    <div className="model-viewer">
      <canvas ref={canvasRef} aria-label={label} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={stopDragging} onPointerCancel={stopDragging} onPointerLeave={stopDragging} />
      <span className="model-hint">Drag to rotate</span>
      <span className="model-badge">Actual STL · 1-bit study</span>
      <button className="model-mode-toggle" type="button" aria-pressed={solid} onClick={() => setSolid((value) => !value)}>{solid ? "View solid" : "View wireframe"}</button>
    </div>
  );
}

function SiteNav({ view, onNavigate }: { view: View; onNavigate: (next: View) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (next: View) => { setMenuOpen(false); onNavigate(next); };
  return (
    <header className="site-nav">
      <button className="wordmark" type="button" aria-label="3DP for Good home" onClick={() => navigate("home")}><span>3DP FOR GOOD<span className="wordmark-dot">.</span></span></button>
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((value) => !value)}><span>Menu</span><span className="menu-lines" aria-hidden="true"><i /><i /></span></button>
      <nav id="main-navigation" className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
        {navItems.map((item) => <button key={item.id} type="button" className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}>{item.label}</button>)}
      </nav>
    </header>
  );
}

function HomeView({ onNavigate }: { onNavigate: (next: View) => void }) {
  return (
    <section className="tab-page home-page" aria-labelledby="home-title">
      <PageLabel number="01" title="Home" aside="Patient-centered making" />
      <div className="home-layout">
        <div className="home-copy">
          <h1 id="home-title">Make<br /><em>more</em><br />possible.</h1>
          <p className="home-lede">We design, 3D-print, and donate practical tools that make care more comfortable, accessible, and independent. 3DP for Good is a 501(c)(3) pending organization.</p>
          <div className="home-bach-feature"><img src="/assets/bach-logo.png" alt="Bay Area Community Health — official partner and sponsor" /><span>Official partner + sponsor</span></div>
          <button className="text-link" type="button" onClick={() => onNavigate("work")}>See our current work <Arrow /></button>
        </div>
        <div className="home-visual">
          <div className="home-video-frame"><video autoPlay muted loop playsInline aria-label="A 3D printer making an assistive tool"><source src="/assets/printer-loop.mp4" type="video/mp4" /></video><span className="frame-corner">↘</span></div>
          <div className="printer-stats" aria-label="3DP for Good impact statistics">
            <div className="printed-stat"><strong>100<span>+</span></strong><span>objects</span></div><div className="printed-stat"><strong>1</strong><span>drive</span></div><div className="printed-stat"><strong>2</strong><span>partners</span></div><div className="printed-stat"><strong>4<span>+</span></strong><span>designs</span></div><div className="printed-stat"><strong>60<span>+</span></strong><span>volunteer<br />hours</span></div>
          </div>
        </div>
      </div>
      <div className="home-bottom"><span>Bay Area, California</span><span>501(c)(3) pending organization</span></div>
    </section>
  );
}

function WorkView({ onNavigate }: { onNavigate: (next: View) => void }) {
  return (
    <section className="tab-page work-page" aria-labelledby="work-title">
      <PageLabel number="02" title="Our work" aside="Two designs in progress" />
      <div className="work-heading"><div><p className="eyebrow">Listen · prototype · print · learn</p><h2 id="work-title">Useful <em>by Design.</em></h2><div className="work-intro"><p>We work closely with Dr. Ramchandani at BACH and with patients to understand their needs and design components around them. These are two designs we have created, with more being refined and created now.</p><button className="button button-blue" type="button" onClick={() => onNavigate("contact")}>Talk about a need <Arrow /></button></div></div></div>
      <div className="design-grid">
        <article className="design-card design-blue"><div className="design-card-head"><span>01 / Assistive / adaptive</span></div><div className="design-visual"><ModelViewer file="button-hook-zipper-pull.stl" label="Button hook + zipper pull interactive 3D preview" /></div><a className="design-download" href="/assets/button-hook-zipper-pull.stl" download>Download STL <Arrow /></a><div className="design-card-copy"><div><h3>Button hook + zipper pull</h3><p>The larger grip and hooked ends replace precise fingertip pinching with a broader pulling motion. This reduces fine-motor demand and is designed to place less stress on painful finger joints for people with arthritis or limited dexterity.</p></div><div className="design-card-foot"><span>Target need · hand mobility</span><button type="button" onClick={() => onNavigate("contact")}>Ask about it <Arrow /></button></div></div></article>
        <article className="design-card design-blue"><div className="design-card-head"><span>02 / Assistive / adaptive</span></div><div className="design-visual"><ModelViewer file="book-page-holder.stl" label="Book page holder interactive 3D preview" /></div><a className="design-download" href="/assets/book-page-holder.stl" download>Download STL <Arrow /></a><div className="design-card-copy"><div><h3>Book page holder</h3><p>The holder keeps pages spread without a continuous thumb-and-finger pinch. By reducing sustained grip force, it can make reading more comfortable for people with arthritis, hand weakness, tremors, or limited coordination.</p></div><div className="design-card-foot"><span>Target need · grip + independence</span><button type="button" onClick={() => onNavigate("contact")}>Ask about it <Arrow /></button></div></div></article>
      </div>
      <div className="work-note"><span>Patient voice →</span><span>Open-source spirit →</span><span>Better everyday care →</span></div>
    </section>
  );
}

function ClassesView() {
  const [activeImage, setActiveImage] = useState(0);
  const move = (direction: number) => setActiveImage((index) => (index + direction + galleryImages.length) % galleryImages.length);
  return (
    <section className="tab-page classes-page" aria-labelledby="classes-title">
      <PageLabel number="03" title="Classes" aside="Learn by making" />
      <div className="classes-heading"><h2 id="classes-title">Classes<span>.</span></h2><p>Our workshops turn ideas into practical skills. Students learn CAD, understand the fundamentals of 3D printing, and leave ready to design useful objects with purpose.</p></div>
      <div className="classes-feature"><div className="classes-feature-copy"><p className="classes-status-season">Summer 2026</p><h3>Partnership with Ohlone CAD Club</h3><p>A hands-on workshop in CAD, prototyping, and the fundamentals behind a successful 3D print.</p></div><div className="class-gallery" aria-label="Photos from our summer 2026 CAD workshop" aria-live="off"><div className="class-gallery-stage">{galleryImages.map((image, index) => <figure key={image.src} className={index === activeImage ? "is-active" : ""} aria-hidden={index !== activeImage}><img alt={image.alt} src={image.src} /></figure>)}</div><div className="class-gallery-controls"><div className="class-gallery-progress" aria-hidden="true">{galleryImages.map((image, index) => <i key={image.src} className={index === activeImage ? "is-active" : ""} />)}</div><div><button type="button" aria-label="Previous class photo" onClick={() => move(-1)}>←</button><button type="button" aria-label="Next class photo" onClick={() => move(1)}>→</button></div></div></div></div>
    </section>
  );
}

function SponsorsView({ onNavigate }: { onNavigate: (next: View) => void }) {
  return (
    <section className="tab-page sponsors-page" aria-labelledby="sponsors-title">
      <PageLabel number="04" title="Sponsors" aside="Care in the community" />
      <div className="sponsors-heading"><p className="eyebrow">The organizations behind the work</p><h2 id="sponsors-title">Our partners<span>.</span></h2><p>Support from healthcare and education partners helps us listen closely, teach effectively, and place useful tools where they matter.</p></div>
      <div className="sponsor-grid"><article className="sponsor-card sponsor-bach"><p className="eyebrow">Sponsor + healthcare partner</p><div className="sponsor-logo"><img alt="Bay Area Community Health" src="/assets/bach-logo.png" /></div><div><h3>Bay Area Community Health</h3><p>BACH helps coordinate and distribute our work while connecting us with patient needs. Dr. Ramchandani and patients help guide each design.</p></div></article><article className="sponsor-card sponsor-cad"><p className="eyebrow">Education partner</p><div className="sponsor-logo"><img alt="Ohlone CAD Club" src="/assets/ohlone-cad-club.png" /></div><div><h3>Ohlone CAD Club</h3><p>Together, we introduced students to CAD, prototyping, and the fundamentals of 3D printing through a hands-on summer workshop.</p></div></article><aside className="sponsor-callout" aria-label="Become a sponsor"><img className="question-mark-art" alt="" aria-hidden="true" src="/assets/sponsor-question-mark.png" /><div><p className="eyebrow">Your organization next?</p><h3>Help useful ideas reach more people.</h3></div><button className="button button-blue" type="button" onClick={() => onNavigate("contact")}>Contact us <Arrow /></button></aside></div>
    </section>
  );
}

function TeamView() {
  return (
    <section className="tab-page team-page" aria-labelledby="team-title">
      <PageLabel number="05" title="About the team" aside="The people behind the work" />
      <div className="team-heading"><p className="eyebrow">Meet the team</p><h2 id="team-title">Founders</h2></div>
      <div className="founder-grid"><article className="founder-card"><div className="founder-photo"><img alt="Kaavin Prasanna" src="/assets/kaavin-prasanna.png" /></div><p>01 / Founder</p><h3>Kaavin Prasanna</h3></article><article className="founder-card"><div className="founder-photo"><img alt="Aniket Mangalampalli" src="/assets/aniket-mangalampalli.png" /></div><p>02 / Founder</p><h3>Aniket Mangalampalli</h3></article><article className="founder-card"><div className="founder-photo"><img alt="Shaan Ramchandani" src="/assets/shaan-ramchandani.png" /></div><p>03 / Founder</p><h3>Shaan Ramchandani</h3></article><article className="founder-card"><div className="founder-photo founder-placeholder" aria-hidden="true"><span>A</span></div><p>04 / Founder</p><h3>Abheer</h3></article></div>
      <section className="chapter-leads" aria-labelledby="chapter-leads-title"><p className="eyebrow">Leading our local work</p><h2 id="chapter-leads-title">Chapter Leads</h2><div className="chapter-lead-row"><div className="founder-photo founder-placeholder chapter-lead-photo" aria-hidden="true"><span>A</span></div><span>Fremont</span><h3>Aryan Bachu</h3></div></section>
    </section>
  );
}

function ContactView() {
  const topics = ["General contact", "Sponsorship", "Start a chapter", "Teach a class"];
  const [topic, setTopic] = useState("General contact");
  const [submitted, setSubmitted] = useState(false);
  return (
    <section className="contact-page" aria-labelledby="contact-title">
      <div className="contact-hero"><p className="page-label">06 / Contact</p><h2 id="contact-title">Want to get<br /><em>in touch?</em></h2><p>Have a need, an idea, a printer, a group that wants to learn, or a community where you want to start a chapter? Choose the conversation that fits and tell us what would help.</p></div>
      <div className="contact-content"><div className="contact-choice"><p className="eyebrow">Choose a way in</p><div className="contact-buttons">{topics.map((item) => <button key={item} type="button" className={topic === item ? "selected" : ""} onClick={() => setTopic(item)}>{item}</button>)}</div><div className="contact-email"><span>Prefer email?</span><a href="mailto:3dprintforgood@gmail.com">3dprintforgood@gmail.com <span aria-hidden="true" className="arrow">↗</span></a></div></div>
        {submitted ? <div className="contact-form form-success"><span className="success-mark">✓</span><h3>Thanks for reaching out.</h3><p>We’ll get back to you soon about making more possible.</p><button className="submit-button" type="button" onClick={() => setSubmitted(false)}>Send another message <Arrow /></button></div> : <form className="contact-form" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><label><span>Name</span><input required placeholder="First and last name" name="name" /></label><label><span>Email</span><input required placeholder="you@example.com" type="email" name="email" /></label><label><span>I’m reaching out about</span><select name="topic" value={topic} onChange={(event) => setTopic(event.target.value)}><option>General contact</option><option>Sponsorship</option><option>Starting a chapter</option><option>Teach a class</option><option>A current design</option></select></label><label><span>Message</span><textarea required name="message" rows={5} placeholder="What would you like to make possible?" /></label><button className="submit-button" type="submit">Send message <Arrow /></button></form>}
      </div>
      <footer className="footer"><div><Wordmark footer /><p>Tools for more comfortable,<br />capable, independent care.</p></div><div className="footer-right"><span>© 2026 3DP for Good</span><span>Designed with patients. Distributed with BACH.</span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to Home ↑</button></div></footer>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "instant" }); };
  return <main className="site-shell"><SiteNav view={view} onNavigate={navigate} />{view === "home" && <HomeView onNavigate={navigate} />}{view === "work" && <WorkView onNavigate={navigate} />}{view === "classes" && <ClassesView />}{view === "sponsors" && <SponsorsView onNavigate={navigate} />}{view === "team" && <TeamView />}{view === "contact" && <ContactView />}</main>;
}
