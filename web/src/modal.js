/*
 * Component with methods for managing the modal.
 */
function Modal(app) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');

  /* Internal object attributes. */

  this.app = app; // Reference to overall application object.
  this.__shown = false;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.showCard = function (title, subtitle, content) {
    self.__shown = true;

    $(".progress").css("display", "none");
    $("#progress-message").css("display", "none");
    $(".modal").find(".card-header-title").html(title);
    $(".modal").find(".card-header-subtitle").html(subtitle);
    $(".modal").find(".card-body-message-content").html(content);
    $(".modal-card-deck").css("display", "flex");
    $(".modal").modal("show");
  }

  this.showPrivacyPolicy = function () {
    self.__shown = true;

    self.showCard(
      "Terms and Policies",
      "Privacy Policy",
      '<iframe id="iframe-terms-and-policies" src="legal-privacy-policy.html"></iframe>'
    );
    self.app.iframeResize();
  }

  this.showTermsOfService = function () {
    self.__shown = true;

    self.showCard(
      "Terms and Policies",
      "Terms and Conditions of Use",
      '<iframe id="iframe-terms-and-policies" src="legal-terms-of-service.html"></iframe>'
    );
    self.app.iframeResize();
  }

  this.showProgress = function (content, percent) {
    self.__shown = true;

    $(".modal-card-deck").css("display", "none");
    self.app.progress.setPercent(percent);
    self.app.progress.message(content);
    $(".progress").css("display", "flex");
    $("#progress-message").css("display", "block");
    $(".modal").modal("show");
  }

  this.hide = function () {
    self.__shown = false;

    $(".modal").modal("hide");
    setTimeout(function () {
      if ($(".modal").hasClass("show")) {
        self.hide();
      } else {
        self.app.progress.reset();
      }
    }, 250);
  }
}
