import logging
import threading
import time


class StatusHandler:

    def __init__(self):

        self.callback_status = {}
        self.callback_status_lock = threading.Lock()

    def update_status(self, uid: str, status: any):
        self.callback_status_lock.acquire()
        try:
            if type(uid) is not str or len(uid) == 0:
                raise Exception("Invalid user id")
            self.callback_status[uid] = {'status': status, 'last_change': time.time()}
        finally:
            self.callback_status_lock.release()

    def get_status(self, uid: str):
        self.callback_status_lock.acquire()
        try:
            if type(uid) is not str or len(uid) == 0:
                raise Exception("Invalid user id")
            if uid not in self.callback_status.keys():
                return None
            return self.callback_status[uid]
        finally:
            self.callback_status_lock.release()

    def remove_status(self, uid: str):
        self.callback_status_lock.acquire()
        try:
            if type(uid) is not str or len(uid) == 0:
                raise Exception("Invalid user id")
            if uid not in self.callback_status.keys():
                return
            del self.callback_status[uid]
        finally:
            self.callback_status_lock.release()


class StatusLogger(logging.StreamHandler):
    LOG_AS_STATUS = 25

    def __init__(self, status_handler: StatusHandler):
        super().__init__(self)
        self.status_handler = status_handler

    def emit(self, record):

        try:

            if record.levelno is not StatusLogger.LOG_AS_STATUS:
                return

            if 'uid' not in record.args.keys() and type(record.args['uid']) is not str:
                return

            msg = self.format(record)
            self.status_handler.update_status(str(record.args['uid']), msg)

        except:
            self.handleError(record)
