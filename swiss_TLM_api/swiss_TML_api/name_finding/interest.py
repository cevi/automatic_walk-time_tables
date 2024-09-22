import csv
from typing import List

from swiss_TML_api.name_finding.name_finder import NameFinder
from swiss_TML_api.name_finding.swiss_name import SwissName


def distance_falloff(distance):
    return (distance /1000 - 1) ** 4


class Interest:
    def __init__(self, name_finder: NameFinder):
        self.interest = {}
        self.name_finder = name_finder
        with open("point_valuation.csv", mode='r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                self.interest[row["object_type"]] = int(row["interest"])
            print(reader.fieldnames)

    def value_point(self, position, point: SwissName):
        distance = ((position[0] - point.x) ** 2 + (position[1] - point.y) ** 2) ** 0.5
        if distance > 150:
            return 0
        object_type_interest = self.interest.get(point.object_type)
        if object_type_interest is None:
            print(f"Object type {point.object_type} not found in point_valuation.csv")
            return 1
        interest = object_type_interest * distance_falloff(distance)
        print(f"Point {point.name} has distance {distance} and interest {interest}")
        return interest
    def select_name(self, position):
        points = self.name_finder.get_names(position[0], position[1], 15)
        points.sort(key=lambda x: self.value_point(position, x), reverse=True)
        if self.value_point(position, points[0]) < 1:
            return SwissName("", "Coordinates", position[0], position[1], 0, 0)
        return points[0]

