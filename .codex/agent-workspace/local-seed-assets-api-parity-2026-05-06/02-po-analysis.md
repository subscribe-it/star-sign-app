# PO Analysis

## Cel biznesowy

Lokalne i produkcyjne seedy mają dawać od razu użyteczny, wizualny content startowy. Użytkownik nie powinien widzieć pustych kart, znaków lub artykułów tylko dlatego, że workflow AICO jest wyłączony.

## Zakres MVP

- Tarot: lokalne pliki `daily_*.webp` są uploadowane przez aktywny provider i przypinane do kart.
- Zodiak: jeśli istnieją zmapowane AICO assets dla profili znaków, seed przypina je do `zodiac-sign.image`.
- Artykuły: jeśli istnieją zmapowane AICO assets typu `blog_article`, seed przypina je do obecnych seedowanych artykułów.
- AICO workflows pozostają wyłączalne przez `AICO_ENABLE_WORKFLOWS=false`.

## Poza zakresem

- Generowanie nowych obrazów przez AI.
- Live provider calls.
- Tworzenie nowych przyszłych artykułów przez workflow.

## Konkluzja

Najważniejsza wartość to parytet lokalnie i produkcyjnie: obecny content startowy ma korzystać z istniejącej biblioteki mediów, bez uruchamiania autonomicznego generowania.

## Doprecyzowanie wymagań dla profilu znaku

- Strona `/znaki/baran` ma pokazywać zdjęcie nie tylko w hero, ale także jako wizualny akcent w elementach profilu.
- Pliki już dodane do Media Library mają zostać wykorzystane bez ręcznej pracy w panelu, jeśli ich nazwa pozwala rozpoznać znak.
- Nie uruchamiamy workflow AICO ani generowania przyszłych wpisów.

## Akceptacja

- Seed lokalny tworzy brakujące mapowanie AICO dla istniejącego uploadu znaku i podpina je do `zodiac-sign.image`.
- `/znaki/baran` renderuje więcej niż jeden element obrazkowy, kiedy znak ma `image`.
