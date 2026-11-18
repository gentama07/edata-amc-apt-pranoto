import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ClipboardList, FileText, LayoutDashboard, ShieldCheck } from 'lucide-react';

const roles = [
  ['Admin', 'Mengelola akun dan akses operasional.'],
  ['Personel AMC', 'Mencatat pergerakan pesawat dan menangani data serta surat.'],
  ['Pimpinan', 'Memantau ringkasan, log, laporan, dan tindak lanjut surat.'],
  ['Ground Handling', 'Mengirim surat kepada AMC, mengikuti status, dan memberi balasan.'],
];

export default function Landing({ onLogin }) {
  const landingRef = useRef(null);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    const landing = landingRef.current;
    if (!landing) return undefined;

    document.documentElement.classList.add('landing-scroll-smooth');
    if (!('IntersectionObserver' in window)) return () => document.documentElement.classList.remove('landing-scroll-smooth');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let revealObserver;
    if (!reduceMotion) {
      landing.classList.add('landing-motion-ready');
      revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.16, rootMargin: '0px 0px -32px 0px' });

      landing.querySelectorAll('[data-reveal]').forEach((element) => revealObserver.observe(element));
    }

    let activeSectionFrame = 0;
    const updateActiveSection = () => {
      if (activeSectionFrame) return;
      activeSectionFrame = window.requestAnimationFrame(() => {
        const readingLine = window.innerHeight * 0.38;
        const visibleSection = ['fitur', 'akses']
          .map((id) => landing.querySelector(`#${id}`))
          .find((section) => {
            if (!section) return false;
            const bounds = section.getBoundingClientRect();
            return bounds.top <= readingLine && bounds.bottom > readingLine;
          });
        setActiveSection(visibleSection?.id ?? '');
        activeSectionFrame = 0;
      });
    };
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    updateActiveSection();

    return () => {
      revealObserver?.disconnect();
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
      if (activeSectionFrame) window.cancelAnimationFrame(activeSectionFrame);
      landing.classList.remove('landing-motion-ready');
      document.documentElement.classList.remove('landing-scroll-smooth');
    };
  }, []);

  return <main className="public-landing" id="landing-content" ref={landingRef}>
    <a className="skip-link" href="#landing-title">Lewati ke konten utama</a>
    <header className="landing-nav">
      <a className="landing-brand" href="#beranda" aria-label="E-data AMC, beranda">
        <img src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="" />
        <span><strong>E-data AMC</strong><small>APT Pranoto · Samarinda</small></span>
      </a>
      <nav aria-label="Navigasi halaman">
        <a href="#fitur" aria-current={activeSection === 'fitur' ? 'location' : undefined}>Ruang kerja</a>
        <a href="#akses" aria-current={activeSection === 'akses' ? 'location' : undefined}>Akses akun</a>
      </nav>
      <button
        className={`landing-login landing-nav-login${activeSection === 'akses' ? ' landing-nav-login-hidden' : ''}`}
        onClick={onLogin}
        aria-hidden={activeSection === 'akses'}
        tabIndex={activeSection === 'akses' ? -1 : 0}
        disabled={activeSection === 'akses'}
      >Masuk<ArrowRight size={16} aria-hidden="true" /></button>
    </header>

    <section className="landing-hero" id="beranda" aria-labelledby="landing-title">
      <div className="landing-hero-inner">
        <div className="landing-hero-copy" data-enter>
          <h1 id="landing-title">Operasi apron,<br /><em>tertata dalam satu ruang kerja.</em></h1>
          <p>E-data AMC A.P.T. Pranoto membantu tim mencatat pergerakan pesawat, melihat ringkasan operasional, dan menindaklanjuti surat antara AMC dan Ground Handling.</p>
          <div className="landing-hero-actions">
            <button className="landing-login landing-login-large" onClick={onLogin}>Masuk ke E-data AMC<ArrowRight size={17} aria-hidden="true" /></button>
            <a className="landing-secondary-link" href="#fitur">Lihat yang bisa dikelola<ArrowDownRight size={15} aria-hidden="true" /></a>
          </div>
          <div className="landing-hero-note"><ShieldCheck size={15} aria-hidden="true" /><span>Akses operasional diberikan sesuai peran akun.</span></div>
        </div>

        <div className="landing-workspace" data-enter aria-label="Gambaran ruang kerja E-data AMC">
          <div className="landing-workspace-head"><div><strong>Log pergerakan</strong><span>Ruang kerja operasional</span></div><span className="landing-live">WITA</span></div>
          <div className="landing-workspace-date"><span>DATA PENERBANGAN</span><span>WITA</span></div>
          <div className="landing-journey">
            <div className="landing-journey-stop"><span className="journey-dot journey-arr" /><div><strong>Kedatangan</strong><small>Jadwal · Aktual · Block ON</small></div></div>
            <div className="landing-journey-line"><i /></div>
            <div className="landing-journey-stop"><span className="journey-dot journey-dep" /><div><strong>Keberangkatan</strong><small>Jadwal · Block OFF · Aktual</small></div></div>
          </div>
          <div className="landing-workspace-foot"><span><Activity size={15} /> Pergerakan apron</span><span><ClipboardList size={15} /> Muatan & remark</span></div>
          <div className="landing-workspace-accent" aria-hidden="true" />
        </div>
      </div>
    </section>

    <section className="landing-capabilities" id="fitur" aria-labelledby="landing-capabilities-title">
      <div className="landing-section-inner">
        <h2 id="landing-capabilities-title" data-reveal>Informasi penting, mudah ditindaklanjuti.</h2>
        <div className="landing-capability-list">
          <article data-reveal>
            <Activity size={21} strokeWidth={1.7} aria-hidden="true" />
            <h3>Log pergerakan</h3>
            <p>Catat operator, registrasi, rute, waktu rencana dan aktual, stand, penumpang, bagasi, kargo, serta remark lapangan.</p>
          </article>
          <article data-reveal>
            <FileText size={21} strokeWidth={1.7} aria-hidden="true" />
            <h3>Persuratan</h3>
            <p>Kirim surat dan lampiran, ikuti balasan dalam percakapan, lalu konfirmasi penyelesaian bersama pihak terkait.</p>
          </article>
          <article data-reveal>
            <LayoutDashboard size={21} strokeWidth={1.7} aria-hidden="true" />
            <h3>Ringkasan & laporan</h3>
            <p>Tinjau aktivitas berdasarkan tanggal operasional dan gunakan laporan untuk membaca atau mengekspor data.</p>
          </article>
        </div>
      </div>
    </section>

    <section className="landing-access" id="akses" aria-labelledby="landing-access-title">
      <div className="landing-access-inner">
        <div className="landing-access-intro" data-reveal>
          <h2>Akses mengikuti tanggung jawab setiap akun.</h2>
          <p>Masuk menggunakan akun operasional yang dibuat oleh Admin. Menu dan tindakan yang tersedia menyesuaikan peran Anda.</p>
          <button className="landing-login" onClick={onLogin}>Masuk<ArrowRight size={16} aria-hidden="true" /></button>
        </div>
        <div className="landing-role-list">
          {roles.map(([title, description], index) => <article key={title} data-reveal>
            <span className="landing-role-number">0{index + 1}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </article>)}
        </div>
      </div>
    </section>

    <footer className="landing-footer">
      <a className="landing-brand" href="#beranda" aria-label="Kembali ke atas">
        <img src={`${import.meta.env.BASE_URL}assets/logo-apt-login-removebg-preview.png`} alt="" />
        <span><strong>Bandar Udara A.P.T. Pranoto</strong><small>Samarinda · WITA</small></span>
      </a>
      <span>E-data AMC · Sistem operasional Apron Movement Control</span>
    </footer>
  </main>;
}

