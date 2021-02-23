/*
 * Component for creating and validating party identifiers.
 */
function IDs(app) {

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.idLength = function () {
    return 9;
  };

  this.idCreateRecipient = function (recipientOrContributor) {
    var identifier = 'r', cs = 'ABCDEFRXYZabcdefrxyz23456789';
    for (var i = 0; i < 8; i++) {
      identifier += cs.charAt(Math.floor(Math.random() * cs.length));
    }
    return identifier;
  };

  this.idCreateContributor = function (recipientOrContributor) {
    var identifier = 'c', cs = 'ABCDEFRXYZabcdefrxyz23456789';
    for (var i = 0; i < 8; i++) {
      identifier += cs.charAt(Math.floor(Math.random() * cs.length));
    }
    return identifier;
  };

  this.idCreateStandard = function () {
    return "xxxyxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}
