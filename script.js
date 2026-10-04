const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduced ? 0 : ms));
history.scrollRestoration = 'manual';

const LEVEL_XP = 100, BADGE_XP = 25, TERMINAL_XP = 50, MAX_XP = 1000;
const sections = $$('main > section');
const seen = new Set();
let xp = 0;
let terminalUsed = false;

/* ---------- XP et notifications ---------- */
const toast = $('#toast');
let toastTimer;
function notify(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
function addXp(n, msg) {
  xp += n;
  $('#xp').textContent = xp + ' XP';
  $('#xpBar').style.width = Math.min(100, xp / MAX_XP * 100) + '%';
  $('.xp .bar').setAttribute('aria-valuenow', xp);
  if (msg) notify(`${msg}  +${n} XP`);
}

/* ---------- Écran de démarrage ---------- */
async function boot() {
  const lines = ['> initialising quest...', '> loading modules ........ ok', '> mounting skill tree ..... ok', '> player: amine_nfissi', '> ready.'];
  for (const [i, line] of lines.entries()) {
    $('#bootLog').textContent += line + '\n';
    $('#bootBar').style.width = (i + 1) / lines.length * 100 + '%';
    await wait(260);
  }
  await wait(300);
  $('#boot').classList.add('done');
  scramble();
}

/* Le nom se résout lettre par lettre */
function scramble() {
  if (reduced) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01<>/';
  $$('[data-scramble]').forEach((el, k) => {
    const final = el.textContent;
    let frame = 0;
    const timer = setInterval(() => {
      el.textContent = [...final].map((c, i) => i < frame - k * 3 ? c : chars[Math.random() * chars.length | 0]).join('');
      if (++frame > final.length + 8) { el.textContent = final; clearInterval(timer); }
    }, 45);
  });
}

/* ---------- Navigation ---------- */
const menu = $('#menu');
$('#menuList').innerHTML = sections.map(s => {
  const title = s.id === 'home' ? 'Start' : `Level 0${s.dataset.lv} · ${$('h2', s).textContent}`;
  return `<li><a href="#${s.id}">${title}</a></li>`;
}).join('');
$('#menuBtn').onclick = () => menu.showModal();
$('#exploreBtn').onclick = () => menu.showModal();
$$('[data-go]').forEach(b => b.onclick = () => $('#' + b.dataset.go).scrollIntoView());
$$('dialog').forEach(d => d.addEventListener('click', e => {
  if (e.target === d || e.target.closest('[data-close]') || e.target.closest('a')) d.close();
}));

$('.start').addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const btns = $$('.start .btn'), i = btns.indexOf(document.activeElement);
  const next = e.key === 'ArrowDown' ? i + 1 : i - 1 + btns.length;
  btns[next % btns.length].focus();
});

/* ---------- Niveaux et XP ---------- */
const railLinks = $$('.rail a'), menuLinks = $$('#menuList a');
const levelObserver = new IntersectionObserver(entries => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    const lv = +target.dataset.lv;
    railLinks.forEach((a, i) => a.classList.toggle('on', i === lv));
    $('#lvl').textContent = `LVL ${lv}/7`;
    if (lv > 0 && !seen.has(lv)) {
      seen.add(lv);
      railLinks[lv].classList.add('seen');
      menuLinks[lv].classList.add('seen');
      addXp(LEVEL_XP, `Level 0${lv} · ${$('h2', target).textContent}`);
    }
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach(s => levelObserver.observe(s));

/* ---------- Apparition au scroll ---------- */
const revealObserver = new IntersectionObserver((entries, obs) => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
}), { threshold: .15 });
$$('.reveal').forEach(el => revealObserver.observe(el));

