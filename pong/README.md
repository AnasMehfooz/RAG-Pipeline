# Pong

Server-authoritative Pong: FastAPI WebSocket backend (60 Hz physics, CPU opponent) + vanilla JS canvas frontend.

```
cd pong/backend && pip install -r requirements.txt && uvicorn app.main:app --port 8000
cd pong/frontend && python3 -m http.server 8080   # open http://localhost:8080
```

Controls: W/S or Up/Down. Space/Enter restarts after a win (first to 7).
Tests: `cd pong/backend && python -m pytest -q`. Override WS endpoint with `?ws=ws://host:port/ws`.
