/**
 * 育见官网 — 滚动驱动动效 · scroll spy · reduced-motion 降级
 */
(function () {
  const nav = document.getElementById('nav');
  const navLinks = document.querySelectorAll('[data-nav]');
  const sections = ['philosophy', 'ecosystem', 'product', 'technology'];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SCREEN_KEYS = ['daily', 'tasks', 'rehearsal', 'profile'];
  const SCREEN_ASSETS = {
    daily: { src: 'assets/screenshots/08-AI深度分析.jpg', alt: '深度对话' },
    tasks: { src: 'assets/screenshots/11-任务陪伴模块.jpg', alt: '成长行动' },
    rehearsal: { src: 'assets/screenshots/12-沟通预演模块.jpg', alt: '沟通彩排' },
    profile: { src: 'assets/screenshots/10-FamilyModel画像.jpg', alt: '成长档案' },
  };

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const sectionEls = sections.map((id) => document.getElementById(id)).filter(Boolean);

  function updateNavSpy() {
    const offset = nav.offsetHeight + 80;
    let current = sections[0];
    for (const el of sectionEls) {
      if (el.getBoundingClientRect().top <= offset) current = el.id;
    }
    navLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.nav === current);
    });
  }
  window.addEventListener('scroll', updateNavSpy, { passive: true });
  updateNavSpy();

  if (!prefersReduced) {
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach((el) => revealObs.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  }

  // —— Product scroll-driven showcase ——
  const scrollSteps = document.querySelectorAll('.scroll-step');
  const showcaseImg = document.getElementById('showcase-img');
  const scrollDots = document.querySelectorAll('.scroll-dot');
  const progressFill = document.getElementById('product-progress');
  let activeScreen = 'daily';

  function swapShowcaseImage(key) {
    if (!showcaseImg || !SCREEN_ASSETS[key]) return;
    const asset = SCREEN_ASSETS[key];
    const currentSrc = showcaseImg.getAttribute('src') || '';
    if (currentSrc.includes(asset.src) && activeScreen === key) return;

    if (prefersReduced) {
      showcaseImg.src = asset.src;
      showcaseImg.alt = asset.alt;
      return;
    }

    showcaseImg.classList.add('is-fading');
    setTimeout(() => {
      showcaseImg.src = asset.src;
      showcaseImg.alt = asset.alt;
      showcaseImg.classList.remove('is-fading');
    }, 200);
  }

  function setActiveScreen(key, progress) {
    activeScreen = key;
    swapShowcaseImage(key);

    scrollSteps.forEach((step) => {
      step.classList.toggle('is-active', step.dataset.screen === key);
    });
    scrollDots.forEach((dot) => {
      dot.classList.toggle('is-active', dot.dataset.screen === key);
    });
    if (progressFill && progress !== undefined) {
      progressFill.style.width = `${progress * 100}%`;
    }
  }

  if (!prefersReduced && scrollSteps.length) {
    const stepObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.dataset.screen;
            const idx = SCREEN_KEYS.indexOf(key);
            setActiveScreen(key, (idx + 0.5) / SCREEN_KEYS.length);
          }
        });
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 }
    );
    scrollSteps.forEach((step) => stepObserver.observe(step));
    setActiveScreen('daily', 0.125);

    const productScroll = document.getElementById('product-scroll');
    if (productScroll && progressFill) {
      function updateProductProgress() {
        const rect = productScroll.getBoundingClientRect();
        const vh = window.innerHeight;
        const total = productScroll.offsetHeight - vh;
        if (total <= 0) return;
        const scrolled = Math.min(Math.max(-rect.top, 0), total);
        progressFill.style.width = `${(scrolled / total) * 100}%`;
      }
      window.addEventListener('scroll', updateProductProgress, { passive: true });
      updateProductProgress();
    }
  } else if (scrollSteps.length) {
    scrollSteps.forEach((s, i) => s.classList.toggle('is-active', i === 0));
    if (progressFill) progressFill.style.width = '100%';
  }

  scrollDots.forEach((dot) => {
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => {
      const step = document.getElementById(`step-${dot.dataset.screen}`);
      if (step) step.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
    });
  });

  // —— Philosophy slogan highlight ——
  const sloganItems = document.querySelectorAll('.slogan-item');
  if (!prefersReduced && sloganItems.length) {
    const sloganObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-lit', entry.isIntersecting);
        });
      },
      { rootMargin: '-40% 0px -40% 0px', threshold: 0 }
    );
    sloganItems.forEach((item) => sloganObs.observe(item));
  }

  // —— Tech section highlights ——
  const techSection = document.getElementById('technology');
  if (!prefersReduced && techSection) {
    const litObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle('is-lit', entry.isIntersecting);
        });
      },
      { rootMargin: '-20% 0px -20% 0px', threshold: 0.3 }
    );
    techSection.querySelectorAll('.tech-pillar, .tech-loop-step, .tech-agent-card, .arch-agent, .arch-core').forEach((el) => {
      litObs.observe(el);
    });

    const archDiagram = techSection.querySelector('.arch-diagram');
    if (archDiagram) {
      const archObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              archDiagram.querySelectorAll('.arch-layer, .arch-agent, .arch-core').forEach((node, i) => {
                setTimeout(() => node.classList.add('is-lit'), i * 280);
              });
              archObs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35 }
      );
      archObs.observe(archDiagram);
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
