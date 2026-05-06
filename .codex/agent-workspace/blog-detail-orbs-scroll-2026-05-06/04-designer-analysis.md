# Designer Analysis

## Problem wizualny

Orby są widoczne, ale przez blur wyglądają jak warstwa mgły. W widoku artykułu lepiej sprawdzi się ostrzejszy, dekoracyjny dysk z delikatnymi pierścieniami, dalej subtelny, ale nie zamazany.

## Rekomendacja UX/UI

- Usunąć blur z lokalnego wariantu `article-hero__orb`.
- Dodać delikatne obramowanie i pseudo-elementy pierścieni, żeby forma była czytelna.
- Zachować `aria-hidden="true"`, bo elementy są dekoracyjne.
- Domyślny scroll kierować do `article-content`, bo użytkownik po kliknięciu artykułu najczęściej chce zacząć czytać, nie oglądać ponownie całą górę strony.

## Konkluzja

Poprawka ma być bardziej redakcyjna i czytelna, bez dodawania kolejnych ciężkich dekoracji.
