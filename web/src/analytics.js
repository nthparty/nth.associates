/*
 * API for interacting with Google Analytics
 */

function Analytics() {

  this.currentTime = Date.now()

  function fileUploadSuccess(complete, numRows) {
    if (complete) {
      gtag("event", "file_upload_success", {
        "event_category": "file_upload",
        "event_type": "fullLoad",
        "elapsed": Date.now() - self.currentTime,
        "num_rows": numRows
      });
    } else {
      gtag("event", "file_upload_success", {
        "event_category": "file_upload",
        "event_type": "partialLoad",
        "elapsed": Date.now() - self.currentTime,
        "num_rows": numRows
      });
    }
  }

  function fileUploadFail(cause) {
    gtag("event", "file_upload_fail", {
      "event_category": "file_upload",
      "event_type": cause
    })
  }

  function contributeData(roles) {
    gtag("event", "contribute_data", {
      "event_category": "contribute",
      "elapsed": Date.now() - self.currentTime,
      "roles": roles
    });
  }

  function copyContributorUrl() {
    gtag("event", "copy_contributor_link", {
      "event_category": "copy_link"
    });
  }

  function analyzeData(roles) {
    gtag("event", "analyze_data", {
      "event_category": "analyze",
      "elapsed": Date.now() - self.currentTime,
      "roles": roles
    })
  }

  /* Publicly accessible methods. */
  let exports_ = {};
  exports_.fileUploadSuccess = fileUploadSuccess;
  exports_.fileUploadFail = fileUploadFail;
  exports_.contributeData = contributeData;
  exports_.copyContributorUrl = copyContributorUrl;
  exports_.analyzeData = analyzeData;
  return exports_;
}