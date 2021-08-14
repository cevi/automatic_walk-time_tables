import fiona

shape = fiona.open("res/swissnames3d_2021_2056.shp")
print(shape.schema)
