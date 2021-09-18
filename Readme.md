![Claim Image](imgs/Claim.png)

# J+S-Marschzeittabellen automatisiert generieren

_Englisch version below_

Ziel dieses Projektes ist es, den Prozess rund um das Erstellen einer J+S-Marschzeittabelle für eine Wanderung oder
Velo-Tour zu automatisieren und zu beschleunigen.

Heute gibt es bereits verschiedenste Online-Tool, die J+S-Leiter*innen und Wanderfreudigen das Planen einer Wanderung
erleichtern. Ich selber verwende meistens die kostenpflichtige Online-Karte von SchweizMobil. SchweizMobil ist Dank den
magnetischen Wegen (d.h. die eingezeichnete Route folgt automatisch dem Wanderweg/der Strasse) und der Zeitberechnung (
gemäss der Formel der Schweizer Wanderwege) bereits eine grosse Hilfe beim Planen. Ebenfalls geeignet ist die offizielle 
App des Bundesamts für Landestopografie swisstopo.

Ist man mit einer grösseren Gruppe unterwegs (so zum Beispiel in einem J+S-Lager), ist eine ausführliche Planung
unumgänglich. Doch genau in diesen Szenarien stossen die existierenden Tools an ihr Grenzen. Dieses Projekt setzt genau
an diesem Punkt an und ermöglicht eine detailliertere Routen-Planung.

## Grenzen existierender Tools

Die Berechnung der Wanderzeit gemäss der Formel der Schweizer Wanderwege (wie sie von SchweizMobil verwendet wird)  mag
für einen durchschnittlichen Wanderer eine geeignete approximation an die tatsächliche Marschzeit sein. Doch wer mit
einer Gruppe unterwegs ist, die wohl möglich noch mit viel Gepäck trägt, möchte die Marschgeschwindigkeit manuell
anpassen (siehe auch J+S-Broschüre Berg).

## Umfang dieses Projektes

In einem ersten Schritt ist es mein Ziel, das Generieren einer Marschzeittabelle (anhand der Excel-Vorlage von
Jugend+Sport) zu automatisieren. Eine aus SchweizMobil exportierte Route (bzw. ein beliebiges GPX-File) dient dabei als
Grundlage.

Weitere Funktionalitäten sind in Planung und können gerne auch per Enhancement-Issue besprochen werden.

**Wichtig:** Die manuelle Planung bleibt ein grundlegender Bestandteil der Vorbereitung auf eine Wanderung. Dieses
Projekt zielt lediglich auf die Beschleunigung mechanische, sich wiederholender Prozesse wie die Erstellung einer
Marschzeittabelle auf der Grundlage einer bestehenden Route. Dabei wird das sorgfältige Planen und Durchdenken einer
Aktivität in keinerlei Hinsicht ersetzt!

## Glossar

Begriff | Erklärung
-------- | -------- |
J+S   | Jugend+Sport: Ist das Sportförder-Programm des Bundes für Kinder und Jugendsport in der Schweiz. Es unterstützt  Sportkurse und Lager in rund 70 Sportarten und Disziplinen. |
Marschzeittabelle | Tabelle zum Abschätzen der Marschzeit einer Wanderung. Enthält oft auch Angaben zu Pausen und ein Höhenprofil. J+S empfehlt für jede Wanderung eine Marschzeittabelle zu erstellen. |
SchweizMobil | Ermöglicht das Planen von Wanderungen und Velo-Touren der digitalen Landeskarte. Die magnetischen Wege beschleunigen den Prozess des Einzeichnens einer Route.

# Generating J+S-Walk-Time-Tables

The aim of this project is to automate and speed up the process of creating a J+S walk-time table for a hike or bike
tour. There are already some tools that provide valuable support for planning. Nevertheless, they are not suitable for
planning a hike with larger groups, such as in a J+S-camp.

In a first step, my goal is to automate the generation of a walk-time table (using the Excel template from Jugend+Sport)
. The walk-table is generated based on an existing route exported from SchweizMobil or from the swisstopo app (resp. based on 
an arbitrary GPX-file). A python script then generates an Excel file and a map of the route for further manually planing by the
J+S-ladder.

**Important:** Manual planning remains a fundamental part of preparing for a hike. This project only aims to speed up
mechanical, repetitive processes like creating a walk-time table based on an existing route. This programm is no
substitute for careful planning.


