import {applyMiddleware, combineReducers, createStore} from 'redux';
import {default as thunk} from 'redux-thunk';

import {Actions, ivTimeSeriesStateReducer} from 'ml/store/instantaneous-value-time-series-state';

describe('monitoring-location/store/instantaneous-value-time-series-state', () => {
    let store;

    beforeEach(() => {
        store = createStore(
            combineReducers({
                ivTimeSeriesState: ivTimeSeriesStateReducer
            }),
            {
                ivTimeSeriesState: {
                    loadingIVTSKeys: []
                }
            },
            applyMiddleware(thunk)
        );
    });

    describe('ivTimeSeriesStateReducer', () => {
        describe('setIVTimeSeriesVisibility', () => {
            it('Sets the time series visibility', () => {
                store.dispatch(Actions.setIVTimeSeriesVisibility('compare', true));
                expect(store.getState().ivTimeSeriesState.showIVTimeSeries.compare).toBe(true);
            });
        });

        describe('setCurrentIVVariable', () => {
            it('Sets the current IV variable id', () => {
                store.dispatch(Actions.setCurrentIVVariable('456789'));
                expect(store.getState().ivTimeSeriesState.currentIVVariableID).toBe('456789');
            });
        });

        describe('setCurrentIVMethodId', () => {
            it('sets the current IV method id', () => {
                store.dispatch(Actions.setCurrentIVMethodID('1345'));
                expect(store.getState().ivTimeSeriesState.currentIVMethodID);
            });
        });

        describe('setCurrentIVDateRange', () => {
            it('sets the current date range kind', () => {
                store.dispatch(Actions.setCurrentIVDateRange('P30D'));
                expect(store.getState().ivTimeSeriesState.currentIVDateRange).toBe('P30D');
            });
        });

        describe('setCustomIVTimeRange', () => {
            it('sets the custom time range', () => {
                store.dispatch(Actions.setCustomIVTimeRange(1586880394000, 1587398794000));
                const state = store.getState().ivTimeSeriesState;

                expect(state.customIVTimeRange).toEqual({
                    start: 1586880394000,
                    end: 1587398794000
                });
            });
        });

        describe('setIVGraphCursorOffset', () => {
            it('sets the IV graph cursor offset', () => {
                store.dispatch(Actions.setIVGraphCursorOffset(100200300));
                expect(store.getState().ivTimeSeriesState.ivGraphCursorOffset).toBe(100200300);
            });
        });

        describe('setIVGraphBrushOffset', () => {
            it('sets the IV graph brush offset', () => {
                store.dispatch(Actions.setIVGraphBrushOffset(100200, 300400));

                expect(store.getState().ivTimeSeriesState.ivGraphBrushOffset).toEqual({
                    start: 100200,
                    end: 300400
                });
            });
        });

        describe('clearIVGraphBrushOffset', () => {
            it('clears the iv graph brush offset', () => {
                store.dispatch(Actions.setIVGraphBrushOffset(100200, 300400));
                store.dispatch(Actions.clearIVGraphBrushOffset());

                expect(store.getState().ivTimeSeriesState.ivGraphBrushOffset).not.toBeDefined();
            });
        });

        describe('addIVTimeSeriesToLoadingKeys', () => {
            it('expects to add keys to ts loading keys', () => {
                store.dispatch(Actions.addIVTimeSeriesToLoadingKeys(['current:P7D']));
                expect(store.getState().ivTimeSeriesState.loadingIVTSKeys).toEqual(['current:P7D']);

                store.dispatch(Actions.addIVTimeSeriesToLoadingKeys(['compare:P7D', 'current:P30D']));
                const keys = store.getState().ivTimeSeriesState.loadingIVTSKeys;
                expect(keys).toContain('current:P7D');
                expect(keys).toContain('compare:P7D');
                expect(keys).toContain('current:P30D');
            });
        });

        describe('removeIVTimeSeriesFromLoadingKeys', () => {
            it('expects to remove keys', () => {
                store.dispatch(Actions.addIVTimeSeriesToLoadingKeys(['compare:P7D', 'current:P30D']));
                store.dispatch(Actions.removeIVTimeSeriesFromLoadingKeys(['current:P30D']));
                expect(store.getState().ivTimeSeriesState.loadingIVTSKeys).toEqual(['compare:P7D']);
            });
        });

        describe('startTimeSeriesPlay', () => {

            let mockDispatch, mockGetState;

            beforeEach(() => {
                mockDispatch = jasmine.createSpy('mockDispatch');
                mockGetState = jasmine.createSpy('mockGetState');

                jasmine.clock().install();
                spyOn(Actions, 'setIVGraphCursorOffset');
                spyOn(Actions, 'ivTimeSeriesPlayOn');
                spyOn(Actions, 'ivTimeSeriesPlayStop');
            });

            afterEach(() => {
                jasmine.clock().uninstall();
            });

            it('Does not reset the cursor offset when current offset is not null or greater than the max offset ', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 0
                    }
                });
                Actions.startTimeSeriesPlay(2700000)(mockDispatch, mockGetState);

                expect(Actions.setIVGraphCursorOffset).not.toHaveBeenCalled();
            });

            it('Call the action to start time series play', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 0
                    }
                });
                Actions.startTimeSeriesPlay(2700000)(mockDispatch, mockGetState);

                expect(Actions.ivTimeSeriesPlayOn).toHaveBeenCalled();
            });

            it('Expects the cursor to be updated after 10 milliseconds', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 0
                    }
                }, {
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 0
                    }
                });
                Actions.startTimeSeriesPlay(2700000)(mockDispatch, mockGetState);
                jasmine.clock().tick(11);

                expect(Actions.setIVGraphCursorOffset.calls.count()).toBe(1);
                expect(Actions.setIVGraphCursorOffset.calls.argsFor(0)[0]).toBe(900000);
            });

            it('Expects the cursor to be reset if the cursor offset is greater than the maxCursorOffset', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 2700000
                    }
                });

                Actions.startTimeSeriesPlay(2700000)(mockDispatch, mockGetState);

                expect(Actions.setIVGraphCursorOffset).toHaveBeenCalledWith(0);
            });

            it('Expects the play to be stopped if the cursorOffset exceeds the maxCursorOffset', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 2100000
                    }
                }, {
                    ivTimeSeriesState: {
                        ivGraphCursorOffset: 2100000
                    }
                });
                Actions.startTimeSeriesPlay(2700000)(mockDispatch, mockGetState);
                jasmine.clock().tick(11);

                expect(Actions.ivTimeSeriesPlayStop).toHaveBeenCalled();
            });
        });

        describe('stopTimeSeriesPlay', () => {
            let mockDispatch, mockGetState;

            beforeEach(() => {
                mockDispatch = jasmine.createSpy('mockDispatch');
                mockGetState = jasmine.createSpy('mockGetState');

                jasmine.clock().install();
                spyOn(Actions, 'ivTimeSeriesPlayStop');
            });

            afterEach(() => {
                jasmine.clock().uninstall();
            });

            it('Expects that ivTimeSeriesPlayStop is called', () => {
                mockGetState.and.returnValues({
                    ivTimeSeriesState: {
                        audiblePlayId: 1
                    }
                });

                Actions.stopTimeSeriesPlay()(mockDispatch, mockGetState);
                expect(Actions.ivTimeSeriesPlayStop).toHaveBeenCalled();
            });
        });

        describe('setUserInputsForSelectingTimespan', () => {
            it('sets the value for which of the main time range selection buttons are checked', () => {
                store.dispatch(Actions.setUserInputsForSelectingTimespan('mainTimeRangeSelectionButton', 'custom'));
                expect(store.getState().ivTimeSeriesState.userInputsForTimeRange.mainTimeRangeSelectionButton).toBe('custom');
            });

            it('sets the value for which of the Custom subselection time range selection buttons are checked', () => {
                store.dispatch(Actions.setUserInputsForSelectingTimespan('customTimeRangeSelectionButton', 'calender-input'));
                expect(store.getState().ivTimeSeriesState.userInputsForTimeRange.customTimeRangeSelectionButton).toBe('calender-input');
            });

            it('sets the value entered in the Custom subselection from field for days before today', () => {
                store.dispatch(Actions.setUserInputsForSelectingTimespan('numberOfDaysFieldValue', '23'));
                expect(store.getState().ivTimeSeriesState.userInputsForTimeRange.numberOfDaysFieldValue).toBe('23');
            });
        });
    });
});
