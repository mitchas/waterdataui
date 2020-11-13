import {brushX} from 'd3-brush';
import {event} from 'd3-selection';
import {createStructuredSelector} from 'reselect';

import {appendXAxis} from '../../../d3-rendering/axes';
import {link} from '../../../lib/d3-redux';
import {Actions} from '../../store/instantaneous-value-time-series-state';

import {getBrushXAxis} from './selectors/axes';
import {getCurrentVariableLineSegments} from './selectors/drawing-data';
import {getBrushLayout} from './selectors/layout';
import {getBrushXScale, getBrushYScale} from './selectors/scales';
import {isVisible} from './selectors/time-series-data';
import {drawDataLines} from './time-series-lines';
import {mediaQuery} from '../../../utils';
import config from '../../../config';

/*
 * Renders a brush element within container for the main graph
 * @param {D3 selection} container
 * @param {Redux store} store
 */
export const drawGraphBrush = function(container, store) {
    const BRUSH_HINT_TOP_POSITION = 9;
    let customHandle;
    let layoutHeight;

    const brushed = function() {
        const CENTERING_DIVISOR_LARGE_SCREEN = 3.3;
        const CENTERING_DIVISOR_SMALL_SCREEN = 2.5;

        customHandle.attr('transform', function(d, index) {
            const yPositionForCustomHandle = mediaQuery(config.USWDS_LARGE_SCREEN) ?
                -layoutHeight / CENTERING_DIVISOR_LARGE_SCREEN :
                -layoutHeight / CENTERING_DIVISOR_SMALL_SCREEN;
            return event.selection != null ? `translate(${event.selection[index]}, ${yPositionForCustomHandle})` : null;
        });

        if (!event.sourceEvent || event.sourceEvent.type === 'zoom') {
            return;
        }

        const xScale = getBrushXScale('current')(store.getState());
        const brushRange = event.selection || xScale.range();

        // Only adjust the main hydrograph when user is done adjusting the time range.
        if (event.sourceEvent.type === 'mouseup' || event.sourceEvent.type === 'touchend') {
            const adjustedBrush = brushRange.map(xScale.invert, xScale);

            store.dispatch(Actions.setIVGraphBrushOffset(
                adjustedBrush[0]- xScale.domain()[0],
                xScale.domain()[1] - adjustedBrush[1]));
        }
    };

    const div = container.append('div')
        .attr('class', 'hydrograph-container');
    div.append('svg')
        .classed('brush-svg', true)
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .call(link(store,(elem, layout) => {
                elem.attr('viewBox', `0 0 ${layout.width + layout.margin.left + layout.margin.right} ${layout.height + layout.margin.bottom + layout.margin.top}`);
            }, getBrushLayout
        ))
        .call(svgTarget => {
            svgTarget.append('text')
                .classed('brush-text-hint', true)
                .text('drag handles to change timeframe')
                .call(link(store,(elem, layout) => elem.attr('transform', `translate(${layout.width / 2 + layout.margin.left}, ${BRUSH_HINT_TOP_POSITION})`),
                    getBrushLayout
                ));
        })
        .call(svg => {
            svg.append('g')
                .call(link(store,(elem, layout) => elem.attr('transform', `translate(${layout.margin.left}, ${layout.margin.top})`),
                    getBrushLayout
                ))
                .call(link(store, appendXAxis, createStructuredSelector({
                    xAxis: getBrushXAxis,
                    layout: getBrushLayout
                })))
                .call(link(store, drawDataLines, createStructuredSelector({
                    visible: isVisible('current'),
                    tsLinesMap: getCurrentVariableLineSegments('current'),
                    xScale: getBrushXScale('current'),
                    yScale: getBrushYScale,
                    tsKey: () => 'current',
                    enableClip: () => false
                })));
        })
        .call(link(store, (svg, {layout, hydrographBrushOffset, xScale}) => {
            let selection;
            layoutHeight = layout.height;

            const graphBrush = brushX()
                .extent([[0, 0], [layout.width - layout.margin.right, layout.height - layout.margin.bottom - layout.margin.top]])
                .handleSize([1]) // make default handle 1px wide
                .on('start brush end', brushed);

            svg.select('.brush').remove();

            const group = svg.append('g').attr('class', 'brush')
                .attr('transform', `translate(${layout.margin.left}, ${layout.margin.top})`)
                .call(graphBrush);

            /* Draws the custom brush handle using an SVG path. The path is drawn twice, once for the handle
            * on the left hand side, which in d3 brush terms is referred to as 'east' (data type 'e'), and then
            * inverted for the right hand custom handle. Here 'east' will be a value of either 1 or 0 (in effect, making
            * it a boolean value of 'east' or 'not east' */
            const brushResizePath = function(d) {
                const east = d.type === 'e' ? 1:0;
                const x = east ? 1 : -1;
                const y = layoutHeight / 2;

                // Create the svg path using the standard SVG commands M, A, V etc. and substituted variables.
                return `M ${.5 * x},${y}
                    A6,6 0 0 ${east} ${6.5 * x},${y + 6}
                    V${2 * y - 6}
                    A6,6 0 0 ${east} ${.5 * x},${2 * y}
                    Z
                    M${2.5 * x},${y + 8}
                    V${2 * y - 8}
                    M${4.5 * x},${y + 8}
                    V${2 * y - 8}`;
            };

            /* Attaches the custom brush handle to the DOM and binds d3 brush data placeholders 'w' for the west end (right side)
            * and 'e' for east end of the brush area */
            customHandle = group.selectAll('.handle--custom')
                .data([{type: 'w'}, {type: 'e'}])
                .enter().append('path')
                .attr('class', 'handle--custom')
                .attr('d', brushResizePath);

            // Add a class so the default handles can have styling that won't conflict with the slider handle
            svg.selectAll('.handle').classed('standard-brush-handle', true);

            if (hydrographBrushOffset) {
                const [startMillis, endMillis] = xScale.domain();
                selection = [
                    xScale(startMillis + hydrographBrushOffset.start),
                    xScale(endMillis - hydrographBrushOffset.end)
                ];
            } else {
                selection = xScale.range();
            }
            if (selection[1] - selection[0] > 0) {
                graphBrush.move(group, selection);
            }

        }, createStructuredSelector({
            layout: getBrushLayout,
            hydrographBrushOffset: (state) => state.ivTimeSeriesState.ivGraphBrushOffset,
            xScale: getBrushXScale('current')
        })));
};
