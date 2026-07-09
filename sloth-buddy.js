// Der kleine Faultier-Bewohner der Seite: läuft vorbei, macht ein Nickerchen
// auf einer Mini-Matratze und lugt aus dem Bildschirmrand. Rein dekorativ.
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wrap = document.createElement('div');
  wrap.id = 'slothBuddy';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <div class="sloth-side" id="peekL"><img src="assets/sloth-peek.svg" alt=""></div>
    <div class="sloth-side" id="peekR"><img src="assets/sloth-peek.svg" alt=""></div>
    <div id="slothWalker">
      <div class="sloth-flip">
        <svg id="slothSvg" viewBox="0 0 150 112" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="78" cy="106" rx="48" ry="5" fill="rgba(20,25,40,.15)"/>

          <g id="poseWalk" class="pose">
            <g class="leg legA"><rect x="37" y="68" width="11" height="34" rx="5.5" fill="#eedcba" stroke="#a87c42" stroke-width="2.5"/></g>
            <g class="leg legB"><rect x="57" y="68" width="11" height="34" rx="5.5" fill="#eedcba" stroke="#a87c42" stroke-width="2.5"/></g>
            <g class="leg legA"><rect x="83" y="68" width="11" height="34" rx="5.5" fill="#eedcba" stroke="#a87c42" stroke-width="2.5"/></g>
            <g class="leg legB"><rect x="103" y="68" width="11" height="34" rx="5.5" fill="#eedcba" stroke="#a87c42" stroke-width="2.5"/></g>
            <ellipse cx="74" cy="54" rx="43" ry="27" fill="#f2e4c6" stroke="#a87c42" stroke-width="3"/>
            <path d="M52 32 q6 -6 13 -5" fill="none" stroke="#a87c42" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
            <path d="M76 29 q7 -3 12 1" fill="none" stroke="#a87c42" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
            <circle cx="115" cy="40" r="25" fill="#f2e4c6" stroke="#a87c42" stroke-width="3"/>
            <path d="M103 18 q4 -5 10 -4" fill="none" stroke="#a87c42" stroke-width="2" stroke-linecap="round" opacity=".5"/>
            <ellipse cx="106" cy="38" rx="6.5" ry="10" fill="#a5906f" opacity=".75" transform="rotate(-18 106 38)"/>
            <ellipse cx="124.5" cy="38" rx="6.5" ry="10" fill="#a5906f" opacity=".75" transform="rotate(18 124.5 38)"/>
            <circle cx="106" cy="39" r="4.2" fill="#3c2f1e"/>
            <circle cx="124" cy="39" r="4.2" fill="#3c2f1e"/>
            <circle cx="107.4" cy="37.6" r="1.4" fill="#fff"/>
            <circle cx="125.4" cy="37.6" r="1.4" fill="#fff"/>
            <ellipse cx="115" cy="50" rx="3.6" ry="2.7" fill="#5a4632"/>
            <path d="M111.5 56 q3.5 3 7 0" fill="none" stroke="#5a4632" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="98" cy="49" r="2.6" fill="#e8b27d" opacity=".5"/>
            <circle cx="132" cy="49" r="2.6" fill="#e8b27d" opacity=".5"/>
          </g>

          <g id="poseSleep" class="pose">
            <rect x="22" y="82" width="116" height="20" rx="7" fill="#fdf8ee" stroke="#c99a4b" stroke-width="2.5"/>
            <rect x="26" y="75" width="28" height="13" rx="6.5" fill="#ffffff" stroke="#e2d7bf" stroke-width="2"/>
            <path d="M48 84 Q56 60 82 57 Q112 54 122 84 Z" fill="#f2e4c6" stroke="#a87c42" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="114" cy="80" r="5" fill="#f2e4c6" stroke="#a87c42" stroke-width="2.5"/>
            <path d="M64 82 Q80 73 96 79" fill="none" stroke="#a87c42" stroke-width="11" stroke-linecap="round"/>
            <path d="M64 82 Q80 73 96 79" fill="none" stroke="#f2e4c6" stroke-width="7" stroke-linecap="round"/>
            <circle cx="52" cy="70" r="19" fill="#f2e4c6" stroke="#a87c42" stroke-width="3"/>
            <ellipse cx="45" cy="68" rx="5" ry="7.5" fill="#a5906f" opacity=".75" transform="rotate(-18 45 68)"/>
            <ellipse cx="59.5" cy="68" rx="5" ry="7.5" fill="#a5906f" opacity=".75" transform="rotate(18 59.5 68)"/>
            <path d="M42 68 q3 2.6 6 0" fill="none" stroke="#5a4632" stroke-width="2" stroke-linecap="round"/>
            <path d="M56.5 68 q3 2.6 6 0" fill="none" stroke="#5a4632" stroke-width="2" stroke-linecap="round"/>
            <ellipse cx="52" cy="76" rx="2.8" ry="2.1" fill="#5a4632"/>
            <path d="M49.5 80.5 q2.5 2.2 5 0" fill="none" stroke="#5a4632" stroke-width="2" stroke-linecap="round"/>
            <text class="zz" x="66" y="46" font-family="Georgia, serif" font-size="15" fill="#c99a4b">z</text>
            <text class="zz z2" x="79" y="34" font-family="Georgia, serif" font-size="12" fill="#c99a4b">z</text>
            <text class="zz z3" x="90" y="24" font-family="Georgia, serif" font-size="9" fill="#c99a4b">z</text>
          </g>
        </svg>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const walker = wrap.querySelector('#slothWalker');
  const flip = wrap.querySelector('.sloth-flip');
  const svg = wrap.querySelector('#slothSvg');
  const peekEls = { left: wrap.querySelector('#peekL'), right: wrap.querySelector('#peekR') };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  let token = 0;
  let curX = -180;
  let fleeing = false;
  const cancelled = t => t !== token;

  function place(x) {
    walker.style.transition = 'none';
    walker.style.transform = `translateX(${x}px)`;
    curX = x;
    void walker.offsetWidth;
  }

  async function moveTo(x, speed) {
    const dur = Math.max(200, Math.abs(x - curX) / speed);
    walker.style.transition = `transform ${dur}ms linear`;
    walker.style.transform = `translateX(${x}px)`;
    curX = x;
    await wait(dur);
  }

  // gemütlich vorbeilaufen — optional mit Nickerchen in der Mitte
  async function actWalk(t, nap) {
    const W = innerWidth;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const from = dir > 0 ? -180 : W + 50;
    const to = dir > 0 ? W + 50 : -180;
    flip.style.transform = `scaleX(${dir})`;
    place(from);
    svg.classList.remove('sleeping');
    svg.classList.add('walking');
    const speed = Math.random() < 0.25 ? 0.2 : 0.055 + Math.random() * 0.035;

    if (nap) {
      const mid = W * (0.25 + Math.random() * 0.5) - 66;
      await moveTo(mid, speed);
      if (cancelled(t)) return;
      svg.classList.remove('walking');
      svg.classList.add('sleeping');
      await wait(6500 + Math.random() * 4500);
      if (cancelled(t)) { svg.classList.remove('sleeping'); return; }
      svg.classList.remove('sleeping');
      await wait(600);
      if (cancelled(t)) return;
      svg.classList.add('walking');
    }

    await moveTo(to, speed);
    if (cancelled(t)) return;
    svg.classList.remove('walking');
  }

  // aus dem Bildschirmrand lugen
  async function actPeek(t, side) {
    const el = peekEls[side];
    el.classList.add('show');
    await wait(3500 + Math.random() * 2500);
    el.classList.remove('show');
    await wait(900);
  }

  // angeklickt → erschrecken und davonflitzen
  svg.addEventListener('click', async () => {
    if (fleeing) return;
    fleeing = true;
    token++;
    const dir = flip.style.transform.includes('-1') ? -1 : 1;
    svg.classList.remove('sleeping');
    svg.classList.add('hop', 'walking');
    await wait(380);
    svg.classList.remove('hop');
    walker.style.transition = 'transform 1400ms cubic-bezier(.45,.05,.55,.95)';
    walker.style.transform = `translateX(${dir > 0 ? innerWidth + 60 : -190}px)`;
    curX = dir > 0 ? innerWidth + 60 : -190;
    await wait(1450);
    svg.classList.remove('walking');
    fleeing = false;
  });

  // kleine Fernbedienung (auch für den Design-Chat nützlich)
  window.spankoSloth = {
    walk: (nap) => { const t = ++token; return actWalk(t, !!nap); },
    peek: (side) => { const t = ++token; return actPeek(t, side === 'right' ? 'right' : 'left'); },
  };

  (async () => {
    await wait(2500);
    while (true) {
      if (!document.hidden && !fleeing) {
        const t = ++token;
        const r = Math.random();
        try {
          if (r < 0.3) await actPeek(t, r < 0.15 ? 'left' : 'right');
          else if (r < 0.65) await actWalk(t, false);
          else await actWalk(t, true);
        } catch {}
      }
      await wait(8000 + Math.random() * 14000);
    }
  })();
})();
