import logging
import threading
import time


class ExportStateHandler:
    """

    Keeps track of state of currently running and passed exports.
    States can be accessed by the uuid. The implementation should be thread save.

    A status is a dict with tree fields: 'status', 'message' and 'last_change'.

    """

    def __init__(self):

        self.states = {}
        self.lock = threading.Lock()

    def update_status(self, uuid: str, status: any, msg: str):
        """

        Updates the status with the corresponding uuid.
        If no state for the passed uuid is found, it will create a new one.

        """
        self.lock.acquire()
        try:
            if type(uuid) is not str or len(uuid) == 0:
                raise Exception("Invalid user id")
            self.states[uuid] = {'status': status, 'message': msg, 'last_change': time.time()}
        finally:
            self.lock.release()

    def get_status(self, uuid: str):
        """

        Returns the status dict of the corresponding uuid.

        """
        self.lock.acquire()
        try:
            if type(uuid) is not str or len(uuid) == 0:
                raise Exception("Invalid user id")
            if uuid not in self.states.keys():
                return None
            return self.states[uuid]
        finally:
            self.lock.release()

    def remove_status(self, uuid: str):
        """

        Remove the state of the uuid.

        """
        self.lock.acquire()
        try:
            if type(uuid) is not str or len(uuid) == 0:
                raise Exception("Invalid user id")
            if uuid not in self.states.keys():
                return
            del self.states[uuid]
        finally:
            self.lock.release()


class ExportStateLogger(logging.StreamHandler):
    """

    Special logger that updates the export state identified by an uuid.
    The end user can access the current state by requesting '/status/uuid'

    """

    REQUESTABLE = 200
    """
    
    Saves the log message and state in the ExportStateHandler.
    All logs published at level can potentially be accessed by the end user!
    
    """

    def __init__(self, status_handler: ExportStateHandler):
        super().__init__(self)
        self.status_handler = status_handler

    def emit(self, record):

        try:

            if record.levelno is not ExportStateLogger.REQUESTABLE:
                return

            if 'uuid' not in record.args.keys() or type(record.args['uuid']) is not str:
                return

            status = 'unknown'
            if 'status' in record.args.keys() and type(record.args['status']) is str:
                status = str(record.args['status'])

            msg = self.format(record)
            self.status_handler.update_status(str(record.args['uuid']), status, msg)

        except:
            self.handleError(record)
