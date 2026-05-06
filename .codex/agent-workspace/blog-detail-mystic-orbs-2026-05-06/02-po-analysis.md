# Analiza PO

## Problem

Po wejściu w artykuł użytkownik nie widzi elementów `mystic-orb`, przez co widok detail traci część atmosfery wizualnej Star Sign.

## Kryteria akceptacji

- Orby są widoczne na desktopowym widoku artykułu.
- Orby nie zasłaniają tytułu, breadcrumbów, metadanych ani obrazu artykułu.
- Zmiana nie wpływa na inne strony używające `.mystic-orb`.

## Polska konkluzja

Poprawka powinna być zawężona do blog detail, bo globalne wzmocnienie `.mystic-orb` mogłoby zmienić wiele ekranów naraz.
