/**
 * Hydrograph charting module.
 */
const { bisector, extent } = require('d3-array');
const { mouse, select } = require('d3-selection');
const { line } = require('d3-shape');
const { createSelector, createStructuredSelector } = require('reselect');

const { addSVGAccessibility, addSROnlyTable } = require('../../accessibility');
const { dispatch, link, provide } = require('../../lib/redux');

const { appendAxes, axesSelector } = require('./axes');
const { ASPECT_RATIO_PERCENT, MARGIN, CIRCLE_RADIUS, layoutSelector } = require('./layout');
const { pointsSelector, lineSegmentsSelector, isVisibleSelector } = require('./points');
const { xScaleSelector, yScaleSelector } = require('./scales');
const { Actions, configureStore } = require('./store');
const { drawSimpleLegend, legendDisplaySelector, createLegendMarkers } = require('./legend');


// Function that returns the left bounding point for a given chart point.
const bisectDate = bisector(d => d.time).left;



const drawMessage = function (elem, message) {
    // Set up parent element and SVG
    elem.innerHTML = '';
    const alertBox = elem
        .append('div')
            .attr('class', 'usa-alert usa-alert-warning')
            .append('div')
                .attr('class', 'usa-alert-body');
    alertBox
        .append('h3')
            .attr('class', 'usa-alert-heading')
            .html('Hydrograph Alert');
    alertBox
        .append('p')
            .html(message);
};


const plotDataLine = function (elem, {visible, lines, tsDataKey, xScale, yScale}) {
    const elemId = 'ts-' + tsDataKey;
    elem.selectAll(`#${elemId}`).remove();

    if (!visible) {
        return;
    }

    const tsLine = line()
        .x(d => xScale(new Date(d.time)))
        .y(d => yScale(d.value));

    for (let line of lines) {
        if (line.classes.masks.size === 0) {
            elem.append('path')
                .datum(line.points)
                .classed('line', true)
                .classed('approved', line.classes.approved)
                .classed('estimated', line.classes.estimated)
                .attr('data-title', tsDataKey)
                .attr('id', `ts-${tsDataKey}`)
                .attr('d', tsLine);
        }
        else {
            elem.selectAll('.mask-group').remove();
            let xMaskExtent = extent(line.points, d => d.time);
            let [xDomainStart, xDomainEnd] = xMaskExtent;
            let [yRangeStart, yRangeEnd] = yScale.domain();
            let maskGroup = elem
                .append('g')
                    .attr('class', 'mask-group');

            maskGroup.append('rect')
                .attr('x', xScale(xDomainStart))
                .attr('y', yScale(yRangeEnd))
                .attr('width', xScale(xDomainEnd) - xScale(xDomainStart))
                .attr('height', Math.abs(yScale(yRangeEnd)- yScale(yRangeStart)))
                .attr('class', 'generic-mask');

            maskGroup.append('rect')
                .attr('x', xScale(xDomainStart))
                .attr('y', yScale(yRangeEnd))
                .attr('width', xScale(xDomainEnd) - xScale(xDomainStart))
                .attr('height', Math.abs(yScale(yRangeEnd)- yScale(yRangeStart)))
                .attr('fill', 'url(#hash-45)');
        }
    }
};


const getNearestTime = function (data, time) {
    let index = bisectDate(data, time, 1);
    let datum;
    let d0 = data[index - 1];
    let d1 = data[index];

    if (d0 && d1) {
        datum = time - d0.time > d1.time - time ? d1 : d0;
    } else {
        datum = d0 || d1;
    }

    // Return the nearest data point and its index.
    return {
        datum,
        index: datum === d0 ? index - 1 : index
    };
};


const plotTooltips = function (elem, {xScale, yScale, data}) {
    // Create a node to hightlight the currently selected date/time.
    let focus = elem.append('g')
        .attr('class', 'focus')
        .style('display', 'none');
    focus.append('circle')
        .attr('r', 7.5);
    focus.append('text');

    elem.append('rect')
        .attr('class', 'overlay')
        .attr('width', '100%')
        .attr('height', '100%')
        .on('mouseover', () => focus.style('display', null))
        .on('mouseout', () => focus.style('display', 'none'))
        .on('mousemove', function () {
            // Get the nearest data point for the current mouse position.
            const time = xScale.invert(mouse(this)[0]);
            const {datum, index} = getNearestTime(data, time);
            if (!datum) {
                return;
            }

            // Move the focus node to this date/time.
            focus.attr('transform', `translate(${xScale(datum.time)}, ${yScale(datum.value)})`);

            // Draw text, anchored to the left or right, depending on
            // which side of the graph the point is on.
            const isFirstHalf = index < data.length / 2;
            focus.select('text')
                .text(() => datum.label)
                .attr('text-anchor', isFirstHalf ? 'start' : 'end')
                .attr('x', isFirstHalf ? 15 : -15)
                .attr('dy', isFirstHalf ? '.31em' : '-.31em');
        });
};


