# Final Summary

## Rekomendacja

Wdrożyć optymalizacje etapami:

1. szybkie i mało ryzykowne: BuildKit cache, usunięcie API `npm ci` z post-deploy, polling health zamiast `sleep`;
2. średnie: rozdzielenie Dockerfile na osobne buildery API/frontend oraz równoległe joby obrazów;
3. większe: `nx affected` dla branch/PR i Nx Cloud albo cache `.nx/cache`.

## Oczekiwany efekt

Realny cel po pierwszych dwóch etapach: zejście z około 20 minut do około 10-13 minut na main deploy po rozgrzaniu cache.

## Konkluzja

Nie rekomenduję usuwania testów z `main`. Szybkość należy osiągnąć przez cache, równoległość i eliminację duplikacji buildów.
