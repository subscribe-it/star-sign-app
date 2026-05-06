# Test Plan

## Testy jednostkowe API

- Seed tworzy domyślny blog placeholder w Media Library i AICO `media-asset`.
- Seed podpina placeholder do artykułu bez obrazu.
- Dedykowany asset blogowy może zastąpić placeholder.
- Istniejący realny obraz R2 nie jest nadpisywany placeholderem.

## Testy frontend

- Lista bloga renderuje obraz miniatury, gdy artykuł ma `image`.
- Lista bloga renderuje fallback wizualny, gdy artykuł nie ma `image`.

## Walidacja

- `rtk npm exec -- nx run api:test --outputStyle=static`
- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`
- `rtk npm exec -- nx run frontend:typecheck --outputStyle=static`
- `rtk npm exec -- nx run api:build --outputStyle=static`
- `rtk npm exec -- nx run frontend:build --outputStyle=static`
- `rtk git diff --check`

## Polska konkluzja

Dowodem gotowości będzie przejście testów i lokalny seed, który uzupełnia obrazy artykułów bez generowania przyszłych wpisów AICO.
