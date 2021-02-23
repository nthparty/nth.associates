/*
 * Component for reading/writing the URL and parsing and building URLs.
 */
function URLs(app) {

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.shuffleParam = function (value) {
    if (value.length == 18 || value.length == 27) {
      var value_shuffled = "";
      for (var i = 0; i < 9; i++) {
        value_shuffled += value[i] + value[9+i] + ((value.length == 27) ? value[18+i] : "");
      }
      return value_shuffled;
    } else {
      return value;
    }
  }

  this.unshuffleParam = function (value) {
    if (value.length == 18 || value.length == 27) {
      const numEntries = Math.floor(value.length/9);
      var value_unshuffled = "";
      for (var j = 0; j < numEntries; j++) {
        for (var i = 0; i < 9; i++) {
          value_unshuffled += value[numEntries*i + j];
        }
      }
      return value_unshuffled;
    } else {
      return value;
    }
  }

  this.paramsFromStandardURL = function () {
    var urlParams = new URLSearchParams(window.location.search);
    var entries = urlParams.entries();
    var map = {};
    for (var entry of entries) {
      map[entry[0]] = entry[1];
    }
    return map;
  }

  this.paramsFromCompactURL = function () {
    var param = self.paramsFromStandardURL()["a"];
    var map = {};
    if (param != null) {
      var ps = self.unshuffleParam(param);
      if (ps != null) {
        if (ps.length == 9 || ps.length == 27) {  // Key is in the URL.
          if (ps.length >= 9) {
            map["a"] = ps.slice(0, 9);
          }
          if (ps.length == 27) {
            map["this"] = ps.slice(9, 18);
            map["other"] = ps.slice(18, 27);
          }
        } else if (ps.length == 18) { // Key is in the configuration.
          map["a"] = self.app.config.key;
          map["this"] = ps.slice(0, 9);
          map["other"] = ps.slice(9, 18);
        }
      }
    }
    return map;
  }

  // Toggle based on type of URL.
  this.paramsFromURL = this.paramsFromCompactURL;

  this.authFromURL = function () {
    var param = self.paramsFromURL()["a"];
    var auth = self.unshuffleParam(param);
    if (auth != null) {
      auth = (auth[0] == "H") ? auth : ("H" + auth.slice(1, 9));
    }
    return auth;
  }

  this.allowSimulatedFromURL = function () {
    var ps = self.paramsFromURL();
    return
      (!"key" in self.app.config) && // Only toggle via URL if key is from URL.
      ("a" in ps) && (self.unshuffleParam(ps["a"])[0] == "H");
  }

  this.idsFromURL = function () {
    var params = self.paramsFromURL();
    if (params["this"] != null && params["other"] != null) {
      self.app.state.idSelf(params["this"]);
      self.app.state.idOther(params["other"]);
      return true;
    }
    return false;
  };

  this.validURL = function () {
    var urlParams = new URLSearchParams(window.location.search);
    var entries = urlParams.entries();
    var parameters = [];
    for (var entry of entries) {
      if (entry[0] != "ref") {
        parameters.push({"name":entry[0], "value": entry[1]});
      }
    }
    if (parameters.length == 0) {
      return true;
    } else if (
         parameters.length != 1
      || parameters[0].name != "a"
      || (
           parameters[0].value.length != 9
        && parameters[0].value.length != 18
        && parameters[0].value.length != 27
         )
       ) {
      return false;
    }

    return true;
  }

  this.isContributorURL = function () {
    var urlParams = new URLSearchParams(window.location.search);
    var entries = urlParams.entries();
    var parameters = [];
    for (var entry of entries) {
      if (entry[0] != "ref") {
        parameters.push({"name":entry[0], "value": entry[1]});
      }
    }
    return (
         parameters.length == 1
      && parameters[0].name == "a"
      && (parameters[0].value.length == 27 || parameters[0].value.length == 18)
    );
  }

  this.contributorStandardURL = function () {
    var url = window.location.protocol + "//" + window.location.host + window.location.pathname;
    return url + "?" + [
      "a="+self.paramsFromURL()["a"],
      "this="+self.app.state.idOther(),
      "other="+self.app.state.idSelf()
    ].join("&");
  };

  this.contributorCompactURL = function () {
    var url = window.location.protocol + "//" + window.location.host + window.location.pathname;
    return url + "?a=" +
      self.shuffleParam(
        (("key" in self.app.config) ? "" : self.paramsFromURL()["a"]) +
        self.app.state.idOther() +
        self.app.state.idSelf()
      );
  };

  // Toggle based on type of URL.
  this.contributorURL = this.contributorCompactURL;
}
