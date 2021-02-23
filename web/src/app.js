/*
 * Overall application.
 */
function App(config) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('jQuery');
  require('ClipboardJS');
  require('Dropzone');
  require('Papa');
  require('sodium');
  require('firebase');

  // Internal.
  require('Session');
  require('State');
  require('URLs');
  require('IDs');
  require('Data');
  require('Sheets');
  require('CSV');
  require('Cards');
  require('Buttons');
  require('Modal');
  require('Progress');
  require('Channel');
  require('Analytics');

  /* Internal object attributes. */

  this.config = config;
  this.io = null;
  this.sheets = new Sheets(this);
  this.collection = null;
  this.progress = new Progress();
  this.session = null;
  this.state = null;
  this.cards = null;
  this.buttons = null;
  this.modal = null;
  this.url = null;

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  this.mapAsyncWithProgress = function (fn, arr, index, arr_, portion) {
    index = (index == null) ? 0 : index;
    arr_ = (arr_ == null) ? [] : arr_;
    var portion = (portion == null) ? 1000 : portion;
    var i = null;

    for (i = index; i < arr.length && (i - index) < portion; i++) {
      arr_.push(fn(arr[i]));
    }
    self.progress.advanceByLength(i - index);

    return new Promise(function (resolve) {
      if (i < arr.length) {
        setTimeout(function () {
          self.mapAsyncWithProgress(fn, arr, i, arr_).then(resolve);
        }, 100);
      } else {
        resolve(arr_);
      }
    });
  };

  this.giveGetProgressSize = function (numRows) {
    /*
    Calculate the number of get() or give() calls will be made
    for a query based on number of rows passed.
     */
    let objectSize =
      (numRows * 43) +                          // 43 chars per row
      (numRows - 1) +                           // number of commas in output
      (numRows * 2) +                           // number of " chars in output
      64                                        // constant sized metadata in output
    return Math.ceil(objectSize / 128000);   // divide by msgBandwidth value
  }

  this.stages = async function (stage) {

    self.analytics.currentTime = Date.now();    // set start time for analytics
    var id_self = self.state.idSelf();
    var id_other = self.state.idOther();
    var roles = // Determine if this contributor is also a recipient.
      ["contributor"] + (self.state.resultsReceive() ? ["recipient"] : []);

    // Add the initial data from this contributor to the database if this
    // is the first time this function has been invoked.
    if (stage === 0) {

      // Reset the results panel.
      self.clear();

      // Initialize progress tracking modal.
      let data = self.state.dataSelf();
      let selfNumChunks = self.giveGetProgressSize(data.length);

      if (!roles.includes("recipient")) {
        let otherNumChunks = self.giveGetProgressSize(self.state.__dataOtherLength);
        self.progress.setLength(
          2 * data.length +
          self.state.__dataOtherLength +
          selfNumChunks +
          2 +
          otherNumChunks * 2 +
          1
        );
      } else {
        self.progress.setLength(
          2 * data.length +
          self.state.__dataOtherLength +
          selfNumChunks +
          2
        );
      }

      self.progress.message("Preparing data for encryption.");

      // Create a protocol session data structure and prepare
      // the data (i.e., transforming and hashing as necessary).
      self.session = new Session(self, self.state, roles);
      let prepared = await self.session.prepareSelfData(data);
      
      // Because deduplication may have reduced the total amount
      // of data, adjust the progress bar maximum length and
      // recalculate the current percentage. The user may see the
      // progress bar "jump" forward by some interval.
      self.progress.reduceLengthBy(
        2 * (data.length - self.session.data.points.length)
      );
      self.progress.reduceLengthBy(
        2 * (selfNumChunks - self.giveGetProgressSize(self.session.data.points.length))
      );

      // Encrypt the data and write first messages to database.
      let stepResult = await self.session.stepZero();
      self.progress.message("Contributing encrypted data.");
      await self.io.give({
        tag: "S0_" + id_other,
        msg: {
          "data": {
            "size":
              (stepResult.data.masked.length != null) ?
                stepResult.data.masked.length : (
                  (stepResult.data.keyed.length != null) ?
                    stepResult.data.keyed.length :
                    0
                )
          }
        },
        no_batching: false,
        update_progress: true
      })
      await self.io.give({
        tag: "S1_" + id_other,
        msg: stepResult,
        no_batching: false,
        update_progress: true
      })

      if (roles.includes("recipient")) {
        setTimeout(function () {
          // For the recipient, the protocol will continue when they click "Analyze".
          self.cards.message(
            ".card-step-three",
            "Once your partner has contributed, click <b>Analyze and enrich</b> to see the results."
          );
          self.buttons.disable("#card-step-two-action-button");
          self.cards.message(".card-step-two", "Send this URL to your data partner:");
          $("#url-other").css("display", "inline-block");
          $("#url-other-copy").css("display", "inline-block");
          self.modal.hide();
          self.progress.reset();
          self.analytics.contributeData(["contributor", "recipient"]);
        }, 500);
      } else {
        // Update the interface to indicate we are waiting
        // and begin polling for a response.
        self.progress.message("Operating on other contributor's encrypted data.");
        self.check_firebase_status_before_stage(1);
      }

    } else if (stage === 1) {

      // Check if the data is already posted.
      let messagePeek = await self.io.peek("S0_" + id_self);

      if (roles.includes("recipient") && !messagePeek) {
        self.cards.message(
          ".card-step-three",
          "Your partner has not yet contributed their encrypted data. Please try again later."
        );
        self.cards.warning(".card-step-three");
        self.progress.setPercent(100);
        self.modal.hide();
        self.progress.reset();
      }

      if (!roles.includes("recipient") || messagePeek) {
        // Obtain data from other contributor.
        // Set the progress bar length to capture all subsequent operations
        // on own and other party's data.
        if (roles.includes("recipient")) {
          // Retrieve and clear out the first message (which has validation and data size).
          // No need to update progress bar because it's always only one query
          let messageValidation = await self.io.get({tag:"S0_" + id_self, update_progress: false});
          let getStepOneSize = await self.io.get_size({tag: "S1_" + id_self});
          let getStepTwoSize = await self.io.get_size({tag: "S2_" + id_self});
          // Update progress bar range.
          self.progress.setLength(
            getStepOneSize +                  // For query against S1.
            getStepTwoSize +                  // For query against S2.
            messageValidation.data.size +     // For decoding in `stepOne`.
            messageValidation.data.size +     // For unmasking in `stepTwo`.
            self.session.data.points.length + // For projecting unmasked keyed points in `stepTwo`.
            messageValidation.data.size +     // For projecting unmasked keyed points in `stepTwo`.
            self.session.data.points.length   // For final intersection in `stepTwo`.
          );
        }
        let message = await self.io.get({tag: "S1_" + id_self, update_progress: true});

        // Key the masked data from the other contributor.
        let stepResult = await self.session.stepOne(message);

        if (roles.includes("recipient")) {
          // For the recipient, the protocol will continue.
          self.check_firebase_status_before_stage(2);
        } else {
          await self.io.give({
            tag: "S2_" + id_other,
            msg: stepResult,
            no_batching: false,
            update_progress: true
          })

          // For the contributor, the protocol is finished.
          self.cards.message(
            ".card-step-two",
            "Your encrypted data has been contributed to the secure analysis. <b>You may now close this page.</b>"
          );
          self.cards.completeAndRemain(".card-step-two", "#card-step-two-action-button");
          self.modal.hide();

          // Show offboarding card if directed by configuration to do so.
          if ("offboard" in self.config && self.config.offboard) {
            $(".card-data").hide();
            $(".card-offboard").show();
          }
          self.analytics.contributeData(["contributor"]);
        }
      }
    } else if (stage === 2) {
      // Obtain data from other contributor.
      let message = await self.io.get({tag: "S2_" + id_self, update_progress: true});
      let stepResult = await self.session.stepTwo(message);

      // We received a response but still need to compute the
      // intersection.
      self.progress.message("Computing the results of the analysis.");

      // If we have an intersection, display it.
      if (Array.isArray(stepResult.intersection)) {
        if (self.state.resultsQuantitative()) {
          const result_count = stepResult.count;
          const percentage = (100 * result_count) / self.session.data.points.length;
          self.cards.message(
            ".card-step-three",
            '<span class="percentage">' + percentage.toFixed(3) + "%</span>" +
            '<span class="count">' +
              "or <b>" + result_count + "</b> of the " +
              "<b>" + self.session.data.points.length + " unique</b> entries in your " +
              " data match entries in your partner's data" +
            '</span>' +
            // Include link to survey if directed to do so.
            (("analysisResultsFeedbackSurveyLink" in self.config &&
              self.config.analysisResultsFeedbackSurveyLink)
              ?
              ('<br/>Have feedback or ideas? ' +
                '<a href="https://nthparty.typeform.com/to/CwCzHIGx"><b>Tell us what you think!</b></a>')
              :
              ''
            )
          );
          self.buttons.disable("#url-other-copy");
          self.cards.completeAndRemain(".card-step-three", "#card-step-three-action-button");
          self.progress.setPercent(100);

          // Show offboarding card if directed by configuration to do so.
          if ("offboard" in self.config && self.config.offboard) {
            $(".card-data").hide();
            $(".card-offboard").show();
          }

          // Display the results.
          self.sheets.self.grouped(stepResult.intersection);

          // If grouping was requested, display counts of own data grouped
          // by values in grouping column.
          var columnGroupBy = self.data.columnGroupBy();
          if (columnGroupBy != null) {
            var mapping = {}, keys = [];
            for (var r = 0; r < stepResult.intersection.length; r++) {
              var key = stepResult.intersection[r][columnGroupBy];
              mapping[key] = (mapping[key] == null) ? 1 : mapping[key] + 1;
            }
            var group_counts = [];
            for (var key in mapping) {
              group_counts.push([key, mapping[key]]);
            }
            self.sheets.self.grouped(group_counts);
          }

        } else {
          self.sheets.other.data(stepResult.intersection);
        }
      }

      // Display whether the other contributor received data.
      if (stepResult.other.roles.includes("recipient")) {
        self.cards.message(
          ".card-step-three",
          "Other contributor has received the results."
        );
      } else {
        /*self.cards.message(
          ".card-step-three",
          "Other contributor did not request the results."
        );*/
      }

      // Update interface to indicate results are posted to interface.
      self.modal.hide();
      self.analytics.analyzeData(["contributor", "recipient"]);

    } // End if `stage` is `0` else if `1` else if `2`.
  }

  this.iframeResize = function () {
    var height = $(window).height(), width = $(window).width();
    $("#iframe-terms-and-policies").css("height", height * 0.3 | 0);
    $("#iframe-terms-and-policies").css("width", width * 0.6 | 0);
  };

  this.initialize = function () {
    // Add version subscript if it is for a preliminary version.
    if (["alpha", "beta"].includes(self.config.version)) {
      $("#version").html(self.config.version);
    }

    setTimeout(async function () {
      await sodium.ready;

      // Parameters: poll interval (ms), max items per query, maximum message size (KB).
      self.io = Channel(self, self.config.collection, 200, 1000, 128000);
      self.analytics = Analytics();

      // Create instance of URL interface.
      self.interfaceForURLs = new URLs(self);
      self.interfaceForIDs = new IDs(self);

      // Create instances of interface component APIs.
      self.cards = new Cards(self);
      self.buttons = new Buttons(self);
      self.data = new Data(self);
      self.csv = new CSV(self);
      self.modal = new Modal(self);

      // Ensure the URL is valid.
      if (!self.interfaceForURLs.validURL()) {
        self.invalid();
      }

      // Contributor may need to wait for the URL to be validated.
      if (self.interfaceForURLs.isContributorURL()) {
        self.modal.showProgress("Validating your session URL.", 25);
      }

      try {
        let decr = null;
        try {
          // Set up access to back-end infrastructure.
          const __key =
            ("key" in self.config) ?
            self.config.key :
            self.interfaceForURLs.authFromURL();
          const __storage = [
            'I8xyy-YSHleWq-RfrE7aq5_dDkjcqxQa6vxnnh1BJIguU9qCVcQIsg' +
            '_-e7wXaVtj_jMpzMvOUhWHAKkyiImKEBNXXRLYTLnMuY9TTMv2Yk2U' +
            'u1kMt-dmGXOhVMBIugSHKfJXHGt70Kc5lueVqi37S5uubybg8RZBON' +
            'bV5STRpp54ec1Cq0eMveW-hKZjyHFoQh-pVk44_BqYLaDQrHOg1qTq' +
            'KSTpC3mUSp9mPXy-2CZbq0NZernsWKKgMH-4430inHFpKhJrLOPAcg' +
            'MZOjl-cr88uipZFTDopjZJPFxeV6WTykzBEFyr7RNkFr7Q3UpCxj0l' +
            'hs-JWgXSo1Uwrjicf6ZdC1baihbL_QR3qtzGC7_AF4yuCl8ymFgr0G' +
            '7lNzrIncHvPJug2oJMDbjMJm4Y3jqImVXJJGmX1yHSGUFxxtOvQ68h' +
            'vcX2DoQSanFNNZuMTA8HuUaKQB0RYpdncTlgmho', 'hHPj5xRKAvr' +
            'SuuhtwIGJ9aXdQBKmRs_eT8'
          ];

          decr = sodium.crypto_aead_chacha20poly1305_decrypt(null,
            sodium.from_base64(__storage[0]), null, new Uint8Array(8),
            sodium.from_base64(__key + __storage[1])
          );

          const firebaseConfig = JSON.parse(sodium.to_string(decr));
          firebase.initializeApp(firebaseConfig);
          self.collection = firebase.database().ref().child(self.config.collection);

          // Contributor is waiting for session to be validated.
          if (self.interfaceForURLs.isContributorURL()) {
            self.progress.setPercent(50);
          }

        } catch (e) {
          $(".card-request-access").fadeIn();
          $(".card-step-one").remove();
          $(".card-step-two").remove();
          $(".card-step-three").remove();
          self.modal.hide();
        }
      } catch (e) {
        if (e.toString() === "Error: invalid input") {
          // Authentication failed.
          self.invalid();
          self.modal.hide();
        } else {
          // Something else went wrong.
          self.invalid();
          self.modal.hide();
        }
      }

      // Configure the UI component for choosing a CSV file.
      if ($("#chooseFile").length) {
        // time_elapsed in analytics will be set against this value
        self.analytics.currentTime = Date.now();
        var dropzone = new Dropzone("#chooseFile", {
          "autoProcessQueue": false,
          "autoQueue": false,
          "hiddenInputContainer": "#drop-hidden-input",
          "previewTemplate": '<span style="display:none"></span>',
          "createImageThumbnails": false
        });
        dropzone.on("addedfile", function(file) {
          // Display progress modal.
          self.modal.showProgress("Loading CSV file into browser.", 0);

          // Only allow CSV files to be loaded.
          if (!file.name.endsWith(".csv")) {
            self.analytics.fileUploadFail("fileNotCsv");
            self.modal.showCard(
              "Error",
              "Non-CSV file selected",
              "The selected file <b>" + file.name + "</b> is not a CSV file. " +
                 "Please select a valid CSV file."
            );
            return;
          }

          // Only allow CSV files to be loaded.
          if (file.size == 0) {
            self.analytics.fileUploadFail("fileEmpty");
            self.modal.showCard(
              "Error",
              "CSV file is empty",
              "The selected file <b>" + file.name + "</b> has no rows. " +
                 "Please select a CSV file that contains at least one row."
            );
            return;
          }

          // If maximum CSV file size is an expression string, evaluate it.
          if (!Number.isInteger(self.config.maximumCSVFileSize)) {
              var factors = self.config.maximumCSVFileSize.split("*");
              self.config.maximumCSVFileSize = 1;
              for (var i = 0; i < factors.length; i++) {
                  self.config.maximumCSVFileSize *= parseInt(factors[i].trim());
              }
          }

          // Limit maximum size of allowed CSVs.
          if (file.size > self.config.maximumCSVFileSize) {
            self.analytics.fileUploadFail("fileTooLarge");
            self.modal.showCard(
              "Error",
              "CSV file is too large",
              "The selected file <b>" + file.name + "</b> is over 50 MB in size. " +
                "Please select a smaller CSV file."
            );
            return;
          }

          // Load the file.
          var reader = new FileReader();
          reader.readAsText(file);
          reader.onload = function(event) {
            // Parse the CSV.
            var csvData = event.target.result.trim();
            var data = [], stepCount = 0, chunksParsed = 0;
            var capRows = self.config.maximumCSVRowCount, capReached = false;
            Papa.parse(
              csvData,
              {
                worker: true, // Disable if using `setTimeout()` approach.
                chunkSize: 1024 * 1024, // Disable if using `setTimeout()` approach.
                chunk: function (results, parser) {
                  if (results && results.data) {

                    stepCount += results.data.length;
                    if (stepCount > capRows) {
                      capReached = true;
                      let rowsLeft = capRows - data.length;
                      data.push.apply(data, results.data.slice(0, rowsLeft));
                      parser.abort();
                    } else {
                      chunksParsed++;
                      data.push.apply(data, results.data);
                      self.progress.setPercent(Math.ceil((100 * 1024 * 1024 * chunksParsed) / file.size));
                    }

                  }
                },
                complete: function (results) {
                  // Record a reference to the data and move on to the next step.
                  self.state.dataSelf(data);
                  self.cardStepTwo();

                  // Update the progress bar.
                  self.progress.setPercent(100);

                  // Display message if data has been cut off due to the
                  // cap on the number of rows being reached.
                  if (!capReached) {
                    self.analytics.fileUploadSuccess(true, stepCount);
                    self.modal.hide();
                  } else {
                    self.analytics.fileUploadSuccess(false, capRows);
                    self.modal.showCard(
                      "Warning",
                      "CSV Row Limit",
                      "Your selected CSV file <b>" + file.name + "</b>" +
                        " has more than " +capRows + " rows." +
                        " <b>Only the first " + capRows + " rows have been loaded.</b>"
                    );
                  }
                },
                error: function () {
                  self.analytics.fileUploadFail("fileParseError");
                  self.modal.showCard(
                    "Error",
                    "Loading and Parsing CSV File",
                    "There was an error loading or parsing the CSV file you chose."
                  );
                }
              }
            );
          };
          reader.onerror = function() {
            self.analytics.fileUploadFail("fileReadError");
            self.modal.showCard(
              "Error",
              "Cannot read file",
              "The selected file <b>" + file.name + "</b> cannot be read."
            );
          };
        });
      }

      // Contributor is waiting for session to be validated.
      if (self.interfaceForURLs.isContributorURL()) {
        self.progress.setPercent(75);
      }

      // Create an initial state, including IDs and tokens.
      self.state = new State(self);

      // Generate or parse participant identifiers.
      if (!self.interfaceForURLs.idsFromURL()) {
        self.state.idSelf(self.interfaceForIDs.idCreateRecipient());
      }

      // Determine participant role configuration.
      if (self.state.idSelf()[0] == 'r') { // This is an analysis-recipient/session-creator.

        // Set configuration to receive aggregate results.
        self.state.resultsReceive(true);
        self.state.resultsQuantitative(true);

        // Assign identifier to contributor.
        if (!self.interfaceForURLs.idsFromURL()) {
          self.state.idOther(self.interfaceForIDs.idCreateContributor());
        }

        // Build the contributor URL for sharing with contributor.
        if ($("#url-other").length) {
          document.getElementById("url-other").value = self.interfaceForURLs.contributorURL();
        }

        // Adjust and show cards and card content for this role.
        if (!self.interfaceForURLs.allowSimulatedFromURL()){
            self.cards.message(
              ".card-step-one",
              ('Choose CSV file to contribute to the analysis or ' +
                '<a id="simlink" href="javascript:void(0)" onclick="app.simulatedLinkClick();"><b>click here</b></a> ' +
                'to use sample data. ') +
              //"Choose a CSV file containing the data you are contributing to the analysis. " +
              ('By loading your data, you agree to the ' +
                '<a href="javascript:void(0)" onclick="app.modal.showTermsOfService();">Terms of Service</a>.')
            );
        }
        self.cards.activate(".card-step-one");
        self.cards.introduce([
          ".card-step-one",
          ".card-step-two",
          ".card-step-three"
        ]);

      } else { // This is a data contributor.

        // Ensure there is a session with data waiting for the contributor.
        let recipientDataPresent = await self.io.attempt("S0_" + self.state.idSelf());
        if (recipientDataPresent === false) {
          // There is no session or recipient data.
          self.invalid();

          // Hide session URL validation modal message.
          self.progress.setPercent(100);
          self.modal.hide();
        } else { // There is a session with encrypted recipient data.
          // Save the size of the session creator's data contribution.
          self.state.__dataOtherLength = recipientDataPresent.data.size;

          // Set configuration to receive no results.
          self.state.resultsReceive(false);
          self.state.resultsQuantitative(false);

          // Set the data contribution step button label.
          self.buttons.label("#card-step-two-action-button", "Contribute encrypted data");

          // Adjust and show cards and card content for this role.
          if (!self.interfaceForURLs.allowSimulatedFromURL()){
              self.cards.message(
                ".card-step-one",
              ('Choose CSV file to contribute to the analysis or ' +
                '<a id="simlink" href="javascript:void(0)" onclick="app.simulatedLinkClick();"><b>click here</b></a> ' +
                'to use sample data. ') +
              //"Choose a CSV file containing the data you are contributing to the analysis. " +
                'By loading your data, you agree to the <a href="javascript:void(0)" onclick="app.modal.showTermsOfService();">Terms of Service</a>.'
              );
          }
          self.cards.message(
            ".card-step-two",
            "You may contribute your encrypted data when you are ready by clicking below."
          );
          self.cards.subtitle(
            ".card-step-two",
            "Contribute your encrypted data"
          )
          self.cards.activate(".card-step-one");
          self.cards.introduce([
            ".card-step-one",
            ".card-step-two"
          ]);

          // Hide session URL validation modal message.
          self.progress.setPercent(100);
          self.modal.hide();
        }
      }

      // Input/output spreadsheets.
      $("#sheet-self").show();
      self.sheets.initialize();
      $("#sheet-self").hide();
      self.clear(); // Clear results output HTML elements.

      // // Database API wrapper.
      // self.io.initialize();

      // Button to copy contributor URL to clipboard.
      if ($("#url-other-copy").length) {
        var clipboard = new ClipboardJS("#url-other-copy");
        // Once the URL is copied, fade step cards as appropriate.
        clipboard.on('success', function(e) {
          self.analytics.copyContributorUrl();
          self.cards.complete(".card-step-two", "#card-step-two-action-button");
          self.cards.activate(".card-step-three");
          self.buttons.enable("#card-step-three-action-button");
        });
      }

      $(window).resize(function() {
        self.iframeResize();
      });
    }); // Wait for sodium to load.
  };

  this.clear = function () {
    self.cards.message(
      ".card-step-three",
      "Once your partner has contributed, click <b>Analyze</b> to see the results."
    );
    if (!self.state.resultsReceive()) {
      self.state.resultsQuantitative(false);
    }
  };

  this.cardStepTwo = function () {
    $("#data-random").prop("disabled", true);
    self.cards.complete(".card-step-one", "#card-step-one-action-button");
    self.cards.activate(".card-step-two");
    self.cards.introduce([".card-data"]);
    self.buttons.enable("#card-step-two-action-button");
  }

  this.simulated = function () {
    self.cardStepTwo();
  };

  this.simulatedLinkClick = function () {
    $("#simlink").prop("onclick", null).off("click");
    self.sheets.selfSelectRandomData('data500.json');
    self.clear();
    self.simulated();
  };

  this.contribute = function () {
    if (self.state.idOther() == null ||
        self.state.idOther().length != self.interfaceForIDs.idLength()) {
      // Should not occur if link is properly formatted.
    } else {
      self.modal.showProgress("Gathering data for encryption.", 0);
      setTimeout(async function () { self.check_firebase_status_before_stage(0); }, 250);
    }
  };

  this.analyze = function () {
    if (self.state.idOther() == null ||
        self.state.idOther().length != self.interfaceForIDs.idLength()) {
      // Should be an error.
    } else {
      self.modal.showProgress("Retrieving encrypted data for analysis.", 0);
      setTimeout(async function () { self.check_firebase_status_before_stage(1) }, 250);
    }
  };
  
  this.signup = async function () {
    self.modal.showProgress("Signing up...", 100);

    // Base64-encoded, encrypted email address string.
    var encrypted = sodium.to_base64(sodium.crypto_box_seal(
      sodium.from_string($("#signup-email").val()),
      sodium.from_base64("+kVkXT1ITinuylEIEtWjlP4JvyQjpE1l5/tELntDwGw=", 1)
    ), 1);

    await self.io.give({
      tag: "SIGNUP",
      msg: {"email": encrypted},
      update_progress: false
    });
    $("#signup-email").prop("disabled", true);
    $(".signup-thankyou").show();
    self.modal.hide();
  }

  this.invalid = function () {
    $(".card-invalid").fadeIn();
    $(".card-request-access").remove();
    $(".card-data").remove();
    $(".card-step-one").remove();
    $(".card-step-two").remove();
    $(".card-step-three").remove();
  };

  this.clear_all_messages = function (self_id, other_id) {
    if (self_id == null || other_id == null) {
      self_id = self.state.idSelf();
      other_id = self.state.idOther();
    }

    let promise = Promise.all([
      self.io.clear("S1_" + self_id),
      self.io.clear("S1_" + other_id),
      self.io.clear("S2_" + self_id),
      self.io.clear("S2_" + other_id)
    ]);

    promise.then(console.log.bind(null,
      "Cleared all messages for id pair '" + self_id + "'/'" + other_id + "'."
    ));

    return promise;
  };

  this.check_firebase_status_before_stage = function (stage) {
    let connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", function (snap) {
      if (!snap.val() === true) {
        self.modal.showCard(
            "error",
            "Firebase Inaccessible",
            "Cannot reach Firebase service."
        )
      } else {
        self.stages(stage);
      }
    });
  }
}
