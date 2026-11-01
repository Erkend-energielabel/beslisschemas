# Label-server (Cloudflare Worker) voor de Pand analyse-app

Zoekt het geregistreerde energielabel op in EP-Online en geeft het aan de app.
Nodig omdat EP-Online geen verzoeken rechtstreeks vanuit een andere website toestaat.

1. Maak een gratis account op https://dash.cloudflare.com (Workers Free: 100.000 verzoeken per dag).
2. Workers & Pages → Create → Create Worker → naam `ep-label` → Deploy.
3. Edit code → vervang alles door de inhoud van `worker.js` → Deploy.
4. Kopieer het adres (nu: `https://ep-label.long-rain-6721.workers.dev/`) en zet het in de app via ⚙️ bij "Bestaand energielabel".

Optioneel: Settings → Variables and Secrets → Secret `EP_KEY` = je EP-Online API-key (apikey.ep-online.nl).
Dan gebruikt de server de officiële webservice in plaats van het openbare zoekscherm.

Test: open `https://ep-label.<naam>.workers.dev/?q=3343DA%2045` → JSON met `"klasse":"A+++"`.
