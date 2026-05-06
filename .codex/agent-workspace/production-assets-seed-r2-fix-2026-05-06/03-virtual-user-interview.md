# Virtual User Interview

## Symulowany użytkownik

Użytkownik wchodzi na stronę tarota i losuje kartę dnia.

## Oczekiwania

- Karta dnia powinna mieć obraz.
- Widok listy lub szczegółu karty tarota nie powinien wyglądać jak puste miejsce.
- Obraz powinien ładować się z publicznego URL, bez błędu CORS i bez lokalnej ścieżki kontenera.

## Frustracje

Brak obrazu przy karcie tarota jest odbierany jak błąd produkcji, nawet jeśli tekst działa.

## Konkluzja

Dla użytkownika nie ma znaczenia, czy plik jest w buckecie. Liczy się to, czy API zwraca URL obrazu i frontend może go wyrenderować.
