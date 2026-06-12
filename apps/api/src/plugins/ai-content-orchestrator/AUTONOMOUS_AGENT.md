# AI Content Orchestrator (AICO) - Autonomous Agent Documentation

## Purpose & Vision

AICO is a fully autonomous media and content orchestration agent designed to manage the end-to-end lifecycle of digital assets for the Star Sign platform. Its mission is to ensure that every piece of content (Horoscopes, Daily Tarot Cards, Articles) is not only generated with high quality but also visually enriched and correctly mapped without human intervention.

## Core Capabilities

1.  **Autonomous Content Lifecycle**: Automatically triggers generation, validation, and publishing based on cron schedules.
2.  **Smart Media Orchestration**:
    - **Library Search**: First, it attempts to map the best existing media from the Strapi Library using semantic matching.
    - **Autonomous Design**: If no suitable media is found, the agent uses an LLM to design a specific visual prompt in English.
    - **On-Demand Generation**: Generates high-fidelity images using models like Flux or DALL-E (via Replicate/OpenAI) based on the per-workflow configuration.
    - **Auto-Persistence**: Automatically uploads generated assets to the cloud (R2) and registers them in the Strapi Media Library for future reuse.
3.  **Self-Healing & Reconciliation**: Detects missing assets in existing content and automatically repairs them.
4.  **Real-Time Monitoring**: Provides a granular "Autonomous Intelligence" dashboard showing every decision made by the agent (Design -> Generate -> Upload -> Map).

## Business Logic

- **Prompting**: All image generation prompts are designed in **English** for maximum compatibility and precision.
- **Security**: API tokens for LLM and Image generation are stored encrypted at rest and decrypted only during runtime for secure execution.
- **Scalability**: Supports multiple workflows with different models and settings, allowing for tailored aesthetics across different content types.

## Technical Architecture

- **Orchestrator Service**: The "brain" that manages the state machine of content generation.
- **Media Selector**: The "curator" that decides whether to pick existing media or generate new ones.
- **Image Designer**: The "creative" that translates content context into visual prompts.
- **Media Generator**: The "producer" that handles API calls to generation engines and file uploads.

## Pętla autonomicznej optymalizacji (PL)

AICO zamyka pętlę "publikuj → mierz → ucz się → planuj lepiej" bez udziału człowieka:

1. **Zbieranie danych**: `performance-feedback` agreguje dzienne snapshoty skuteczności treści (views, premium, CTA, checkout, social), a `traffic-ingestor` importuje ruch z GA4 i first-party do `traffic-snapshot`.
2. **Analiza (insights-engine)**: raz dziennie (throttling przez store `insights-state`, wpięty w `orchestrator.tick`) silnik analizuje 30 dni snapshotów performance/ruchu, 14 dni eventów analitycznych i 7 dni run-logów. Wylicza: top/bottom treści (score na dzień), tematy rosnące (wzrost odsłon), najlepsze godziny i dni publikacji oraz skuteczność kanałów (organiczny vs social).
3. **Pamięć redakcyjna**: wyniki trafiają do `editorial-memory` jako wpisy `insight:performance` (statystyki), `insight:editorial-recommendation` (krótka rekomendacja LLM po polsku, za zgodą autonomy-policy `llm.generate`) oraz `insight:system-health` (powtarzające się błędy pipeline'u — ten sam krok ≥3 razy w 7 dni → audit event z severity warn).
4. **Adaptacja strategii**: `strategy-planner` czyta świeże insighty (`resolveInsightBias`) i: preferuje tematy rosnące (boost priorytetu), pomija kontynuacje najsłabszych treści i planuje publikacje w najlepszych godzinach. Bez insightów działa deterministyczny fallback.
5. **Eksperymenty**: `experiment-agent.evaluate()` ocenia aktywne `growth-experiment` testem z dla dwóch proporcji (95% ufności) na danych ze snapshotów; zwycięzca jest stosowany automatycznie tylko przy `AICO_STRATEGY_AUTO_APPROVE_PLAN=true`, w innym wypadku decyzja czeka na admina (zapis w `decision`, `editorial-memory` i audit trail).

Sterowanie: `AICO_INSIGHTS_ENABLED` (puste = włączone, gdy `AICO_ENABLE_WORKFLOWS=true`; `false` wyłącza pętlę). Globalny kill switch i autonomy-policy blokują cały tick jak dotychczas.

## How to Interact with AICO

Agents should use the `orchestrator` service to trigger runs or reconciliation.
The monitoring dashboard provides a `run_id` which contains a `steps` log for debugging autonomous decisions.
