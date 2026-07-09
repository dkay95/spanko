// Testet die reine Logik des Cloudflare Workers (ohne Netz/Cloud):
// Edit-Anwendung, create, Pfad-Härtung, Eindeutigkeitsprüfung, JSON-Parsing.
import { applyEditsToFiles, safeRelPath, parseModelJson, systemPrompt, sanitizeHistory } from '../cloud/worker.js';

let ok = true;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { ok = false; console.error(`FEHLER ${name}: ${g} !== ${w}`); }
};
const truthy = (name, v) => { if (!v) { ok = false; console.error(`FEHLER ${name}: falsy`); } };

// --- parseModelJson ---
eq('json-plain', parseModelJson('{"reply":"hi"}'), { reply: 'hi' });
eq('json-fenced', parseModelJson('```json\n{"reply":"hi"}\n```'), { reply: 'hi' });
eq('json-embedded', parseModelJson('Hier: {"reply":"hi","edits":[]}'), { reply: 'hi', edits: [] });
truthy('json-fallback', parseModelJson('nur text').reply === 'nur text');

// --- safeRelPath ---
eq('safe-ok', safeRelPath('styles.css'), 'styles.css');
eq('safe-sub', safeRelPath('pages/betten.html'), 'pages/betten.html');
const rejects = (p) => { try { safeRelPath(p); return false; } catch { return true; } };
truthy('safe-traversal', rejects('../server/server.js'));
truthy('safe-abs', rejects('/etc/passwd'));
truthy('safe-uploads', rejects('assets/uploads/x.html'));
truthy('safe-binary', rejects('assets/foto.png'));

// --- applyEditsToFiles ---
const files = {
  'styles.css': ':root { --gold: #c99a4b; }',
  'i18n.js': "hero_tag: 'A', // pl\nhero_tag: 'A', // de",
};
const known = new Set(['styles.css', 'i18n.js', 'index.html']);

// einfacher Edit
let r = applyEditsToFiles(files, [{ op: 'edit', file: 'styles.css', find: '#c99a4b', replace: '#d4a55c' }], known);
eq('edit-applied', r.applied, ['styles.css']);
truthy('edit-content', r.changed['styles.css'].includes('#d4a55c'));
truthy('edit-original-untouched', files['styles.css'].includes('#c99a4b')); // Original-Map unverändert

// mehrdeutiger find → abgelehnt
r = applyEditsToFiles(files, [{ op: 'edit', file: 'i18n.js', find: "hero_tag: 'A',", replace: "hero_tag: 'B'," }], known);
eq('edit-ambiguous-applied', r.applied, []);
truthy('edit-ambiguous-failed', r.failed.length === 1 && /eindeutig/.test(r.failed[0]));

// zwei Edits derselben Datei bauen aufeinander auf
r = applyEditsToFiles(files, [
  { op: 'edit', file: 'i18n.js', find: "hero_tag: 'A', // pl", replace: "hero_tag: 'X', // pl" },
  { op: 'edit', file: 'i18n.js', find: "hero_tag: 'A', // de", replace: "hero_tag: 'Y', // de" },
], known);
eq('edit-chained-applied', r.applied, ['i18n.js', 'i18n.js']);
truthy('edit-chained-content', r.changed['i18n.js'].includes("'X'") && r.changed['i18n.js'].includes("'Y'"));

// create neue Datei
r = applyEditsToFiles(files, [{ op: 'create', file: 'pages/neu.html', content: '<h1>x</h1>' }], known);
eq('create-applied', r.applied, ['pages/neu.html (neu)']);
truthy('create-content', r.changed['pages/neu.html'] === '<h1>x</h1>');

// create auf existierende Datei → abgelehnt
r = applyEditsToFiles(files, [{ op: 'create', file: 'styles.css', content: 'x' }], known);
truthy('create-existing-rejected', r.applied.length === 0 && r.failed.length === 1);

// Ausbruchsversuch → abgelehnt, echte Datei nie berührt
r = applyEditsToFiles(files, [{ op: 'edit', file: '../server/server.js', find: 'const', replace: 'x' }], known);
truthy('escape-rejected', r.applied.length === 0);

// Limit von 10 Edits
const many = Array.from({ length: 12 }, (_, i) => ({ op: 'create', file: `pages/p${i}.html`, content: 'x' }));
r = applyEditsToFiles(files, many, known);
truthy('limit-applied', r.applied.length === 10);
truthy('limit-warned', r.failed.some(f => /verworfen|pominięto/.test(f)));

// --- sanitizeHistory ---
eq('hist-empty', sanitizeHistory(undefined), []);
eq('hist-valid', sanitizeHistory([{ role: 'user', content: 'hallo' }, { role: 'assistant', content: 'hi' }]),
  [{ role: 'user', content: 'hallo' }, { role: 'assistant', content: 'hi' }]);
eq('hist-filter-badrole', sanitizeHistory([{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }]),
  [{ role: 'user', content: 'y' }]);
eq('hist-filter-empty', sanitizeHistory([{ role: 'user', content: '   ' }, { role: 'user', content: 'z' }]),
  [{ role: 'user', content: 'z' }]);
truthy('hist-cap-12', sanitizeHistory(Array.from({ length: 30 }, () => ({ role: 'user', content: 'a' }))).length === 12);
truthy('hist-nonarray', sanitizeHistory('nope').length === 0);
truthy('hist-content-trim', sanitizeHistory([{ role: 'user', content: 'x'.repeat(9999) }])[0].content.length === 4000);

// --- systemPrompt enthält die Dateien ---
const sp = systemPrompt(files);
truthy('prompt-has-file', sp.includes('===== styles.css =====') && sp.includes('#c99a4b'));

console.log(ok ? 'WORKER-LOGIC OK' : 'WORKER-LOGIC FAIL');
process.exit(ok ? 0 : 1);
