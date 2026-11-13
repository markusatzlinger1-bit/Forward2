# Forward 1.2 – iPhone (PWA)

## Änderungen
- Kapitel unter **••• → Zurück zu Draft** wieder in den Entwurfsmodus setzen. Bereits gesperrte Absätze bleiben gesperrt. Bei zwischenzeitlich geänderter Revision wird deren Text intern in `revisionHistory` gesichert (über die JSON-Bibliothekssicherung zugänglich).
- **—** in der Formatierungsleiste fügt einen Em-Dash im aktuellen Absatz ein.
- **---** erzeugt einen Szenentrenner als eigenen, sofort gesperrten Absatz. Funktioniert nur bei leerem aktuellen Absatz.
- Nach Löschen eines Kapitels wird die aktuelle Romanwortzahl und der Fortschritt neu aus den verbliebenen Kapiteln berechnet. Historische Tagesstatistiken bleiben als Schreibaktivität erhalten.
- Service-Worker-Cache auf Version 1.2 aktualisiert.

## Update über GitHub Pages
1. **Unbedingt zuerst** in der bisherigen App eine JSON-Bibliothekssicherung erstellen und in der Dateien-App aufbewahren.
2. Alle Dateien aus diesem Ordner in das von GitHub Pages veröffentlichte Verzeichnis kopieren (dort muss `index.html` liegen).
3. GitHub Pages Deployment abwarten und die App erneut öffnen. Gegebenenfalls Safari neu laden.
4. Die bestehende Bibliothek bleibt normalerweise erhalten, wenn die **exakt gleiche Adresse** und der gleiche Safari-/Home-Bildschirm-Kontext verwendet werden. Browserdaten niemals ohne Backup löschen.

## Hinweis
Die Wortziel-Anzeige zählt aktuelle Wörter der vorhandenen Kapitel, nicht die historisch geschriebenen Wörter. Tagesstatistiken bleiben bewusst unverändert, wenn ein Kapitel gelöscht wird. Die gespeicherte Revisionsfassung wird beim Zurücksetzen auf Draft nicht automatisch in die gesperrten Absätze übernommen.

Diese Web-App wurde auf JavaScript-Syntax geprüft, aber nicht auf einem echten iPhone getestet.


## Version 1.3
- „Entwurf abschließen“ befindet sich unter **••• → Kapiteloptionen** und nicht mehr in der Formatierungsleiste.
- Die Formatierungsleiste scrollt auf schmalen Displays horizontal, ohne dass Buttons zusammengedrückt werden.
- Lesebereich, Textgröße und Seitenränder wurden für iPhones optimiert.
- Vor dem Update bitte die JSON-Bibliothek sichern. Die App-Daten bleiben bei identischer GitHub-Pages-Adresse normalerweise erhalten.
