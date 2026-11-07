"""Verkenning: RVO woningbouw.xlsx ophalen en structuur dumpen."""
import sys, os, urllib.request, json, openpyxl
URL = 'https://regelhulpenvoorbedrijven.nl/kostenkentallen/kostenkentallen/woningbouw.xlsx'
uit = sys.argv[1]; os.makedirs(uit + '/rvo', exist_ok=True)
req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Erkend-Energielabel.nl)'})
raw = urllib.request.urlopen(req, timeout=120).read()
open(uit + '/rvo/woningbouw-laatst.xlsx', 'wb').write(raw)
wb = openpyxl.load_workbook(uit + '/rvo/woningbouw-laatst.xlsx', read_only=True, data_only=True)
d = {}
for ws in wb.worksheets:
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i < 12 or i % 400 == 0: rows.append([None if v is None else str(v)[:80] for v in r][:80])
        n = i
    d[ws.title] = {'n': n, 'rows': rows}
json.dump(d, open(uit + '/rvo/verkenning.json', 'w'), ensure_ascii=False, indent=0)
