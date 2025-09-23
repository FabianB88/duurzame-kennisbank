#!/usr/bin/env python3
"""
A very simple web server to act as a knowledge bank for sustainability resources.

This server uses only Python's built‑in libraries to avoid external
dependencies. It provides a minimal REST API for fetching and uploading
resources as well as serving static pages and uploaded files. Resources are
stored in a JSON file on disk (``data.json``) and uploaded files are saved
to the ``uploads`` directory.

Endpoints:

* ``/`` – The home page with a search wizard.
* ``/upload`` – The page containing a form for uploading new resources.
* ``/resources`` – A page listing all resources with simple filtering.
* ``/api/resources`` – Returns JSON list of resources with optional query
  parameters ``q`` (search string), ``type`` (resource type) and ``tag``.
* ``/api/upload`` – Accepts POST multipart/form‑data for uploading new
  resources.
* ``/static/...`` – Serves CSS and JavaScript assets.
* ``/uploads/...`` – Serves uploaded files.

The server listens on the port defined by the ``PORT`` environment
variable, defaulting to 8000. It intentionally avoids any external network
calls so that it can run in restricted environments.
"""

from __future__ import annotations

import json
import os
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
from io import BytesIO
import cgi
import shutil


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')


def load_data() -> list[dict]:
    """Load the resources from the JSON file. Returns an empty list if the
    file does not exist or cannot be parsed."""
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []


def save_data(resources: list[dict]) -> None:
    """Write the given list of resources to the JSON file."""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(resources, f, ensure_ascii=False, indent=2)


class KnowledgeBankHandler(SimpleHTTPRequestHandler):
    """Custom request handler implementing a minimal REST API and serving
    static pages.

    The handler inherits from ``SimpleHTTPRequestHandler`` so that it can
    reuse the static file serving functionality. It overrides ``do_GET``
    and ``do_POST`` to implement additional API endpoints.
    """

    def end_headers(self) -> None:
        """Set common headers for all responses."""
        # Allow CORS for frontend fetch calls running on the same origin.
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Serve API endpoint for listing resources
        if path == '/api/resources':
            resources = load_data()
            # Filter by search query
            if 'q' in query and query['q']:
                term = query['q'][0].lower()
                resources = [r for r in resources if term in r.get('title', '').lower() or term in r.get('description', '').lower()]
            # Filter by type
            if 'type' in query and query['type'] and query['type'][0]:
                rtype = query['type'][0].lower()
                resources = [r for r in resources if r.get('type', '').lower() == rtype]
            # Filter by tag
            if 'tag' in query and query['tag'] and query['tag'][0]:
                tag = query['tag'][0].lower()
                resources = [r for r in resources if tag in [t.lower() for t in r.get('tags', [])]]
            self.respond_json(resources)
            return

        # Serve frontend pages
        if path == '/':
            return self.serve_asset('templates/index.html', 'text/html')
        if path == '/upload':
            return self.serve_asset('templates/upload.html', 'text/html')
        if path == '/resources':
            return self.serve_asset('templates/resources.html', 'text/html')

        # Serve static files from the project directory
        if path.startswith('/static/') or path.startswith('/uploads/'):
            # Use the base class static file handler
            return super().do_GET()

        # Default: 404
        self.send_error(404, 'Not Found')

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/upload':
            # Ensure upload directory exists
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            # Use FieldStorage for easier multipart parsing
            form = cgi.FieldStorage(fp=self.rfile,
                                    headers=self.headers,
                                    environ={'REQUEST_METHOD': 'POST',
                                             'CONTENT_TYPE': self.headers['Content-Type']})
            title = form.getfirst('title', '').strip()
            description = form.getfirst('description', '').strip()
            rtype = form.getfirst('type', '').strip()
            tags_raw = form.getfirst('tags', '').strip()
            url_field = form.getfirst('url', '').strip()
            tags = [t.strip() for t in tags_raw.split(',') if t.strip()]
            filename = None
            # Handle file upload
            file_item = form['file'] if 'file' in form else None
            if file_item and file_item.filename:
                # Sanitize filename
                original_name = os.path.basename(file_item.filename)
                # Ensure unique filename by prefixing with a number if needed
                base_name, ext = os.path.splitext(original_name)
                dest_name = original_name
                counter = 1
                dest_path = os.path.join(UPLOAD_DIR, dest_name)
                while os.path.exists(dest_path):
                    dest_name = f"{base_name}_{counter}{ext}"
                    dest_path = os.path.join(UPLOAD_DIR, dest_name)
                    counter += 1
                with open(dest_path, 'wb') as f:
                    shutil.copyfileobj(file_item.file, f)
                filename = dest_name

            # Construct resource entry
            resource = {
                'title': title or (file_item.filename if (file_item and file_item.filename) else ''),
                'description': description,
                'type': rtype,
                'tags': tags,
                'url': url_field,
                'file': filename,
            }
            resources = load_data()
            resources.append(resource)
            save_data(resources)
            # Respond with created resource
            self.send_response(201)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(resource).encode('utf-8'))
            return

        # Unknown POST endpoint
        self.send_error(404, 'Not Found')

    # Helper methods
    def serve_asset(self, relative_path: str, content_type: str) -> None:
        """Serve a file relative to the project root with the given content type."""
        full_path = os.path.join(BASE_DIR, relative_path)
        if not os.path.isfile(full_path):
            self.send_error(404, 'Not Found')
            return
        try:
            with open(full_path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_error(500, 'Internal Server Error')

    def respond_json(self, obj) -> None:
        """Send a JSON response."""
        data = json.dumps(obj).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_server() -> None:
    """Start the HTTP server."""
    port = int(os.environ.get('PORT', '8000'))
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    server = HTTPServer(('', port), KnowledgeBankHandler)
    print(f"Server running on port {port}...")
    server.serve_forever()


if __name__ == '__main__':
    run_server()