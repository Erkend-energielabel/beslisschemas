"""RVO kostenkentallen woningbouw -> data/kostenkentallen.json (+ archief per peildatum).

Haalt de complete Excel op van regelhulpenvoorbedrijven.nl, zet per maatregel (RVO-code) en per variant
(egw/mgw x enkel/projectmatig x min/mid/max) de 'Totaal bouwkosten (EUR/eh)' en het arbeidsaandeel
(Totaal arbeid / Totaal directe kosten) om naar JSON. Alleen bij een inhoudelijke wijziging wordt er iets
geschreven; oude peildata blijven in data/kostenkentallen/ staan.
Gebruik: python tools/kostenkentallen.py data [pad-naar-xlsx]
"""
import sys, os, re, json, hashlib, urllib.request, datetime, openpyxl

URL = 'https://regelhulpenvoorbedrijven.nl/kostenkentallen/kostenkentallen/woningbouw.xlsx'
VAR = ['egw-tus-enk-min', 'egw-tus-enk-mid', 'egw-tus-enk-max', 'egw-tus-pro-min', 'egw-tus-pro-mid', 'egw-tus-pro-max',
       'mgw-tus-enk-min', 'mgw-tus-enk-mid', 'mgw-tus-enk-max', 'mgw-tus-pro-min', 'mgw-tus-pro-mid', 'mgw-tus-pro-max']
BIO = re.compile(r'biobased|bio[- ]?eps|houtvezel|houtwol|vlas|hennep|stro\b|strobal|cellulose|kurk|schapenwol|\briet|lisdodde|'
                 r'mycelium|zeegras|olifantsgras|miscanthus|katoen|jute|kemp|houtskelet|hout(en)? ?(vezel|wol)', re.I)
MAAND = 'januari februari maart april mei juni juli augustus september oktober november december'.split()


def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None


def getal(s):
    return float(s.replace(',', '.')) if s else None


def schoon(e):
    e = re.sub(r'[,.]?\s*[em]gw-tus-(enk|pro)-(gem|min|max|mid)\.?\s*$', '', str(e or '').strip())
    return re.sub(r'\.\s*$', '', e).strip()


def lees(pad):
    wb = openpyxl.load_workbook(pad, read_only=True, data_only=True)
    rows = list(wb.worksheets[0].iter_rows(values_only=True))
    kop = [str(x or '').replace('\n', ' ').strip() for x in rows[0]]
    col = {n: kop.index(n) for n in ['Stabu', 'S', 'Mr. nr', 'Omschrijving', 'Eh', 'Totaal arbeid', 'Totaal directe kosten', 'Totaal bouwkosten (€/eh)']}
    tekst = ' '.join(str(v) for r in rows[1:3] for v in r if v)
    m = re.search(r'peildatum\s+([a-z]+)\s+(\d{4})', tekst, re.I)
    peil = f'{m.group(1).lower()} {m.group(2)}' if m else 'onbekend'
    sleutel = f'{m.group(2)}-{MAAND.index(m.group(1).lower()) + 1:02d}' if m and m.group(1).lower() in MAAND else peil
    hg = sg = None; groepen = []; mt = {}
    for r in rows[3:]:
        s = str(r[col['S']] if r[col['S']] is not None else '')
        if s == '*':
            hg = {'nr': str(r[col['Mr. nr']] or r[0] or len(groepen) + 1).strip(), 'naam': str(r[col['Omschrijving']]).strip(), 'sub': []}; groepen.append(hg)
        elif s == '#':
            sg = {'nr': str(r[0]).strip(), 'naam': str(r[col['Omschrijving']]).strip(), 'codes': []}; hg['sub'].append(sg)
        elif s == '4':
            code = str(r[col['Mr. nr']] or '').strip(); vk = str(r[col['Stabu']] or '').strip()
            if not code or vk not in VAR: continue
            x = mt.get(code)
            if not x:
                x = mt[code] = {'e': schoon(r[col['Omschrijving']]), 'h': str(r[col['Eh']] or '').strip(), 'hg': hg['nr'], 'sg': sg['nr'], 'v': [None] * 12, '_t': []}
                sg['codes'].append(code)
            tot, arb, dk = num(r[col['Totaal bouwkosten (€/eh)']]), num(r[col['Totaal arbeid']]), num(r[col['Totaal directe kosten']])
            if tot is not None: x['v'][VAR.index(vk)] = [round(tot, 2), round(arb / dk, 3) if dk else 0]
            x['_t'].append(str(r[col['Omschrijving']] or ''))
    for code, x in mt.items():
        t = ' '.join(x.pop('_t')) + ' ' + x['e']
        rd = re.search(r'Rd\s*[=:]?\s*(\d+(?:,\d+)?)', t); rc = re.search(r'Rc\s*[=:]?\s*(\d+(?:,\d+)?)', t); u = re.search(r'\bU[gw]?\s*[=:]?\s*(\d+(?:,\d+)?)', t)
        if rd: x['rd'] = getal(rd.group(1))
        if rc: x['rc'] = getal(rc.group(1))
        if u: x['u'] = getal(u.group(1))
        if BIO.search(t): x['bio'] = 1
    groepen = [g for g in groepen if any(s['codes'] for s in g['sub'])]
    for g in groepen: g['sub'] = [s for s in g['sub'] if s['codes']]
    return {'peildatum': peil, 'sleutel': sleutel, 'bron': URL, 'kolom': 'Totaal bouwkosten (€/eh), excl. btw; arbeidsaandeel = Totaal arbeid / Totaal directe kosten',
            'varianten': VAR, 'groepen': groepen, 'm': mt}


