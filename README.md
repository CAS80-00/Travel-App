Travel App — Project Summary and Architecture

Project overview
----------------
Travel App centralizes travel planning information so users don't need to visit multiple websites to learn about countries and cities, their attractions, how to get around (walking, public transport, rideshares), and how to plan/save itineraries and map pins. The app aggregates destination content (Wikivoyage), mapping and routing (Google Maps, Geoapify/MapLibre), imagery (Unsplash), and user-saved data into a single interface.

Problem to solve
-----------------
Travelers must visit multiple websites to get information about countries and cities and how to navigate them by using different means of transportation. This can be difficult for users who are unfamiliar with the place they are visiting. Travelers want to see what to do, what attractions to visit, how to get there, and the best transport options (public transport, rideshare, or walking) without hopping between multiple sources.

Solution
--------
Travel App provides a single place to:
- Read destination content (city & country) extracted from Wikivoyage.
- Search for places with autocomplete and view them on an interactive map.
- Pin attractions on a map, plan routes using multiple transport modes, and save itineraries for later.
- Save favorite cities/countries/itineraries to a user account.

Main features
-------------
- Destination pages (City/Country): sections extracted from Wikivoyage (Understand, Get in, Get around, See, Do, Stay safe, Go next).
- Interactive Map: pin locations, view POIs, get directions with Google Maps (walking, transit, driving).
- Saved data: persistent saved_places (city, country, map, itinerary) and itineraries per user.
- Authentication: register/login, JWT-based sessions stored in DB, change password, delete account.
- Images: Unsplash image search for destination thumbnails.
- POIs & Map styles: Geoapify (MapLibre) for POIs and style tiles.



PostgreSQL schemas (current)
----------------------------
The DB schema is defined in [Travel_App_Core/backend/schema.sql]

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/85f7c53a-24e1-48fb-9647-9ddd46d20769" />

Notes about schema
- ON DELETE CASCADE is used for related tables (sessions, saved_places, itineraries) so deleting a user removes related rows.
- itineraries.points is currently TEXT (JSON string). Consider migrating to JSONB for structured queries and indexing.
- Pins/markers are not persisted in the DB by default (client-side only). If desired, a pins table can be added.

Architecture diagram (logical)
-----------------------------
<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/7538e791-b152-49f7-abe3-c9601f1101b5" />
Travelapp
├─ README.md
├─ package.json
├─ Doc
│ ├─ folder-tree.svg
│ ├─ folder-architecture.mmd
│ └─ folder-architecture.dot
├─ Travel_App_Core
│ ├─ backend
│ │ ├─ server.js
│ │ ├─ package.json
│ │ ├─ schema.sql
│ │ ├─ usersRouter.js
│ │ ├─ middleware
│ │ │ └─ requireUser.js
│ │ ├─ db
│ │ │ ├─ index.js
│ │ │ └─ queries
│ │ │ ├─ users.js
│ │ │ ├─ sessions.js
│ │ │ ├─ saved_places.js
│ │ │ ├─ itineraries.js
│ │ │ ├─ itinerary_items.js
│ │ │ ├─ cities.js
│ │ │ ├─ places.js
│ │ │ ├─ routes.js
│ │ │ └─ pins.js
│ │ └─ scripts
│ │ ├─ seed.js
│ │ └─ create_user.js
│ └─ frontend
│ ├─ package.json
│ ├─ .env (gitignored; contains REACT_APP_* keys)
│ ├─ public
│ │ └─ index.html
│ ├─ src
│ │ ├─ components
│ │ │ ├─ AuthCard.jsx
│ │ │ ├─ SaveButton.jsx
│ │ │ └─ SearchBar.jsx (and other components)
│ │ ├─ pages
│ │ │ ├─ DashboardPage.jsx
│ │ │ ├─ CityPage.jsx
│ │ │ └─ Countrypage.jsx
│ │ ├─ styles\ (CSS files)
│ │ └─ index.js (React entry)
│ ├─ build\ (generated production build; served by backend)
│ └─ fix-auth-placeholders*.js (helper scripts, optional/auxiliary)
└─ (other files / temp artifacts)

Notes

backend/server.js serves frontend\build when present and provides API routes under /api.
DB access is centralized at backend\db\index.js and implemented per-domain in db\queries*.js.
.env in the frontend is gitignored; REACT_APP_* values are baked into the frontend at build time.
frontend\build is generated (npm run build) and must exist on the host for backend to serve the SPA.


