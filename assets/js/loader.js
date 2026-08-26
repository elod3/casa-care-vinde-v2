/* ==========================================================================
   loader.js — ecranul de încărcare

   Overlay peste o pagină care se încarcă normal dedesubt. Nu amână nimic:
   markupul, CSS-ul și imaginile pornesc exact ca înainte, iar ecranul ăsta
   doar stă deasupra până se golește contorul.

   Bara nu e falsă pe toată durata. Primele patru cincimi urmăresc semnale
   reale — DOM-ul parsat, fonturile gata, fotografia din hero decodată,
   evenimentul `load`. Abia ultima cincime e ținerea cerută: două secunde în
   care bara continuă să urce, ca așteptarea să arate a lucru în desfășurare,
   nu a blocaj. Un progres care se oprește la 80% și stă nemișcat produce
   exact efectul invers celui dorit.

   Se arată o singură dată pe sesiune. Site-ul are șapte pagini; un ecran de
   trei secunde la fiecare navigare ar fi o pedeapsă, nu o intrare.
   ========================================================================== */
(function () {
  'use strict';

  var el = document.getElementById('loader');
  if (!el) return;

  var KEY = 'im-loader-seen';
  var HOLD = 400;    // ținerea peste momentul în care site-ul e gata
  var MIN  = 700;    // sub atât ar fi un clipit, nu o intrare

  var bar  = el.querySelector('.loader__bar i');
  var pct  = el.querySelector('.loader__pct');
  var step = el.querySelector('.loader__step');

  var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
  var now = function () {
    return ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
  };

  /* ---------- ieșirea ---------- */
  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* mod privat */ }
    paint(1, 'Gata');
    el.classList.add('loader--done');
    document.documentElement.style.removeProperty('overflow');
    el.addEventListener('transitionend', function () { el.classList.add('loader--gone'); }, { once: true });
    // dacă transitionend nu vine (tab în fundal), scoatem oricum
    setTimeout(function () { el.classList.add('loader--gone'); }, 1400);
  }

  /* A mai văzut-o în sesiunea asta: o scoatem înainte să apuce să clipească. */
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* mod privat */ }
  if (seen) {
    el.classList.add('loader--done', 'loader--gone');
    return;
  }

  /* Blocăm scrollul cât ține ecranul, altfel pagina se mișcă pe dedesubt și
     omul ajunge în mijlocul ei fără să fi văzut hero-ul. */
  document.documentElement.style.overflow = 'hidden';

  /* ---------- desenul ---------- */
  var shown = 0;
  function paint(p, label) {
    if (p < shown) p = shown;         // bara nu merge niciodată înapoi
    shown = p;
    bar.style.setProperty('--p', p.toFixed(3));
    pct.textContent = Math.round(p * 100) + '%';
    if (label && step.textContent !== label) {
      el.classList.add('loader--swap');
      setTimeout(function () {
        step.textContent = label;
        el.classList.remove('loader--swap');
      }, 300);
    }
  }

  /* ---------- semnalele reale ----------
     Fiecare etapă atinsă ridică plafonul. Bara urcă spre plafon continuu, ca
     să nu sară în trepte. */
  var ceiling = 0.10;
  var stages = [
    { at: 0.34, label: 'Se pregătește pagina' },
    { at: 0.55, label: 'Se încarcă fonturile' },
    { at: 0.72, label: 'Se developează fotografia' },
    { at: 0.80, label: 'Se adună cifrele' }
  ];
  var stageIdx = -1;

  function reach(i) {
    if (i <= stageIdx) return;
    stageIdx = i;
    ceiling = stages[i].at;
  }

  reach(0);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { reach(1); });
  } else {
    setTimeout(function () { reach(1); }, 400);
  }

  var hero = document.querySelector('.hero__media img');
  if (hero) {
    var heroDone = function () { reach(2); };
    if (hero.complete) heroDone();
    else {
      hero.addEventListener('load', heroDone, { once: true });
      hero.addEventListener('error', heroDone, { once: true });
    }
  } else {
    reach(2);
  }

  var loadedAt = null;
  function onLoad() {
    if (loadedAt !== null) return;
    reach(3);
    loadedAt = now();
    /* Momentul ieșirii stă pe un cronometru, nu în bucla de desen.
       `requestAnimationFrame` se oprește când browserul nu mai produce cadre
       (tab de fundal, filă ascunsă) — dacă decizia de a termina ar depinde de
       el, ecranul ar îngheța pe loc. Așa, în cel mai rău caz bara se
       oprește din urcat, dar overlay-ul tot pleacă la timp. */
    setTimeout(finish, HOLD);
  }
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad);

  /* Dacă `load` întârzie peste măsură (o imagine care nu vine, o rețea moartă),
     pornim oricum ținerea la 6 s. Ecranul nu are voie să devină o capcană. */
  setTimeout(onLoad, 6000);

  /* ---------- bucla ---------- */
  function tick() {
    if (finished) return;
    var t = now();

    if (loadedAt === null) {
      // încă strângem semnale: ne apropiem lin de plafon, fără să-l atingem
      var p = shown + (ceiling - shown) * 0.06;
      paint(p, stages[stageIdx].label);
    } else {
      // ținerea: ultima cincime se umple pe cele două secunde cerute
      var k = Math.min((t - loadedAt) / HOLD, 1);
      var eased = 1 - Math.pow(1 - k, 3);
      paint(0.80 + 0.20 * eased, k > 0.55 ? 'Aproape gata' : stages[3].label);
      if (k >= 1 && t >= MIN) { finish(); return; }   // de obicei cronometrul ajunge primul
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* Oprire dură, pe `setTimeout`, nu pe `requestAnimationFrame`.
     rAF nu rulează într-un tab de fundal — iar cine deschide site-ul cu
     click pe rotiță face exact asta. Fără plasa asta, bucla de mai sus nu
     apucă niciodată să cheme `finish()`, overlay-ul rămâne pe ecran și,
     mai rău, `overflow: hidden` rămâne pe <html>: pagina nu se mai poate
     derula deloc. `setTimeout` e încetinit în fundal, dar tot se declanșează. */
  setTimeout(finish, 9000);

  /* ---------- scurtătura ----------
     După o secundă apare „apasă ca să intri". Cine nu vrea să aștepte, nu
     așteaptă — și, ca bonus, primul click oprește măsurarea LCP a browserului. */
  setTimeout(function () { if (!finished) el.classList.add('loader--offer'); }, 1000);

  ['click', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    el.addEventListener(ev, finish, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
  });
})();
