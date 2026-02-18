"""Minimal HTTP wrapper around OCRmyPDF for text extraction from PDFs."""

import os
import tempfile
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

LANG = os.environ.get("OCR_LANG", "fra+eng")
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE_MB", "50")) * 1024 * 1024


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/extract/pdf", methods=["POST"])
def extract_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.pdf")
        output_path = os.path.join(tmpdir, "output.pdf")
        sidecar_path = os.path.join(tmpdir, "output.txt")

        file.save(input_path)

        if os.path.getsize(input_path) > MAX_FILE_SIZE:
            return jsonify({"error": f"File too large (max {MAX_FILE_SIZE // 1024 // 1024}MB)"}), 413

        try:
            result = subprocess.run(
                [
                    "ocrmypdf",
                    "--force-ocr",
                    "--sidecar", sidecar_path,
                    "-l", LANG,
                    "--jobs", "2",
                    input_path,
                    output_path,
                ],
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode != 0 and not os.path.exists(sidecar_path):
                return jsonify({
                    "error": "OCR failed",
                    "details": result.stderr,
                }), 500

            text = ""
            if os.path.exists(sidecar_path):
                with open(sidecar_path, "r", encoding="utf-8") as f:
                    text = f.read()

            return jsonify({
                "text": text,
                "pages": text.count("\f") + 1 if text else 0,
            })

        except subprocess.TimeoutExpired:
            return jsonify({"error": "OCR timeout"}), 504
        except Exception as e:
            return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
