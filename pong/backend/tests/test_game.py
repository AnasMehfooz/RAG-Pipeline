import random

from fastapi.testclient import TestClient

from app import game as g
from app.main import app


def make():
    gm = g.Game(rng=random.Random(1))
    return gm


def test_wall_bounce_top_and_bottom():
    gm = make()
    gm.ball_x, gm.ball_y, gm.vx, gm.vy = 400, 2, 0, -300
    gm.step()
    assert gm.vy > 0 and gm.ball_y >= 0
    gm.ball_y, gm.vy = g.H - g.BALL - 2, 300
    gm.step()
    assert gm.vy < 0 and gm.ball_y <= g.H - g.BALL


def test_paddle_bounce_reverses_and_speeds_up():
    gm = make()
    gm.left_y = 250
    gm.ball_x, gm.ball_y = g.LEFT_X + g.PADDLE_W + 1, 250 + 44
    gm.vx, gm.vy = -360, 0
    gm.step()
    assert gm.vx > 0
    assert abs(gm.vx) > 0 and (gm.vx**2 + gm.vy**2) ** 0.5 > 360


def test_paddle_bounce_spin_from_offset():
    gm = make()
    gm.left_y = 250
    gm.ball_x, gm.ball_y = g.LEFT_X + g.PADDLE_W + 1, 250 + 90  # low on paddle
    gm.vx, gm.vy = -360, 0
    gm.step()
    assert gm.vy > 0
    gm2 = make()
    gm2.left_y = 250
    gm2.ball_x, gm2.ball_y = g.LEFT_X + g.PADDLE_W + 1, 250 - 8  # high on paddle
    gm2.vx, gm2.vy = -360, 0
    gm2.step()
    assert gm2.vy < 0


def test_speed_capped():
    gm = make()
    gm.left_y = 250
    gm.ball_x, gm.ball_y = g.LEFT_X + g.PADDLE_W + 1, 290
    gm.vx, gm.vy = -g.BALL_MAX_SPEED, 0
    gm.step()
    assert (gm.vx**2 + gm.vy**2) ** 0.5 <= g.BALL_MAX_SPEED + 1e-6


def test_scoring_right_and_left():
    gm = make()
    gm.left_y = 0  # paddle far from ball
    gm.ball_x, gm.ball_y, gm.vx, gm.vy = -20, 500, -300, 0
    gm.step()
    assert gm.score_right == 1 and gm.vx < 0  # served toward loser (left)
    assert gm.ball_x == (g.W - g.BALL) / 2
    gm.right_y = 0
    gm.ball_x, gm.ball_y, gm.vx, gm.vy = g.W + 1, 500, 300, 0
    gm.step()
    assert gm.score_left == 1 and gm.vx > 0


def test_win_condition_and_halt_and_reset():
    gm = make()
    gm.score_left = 6
    gm.right_y = 0
    gm.ball_x, gm.ball_y, gm.vx, gm.vy = g.W + 1, 500, 300, 0
    gm.step()
    assert gm.winner == "left" and gm.score_left == 7
    snap = gm.state()
    gm.set_input(1)
    gm.step()
    assert gm.state() == snap  # halted
    gm.reset()
    assert gm.winner is None and gm.score_left == 0


def test_paddle_clamp():
    gm = make()
    gm.set_input(-1)
    for _ in range(120):
        gm.step()
        gm.winner = None
    assert gm.left_y == 0
    gm.set_input(1)
    for _ in range(240):
        gm.step()
        gm.winner = None
    assert gm.left_y == g.H - g.PADDLE_H


def test_ai_speed_capped():
    gm = make()
    gm.right_y = 0
    gm.ball_x, gm.ball_y, gm.vx, gm.vy = 400, 580, 0, 0
    gm.step()
    assert gm.right_y <= g.AI_SPEED / g.TICK_HZ + 1e-9


def test_http_and_websocket():
    client = TestClient(app)
    assert client.get("/health").json() == {"status": "ok"}
    with client.websocket_connect("/ws") as ws:
        s = ws.receive_json()
        assert s["type"] == "state" and s["w"] == 800 and s["h"] == 600
        assert set(s) >= {"ball", "paddles", "score", "winner"}
        y0 = s["paddles"]["left"]
        ws.send_json({"type": "input", "dir": -1})
        for _ in range(5):
            s = ws.receive_json()
        assert s["paddles"]["left"] < y0
        ws.send_json({"type": "reset"})
        ws.receive_json()
