"""
Functionalities and data structures for the nth.associates
secure data association and enrichment service-side component.
"""
import base64
import json
import mr4mp
import oblivious
import bcl

class protocol:
    """
    Functions to be applied in parallel to data sets
    being processed at each step of the protocol.
    """
    @staticmethod
    def mask_client_row(value_scalar):
        """
        Mask each row supplied by the client.
        """
        (value, session_) = value_scalar
        point = oblivious.point(base64.standard_b64decode(value))
        return [[base64.standard_b64encode(session_.scalar * point).decode('utf-8')]]

    @staticmethod
    def enrich_client_row(value_scalar):
        """
        Extend each client row with new (encrypted) data and a masked
        key for decrypting it.
        """
        (value, session_) = value_scalar
        secret_key = oblivious.point()
        secret_key_masked = session_.scalar_for_key * secret_key
        point = oblivious.point.hash(value[0].encode())
        row = value
        row[0] = base64.standard_b64encode(session_.scalar * point).decode('utf-8')
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
        """
        Unmask the key corresponding to a matching row, allowing
        the receiving party to decrypt matching rows.
        """
        ((p, k), session_) = value_scalar
        return [[
            base64.standard_b64encode(
                ~session_.scalar * oblivious.point(base64.standard_b64decode(p))
            ).decode('utf-8'),
            base64.standard_b64encode(
                ~session_.scalar_for_key * oblivious.point(base64.standard_b64decode(k))
            ).decode('utf-8')
        ]]

    @staticmethod
    def reply(session_, request):
        """
        Handler for HTTP requests supplied by the client
        in JSON format (for each protocol step).
        """
        if 'step_one' in request:
            req = request['step_one']

            data_masked_at_cli_masked_at_srv = mr4mp.mapconcat(
                protocol.mask_client_row,
                [(v, session_) for v in req['data@cli;masked@cli']]
            )

            data_srv_masked = mr4mp.mapconcat(
                protocol.enrich_client_row,
                [(v, session_) for v in session_.data]
            )

            return {
              "data@cli;masked@cli;masked@srv": data_masked_at_cli_masked_at_srv,
              "data@srv;masked@srv": data_srv_masked
            }

        if 'step_two' in request:
            req = request['step_two']

            data_srv = req["data@srv;masked@srv;masked@cli"]

            data_srv = mr4mp.mapconcat(
                protocol.unlock_service_row_key,
                [(v, session_) for v in data_srv]
            )

            data_srv = [[p, k] for [p, k] in data_srv if p in req["data@cli;masked@cli"]]

            return {"keys@srv": data_srv}

        return None

class session: # pylint: disable=R0903
    """
    Data structure for an enrichment session.
    """
    def __init__(self, path=None):
        """
        Create a session instance.
        """
        self.scalar = oblivious.scalar()
        self.scalar_for_key = oblivious.scalar()
        self.path = path
        self.data = None

        if self.path is not None:
            with open(self.path, encoding='utf-8') as path_file:
                self.data = json.load(path_file)
