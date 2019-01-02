
'use strict';

/**
 * Dependencies
 */

const request      = require('request-promise-native'),
      cheerio      = require('cheerio'),
      EventEmitter = require('events'),
      crypto       = require('crypto');

module.exports = class GfmTracker extends EventEmitter {

  constructor(projectName) {

    super();

    this.intervalID = null;
    this.recordedDonations = [];
    this.req = request.defaults({

      uri: 'https://www.gofundme.com/mvc.php',
      timeout: 2000,
      gzip: true,
      headers: {

        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'

      },
      qs: {

        route: 'donate/pagingDonationsFoundation',
        url: projectName,
        type: 'recent'

      }

    });

  }

  stopTracking() {

    clearInterval(this.intervalID);

  }

  track(interval = 5000) {

    if (this.intervalID)
      clearInterval(this.intervalID);

    this.intervalID = setInterval(() => {

      this.getNewDonations()
        .then(newDonations => {

          if (newDonations.length)
            this.emit('new-donations', newDonations);

        })
        .catch(err => this.emit('error', err));

    }, interval);

  }

  async getNewDonations() {

    const pageSource = await this.req();

    const recentDonations = GfmTracker.getRecentDonations(pageSource);

    const newDonations = recentDonations
      .filter(donation => !this.recordedDonations.includes(donation._id));

    if (!newDonations.length)
      return newDonations;

    this.recordedDonations = [...newDonations.map(donation => donation._id), ...this.recordedDonations]
      .slice(0, 20);

    return newDonations;

  }

  static getRecentDonations(source) {

    const $ = cheerio.load(source);

    return $('.supporters-list').find('.supporter').map(function() {

      const donorName   = $(this).find('.supporter-info .supporter-name').text().trim(),
            donorAmount = $(this).find('.supporter-info .supporter-amount').text(),
            donorTime   = $(this).find('.supporter-info .supporter-time').text(),
            donorDataID = $(this).attr('data-id');

      return {

        _id: crypto.createHash('md5').update(donorAmount + donorName + donorDataID).digest('hex'),
        amount: donorAmount,
        dataID: donorDataID,
        name: donorName,
        time: donorTime

      };

    }).get();

  }

};
