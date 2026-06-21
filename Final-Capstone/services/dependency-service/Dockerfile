# Build stage
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt ./
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Run stage
FROM python:3.11-slim
RUN adduser --disabled-password --gecos "" appuser
WORKDIR /app
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*
COPY app ./app
RUN mkdir -p /app/.backend-logs/tmp && chown -R appuser:appuser /app
USER appuser
EXPOSE 8005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]
