class SwissName:
    def __init__(self, name, object_type, x, y, h):
        self.name = name
        self.object_type = object_type
        self.x = int(x)
        self.y = int(y)
        self.h = int(h)

    def __str__(self):
        return self.name + " (" + self.object_type + " | " + str(self.x) + ", " + str(self.y) + ")"

    def __repr__(self):
        return self.__str__()
