# Architecture analysis

## Decyzja

Implementujemy modulowy monolit w Strapi pluginie AICO. Kazdy agent jest serwisem pluginu, a wspolny policy evaluator kontroluje akcje.

## Kontrakty tej fali

- Content-type'y: `autonomy-policy`, `generation-job`, `video-asset`, `traffic-snapshot`, `ad-campaign-plan`, `growth-experiment`, `provider-credential-status`.
- Serwisy: `autonomy-policy`, `autopilot`, `generation-jobs`, `traffic-ingestor`, `video-agent`, `ads-agent`, `experiment-agent`, `provider-status`.
- Admin controllers/routes dla statusu i dry-run.

## Ryzyka

- Strapi schema churn wymaga typechecku pluginu i API.
- Dirty worktree zawiera juz zmiany w AICO, wiec trzeba unikac przypadkowego cofania.
- Live provider adaptery wymagaja osobnych sekretow i testow.

## Polish summary

Architektura tej fali daje stabilna podloge pod full autopilot, ale celowo nie wlacza live spend ani live video/social adapterow.
