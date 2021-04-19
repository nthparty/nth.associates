"""Service functionalities for nth.associates.

Functionalities and data structures for the nth.associates
secure data association and enrichment service-side component.
"""

import base64
import json
import mr4mp
import oblivious
import bcl

class protocol:
    @staticmethod
    def mask_client_row(value_scalar):
        (value, session) = value_scalar
        point = oblivious.point(base64.standard_b64decode(value)) 
        return [[base64.standard_b64encode(session.scalar * point).decode('utf-8')]]

    @staticmethod
    def enrich_client_row(value_scalar):
        (value, session) = value_scalar
        secret_key = oblivious.point()
        secret_key_masked = session.scalar_for_key * secret_key
        point = oblivious.point.hash(value[0].encode())
        row = value
        row[0] = base64.standard_b64encode(session.scalar * point).decode('utf-8')
        row.extend([
            base64.standard_b64encode(secret_key_masked).decode('utf-8'),
            base64.standard_b64encode(
                bcl.symmetric.encrypt(secret_key, row[1].encode())
            ).decode('utf-8'),
            base64.standard_b64encode(
                bcl.symmetric.encrypt(secret_key, row[2].encode())
            ).decode('utf-8')
        ])
        return [row]

    @staticmethod
    def unlock_service_row_key(value_scalar):
        ((p, k), session) = value_scalar
        return [[
            base64.standard_b64encode(
                ~session.scalar * oblivious.point(base64.standard_b64decode(p))
            ).decode('utf-8'), 
            base64.standard_b64encode(
                ~session.scalar_for_key * oblivious.point(base64.standard_b64decode(k))
            ).decode('utf-8')
        ]]

    @staticmethod
    def reply(session, request, progress):
        if 'step_one' in request:
            req = request['step_one']

            progress[0].reset()

            data_masked_at_cli_masked_at_srv = mr4mp.mapconcat(
                protocol.mask_client_row,
                [(v, session) for v in req['data@cli;masked@cli']],
                progress=progress[0].hook,
                stages=progress[0].stages
            )

            progress[1].reset()

            data_srv_masked = mr4mp.mapconcat(
                protocol.enrich_client_row,
                [(v, session) for v in session.data],
                progress=progress[1].hook,
                stages=progress[1].stages
            )

            return {
              "data@cli;masked@cli;masked@srv": data_masked_at_cli_masked_at_srv,
              "data@srv;masked@srv": data_srv_masked
            }

        if 'step_two' in request:
            req = request['step_two']
            
            progress[2].reset()

            data_srv = req["data@srv;masked@srv;masked@cli"]

            data_srv = mr4mp.mapconcat(
                protocol.unlock_service_row_key,
                [(v, session) for v in data_srv],
                progress=progress[2].hook,
                stages=progress[2].stages
            )

            data_srv = [[p, k] for [p, k] in data_srv if p in req["data@cli;masked@cli"]]

            return {"keys@srv": data_srv}

        return None

class session:
    def __init__(self, path=None):
        self.scalar = oblivious.scalar()
        self.scalar_for_key = oblivious.scalar()
        self.path = path
        self.data = None
        
        if self.path is not None:
            with open(self.path) as path_file:
                self.data = json.load(path_file)
