import logging
import threading
from datetime import datetime

from automatic_walk_time_tables.generator_status import GeneratorStatus


class ExportStateHandler:
    """

    Keeps track of state of currently running and passed exports.
    States can be accessed by the uuid. The implementation should be thread save.

    A status is a dict with tree fields: 'status', 'message' and 'last_change'.

    """

    def __init__(self):

        self.states = {}
        self.lock = threading.Lock()

    def update_status(self, uuid: str, status: any, msg: str, route=None):
        """

        Updates the status with the corresponding uuid.
        If no state for the passed uuid is found, it will create a new one.

        """

        self.lock.acquire()
        try:
            if type(uuid) is not str or len(uuid) == 0:
                raise Exception("Invalid uuid")

            # Update History
            history = []
            if uuid in self.states.keys():
                history = self.states[uuid]['history']

                old_state = self.states[uuid].copy()
                del old_state['history']
                history.append(old_state)

            self.states[uuid] = {
                'status': status,
                'message': msg,
                'last_change': datetime.now().strftime("%H:%M:%S"),
                'route': {} if route is None else route,
                'history': history
            }

        finally:
            self.lock.release()

    def get_status(self, uuid: str):
        """

        Returns the status dict of the corresponding uuid.

        """
        self.lock.acquire()
        try:
            if type(uuid) is not str or len(uuid) == 0:
                raise Exception("Invalid uuid")
            if uuid not in self.states.keys():
                return {
                    'status': GeneratorStatus.ERROR,
                    'message': 'Status zu dieser ID ist unbekannt.',
                    'last_change': datetime.now().strftime("%H:%M:%S")
                }
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
                raise Exception("Invalid uuid")
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

            route = None
            if 'route' in record.args.keys():
                route = str(record.args['route'])

            msg = self.format(record)
            self.status_handler.update_status(str(record.args['uuid']), status, msg, route=route)

        except:
            self.handleError(record)
