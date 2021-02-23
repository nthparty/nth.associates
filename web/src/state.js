/*
 * Internal state of an application (including party identifiers, analysis
 * attributes/toggles, persistent protocol credentials and cryptographic
 * material, and other information).
 */
function State(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');
  require('sodium');

  /* Internal object attributes. */

  // Reference to overall application object.
  this.app = app;

  // Participant identities.
  this.__idSelf = null;
  this.__idOther = null;

  // Protocol options/parameters.
  this.__resultsReceive = true;
  this.__resultsQuantitative = false;

  // Cryptographic configuration.
  this.__protocolKey = sodium.crypto_core_ristretto255_scalar_random();
  this.__protocolMask = sodium.crypto_core_ristretto255_scalar_random();

  // The in-memory copy of the data as an array of arrays.
  this.__dataSelf = null;

  // Other information.
  this.__dataOtherLength = 0; // Initialized to work smoothly in all cases.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.idSelf = function (value) {
    if (value == null) {
      return self.__idSelf;
    } else {
      // Update state.
      self.__idSelf = value;
    }
  };

  this.idOther = function (value) {
    if (value == null) {
      return self.__idOther;
    } else {
      // Update state.
      self.__idOther = value;
    }
  };

  this.protocolKey = function (value) {
    if (value == null) {
      return self.__protocolKey;
    } else {
      self.__protocolKey = value;
    }
  };

  this.protocolMask = function (value) {
    if (value == null) {
      return self.__protocolMask;
    } else {
      self.__protocolMask = value;
    }
  };

  this.resultsReceive = function (value) {
    if (value == null) {
      // Synchronize state with UI component (if it exists).
      if ($("#receive").length) {
        self.__resultsReceive = $("#receive").is(":checked");
      }
      // Return state.
      return self.__resultsReceive;
    } else {
      // Synchronize UI component (if it exists) with state.
      if ($("#receive").length) {
        $("#receive").prop("checked", value);
      }
      // Update state.
      self.__resultsReceive = value;
    }
  };

  this.resultsQuantitative = function (value) {
    if (value == null) {
      // Synchronize state with UI component (if it exists).
      if ($("#quantitative").length) {
        self.__resultsQuantitative = $("#quantitative").is(":checked");
      }
      // Return state.
      return self.__resultsQuantitative;
    } else {
      // Synchronize UI component (if it exists) with state.
      if ($("#quantitative").length) {
        $("#quantitative").prop("checked", value);
      }
      // Update state.
      self.__resultsQuantitative = value;
    }
  };

  this.dataSelf = function (value) {
    if (value == null) {
      return self.__dataSelf;
    } else {
      self.__dataSelf = value;

      // Show and populate the data preview table.
      self.app.sheets.self.data(self.__dataSelf);
    }
  };
}
