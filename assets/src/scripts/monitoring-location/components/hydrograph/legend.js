import {createStructuredSelector} from 'reselect';

import {drawSimpleLegend} from 'd3render//legend';
import {link} from 'ui/lib/d3-redux';

import {getMainLayout} from 'ivhydrograph/selectors/layout';
import {getLegendMarkerRows} from 'ivhydrograph/selectors/legend-data';


export const drawTimeSeriesLegend = function(elem, store) {
    elem.append('div')
        .classed('hydrograph-container', true)
        .call(link(store, drawSimpleLegend, createStructuredSelector({
            legendMarkerRows: getLegendMarkerRows,
            layout: getMainLayout
        })));
};

