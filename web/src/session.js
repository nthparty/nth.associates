/*
 * Encapsulated session state (for an individual session) and methods
 * to create payloads for each step in a session.
 */
function Session(app, state, selfRoles) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // Internal.
  require('Protocol');

  /* Internal object attributes. */

  this.app = app;
  this.state = state;
  this.roles = selfRoles;
  this.id = state.idSelf();
  this.other = { // State of other contributor.
    "id": state.idOther(),
    "data": {},
    "roles": []
  }
  this.protocol = new Protocol(app, state);
  this.data = {};

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.prepareSelfData = async function (data) {
    // Turn rows into strings, deduplicate them, and hash them to points.
    let arrayOfStrs = data.map(self.protocol.arrayOfStrToStr);

    // Exclude first row if it is designated as a header row by the user.
    if (self.app.data.rowFirstExclude()) {
      arrayOfStrs.shift();
    }

    let ss = self.protocol.deduplicateStrs(arrayOfStrs);
    let points = await self.app.mapAsyncWithProgress(self.protocol.strToPoint, ss);

    self.data = {
      "clear": data,
      "points": points
    };

    return true;
  };

  this.stepZero = async function () {
    var stepResult = {
      "roles": self.roles,
      "data": {
        "keyed": {},
        "masked": {}
      }
    };

    // Update the progress bar modal message.
    self.app.progress.message("Encrypting data for analysis.");

    // If we are not the recipient, prepare own keyed data for transmission.
    if (!self.roles.includes("recipient")) {
      // Encrypt the data using own key.
      stepResult.data.keyed = await self.app.mapAsyncWithProgress(self.protocol.keyEncode, self.data.points);

      // Display the encrypted data for the user.
      self.app.sheets.self.data(stepResult.data.keyed, true);
    }

    // If we are the recipient, prepare own masked data for transmission.
    if (self.roles.includes("recipient")) {
      // Encrypt the data using own mask.
      self.data.masked = await self.app.mapAsyncWithProgress(self.protocol.maskEncode, self.data.points);
      stepResult.data.masked = self.data.masked;

      // Display the encrypted data for the user.
      self.app.sheets.self.data(stepResult.data.masked, true);
    }

    return stepResult;
  };

  this.stepOne = async function (message) {
    var stepResult = { "data": { "masked": { "keyed": {} } } };

    const key = sodium.crypto_core_ristretto255_from_hash(sodium.crypto_generichash(64, sodium.from_string("0")));

    // If we are the recipient, retrieve other contributor's keyed data.
    if (self.roles.includes("recipient")) {
      self.other.data.keyed_by_other = await self.app.mapAsyncWithProgress(self.protocol.decode, message.data.keyed);
    }

    // If other party is a recipient, key their masked data and return it.
    self.other.roles = message.roles;
    if (self.other.roles.includes("recipient")) {
      let data = await self.app.mapAsyncWithProgress(self.protocol.decodeKeyEncode, message.data.masked);

      // Do not shuffle keyed data before contributing.
      stepResult.data.masked.keyed = data;

      const response_ = await self.services({"associates_public_key": []});
      const keyPublic = sodium.from_base64(response_['associates_public_key'][0], 1);
      stepResult.data.keyEncrypted = sodium.to_base64(sodium.crypto_box_seal(self.protocol._key, keyPublic), 1);

      const keysMask = sodium.crypto_core_ristretto255_scalar_random();
      const keysMaskEncrypted = sodium.crypto_box_seal(keysMask, keyPublic);
      stepResult.data.keysMaskEncrypted = sodium.to_base64(keysMaskEncrypted, 1);

      var keys = [];
      stepResult.data.keys = await self.app.mapAsyncWithProgress(function (rowPlain) {
        const key = sodium.crypto_core_ristretto255_from_hash(
          sodium.crypto_generichash(64, sodium.randombytes_buf(32))
        );
        keys.push(key);
        const keyMasked = sodium.crypto_scalarmult_ristretto255(keysMask, key);
        return sodium.to_base64(keyMasked, 1);
      }, self.data.clear);

      const columnJoin = self.app.data.columnJoin();
      stepResult.data.enriching = await self.app.mapAsyncWithProgress(function (rowPlain, i) {
        var row = [];
        for (var j = 0; j < rowPlain.length; j++)  {
          if (j != columnJoin) {
            const bytes = sodium.from_string(rowPlain[j]);
            const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
            const cipher_ = sodium.crypto_secretbox_easy(bytes, nonce, keys[i]);
            const cipher = new Uint8Array(nonce.length + cipher_.length);
            cipher.set(nonce);
            cipher.set(cipher_, nonce.length);              
            row.push(sodium.to_base64(cipher, 1));
          }
        }
        return row;
      }, self.data.clear);
    }

    return stepResult;
  };

  this.stepTwo = async function (message) {
    var stepResult = { "other": { "roles": self.other.roles } };

    // If we are a recipient, obtain the data and compute the result.
    if (
      self.roles.includes("recipient")
      && message.data != null
      && message.data.masked.keyed != null
    ) {
      self.app.progress.message("Operating on the encrypted data.");

      // We have the message and it contains the data we expect.
      // Unmask own masked data that has been keyed by other contributor.
      self.data.keyed_by_other = await self.app.mapAsyncWithProgress(self.protocol.decodeUnmask, message.data.masked.keyed);

      // Keep only bytes that will intersect.
      self.other.data.keyed_by_other_ = await self.app.mapAsyncWithProgress(self.protocol.pointToReducedStr, self.other.data.keyed_by_other);
      self.data.keyed_by_other = await self.app.mapAsyncWithProgress(self.protocol.pointToReducedStr, self.data.keyed_by_other);

      // Intersect `self.other.data.keyed_by_other` and `self.data.keyed_by_other`.
      self.app.progress.message("Computing the analysis results.");

      // Mask keyed data from other contributor and package it up with own masked data
      // so that nth.services can decode compare both and return appropriate keys.
      const servicesRequest = {
        "keyEncrypted": message.data.keyEncrypted,
        "otherKeyedMasked": await self.app.mapAsyncWithProgress(self.protocol.maskEncode, self.other.data.keyed_by_other),
        "selfMasked": self.data.masked,
        "otherKeysMasked": message.data.keys,
        "otherKeysMaskEncrypted": message.data.keysMaskEncrypted
      };

      // The nth.services API (or a simulation thereof) returns unmasked 
      // keys for common rows (with all other keys remaining masked).
      const response_ = await self.services(
        {"associates_intersect_unmask_keys": servicesRequest}
      );
      const otherKeysUnmasked = await self.app.mapAsyncWithProgress(function (key) {
        return sodium.from_base64(key, 1);
      }, response_.keys);

      // Add the entry to the intersection if appropriate to do so.
      stepResult.count = 0;
      stepResult.intersection = await self.app.mapAsyncWithProgress(function (row, i) {
        const item = self.data.keyed_by_other[i];
        const j = self.other.data.keyed_by_other_.indexOf(item);
        if (j != -1) {
          stepResult.count += 1;
          const row_enriching = message.data.enriching[j];
          for (var k = 0; k < row_enriching.length; k++)  {
            try {
              const key = otherKeysUnmasked[j];
              const nonceCipher = sodium.from_base64(row_enriching[k], 1);
              const nonce = nonceCipher.slice(0, 24);
              const cipher = nonceCipher.slice(24);
              row.push(sodium.to_string(sodium.crypto_secretbox_open_easy(cipher, nonce, key)));
            }  catch (err) {
              console.log(err);
              row.push("");
            }
          }
        }
        return row;
      }, self.data.clear);
    }

    return stepResult;
  };

  this.services = async function (servicesRequest) {
    if ("services" in self.app.config) {
      const response_ = await fetch(
        self.app.config.services.url,
        {
          method: 'POST',
          headers: {"Content-type": "application/json", "x-api-key": self.app.config.services.key},
          body: JSON.stringify(servicesRequest)
        }
      );
      const response = await response_.json();
      console.log(response);
      return response;
    } else {
      const keySecret = new Uint8Array([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);
      const keyPublic = sodium.crypto_scalarmult_base(keySecret);
      if ("associates_public_key" in servicesRequest) {         
        return {"associates_public_key": [sodium.to_base64(keyPublic, 1)]};
      } else if ("associates_intersect_unmask_keys" in servicesRequest) {
        const req = servicesRequest["associates_intersect_unmask_keys"];

        const keysUnmask = sodium.crypto_core_ristretto255_scalar_invert(
          sodium.crypto_box_seal_open(
            sodium.from_base64(req.otherKeysMaskEncrypted, 1),
            keyPublic, keySecret
          )
        );
        const unkey = sodium.crypto_core_ristretto255_scalar_invert(
          sodium.crypto_box_seal_open(
            sodium.from_base64(req.keyEncrypted, 1),
            keyPublic, keySecret
          )
        );
        const otherUnkeyed = await self.app.mapAsyncWithProgress(function (keyedMasked) {
          return sodium.to_base64(sodium.crypto_scalarmult_ristretto255(unkey, sodium.from_base64(keyedMasked, 1)), 1);
        }, req.otherKeyedMasked);
        const otherKeysUnmasked = await self.app.mapAsyncWithProgress(function (key, i) {
          if (req.selfMasked.indexOf(otherUnkeyed[i]) != -1) {
            return sodium.to_base64(sodium.crypto_scalarmult_ristretto255(keysUnmask, sodium.from_base64(key, 1)), 1);
          } else {
            return key;
          }
        }, req.otherKeysMasked);

        return {"keys": otherKeysUnmasked};
      }
    }
  };
}
