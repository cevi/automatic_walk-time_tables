import logging

from status_handler import ExportStateLogger


class Formatter(logging.Formatter):
    def format(self, record):

        uuid_info: str = ' '
        if 'uuid' in record.args and type(record.args['uuid']) is str:
            uuid_info = ' [uuid=' + str(record.args['uuid']) + '] '

        if logging.getLogger(__name__).getEffectiveLevel() in (logging.INFO, ExportStateLogger.REQUESTABLE):
            self._style._fmt = "[%(levelname)s]" + uuid_info + "%(message)s"
        else:
            self._style._fmt = "[%(levelname)s] " + uuid_info + "%(funcName)s at %(filename)s:%(lineno)d: %(message)s"
        return super().format(record)


class StateFormatter(logging.Formatter):
    def format(self, record):
        if logging.getLogger(__name__).getEffectiveLevel() == ExportStateLogger.REQUESTABLE:
            self._style._fmt = "[%(levelname)s] %(message)s"
        return super().format(record)


def setup_recursive_logger(level: int, state_logger: logging.StreamHandler = None):
    default_handler = logging.StreamHandler()

    class RecursiveLogger(logging.getLoggerClass()):
        def __init__(self, name: str):
            logging.Logger.__init__(self, name=name)

            # SetLevel
            self.setLevel(level)

            # Add Custom Handler
            default_handler.setFormatter(Formatter())
            self.addHandler(default_handler)

            if state_logger is not None:
                state_logger.setFormatter(StateFormatter())
                self.addHandler(state_logger)

    logging.setLoggerClass(RecursiveLogger)
