
# Berechnet die Marschzeit zwischen zwei Punkten.
def calcTime(delta_height, delta_dist, speed):

    if delta_height is None or delta_dist is None:
        return 0

    return (delta_dist + (delta_height / 100 if delta_height > 0 else 0)) / speed
