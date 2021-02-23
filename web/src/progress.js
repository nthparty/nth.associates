/*
 * Encapsulated component for managing a progress bar user
 * interface component (and associated HTML content containers).
 */
function Progress(length) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.length = length;
  this.index = 0;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.setPercent = function (percent) {
    $("#progress-overall-bar").css("width", percent+"%").attr("aria-valuenow", percent);
  };

  this.setLength = function (length) {
    self.length = length;
    self.index = 0;
    self.setPercent(0);
  };

  this.reduceLengthBy = function (length) {
    self.length -= length;
    self.setPercent(Math.floor((100 * self.index) / self.length));
  };

  this.advanceByLength = function (delta) {
    delta =  (delta == null) ? 1 : delta;
    self.index += delta;
    self.setPercent(Math.floor((100 * self.index) / self.length));
  };

  this.advanceByPercent = function (delta) {
    delta =  (delta == null) ? 1 : delta;
    self.index += (delta * self.length) / 100;
    percent = Math.floor((100 * self.index) / self.length);
    self.setPercent(Math.floor((100 * self.index) / self.length));
  };

  this.message = function (text) {
    $("#progress-message").text(text);
  }

  this.reset = function () {
    self.message("");
    self.setPercent(0);
  }
}
