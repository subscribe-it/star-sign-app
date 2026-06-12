## Decision: JWT, error tracking, git flow, zakres autonomii

Date: 2026-06-12
Agents involved: lead + właściciel

### Decision
1. JWT pozostaje w localStorage (zaakceptowane ryzyko na soft launch; CSP wdrożone jako mitygacja).
2. Error tracking: Bugsink (self-hosted na VPS), nie Sentry SaaS.
3. Git flow: zawsze branch od main → merge do main (commity przeniesione na feat/production-ready-hardening-2026-06-12).
4. Reklamy: TAK — implementujemy live adaptery Meta/Google Ads.
5. Pełna autonomia treści: domykamy pętlę analityka → adaptacja contentu (performance feedback → strategia, ewaluacja eksperymentów, pamięć redakcyjna).

### Polish summary
Właściciel zaakceptował localStorage dla JWT, wybrał Bugsink, narzucił flow branch→merge, zlecił live ads i pełne domknięcie pętli autonomicznej optymalizacji treści.
