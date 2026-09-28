# CourtPulse

CourtPulse is an NBA game-analysis application built with Expo / React Native, with web delivery through Expo Router and GitHub Pages and CourtPulse-controlled backend services currently hosted in Supabase.

This root README is an orientation and navigation document. It is **not** itself an architecture authority. Where it summarizes a governing document, the governing document controls.

## Foundation status

CourtPulse Foundation 0.1 is **ACCEPTED**.

Acceptance date: `2026-09-28`  
Accepted proposal: `70724d8cca219f860ade9d8de9c37eed6626db5e`  
Authority: project-owner acceptance

This acceptance establishes the repository-level engineering discipline and sequencing boundaries described by the accepted Foundation documents. It does **not** create a production implementation admission for Web 0.3B or any other future phase.

The historical Archaeology 0.1 report remains evidence, not normative architecture.

## Repository map

- `expo/` — primary Expo / React Native client.
- `backend/app/` — checked-in FastAPI backend source whose current production role is not fully established.
- `backend/functions/submit-feedback/` — repository-backed source for the deployed feedback Edge Function.
- `backend/supabase/migrations/` — database migrations currently represented in Git.
- `.github/workflows/pages.yml` — GitHub Pages export/deploy workflow.
- `docs/` — accepted governance/methodology, roadmap, and knowledge layer.

## Foundation documents

### Accepted normative documents

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

See the accepted Engineering Reasoning Framework for the complete model.
