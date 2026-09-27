# CourtPulse

CourtPulse is an NBA game-analysis application built with Expo / React Native, with web delivery through Expo Router and GitHub Pages and CourtPulse-controlled backend services currently hosted in Supabase.

This root README is an orientation and navigation document. It is **not** itself an architecture authority. Where it summarizes a governing document, the governing document controls.

## Foundation status

CourtPulse is currently establishing a repository-level engineering foundation after Repository Archaeology 0.1.

The documents introduced by the Foundation 0.1 branch are **PROPOSED** unless a document explicitly says otherwise. They do not become canonical or accepted merely because they exist in the repository. Independent review and explicit acceptance are required before proposed normative rules gain authority.

The historical Archaeology 0.1 report is evidence, not normative architecture.

## Repository map

- `expo/` — primary Expo / React Native client.
- `backend/app/` — checked-in FastAPI backend source whose current production role is not fully established.
- `backend/functions/submit-feedback/` — repository-backed source for the deployed feedback Edge Function.
- `backend/supabase/migrations/` — database migrations currently represented in Git.
- `.github/workflows/pages.yml` — GitHub Pages export/deploy workflow.
- `docs/` — proposed governance, roadmap, and knowledge layer.

## Foundation documents

### Proposed normative documents

- [Architecture Contract V1](docs/architecture/COURTPULSE_ARCHITECTURE_CONTRACT_V1.md)
- [Engineering Reasoning Framework](docs/architecture/COURTPULSE_ENGINEERING_REASONING_FRAMEWORK.md)
- [Roadmap](docs/ROADMAP.md)
- [Non-Goals](docs/NON_GOALS.md)

### Knowledge and evidence

- [Knowledge semantics](docs/knowledge/README.md)
- [Production topology](docs/knowledge/project/production-topology.md)
- [Repository Archaeology 0.1](docs/knowledge/project/COURTPULSE_REPOSITORY_ARCHAEOLOGY_0_1.md)

## Authority model

CourtPulse separates two questions:

1. **What does the evidence establish?**
2. **What behavior has the project authorized?**

Repository code, runtime observations, tests, HARs, upstream responses, and deployment state can establish facts or support interpretations. They do not automatically create architecture requirements.

Conversely, a proposed architecture rule is not true merely because it was written down. It gains authority only through the project's review and acceptance process.

See the proposed Engineering Reasoning Framework for the complete model.
