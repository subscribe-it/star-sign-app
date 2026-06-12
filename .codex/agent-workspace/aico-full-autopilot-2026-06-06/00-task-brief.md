# AICO Full Autopilot Growth System

Data: 2026-06-06
Zakres: implementacja fundamentu pelnego autopilota AICO na bazie istniejacego pluginu `ai-content-orchestrator`.
Klasyfikacja: duze zadanie architektoniczno-implementacyjne.

## Cel

Rozwinac AICO z obecnego content/social growth V1 do systemowego fundamentu full stack growth: polityka autonomii, kolejka generation jobs, modele traffic/video/ads/experiments/provider status, dry-run tick i admin API.

## Granice tej fali

- Implementujemy bezpieczny fundament i dry-run, bez live wydawania budzetu reklamowego.
- Nie zapisujemy sekretow i nie czytamy `.env.production.generated`.
- Nie uruchamiamy provider calls do Meta/Google/TikTok/YouTube/OpenAI/Replicate.
- Existing dirty worktree traktujemy jako prace uzytkownika lub poprzedniej fali, bez resetow.

## Polish summary

Ta fala ma dac realne struktury, API i policy evaluator pod autopilota. Live provider adaptery moga zostac podpiete pozniej pod te same kontrakty.
