import {select} from 'd3-selection';
import groupBy from 'lodash/groupBy';
import includes from 'lodash/includes';

import {getAvailableDVTimeSeries, getAllDVTimeSeries} from 'ml/selectors/daily-value-time-series-selector';
import {Actions} from 'ml/store/daily-value-time-series';

import {drawErrorAlert, drawInfoAlert} from 'd3render/alerts';
import {drawLoadingIndicator} from 'd3render/loading-indicator';

import {drawGraphBrush} from 'dvhydrograph/graph-brush';
import {drawGraphControls} from 'dvhydrograph/graph-controls';
import {drawTimeSeriesLegend} from 'dvhydrograph/legend';
import {drawTimeSeriesGraph} from 'dvhydrograph/time-series-graph';
import {drawTooltipCursorSlider} from 'dvhydrograph/tooltip';

const GROUND_WATER_LEVELS_PARM_CD  = ['62610', '62611', '72019', '72020', '72150', '72226', '72227', '72228', '72229', '72230', '72231', '72232'];
const STATISTIC_CODES = {
    min: '00002',
    mean: '00003',
    max: '00001'
};

/*
 * Returns the set of time series for a single parameter code. That code must
 * be in GROUND_WATER_LEVELS_PARM_CD and contain one or more STATISTIC_CODES. If more
 * than one parameter code has time series than the one with the most of the
 * desired statistics codes will be chosen.
 * @return Object - available time series object
 */
const getBestAvailableTimeSeriesToUse = function(availableTimeSeries) {
    const gwAvailableTimeSeries = availableTimeSeries
        .filter(ts => includes(GROUND_WATER_LEVELS_PARM_CD, ts.parameterCode))
        .filter(ts => includes(Object.values(STATISTIC_CODES), ts.statisticCode));
    let gwByParmCode = groupBy(gwAvailableTimeSeries, ts => ts.parameterCode);
    let bestParamToUse = Object.values(gwByParmCode).sort((a, b) => a.length - b.length);
    return bestParamToUse.length ? bestParamToUse[0] : [];
};

const getTSId = function(id) {
   return id.split('-')[2];
};

/*
 * Creates the daily value hydrograph component on the DOM element node for siteno and state
 * information that is stored in the Redux store.
 * @param {Object} store - Redux store
 * @param {Object} node - DOM element parent for this component
 * @param {String} siteno - the site number of the monitoring location.
 */
export const attachToNode = function(store,
                                      node,
                                      {
                                          siteno
                                      } = {}) {
    const nodeElem = select(node);
    if (!siteno) {
        nodeElem.call(drawErrorAlert, {
            title: 'Must specify monitoring location ID',
            body: ''
        });
        return;
    }

    const monitoringLocationId = `USGS-${siteno}`;
    const loadingIndicator = nodeElem.select('.loading-indicator-container')
        .call(drawLoadingIndicator, {showLoadingIndicator: true, sizeClass: 'fa-3x'});
    const fetchAvailableDVTimeSeries = store.dispatch(Actions.retrieveAvailableDVTimeSeries(monitoringLocationId));
    fetchAvailableDVTimeSeries.then(() => {
        const bestAvailableTimeSeries = getBestAvailableTimeSeriesToUse(getAvailableDVTimeSeries(store.getState()));
        if (bestAvailableTimeSeries.length) {
            const fetchDVTimeSeries = bestAvailableTimeSeries
                .map(availableTs => getTSId(availableTs.id))
                .map(id => store.dispatch(Actions.retrieveDVTimeSeries(monitoringLocationId, id)));
            Promise.allSettled(fetchDVTimeSeries).then(() => {
                let min, mean, max = null;
                let allDVTimeSeries = getAllDVTimeSeries(store.getState());
                Object.keys(allDVTimeSeries).forEach((tsId) => {
                    switch (allDVTimeSeries[tsId].properties.statistic) {
                        case 'MINIMUM':
                            min = tsId;
                            break;
                        case 'MEAN':
                            mean = tsId;
                            break;
                        case 'MAXIMUM':
                            max = tsId;
                    }
                });
                store.dispatch(Actions.setCurrentDVTimeSeriesIds(min, mean, max));
                loadingIndicator.call(drawLoadingIndicator, {showLoadingIndicator: false, sizeClass: 'fa-3x'});
                let graphContainer = nodeElem.select('.graph-container');
                graphContainer
                    .call(drawGraphControls, store)
                    .call(drawTimeSeriesGraph, store)
                    .call(drawTooltipCursorSlider, store)
                    .call(drawGraphBrush, store)
                    .append('div')
                        .classed('dv-legend-container', true)
                        .call(drawTimeSeriesLegend, store);
            });

        } else {
            loadingIndicator.call(drawLoadingIndicator, {showLoadingIndicator: false, sizeClass: 'fa-3x'});
            drawInfoAlert(nodeElem, {
                title: 'No Daily Value StatisticalData',
                body: 'There is no ground water level statistical daily data available for this site'
            });
        }
    });
};
