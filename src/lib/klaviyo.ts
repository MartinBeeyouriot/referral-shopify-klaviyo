/** @module klaviyo-node */
import winston from 'winston';
const { format } = winston;
import querystring from 'querystring';
import { assign, get } from 'lodash';
const axios = require('axios');
const assert = require('assert');
const axiosRetry = require('axios-retry');

/**
 * A Class for Klaviyo tracking. This class creates an object that
 * makes it easy to send Server-Side events to Klaviyo. More
 * documentation about Klaviyo Server-Side events can be found
 * here: https://www.klaviyo.com/docs/http-api
 */
export class Klaviyo {
  logger: any;
  apiBasePath: string;

  /**
   * Initialize a new `Klaviyo` with the Klaviyo public key and an
   * optional dictionary of `options`.
   * @constructor
   *
   * @param {String} publicKey - The public key for you Klaviyo account.
   * @param {String} privateKey - The private key for your Klaviyo account.
   * @param {Object} [options] (optional)
   *   @property {Winston.Transport} transport (default: Console) - A
   *       Winston Logger Transport object. When a Transport is passed, all
   *       log messages will be forwarded to that transport instead of the
   *       default Console output.
   *   @property {Boolean} log (default: true) - If true, this module
   *       will output log messages using the defined or default Transport
   *   @property {String} logLevel (default: info) - Decide which level
   *       log messages should be outputted for.
   *   @property {String} apiBasePath (default: https://a.klaviyo.com/api) -
   *       The base URL to which to send the track and identify calls to.
   */
  constructor(public publicKey: string, public privateKey: string, public options: any) {
    options = options || {};

    assert(publicKey, 'You must pass your Klaviyo public key.');

    this.publicKey = publicKey;
    this.privateKey = privateKey;

    const defaultTransport = new winston.transports.Console({
      format: winston.format.combine(
        format.colorize(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.align(),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    });

    const defaultOptions = {
      log: true,
      logLevel: 'info',
      transport: defaultTransport,
      apiBasePath: 'https://a.klaviyo.com/api',
      retryCount: 3
    };

    options = assign(defaultOptions, options);
    this.logger = {
      log: () => {}
    };

    this.apiBasePath = options.apiBasePath;

    if (options.log) {
      this.logger = winston.createLogger({
        level: options.logLevel,
        format: winston.format.json(),
        transports: [options.transport]
      });
    }
    axiosRetry(axios, {
      retries: options.retryCount,
      retryCondition: this._isErrorRetryable,
      retryDelay: axiosRetry.exponentialDelay
    });
  }

  /**
   * Function that defines when a Request should be retried by Axios
   * @private
   * @param {Error} error - An Axios error response
   * @return {Boolean} - True if a Request should be retried
   */
  _isErrorRetryable(error: any) {
    // Retry Network Errors.
    if (axiosRetry.isNetworkError(error)) {
      return true;
    }

    if (!error.response) {
      // Cannot determine if the request can be retried
      return false;
    }

    // Retry Server Errors (5xx).
    if (error.response.status >= 500 && error.response.status <= 599) {
      return true;
    }

    // Retry if rate limited.
    if (error.response.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * A helper function that sends data to Klaviyo.
   * @private
   * @param {String} apiVersion - Klaviyo api version
   * @param {String} path - request path
   * @param {String} params - request parameters
   * @param {Object} data - request data
   * @param {String} method - request type
   * @return {Promise} Returns a Promise which resolves to
   *    response data or rejects
   */
  _requestKlaviyo(apiVersion: string | undefined, path: string, params: any, data: any, method = 'get') {
    const endpoint = `${this.apiBasePath}${apiVersion ? `/${apiVersion}/` : '/'}${path}`;
    this.logger.log('info', endpoint);

    return new Promise((resolve, reject) => {
      const requestParameter = {
        method,
        url: endpoint,
        ...(params ? { params } : {}),
        ...(data ? { data } : {})
      };

      axios(requestParameter)
        .then((response: any) => {
          if (response.data === 0) {
            this.logger.log(
              'warn',
              `Klaviyo rejected the \
            track request`
            );
          } else {
            this.logger.log(
              'verbose',
              `Successfully sent request to \
            Klaviyo`
            );
          }
          resolve(response.data);
        })
        .catch((error: any) => {
          const status = get(error, 'response.status', 'Unkown Status');
          this.logger.log(
            'error',
            `Encountered ${status} \
          from GET to ${endpoint}`,
            params
          );
          reject(error);
        });
    });
  }

  /**
   * Used to track when someone takes an action or does something.
   * @param {String} eventName - The type of Klaviyo request (track/identify)
   * @param {Object} [customerProperties={}] - Custom information
   *     including $email or $id identifier about the person
   *     who did this event.
   * @param {Object} [eventProperties={}] - Custom information about the
   * person who did this event.
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  track(eventName: string, customerProperties = {}, eventProperties = {}) {
    this.ensureIdentifier(customerProperties);

    const data = {
      event: eventName,
      properties: eventProperties,
      customer_properties: customerProperties,
      token: this.publicKey
    };

    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    const params = {
      data: payload
    };

    return this._requestKlaviyo(undefined, 'track', params, undefined);
  }

  /**
   * The identify method allows you to identify and set properties on
   * an individual.
   * @param {Object} [customerProperties={}] - Custom information
   *     including $email or $id identifier about the person
   *     who did this event.
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  identify(customerProperties = {}) {
    this.ensureIdentifier(customerProperties);

    const data = {
      properties: customerProperties,
      data: this.publicKey
    };

    const payload = Buffer.from(JSON.stringify(data)).toString('base64');
    const params = {
      data: payload
    };

    return this._requestKlaviyo(undefined, 'identify', params, undefined);
  }

  /**
   * Excludes customer from outbound communications .
   * @param {String} email - Customer email
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  suppress(email: string) {
    assert(!!email, 'Email is required');
    this.ensurePrivateKey();

    this.logger.log(
      'verbose',
      `Sending Klaviyo an exclusion request \
      for user ${email}`
    );

    // Data needs to be transmitted as form-urlencoded
    const data = querystring.stringify({
      api_key: this.privateKey,
      email
    });

    return this._requestKlaviyo('v1', 'people/exclusions', null, data, 'post');
  }

  /**
   * Subscribes to a list
   * @param {Array<string>} listId - klaviyo list id
   * @param {Array<string>} emails - List of customer emails to subscribe
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  subscribeToInvites(listId: string, email: string, referrerName: string, referrerEmail: string, discountCode: string) {
    assert(!!listId, 'listId is required');
    assert(email, 'Parameter emails is not valid array');
    this.ensurePrivateKey();

    const data = {
      api_key: this.privateKey,
      // profiles: emails.filter(e => e).map(email => ({ email, referrerName, referrerEmail, discountCode }))
      profiles: { email, referrerName, referrerEmail, discountCode }
    };

    return this._requestKlaviyo('v2', `list/${listId}/subscribe`, null, data, 'post');
  }

  /**
   * Subscribes to a list
   * @param {Array<string>} listId - klaviyo list id
   * @param {Array<string>} emails - List of customer emails to subscribe
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  subscribeToReferree(listId: string, email: string, name: string, hasShareableLink: boolean = false, link: String = '') {
    assert(!!listId, 'listId is required');
    assert(email, 'Parameter emails is not valid array');
    this.ensurePrivateKey();

    let profiles = {
      email,
      name,
      hasShareableLink,
      ...(hasShareableLink && { linkReferral: link })
    };

    const data = {
      api_key: this.privateKey,
      profiles
    };

    return this._requestKlaviyo('v2', `list/${listId}/subscribe`, null, data, 'post');
  }

  /**
   * Subscribes to a list
   * @param {Array<string>} listId - klaviyo list id
   * @param {Array<string>} emails - List of customer emails to subscribe
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  getListMembers(listId: string) {
    assert(!!listId, 'listId is required');
    this.ensurePrivateKey();

    const data = {
      api_key: this.privateKey
    };

    return this._requestKlaviyo('v2', `group/${listId}/members/all`, undefined, data, 'get');
  }

  /**
   * Subscribes to a list
   * @param {Array<string>} listId - klaviyo list id
   * @param {Array<string>} emails - List of customer emails to subscribe
   * @return {Promise} Returns a Promise with the result of the Klaviyo
   *     request.
   */
  getProfile(profileId: string) {
    assert(!!profileId, 'listId is required');
    this.ensurePrivateKey();

    const data = {
      api_key: this.privateKey
    };

    return this._requestKlaviyo('v1', `person/${profileId}`, data, undefined, 'get');
  }

  /**
   * Ensures costomer properties incldue an identifier (id or email)
   *
   * @param {Object} [customerProperties={}] - Custom information
   *     including $email or $id identifier about the person
   *     who did this event.
   * @memberof Klaviyo
   */
  ensureIdentifier(customerProperties: any) {
    assert(customerProperties.$email || customerProperties.$id, 'No identifier ($email or $id) found in customerProperties');
  }

  /**
   * Validates Klaviyo private key
   *
   * @param {Object} [customerProperties={}] - Custom information
   *     including $email or $id identifier about the person
   *     who did this event.
   * @memberof Klaviyo
   */
  ensurePrivateKey() {
    assert(this.privateKey, 'Klaviyo private key not set');
  }
}
