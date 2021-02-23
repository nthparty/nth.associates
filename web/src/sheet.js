/*
 * Internal state and methods for spreadsheet-like user interface
 * component instances.
 */
function Sheet(app, elementId, data) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.app = app;
  this.data = data;
  this.elementId = elementId;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.settings = function (data) {
    return {};
  };

  this.table_operation_independent_row = function (table_element, column_count, op, op_html) {
    var tr = document.createElement("tr");
    var td_row = document.createElement("td");
    td_row.innerHTML = op_html;
    td_row.classList.add("row-operation");
    tr.appendChild(td_row);
    for (var c = 0; c < column_count; c++) {
      var td = document.createElement("td");
      var toggle = "app.data.toggleIndependent('" + op + "', " + c + ", true);";
      td.classList.add("data_" + op + "_checkbox_" + c + "_cell");
      td.classList.add("data_checkbox_cell");
      td.classList.add("data_independent_checkbox_cell");
      td.innerHTML =
        '<input type="checkbox"' +
        ' class="data_independent_checkbox data_checkbox_' + c + '"' +
        ' id="data_' + op + '_checkbox_' + c + '"' +
        ' onclick="' + toggle + '"/>';
      const op_ = ''+op, c_ = parseInt(''+c);
      td.onclick = function () { app.data.toggleIndependentCell(op_, c_); };
      tr.appendChild(td);
    }
    table_element.appendChild(tr);
  };

  this.table_operation_row = function (table_element, column_count, op, op_html, tooltip) {
    var tr = document.createElement("tr");
    var td_row = document.createElement("td");

    if (tooltip == null) {
      td_row.innerHTML = op_html;
    } else {
      td_row.innerHTML =
        '<div data-toggle="tooltip" data-html="true" title="' +
        tooltip +
        '">' + op_html + '</div>'
        ;
    }

    td_row.classList.add("row-operation");
    tr.appendChild(td_row);
    for (var c = 0; c < column_count; c++) {
      var td = document.createElement("td");
      var toggle = "app.data.toggle('" + op + "', " + c + ", true);";
      td.classList.add("data_" + op + "_checkbox_" + c + "_cell");
      td.classList.add("data_checkbox_cell");
      td.innerHTML =
        '<div ' +
        (
          'data-toggle="tooltip" data-html="true"' +
          'title="' + tooltip + '"'
        ) +
        ' style="width:100%; height:100%;">' +
        '<input type="checkbox"' +
        ' class="data_checkbox_' + c + '"' +
        ' id="data_' + op + '_checkbox_' + c + '"' +
        ' onclick="' + toggle + '" ' +
        '/>' +
        '</div>'
        ;
      const op_ = ''+op, c_ = parseInt(''+c);
      td.onclick = function () { app.data.toggleCell(op_, c_); };
      tr.appendChild(td);
    }
    table_element.appendChild(tr);
  };

  this.grouped = function (data) {
      // Share reference to data with CSV module instance.
      self.app.csv.__data = data;

      // Update the card header and analysis results description/save content.
      $("#card-data-header-content").html("View and save your analysis results");
      $("#data-preview-description").html(
        (data.length > 0 ? 'The enriched results are displayed below.' :
                           'The results contain 0 rows.'
        ) +
        (data.length == 0 ? '' : (
          ' <a href="javascript:void(0)" onclick="app.csv.download();">Click here</a>' +
          ' to save these results as a CSV file.'
        ))
      );

      if (self.sheet == null) { // No spreadsheet library; using HTML table.
        // Build preview of at most first 100 rows.
        $("#preview-table").remove();
        var tbl = document.createElement("table");
        tbl.id = "preview-table";
        document.getElementById("preview").appendChild(tbl);

        var column_count = 0;
        if (data.length > 0) {
          column_count = data[0].length;
          self.app.data.setColumnCount(column_count);
        }

        // Add data preview.
        for (var r = 0; r < data.length; r++) {
          var tr = document.createElement("tr");
          var td_row = document.createElement("td");
          td_row.innerHTML = r + 1;
          td_row.classList.add("row-number");
          tr.appendChild(td_row);

          // Display plaintext or encrypted data.
          for (var c = 0; c < data[r].length; c++) {
            var td = document.createElement("td");
            td.classList.add("data_column_" + c);
            td.innerHTML = data[r][c];
            tr.appendChild(td);
          }

          tbl.appendChild(tr);
        }
        $("#preview").show();
    }
  }

  this.data = function (data, encrypted) {
    // Is the data being displayed in encrypted form?
    encrypted = (encrypted == null) ? false : encrypted;

    // Convert encrypted data to one-column format.
    var data_ = [];
    if (encrypted) {
      for (var r = 0; r < data.length; r++) {
        data_.push([data[r]]);
      }
      data = data_;
    }

    if (data == null) {
      return self.__data; // No new data was supplied; return current data.
    } else {
      // Update reference to data.
      self.__data = data;

      // Hide the placeholder message.
      $("#data-preview-description").html(
        (self.__data.length <= 100)
        ?
        (
          "Shown below are the <b>" + self.__data.length + " " +
          (encrypted ? "encrypted " : "") +
          "entries</b> of your data contribution."
        )
        :
        (
          (!encrypted) ?
            (
              "Shown below are the <b>first " +
              "100 entries (of " + self.__data.length +
              " entries in total)</b> of your data contribution." +
              //
              "<br/><b>All " + self.__data.length +  " entries</b> " +
              "are deduplicated, encrypted, and included in the analysis."
            )
            :
            (
              "Shown below are the encrypted <b>first " +
              "100 entries (of " + self.__data.length +
              " <i>unique</i> entries in total)</b> of your data contribution." +
              //
              "<br/><b>All " + self.__data.length +  " unique encrypted entries</b> " +
              "are included in the analysis."
            )
        )
      );

      if (self.sheet == null) { // No spreadsheet library; using HTML table.
        // Build preview of at most first 100 rows.
        $("#preview-table").remove();
        var tbl = document.createElement("table");
        tbl.id = "preview-table";
        document.getElementById("preview").appendChild(tbl);

        var column_count = 0;
        if (data.length > 0) {
          column_count = data[0].length;
          self.app.data.setColumnCount(column_count);
        }

        // If this is the non-encrypted data, check the app configuration and
        // show data operation checkboxes that are enabled.
        if (!encrypted) {
          if (self.app.config.operations.domain) {
            self.table_operation_independent_row(tbl, column_count, "domain", "DOMAIN");
          }
          if (self.app.config.operations.join) {
            self.table_operation_row(
              tbl, column_count,
              "join",
              'MATCH USING ONLY<br/>SELECTED COLUMN<br/>(OPTIONAL)',
              (
                "If you select a column, only that column will be used to match a row in your data with a row " +
                "in your partner's data. " +
                "However, your partner will also need to select a compatible column with the same type of data." +
                "<br/><br/>" +
                "If no column is selected, rows on both sides must match exactly " +
                "(in terms of the columns, the order of the columns, and the values in those columns) " +
                "to contribute to the total overlap."
              )
            );
          }
          if (self.app.config.operations.groupBy) {
            if (self.app.state.idSelf()[0] == 'r') { // Only for session creators.
              self.table_operation_row(tbl, column_count, "groupby", "GROUP BY");
            }
          }
        }

        // Add data preview.
        for (var r = 0; r < Math.min(100, data.length); r++) {
          var tr = document.createElement("tr");
          var td_row = document.createElement("td");

          if ( r == 0 && !encrypted &&
               "operations" in self.app.config &&
               "toggleFirstRow" in self.app.config.operations &&
               self.app.config.operations.toggleFirstRow
             ) {
            td_row.innerHTML +=
              '<div class="exclude-first-row-toggle-div" data-toggle="tooltip" data-html="true" title="' +
                "If the first row contains column names, exclude it from the analysis by selecting HEADER." +
              '">' +
                '<table><tr><td>' +
                  '<table><tr><td>' +
                    '<input type="checkbox" id="first-row-checkbox-data"' +
                      ' class="first-row-checkbox-data"' +
                      ' onclick="app.data.clickFirstRowData();"'+
                      ' checked/>' +
                  '</td>' +
                  '<td class="first-row-checkbox-label">'+
                    '<label for="first-row-checkbox-data">DATA</label>' +
                  '</td></tr></table>' +
                '</td>' +
                '<td>' +
                  '<table><tr><td>' +
                    '<input type="checkbox" id="first-row-checkbox-header"' +
                      ' class="first-row-checkbox-header"' +
                      ' onclick="app.data.clickFirstRowHeader();"' +
                      '/>' +
                  '</td>' +
                  '<td class="first-row-checkbox-label">' +
                    '<label for="first-row-checkbox-header">HEADER</label>' +
                  '</td></tr></table>' +
                '</td></tr></table>' +
              '</div>'
              + (r + 1);
          } else {
            td_row.innerHTML = r + 1;
          }

          td_row.classList.add("row-number");
          tr.appendChild(td_row);

          // Display plaintext or encrypted data.
          for (var c = 0; c < data[r].length; c++) {
            var td = document.createElement("td");
            td.classList.add("data_column_" + c);
            td.classList.add("data_cell");
            if (r == 0) {
              td.classList.add("data_row_first_cell");
            }
            td.innerHTML = data[r][c];
            tr.appendChild(td);
          }

          tbl.appendChild(tr);
        }
        $("#preview").show();
      } else { // Using spreadsheet library.
        // Display the spreadsheet HTML container.
        $("#sheet-self").show();

        // Update data with supplied data.
        //self.sheet.updateSettings(self.settings(data));

        // Make all cells read-only.
        /* self.sheet.updateSettings({
          cells: function (row, col) { return {"readOnly": true}; }
        });*/
      }

      // Enable tooltips once element is in the document.
      $('[data-toggle="tooltip"]').tooltip();
    }
  }

  // Create spreadsheet object and populate HTML element.
  data = data == null ? [[""]] : data; // Default data: one cell.
  if (false) { // Toggle spreadsheet library.
    /*self.sheet = new Handsontable(
      document.getElementById(self.elementId),
      self.settings(data)
    );*/
  }
}
