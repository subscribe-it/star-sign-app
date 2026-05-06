# Refinement

## Problem

Na stronie szczegółów artykułu elementy `mystic-orb` były obecne w DOM, ale praktycznie niewidoczne na jasnym tle hero. Problem wynikał z bardzo niskiej przezroczystości `bg-mystic-*/10`, dużego rozmycia i warstwy o tym samym `z-index` co delikatny overlay.

## Zakres

- Poprawić widoczność dekoracyjnych orbów tylko na stronie artykułu.
- Nie zmieniać globalnej klasy `.mystic-orb`, bo jest używana w wielu widokach.
- Zachować elementy jako dekoracyjne, niewidoczne dla czytników ekranu.

## Kryteria akceptacji

- Użytkownik widzi dekoracyjne orb’y po wejściu w artykuł.
- Hero artykułu nie powoduje poziomego overflow na mobile.
- Orby pozostają pod treścią i nie blokują interakcji.
- Test jednostkowy potwierdza obecność elementów i ich atrybuty dostępnościowe.

## Konkluzja

Naprawa powinna być lokalna dla `BlogDetail`, ponieważ globalny utility jest współdzielony i jego zmiana mogłaby zepsuć inne ekrany.
