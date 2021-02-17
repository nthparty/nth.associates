"""Service functionalities for nth.associates.

Functionalities and data structures for the nth.associates
secure data association and enrichment service-side component.
"""

import base64
import json
import oblivious
import bcl

class protocol:
    @staticmethod
    def enrich_step_one(value_scalar):
        (value, session) = value_scalar
        point = oblivious.point(base64.standard_b64decode(value)) 
        return [[base64.standard_b64encode(session.scalar * point).decode('utf-8')]]

    @staticmethod
    def enrich_step_two(value_scalar):
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
    def enrich_step_three(value_scalar):
        ((p, k), session) = value_scalar
        return [[
            base64.standard_b64encode(
                ~session.scalar * oblivious.point(base64.standard_b64decode(p))
            ).decode('utf-8'), 
            base64.standard_b64encode(
                ~session.scalar_for_key * oblivious.point(base64.standard_b64decode(k))
            ).decode('utf-8')
        ]]

class session:
    def __init__(self, path=None):
        self.scalar = oblivious.scalar()
        self.scalar_for_key = oblivious.scalar()
        self.path = path
        self.data = None
        
        if self.path is not None:
            with open(self.path) as path_file:
                self.data = json.load(path_file)
