import sys
import os.path
import json
import oblivious
import mr4mp
from flask import Flask, send_file, request, jsonify

import nthassociates

session = nthassociates.session()

app = Flask(__name__)

# Contribute masked data.
global data_srv
data_srv = None
with open('data-service.json') as test_file:
    data_srv = json.load(test_file)

@app.route("/enrich", methods=['POST', 'GET'])
def enrich():
    global data_srv

    req = request.get_json()

    if req is not None:
        if 'step_one' in req:
            req = req['step_one']

            data_masked_at_cli_masked_at_srv = mr4mp.mapconcat(
                nthassociates.protocol.enrich_step_one,
                [(v, session) for v in req['data@cli;masked@cli']]
            )

            data_srv_masked = mr4mp.mapconcat(
                nthassociates.protocol.enrich_step_two,
                [(v, session) for v in data_srv]
            )

            return jsonify({
              "data@cli;masked@cli;masked@srv": data_masked_at_cli_masked_at_srv,
              "data@srv;masked@srv": data_srv_masked
            })

        if 'step_two' in req:
            req = req['step_two']

            reply_ks = []

            data_srv = req["data@srv;masked@srv;masked@cli"]

            data_srv = mr4mp.mapconcat(
                nthassociates.protocol.enrich_step_three,
                [(v, session) for v in data_srv]
            )

            data_srv = [[p, k] for [p, k] in data_srv if p in req["data@cli;masked@cli"]]

            req["data@srv;masked@srv;masked@cli"] = data_srv            

            return jsonify({"final": data_srv})

    return jsonify({"status": "nothing"})

@app.route("/<path:file_name>")
def index(file_name):
    if file_name != "favicon.ico":
        return send_file(file_name)
    return ''

if __name__ == "__main__":
    # Start the service.
    app.run(host='0.0.0.0', port=8080)
