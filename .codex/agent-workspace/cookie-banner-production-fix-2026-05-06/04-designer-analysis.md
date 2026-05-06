# Designer Analysis

## Diagnoza

Obecny baner ma zbyt techniczny układ. Na desktopie tekst dostaje za mało miejsca, przez co tytuł wygląda jak zepsuta kolumna. Na mobile jest lepiej, ale panel nadal wygląda bardziej jak surowy kontener niż dopracowany element Star Sign.

## Kierunek

- Jedna pionowa kompozycja: nagłówek, opis, akcje.
- Mały symbol gwiazdy jako akcent, nie dekoracyjny chaos.
- Przyciski w czytelnej hierarchii: zgoda jako akcja główna, odrzucenie i ustawienia jako drugorzędne.
- Panel ma być kompaktowy, z lekkim szkłem i cienką ramką.

## Konkluzja

Najważniejsze jest usunięcie desktopowego `flex-row` oraz przeniesienie stylu do SCSS komponentu, żeby layout był stabilny i łatwy do utrzymania.
