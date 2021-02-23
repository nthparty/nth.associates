/*
 * Component for building a CSV in-memory and allowing a user to
 * download it by clicking a link.
 */
function CSV(app) {

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.__rowToStr = function (row) {
    var rowStr = '';
    for (var j = 0; j < row.length; j++) {
        var value = row[j] === null ? '' : row[j].toString();
        if (row[j] instanceof Date) {
            value = row[j].toLocaleString();
        };
        var current = value.replace(/"/g, '""');
        if (current.search(/("|,|\n)/g) >= 0)
            current = '"' + current + '"';
        if (j > 0)
            rowStr += ',';
        rowStr += current;
    }
    return rowStr + '\n';
  };

  this.download = function () {
    var dataStr = '';
    for (var i = 0; i < self.__data.length; i++) {
      dataStr += self.__rowToStr(self.__data[i]);
    }

    var blob = new Blob([dataStr], {"type": "text/csv;charset=utf-8;"});
    var link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection.
      // Include the date and time in the file name.
      var date = new Date();
      var date_str =
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
      var time_str =
        String(date.getHours()).padStart(2, '0') +
        String(date.getMinutes()).padStart(2, '0') +
        String(date.getSeconds()).padStart(2, '0');
      var filename = 'nth-link-' + date_str + '-' + time_str + '.csv';

      // Browsers that support HTML5 download attribute.
      var url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
