import logging


class Formatter(logging.Formatter):
    def format(self, record):

        if logging.getLogger(__name__).getEffectiveLevel() == logging.INFO:
            self._style._fmt = "[%(levelname)s] %(message)s"
        else:
            self._style._fmt = "[%(levelname)s] %(funcName)s at %(filename)s:%(lineno)d: %(message)s"
        return super().format(record)


def setup_recursive_logger(level: int, additionalLogger: logging.StreamHandler):
    default_handler = logging.StreamHandler()

    class RecursiveLogger(logging.getLoggerClass()):
        def __init__(self, name: str):
            logging.Logger.__init__(self, name=name)

            # SetLevel
            self.setLevel(level)

            # Add Custom Handler
            default_handler.setFormatter(Formatter())
            self.addHandler(default_handler)

            additionalLogger.setFormatter(Formatter())
            self.addHandler(additionalLogger)

    logging.setLoggerClass(RecursiveLogger)
