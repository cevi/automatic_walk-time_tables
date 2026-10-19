import unittest
from unittest import mock

import requests

from automatic_walk_time_tables.path_transformers.heigth_fetcher_transfomer import (
    HeightFetcherTransformer,
)
from automatic_walk_time_tables.utils.error import ElevationServiceUnavailable
from automatic_walk_time_tables.utils.path import Path
from automatic_walk_time_tables.utils.point import Point_LV95

MODULE = "automatic_walk_time_tables.path_transformers.heigth_fetcher_transfomer"

PROFILE = [
    {"easting": 2724621, "northing": 1206272, "alts": {"COMB": 512.3}},
    {"easting": 2724704, "northing": 1206238, "alts": {"COMB": 530.1}},
]


def response(status_code, json_body=None, headers=None):
    r = mock.Mock(spec=requests.Response)
    r.status_code = status_code
    r.url = HeightFetcherTransformer.PATH_URL
    r.text = "" if json_body is None else str(json_body)
    r.headers = headers or {}
    r.json.return_value = json_body
    return r


def two_point_path():
    return Path(
        [
            Point_LV95(lat=2724621, lon=1206272),
            Point_LV95(lat=2724704, lon=1206238),
        ]
    )


@mock.patch(MODULE + ".time.sleep")
class HeightFetcherRetryTest(unittest.TestCase):
    def test_retries_rate_limit_then_succeeds(self, sleep):
        with mock.patch(
            MODULE + ".requests.post",
            side_effect=[
                response(429, headers={"Retry-After": "2"}),
                response(200, PROFILE),
            ],
        ) as post:
            path = HeightFetcherTransformer().transform(two_point_path())

        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(2.0)
        self.assertEqual([wp.point.h for wp in path.way_points], [512.3, 530.1])

    def test_passes_timeout(self, sleep):
        with mock.patch(
            MODULE + ".requests.post", return_value=response(200, PROFILE)
        ) as post:
            HeightFetcherTransformer().transform(two_point_path())

        self.assertEqual(
            post.call_args.kwargs["timeout"], HeightFetcherTransformer.TIMEOUT
        )

    def test_retries_network_errors(self, sleep):
        with mock.patch(
            MODULE + ".requests.post",
            side_effect=[requests.Timeout("read timed out"), response(200, PROFILE)],
        ) as post:
            HeightFetcherTransformer().transform(two_point_path())

        self.assertEqual(post.call_count, 2)

    def test_gives_up_after_max_attempts(self, sleep):
        with mock.patch(MODULE + ".requests.post", return_value=response(503)) as post:
            with self.assertRaises(ElevationServiceUnavailable):
                HeightFetcherTransformer().transform(two_point_path())

        self.assertEqual(post.call_count, HeightFetcherTransformer.MAX_ATTEMPTS)
        self.assertEqual(sleep.call_count, HeightFetcherTransformer.MAX_ATTEMPTS - 1)

    def test_does_not_retry_client_errors(self, sleep):
        with mock.patch(MODULE + ".requests.post", return_value=response(400)) as post:
            with self.assertRaises(ElevationServiceUnavailable):
                HeightFetcherTransformer().transform(two_point_path())

        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()

    def test_caps_retry_after(self, sleep):
        with mock.patch(
            MODULE + ".requests.post",
            side_effect=[
                response(429, headers={"Retry-After": "120"}),
                response(200, PROFILE),
            ],
        ):
            HeightFetcherTransformer().transform(two_point_path())

        sleep.assert_called_once_with(HeightFetcherTransformer.MAX_BACKOFF)


if __name__ == "__main__":
    unittest.main()