External APIs used (how they are connected)
-------------------------------------------
1) Wikivoyage (MediaWiki Parse API) — server-side
- URL pattern called by backend:
  https://en.wikivoyage.org/w/api.php?action=parse&page={CITY}&format=json&prop=text
- server: fetches parse.text, loads it into Cheerio, extracts sections (Understand, Get in, Get around, See, Do, Stay safe, Go next) and returns JSON to the frontend.
- Location: [server.js](/C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/Travelapp/Travel_App_Core/backend/server.js)

2) Google Maps JavaScript API (client-side)
- Loader URL used by DashboardPage:
  https://maps.googleapis.com/maps/api/js?key={REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places
- Uses: Map rendering, Places Autocomplete, Geocoder, DirectionsService, DirectionsRenderer, Markers/InfoWindows.
- Runs entirely in the browser (no server proxy by default).
- Location: [DashboardPage.jsx](C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/Travelapp/Travel_App_Core/frontend/src/pages/DashboardPage.jsx)

3) Geoapify (Map styles & Places)
- Styles (MapLibre) and Places API used in [Map.jsx](C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/Travelapp/Travel_App_Core/frontend/src/components/Map.jsx).
- Example Places request:
  https://api.geoapify.com/v2/places?categories=...&filter=circle:{lon},{lat},{radius}&apiKey={GEOAPIFY_KEY}

4) Unsplash (images)
- Client helper [src/api/unsplash.js](C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/Travelapp/Travel_App_Core/frontend/src/api/unsplash.js) calls:
  https://api.unsplash.com/search/photos?query={query}&client_id={UNSPLASH_KEY}

5) Internal REST API (Express server)
- Auth & sessions: POST /api/register, POST /api/login, POST /api/logout, GET /api/me
- Saved places & itineraries: POST/DELETE /api/save-place, GET /api/saved-places, GET/POST/DELETE /api/itineraries
- Wikivoyage: GET /api/wikivoyage/:city and GET /api/wikivoyage-country/:country

Deploy & run instructions (development, Windows)
-----------------------------------------------
Prerequisites
- Node.js (14+), npm
- PostgreSQL server accessible and psql in PATH

1) Prepare the database
- Create a database and note the connection URL, e.g.:
  - Database name: travelapp_dev
  - Example psql commands (PowerShell):
    createdb travelapp_dev
    psql -d travelapp_dev -f "C:/Users/dilan/OneDrive/Documents/Fullstack/CARLOS/Travelapp/Travel_App_Core/backend/schema.sql"
- Alternatively run the SQL inside a DB client to create tables.

2) Backend setup
- Open PowerShell and run:
  cd C:\Users\dilan\OneDrive\Documents\Fullstack\CARLOS\Travelapp\Travel_App_Core\backend
  npm install

- Create a .env file with at least:
  DATABASE_URL=postgres://USER:PASS@HOST:PORT/travelapp_dev
  JWT_SECRET=your_jwt_secret_here

- Start backend:
  node server.js
  (The server listens on port 4000 by default)

3) Frontend setup
- In a separate PowerShell window:
  cd C:\Users\dilan\OneDrive\Documents\Fullstack\CARLOS\Travelapp\Travel_App_Core\frontend
  npm install

- Create .env with API keys and settings:
  REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
  REACT_APP_GEOAPIFY_KEY=your_geoapify_api_key
  REACT_APP_UNSPLASH_KEY=your_unsplash_api_key

- Start frontend (development):
  npm start
  (Opens at http://localhost:3000 by default)

4) Register and use
- Register a user in the UI or via curl to POST /api/register (backend running on port 4000)
- Login at UI; Dashboard will load saved places and allow pinning/saving.

Notes and recommendations
-------------------------
- API keys in client-side code are exposed in the browser. Restrict the Google Maps key to allowed domains via Google Cloud Console and restrict Geoapify/Unsplash keys as supported.
- Consider migrating itineraries.points to JSONB for better DB handling:
  ALTER TABLE itineraries ALTER COLUMN points TYPE JSONB USING points::jsonb;
- If you want pins persisted, add a pins table (user_id, lat, lng, name, metadata JSONB) and endpoints GET/POST/DELETE /api/pins.
- For production, serve the frontend build from a static server (or host on CDN) and run backend behind a reverse proxy. Use environment variables and a secure JWT secret.
 

