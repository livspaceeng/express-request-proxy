var express = require('express');
var http = require('http');
var urljoin = require('url-join');
var bodyParser = require('body-parser');
var debug = require('debug')('express-request-proxy');
var _ = require('lodash');
var is = require('type-is');

module.exports.beforeEach = function() {
  var self = this;
  this.apiLatency = 0;
  this.apiResponse = null;
  this.apiResponseStatus = 200;
  this.originHeaders = {};

  this.remoteApi = express();

  function maybeParseBody(req, res, next) {
    if (is.hasBody(req)) {
      switch (is(req, ['urlencoded', 'json'])) {
        case 'urlencoded':
          debug("parse api urlencoded body");
          return bodyParser.urlencoded({extended: false})(req, res, next);
        case 'json':
          debug("parse api json body");
          return bodyParser.json()(req, res, next);
        default:
          break;
      }
    }

    next();
  }

  this.remoteApi.all('/api', maybeParseBody, function(req, res, next) {
    setTimeout(function() {
      if (!self.originHeaders['Content-Type'])
        self.originHeaders['Content-Type'] = 'application/json';

      _.each(self.originHeaders, function(value, key) {
        res.set(key, value);
      });

      if (self.apiResponseStatus)
        res.statusCode = self.apiResponseStatus;

      if (self.apiResponse) {
        if (self.originHeaders['Content-Type'] === 'application/json')
          return res.json(self.apiResponse);
        else
          res.send(self.apiResponse);
      }
      else {
        var context = _.pick(req, 'query', 'path', 'params', 'headers', 'method', 'body');
        context.fullUrl = urljoin('http://localhost:' + apiPort, req.originalUrl);
        res.json(context);
      }
    }, self.apiLatency);
  });

  var apiPort = 5998;
  this.baseApiUrl = 'http://localhost:' + apiPort + '/api';
  this.apiServer = http.createServer(this.remoteApi).listen(apiPort);

  this.proxyOptions = {
    url: this.baseApiUrl,
    timeout: 3000
  };

  this.server = express();
  this.server.use(function(req, res, next) {
    req.ext = {};
    next();
  });
};

module.exports.errorHandler = function(err, req, res, next) {
  if (!err.status)
    err.status = 500;

  // if (err.status >= 500)
  console.error(err.message);

  res.status(err.status).send(err.message);
};

module.exports.afterEach = function(done) {
  if (this.apiServer)
    this.apiServer.close();

  if (this.proxyOptions.cache) {
    this.proxyOptions.cache.flushall(done);
  }
  else {
    done();
  }
};
