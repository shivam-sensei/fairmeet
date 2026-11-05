# FairMeet

FairMeet finds a fair meetup point for a group of friends, calculates routes and fares, shows nearby venues, and provides optional metro directions.

## Requirements

- Python 3.10+
- Node.js 18+
- npm

## API keys

The backend reads these variables from `fairmeet-backend/.env`:

- `HEIGIT_API_KEY` - required for OpenRouteService/HeiGIT road routes and isochrones.
- `GOOGLE_PLACES_API_KEY` - Google Places API **demo key** used for venue discovery.
- `DATABASE_URL` - optional for the current API; keep it configured if your local database integrations need it.

Do not commit real API keys or database credentials. Use placeholders in documentation and keep `.env` files local.

## Backend setup

Create the environment file:

```bash
cd fairmeet-backend
cp .env.example .env
```

If `.env.example` does not exist, create `.env` with:

```dotenv
HEIGIT_API_KEY=your_heigit_api_key
GOOGLE_PLACES_API_KEY=your_google_places_demo_key
DATABASE_URL=postgresql://localhost:5432/fairmeet_db
```

Create and activate a virtual environment, then install dependencies:

```bash
cd fairmeet-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Start the FastAPI backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at [http://localhost:8000](http://localhost:8000). FastAPI docs are at [http://localhost:8000/docs](http://localhost:8000/docs).

## Frontend setup

Create the optional frontend environment file:

```bash
cd fairmeet-frontend
touch .env.local
```

Add the backend URL:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Install dependencies and start Next.js:

```bash
cd fairmeet-frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

Build the frontend locally before deployment:

```bash
cd fairmeet-frontend
npm run build
npm start
```

The frontend defaults to `http://localhost:8000` when `NEXT_PUBLIC_API_BASE_URL` is not set.

## Project layout

```text
fairmeet/
├── fairmeet-backend/
│   ├── data/metro.json
│   ├── main.py
│   ├── metro_router.py
│   └── requirements.txt
└── fairmeet-frontend/
    ├── app/
    ├── lib/
    ├── types/
    └── package.json
```

