# Analiza PO

## Problem

Użytkownik na stronie bloga widzi wpisy bez miniaturek. Obniża to wiarygodność strony i sprawia wrażenie niedokończonej produkcji.

## Wartość biznesowa

- Blog ma wyglądać kompletnie od pierwszego deployu.
- Seedy produkcyjne i lokalne mają dawać spójny efekt wizualny.
- Brak dedykowanego zdjęcia nie może blokować publikacji artykułu.

## Zakres MVP

- Dodać jeden domyślny asset miniatury blogowej.
- Podpinać go automatycznie do seeded artykułów bez obrazu.
- Zachować możliwość późniejszej wymiany placeholdera na realny asset blogowy.

## Poza zakresem

- Generowanie indywidualnych grafik AI dla każdego wpisu.
- Migracja istniejącej produkcyjnej bazy bez uruchomienia seedów/deploy flow.
- Ręczne edytowanie treści produkcyjnych przez panel Strapi.

## Kryteria akceptacji

- Artykuł seedowany bez dedykowanego obrazu dostaje `article.image`.
- Domyślny asset jest rekordem Media Library i AICO `media-asset` typu `blog_article`.
- Dedykowany asset blogowy ma pierwszeństwo przed placeholderem.
- Frontend nie pokazuje pustej przestrzeni, nawet gdy API zwróci artykuł bez obrazu.

## Polska konkluzja

Najmniejsza wartościowa zmiana to domyślna miniatura blogowa w seedach plus bezpieczny fallback UI. To rozwiązuje obecny problem bez rozbudowywania systemu generowania obrazów.
