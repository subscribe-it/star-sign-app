# QA Test Plan

## Testy wykonane lokalnie

- DNS: `getent ahosts api.star-sign.pl`
- Frontend: `curl -I https://star-sign.pl`
- Frontend health: `curl -I https://star-sign.pl/healthz`
- API publiczne: `curl -i https://api.star-sign.pl/api/health/ready`
- API bez walidacji certyfikatu: `curl -k -i https://api.star-sign.pl/api/health/ready`
- Certyfikaty: `openssl s_client -servername api.star-sign.pl -connect api.star-sign.pl:443 -brief`
- GitHub Actions: `gh run view 25422588184`

## Kolejne testy po poprawie Portainera

- `curl -i https://api.star-sign.pl/api/health/ready`
- `curl -i https://api.star-sign.pl/admin`
- `FRONTEND_BASE_URL=https://star-sign.pl API_BASE_URL=https://api.star-sign.pl/api npm run ops:smoke`
- `FRONTEND_BASE_URL=https://star-sign.pl API_BASE_URL=https://api.star-sign.pl/api npm run ops:headers`
- Rerun failed job w GitHub Actions dopiero po publicznym 200 na API health.

## Konkluzja

Automatyczny rerun GitHub Actions ma sens dopiero po naprawie routera API i certyfikatu dla `api.star-sign.pl`.
