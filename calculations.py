# calculates the time form one point to another
# for this calculation the basic formula form Jugend+Sport is used for preciser we could use the formula
# form SchweizMobil or use more way points. But since we want to create a "normal" walk table as specified by
# Jugend+Sport we use there basic formula
def calcTime(delta_height, delta_dist, speed):
    if delta_height is None or delta_dist is None:
        return 0

    return (delta_dist + (delta_height / 100 if delta_height > 0 else 0)) / speed
