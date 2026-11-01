/* Erkend-Energielabel.nl — energielabel-opzoeker voor de Pand analyse-app.
   Cloudflare Worker: zoekt het geregistreerde energielabel op in EP-Online en geeft JSON terug.
   - Met variabele EP_KEY (gratis EP-Online API-key): officiële webservice.
   - Zonder EP_KEY: het openbare zoekscherm van www.ep-online.nl.
   Aanroep:  GET https://<worker>/?q=3343DA%2045&vbo=0531010000000065                                  */
const TOEGESTAAN = ['https://erkend-energielabel.github.io', 'http://localhost', 'http://127.0.0.1'];
const SITE = 'https://www.ep-online.nl/Energylabel/Search';
const API = 'https://public.ep-online.nl/api/v5/PandEnergielabel';

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': TOEGESTAAN.some(o => origin.startsWith(o)) ? origin : TOEGESTAAN[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const vbo = (url.searchParams.get('vbo') || '').replace(/\D/g, '');
    if (!/^\d{4} ?[A-Z]{2} \d+/.test(q) && !vbo) return json({ fout: 'Geef q=postcode huisnummer (bv. 3343DA 45) en/of vbo=BAG-verblijfsobject-id' }, 400, cors);

    const sleutel = new Request('https://cache.label/' + encodeURIComponent(q + '|' + vbo + '|' + (env.EP_KEY ? 'api' : 'site')));
    const cache = caches.default;
    const hit = await cache.match(sleutel);
    if (hit) { const r = new Response(hit.body, hit); Object.entries(cors).forEach(([k, v]) => r.headers.set(k, v)); return r; }

    let labels = [], bron;
    try {
      if (env.EP_KEY) { labels = await viaApi(q, vbo, env.EP_KEY); bron = 'EP-Online webservice'; }
      else { labels = await viaSite(q || vbo); bron = 'EP-Online (openbaar zoekscherm)'; }
    } catch (e) { return json({ fout: 'EP-Online niet bereikbaar: ' + (e.message || e) }, 502, cors); }

    labels.sort((a, b) => (a.ingetrokken ? 1 : 0) - (b.ingetrokken ? 1 : 0) || datum(b.registratiedatum) - datum(a.registratiedatum));
    const passend = vbo ? labels.filter(l => l.vbo === vbo) : labels;
    const uit = { q, vbo, bron, label: (passend[0] || (vbo ? null : labels[0])) || null, alle: labels, opgehaald: new Date().toISOString() };
    const res = json(uit, 200, { ...cors, 'Cache-Control': 'public, max-age=86400' });
    ctx.waitUntil(cache.put(sleutel, res.clone()));
    return res;
  }
};

const json = (o, s, h) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...h } });
const datum = d => { const m = /(\d{2})-(\d{2})-(\d{4})/.exec(d || ''); return m ? +(m[3] + m[2] + m[1]) : 0; };
const schoon = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&sup2;/g, '²').replace(/&nbsp;/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/\s+/g, ' ').trim();
const leeg = v => (v == null || v === '-' || v === '' ? null : v);