/* Éléments qui se débloquent un par un */
function cascade(list, onUnlock) {
  new IntersectionObserver(([entry], obs) => {
    if (!entry.isIntersecting) return;
    obs.disconnect();
    [...list.children].forEach((item, i) => setTimeout(() => {
      item.classList.add('on');
      onUnlock(i + 1, list.children.length);
    }, reduced ? 0 : i * 90));
  }, { threshold: .3 }).observe(list);
}
cascade($('#modules'), n => { $('#modCount').textContent = n; });
cascade($('#badgeList'), (n, total) => {
  addXp(BADGE_XP);
  if (n === total) notify('Tous les badges sont débloqués');
});

/* ---------- Projets ---------- */
$$('.proj .view').forEach(btn => btn.onclick = () => {
  const proj = btn.closest('.proj');
  $('#projTitle').textContent = proj.dataset.t;
  $('#projMore').innerHTML = $('.more', proj).innerHTML;
  $('#projDlg').showModal();
});

/* ---------- Terminal ---------- */
const out = $('#termOut'), input = $('#termIn');
const past = [];
let cursor = 0;

const COMMANDS = {
  help: () => 'Commandes : ' + Object.keys(COMMANDS).join(', '),
  whoami: () => 'Amine Nfissi\nSoftware Engineering Student',
  about: () => "Étudiant en 3ème année à l'ESISA (Fès), spécialité génie logiciel.\nCurieux de tout ce qui touche au code, aux systèmes et aux bases de données.",
  education: () => "Baccalauréat scientifique — Lycée Abdelkrim Rais\nESISA, Fès — Génie logiciel (3ème année)",
  languages: () => 'Arabe : langue maternelle\nFrançais : C1\nAnglais : B2',
  experience: () => 'Stagiaire — Transport SARL\nDéveloppement de flux de données (API / EDI)',
  projects: () => "1. Jeu d'échecs et de dames (C++ / Qt)\n2. Système de gestion académique (C)\n3. Help Desk Lite (PHP, MySQL / MariaDB, HTML, CSS, JavaScript)\n4. Développement de flux de données (API / EDI)",
  skills: () => 'Programming : C, C++, Python, JavaScript, Node.js\nWeb : HTML5, CSS3, JavaScript\nDatabase : SQL, MySQL, MariaDB\nSystems : Linux, Windows, Shell\nTools : MATLAB, Arduino, systèmes embarqués\nElectronics : électronique numérique, traitement du signal, architecture des ordinateurs',
  contact: () => 'aminenf33@gmail.com\n+212 632 256 050\nlinkedin.com/in/amine-nfissi-2ab748337',
  hire: () => { setTimeout(() => { location.href = 'mailto:aminenf33@gmail.com'; }, 600); return 'Bon choix. Ouverture de votre messagerie...'; },
  clear: () => { out.textContent = ''; return ''; }
};

function print(text, cls) {
  if (!text) return;
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = text;
  out.append(line);
  out.scrollTop = out.scrollHeight;
}

function run(raw, manual = true) {
  const cmd = raw.trim().toLowerCase();
  if (!cmd) return;
  print('$ ' + cmd, 'cmd');
  print(COMMANDS[cmd] ? COMMANDS[cmd]() : `${cmd}: commande inconnue. Tape help.`);
  if (manual && !terminalUsed) { terminalUsed = true; addXp(TERMINAL_XP, 'Terminal utilisé'); }
}

$('#termForm').onsubmit = e => {
  e.preventDefault();
  past.push(input.value);
  cursor = past.length;
  run(input.value);
  input.value = '';
};
input.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    cursor = Math.max(0, Math.min(past.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
    input.value = past[cursor] || '';
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const match = Object.keys(COMMANDS).filter(c => c.startsWith(input.value.toLowerCase()));
    if (match.length === 1) input.value = match[0];
  }
});
new IntersectionObserver(([entry], obs) => {
  if (!entry.isIntersecting) return;
  obs.disconnect();
  run('whoami', false);
}, { threshold: .4 }).observe($('#term'));

/* ---------- Fin de mission ---------- */
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) $('#summary').textContent = `${xp} / ${MAX_XP} XP · ${seen.size} niveaux explorés sur 7`;
}).observe($('#end'));
$('#restart').onclick = () => { scrollTo(0, 0); location.reload(); };

boot();
