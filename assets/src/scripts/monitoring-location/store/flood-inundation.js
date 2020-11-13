import {fetchFloodExtent, fetchFloodFeatures,
    fetchWaterwatchFloodLevels} from 'ui/web-services/flood-data';

const INITIAL_DATA = {
    stages: [],
    extent: {}
};

/*
 * Synchronous Redux action to update the flood inundation data for stages and extents
 * @param {Array of Objects} stages
 * @param {Object} extent
 * @return {Object} Redux action
 */
const setFloodFeatures = function(stages, extent) {
    return {
        type: 'SET_FLOOD_FEATURES',
        stages,
        extent
    };
};

/*
 * Asynchronous Redux action to fetch the flood data features and extent
 * @param {String} siteno
 * @return {Function} which returns a Promise
 */
const retrieveFloodData = function(siteno) {
    return function(dispatch) {
        const floodFeatures = fetchFloodFeatures(siteno);
        const floodExtent = fetchFloodExtent(siteno);
        return Promise.all([floodFeatures, floodExtent]).then((data) => {
            const [features, extent] = data;
            const stages = features.map((feature) => feature.attributes.STAGE).sort(function(a, b) {
                return a - b;
            });
            dispatch(setFloodFeatures(stages, extent.extent ? extent.extent : {}));
        });
    };
};



/*
 * Slice reducer
 */
export const floodDataReducer = function(floodData=INITIAL_DATA, action) {

    floodData = {...floodData,
        INITIAL_DATA};

    switch(action.type) {
        case 'SET_FLOOD_FEATURES':
            return {
                ...floodData,
                stages: action.stages,
                extent: action.extent
            };
        case 'SET_WATERWACH_FLOOD_LEVELS':
            return {
                ...floodData,
                floodLevels: action.floodLevels
            };
        default: return floodData;
    }
};

/*
 * Synchronous action that sets the current gage height to be displayed
 * @param {Number} gageHeight
 * @return {Object} Redux action
 */
const setGageHeight = function(gageHeight) {
    return {
        type: 'SET_GAGE_HEIGHT',
        gageHeight
    };
};

/*
 * Synchronous Redux actions to save the waterwatch data
 * @param {JSON Object} floodLevels
 * @return {Object} Redux action
 */
const setWaterwatchFloodLevels = function(floodLevels) {
    return {
        type: 'SET_WATERWACH_FLOOD_LEVELS',
        floodLevels
    };
};

/*
 * Asynchronous Redux action to fetch the Waterwatch flood levels data
 * @param {String} siteno
 * @return {Function} which returns a Promise
 */
const retrieveWaterwatchData = function(siteno) {
    return function(dispatch) {
        return fetchWaterwatchFloodLevels(siteno).then(function(floodLevels) {
            dispatch(setWaterwatchFloodLevels(floodLevels));
        });
    };
};

/*
 * Slice reducer
 */
export const floodStateReducer = function(floodState={}, action) {

    switch(action.type) {
        case 'SET_GAGE_HEIGHT':
            return {
                ...floodState,
                gageHeight: action.gageHeight
            };
        default: return floodState;
    }
};


export const Actions = {
    setFloodFeatures,
    retrieveFloodData,
    setGageHeight,
    setWaterwatchFloodLevels,
    retrieveWaterwatchData
};