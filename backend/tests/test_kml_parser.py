import unittest

from automatic_walk_time_tables.utils.error import UserException
from automatic_walk_time_tables.utils.kml_parser import parse_kml


def kml(body: str, root_attributes: str = 'xmlns="http://www.opengis.net/kml/2.2"'):
    return f'<?xml version="1.0" encoding="UTF-8"?><kml {root_attributes}>{body}</kml>'


def placemark(geometry: str, name: str = "Route"):
    return f"<Placemark><name>{name}</name>{geometry}</Placemark>"


class CoordinatesTest(unittest.TestCase):
    def test_space_separated(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><coordinates>8.1,47.1,500 8.2,47.2,510</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(route.coordinates, [(8.1, 47.1, 500.0), (8.2, 47.2, 510.0)])

    def test_newline_and_tab_separated(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><tessellate>1</tessellate><coordinates>\n"
                    "\t\t\t8.1,47.1,0\n\t\t\t8.2,47.2,0\r\n\t\t\t8.3,47.3,0\n\t\t"
                    "</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(
            route.coordinates, [(8.1, 47.1, 0.0), (8.2, 47.2, 0.0), (8.3, 47.3, 0.0)]
        )

    def test_multiple_spaces_and_spaces_after_commas(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><coordinates>8.1, 47.1   8.2 ,47.2,  7</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(route.coordinates, [(8.1, 47.1, None), (8.2, 47.2, 7.0)])

    def test_scientific_notation_and_negative_values(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><coordinates>-8.1e0,4.71E1 -8.2,47.2</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(route.coordinates, [(-8.1, 47.1, None), (-8.2, 47.2, None)])

    def test_invalid_coordinates(self):
        for coordinates in [
            "8.1,abc 8.2,47.2",
            "8.1 8.2,47.2",
            "1,2,3,4 5,6",
            "nan,1 2,3",
        ]:
            with self.subTest(coordinates=coordinates):
                with self.assertRaises(UserException):
                    parse_kml(
                        kml(
                            placemark(
                                f"<LineString><coordinates>{coordinates}</coordinates></LineString>"
                            )
                        )
                    )

    def test_relative_altitude_is_not_an_elevation(self):
        for mode in ["relativeToGround", "clampToSeaFloor", "relativeToSeaFloor"]:
            with self.subTest(mode=mode):
                route = parse_kml(
                    kml(
                        placemark(
                            f"<LineString><altitudeMode>{mode}</altitudeMode>"
                            "<coordinates>8.1,47.1,50 8.2,47.2,50</coordinates></LineString>"
                        )
                    )
                )
                self.assertEqual(
                    route.coordinates, [(8.1, 47.1, None), (8.2, 47.2, None)]
                )

    def test_absolute_altitude(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><altitudeMode>absolute</altitudeMode>"
                    "<coordinates>8.1,47.1,500 8.2,47.2,510</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(route.coordinates, [(8.1, 47.1, 500.0), (8.2, 47.2, 510.0)])


class GeometryTest(unittest.TestCase):
    def test_linear_ring_gets_closed(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LinearRing><coordinates>8,47 8.1,47 8.1,47.1</coordinates></LinearRing>"
                )
            )
        )
        self.assertEqual(len(route.coordinates), 4)
        self.assertEqual(route.coordinates[0], route.coordinates[-1])

    def test_closed_linear_ring_is_not_closed_twice(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LinearRing><coordinates>8,47 8.1,47 8.1,47.1 8,47</coordinates></LinearRing>"
                )
            )
        )
        self.assertEqual(len(route.coordinates), 4)

    def test_polygon_uses_outer_boundary(self):
        route = parse_kml(
            kml(
                placemark(
                    "<Polygon>"
                    "<innerBoundaryIs><LinearRing><coordinates>1,1 2,1 2,2 1,1</coordinates></LinearRing></innerBoundaryIs>"
                    "<outerBoundaryIs><LinearRing><coordinates>8,47 8.1,47 8.1,47.1 8,47</coordinates></LinearRing></outerBoundaryIs>"
                    "</Polygon>"
                )
            )
        )
        self.assertEqual(route.coordinates[0], (8.0, 47.0, None))
        self.assertEqual(len(route.coordinates), 4)

    def test_gx_track(self):
        route = parse_kml(
            kml(
                placemark(
                    "<gx:Track><altitudeMode>absolute</altitudeMode>"
                    "<when>2020-01-01T10:00:00Z</when><when>2020-01-01T10:01:00Z</when>"
                    "<when>2020-01-01T10:02:00Z</when>"
                    "<gx:coord>8.1 47.1 500</gx:coord><gx:coord/><gx:coord>8.2 47.2 510</gx:coord>"
                    "</gx:Track>"
                ),
                'xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"',
            )
        )
        self.assertEqual(route.coordinates, [(8.1, 47.1, 500.0), (8.2, 47.2, 510.0)])

    def test_gx_multi_track_is_one_path(self):
        route = parse_kml(
            kml(
                placemark(
                    "<gx:MultiTrack><gx:interpolate>1</gx:interpolate>"
                    "<gx:Track><gx:coord>8.1 47.1 500</gx:coord><gx:coord>8.2 47.2 510</gx:coord></gx:Track>"
                    "<gx:Track><gx:coord>8.5 47.5 520</gx:coord><gx:coord>8.6 47.6 530</gx:coord></gx:Track>"
                    "</gx:MultiTrack>"
                ),
                'xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"',
            )
        )
        self.assertEqual(len(route.coordinates), 4)

    def test_kml_2_3_track(self):
        route = parse_kml(
            kml(
                placemark(
                    "<Track><coord>8.1 47.1</coord><coord>8.2 47.2</coord></Track>"
                ),
                'xmlns="http://www.opengis.net/kml/2.3"',
            )
        )
        self.assertEqual(route.coordinates, [(8.1, 47.1, None), (8.2, 47.2, None)])

    def test_multi_geometry_joins_connected_lines(self):
        route = parse_kml(
            kml(
                placemark(
                    "<MultiGeometry>"
                    "<Point><coordinates>8.1,47.1</coordinates></Point>"
                    "<LineString><coordinates>8.1,47.1 8.2,47.2</coordinates></LineString>"
                    "<LineString><coordinates>8.2,47.2 8.3,47.3</coordinates></LineString>"
                    "</MultiGeometry>"
                )
            )
        )
        self.assertEqual(
            route.coordinates, [(8.1, 47.1, None), (8.2, 47.2, None), (8.3, 47.3, None)]
        )

    def test_unconnected_lines_use_the_first_one(self):
        route = parse_kml(
            kml(
                placemark(
                    "<LineString><coordinates>8.1,47.1 8.2,47.2</coordinates></LineString>",
                    "A",
                )
                + placemark(
                    "<LineString><coordinates>8.1,47.1 8.0,47.0</coordinates></LineString>",
                    "B",
                )
            )
        )
        self.assertEqual(route.name, "A")
        self.assertEqual(route.coordinates, [(8.1, 47.1, None), (8.2, 47.2, None)])

    def test_points_only(self):
        with self.assertRaises(UserException):
            parse_kml(
                kml(placemark("<Point><coordinates>8.1,47.1</coordinates></Point>"))
            )

    def test_network_link_only(self):
        with self.assertRaisesRegex(UserException, "NetworkLink"):
            parse_kml(
                kml(
                    "<NetworkLink><Link><href>https://example.com/a.kml</href></Link></NetworkLink>"
                )
            )


