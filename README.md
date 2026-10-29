# Synchronisierung im Wechselgetriebe – 3D-Modell & Übungen

Interaktives Lehrmodell einer **Sperrsynchronisierung (Bauart Borg-Warner)** in einem 2-Gang-Vorgelegegetriebe.

- **`index.html` – 3D-Modell:** Gänge 1 / N / 2 schalten (auch per Taste `1`, `2`, `N`), Drehzahlangleichung live im Diagramm, Abwicklung der Verzahnungen (Muffe, Synchronring, Kupplungsverzahnung), Schnittansicht mit verschiebbarer Schnittebene, Explosionsansicht, Beschriftung, Kraftfluss-Hervorhebung, Synchronring aus-/einbaubar (Zähne ratschen).
- **`uebungen.html` – Übungsaufgaben:** Bauteile im 3D-Modell benennen, Kraftfluss für 1./2. Gang ordnen, Phasen eines Schaltvorgangs ordnen, Verständnisfragen, Drehzahlberechnung.

Link-Parameter für das Modell: `index.html?gang=1&schnitt=1&beschriftung=1`

## Veröffentlichen mit GitHub Pages

1. Neues Repository auf GitHub anlegen und diesen Ordner hochladen (oder `git push`).
2. Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**, Branch `main`, Ordner `/ (root)`.
3. Nach ca. 1 Minute ist die Seite unter `https://<benutzername>.github.io/<repository>/` erreichbar.

Keine Build-Schritte nötig – reines HTML/CSS/JS; three.js wird vom CDN (jsDelivr) geladen.

## Lokal testen

ES-Module brauchen einen Webserver, z. B. `npx serve .` oder `python -m http.server`, dann `http://localhost:3000` bzw. `:8000` öffnen.
