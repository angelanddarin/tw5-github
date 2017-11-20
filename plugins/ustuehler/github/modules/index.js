/*\
title: $:/plugins/ustuehler/github/index.js
type: application/javascript
module-type: library

The plugin's main logic

\*/
(function () {
  /* global $tw, Promise */

  var Component = require('$:/plugins/ustuehler/core').Component
  var Syncer = require('$:/plugins/ustuehler/core').Syncer
  var Client = require('$:/plugins/ustuehler/github/client').Client
  var GitHubAdaptor = require('$:/plugins/ustuehler/github/githubadaptor').GitHubAdaptor

  var GitHub = function () {
    var self = this

    if ($tw.syncadaptor instanceof GitHubAdaptor) {
      // Manage the global githubadaptor
      this.syncadaptor = $tw.syncadaptor
      this.syncer = $tw.syncer
    } else {
      this.syncadaptor = new GitHubAdaptor({
        wiki: $tw.wiki
      })

      // Create a githubadaptor and syncer later in startSync
      this.syncer = new Syncer({
        wiki: $tw.wiki,
        syncadaptor: this.syncadaptor
      })
    }

    Component.call(this, 'GitHub').then(function () {
      self.status.update(signedOutStatus())
    })
  }

  GitHub.prototype = Object.create(Component.prototype)
  GitHub.prototype.constructor = GitHub

  GitHub.prototype.dependenciesReady = function () {
    // Anonymous access by default, or whatever is currently configured
    this.client = new Client()

    // Wait for window.GitHub to become available
    return this.client.initialise()
  }

  GitHub.prototype.currentUser = function () {
    return getUserName()
  }

  GitHub.prototype.signIn = function (username, accessToken) {
    var self = this

    if (this.status.fields['signed-in']) {
      return Promise.resolve()
    }

    if (arguments.length < 2) {
      accessToken = username
      username = null
    }

    // Create a new client with the provided credentials
    var client = new Client(username, accessToken)

    // Attempt to sign in using the new client
    this.status.update(signingInStatus())
    return client.signIn()
      .then(function (user) {
        self.client = client
        setUserName(user.login)
        //rememberAccessToken(accessToken)
        self.status.setError(null)
        self.status.update(signedInStatus())
        // Asynchronous; we don't care if this fails
        self.startSync()
      })
      .catch(function (err) {
        forgetAccessToken()
        self.status.setError(err)
        self.status.update(signedOutStatus())
        return err
      })
  }

  GitHub.prototype.signOut = function () {
    forgetAccessToken()
    this.client = new Client()
    this.status.update(signedOutStatus())
    this.status.setError(null)
    // Now we have only anonymous access, again
    return this.stopSync()
  }

  GitHub.prototype.startSync = function () {
    var self = this

    return this.stopSync()
      .then(function () {
        return self.signIn()
      })
      .then(function (/*user*/) {
        return self.syncadaptor.start()
      })
      .then(function () {
        self.status.setError(null)
        self.status.update(synchronisingStatus())
      })
      .catch(function (err) {
        self.status.setError(err)
        self.status.update(notSynchronisingStatus())
        throw err
      })
  }

  GitHub.prototype.stopSync = function () {
    var self = this

    this.status.update(notSynchronisingStatus())

    return (this.syncer.stop ? this.syncer.stop() : Promise.resolve())
      .then(function () {
        return self.syncadaptor.stop()
      })
  }

  GitHub.prototype.getUserProfile = function (username) {
    return this.client.getUser(username).getProfile().then(function (response) {
      return response.data
    })
  }

  GitHub.prototype.getUserKeys = function (username) {
    return this.client.getUserKeys(username)
  }

  GitHub.prototype.getUserRepos = function (username) {
    return new Promise(function (resolve, reject) {
      this.client.getUser(username).listRepos(function (err, repos) {
        if (err) {
          return reject(err)
        }
        resolve(repos)
      })
    })
  }

  var STATUS_USER_NAME = '$:/status/GitHub/UserName'
  var TEMP_ACCESS_TOKEN = '$:/temp/GitHub/AccessToken'

  function getUserName () {
    return $tw.wiki.getTiddlerText(STATUS_USER_NAME)
  }

  function setUserName (login) {
    $tw.wiki.setText(STATUS_USER_NAME, 'text', null, login)
  }

  /*
  function rememberAccessToken (token) {
    $tw.wiki.setText(TEMP_ACCESS_TOKEN, 'text', null, token)
  }
  */

  function forgetAccessToken () {
    $tw.wiki.deleteTiddler(TEMP_ACCESS_TOKEN)
  }

  function signedOutStatus () {
    return {
      'signed-in': false,
      'signing-in': false,
      'synchronising': false
    }
  }

  function signingInStatus () {
    return {
      'signed-in': false,
      'signing-in': true
    }
  }

  function signedInStatus () {
    return {
      'signed-in': true,
      'signing-in': false
    }
  }

  function synchronisingStatus () {
    return {
      'synchronising': true
    }
  }

  function notSynchronisingStatus () {
    return {
      'synchronising': false
    }
  }

  var github = new GitHub()

  exports.currentUser = function () {
    return github.currentUser
  }

  exports.signIn = function (username, accessToken) {
    if (arguments.length < 2) {
      return github.signIn(username) // accessToken
    }
    return github.signIn(username, accessToken)
  }

  exports.signOut = function () {
    return github.signOut()
  }

  exports.startSync = function () {
    return github.startSync()
  }

  exports.stopSync = function () {
    return github.stopSync()
  }

  exports.getUserProfile = function (username) {
    return github.getUserProfile(username)
  }
})()