class DocumentTest(unittest.TestCase):
    LINE = "<LineString><coordinates>8.1,47.1 8.2,47.2</coordinates></LineString>"

    def test_placemark_name_is_preferred(self):
        route = parse_kml(
            kml(
                "<Document><name>Document</name><Folder><name>Waypoints</name>"
                + placemark(
                    "<Point><coordinates>8.1,47.1</coordinates></Point>", "Start"
                )
                + "</Folder><Folder><name>Folder</name>"
                + placemark(self.LINE, "Route")
                + "</Folder></Document>"
            )
        )
        self.assertEqual(route.name, "Route")

    def test_name_falls_back_to_closest_container(self):
        body = f"<Folder><name>Folder</name><Placemark><name> </name>{self.LINE}</Placemark></Folder>"
        self.assertEqual(
            parse_kml(kml(f"<Document><name>Document</name>{body}</Document>")).name,
            "Folder",
        )
        self.assertEqual(
            parse_kml(
                kml(
                    f"<Document><name>Drawing</name><Placemark>{self.LINE}</Placemark></Document>"
                )
            ).name,
            "Drawing",
        )
        self.assertEqual(parse_kml(kml(f"<Placemark>{self.LINE}</Placemark>")).name, "")

    def test_name_with_cdata_and_entities(self):
        route = parse_kml(
            kml(placemark(self.LINE, "<![CDATA[Uetliberg <1>]]> &amp; Albis"))
        )
        self.assertEqual(route.name, "Uetliberg <1> & Albis")

    def test_namespaces(self):
        for attributes in [
            "",
            'xmlns="http://earth.google.com/kml/2.1"',
            'xmlns="http://www.opengis.net/kml/2.3"',
        ]:
            with self.subTest(attributes=attributes):
                self.assertEqual(
                    len(parse_kml(kml(placemark(self.LINE), attributes)).coordinates), 2
                )

        prefixed = (
            '<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Placemark><k:name>Route</k:name>'
            "<k:LineString><k:coordinates>8.1,47.1 8.2,47.2</k:coordinates></k:LineString>"
            "</k:Placemark></k:kml>"
        )
        self.assertEqual(parse_kml(prefixed).name, "Route")

    def test_placemark_as_root(self):
        self.assertEqual(len(parse_kml(placemark(self.LINE)).coordinates), 2)

    def test_byte_order_mark_and_comments(self):
        route = parse_kml(
            "﻿"
            + kml(
                placemark(
                    "<LineString><coordinates>8.1,47.1 <!-- comment --> 8.2,47.2</coordinates></LineString>"
                )
            )
        )
        self.assertEqual(len(route.coordinates), 2)

    def test_invalid_xml(self):
        with self.assertRaises(UserException):
            parse_kml("<kml><Placemark>")

    def test_doctype_is_rejected(self):
        with self.assertRaises(UserException):
            parse_kml(
                '<!DOCTYPE kml [<!ENTITY a "aaaa">]><kml>'
                + placemark(self.LINE, "&a;")
                + "</kml>"
            )


if __name__ == "__main__":
    unittest.main()
