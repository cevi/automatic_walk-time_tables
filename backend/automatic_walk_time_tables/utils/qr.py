import requests
import os
import base64
import logging
from http.client import IncompleteRead


def build_qr_url(uuid):
    backend_domain = os.environ["BACKEND_DOMAIN"]
    clear_url = f"{backend_domain}/gpx/{uuid}.gpx"
    b64_url = base64.b64encode(clear_url.encode("ascii")).decode("ascii")
    return "https://swisstopo.app/u/" + b64_url


def build_qr_code_image_string(uuid, raw: bool = False):
    final_url = build_qr_url(uuid)
    try:
        r = requests.post(
            "https://backend.qr.cevi.tools/png",
            json={"text": final_url},
            timeout=(3.05, 10),
        )
    except requests.exceptions.RequestException:
        logging.exception(
            "Failed to request QR backend for UUID=%s URL=%s",
            uuid,
            "https://backend.qr.cevi.tools/png",
        )
        return b"" if raw else ""
    except IncompleteRead:
        logging.exception(
            "IncompleteRead while requesting QR backend for UUID=%s", uuid
        )
        return b"" if raw else ""

    def _is_image(content: bytes, content_type: str | None) -> bool:
        if not content:
            return False
        if content_type and content_type.startswith("image/"):
            return True
        # Check magic bytes for PNG
        if content.startswith(b"\x89PNG\r\n\x1a\n"):
            return True
        return False

    if r.status_code == 200:
        qr_code_bytes = r.content

        content_type = r.headers.get("Content-Type") if hasattr(r, "headers") else None

        if not _is_image(qr_code_bytes, content_type):
            logging.debug(
                "QR backend returned non-image content for UUID=%s content_type=%s content_len=%s",
                uuid,
                content_type,
                len(qr_code_bytes) if qr_code_bytes is not None else 0,
            )
            return b"" if raw else ""

        if raw:
            # if raw, only return the qr code image bytes
            return qr_code_bytes

        else:
            # Convert the byte string to a base64-encoded string
            base64_encoded = base64.b64encode(qr_code_bytes).decode("utf-8")

            # Add the appropriate prefix for embedding in a webpage as a data URL
            data_url = f"data:image/png;base64,{base64_encoded}"

            # Print or return the data URL
            return data_url

    else:
        logging.debug("QR backend returned status %s for UUID=%s", r.status_code, uuid)
        return b"" if raw else ""  # no QR code
