/**
 * stream_grabber.py
 *
 * Threaded frame grabber for live video feeds.
 * Solves the OpenCV internal buffer build-up lag by reading frames continually in a
 * background thread and only returning the most recent frame.
 */

import cv2
import threading
import time
import logging

logger = logging.getLogger(__name__)

class ThreadedVideoStream:
    def __init__(self, src):
        self.src = src
        self.stream = cv2.VideoCapture(src)
        self.grabbed = False
        self.frame = None
        self.stopped = False
        self.lock = threading.Lock()
        self.thread = None

        # Try to read the first frame synchronously
        if self.stream.isOpened():
            self.grabbed, self.frame = self.stream.read()

    def start(self):
        self.stopped = False
        self.thread = threading.Thread(target=self.update, args=(), name=f"Grabber-{self.src}")
        self.thread.daemon = True
        self.thread.start()
        return self

    def update(self):
        while not self.stopped:
            if not self.stream.isOpened():
                self.grabbed = False
                break

            grabbed, frame = self.stream.read()
            if not grabbed:
                # End of stream or error
                with self.lock:
                    self.grabbed = False
                break

            with self.lock:
                self.grabbed = grabbed
                self.frame = frame

            # Yield CPU briefly to prevent thread spin starvation
            time.sleep(0.002)

    def read(self):
        with self.lock:
            return self.grabbed, self.frame

    def isOpened(self):
        return self.stream.isOpened()

    def release(self):
        self.stopped = True
        if self.thread:
            self.thread.join(timeout=1.0)
        if self.stream:
            self.stream.release()
        logger.info(f"ThreadedVideoStream released for src: {self.src}")
