/* ============================================================
   PROGRESSIVE ENHANCEMENT
   Mark <html> as JS-enabled so reveal styles activate.
   If this script never runs, content stays fully visible.
   ============================================================ */
document.documentElement.classList.replace('no-js', 'js');

/* ============================================================
   GLOBAL REFERENCES
   ============================================================ */
const navbar    = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   NAVBAR — scroll behavior
   - Adds .scrolled (solid + blur) once user is past the top
   - Adds .hidden (slides off-screen) on scroll-down
   - Removes .hidden on scroll-up
   ============================================================ */
let lastScrollY = window.scrollY;
const SCROLL_BG_THRESHOLD   = 50;   // px before background turns solid
const SCROLL_HIDE_THRESHOLD = 200;  // px before bar may auto-hide

function updateNavbar() {
  const y = window.scrollY;

  // Toggle solid background past threshold
  navbar.classList.toggle('scrolled', y > SCROLL_BG_THRESHOLD);

  // Auto-hide on scroll-down (but not when mobile menu is open)
  const scrollingDown = y > lastScrollY;
  const pastThreshold = y > SCROLL_HIDE_THRESHOLD;
  const menuOpen      = navLinks.classList.contains('open');

  if (scrollingDown && pastThreshold && !menuOpen) {
    navbar.classList.add('hidden');
  } else {
    navbar.classList.remove('hidden');
  }

  lastScrollY = y;
}
window.addEventListener('scroll', updateNavbar, { passive: true });

/* ============================================================
   MOBILE NAV TOGGLE
   Open/close hamburger menu and sync ARIA state.
   Closing the menu when a link is clicked keeps the page tidy.
   ============================================================ */
navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

/* ============================================================
   INTERSECTION OBSERVER — scroll reveals
   Targets every [data-reveal] element. Adds .is-visible the
   first time the element enters the viewport, then unobserves.
   ============================================================ */
const revealEls = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -8% 0px'
  });
  revealEls.forEach(el => io.observe(el));
} else {
  // Fallback: show everything immediately
  revealEls.forEach(el => el.classList.add('is-visible'));
}

/* ============================================================
   PARALLAX — subtle background drift on project sections
   Each .parallax-bg translates within its parent based on the
   parent's position in the viewport. rAF-throttled for perf.
   ============================================================ */
const parallaxBgs = Array.from(document.querySelectorAll('.parallax-bg'));
const PARALLAX_AMPLITUDE = 80; // total px range of drift across full transit

function updateParallax() {
  if (reduceMotion) return;
  const viewportH = window.innerHeight;

  parallaxBgs.forEach(bg => {
    const section = bg.parentElement;
    if (!section) return;

    const rect = section.getBoundingClientRect();
    // Skip sections fully off-screen — saves work
    if (rect.bottom < 0 || rect.top > viewportH) return;

    // 0 = section just entering bottom; 1 = section just leaving top
    const progress = (viewportH - rect.top) / (viewportH + rect.height);
    const offset = (progress - 0.5) * PARALLAX_AMPLITUDE;

    bg.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
  });
}

let parallaxRAF = null;
function requestParallax() {
  if (parallaxRAF) return;
  parallaxRAF = requestAnimationFrame(() => {
    updateParallax();
    parallaxRAF = null;
  });
}
window.addEventListener('scroll', requestParallax, { passive: true });
window.addEventListener('resize', requestParallax);
updateParallax(); // initial paint

/* ============================================================
   CUSTOM AUDIO PLAYER
   Native <audio controls> looks ugly across browsers.
   This drives a hidden <audio> element from a styled UI:
   play/pause toggle, click-to-seek progress bar, timecodes.
   ============================================================ */
document.querySelectorAll('.audio-frame').forEach(frame => {
  const audio       = frame.querySelector('audio');
  const playBtn     = frame.querySelector('.audio-play');
  const progressBar = frame.querySelector('.audio-progress-bar');
  const fill        = frame.querySelector('.audio-progress-fill');
  const currentEl   = frame.querySelector('.audio-current');
  const durationEl  = frame.querySelector('.audio-duration');
  if (!audio || !playBtn || !progressBar || !fill) return;

  // Format seconds → "M:SS"
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Play / pause toggle
  playBtn.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => { /* ignore autoplay rejection */ });
    else audio.pause();
  });

  // Reflect playback state in UI
  audio.addEventListener('play', () => {
    playBtn.classList.add('playing');
    playBtn.setAttribute('aria-label', 'Pause audio');
  });
  audio.addEventListener('pause', () => {
    playBtn.classList.remove('playing');
    playBtn.setAttribute('aria-label', 'Play audio');
  });
  audio.addEventListener('ended', () => {
    playBtn.classList.remove('playing');
    playBtn.setAttribute('aria-label', 'Play audio');
    fill.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', '0');
    if (currentEl) currentEl.textContent = '0:00';
  });

  // Duration once metadata is available
  audio.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = fmt(audio.duration);
  });

  // Time progress
  audio.addEventListener('timeupdate', () => {
    if (currentEl) currentEl.textContent = fmt(audio.currentTime);
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      fill.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
  });

  // Click to seek
  const seekFromEvent = (clientX) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
  };
  progressBar.addEventListener('click', (e) => seekFromEvent(e.clientX));

  // Keyboard support: ←/→ scrub 5s, space toggles play
  progressBar.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
    if (e.key === 'ArrowRight') { e.preventDefault(); audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      audio.paused ? audio.play() : audio.pause();
    }
  });
});
