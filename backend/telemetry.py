"""Application telemetry. Providers are owned by the FastAPI lifespan."""
import logging
import os
from contextvars import ContextVar

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

request_id = ContextVar("put_request_id", default="")


class Telemetry:
    def __init__(self):
        self.log = logging.Logger("put-backend", logging.INFO)
        self.log.addHandler(logging.NullHandler())
        self.providers = []
        tracer_provider = trace.NoOpTracerProvider()
        meter_provider = metrics.NoOpMeterProvider()
        if os.getenv("PUT_OTEL_ENABLED", "false").lower() == "true":
            if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"):
                raise ValueError("OTEL_EXPORTER_OTLP_ENDPOINT is required")
            resource = Resource.create({"service.name": "put-backend",
                                        "service.version": os.getenv("PUT_VERSION", "local"),
                                        "deployment.environment.name": os.getenv("PUT_ENV", "local")})
            tracer_provider = TracerProvider(resource=resource)
            tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(timeout=3)))
            reader = PeriodicExportingMetricReader(OTLPMetricExporter(timeout=3),
                                                   export_interval_millis=15000)
            meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
            logs = LoggerProvider(resource=resource)
            logs.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter(timeout=3)))
            self.log.addHandler(LoggingHandler(logger_provider=logs))
            self.providers = [logs, meter_provider, tracer_provider]
        self.tracer = tracer_provider.get_tracer("put.api")
        meter = meter_provider.get_meter("put.api")
        self.requests = meter.create_counter("put.http.requests")
        self.duration = meter.create_histogram("put.http.duration", unit="ms")
        self.events = meter.create_counter("put.events")

    def event(self, name):
        self.events.add(1, {"event": name})
        self.log.info(name, extra={"event": name, "request_id": request_id.get()})

    def close(self):
        for provider in self.providers:
            provider.shutdown()
