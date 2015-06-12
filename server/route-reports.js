var aggregators = require('./aggregators');

module.exports = function (req, res, next) {
    var type = req.params.type;
    var aggregator = aggregators[type];

    if (aggregator) {
        aggregator(req._db, req.query, function(err, result) {
            if (err) {
                res.status(500).end();
                return next();
            }
            res.json(result);
            next();
        });
    } else {
        res.status(400).end();
        next();
    }
};
