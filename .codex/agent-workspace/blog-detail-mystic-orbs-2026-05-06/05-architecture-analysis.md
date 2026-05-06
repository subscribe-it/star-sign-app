# Analiza Architektury

## Obszar techniczny

- Angular standalone component `BlogDetail`.
- Style komponentowe `blog-detail.scss`.
- Globalna klasa `.mystic-orb` jest używana na wielu stronach, więc nie zmieniamy jej globalnie.

## Decyzja

Dodajemy klasy komponentowe dla orbów w hero artykułu i test DOM, który sprawdza ich obecność oraz role dekoracyjne.

## Polska konkluzja

Zmiana powinna być lokalna dla blog-detail i testowalna bez wpływu na inne flow.
