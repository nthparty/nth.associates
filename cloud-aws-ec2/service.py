from flask import Flask, send_file, request, jsonify

import nthassociates

session = nthassociates.session(path='data-service.json')

app = Flask(__name__)

@app.route("/enrich", methods=['POST', 'GET'])
def enrich():
    request_ = request.get_json()
    reply = nthassociates.protocol.step(session, request_)
    return jsonify({"status": "nothing"} if reply is None else reply)

@app.route("/<path:file_name>")
def index(file_name):
    if file_name != "favicon.ico":
        return send_file(file_name)
    return ''

if __name__ == "__main__":
    # Start the service.
    app.run(host='0.0.0.0', port=8080)
