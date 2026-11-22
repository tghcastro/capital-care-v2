# Docker Compose Review & Update (Full-Stack WEB + API)
**STATUS**: Delivered

## Context
After adding the WEB (UI) layer, the existing `docker compose structure` still works, but its naming and configuration only reflect the API layer. It needs to be reviewed and updated to accurately represent the full-stack system across both development and production environments.

## Requirements
* **Service Architecture & Naming:** 
  * Rename existing services to reflect the **entire system** (full-stack app) rather than just `WEB` or `API`.
  * Configure **two application services** (use Docker Compose `profiles` to separate `dev` and `prod`):
    1. **DEV Service:** Builds the Docker image locally from source and runs on **port 3000**.
    2. **PRD Service:** Pulls the `latest` pre-built image from the registry and runs on **port 8000**.
* **Database Persistence:**
  * **DEV Environment:** Must start with a clean database on every run (no leftover test data; e.g., avoid persistent named volumes or use `tmpfs`).
  * **PRD Environment:** Must persist database data across container restarts using a named volume so no data loss occurs.
* **Environment Switching:** Ensure it is straightforward to spin up either `DEV` or `PRD` independently (e.g., via `docker compose --profile dev up` or separate override files).
* **README Update:** Update the `README.md` file with clear instructions and examples covering:
  * How to spin up and execute both `DEV` and `PRD` environments.
  * How to access the WEB UI for each environment (`localhost:3000` vs. `localhost:8000`).
  * **API Details:** Include **only one `curl` example** for consuming the API, and reference **Bruno** (e.g., the project's Bruno collection) for detailed API usage and endpoints.
