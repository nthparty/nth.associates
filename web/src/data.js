/*
 * Component for managing the user-specified data workflow operations,
 * including management of user interface components.
 */
function Data(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.
  this.__columnCount = null;
  this.__rowFirstExclude = null;
  this.__columnDomain = null;
  this.__columnJoin = null;
  this.__columnGroupBy = null;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.setColumnCount = function (value) {
    self.__columnCount = value;
  }

  this.columnDomain = function () {
    return self.__columnDomain;
  }

  this.rowFirstExclude = function () {
    return self.__rowFirstExclude;
  }

  this.columnJoin = function () {
    return self.__columnJoin;
  }

  this.columnGroupBy = function () {
    return self.__columnGroupBy;
  }

  this.clickFirstRowData = function () {
    $(".first-row-checkbox-data").prop("checked", true);
    $(".first-row-checkbox-header").prop("checked", false);
    self.__rowFirstExclude = false;
    $(".data_row_first_cell").removeClass("data_row_first_cell_excluded");
  };

  this.clickFirstRowHeader = function () {
    $(".first-row-checkbox-data").prop("checked", false);
    $(".first-row-checkbox-header").prop("checked", true);
    self.__rowFirstExclude = true;
    $(".data_row_first_cell").addClass("data_row_first_cell_excluded");
  };

  this.toggleIndependentCell = function (op, column) {
    var id = "#data_" + op + "_checkbox_" + column;
    $(id).prop("checked", !$(id).is(':checked'));
    self.toggleIndependent(op, column, false);
  }

  this.toggleIndependent = function (op, column, direct) {
    var id = "#data_" + op + "_checkbox_" + column;

    // Ignore a direct click to avoid conflict with cell click.
    if (direct) {
      $(id).prop("checked", !$(id).is(':checked'));
    }

    if ($(id).is(':checked')) {
      // Update internal state.
      if (op == 'domain') {
        this.__columnDomain = column;
      }

      // Uncheck all other checkboxes for the same operator (i.e., in same row).
      for (var c = 0; c < self.__columnCount; c++) {
        if (c != column) {
          $("#data_" + op + "_checkbox_" + c).prop("checked", false);
          $(".data_" + op + "_checkbox_" + c + "_cell").removeClass("data_op_" + op);
        }
      }

      // Add the highlight for the operation being toggled.
      $(".data_" + op + "_checkbox_" + column + "_cell").addClass("data_op_" + op);
    } else {
      // Indicate the disabled operation in the state.
      if (op == 'domain') {
        this.__columnDomain = null;
        $(".data_" + op + "_checkbox_" + column + "_cell").removeClass("data_op_" + op);
      }
    }
  }

  this.toggleCell = function (op, column) {
    var id = "#data_" + op + "_checkbox_" + column;
    $(id).prop("checked", !$(id).is(':checked'));
    self.toggle(op, column, false);
  }

  this.toggle = function (op, column, direct) {
    var id = "#data_" + op + "_checkbox_" + column;

    // Ignore a direct click to avoid conflict with cell click.
    if (direct) {
      $(id).prop("checked", !$(id).is(':checked'));
    }

    if ($(id).is(':checked')) {
      // Update internal state.
      if (op == 'join') {
        this.__columnJoin = column;
        this.__columnGroupBy = (this.__columnGroupBy == column) ? null : this.__columnGroupBy;
      } else if (op == 'groupby') {
        this.__columnJoin = (this.__columnJoin == column) ? null : this.__columnJoin;
        this.__columnGroupBy = column;
      }

      // Uncheck all other checkboxes in the same column that are not
      // independent.
      $(".data_checkbox_" + column).not(id).not(".data_independent_checkbox").prop("checked", false);

      // Uncheck all other checkboxes for the same operator (i.e., in same row).
      for (var c = 0; c < self.__columnCount; c++) {
        if (c != column) {
          $("#data_" + op + "_checkbox_" + c).prop("checked", false);
          $(".data_column_" + c).removeClass("data_op_" + op);
          $(".data_" + op + "_checkbox_" + c + "_cell").removeClass("data_op_" + op);
        }
      }

      // Clear existing highlights for non-independent operators in the
      // selected column.
      $(".data_column_" + column).removeClass("data_op_join");
      $(".data_column_" + column).removeClass("data_op_groupby");
      $(".data_join_checkbox_" + column + "_cell").removeClass("data_op_join");
      $(".data_groupby_checkbox_" + column + "_cell").removeClass("data_op_groupby");

      // Add the highlight for the operation being toggled.
      $(".data_" + op + "_checkbox_" + column + "_cell").addClass("data_op_" + op);
      $(".data_column_" + column).addClass("data_op_" + op);
    } else {
      // Indicate the disabled operation in the state.
      if (op == 'join') {
        this.__columnJoin = null;
      } else if (op == 'groupby') {
        this.__columnGroupBy = null;
      }

      // Remove highlights.
      $(".data_join_checkbox_" + column + "_cell").removeClass("data_op_" + op);
      $(".data_groupby_checkbox_" + column + "_cell").removeClass("data_op_" + op);
      $(".data_column_" + column).removeClass("data_op_" + op);
    }
  }
}
