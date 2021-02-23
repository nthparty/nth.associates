/*
 * Encapsulated component for managing multiple spreadsheet-like
 * user interface components.
 */
function Sheets(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');
  require('_'); // Underscore.js.

  // Internal.
  require('Sheet');

  /* Internal object attributes. */

  this.app = app;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.randomDataFraction = function (n) {
    return Math.floor((3 * n) / 5);
  };

  this.selfSelectRandomData = function (value) {
    
    // Use selection unless a parameter was provided.
    value =
      "data-" + (
        self.app.state.resultsReceive() ? "recipient" : "contributor"
      ) + ".json";

    fetch(value)
      .then(response => {
        if (!response.ok) {
          throw new Error("HTTP error " + response.status);
        }
        return response.json();
      })
      .then(data => { // The `data` result is a JSON object.
        self.app.state.dataSelf(data);

        // Show and populate the data preview table.
        self.self.data(data);
      })
      .catch(function () {
        // Should report a connectivity issue.
      });
  };

  this.initialize = function () {
    // Create spreadsheets.
    self.self = new Sheet(self.app, "sheet-self");
  };
}
