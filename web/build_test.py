import sys
import os.path
from flask import Flask, send_file

import build

app = Flask(__name__)

@app.route("/<path:file_name>")
def index(file_name):
    if file_name != "favicon.ico":
        return send_file(os.path.join("dist", file_name))

if __name__ == "__main__":
    # Build an instance of the application.
    build.dist("nth.associates" if len(sys.argv) != 2 else sys.argv[1])

    # Start the service.
    app.run()
