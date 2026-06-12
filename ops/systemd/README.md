# Harmonogramy systemd (host produkcyjny)

Instalacja na hoście z Portainerem (repo wdrożone w `/opt/star-sign`):

```bash
sudo cp ops/systemd/star-sign-*.{service,timer} /etc/systemd/system/
sudo mkdir -p /opt/star-sign
# /opt/star-sign/.env.ops musi zawierać: POSTGRES_* dla backupu,
# FRONTEND_BASE_URL, API_BASE_URL, OPS_ALERT_WEBHOOK_URL dla uptime-watch.
sudo systemctl daemon-reload
sudo systemctl enable --now star-sign-backup.timer star-sign-uptime.timer
```

Weryfikacja:

```bash
systemctl list-timers 'star-sign-*'
journalctl -u star-sign-backup.service -n 50
```

- **Backup**: codziennie 02:30 UTC (`backup-postgres.sh` + `verify-backup.sh`), retencja 14 dni wbudowana w skrypt. RPO = 24 h.
- **Uptime**: co 5 minut (`uptime-watch.sh`); alert na `OPS_ALERT_WEBHOOK_URL` (Slack/Discord webhook) po przekroczeniu progu `UPTIME_FAILURE_THRESHOLD` (domyślnie 2 kolejne błędy).
