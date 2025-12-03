/* =========================================================
   Bizbond Corporate Site - App JS
   File: js/app.js
   Purpose:
     - Smooth in-page navigation
     - Active nav highlight on scroll
     - Form validation (progressive enhancement)
     - Draft autosave to localStorage
   ========================================================= */
console.log("✅ app.js is loaded successfully.");

(function () {
  'use strict';

  /* -----------------------------
   * Helpers
   * ----------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const throttle = (fn, wait = 100) => {
    let last = 0, timer;
    return (...args) => {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn.apply(null, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => {
          last = Date.now();
          fn.apply(null, args);
        }, wait - (now - last));
      }
    };
  };

  const easeScrollTo = (targetY, duration = 500) => {
    const startY = window.scrollY || window.pageYOffset;
    const delta = targetY - startY;
    const startTime = performance.now();

    const easeInOut = t =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const loop = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const y = startY + delta * easeInOut(t);
      window.scrollTo(0, y);
      if (t < 1) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  /* -----------------------------
   * Smooth scroll for in-page links
   * ----------------------------- */
  function setupSmoothScroll() {
    const anchorLinks = $$('a[href^="#"]')
      .filter(a => a.getAttribute('href').length > 1); // ignore href="#"

    anchorLinks.forEach(a => {
      a.addEventListener('click', (e) => {
        const hash = a.getAttribute('href');
        const target = $(hash);
        if (!target) return;
        // same-page only
        if (location.pathname.replace(/\/$/, '') !== a.pathname.replace(/\/$/, '')
            || location.hostname !== a.hostname) return;

        e.preventDefault();

        // Adjust for sticky header height (if any)
        const header = document.querySelector('header[role="banner"]');
        const headerH = header ? header.getBoundingClientRect().height : 0;

        const rect = target.getBoundingClientRect();
        const absoluteY = window.scrollY + rect.top - Math.max(0, headerH + 8);

        easeScrollTo(absoluteY, 500);

        // Move focus for accessibility
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        setTimeout(() => target.removeAttribute('tabindex'), 1000);
        // Update hash without instant jump
        history.pushState(null, '', hash);
      });
    });
  }

  /* -----------------------------
   * Active nav highlight on scroll
   * ----------------------------- */
  function setupActiveNav() {
    const nav = $('nav[aria-label="グローバルナビ"]');
    if (!nav) return;

    const links = $$('a[href^="#"]', nav)
      .filter(a => a.getAttribute('href').length > 1);
    if (!links.length) return;

    const map = new Map(); // sectionEl -> linkEl
    links.forEach(link => {
      const id = link.getAttribute('href');
      const sec = $(id);
      if (sec) map.set(sec, link);
    });

    // Remove active state from all
    const clearActive = () => links.forEach(l => l.classList.remove('is-active'));

    // Use IntersectionObserver if available
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const link = map.get(entry.target);
          if (!link) return;
          if (entry.isIntersecting) {
            clearActive();
            link.classList.add('is-active');
          }
        });
      }, {
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0.01
      });

      map.forEach((_, section) => observer.observe(section));
      return;
    }

    // Fallback: scroll listener
    const sections = Array.from(map.keys());
    const onScroll = throttle(() => {
      const pos = window.scrollY + (window.innerHeight * 0.35);
      let current = null;
      sections.forEach(sec => {
        const top = sec.offsetTop;
        if (top <= pos) current = sec;
      });
      if (current) {
        clearActive();
        const link = map.get(current);
        if (link) link.classList.add('is-active');
      }
    }, 150);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -----------------------------
   * Form: validation + draft autosave
   * ----------------------------- */
  function setupForm() {
    const form = $('#contact form') || $('form[name="contact"]');
    if (!form) return;

    const fields = {
      company: form.querySelector('[name="company"]'),
      name: form.querySelector('[name="name"]'),
      email: form.querySelector('[name="email"]'),
      tel: form.querySelector('[name="tel"]'),
      target: form.querySelector('[name="target"]'),
      message: form.querySelector('[name="message"]')
    };

    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);

    const say = (msg) => { liveRegion.textContent = msg; };

    // -----------------
    // Draft autosave
    // -----------------
    const KEY = 'bizbond_contact_draft_v1';
    const loadDraft = () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        Object.entries(fields).forEach(([k, el]) => {
          if (el && data[k] != null) el.value = data[k];
        });
        say('保存された下書きを読み込みました');
      } catch (e) {/* noop */}
    };
    const saveDraft = throttle(() => {
      const data = {};
      Object.entries(fields).forEach(([k, el]) => { if (el) data[k] = el.value || ''; });
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) {/* storage full or blocked */}
    }, 300);

    Object.values(fields).forEach(el => {
      if (!el) return;
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
    });

    loadDraft();

    // -----------------
    // Validation
    // -----------------
    const validators = {
      company: (v) => v.trim().length > 0 || '会社名を入力してください。',
      name: (v) => v.trim().length > 0 || 'お名前を入力してください。',
      email: (v) => {
        if (!v.trim()) return 'メールアドレスを入力してください。';
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        return ok || 'メールアドレスの形式が正しくありません。';
      },
      tel: (v) => !v || /^[0-9+\-\s()]+$/.test(v) || '電話番号の形式が正しくありません。'
    };

    const showError = (el, msg) => {
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      let hint = el.nextElementSibling && el.nextElementSibling.classList
        && el.nextElementSibling.classList.contains('form-hint')
        ? el.nextElementSibling : null;
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'form-hint';
        hint.style.color = '#b42318';
        hint.style.fontSize = '12px';
        hint.style.marginTop = '4px';
        el.insertAdjacentElement('afterend', hint);
      }
      hint.textContent = msg;
    };

    const clearError = (el) => {
      if (!el) return;
      el.removeAttribute('aria-invalid');
      const hint = el.nextElementSibling && el.nextElementSibling.classList
        && el.nextElementSibling.classList.contains('form-hint')
        ? el.nextElementSibling : null;
      if (hint) hint.textContent = '';
    };

    const validateField = (name) => {
      const el = fields[name];
      if (!el || !validators[name]) return true;
      const res = validators[name](el.value);
      if (res === true) { clearError(el); return true; }
      showError(el, res);
      return false;
    };

    ['company', 'name', 'email', 'tel'].forEach(n => {
      const el = fields[n];
      if (!el) return;
      el.addEventListener('blur', () => validateField(n));
      el.addEventListener('input', () => clearError(el));
    });

    form.addEventListener('submit', (e) => {
      const order = ['company', 'name', 'email', 'tel'];
      const firstInvalid = order.find(n => !validateField(n));

      if (firstInvalid) {
        e.preventDefault();
        const el = fields[firstInvalid];
        if (el) {
          el.focus();
          say('入力内容に不備があります。赤字の案内をご確認ください。');
        }
        return;
      }

      // Submit OK: clear draft
      try { localStorage.removeItem(KEY); } catch (e2) {}
      say('送信しています。ありがとうございます。');
      // allow normal submission (Netlify等も可)
    });
  }

  /* -----------------------------
   * FAQ: open one at a time (optional)
   * ----------------------------- */
  function setupFAQ() {
    const details = $$('#faq details');
    if (details.length <= 1) return;
    details.forEach(d => {
      d.addEventListener('toggle', () => {
        if (d.open) {
          details.forEach(other => { if (other !== d) other.open = false; });
        }
      });
    });
  }

  /* -----------------------------
   * Init
   * ----------------------------- */
  function init() {
    setupSmoothScroll();
    setupActiveNav();
    setupForm();
    setupFAQ();
    setupCaseSlider();   // ← これを追加
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();


  /* -----------------------------
   * Case slider (実績スライダー)
   * 左右にクローンを置いて無限ループ＋両端も隣が見える
   * ----------------------------- */
  function setupCaseSlider() {
    const slider = document.querySelector(".case-slider");
    if (!slider) return;

    const track = slider.querySelector(".case-slider-track");
    let originalCards = Array.from(slider.querySelectorAll(".case-card"));
    const prevBtn = slider.querySelector(".case-slider-arrow--prev");
    const nextBtn = slider.querySelector(".case-slider-arrow--next");
    let dotsContainer = slider.querySelector(".case-slider-dots");

    if (!track || originalCards.length === 0) return;
    const realCount = originalCards.length;
    if (realCount === 1) return; // 1枚だけならスライダー不要

    // --- クローンを前後に追加（両端でも隣が見えるように） ---
    const firstClone = originalCards[0].cloneNode(true);
    const lastClone = originalCards[realCount - 1].cloneNode(true);
    firstClone.classList.add("case-card--clone");
    lastClone.classList.add("case-card--clone");
    firstClone.classList.remove("is-active");
    lastClone.classList.remove("is-active");

    track.insertBefore(lastClone, originalCards[0]); // 先頭にラストのコピー
    track.appendChild(firstClone);                   // 末尾に最初のコピー

    const slides = Array.from(track.querySelectorAll(".case-card")); // クローン含む配列
    const totalSlides = slides.length; // = realCount + 2

    // ドットコンテナが無ければ作る
    if (!dotsContainer) {
      dotsContainer = document.createElement("div");
      dotsContainer.className = "case-slider-dots";
      slider.appendChild(dotsContainer);
    }

    let index = 1; // slides上の現在位置（1〜realCount）を基本とし、0とrealCount+1はクローン
    let slideWidth = 0;
    let resizeTimer = null;

    // 1ステップ分の移動幅（カード＋gap）を計算
    function calcSlideWidth() {
      if (slides.length < 3) {
        slideWidth = slides[0].getBoundingClientRect().width;
        return;
      }

      // is-active じゃないカード同士のペアを探して、その距離を使う
      for (let i = 0; i < slides.length - 1; i++) {
        const a = slides[i];
        const b = slides[i + 1];
        if (!a.classList.contains("is-active") && !b.classList.contains("is-active")) {
          const r1 = a.getBoundingClientRect();
          const r2 = b.getBoundingClientRect();
          slideWidth = r2.left - r1.left; // 左端の差分 = カード幅 + gap
          return;
        }
      }

      // 念のためのフォールバック（全部 is-active だった場合）
      const r1 = slides[1].getBoundingClientRect();
      const r2 = slides[2].getBoundingClientRect();
      slideWidth = r2.left - r1.left;
    }


    // ドット生成（実スライド分だけ）
    const dots = originalCards.map((_, idx) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dotsContainer.appendChild(dot);
      dot.addEventListener("click", () => {
        goToRealIndex(idx);
      });
      return dot;
    });

    // slides上の index から「実スライド何番目か」を求める
    function getLogicalIndex() {
      // index: 0      1        2 ... realCount   realCount+1
      // slide: lastC  card1    card2 ... cardN   firstC
      // logical: N-1  0        1   ... N-1       0
      if (index === 0) return realCount - 1;
      if (index === realCount + 1) return 0;
      return index - 1;
    }

    function updateActive() {
      const logical = getLogicalIndex();
      originalCards.forEach((card, idx) => {
        card.classList.toggle("is-active", idx === logical);
      });
      dots.forEach((dot, idx) => {
        dot.classList.toggle("is-active", idx === logical);
      });
    }

    function updateTransform(skipAnimation) {
      const x = -index * slideWidth;
      if (skipAnimation) {
        const prevTransition = track.style.transition;
        track.style.transition = "none";
        track.style.transform = `translateX(${x}px)`;
        // 強制リフロー
        void track.offsetHeight;
        track.style.transition = prevTransition || "";
      } else {
        track.style.transform = `translateX(${x}px)`;
      }
    }

    // 実スライドのインデックス(0〜realCount-1)を指定して移動
    function goToRealIndex(realIdx, opts = {}) {
      const { skipAnimation = false } = opts;
      let target = realIdx;
      // 正規化
      if (target < 0) target = realCount - 1;
      if (target >= realCount) target = 0;

      index = target + 1; // slides上では +1 した位置
      updateTransform(skipAnimation);
      updateActive();
    }

    function next() {
      index += 1;
      updateTransform(false);
    }

    function prev() {
      index -= 1;
      updateTransform(false);
    }

    // アニメーション終了後、クローンに居たら本物にジャンプ（見た目は同じ位置）
    track.addEventListener("transitionend", () => {
      if (index === 0) {
        // 左端のクローン（lastClone）に居る → 本物の最後へ
        index = realCount;
        updateTransform(true);
      } else if (index === totalSlides - 1) {
        // 右端のクローン（firstClone）に居る → 本物の最初へ
        index = 1;
        updateTransform(true);
      }
      updateActive();
    });

    // カードクリック：クローンは無視し、実カードだけ対象
    track.addEventListener("click", (e) => {
      const card = e.target.closest(".case-card");
      if (!card || card.classList.contains("case-card--clone")) return;

      const realIdx = originalCards.indexOf(card);
      if (realIdx === -1) return;

      const currentLogical = getLogicalIndex();
      if (realIdx === currentLogical) {
        // 既に中央なら次へ
        next();
      } else {
        goToRealIndex(realIdx);
      }
    });

    prevBtn && prevBtn.addEventListener("click", prev);
    nextBtn && nextBtn.addEventListener("click", next);

    // リサイズ時に幅を再計算して位置を補正
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        calcSlideWidth();
        updateTransform(true);
      }, 120);
    });

    // 初期化
    calcSlideWidth();
    updateTransform(true); // index=1 (事例1) を中央へ
    updateActive();
  }

  /* ============================================
   Scroll Fade-up（下からふわっと表示）
   ============================================ */

// 要素に data-stagger が指定されていたら、子要素に自動で遅延を付与
document.querySelectorAll("[data-stagger]").forEach(parent => {
  Array.from(parent.children).forEach((child, i) => {
    child.style.setProperty("--i", i);
  });
});

// IntersectionObserver：画面下に入ったら発火
const fadeObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    obs.unobserve(entry.target);
  });
}, {
  root: null,
  rootMargin: "0px 0px -15% 0px",
  threshold: 0.06
});

// .fade-up を全部監視
document.querySelectorAll(".fade-up").forEach(el => fadeObserver.observe(el));

// 初回ロード時、すでに見えてる要素は即表示
window.addEventListener("load", () => {
  const vh = window.innerHeight;
  document.querySelectorAll(".fade-up").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92) {
      el.classList.add("is-visible");
    }
  });
});
