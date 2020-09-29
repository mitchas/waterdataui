import {select} from 'd3-selection';
import {createStructuredSelector} from 'reselect';

import config from '../../../config';
import {createMap, createBaseLayerGroup} from '../../../leaflet-rendering/map';
import {legendControl} from '../../../leaflet-rendering/legend-control';
import {link} from '../../../lib/d3-redux';
import {FLOOD_EXTENTS_ENDPOINT, FLOOD_BREACH_ENDPOINT, FLOOD_LEVEE_ENDPOINT} from '../../../web-services/flood-data';

import {hasFloodData, getFloodExtent, getFloodStageHeight} from '../../selectors/flood-data-selector';
import {hasNldiData, getNldiDownstreamFlows, getNldiDownstreamSites, getNldiUpstreamFlows, getNldiUpstreamSites, getNldiUpstreamBasin}
    from '../../selectors/nldi-data-selector';
import {Actions as nldiDataActions} from '../../store/nldi-data';
import {Actions as floodInundationActions} from '../../store/flood-inundation';

import {floodSlider} from './flood-slider';
import {addMonitoringLocationMarker, createFIMLegend, createNldiLegend} from './legend';
import {addNldiLayers} from './nldi-mapping';


const getLayerDefs = function(layerNo, siteno, stage) {
   const stageQuery = stage ? ` AND STAGE = ${stage}` : '';
   return `${layerNo}: USGSID = '${siteno}'${stageQuery}`;
};

/*
 * Creates a site map
 */
const siteMap = function(node, {siteno, latitude, longitude, zoom}, store) {
    const map = createMap('site-map', {
        center: [latitude, longitude],
        zoom: zoom
    });

    const baseMapLayers = {
        'Grayscale': createBaseLayerGroup('Gray', config.HYDRO_ENDPOINT || null),
        'Satellite': createBaseLayerGroup('ImageryFirefly', null)
    };
    map.addLayer(baseMapLayers['Grayscale']);

    //add layer control
    L.control.layers(baseMapLayers).addTo(map);

    const mlLegendControl = legendControl();
    mlLegendControl.addTo(map);
    addMonitoringLocationMarker(mlLegendControl);

    const floodLayer = L.esri.dynamicMapLayer({
        url: FLOOD_EXTENTS_ENDPOINT,
        layers: [0],
        f: 'image',
        format: 'png8'
    });
    const breachLayer = L.esri.dynamicMapLayer({
        url: FLOOD_BREACH_ENDPOINT,
        layers: [0],
        f: 'image',
        format: 'png8'
    });
    const leveeLayer = L.esri.dynamicMapLayer({
        url: FLOOD_LEVEE_ENDPOINT,
        layers: [0, 1],
        f: 'image',
        format: 'png8',
        layerDefs: `${getLayerDefs(0, siteno)};${getLayerDefs(1, siteno)}`
    });

    const updateFloodLayers = function (node, {hasFloodData, floodStageHeight}) {
        if (floodStageHeight) {
            const layerDefs = getLayerDefs(0, siteno, floodStageHeight);
            floodLayer.setLayerDefs(layerDefs);
            breachLayer.setLayerDefs(layerDefs);
        }
        if (hasFloodData) {
            if (!map.hasLayer(floodLayer)) {
                map.addLayer(floodLayer);
                map.addLayer(breachLayer);
                map.addLayer(leveeLayer);
            }

        } else {
            if (map.hasLayer(floodLayer)) {
                map.removeLayer(floodLayer);
                map.removeLayer(breachLayer);
                map.removeLayer(leveeLayer);
            }
        }
    };

    const updateNldiLayers = function (node, {upstreamFlows, downstreamFlows, upstreamSites, downstreamSites, upstreamBasin}) {
        addNldiLayers(map, upstreamFlows, downstreamFlows, upstreamSites, downstreamSites, upstreamBasin);
    };


    const updateMapExtent = function (node, extent) {
        if (Object.keys(extent).length > 0) {
            map.fitBounds(L.esri.Util.extentToBounds(extent).extend([latitude, longitude]));
        }
    };

    /*
     * Creates the FIM legend if FIM data is available, otherwise removes the FIM legend if it exists.
     * @param {HTMLElement} node - element where the map is rendered
     * @param {Boolean} isFIMAvailable
     */
    const addFIMLegend = function(node, hasFloodData) {
        createFIMLegend(mlLegendControl, hasFloodData);
    };

    const addFimLink = function (node, hasFloodData) {
        if (hasFloodData) {
            node.append('a')
                .attr('id', 'fim-link')
                .classed('usa-link', true)
                .attr('href', `${config.FIM_ENDPOINT}?site_no=${siteno}`)
                .attr('target', '_blank')
                .attr('rel', 'noopener')
                .text('Provisional Flood Information');
        } else {
            node.select('#fim-link').remove();
        }
    };

    // Add a marker at the site location
    L.marker([latitude, longitude]).addTo(map);

    /*
     * Creates the NLDI legend if NLDI data is available, otherwise removes the NLDI legend if it exists.
     * @param {HTMLElement} node - element where the map is rendered
     * @param {Boolean} isNldiAvailable
     */
    const addNldiLegend = function(node, isNldiAvailable) {
        createNldiLegend(mlLegendControl, isNldiAvailable);
    };

    node
        .call(link(store, updateFloodLayers, createStructuredSelector({
            hasFloodData: hasFloodData,
            floodStageHeight: getFloodStageHeight
        })))
        .call(link(store, updateMapExtent, getFloodExtent))
        .call(link(store, addFIMLegend, hasFloodData))
        .call(link(store, addFimLink, hasFloodData))
        .call(link(store, addNldiLegend, hasNldiData))
        .call(link(store, updateNldiLayers, createStructuredSelector({
            upstreamFlows: getNldiUpstreamFlows,
            downstreamFlows: getNldiDownstreamFlows,
            upstreamSites: getNldiUpstreamSites,
            downstreamSites: getNldiDownstreamSites,
            upstreamBasin: getNldiUpstreamBasin
        })));
};

/*
 * Creates the site map with node and attach it to the Redux store.
 * @param {Object} store - Redux store
 * @param {Object} node - DOM element
 * @param {String} siteno
 * @param {Number} latitude - latitude of siteno
 * @param {Number} longitude - longitude of siteno
 * @param {Number} zoom - zoom level to initially set the map to
 */
export const attachToNode = function(store, node, {siteno, latitude, longitude, zoom}) {
    store.dispatch(floodInundationActions.retrieveFloodData(siteno));
    // hydrates the store with nldi data
    store.dispatch(nldiDataActions.retrieveNldiData(siteno));

    select(node).select('#flood-layer-control-container')
        .call(floodSlider, store);
    select(node)
        .call(siteMap, {siteno, latitude, longitude, zoom}, store);
};

