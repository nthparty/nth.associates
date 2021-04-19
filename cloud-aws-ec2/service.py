from flask import Flask, send_file, request, jsonify
from progress import Progress

import nthassociates

session = nthassociates.session(path='data-service.json')

stages_progress = [Progress(stages=33), Progress(stages=33), Progress(stages=34)]

app = Flask(__name__)

@app.route("/enrich", methods=['POST', 'GET'])
def enrich():
    request_ = request.get_json()
    reply = nthassociates.protocol.reply(session, request_, stages_progress)
    return jsonify({"status": "nothing"} if reply is None else reply)

@app.route("/<path:file_name>")
def index(file_name):
    if file_name != "favicon.ico":
        return send_file(file_name)
    return ''

@app.route('/status')
def get_status():
    json = '{"progress": [%s, %s, %s]}' % tuple(stages_progress)
    return json, 206

if __name__ == "__main__":
    # Start the service.
    app.run(host='0.0.0.0', port=8080)
