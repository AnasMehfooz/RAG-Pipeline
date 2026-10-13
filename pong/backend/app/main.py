import asyncio
import contextlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .game import TICK_HZ, Game

app = FastAPI(title="Pong backend")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


async def _loop(ws: WebSocket, game: Game) -> None:
    dt = 1.0 / TICK_HZ
    loop = asyncio.get_running_loop()
    next_t = loop.time()
    while True:
        game.step(dt)
        await ws.send_json(game.state())
        next_t += dt
        await asyncio.sleep(max(0.0, next_t - loop.time()))


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    game = Game()
    task = asyncio.create_task(_loop(ws, game))
    try:
        while True:
            try:
                msg = await ws.receive_json()
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("type") == "input":
                d = msg.get("dir", 0)
                if isinstance(d, (int, float)):
                    game.set_input(int(d))
            elif msg.get("type") == "reset":
                game.reset()
    except WebSocketDisconnect:
        pass
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task
