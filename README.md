# SIH-26156

A Universal Log Pre-processing Framework prototype built with Node.js and Express. It preserves raw security logs, resolves and parses known formats, normalizes them to an OCSF-aligned schema with field-level lineage, and quarantines unknown formats for controlled parser onboarding.

---

## 🚀 Getting Started & Basic Setup

### Prerequisites

Make sure you have the following installed on your local environment:
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)
- Elasticsearch 8.x at `http://localhost:9200`

### Installation & Running Locally

1. **Install Dependencies**
   ```bash
   npm ci
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   The ULPF Prototype server will start running at `http://localhost:3000`.

3. **Create Elasticsearch Indices**
   ```bash
   npm run setup:indices
   ```

## API Endpoints

- `POST /api/logs` — submit `{ "raw": "..." }` for complete processing.
- `GET /api/health` — check Elasticsearch connectivity and loaded parser count.
- `GET /api/parsers` — list active versioned parsers.
- `POST /api/parsers` — upload a parser using `{ "yaml_content": "..." }`.
- `GET /api/events/:event_id/lineage` — retrieve field lineage and provenance.
- `GET /api/quarantine` — list quarantined events.
- `GET /api/quarantine/clusters` — cluster quarantined events by structure.
- `/api/intelligence/*` — generate, test, and approve candidate parsers.

---

## 🤝 Contribution Guidelines

Please strictly follow these steps when contributing to the repository:

1. **Fork the repository.**
2. **Clone your forked repository** to your local machine:
   ```bash
   git clone https://github.com/<your-username>/SIH-26156.git
   cd SIH-26156
   ```
3. **Create a new branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Do all coding and changes only on your branch.**
5. **Commit and push** your changes to your fork:
   ```bash
   git add .
   git commit -m "Descriptive commit message"
   git push origin feature/your-feature-name
   ```
6. **Once the work is complete, raise a Pull Request (PR)** to the `main` branch of the original repository.
7. **Wait for the PR to be reviewed** before merging.
