# Lokaler Testserver: liefert die Dateien aus und speichert gerenderte Bilder unter ausgabe/.
import re, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        m = re.fullmatch(r"/speichern/([a-z0-9_-]+\.png)", self.path)
        if not m:
            self.send_error(404); return
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        os.makedirs("ausgabe", exist_ok=True)
        with open(os.path.join("ausgabe", m.group(1)), "wb") as f:
            f.write(data)
        self.send_response(204); self.end_headers()
    def end_headers(self):
        # Never cache: edited modules must reach the browser on the next reload.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a): pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8767), Handler).serve_forever()
