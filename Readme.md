# HealthGenie Demo

HealthGenie is a nutrition and recipe assistant that combines a food knowledge graph with an LLM (Azure OpenAI).

- `healthgenie-frontend/` — Next.js web app with knowledge-graph visualization and chat
- `healthgenie-server/` — Flask API serving the knowledge graph and LLM responses

## Getting Started

### 1. Server

Requires Python 3.10+.

```bash
cd healthgenie-server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

export ENDPOINT_URL="https://<your-resource>.openai.azure.com/"
export AZURE_OPENAI_API_KEY="<your-azure-openai-key>"
export DEPLOYMENT_NAME="gpt-4o"   # optional, defaults to gpt-4o

python main.py
```

The server runs at `http://localhost:5001`.

### 2. Frontend

Requires Node.js 18+.

```bash
cd healthgenie-frontend
npm install
npm run dev
```

Open http://localhost:3000. In development mode, the frontend talks to the local server at `http://localhost:5001`. The production server URL is set in `src/constant/server.ts`.
