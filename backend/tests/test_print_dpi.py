import json
import unittest
from pathlib import Path

from automatic_walk_time_tables.map_downloader.create_map import (
    BASE_DPI,
    MAX_DPI,
    OGC_PIXEL_SIZE_M,
    select_print_dpi,
)

MATRICES_FILE = (
    Path(__file__).resolve().parent.parent
    / "automatic_walk_time_tables"
    / "map_downloader"
    / "default_map_matrices.json"
)


class TestSelectPrintDpi(unittest.TestCase):
    def setUp(self):
        with open(MATRICES_FILE) as f:
            self.matrices = json.load(f)
        self.resolutions = [
            m["scaleDenominator"] * OGC_PIXEL_SIZE_M for m in self.matrices
        ]

    def assertMatchesZoomLevel(self, scale, dpi):
        pixel_size_m = scale * 0.0254 / dpi
        self.assertTrue(
            any(abs(pixel_size_m - r) < 1e-3 for r in self.resolutions),
            f"1:{scale} at {dpi} dpi gives {pixel_size_m} m/px, not a zoom level",
        )

    def test_scales_matching_at_base_dpi_keep_base_dpi(self):
        for scale in [10_000, 20_000, 50_000, 100_000, 200_000]:
            self.assertEqual(select_print_dpi(scale, self.matrices), BASE_DPI)

    def test_1_to_25000_prints_at_one_metre_tiles(self):
        dpi = select_print_dpi(25_000, self.matrices)
        self.assertEqual(dpi, 635)
        self.assertMatchesZoomLevel(25_000, dpi)

    def test_selected_dpi_is_within_limits(self):
        for scale in range(5_000, 200_001, 5_000):
            dpi = select_print_dpi(scale, self.matrices)
            self.assertGreaterEqual(dpi, BASE_DPI)
            self.assertLessEqual(dpi, MAX_DPI)
            if dpi != BASE_DPI:
                self.assertMatchesZoomLevel(scale, dpi)

    def test_falls_back_to_base_dpi_without_matching_level(self):
        # 1:15'000 needs 0.75 m/px; the closest levels (0.5 m, 1.0 m) are outside the DPI range
        self.assertEqual(select_print_dpi(15_000, self.matrices), BASE_DPI)

    def test_max_dpi_matches_mapfish_config(self):
        config = (
            Path(__file__).resolve().parents[2]
            / "mapfish_print_server"
            / "swisstopo_config"
            / "config.yaml"
        ).read_text()
        self.assertIn(f"maxDpi: {MAX_DPI}", config)


if __name__ == "__main__":
    unittest.main()
