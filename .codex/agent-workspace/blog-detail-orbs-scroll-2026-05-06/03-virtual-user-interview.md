# Virtual User Interview

## Symulacja użytkownika

Użytkownik wchodzi w artykuł po kliknięciu z listy lub sekcji powiązanych treści. Oczekuje, że od razu zobaczy czytelny początek tekstu, a nie losową pozycję scrolla pozostawioną z poprzedniej strony.

## Obawy

- Rozmyte tło wygląda jak błąd stylizacji, a nie zamierzona dekoracja.
- Kliknięcie linku z `#fragment` powinno przenieść do wskazanej sekcji.
- Jeśli fragment jest błędny, użytkownik powinien trafić przynajmniej do początku artykułu.

## Konkluzja

Najbardziej naturalne zachowanie to: fragment ma pierwszeństwo, a brak lub błąd fragmentu kieruje do początku treści.
