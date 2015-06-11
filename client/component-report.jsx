var _ = require('lodash');
var React = require('react');

var Reports = require('./reports');
var ReportItem = require('./component-report-item.jsx');
var Notice = require('./component-notice.jsx');
var UpdateCounter = require('./component-update-counter.jsx');

var HOUR = 60 * 60 * 1000;

module.exports = React.createClass({
    getInitialState: function() {
        return {
            index: null,
            lastRefreshed: Date.now(),
            timespanLatest: Date.now(),
            updatesCount: 0,
            newCount: 0,
            hasOrderBroken: false
        };
    },
    render: function() {
        var latest = this.state.timespanLatest;
        var earliest = _.reduce(this.state.index, getEarliest, latest);

        var items = _.map(this.state.index, function(data) {
            return <ReportItem
                key={ data._id }
                type={ this.props.type }
                data={ data }
                timespan={ {
                    earliest: earliest,
                    latest: latest
                } }
                onClick={ _.partial(this.props.onClick, data) } />;
        }, this);

        return <div className="report">
            { this.notice() }
            <UpdateCounter count={ this.state.updatesCount } since={ this.state.lastRefreshed } onClick={ this.createIndex } />
            <table className="report__table">
                { this.thead() }
                <tbody>
                    { items.length ? items: this.empty() }
                </tbody>
            </table>
        </div>;
    },
    empty: function() {
        var label = _.isNull(this.state.index) ? 'Loading…' : 'Nothing to display';

        return <tr>
            <td colSpan='4' className='report__cell report__cell_single'>
                { label }
            </td>
        </tr>;
    },
    thead: function() {
        var title = 'Message';

        if (this.props.type === 'browsers') {
            title = 'Browser';
        } else if (this.props.type === 'scripts') {
            title = 'Script';
        } else if (this.props.type === 'pages') {
            title = 'Page URL';
        }

        return <thead>
            <tr className='report__row report__row_head'>
                <th className='report__cell report__cell_head'>{ title }</th>
                <th className='report__cell report__cell_head report__cell_count'>Count</th>
                <th className='report__cell report__cell_head report__cell_delta' />
                <th className='report__cell report__cell_head report__cell_timespan'>Timespan</th>
            </tr>
        </thead>;
    },
    notice: function() {
        if (this.state.newCount) {
            return <Notice count={ this.state.newCount } onClick={ this.createIndex } />;
        } else if (this.state.hasOrderBroken) {
            return <Notice onClick={ this.createIndex } />;
        }
    },
    componentDidMount: function() {
        this._interval = setInterval(this.updateTimespan, HOUR);
        this.fetchData(this.props);
    },
    componentWillReceiveProps: function(props) {
        if (this.props.type !== props.type) {
            this.setState(this.getInitialState());
        }

        this.fetchData(props);
    },
    componentWillUnmount: function() {
        clearInterval(this._interval);
    },
    fetchData: function(props) {
        Reports.fetch(props.type)
            .then(this.updateData)
            .catch(function(err) {
                console.log(err);
            });
    },
    updateData: function() {
        if (_.isEmpty(this.state.index)) {
            this.createIndex();
        } else {
            this.updateIndex();
        }
    },
    createIndex: function() {
        var raw = Reports.get(this.props.type);
        var index = _.clone(raw);

        this.setState(_.extend(this.getInitialState(), {index: index}));
    },
    updateIndex: function() {
        var raw = Reports.get(this.props.type);
        var data = _.clone(raw);

        var addIndex = _.partial(addCurrentIndex, this.state.index);
        var addDelta = _.partial(countDelta, this.state.index);
        var indexed = _.map(data, _.compose(addDelta, addIndex));

        var rows = partition(indexed, isIndexed);
        var index = rows[0].sort(sortByCurrentIndex);

        this.setState({
            index: index,
            hasOrderBroken: !isSortedByCount(index),
            updatesCount: sumDeltas(indexed),
            newCount: rows[1].length,
            timespanLatest: Date.now()
        });
    },
    updateTimespan: function() {
        this.setState({
            timespanLatest: Date.now()
        });
    }
});

function getEarliest(memo, item) {
    return _.min([memo, item.earliest]);
}

function sortByLatestReport(a, b) {
    return b.latest - a.latest;
}

function sortByCount(a, b) {
    return b.count - a.count;
}

function sortByCurrentIndex(a, b) {
    return a._index - b._index;
}

function isSortedByLatest(list) {
    return _.every(list, function(item, index, list) {
        return index === 0 || list[index - 1].latest > item.latest;
    });
}

function isSortedByCount(list) {
    return _.every(list, function(item, index, list) {
        return index === 0 || list[index - 1].count >= item.count;
    });
}

function partition(list, fn) {
    return _.reduce(list, function(memo, item) {
        memo[fn(item) ? 0 : 1].push(item);
        return memo;
    }, [[], []]);
}

function isIndexed(item) {
    return item._index !== -1;
}

function addKey(value, key) {
    return _.extend(_.clone(value), {key: key});
}

function addCurrentIndex(index, item) {
    return _.extend(item, {
        _index: _.findIndex(index, {_id: item._id})
    });
}

function countDelta(index, item) {
    var prev = index[item._index] || {};
    var count = prev.count || 0;
    var delta = prev.delta || 0;

    return _.extend(item, {
        delta: item.count - count + delta
    });
}

function sumDeltas(index) {
    return _.reduce(index, function(memo, item) {
        return memo += item.delta;
    }, 0);
}
