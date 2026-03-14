FROM python:3.14-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies in a separate layer for caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/data/chroma && \
    chown -R appuser:appuser /app
USER appuser

# ChromaDB persistent data
VOLUME ["/app/data/chroma"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" || exit 1

CMD ["uvicorn", "src.api.routes:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
