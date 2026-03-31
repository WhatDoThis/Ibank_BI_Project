"""흰 배경 투명 처리(모서리 BFS). 원본을 public/_siren_src.png 로 두고 실행 → starbucks-siren-mark.png"""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "_siren_src.png"
OUT = ROOT / "public" / "starbucks-siren-mark.png"


def can_erase(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return False
    # 스타벅스 그린 링 유지
    if g > r + 18 and g > b + 12 and g > 55:
        return False
    # 어두운 테두리
    if max(r, g, b) < 70:
        return False
    # 바깥 흰·연회색
    if min(r, g, b) > 198:
        return True
    if r + g + b > 720 and max(r, g, b) - min(r, g, b) < 45:
        return True
    return False


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"missing {SRC}")
    img = Image.open(SRC).convert("RGBA")
    px = img.load()
    w, h = img.size
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if not can_erase(r, g, b, a):
            continue
        px[x, y] = (r, g, b, 0)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny][nx]:
                q.append((ny, nx))

    img.save(OUT, "PNG")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
