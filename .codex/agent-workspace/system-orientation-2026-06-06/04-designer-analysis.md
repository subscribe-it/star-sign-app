# Designer Agent

## Konwencja UI

README i pamiec projektu opisuja kierunek `Lumina Silk`: astrologiczny, lekki, magiczny, ale oparty o realne ekrany Angular i SCSS, nie o landing-page'owa dekoracje.

## Struktura frontendu

- Core shell: navbar, footer, cookie banner, loading bar, maintenance mode, toast notifications.
- Ekrany funkcji: home, zodiac profile, horoscope, horoscope reader/type, tarot, tarot result, blog list/detail, numerology, premium, natal chart, shop/product, auth, account, legal, newsletter action, contact/about/not found.
- Wspolne komponenty: breadcrumbs, premium preview block, skeleton, turnstile.

## UX states do pilnowania

- Loading, empty i error states dla contentu Strapi.
- Maintenance mode z reduced-motion support.
- Cookie banner layout po regresjach produkcyjnych.
- Shop hidden state przy wylaczonych flagach.
- Mobile/responsive smoke, bo jest osobny spec Playwright.

## Polish summary

Design powinien rozwijac istniejacy system komponentow i stanow, a nie przebudowywac calosci. Najwieksze UX ryzyka sa w rozjechaniu feature flag, premium/checkout i stanow pustych.
