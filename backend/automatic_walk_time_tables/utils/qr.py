import requests
import os
import base64


def build_qr_code_image_string(uuid, raw: bool = False):
    backend_domain = os.environ["BACKEND_DOMAIN"]
    clear_url = f"{backend_domain}/gpx/{uuid}.gpx"
    b64_url = base64.b64encode(clear_url.encode("ascii")).decode("ascii")
    final_url = "https://swisstopo.app/u/" + b64_url
    r = requests.post(
        "https://backend.qr.cevi.tools/png",
        json={"text": final_url},
    )
    if r.status_code == 200:
        qr_code_bytes = r.content

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
        return ""  # TODO: does this work?
