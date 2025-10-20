# Codex — Uteklinker Chatbot

**Syfte.** En levande utvecklarmanual: hur projektet funkar, körs, testas och släpps.

## Innehåll
- `master.md` – systemöversikt och beslut (ADR-lätt).
- `runbooks/` – hur man gör X (operativa guider).
- `checklists/` – “definition of done”, preflight, release.
- `lexicon/` – domäntermer, WL/BL, format-normalisering.
- `playbooks/incidents/` – felsökning & incidentflöden.

## Regler
- En ändring i kod som påverkar drift => uppdatera relevant runbook/checklist.
- Håll PR små: kod + doc i samma PR.
- Språk: SE som default, tekniska nyckelord på EN vid behov.
