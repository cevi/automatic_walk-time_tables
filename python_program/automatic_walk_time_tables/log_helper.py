import logging

class Formatter(logging.Formatter):
    def format(self, record):
        if logging.getLogger(__name__).getEffectiveLevel() == logging.INFO:
            self._style._fmt = "[%(levelname)s] %(message)s"
        else:
            self._style._fmt = "[%(levelname)s] %(funcName)s at %(filename)s:%(lineno)d: %(message)s"
        return super().format(record)