// Centralny słownik pomocy (PL) dla panelu AICO — etykieta + krótkie wyjaśnienie
// (tooltip). Jedno źródło prawdy dla copy, by panel był spójny, zrozumiały dla
// nietechnicznego operatora i łatwy w utrzymaniu/tłumaczeniu.

export type HelpEntry = { label: string; hint: string };

export const HELP: Record<string, HelpEntry> = {
  // — Tryb i bezpieczeństwo —
  autonomy_mode: {
    label: 'Tryb autonomii',
    hint: 'Jak samodzielny jest agent: „wyłączony" nic nie robi; „tylko szkice" generuje, ale nie publikuje i nie wydaje pieniędzy; „strzeżony" działa sam przy decyzjach niekrytycznych i drobnych wydatkach w marginesie bezpieczeństwa; „pełny" podejmuje też decyzje krytyczne (większe wydatki) w granicach limitów.',
  },
  global_kill_switch: {
    label: 'Wyłącznik awaryjny',
    hint: 'Natychmiast zatrzymuje całą autonomię i pauzuje aktywne kampanie reklamowe. Użyj, gdy chcesz błyskawicznie wszystko wstrzymać.',
  },
  guarded_max_ads_impact_pct: {
    label: 'Próg „strzeżony" dla reklam (% dziennego budżetu)',
    hint: 'W trybie strzeżonym agent sam aktywuje tylko reklamy o wydatku do tego % dziennego limitu (np. 0,4 = 40%). Większe wydatki wymagają trybu pełnego. Mniejsza wartość = ostrożniej.',
  },
  brand_safety_required: {
    label: 'Wymagaj bezpieczeństwa marki',
    hint: 'Blokuje publikacje/treści, które nie przeszły kontroli bezpieczeństwa marki. Zalecane: włączone.',
  },
  legal_disclaimer_required: {
    label: 'Wymagaj zastrzeżenia prawnego',
    hint: 'Wymaga odpowiedniego zastrzeżenia (np. „treść rozrywkowa") tam, gdzie to potrzebne. Zalecane: włączone.',
  },
  no_sensitive_targeting: {
    label: 'Zakaz wrażliwego targetowania reklam',
    hint: 'Nie pozwala kierować reklam wg wrażliwych cech (zdrowie, religia itp.). Zalecane: włączone.',
  },

  // — Limity dzienne (capy ilościowe) —
  daily_llm_request_limit: {
    label: 'Dzienny limit zapytań do AI (tekst)',
    hint: 'Maksymalna liczba generacji tekstu na dobę. Twardy limit — po jego osiągnięciu agent wstrzymuje generację do następnego dnia.',
  },
  daily_media_job_limit: {
    label: 'Dzienny limit generacji obrazów',
    hint: 'Maksymalna liczba zadań generowania grafik na dobę.',
  },
  daily_video_job_limit: {
    label: 'Dzienny limit generacji wideo',
    hint: 'Maksymalna liczba krótkich filmów (Rolki/Shorts/TikTok) generowanych na dobę. Wideo jest droższe — trzymaj nisko.',
  },
  max_auto_publish_per_day: {
    label: 'Dzienny limit auto-publikacji treści',
    hint: 'Ile artykułów/wpisów agent może opublikować automatycznie w ciągu doby.',
  },
  max_social_posts_per_day: {
    label: 'Dzienny limit postów w social media',
    hint: 'Ile postów (łącznie) agent może opublikować w mediach społecznościowych na dobę.',
  },
  max_ads_mutations_per_day: {
    label: 'Dzienny limit zmian w reklamach',
    hint: 'Ile operacji na kampaniach (aktywacja/pauza/zmiana) agent może wykonać na dobę.',
  },

  // — Budżet reklam —
  daily_ads_budget_pln: {
    label: 'Dzienny budżet reklam — łącznie (PLN)',
    hint: 'Górny limit łącznych wydatków na reklamy w ciągu doby (wszystkie platformy razem). Egzekwowany atomowo — agent nigdy go nie przekroczy.',
  },
  daily_meta_ads_budget_pln: {
    label: 'Dzienny budżet Meta Ads (PLN)',
    hint: 'Limit wydatków na reklamy Meta (Facebook/Instagram) na dobę. Musi mieścić się w budżecie łącznym.',
  },
  daily_google_ads_budget_pln: {
    label: 'Dzienny budżet Google Ads (PLN)',
    hint: 'Limit wydatków na reklamy Google na dobę. Musi mieścić się w budżecie łącznym.',
  },

  // — Stop-loss (ochrona wydatków) —
  ads_stop_loss_on_tick: {
    label: 'Stop-loss reklam na bieżąco',
    hint: 'Co cykl agenta sprawdza realne wydatki i pauzuje kampanie, które przekroczyły próg. Pauza tylko zmniejsza wydatek — jest zawsze bezpieczna. Zalecane: włączone.',
  },
  stop_loss_pause_at_spend_pct: {
    label: 'Pauzuj kampanię przy zużyciu budżetu (%)',
    hint: 'Pauzuje kampanię, gdy jej wydatek osiągnie ten % dziennego budżetu (np. 0,9 = 90%). Margines przed pełnym wyczerpaniem. 1,0 = pauza dopiero przy 100%.',
  },

  // — Decyzje na bazie danych —
  auto_apply_experiments: {
    label: 'Automatycznie wdrażaj zwycięzców testów A/B',
    hint: 'Gdy test A/B osiągnie istotność statystyczną, agent sam wybiera zwycięski wariant. Bezpieczne i odwracalne (możesz nadpisać ręcznie).',
  },
  aico_strategy_autopilot_enabled: {
    label: 'Autopilot strategii treści',
    hint: 'Agent sam uzupełnia kolejkę tematów i plan treści na bazie danych o ruchu, gdy zapas spada poniżej progu. Decyzja niekrytyczna.',
  },
  aico_auto_publish_enabled: {
    label: 'Auto-publikacja treści',
    hint: 'Pozwala agentowi publikować zaplanowane treści automatycznie (w granicach limitów i kontroli jakości/SEO).',
  },

  // — Kanały —
  allowed_social_channels: {
    label: 'Dozwolone kanały social',
    hint: 'Na których platformach agent może publikować (Facebook, Instagram, TikTok, YouTube Shorts, X).',
  },
  allowed_ads_platforms: {
    label: 'Dozwolone platformy reklam',
    hint: 'Na których platformach reklamowych agent może działać (Meta, Google).',
  },

  // — Wideo krótkiego formatu (astrologia) —
  video_subject: {
    label: 'Temat wideo',
    hint: 'Czego dotyczy film: znak zodiaku, karta tarota, horoskop lub temat własny. Na tej podstawie agent buduje scenariusz, napisy i opisy z hashtagami.',
  },
  video_duration: {
    label: 'Długość wideo (s)',
    hint: 'Długość krótkiego filmu pionowego (9:16). Dozwolone 20–45 s — optymalne pod Rolki/Shorts/TikTok.',
  },
  video_publish_platforms: {
    label: 'Publikuj wideo na',
    hint: 'Platformy docelowe filmu. TikTok zawsze trafia jako wersja robocza (draft) do ręcznego zatwierdzenia — wymóg bezpieczeństwa.',
  },
};

export const help = (key: string): HelpEntry => HELP[key] ?? { label: key, hint: '' };
