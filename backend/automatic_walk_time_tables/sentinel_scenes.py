"""
Picks the Sentinel-2 satellite images offered as background maps.

The images come from swisstopo's swissEO S2-SR v200 product: one mosaic per
Sentinel-2 pass over Switzerland, in LV95, with a cloud mask. The frontend
reads the true-colour image (a Cloud-Optimized GeoTIFF) directly from
swisstopo; here we only decide which passes to show.

https://www.swisstopo.admin.ch/en/satelliteimage-swisseo-s2-sr
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

import requests

logger = logging.getLogger(__name__)

STAC_COLLECTION = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swisseo_s2-sr_v200"

# Item ids of single passes look like "2026-11-16t102311". The collection also
# contains a rolling "current" item, which we skip.
PASS_ID = re.compile(r"^\d{4}-\d{2}-\d{2}t\d{6}$")

KEEP = 3  # number of images offered
LOOKBACK_DAYS = 120  # how far back to look for cloud-free passes
RECENT_DAYS = 10  # always offer the best pass of the last days
MIN_CLEAR_RATIO = 0.8  # share of the pass that must be cloud-free
# Area of the pass's bounding box. Switzerland is covered by four orbits; two
# of them (bounding boxes of ~64'000 and ~74'000 km²) cover most of the
# country, the other two only a strip along the border (~4'000 and ~16'000 km²).
MIN_FOOTPRINT_KM2 = 30000

CACHE_TTL_S = 6 * 3600
TIMEOUT_S = 15

ATTRIBUTION = "Enthält modifizierte Copernicus-Sentinel-Daten, verarbeitet durch swisstopo (swissEO S2-SR)"


@dataclass
class Scene:
    id: str
    datetime: str
    url: str  # true-colour Cloud-Optimized GeoTIFF, 10 m, LV95
    metadata_url: str
    footprint_km2: float
    clear_ratio: float | None = None

    @property
    def usable(self) -> bool:
        return (
            self.clear_ratio is not None
            and self.clear_ratio >= MIN_CLEAR_RATIO
            and self.footprint_km2 >= MIN_FOOTPRINT_KM2
        )

    @property
    def score(self) -> float:
        """Rough cloud-free area, used to rank cloudy passes."""
        return (self.clear_ratio or 0.0) * self.footprint_km2


def select_scenes(
    candidates: list[Scene],
    evaluate: Callable[[Scene], Scene],
    now: datetime,
    keep: int = KEEP,
    recent_days: int = RECENT_DAYS,
) -> list[Scene]:
    """Pick the scenes to show, newest first.

    Balances freshness against cloud cover:

    * The map should always show the current situation (e.g. fresh snow), so
      if none of the passes of the last `recent_days` is cloud-free enough,
      the one with the largest cloud-free area among them is shown anyway.
    * The other slots get the newest passes that are cloud-free enough.

    `candidates` must be sorted newest first. `evaluate` fills in the cloud
    cover and is only called for the passes that are needed.
    """
    recent_cutoff = now - timedelta(days=recent_days)
    recent = [
        evaluate(s) for s in candidates if parse_datetime(s.datetime) >= recent_cutoff
    ]

    usable: list[Scene] = []
    for scene in candidates:
        if len(usable) >= keep:
            break
        scene = evaluate(scene)
        if scene.usable:
            usable.append(scene)

    has_recent = any(parse_datetime(s.datetime) >= recent_cutoff for s in usable)
    if has_recent or not recent:
        return usable

    best_recent = max(recent, key=lambda s: (s.score, s.datetime))
    chosen = [best_recent] + usable[: keep - 1]
    chosen.sort(key=lambda s: s.datetime, reverse=True)
    return chosen


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fetch_passes(since: datetime) -> list[Scene]:
    """All single-pass items since `since`, newest first."""
    url = f"{STAC_COLLECTION}/items"
    params = {"limit": 100, "datetime": since.strftime("%Y-%m-%dT%H:%M:%SZ") + "/.."}
    scenes = []
    while url:
        r = requests.get(url, params=params, timeout=TIMEOUT_S)
        r.raise_for_status()
        page = r.json()
        for item in page["features"]:
            scene = scene_from_item(item)
            if scene is not None:
                scenes.append(scene)
        url = next((l["href"] for l in page["links"] if l["rel"] == "next"), None)
        params = None  # the next link already carries the query
    scenes.sort(key=lambda s: s.datetime, reverse=True)
    return scenes


def scene_from_item(item: dict) -> Scene | None:
    if not PASS_ID.match(item["id"]):
        return None
    assets = item["assets"]
    tci = next((a for k, a in assets.items() if k.endswith("_tci_10m.tif")), None)
    meta = next((a for k, a in assets.items() if k.endswith("_metadata.json")), None)
    if tci is None or meta is None or not item.get("geometry"):
        return None
    return Scene(
        id=item["id"],
        datetime=item["properties"]["datetime"],
        url=tci["href"],
        metadata_url=meta["href"],
        footprint_km2=round(footprint_km2(item["geometry"]), 0),
    )


def footprint_km2(geometry: dict) -> float:
    """Approximate area of a lon/lat polygon (good enough for Switzerland)."""
    if geometry["type"] == "Polygon":
        rings = [geometry["coordinates"][0]]
    elif geometry["type"] == "MultiPolygon":
        rings = [polygon[0] for polygon in geometry["coordinates"]]
    else:
        return 0.0

    total = 0.0
    for ring in rings:
        lat0 = math.radians(sum(p[1] for p in ring) / len(ring))
        kx, ky = 111.32 * math.cos(lat0), 110.57
        pts = [(p[0] * kx, p[1] * ky) for p in ring]
        total += (
            abs(
                sum(
                    x1 * y2 - x2 * y1
                    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1])
                )
            )
            / 2
        )
    return total


def fetch_clear_ratio(scene: Scene) -> float:
    """Cloud-free share of the pass, as computed by swisstopo from its cloud mask."""
    r = requests.get(scene.metadata_url, timeout=TIMEOUT_S)
    r.raise_for_status()
    cloud_percentage = float(r.json()["PROPERTIES"]["CLOUDPERCENTAGE"])
    return round(1 - cloud_percentage / 100, 3)


class SentinelCatalog:
    """Caches the selection, and the cloud cover of every pass seen so far."""

    def __init__(self, ttl_s: int = CACHE_TTL_S):
        self.ttl_s = ttl_s
        self._lock = threading.Lock()
        self._clear_ratios: dict[str, float] = {}
        self._scenes: list[Scene] | None = None
        self._fetched_at = 0.0

    def layers(self) -> dict:
        with self._lock:
            if self._scenes is None or time.monotonic() - self._fetched_at > self.ttl_s:
                try:
                    self._scenes = self._select()
                    self._fetched_at = time.monotonic()
                except (requests.RequestException, KeyError, ValueError) as e:
                    if self._scenes is None:
                        raise
                    # keep offering the previous images, retry in 10 minutes
                    logger.warning("Refreshing Sentinel-2 scenes failed: %s", e)
                    self._fetched_at = time.monotonic() - self.ttl_s + 600

            return {
                "attribution": ATTRIBUTION,
                "layers": [
                    {
                        "id": s.id,
                        "datetime": s.datetime,
                        "url": s.url,
                        "clear_ratio": s.clear_ratio,
                        "footprint_km2": s.footprint_km2,
                    }
                    for s in self._scenes
                ],
            }

    def warm_up(self):
        """Fill the cache in the background, so the first visitor doesn't wait."""

        def run():
            try:
                self.layers()
            except Exception as e:
                logger.warning("Loading Sentinel-2 scenes failed: %s", e)

        threading.Thread(target=run, name="sentinel-warm-up", daemon=True).start()

    def _select(self) -> list[Scene]:
        now = datetime.now(timezone.utc)
        candidates = fetch_passes(now - timedelta(days=LOOKBACK_DAYS))
        scenes = select_scenes(candidates, self._evaluate, now)
        logger.info("Sentinel-2 scenes: %s", ", ".join(s.id for s in scenes) or "none")
        return scenes

    def _evaluate(self, scene: Scene) -> Scene:
        if scene.id not in self._clear_ratios:
            self._clear_ratios[scene.id] = fetch_clear_ratio(scene)
        scene.clear_ratio = self._clear_ratios[scene.id]
        return scene
