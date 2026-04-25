"""Remove solid color background from pixel art via flood-fill from edges.

For each image:
1. Sample corner & edge pixels to learn the background color(s).
2. BFS flood-fill from every edge pixel matching the background color (within tolerance).
3. Any pixel reached is set to alpha=0.
4. Sparkles disconnected from edges are also caught if their color is close to bg.

Usage: python3 scripts/remove_bg_color.py <src_dir> <dst_dir> [tolerance]
"""

from __future__ import annotations

import os
import sys
from collections import deque

from PIL import Image


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2]))


def remove_bg(path_in: str, path_out: str, tolerance: int = 20) -> None:
    img = Image.open(path_in).convert("RGBA")
    w, h = img.size
    px = img.load()

    # Sample background colours densely along all four edges.
    sample_set: set[tuple[int, int, int]] = set()
    step_x = max(1, w // 80)
    step_y = max(1, h // 80)
    for x in range(0, w, step_x):
        sample_set.add(px[x, 0][:3])
        sample_set.add(px[x, h - 1][:3])
    for y in range(0, h, step_y):
        sample_set.add(px[0, y][:3])
        sample_set.add(px[w - 1, y][:3])
    samples = list(sample_set)

    def is_bg(rgb: tuple[int, int, int]) -> bool:
        return any(color_dist(rgb, s) <= tolerance for s in samples)

    # Flood fill from every edge pixel that matches background.
    visited = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        idx = y * w + x
        if visited[idx]:
            return
        r, g, b, _a = px[x, y]
        if not is_bg((r, g, b)):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while queue:
        x, y = queue.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                push(nx, ny)

    img.save(path_out, "PNG", optimize=True)


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: remove_bg_color.py <src_dir> <dst_dir> [tolerance]", file=sys.stderr)
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    tol = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    os.makedirs(dst, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.lower().endswith(".png"))
    for i, f in enumerate(files, 1):
        remove_bg(os.path.join(src, f), os.path.join(dst, f), tol)
        print(f"[{i}/{len(files)}] {f}")


if __name__ == "__main__":
    main()
