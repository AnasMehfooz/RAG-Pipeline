"""Pure, framework-free Pong physics engine."""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

W, H = 800, 600
PADDLE_W, PADDLE_H = 10, 100
LEFT_X, RIGHT_X = 20, 770
BALL = 12
TICK_HZ = 60
PADDLE_SPEED = 420.0      # px/s, player
AI_SPEED = 260.0          # px/s, capped so the AI is beatable
AI_DEADZONE = 10.0
BALL_START_SPEED = 360.0  # px/s
BALL_MAX_SPEED = 900.0
SPEEDUP = 1.06
MAX_BOUNCE_ANGLE = math.radians(60)
WIN_SCORE = 7


@dataclass
class Game:
    rng: random.Random = field(default_factory=random.Random, repr=False)
    ball_x: float = 0.0
    ball_y: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    left_y: float = 0.0
    right_y: float = 0.0
    score_left: int = 0
    score_right: int = 0
    winner: str | None = None
    input_dir: int = 0

    def __post_init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.score_left = self.score_right = 0
        self.winner = None
        self.input_dir = 0
        self.left_y = self.right_y = (H - PADDLE_H) / 2
        self.reset_ball(self.rng.choice((-1, 1)))

    def reset_ball(self, direction: int) -> None:
        """Place ball at center, moving horizontally toward `direction` (-1 left, 1 right)."""
        self.ball_x = (W - BALL) / 2
        self.ball_y = (H - BALL) / 2
        angle = self.rng.uniform(-0.5, 0.5)
        self.vx = direction * BALL_START_SPEED * math.cos(angle)
        self.vy = BALL_START_SPEED * math.sin(angle)

    def set_input(self, d: int) -> None:
        self.input_dir = -1 if d < 0 else 1 if d > 0 else 0

    @staticmethod
    def _clamp(y: float) -> float:
        return max(0.0, min(H - PADDLE_H, y))

    def _bounce(self, paddle_y: float, direction: int) -> None:
        offset = ((self.ball_y + BALL / 2) - (paddle_y + PADDLE_H / 2)) / (PADDLE_H / 2)
        offset = max(-1.0, min(1.0, offset))
        speed = min(math.hypot(self.vx, self.vy) * SPEEDUP, BALL_MAX_SPEED)
        angle = offset * MAX_BOUNCE_ANGLE
        self.vx = direction * speed * math.cos(angle)
        self.vy = speed * math.sin(angle)

    def step(self, dt: float = 1.0 / TICK_HZ) -> None:
        if self.winner:
            return
        # paddles
        self.left_y = self._clamp(self.left_y + self.input_dir * PADDLE_SPEED * dt)
        target = self.ball_y + BALL / 2 - PADDLE_H / 2
        diff = target - self.right_y
        if abs(diff) > AI_DEADZONE:
            move = max(-AI_SPEED * dt, min(AI_SPEED * dt, diff))
            self.right_y = self._clamp(self.right_y + move)

        # ball
        self.ball_x += self.vx * dt
        self.ball_y += self.vy * dt
        if self.ball_y < 0:
            self.ball_y = -self.ball_y
            self.vy = abs(self.vy)
        elif self.ball_y > H - BALL:
            self.ball_y = 2 * (H - BALL) - self.ball_y
            self.vy = -abs(self.vy)

        def overlaps_y(py: float) -> bool:
            return self.ball_y + BALL > py and self.ball_y < py + PADDLE_H

        if self.vx < 0 and self.ball_x < LEFT_X + PADDLE_W and self.ball_x + BALL > LEFT_X \
                and overlaps_y(self.left_y):
            self.ball_x = LEFT_X + PADDLE_W
            self._bounce(self.left_y, 1)
        elif self.vx > 0 and self.ball_x + BALL > RIGHT_X and self.ball_x < RIGHT_X + PADDLE_W \
                and overlaps_y(self.right_y):
            self.ball_x = RIGHT_X - BALL
            self._bounce(self.right_y, -1)

        # scoring
        if self.ball_x + BALL < 0:
            self.score_right += 1
            self._after_score("right", -1)
        elif self.ball_x > W:
            self.score_left += 1
            self._after_score("left", 1)

    def _after_score(self, scorer: str, toward: int) -> None:
        if max(self.score_left, self.score_right) >= WIN_SCORE:
            self.winner = scorer
            self.vx = self.vy = 0.0
            self.ball_x = (W - BALL) / 2
            self.ball_y = (H - BALL) / 2
        else:
            self.reset_ball(toward)  # serve toward the player who lost the point

    def state(self) -> dict:
        return {
            "type": "state",
            "ball": {"x": self.ball_x, "y": self.ball_y},
            "paddles": {"left": self.left_y, "right": self.right_y},
            "score": {"left": self.score_left, "right": self.score_right},
            "winner": self.winner,
            "w": W,
            "h": H,
        }
