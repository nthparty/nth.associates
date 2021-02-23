/*
 * Component with methods for common operations involving
 * content card user interface components.
 */
function Cards(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.

  /* Methods. */

  var self = this;

  this.introduce = function (queries) {
    for (var i = 0; i < queries.length; i++) {
      $(queries[i]).fadeIn();
      $(queries[i]).css("display", "flex");
    }
  }

  this.activate = function (query) {
    $(query).css("opacity", 1);
  }

  this.complete = function (queryCard, queryButton) {
    // Set card properties to reflect that task is
    // complete.
    $(queryCard).removeClass("card-step-warning");
    $(queryCard).addClass("card-step-complete");
    $(queryCard + "-warning").css("display", "none");
    $(queryCard + "-checkmark").css("display", "inline");

    // If a button to disable is specified, disable it.
    if (queryButton != null) {
      self.app.buttons.disable(queryButton);
    }
  }

  this.completeAndRemain = function (queryCard, queryButton) {
    // Set card properties to reflect that task is
    // complete, but do not fade it out (e.g., in
    // case it is the last step).
    self.complete(queryCard, queryButton);
    $(queryCard).css({"cssText": "opacity: 1 !important; display: flex;"});
  }

  this.warning = function (query) {
    $(query).addClass("card-step-warning");
    $(query + "-warning").css("display", "inline");
  }

  this.subtitle = function (query, html) {
    $(query).find(".card-header-subtitle").html(html);
  }

  this.message = function (query, html) {
    $(query).find(".card-body-message-content").html(html);
  }
}
