# Architecture Analysis

## Aktualna architektura

- Frontend czyta Strapi Content API z `populate=image`.
- API Strapi używa providera `aws-s3` dla R2, gdy `R2_UPLOAD_ENABLED=true`.
- Produkcja nie montuje trwałego wolumenu uploadów.
- Lokalne seed assety są częścią obrazu API i mogą zostać użyte jako źródło inicjalnego uploadu.

## Problem architektoniczny

Plik w R2 nie jest równoznaczny z rekordem Media Library. Strapi potrzebuje rekordu `plugin::upload.file` oraz relacji morph do content type. Bez tego Content API zwróci `image: null`.

## Rekomendacja

Dodać moduł `seed-media`, który:

- wykrywa lokalne pliki `daily_*.webp`,
- używa oficjalnego upload service Strapi, żeby provider sam zapisał rekord i URL,
- podłącza rekord do `tarot-card.image`,
- tworzy stabilny wpis AICO media asset,
- działa idempotentnie po nazwie pliku i asset key.

## Alternatywy

- Ręczne insertowanie `upload_file`: odrzucone, bo omija provider i może rozjechać URL, hash oraz metadane.
- Ręczne klikanie w adminie: odrzucone, bo deploy ma być powtarzalny.
- Lokalny wolumen uploadów: odrzucone, bo produkcja ma używać R2.

## Konkluzja

Najbezpieczniejszy wariant to bootstrap przez Strapi upload service. To zachowuje zgodność z R2 i nie wymaga stałego local storage.
