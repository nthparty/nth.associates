/*
 * Component with methods for common operations involving
 * button user interface components.
 */
function Buttons(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.enable = function (query) {
    $(query).prop("disabled", false);
    $(query).removeClass("button-disabled");
  }

  this.disable = function (query) {
    $(query).prop("disabled", true);
    $(query).addClass("button-disabled");
  }

  this.label = function (query, text) {
    $(query).prop("value", text);
  }
}
