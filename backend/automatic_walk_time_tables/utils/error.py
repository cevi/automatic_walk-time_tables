class UserException(Exception):
    pass


class ElevationServiceUnavailable(Exception):
    """geo.admin.ch could not deliver an elevation profile (rate limit, outage, timeout)."""

    MESSAGE = (
        "Die Höhendaten von swisstopo sind momentan nicht verfügbar. "
        "Bitte versuche es in ein paar Sekunden erneut."
    )

    def __init__(self, reason: str = "") -> None:
        super().__init__(reason or self.MESSAGE)
