var AWS = require('./core');
var inherit = AWS.util.inherit;

AWS.HttpRequest = inherit({
  constructor: function HttpRequest() {
    this.method = 'POST';
    this.uri = '/';
    this.headers = {};
    this.headers['User-Agent'] = 'aws-sdk-js/0.1';
    this.body = undefined;
    this.endpoint = undefined;
    this.serviceName = undefined;
  },

  sign: function sign(credentials) {
    new AWS.SignatureV4Signer(this).addAuthorization(credentials);
  },

  pathname: function pathname() {
    return this.uri.split('?',1)[0];
  },

  search: function search() {
    return(this.uri.split('?',2)[1] || '');
  }
});

/**
 * @constructor
 */
AWS.HttpResponse = inherit({
  constructor: function HttpResponse() {
    this.statusCode = null;
    this.headers = null;
    this.body = null;
  }
});

/**
 * @constructor
 */
AWS.RequestHandler = inherit({

  constructor: function RequestHandler(awsRequest) {
    this.awsRequest = awsRequest;
    this.awsResponse = awsRequest.awsResponse;
    this.service = this.awsResponse.service;
    this.method = this.awsResponse.method;
    this.params = this.awsResponse.params;
  },

  makeRequest: function makeRequest() {

    var requestHandler = this;

    var httpRequest = this.buildRequest();
    var httpResponse = new AWS.HttpResponse();

    this.awsResponse.httpRequest = httpRequest;
    this.awsResponse.httpResponse = httpResponse;

    AWS.HttpClient.getInstance().handleRequest(httpRequest, {

      onHeaders: function onHeaders(statusCode, headers) {
        httpResponse.statusCode = statusCode;
        httpResponse.headers = headers;
      },

      onData: function onData(data) {
        if (httpResponse.body === null) {
          httpResponse.body = data;
        } else {
          httpResponse.body += data;
        }
      },

      onEnd: function onEnd() {
        if (httpResponse.body) {
          httpResponse.body = httpResponse.body.toString();
        }
        requestHandler.handleHttpResponse(httpResponse);
      },

      onError: function onError(error) {
        requestHandler.handleNetworkError(error);
      }

    });

  },

  // build, populate, sign and return a new request
  buildRequest: function buildRequest() {
    var httpRequest = this.service.buildRequest(this.method, this.params);
    httpRequest.sign(this.service.config.credentials);
    return httpRequest;
  },

  handleHttpResponse: function handleHttpResponse(httpResponse) {

    // Do this for *every* response, even responses with 200 status
    // code may contain an error.  If extractError returns null
    // then we have a successful response.
    var error = this.service.extractError(httpResponse);
    this.awsResponse.error = error;

    if (error) {
      if (this.service.shouldRetry(httpResponse, error)) {
        this.retryRequest();
      } else {
        this.awsRequest.notifyFail();
      }
    } else {
      this.awsResponse.data = this.service.parseResponse(httpResponse, this.method);
      this.awsRequest.notifyDone();
    }

  },

  handleNetworkError: function handleNetworkError(error) {
    this.awsRequest.error = error;
    this.retryRequest();
  },

  retryRequest: function retryRequest() {

    var delays = this.service.retryDelays();
    var delay = delays[this.awsResponse.retryCount];

    this.awsResponse.retryCount += 1;

    if (delay !== undefined) {

      var requestHandler = this;
      setTimeout(function delayRetry() {
        requestHandler.makeRequest();
      }, delay);

    } else {
      this.awsRequest.notifyFail(); // retried too many times
    }
  }
});

/**
 * @constructor
 */
AWS.NodeHttpClient = inherit({
  constructor: function NodeHttpClient() {},

  handleRequest: function handleRequest(request, callbacks) {
    var options = {
      host: request.endpoint.host,
      port: request.endpoint.port,
      method: request.method,
      headers: request.headers,
      path: request.uri
    };

    var client = request.endpoint.scheme === 'https' ?
      require('https') : require('http');

    var req = client.request(options, function onResponse(resp) {
      callbacks.onHeaders(resp.statusCode, resp.headers);
      resp.on('data', callbacks.onData);
      resp.on('end', callbacks.onEnd);
    });

    req.write(request.body);
    req.end();
    req.on('error', function(e) {
      callbacks.onError({ code: 'NetworkingError', message: e.toString() });
    });
  }
});

AWS.HttpClient = AWS.NodeHttpClient;

AWS.HttpClient.getInstance = function getInstance() {
  /*jshint newcap:false */
  if (this.singleton === undefined) {
    this.singleton = new this();
  }
  return this.singleton;
};