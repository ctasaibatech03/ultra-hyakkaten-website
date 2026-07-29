/* ===================================================
   ウルトラ百貨店 公式サイト
   ヒーローカルーセル：自動切替＋手動ナビ＋アクセシビリティ対応
   =================================================== */
(function () {
  const slider = document.getElementById('hero-slider');
  if (!slider) return;

  const slides = Array.from(slider.querySelectorAll('.hero-slide'));
  const dots = Array.from(slider.querySelectorAll('.hero-dot'));
  const prevBtn = slider.querySelector('.hero-nav-prev');
  const nextBtn = slider.querySelector('.hero-nav-next');

  if (slides.length === 0) return;

  const AUTOPLAY_DELAY = 5000;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = slides.findIndex((slide) => slide.classList.contains('is-active'));
  if (current < 0) current = 0;
  let timerId = null;

  function goTo(index) {
    const nextIndex = (index + slides.length) % slides.length;
    if (nextIndex === current) return;

    slides[current].classList.remove('is-active');
    dots[current] && dots[current].classList.remove('is-active');
    dots[current] && dots[current].setAttribute('aria-selected', 'false');

    current = nextIndex;

    slides[current].classList.add('is-active');
    dots[current] && dots[current].classList.add('is-active');
    dots[current] && dots[current].setAttribute('aria-selected', 'true');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    if (prefersReducedMotion || slides.length < 2) return;
    stopAutoplay();
    timerId = window.setInterval(next, AUTOPLAY_DELAY);
  }

  function stopAutoplay() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  // 手動操作
  nextBtn && nextBtn.addEventListener('click', () => { next(); startAutoplay(); });
  prevBtn && prevBtn.addEventListener('click', () => { prev(); startAutoplay(); });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.getAttribute('data-index'));
      goTo(index);
      startAutoplay();
    });
  });

  // マウスオーバー・フォーカス中は自動再生を一時停止（読みやすさ配慮）
  slider.addEventListener('mouseenter', stopAutoplay);
  slider.addEventListener('mouseleave', startAutoplay);
  slider.addEventListener('focusin', stopAutoplay);
  slider.addEventListener('focusout', startAutoplay);

  // タブが非表示のときは止めておく
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  startAutoplay();
})();
