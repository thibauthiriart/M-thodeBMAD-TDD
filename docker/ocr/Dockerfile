FROM jbarlow83/ocrmypdf:latest

USER root

# Install pip, Flask, Gunicorn + French language pack
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-pip \
    tesseract-ocr-fra \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Flask and Gunicorn into the existing venv
RUN pip3 install --no-cache-dir --break-system-packages --target=/app/.venv/lib/python3.13/site-packages flask gunicorn

WORKDIR /app
COPY server.py .

EXPOSE 8000

# Override OCRmyPDF entrypoint to run our HTTP wrapper instead
ENTRYPOINT []
CMD ["/app/.venv/bin/python3", "-m", "gunicorn", "--bind", "0.0.0.0:8000", "--timeout", "300", "--workers", "2", "server:app"]
