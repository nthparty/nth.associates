/*
 * Encoding/decoding and cryptographic primitives for protocol.
 */
function Protocol(app, state) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('sodium');

  /* Internal object attributes. */

  this.app = app;

  this.encode_small = sodium.to_base64;
  this.decode_small = sodium.from_base64;
  this.encode_fast = sodium.to_hex;
  this.decode_fast = sodium.from_hex;

  this._key =
    (state.protocolKey() != null) ?
    state.protocolKey() :
    sodium.crypto_core_ristretto255_scalar_random();
  this._mask =
    (state.protocolMask() != null) ?
    state.protocolMask() :
    sodium.crypto_core_ristretto255_scalar_random();
  this._maskInv =
    sodium.crypto_core_ristretto255_scalar_invert(this._mask);

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.encode = function (point) {
    return self.encode_small(point);  // btoa(String.fromCharCode.apply(null, point));
  };

  this.decode = function (str) {
    return self.decode_small(str);  // new Uint8Array(atob(str).split("").map(function (c) { return c.charCodeAt(0); }));
  };

  this.encode_debug = function (point) {
    return point.join(",");
  };

  this.decode_debug = function (str) {
    return new Uint8Array(e.split(",").map(function (s) { return parseInt(s); }));
  };

  this.strToPoint = function (s) {
    // Hash to a point.
    var h = sodium.to_hex(sodium.crypto_generichash(64, sodium.from_string(s)));
    return sodium.crypto_core_ristretto255_from_hash(h);
  };

  this.key = function (point) {
    return sodium.crypto_scalarmult_ristretto255(self._key, point);
  };

  this.keyEncode = function (point) {
    return self.encode(self.key(point));
  };

  this.decodeKeyEncode = function (encodedPoint) {
    return self.encode(self.key(self.decode(encodedPoint)));
  };

  this.mask = function (point) {
    return sodium.crypto_scalarmult_ristretto255(self._mask, point);
  };

  this.maskEncode = function (point) {
    return self.encode(self.mask(point));
  };

  this.unmask = function (point) {
    return sodium.crypto_scalarmult_ristretto255(self._maskInv, point);
  };

  this.decodeUnmask = function (encodedPoint) {
    return self.unmask(self.decode(encodedPoint));
  };

  this.pointToReducedStr = function (point) {
    return self.encode_fast(point);
  };

  this.shuffle = function shuffle(arr) {
    var k, i;
    for (k = arr.length; k > 0; k--) {
      i = sodium.randombytes_uniform(k);
      [arr[i], arr[k-1]] = [arr[k-1], arr[i]];
    }
    return arr;
  };

  this.deduplicateStrs = function (ss) {
    var dss = [];
    for (var i = 0; i < ss.length; i++) {
      if (dss.indexOf(ss[i]) == -1) {
        dss.push(ss[i]);
      }
    }
    return dss;
  };

  this.arrayOfStrToStr = function (a) {
    // Apply the various column operations if they are enabled.
    var columnDomain = self.app.data.columnDomain();
    if (columnDomain != null) {
      a[columnDomain] =
        (
          a[columnDomain].replace(/https?:\/\//, "").replace(/^(www\.)?/, "") + "/"
        ).split("/")[0].trim();
    }
    var columnJoin = self.app.data.columnJoin();
    var v = (columnJoin == null) ? a.join("") : a[columnJoin];

    return v;
  };

  this.arrayOfStrToPoint = function (a) {
    // Apply the various column operations if they are enabled.
    var columnDomain = self.app.data.columnDomain();
    if (columnDomain != null) {
      a[columnDomain] =
        (
          a[columnDomain].replace(/https?:\/\//, "").replace(/^(www\.)?/, "") + "/"
        ).split("/")[0].trim();
    }
    var columnJoin = self.app.data.columnJoin();
    var v = (columnJoin == null) ? a.join("") : a[columnJoin];
    return self.strToPoint(v);
  };
}
