# DLB Opname — installatie

Een web-app (PWA) in De Laat Bouwbegeleiding-stijl: opnemen → transcriberen met sprekers → samenvatten met sjablonen → vragen stellen → exporteren naar Word/PDF. Alles wordt lokaal op je iPhone opgeslagen.

## 1. Online zetten (eenmalig, gratis)
Voor microfoontoegang is HTTPS nodig. Kies één van deze twee:

**GitHub Pages** (je hebt al een account)
1. Maak op github.com een nieuwe repository, bijv. `dlb-opname` (Public).
2. *Add file → Upload files* → sleep alle bestanden uit deze map erin → *Commit*.
3. *Settings → Pages → Branch: main / root → Save*.
4. Na ±1 minuut staat de app op `https://<account>.github.io/dlb-opname/`.

**Netlify Drop**: ga naar app.netlify.com/drop en sleep de map erin. Klaar.

## 2. Op de iPhone
1. Open de link in **Safari** → Deel ⎋ → **Zet op beginscherm**.
2. Open de app via het icoon → Instellingen → plak je **gratis Google Gemini-sleutel**:
   - Ga naar aistudio.google.com/apikey, log in met een Google-account → *Create API key* → kopiëren. Geen creditcard nodig.
3. Tik op *Verbinding testen*. Klaar: transcriptie én samenvattingen werken nu gratis.

Optioneel (betaald): Claude voor samenvattingen of ElevenLabs voor transcriptie. Niet nodig.

## Kosten
| | Plaud Note Pro | DLB Opname (gratis) |
|---|---|---|
| Hardware | € 189 | € 0 (je iPhone) |
| Abonnement | € 0–35 p/m | € 0 |
| Hosting | – | € 0 (GitHub Pages / Netlify) |
| AI | in bundel | € 0 (gratis versie van Gemini) |

**De gratis versie van Gemini heeft twee kanttekeningen:**
- **Limieten:** een beperkt aantal verzoeken per minuut en per dag. Een overleg van een uur kost ±6 verzoeken, dus een paar overleggen per dag past ruim. Bij de minuutlimiet wacht de app zelf even. Bij de daglimiet probeer je het morgen opnieuw.
- **Privacy:** Google mag de inhoud gebruiken om z'n AI te verbeteren. Voor vertrouwelijke klantgesprekken zet je billing aan in AI Studio. Dat is dezelfde sleutel en kost een paar cent per uur, en dan gebruikt Google je data niet.

## Goed om te weten
- **Houd de app open** tijdens het opnemen; het scherm blijft automatisch aan. Schakel je weg, dan pauzeert iOS de microfoon. Zodra je terug bent, hervat de app vanzelf (dit wordt als notitie vastgelegd).
- De opname wordt elke 4 seconden opgeslagen. Crasht de app, dan wordt hij bij de volgende keer openen hersteld.
- **Telefoongesprekken**: gebruik de ingebouwde gespreksopname van iOS 18.1+. Die komt in Notities → *Bewaar audio in Bestanden* → hier importeren. Of zet het gesprek op de luidspreker en kies soort "Telefoon".
- Maak af en toe een back-up (Instellingen) of exporteer verslagen naar Word. iOS kan data van web-apps opruimen als je de app weken niet gebruikt.
- Werkt de microfoon niet meer in de beginscherm-app? Sluit de app helemaal af (omhoog vegen) en open hem opnieuw. Dat is een bekende iOS-bug.
