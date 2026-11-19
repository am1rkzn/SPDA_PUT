import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from opentelemetry.proto.collector.logs.v1.logs_service_pb2 import ExportLogsServiceRequest
from opentelemetry.proto.collector.metrics.v1.metrics_service_pb2 import ExportMetricsServiceRequest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest

from backend.main import app


class ExportTest(unittest.TestCase):
    def test_export_after_commit_and_replays(self):
        batches = {"/v1/logs": [], "/v1/metrics": [], "/v1/traces": []}

        class Receiver(BaseHTTPRequestHandler):
            def do_POST(self):
                batches[self.path].append(self.rfile.read(int(self.headers["Content-Length"])))
                self.send_response(200)
                self.end_headers()

            def log_message(self, *args):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), Receiver) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ,
                        PUT_DB_PATH=str(Path(directory) / "put.sqlite"), PUT_OTEL_ENABLED="true",
                        OTEL_EXPORTER_OTLP_ENDPOINT=f"http://127.0.0.1:{server.server_port}"), TestClient(app) as client:
                    headers = {"Idempotency-Key": str(uuid4())}
                    body = {"bike_id": "b1", "route_id": "r1"}
                    rid = client.post("/api/rental", json=body, headers=headers).json()["id"]
                    client.post("/api/rental", json=body, headers=headers)
                    for _ in range(2):
                        client.post("/api/rental/finish", json={"rental_id": rid})
            finally:
                server.shutdown()
                thread.join()

        logs = [record for raw in batches["/v1/logs"]
                for resource in ExportLogsServiceRequest.FromString(raw).resource_logs
                for scope in resource.scope_logs for record in scope.log_records]
        for event in ("rental_started", "rental_finished"):
            self.assertEqual(sum(r.body.string_value == event for r in logs), 1)
        spans = [span for raw in batches["/v1/traces"]
                 for resource in ExportTraceServiceRequest.FromString(raw).resource_spans
                 for scope in resource.scope_spans for span in scope.spans]
        trace_ids = {span.trace_id for span in spans}
        self.assertTrue(all(r.trace_id and r.trace_id in trace_ids for r in logs))
        measures = {metric.name: metric for raw in batches["/v1/metrics"]
                    for resource in ExportMetricsServiceRequest.FromString(raw).resource_metrics
                    for scope in resource.scope_metrics for metric in scope.metrics}
        self.assertEqual(sum(p.as_int for p in measures["put.http.requests"].sum.data_points), 4)
        self.assertEqual(sum(p.as_int for p in measures["put.events"].sum.data_points), 2)
        self.assertIn("put.http.duration", measures)