def main():
    uit = sys.argv[1]; arch = os.path.join(uit, 'kostenkentallen'); os.makedirs(arch, exist_ok=True)
    if len(sys.argv) > 2: pad = sys.argv[2]
    else:
        pad = '/tmp/woningbouw.xlsx'
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Erkend-Energielabel.nl kostenkentallen)'})
        open(pad, 'wb').write(urllib.request.urlopen(req, timeout=180).read())
    d = lees(pad)
    if len(d['m']) < 50: sys.exit(f'Te weinig maatregelen gevonden ({len(d["m"])}): Excel-indeling gewijzigd?')
    inhoud = json.dumps({k: d[k] for k in ('peildatum', 'groepen', 'm')}, ensure_ascii=False, sort_keys=True)
    d['hash'] = hashlib.sha256(inhoud.encode()).hexdigest()[:16]
    laatst = os.path.join(uit, 'kostenkentallen.json')
    oud = json.load(open(laatst)) if os.path.exists(laatst) else {}
    status = {'gecontroleerd': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'), 'peildatum': d['peildatum'], 'hash': d['hash'], 'aantal': len(d['m'])}
    if oud.get('hash') == d['hash']:
        json.dump({**status, 'gewijzigd': False}, open(os.path.join(arch, 'status.json'), 'w'), ensure_ascii=False, indent=1)
        print('Geen wijziging bij RVO (peildatum', d['peildatum'] + ').'); return
    json.dump({**status, 'gewijzigd': True}, open(os.path.join(arch, 'status.json'), 'w'), ensure_ascii=False, indent=1)
    d['opgehaald'] = datetime.date.today().isoformat()
    naam = d['sleutel'] if not os.path.exists(os.path.join(arch, d['sleutel'] + '.json')) or json.load(open(os.path.join(arch, d['sleutel'] + '.json'))).get('hash') == d['hash'] \
        else d['sleutel'] + '-' + d['opgehaald']          # zelfde peildatum maar andere cijfers: apart bewaren
    tekst = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(arch, naam + '.json'), 'w').write(tekst)
    open(laatst, 'w').write(tekst)
    idx = sorted({f[:-5] for f in os.listdir(arch) if f.endswith('.json') and f not in ('index.json', 'status.json')}, reverse=True)
    lijst = []
    for k in idx:
        x = json.load(open(os.path.join(arch, k + '.json')))
        lijst.append({'bestand': k + '.json', 'peildatum': x['peildatum'], 'opgehaald': x.get('opgehaald'), 'aantal': len(x['m'])})
    json.dump({'laatst': naam + '.json', 'peildata': lijst}, open(os.path.join(arch, 'index.json'), 'w'), ensure_ascii=False, indent=1)
    print('Nieuwe kostenkentallen:', d['peildatum'], len(d['m']), 'maatregelen ->', naam)


if __name__ == '__main__':
    main()
