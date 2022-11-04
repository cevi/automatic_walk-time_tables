![Claim Image](docs/imgs/Claim.png)

# J+S-Marschzeittabellen automatisiert generieren

_English version below (including local setup and dev info)_

Ziel dieses Projektes ist es, den Prozess rund um das Erstellen einer J+S-Marschzeittabelle für eine Wanderung oder
Velo-Tour zu automatisieren und zu beschleunigen.

Heute gibt es bereits verschiedenste Online-Tool, die J+S-Leiter*innen und Wanderfreudigen das Planen einer Wanderung
erleichtern:

- Die kostenpflichtige Online-Karte von SchweizMobil. SchweizMobil ist Dank der magnetischen Wege (d.h. die
  eingezeichnete Route folgt automatisch dem Wanderweg/der Strasse) und der Zeitberechnung (gemäss der Formel der
  Schweizer Wanderwege) bereits eine grosse Hilfe beim Planen.

- Für mobile Endgeräte eignet sich ebenfalls die offizielle App des Bundesamts für Landestopografie swisstopo. Analog
  zur App SchweizMobil bietet auch die swisstopo App eine Funktion zur Routenplanung mit magnetischen Wegen.

Ist man mit einer grösseren Gruppe unterwegs (so zum Beispiel in einem J+S-Lager), ist eine ausführliche Planung
unumgänglich. Doch genau in diesen Szenarien stossen die existierenden Tools an ihr Grenzen. Dieses Projekt setzt genau
an diesem Punkt an und ermöglicht eine detailliertere Routen-Planung.

## Grenzen existierender Tools

Die Berechnung der Wanderzeit gemäss der Formel der Schweizer Wanderwege (wie sie von SchweizMobil verwendet wird)  mag
für einen durchschnittlichen Wanderer eine geeignete Approximation an die tatsächliche Marschzeit sein. Doch wer mit
einer Gruppe unterwegs ist, die wohl möglich noch viel Gepäck trägt, möchte die Marschgeschwindigkeit manuell
anpassen (siehe auch J+S-Broschüre Berg).

## Umfang dieses Projektes - Roadmap

- [x] In einem ersten Schritt ist es unser Ziel, das Generieren einer Marschzeittabelle (anhand der Excel-Vorlage von
  Jugend+Sport) zu automatisieren. Eine aus SchweizMobil oder der Swisstopo App exportierte Route (bzw. ein beliebiges
  GPX-File) dient dabei als Grundlage.
- [x] In einem nächsten Schritt soll es möglich sein, die gewählten Punkte auf der einer interaktiven Karte zu
  visualisieren und bei Bedarf zu verschieben. Kleinere Anpassungen der Route sollten direkt in der Karte möglich sein.
- [ ] Das Zeichnen neuer Routen soll direkt in unserem Webinterface möglich sein (damit entfällt der GPX-Export). Herzu
  werden magnetische Wege verwendet. D.h. die Route soll dabei automatisch an den nächsten Weg angepasst werden.

Weitere Funktionalitäten können gerne auch per Enhancement-Issue gewünscht werden.

**Wichtig:** Die manuelle Planung bleibt ein grundlegender Bestandteil der Vorbereitung auf eine Wanderung. Dieses
Projekt zielt lediglich auf die Beschleunigung mechanischer, sich wiederholender Prozesse wie die Erstellung einer
Marschzeittabelle auf der Grundlage einer bestehenden Route. Dabei wird das sorgfältige Planen und Durchdenken einer
Aktivität in keinerlei Hinsicht ersetzt!

## Glossar

| Begriff           | Erklärung                                                                                                                                                                           |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| J+S               | Jugend+Sport: Ist das Sportförder-Programm des Bundes für Kinder und Jugendsport in der Schweiz. Es unterstützt  Sportkurse und Lager in rund 70 Sportarten und Disziplinen.        |
| Marschzeittabelle | Tabelle zum Abschätzen der Marschzeit einer Wanderung. Enthält oft auch Angaben zu Pausen und ein Höhenprofil. J+S empfehlt für jede Wanderung eine Marschzeittabelle zu erstellen. |
| SchweizMobil      | Ermöglicht das Planen von Wanderungen und Velo-Touren der digitalen Landeskarte. Die magnetischen Wege beschleunigen den Prozess des Einzeichnens einer Route.                      |

# Generating J+S-Walk-Time-Tables

The aim of this project is to automate and speed up the process of creating a J+S walk-time table for a hike or bike
tour. There are already some tools that provide valuable support for planning. Nevertheless, they are not suitable for
planning a hike with larger groups, such as in a J+S-camp.

The goal of this project is to provide a tool that is suitable for planning hikes with larger groups. This is realised
with an interactive map that allows to plan a route and to adjust the walk-time table accordingly. All based on an easy
to user web interface.

In the end the user should be able to create a walk-time table for a hike with a few clicks and export it as a PDF as
well as an Excel file containing the walk-time table based on the J+S template.

**Important:** Manual planning remains a fundamental part of preparing for a hike. This project only aims to speed up
mechanical, repetitive processes like creating a walk-time table based on an existing route. This programm is no
substitute for careful planning.

## Run it Locally and Start Developing

You can run the application locally with just one command. Now you can open `localhost` in your web browser. For more
information take a look at our documentation: [Getting Started](https://docs.map.cevi.tools/).

This will serve the documentation of this project, you can access it by opening `localhost:4000` in your web browser.

```bash
$ docker-compose up [--build]
```

*Note:* `--build` is optional and forces docker to rebuild the containers.