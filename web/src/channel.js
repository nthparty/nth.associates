/**
  * API for interacting with back-end database (i.e., Firebase).
  */
function Channel(app, collectionName, pollInterval, maxBatchSize, msgBandwidth) {

  /* Dependencies. */

  var require = function (m) { if (!(m in window)) throw new Error('cannot load ' + m); };

  // External.
  require('firebase');

  /* Internal attributes. */

  this.app = app;
  this.collectionName = collectionName;
  pollInterval = pollInterval > 0 ? pollInterval : 0;
  maxBatchSize = maxBatchSize > 0 ? maxBatchSize : Infinity;
  msgBandwidth = msgBandwidth > 9 ? msgBandwidth : Infinity;
  this.debug = { log: () => {} /* console.log */ }; // Show debug log for IO messages, etc.

  /* Methods. */

  var self = this; // Self-reference for use in method implementations.

  async function give(data) {
    let tag = data.tag;
    let msg = data.msg;
    let no_batching = data.no_batching;
    let update_progress = data.update_progress;
    let promise = null;

    if (JSON.stringify(msg).length > msgBandwidth && !no_batching) {
      self.debug.log("Message length exceeds " + msgBandwidth + " bytes for \"" + tag + "\".  Batching...");
      let msg_buffer = JSON.stringify(msg).match(new RegExp('.{1,' + msgBandwidth + '}', 'g'));
      let arg = {
        tag: tag,
        msgs: msg_buffer
      }

      if (update_progress) {
        promise = await give_many_progress(arg);
      } else {
        promise = await give_many(arg);
      }
    } else {
      if (update_progress) {
        let arg = {
          tag: tag,
          msg: msg,
          no_batching: true,
          update_progress: false
        }
        promise = await self.app.mapAsyncWithProgress(give, [arg])
      } else {
        self.debug.log("give", tag, msg);
        promise = self.app.collection.push().set({tag, msg});
      }
    }

    return promise;
  }

  async function give_many_progress(data) {
    let tag = data.tag;
    let msgs = data.msgs;
    let n = msgs.length;

    let init = {
      tag: tag,
      msg: {_metadata: {fn: "give_many", size: n}},
      no_batching: true,
      update_progress: false
    }
    let all_msgs = [init];
    for (let i = 0; i < n; i++) {
      all_msgs.push({
        tag: tag + ".part" + (i+1) + ".." + n,
        msg: msgs[i],
        no_batching: true,
        update_progress: false
      })
    }

    return await self.app.mapAsyncWithProgress(give, all_msgs);
  }

  async function give_many(data) {
    let tag = data.tag;
    let msgs = data.msgs;
    let n = msgs.length;
    let init = give({
      tag: tag,
      msg: {_metadata: {fn: "give_many", size: n}},
      no_batching: false
    })

    let promises = [init];
    for (var i = 0; i < n; i++) {
      self.debug.log("give_many", (i+1), "/", n);
      promises.push(
              give({
                tag: tag + ".part" + (i+1) + ".." + n,
                msg: msgs[i],
                no_batching: true
              })
      )
    }

    return Promise.all(promises);
  }

  function peek(tag) {
    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(function (response) {
        let msgs = response.val();
        if (msgs != null) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  function attempt(tag) {
    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(function (response) {
        let msgs = response.val();
        if (msgs != null) {
          let keys = Object.keys(msgs);
          let last_key = keys[keys.length - 1];
          let last_msg = msgs[last_key];
          firebase.database().ref(self.collectionName + "/" + last_key).remove();
          resolve(last_msg.msg);
        } else {
          resolve(false);
        }
      });
    });
  }

  async function get_size(data) {
    let tag = data.tag;
    self.debug.log("get_size", tag);

    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(async function (response) {
        let msgs = response.val();
        if (msgs != null) {
          let keys = Object.keys(msgs);
          let last_key_idx = keys.length - 1;
          let last_key = keys[last_key_idx];
          let last_msg = msgs[last_key];
          let msg = last_msg.msg;
          if (typeof(msg) === "object" && msg._metadata != null && msg._metadata.fn === "give_many") {
            resolve(msg._metadata.size);
          } else {
            self.debug.log("got", tag, msg);
            resolve(1);
          }
        } else {
          setTimeout(async function () {
            await get_size({tag: tag}).then(resolve);
          }, pollInterval);
        }
      });
    });
  }

  async function get(data) {
    let tag = data.tag;
    let update_progress = data.update_progress;
    self.debug.log("get", tag);

    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(async function (response) {
        let msgs = response.val();
        if (msgs != null) {
          let keys = Object.keys(msgs);
          let last_key_idx = keys.length - 1;
          let last_key = keys[last_key_idx];
          let last_msg = msgs[last_key];

          firebase.database().ref(self.app.config.collection + "/" + last_key).remove();

          let msg = last_msg.msg;
          if (typeof(msg) === "object" && msg._metadata != null && msg._metadata.fn === "give_many") {
            if (update_progress) {
              await get_many_progress({tag: tag, n: msg._metadata.size}).then(resolve);
            } else {
              await get_many({tag: tag, n: msg._metadata.size}).then(resolve);
            }
          } else {
            self.debug.log("got", tag, msg);
            resolve(msg);
          }
        } else {
          setTimeout(async function () {
            await get({tag: tag, update_progress: update_progress}).then(resolve);
          }, pollInterval);
        }
      });
    });
  }

  async function get_many_progress(data) {
    let tag = data.tag;
    let n = data.n;
    let queries = [];

    for (let i = 1; i <= n; i++) {
      queries.push({
        tag: tag + ".part" + i + ".." + n,
        update_progress: false
      });
    }

    let promises = await self.app.mapAsyncWithProgress(get, queries);
    let promise = Promise.all(promises);
    return new Promise(function (resolve) {
      promise.then(function (msg_buffer) {
        let long_msg = JSON.parse(msg_buffer.join(""));
        resolve(long_msg);
      });
    });
  }

  async function get_many(data) {
    let tag = data.tag;
    let n = data.n;

    let promises = [];
    for (var i = 1; i <= n; i++) {
      self.debug.log("get_many", i, "/", n);
      promises.push(
        await get({tag: tag + ".part" + i + ".." + n})
      );
    }

    let promise = Promise.all(promises);
    return new Promise(function (resolve) {
      promise.then(function (msg_buffer) {
        let long_msg = JSON.parse(msg_buffer.join(""));
        self.debug.log("got (from batch)", tag, long_msg);
        resolve(long_msg);
      });
    });
  }

  function get_all(tag, __pollInterval, max_count) {
    max_count = max_count > 0 ? max_count : maxBatchSize;
    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(function (response) {
        let msgs_obj = response.val();
        if (msgs_obj != null) {
          let keys_array = Object.keys(msgs_obj);
          let msgs_array = keys_array.map(function (key, i) {
            if (i < max_count) {
              let msg = msgs_obj[key];
              firebase.database().ref(self.app.config.collection + "/" + key).remove();
              return msg;
            }
          }).slice(0, max_count);

          resolve(msgs_array);
        } else {
          const do_get = function () { get_all(tag, __pollInterval).then(resolve); };
          setTimeout(do_get, __pollInterval);
        }
      });
    });
  }

  function clear(tag) {
    self.debug.log("clear", tag);
    return new Promise(function (resolve) {
      let node = self.app.collection.orderByChild("tag").equalTo(tag);
      node.once("value").then(function (response) {
        let msgs = response.val();
        if (msgs != null) {
          firebase.database().ref(self.app.config.collection + "/" + Object.keys(msgs)[0]).remove();

          resolve(clear(tag));
        } else {
          resolve(true);
        }
      });
    });
  }

  /* Publicly accessible methods. */
  var exports_ = {};
  exports_.peek = peek;
  exports_.attempt = attempt;
  exports_.get = get;
  exports_.get_size = get_size;
  exports_.get_all = get_all;
  exports_.give = give;
  exports_.clear = clear;
  return exports_;
};
