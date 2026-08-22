from flask import Flask, Response
import json
import time
from collections import deque

event_queue = deque(maxlen=100)

def init_sse(app):
    """Initialize custom SSE without flask-sse."""
    @app.route('/stream')
    def stream():
        def event_stream():
            yield 'retry: 1000\n\n'
            while True:
                if event_queue:
                    event = event_queue.popleft()
                    yield f"event: {event['type']}\ndata: {json.dumps(event['data'])}\n\n"
                time.sleep(0.1)
        return Response(event_stream(), mimetype="text/event-stream")

def publish_event(event_type, data):
    event_queue.append({"type": event_type, "data": data})
    # No sse.publish here; we handle it manually via the stream