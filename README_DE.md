# Forward — iOS-Safari-App / PWA

Diese **mobile Web-App** bietet den Forward-Workflow ohne Xcode und ohne App-Store-Account. Sie ist für Safari auf dem iPhone optimiert und lässt sich als App-Symbol zum Home-Bildschirm hinzufügen, sobald sie über eine HTTPS-Adresse bereitsteht.

## Auf dem iPhone benutzen

1. Den **gesamten Inhalt dieses Ordners** bei einem statischen Webhost unter HTTPS bereitstellen, etwa über GitHub Pages. Wichtig: `index.html`, `app.js`, `sw.js`, `manifest.json`, beide WAV-Dateien und beide PNG-Icons müssen **im gleichen Webverzeichnis** erreichbar sein.
2. Die HTTPS-Adresse in **Safari auf dem iPhone** öffnen.
3. Im Teilen-Menü **Zum Home-Bildschirm** (bzw. „Zum Home-Bildschirm hinzufügen“) auswählen und den Eintrag **Forward** öffnen.
4. Die App beim ersten Mal online laden, damit der Service Worker die Dateien für den Offlinebetrieb zwischenspeichern kann. Danach arbeitet sie auch ohne Internet.

**Nicht einfach `index.html` über die Dateien-App öffnen:** In dieser Betriebsart sind die notwendigen Browser-Speicher- und Offlinefunktionen nicht zuverlässig verfügbar. Für die PWA ist eine reguläre HTTPS-Adresse vorgesehen.

## Funktionen

- Absatzsperre **Variante B**. Alte Absätze sind nie in einem editierbaren Textelement, nur der aktuelle Absatz ist änderbar. `Return` verriegelt den bisherigen Text.
- Zwei kurze Sounds (`Plop`, `Thud`), abschaltbar. **Kein Haptik-Feedback** in dieser Safari-Version; das ist eine Funktion der nativen iOS-App.
- Kapitel anlegen, umbenennen, löschen; Revisionsmarker hinzufügen und entfernen.
- Originalfassung beim Abschließen sichern und getrennte Fassung überarbeiten.
- Autosave in **IndexedDB** des Browsers (ohne Server, ohne Konto) und Offline-Verfügbarkeit via Service Worker.
- Wortzahlen, Tages-/Wochenstatistik, Schreibserie, Fokusmodus.
- TXT, Markdown, DOCX exportieren. Die DOCX-Datei ist ein gültiges Word-/OpenXML-Dokument.
- **JSON-Backup** der ganzen Bibliothek in „Optionen“ erstellen und über „Backup einlesen“ wiederherstellen.

## Datensicherheit

**Wichtig:** Die Kapitel werden **lokal in dem Safari-/Web-App-Speicher des jeweiligen Geräts** gespeichert, nicht beim Webhost. Löschen von Safari-Websitedaten, eine Neuinstallation, bestimmte Browser- oder iOS-Speicherbereinigungen oder ein Gerätewechsel können diese lokalen Daten entfernen. Lege deshalb regelmäßig mit **Optionen → Bibliothek sichern** eine JSON-Sicherung in der iOS-Dateien-App ab. Der Browser ist keine einzige verlässliche Langzeitkopie für einen Roman.

Die App besitzt keine Benutzeranmeldung und sendet Kapiteltext nicht an einen Server. Die Webseiten-Dateien selbst werden beim ersten Laden vom gewählten Webhost abgerufen.

## Tests

Die mobile Oberfläche wurde in einem Chromium-Mobilviewport durchgeklickt: Kapitel erstellen, Absatzabschlüsse, Marker, Originalarchiv, Revision, DOCX-Export und Statistik. Die exportierte DOCX wurde danach mit einem separaten Word-Dokumentleser geöffnet und auf den Inhalt geprüft. Ein echter iOS-Safari-Test war in dieser Umgebung nicht möglich; besonders Tonwiedergabe und Homescreen-Installation sollten am Gerät geprüft werden.

**Hinweis:** Diese Web-App und das separate SwiftUI-Xcode-Projekt verwenden unterschiedliche Speicherschemata. Es gibt keine automatische Synchronisierung zwischen ihnen.
