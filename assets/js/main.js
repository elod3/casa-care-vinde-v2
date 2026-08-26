/* ==========================================================================
   main.js — nav, reveal la scroll, cifre care se rotesc, bară de progres,
   lumina care urmărește cursorul pe carduri.

   Fără dependențe. Tot ce mișcă respectă prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- nav ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');

  if (nav && !nav.classList.contains('nav--solid')) {
    var onScroll = function () { nav.classList.toggle('nav--solid', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- inversarea barei peste secțiunile galbene ----------
     Bara galbenă dispare peste o secțiune galbenă, deci se întoarce: pastilă
     neagră, scris galben. Nu urmărim secțiunea „curentă" la scroll, ci ce se
     află fizic sub bară — se măsoară linia ei de mijloc față de dreptunghiul
     fiecărui element marcat data-nav="light". Așa merge la fel de bine dacă
     mai apare o secțiune galbenă oriunde în pagină. */
  var lit = Array.prototype.slice.call(document.querySelectorAll('[data-nav="light"]'));
  if (nav && lit.length) {
    var navMid = function () {
      var r = nav.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    var syncNavTheme = function () {
      var y = navMid();
      var over = lit.some(function (el) {
        var r = el.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      });
      nav.classList.toggle('nav--invert', over);
    };
    syncNavTheme();
    window.addEventListener('scroll', syncNavTheme, { passive: true });
    window.addEventListener('resize', syncNavTheme, { passive: true });
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav--open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('nav--open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- pagina curentă ---------- */
  var here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a').forEach(function (a) {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });

  /* ---------- bara de progres a scroll-ului ---------- */
  var progress = document.querySelector('.progress');
  if (progress) {
    var tickProgress = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    };
    tickProgress();
    window.addEventListener('scroll', tickProgress, { passive: true });
    window.addEventListener('resize', tickProgress, { passive: true });
  }

  /* ---------- cifre care urcă până la valoarea finală ----------
     <b data-count="154900" data-suffix="">0</b>
     Numărul final rămâne în data-count, ca să fie corect și fără JS. */
  function formatNo(n, decimals) {
    return n.toLocaleString('ro-RO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';

    if (REDUCED) { el.textContent = prefix + formatNo(target, decimals) + suffix; return; }

    var dur = 1500;
    var t0 = null;
    function frame(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      // ease-out-expo: pornește repede, aterizează lin pe cifra finală
      var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = prefix + formatNo(target * e, decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- reveal ----------
     Verificare directă pe scroll, nu IntersectionObserver: la salturi mari în
     pagină (ancore, restaurarea poziției de scroll) observer-ul poate să nu
     apuce să livreze, iar secțiunile ar rămâne invizibile. */
  var pending = Array.prototype.slice.call(document.querySelectorAll('[data-reveal], [data-count]'));
  var queued = false;

  function activate(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-count')) countUp(el);
    // cifrele dinăuntrul unui bloc revelat pornesc odată cu el
    el.querySelectorAll('[data-count]').forEach(function (c) {
      if (!c.classList.contains('is-in')) { c.classList.add('is-in'); countUp(c); }
    });
  }

  /* La prima trecere pragul e toată înălțimea ecranului, nu 88% din ea: altfel
     fâșia de cifre din hero, care se oprește exact pe linia de plutire, rămâne
     invizibilă până când omul dă scroll — și arată a bug, nu a animație. */
  var firstSweep = true;

  function sweep() {
    queued = false;
    var h = window.innerHeight;
    var edge = firstSweep ? h : h * 0.88;
    firstSweep = false;
    for (var i = pending.length - 1; i >= 0; i--) {
      var el = pending[i];
      if (el.classList.contains('is-in')) { pending.splice(i, 1); continue; }
      var r = el.getBoundingClientRect();
      if (r.top < edge && r.bottom > 0) {
        activate(el);
        pending.splice(i, 1);
      }
    }
    if (!pending.length) {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    }
  }

  function schedule() {
    if (queued || !pending.length) return;
    queued = true;
    requestAnimationFrame(sweep);
  }

  if (pending.length) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    sweep();

    /* Re-verificare după ce se așază layoutul.
       Fonturile Google sosesc după primul sweep și împing conținutul în jos;
       fără o a doua trecere, ce a coborât sub prag rămâne invizibil pentru
       totdeauna, pentru că pe ecrane înalte nu urmează niciun scroll. */
    window.addEventListener('load', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    [150, 600, 1500].forEach(function (ms) { setTimeout(schedule, ms); });
  }

  /* ---------- parallax ----------
     Imaginile de fundal se mișcă mai încet decât pagina. E singura mișcare pe
     care omul n-o observă conștient, dar care îi spune că fundalul e mai
     departe decât textul — de aia se citește ca adâncime, nu ca efect.

     Translația se pune pe învelitoare, nu pe <img>: imaginea are deja propriul
     transform (zoom-ul lent din hero), iar cele două s-ar suprascrie.
     Un singur rAF pentru toate straturile, ca să nu punem un listener de
     scroll per element. */
  var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  if (!REDUCED && layers.length) {
    var ticking = false;

    var place = function () {
      ticking = false;
      var h = window.innerHeight;
      layers.forEach(function (el) {
        var host = el.parentElement.getBoundingClientRect();
        if (host.bottom < -200 || host.top > h + 200) return;   // în afara ecranului
        // -1..1, cât de departe e mijlocul secțiunii de mijlocul ecranului
        var d = (host.top + host.height / 2 - h / 2) / (h / 2 + host.height / 2);
        var amp = parseFloat(el.getAttribute('data-parallax')) || 40;
        // semnul e negativ intenționat: stratul trebuie să rămână în urma
        // paginii, nu s-o ia înainte. Invers, ar părea mai aproape decât textul.
        el.style.transform = 'translate3d(0, ' + (-d * amp).toFixed(1) + 'px, 0)';
      });
    };

    var queue = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(place);
    };

    place();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
  }

  /* Benzile NU se mai mișcă singure. Deriva se bătea cap în cap cu
     scroll-snap (le dezactiva pe toate 14), clona carduri care rămâneau
     invizibile și cifre oprite pe „0", scria scrollLeft la fiecare cadru
     pe firul principal, și repornea singură după pauză — deci pica
     WCAG 2.2.2. Indiciul „mai e ceva dincolo" îl dă acum masca din CSS.
     Singura buclă care rămâne e .marquee: e decor, e aria-hidden, e pur
     CSS și se oprește la deget. */

  /* ---------- teancul de cărți ----------
     Cifrele stau una peste alta și se schimbă la fiecare patru secunde. Fără
     JS rămân stivuite normal, deci nimic nu se ascunde: clasa `is-ready` (pusă
     de aici) e cea care strânge teancul. */
  document.querySelectorAll('[data-deck]').forEach(function (deck) {
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.deck__card'));
    var dots = deck.querySelector('.deck__dots');
    if (cards.length < 2) return;

    /* Înălțimea se fixează pe cea mai înaltă carte înainte de a le suprapune:
       altfel secțiunea de dedesubt sare de fiecare dată când intră o carte cu
       text mai scurt. */
    var maxH = 0;
    cards.forEach(function (c) { maxH = Math.max(maxH, c.offsetHeight); });
    deck.style.setProperty('--deck-h', (maxH + 34) + 'px');
    deck.classList.add('is-ready');

    var top = 0, timer = null;

    if (dots) {
      cards.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Cifra ' + (i + 1) + ' din ' + cards.length);
        b.addEventListener('click', function () { show(i); porneste(); });
        dots.appendChild(b);
      });
    }

    function show(n) {
      top = (n + cards.length) % cards.length;
      cards.forEach(function (c, i) {
        var d = (i - top + cards.length) % cards.length;
        // cartea dinaintea celei din față e cea care tocmai a plecat
        c.setAttribute('data-pos', d === cards.length - 1 && cards.length > 2 ? 'out' : String(Math.min(d, 3)));
      });
      if (dots) {
        Array.prototype.slice.call(dots.children).forEach(function (b, i) {
          b.setAttribute('aria-current', i === top ? 'true' : 'false');
        });
      }
    }

    function porneste() {
      clearInterval(timer);
      if (REDUCED) return;
      timer = setInterval(function () { show(top + 1); }, 4000);
    }

    show(0);
    porneste();

    /* Se oprește cât ține degetul pe el, ca orice altă buclă din pagină. */
    ['pointerenter', 'pointerdown', 'touchstart'].forEach(function (ev) {
      deck.addEventListener(ev, function () { clearInterval(timer); }, { passive: true });
    });
    ['pointerleave', 'pointerup', 'touchend'].forEach(function (ev) {
      deck.addEventListener(ev, porneste, { passive: true });
    });
    // într-un tab de fundal nu are rost să se învârtă
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearInterval(timer); else porneste();
    });
  });

  /* ---------- orice buclă se oprește cât o atingi ----------
     O bandă care nu se oprește e o bandă din care nu poți citi. Ține cât timp
     apeși, plus o clipă după, ca să nu-ți fugă textul de sub deget fix când
     îl ridici. */
  var loops = Array.prototype.slice.call(document.querySelectorAll('[data-loop]'));
  loops.forEach(function (el) {
    var t = null;
    function hold() {
      el.classList.add('is-held');
      clearTimeout(t);
      t = setTimeout(function () { el.classList.remove('is-held'); }, 1600);
    }
    ['pointerdown', 'touchstart', 'pointermove'].forEach(function (ev) {
      el.addEventListener(ev, hold, { passive: true });
    });
    el.addEventListener('pointerleave', function () {
      clearTimeout(t);
      el.classList.remove('is-held');
    });
  });

  /* ---------- lumina care urmărește cursorul pe carduri ---------- */
  if (!REDUCED && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---------- scene fixate: marchează pasul activ ---------- */
  var steps = document.querySelectorAll('[data-step]');
  if (steps.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var scene = en.target.closest('.scene');
        if (!scene) return;
        scene.setAttribute('data-active', en.target.getAttribute('data-step'));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  /* ---------- an ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