const plotPatterns = function(elem) {

    let defs = elem.append('defs');

    defs.append('mask')
        .attr('id', 'display-mask')
        .attr('maskUnits', 'userSpaceOnUse')
        .append('rect')
            .attr('x', '0')
            .attr('y', '0')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', '#0000ff');

    defs.append('pattern')
        .attr('id', 'hash-45')
        .attr('width', '8')
        .attr('height', '8')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('patternTransform', 'rotate(45)')
        .append('rect')
            .attr('width', '4')
            .attr('height', '8')
            .attr('transform', 'translate(0, 0)')
            .attr('mask', 'url(#display-mask)');

    defs.append('pattern')
        .attr('id', 'hash-135')
        .attr('width', '8')
        .attr('height', '8')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('patternTransform', 'rotate(135)')
        .append('rect')
            .attr('width', '4')
            .attr('height', '8')
            .attr('transform', 'translate(0, 0)')
            .attr('mask', 'url(#display-mask)');


};


const plotLegend = function(elem, {displayItems, width}) {
    elem.select('.legend').remove();
    let markers = createLegendMarkers(displayItems);
    drawSimpleLegend(elem, markers, width);
};


const plotMedianPoints = function (elem, {visible, xscale, yscale, medianStatsData}) {
    elem.select('#median-points').remove();

    if (!visible) {
        return;
    }

    const container = elem
        .append('g')
            .attr('id', 'median-points');

    container.selectAll('medianPoint')
        .data(medianStatsData)
        .enter()
        .append('circle')
            .attr('id', 'median-point')
            .attr('class', 'median-data-series')
            .attr('r', CIRCLE_RADIUS)
            .attr('cx', function(d) {
                return xscale(d.time);
            })
            .attr('cy', function(d) {
                return yscale(d.value);
            });

    container.selectAll('medianPointText')
        .data(medianStatsData)
        .enter()
        .append('text')
            .text(function(d) {
                return d.label;
            })
            .attr('id', 'median-text')
            .attr('x', function(d) {
                return xscale(d.time) + 5;
            })
            .attr('y', function(d) {
                return yscale(d.value);
            });
};


const timeSeriesGraph = function (elem) {
    elem.append('div')
        .attr('class', 'hydrograph-container')
        .style('padding-bottom', ASPECT_RATIO_PERCENT)
        .append('svg')
            .call(link((elem, layout) => elem.attr('viewBox', `0 0 ${layout.width} ${layout.height}`), layoutSelector))
            .call(link(addSVGAccessibility, createStructuredSelector({
                title: state => state.title,
                description: state => state.desc,
                isInteractive: () => true
            })))
            .call(plotPatterns)
            .call(link(plotLegend, createStructuredSelector({
                displayItems: legendDisplaySelector,
                width: state => state.width
            })))
            .append('g')
                .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
                .call(link(appendAxes, axesSelector))
                .call(link(plotDataLine, createStructuredSelector({
                    visible: isVisibleSelector('current'),
                    lines: lineSegmentsSelector('current'),
                    xScale: xScaleSelector('current'),
                    yScale: yScaleSelector,
                    tsDataKey: () => 'current'
                })))
                .call(link(plotDataLine, createStructuredSelector({
                    visible: isVisibleSelector('compare'),
                    lines: lineSegmentsSelector('compare'),
                    xScale: xScaleSelector('compare'),
                    yScale: yScaleSelector,
                    tsDataKey: () => 'compare'
                })))
                .call(link(plotTooltips, createStructuredSelector({
                    xScale: xScaleSelector('current'),
                    yScale: yScaleSelector,
                    data: pointsSelector('current')
                })))
                .call(link(plotMedianPoints, createStructuredSelector({
                    visible: isVisibleSelector('medianStatistics'),
                    xscale: xScaleSelector('current'),
                    yscale: yScaleSelector,
                    medianStatsData: pointsSelector('medianStatistics')
                })));

    elem.append('div')
        .call(link(addSROnlyTable, createStructuredSelector({
            columnNames: createSelector(
                (state) => state.title,
                (title) => [title, 'Time']
            ),
            data: createSelector(
                pointsSelector('current'),
                points => points.map((value) => {
                    return [value.value, value.time];
                })
            ),
            describeById: () => {return 'time-series-sr-desc'},
            describeByText: () => {return 'current time series data in tabular format'}
    })));

    elem.append('div')
        .call(link(addSROnlyTable, createStructuredSelector({
            columnNames: createSelector(
                (state) => state.title,
                (title) => [`Median ${title}`, 'Time']
            ),
            data: createSelector(
                pointsSelector('medianStatistics'),
                points => points.map((value) => {
                    return [value.value, value.time];
                })
            ),
            describeById: () => {return 'median-statistics-sr-desc'},
            describeByText: () => {return 'median statistical data in tabular format'}
    })));
};


const attachToNode = function (node, {siteno} = {}) {
    if (!siteno) {
        select(node).call(drawMessage, 'No data is available.');
        return;
    }

    let store = configureStore();

    store.dispatch(Actions.resizeTimeseriesPlot(node.offsetWidth));
    select(node)
        .call(provide(store))
        .call(timeSeriesGraph)
        .select('.hydrograph-last-year-input')
            .on('change', dispatch(function () {
                return Actions.toggleTimeseries('compare', this.checked);
            }));

    window.onresize = function() {
        store.dispatch(Actions.resizeTimeseriesPlot(node.offsetWidth));
    };
    store.dispatch(Actions.retrieveTimeseries(siteno));
};


module.exports = {attachToNode, getNearestTime, timeSeriesGraph};
