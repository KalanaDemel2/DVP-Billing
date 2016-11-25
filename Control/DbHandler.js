/**
 * Created by Rajinda on 10/1/2015.
 */

var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var DbConn = require('dvp-dbmodels');
var moment = require('moment');
var Sequelize = require('sequelize');

var datetime = new Date();
/*-------------- Channel Master Data --------------------*/
module.exports.CreateCustomerBillRecord = function (customer, callback) {
    DbConn.CustomerBillRecord
        .create(
            {
                cusid: customer.customer,
                email: customer.email,
                subscriptions: customer.subscriptions,
                TenantId: customer.tenant,
                CompanyId: customer.company,
                lastBillCycle: customer.cycle,
                createdAt: datetime,
                updatedAt:datetime
            }
        ).then(function (cmp) {
        callback.end(undefined, cmp);
    }).error(function (err) {
        callback.end(err, undefined);
    });
};

module.exports.UpdateCustomerBillRecord = function (req, customer,cycle, callback) {
    DbConn.CustomerBillRecord
        .update(
            {
                lastBillCycle: cycle,
                updatedAt:datetime
            }
            ,
            {
                where: [{cusid: customer.customer}, {TenantId: customer.tenant}, {CompanyId: customer.company}]
            }
        ).then(function (cmp) {
        callback.end(undefined, cmp);
    }).error(function (err) {
        callback.end(err, undefined);
    });
};

module.exports.CustomerCycleById = function (customer, res) {

    DbConn.CustomerBillRecord
        .find({
        where: [{cusid:  customer.customer}, {TenantId: customer.tenant}, {CompanyId: customer.company}, {Status: true}]
    }).then(function (CustomerBillRecord) {
        var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, 0);
        if (CustomerBillRecord) {
            var data = {
                "CompanyId": CustomerBillRecord.CompanyId,
                "Cycle": CustomerBillRecord.lastBillCycle
            };
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, data);
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", false, 0);
        }
        logger.info('CreditBalance -  Wallet - [%s] .', jsonString);
        res.end(jsonString);
    }).error(function (err) {
        var jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error('[CreditBalance] - [%s] ', jsonString);
        res.end(jsonString);
    });
};

