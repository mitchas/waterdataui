import {utcFormat} from 'd3-time-format';
import config from 'ui/config';
import {get} from 'ui/ajax';

// Define Water Services root URL - use global variable if defined, otherwise
// use production.
const SERVICE_ROOT = config.SERVICE_ROOT || 'https://waterservices.usgs.gov/nwis';
const PAST_SERVICE_ROOT = config.PAST_SERVICE_ROOT  || 'https://nwis.waterservices.usgs.gov/nwis';
const WEATHER_SERVICE_ROOT = config.WEATHER_SERVICE_ROOT || 'https://api.weather.gov';

export const isoFormatTime = utcFormat('%Y-%m-%dT%H:%MZ');


function olderThan120Days(date) {
    return date < new Date() - 120;
}

function tsServiceRoot(date) {
    return olderThan120Days(date) ? PAST_SERVICE_ROOT : SERVICE_ROOT;
}

function getNumberOfDays(period) {
    const days = period.match(/\d+/);
    if (days.length === 1) {
        return parseInt(days[0]);
    } else {
        return null;
    }
}

/**
 * Get a given time series dataset from Water Services.
 * @param  {Array}    sites  Array of site IDs to retrieve.
 * @param  {Array}    params Optional array of parameter codes
 * @param {Date} startDate
 * @param {Date} endData
 * @param {String} period
 * @return {Promise} resolves to an array of time series model object, rejects to an error
 */
export const getTimeSeries = function({sites, params=null, startDate=null, endDate=null, period=null}) {
    let timeParams;
    let serviceRoot;

    if (!startDate && !endDate) {
        const timePeriod = period || 'P7D';
        const dayCount = getNumberOfDays(timePeriod);
        timeParams = `period=${timePeriod}`;
        serviceRoot = dayCount && dayCount < 120 ? SERVICE_ROOT : PAST_SERVICE_ROOT;
    } else {
        let startString = startDate ? isoFormatTime(startDate) : '';
        let endString = endDate ? isoFormatTime(endDate) : '';
        timeParams = `startDT=${startString}&endDT=${endString}`;
        serviceRoot = tsServiceRoot(startDate);
    }
    let paramCds = params !== null ? `&parameterCd=${params.join(',')}` : '';

    let url = `${serviceRoot}/iv/?sites=${sites.join(',')}${paramCds}&${timeParams}&siteStatus=all&format=json`;
    return get(url)
        .then(response => JSON.parse(response))
        .catch(reason => {
            console.error(reason);
            throw reason;
        });
};

export const getPreviousYearTimeSeries = function({site, startTime, endTime}) {
    let lastYearStartTime = new Date(startTime);
    let lastYearEndTime = new Date(endTime);

    lastYearStartTime.setFullYear(lastYearStartTime.getFullYear() - 1);
    lastYearEndTime.setFullYear(lastYearEndTime.getFullYear() - 1);
    return getTimeSeries({sites: [site], startDate: lastYearStartTime, endDate: lastYearEndTime});
};

export const queryWeatherService = function(latitude, longitude) {
    const url = `${WEATHER_SERVICE_ROOT}/points/${latitude},${longitude}`;
    return get(url)
        .then(response => JSON.parse(response))
        .catch(reason => {
            console.error(reason);
            return {properties: {}};
        });
};