/* ---------- openbaar zoekscherm ---------- */
async function viaSite(zoek) {
  const kop = { 'User-Agent': 'Mozilla/5.0 (Erkend-Energielabel.nl pand analyse)', 'Accept': 'text/html' };
  const r1 = await fetch(SITE, { headers: kop });
  const html1 = await r1.text();
  const token = (/name="__RequestVerificationToken"[^>]*value="([^"]+)"/.exec(html1) || /value="([^"]+)"[^>]*name="__RequestVerificationToken"/.exec(html1) || [])[1];
  if (!token) throw new Error('geen formulier-token');
  const koekjes = (r1.headers.getSetCookie ? r1.headers.getSetCookie() : (r1.headers.get('set-cookie') || '').split(/,(?=\s*[^;,]+=)/))
    .map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  const body = new URLSearchParams({ SearchValue: zoek, __RequestVerificationToken: token });
  const r2 = await fetch(SITE, { method: 'POST', headers: { ...kop, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': koekjes, 'Origin': 'https://www.ep-online.nl', 'Referer': SITE }, body });
  if (!r2.ok) throw new Error('zoeken HTTP ' + r2.status);
  return parseSite(await r2.text());
}
function parseSite(html) {
  const blokken = html.split(/<div class="se-result-item[^"]*"/).slice(1);
  return blokken.map(b => {
    const v = {};
    const re = /se-item-description[^"]*"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>\s*<div class="[^"]*se-item-(?:value|number)[^"]*"[^>]*>\s*(?:<span[^>]*>([\s\S]*?)<\/span>)?/g;
    let m; while ((m = re.exec(b))) { const k = schoon(m[1]); if (!(k in v)) v[k] = schoon(m[2]); }
    const adres = schoon((/sort-value-pht[^>]*>([\s\S]*?)<\/span>/.exec(b) || [])[1]);
    const status = schoon((/Status van het energielabel:<\/span>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/.exec(b) || [])[1]);
    const getal = k => { const x = leeg(v[k]); if (x == null) return null; const n = parseFloat(x.replace(/[^\d,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
    return {
      adres, status: status || null,
      klasse: leeg(v['Labelklasse'] || v['Energieklasse']),
      vbo: leeg(v['BAG verblijfsobject id']), pand: leeg(v['BAG pand id']),
      registratienummer: leeg(v['Registratienummer']),
      registratiedatum: leeg(v['Registratiedatum']), opnamedatum: leeg(v['Opnamedatum']), geldigTot: leeg(v['Geldig tot']),
      certificaathouder: leeg(v['Certificaathouder']), ingetrokken: leeg(v['Ingetrokken']),
      statusRegistratie: leeg(v['Status']), soortOpname: leeg(v['Soort opname']), berekening: leeg(v['Berekening volgens']),
      ag: getal('Gebr. opp. thermische zone'),
      energiebehoefte: getal('Energiebehoefte'), ep2: getal('Prim. fossiel energiegebruik'),
      hernieuwbaar: getal('Aandeel hernieuwbare energie'), warmtebehoefte: getal('Warmtebehoefte'),
      energieindex: getal('Energie-index') ?? getal('Energieindex')
    };
  }).filter(l => l.klasse || l.vbo);
}

/* ---------- officiële webservice (met API-key) ---------- */
async function viaApi(q, vbo, key) {
  let u;
  if (vbo) u = `${API}/AdresseerbaarObject/${vbo}`;
  else {
    const m = /^(\d{4}) ?([A-Z]{2}) (\d+)\s*([A-Z])?(?:[- ]?(\w+))?$/.exec(q);
    if (!m) throw new Error('adres niet herkend');
    u = `${API}/Adres?postcode=${m[1]}${m[2]}&huisnummer=${m[3]}` + (m[4] ? `&huisletter=${m[4]}` : '') + (m[5] ? `&huisnummertoevoeging=${m[5]}` : '');
  }
  const r = await fetch(u, { headers: { Authorization: key, Accept: 'application/json' } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('webservice HTTP ' + r.status);
  const d = await r.json();
  const nl = s => { if (!s) return null; const t = new Date(s); return isNaN(t) ? s : t.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-'); };
  return (Array.isArray(d) ? d : [d]).map(x => ({
    adres: [x.Postcode, x.Huisnummer, x.Huisletter, x.Huisnummertoevoeging].filter(Boolean).join(' '),
    status: x.Status || null, klasse: x.Energieklasse || x.Labelklasse || null,
    vbo: x.BAGVerblijfsobjectID || null, pand: x.BAGPandID || null, registratienummer: x.Registratienummer || null,
    registratiedatum: nl(x.Registratiedatum), opnamedatum: nl(x.Opnamedatum), geldigTot: nl(x.Geldig_tot || x.GeldigTot),
    certificaathouder: x.Certificaathouder || null, ingetrokken: x.Ingetrokken ? 'ja' : null,
    statusRegistratie: x.Gebouwklasse || null, soortOpname: x.SoortOpname || null, berekening: x.Berekeningstype || null,
    ag: x.Gebruiksoppervlakte_thermische_zone ?? null, energiebehoefte: x.Energiebehoefte ?? null,
    ep2: x.PrimaireFossieleEnergie ?? null, hernieuwbaar: x.Aandeel_hernieuwbare_energie ?? null,
    warmtebehoefte: x.Warmtebehoefte ?? null, energieindex: x.EnergieIndex ?? null
  }));
}
