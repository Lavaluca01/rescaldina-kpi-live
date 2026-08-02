# Rescaldina KPI Live — PC, tablet e smartphone

Dashboard responsive/PWA per il PV 017 Rescaldina.

## Sorgenti
- `Kerberos_Agosto.xlsx`: budget giornaliero da `Kerb_Mensile`.
- `Progressivo_KPI_Realtime.xlsx`: consuntivo dalla riga `017-RESCALDINA` del foglio `Progressivo Valore`.

## Prova locale
```bash
python scripts/update_kpi.py --budget-file sources/Kerberos_Agosto.xlsx --realtime-file sources/Progressivo_KPI_Realtime.xlsx --out data/kpi.json
python -m http.server 8000
```
Aprire `http://localhost:8000`.

## Aggiornamento automatico GitHub
Creare due repository secrets:
- `KERBEROS_XLSX_URL`: link diretto al file budget.
- `REALTIME_XLSX_URL`: link diretto al progressivo realtime.

Il workflow aggiorna `data/kpi.json` ogni ora. Pubblicare il repository con GitHub Pages.

## Installazione
- PC: usare il browser o “Installa app” da Chrome/Edge.
- Android: menu Chrome → Aggiungi a schermata Home.
- iPhone/iPad: Condividi → Aggiungi alla schermata Home.

Nota: i pop-up web richiedono HTTPS e autorizzazione dell’utente. Le notifiche a browser completamente chiuso richiedono un servizio push dedicato.
