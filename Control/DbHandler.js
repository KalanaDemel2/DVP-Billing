/**
 * Created by Rajinda on 10/1/2015.
 */

var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var DbConn = require('dvp-dbmodels');
var moment = require('moment');
var Sequelize = require('sequelize');


/*-------------- Channel Master Data --------------------*/
module.exports.CreateCustomerBillRecord = function (customer, callback) {
    var datetime = new Date();
    DbConn.CustomerBillRecord
        .create(
            {
                email: customer.email,
                subscriptions: customer.subscriptions,
                Cycle: customer.cycle,
                customer: customer.customer,
                TenantId: customer.tenant,
                CompanyId: customer.company,
                Status:customer.Status,
                OtherJsonData:customer.data,
                createdAt: datetime,
                updatedAt:datetime
            }
        ).then(function (cmp) {
        callback(undefined, cmp);
    }).error(function (err) {
        callback(err, undefined);
    });
};


module.exports.UpdateCustomerBillRecord = function (customer, callback) {
    var datetime = new Date();
    DbConn.CustomerBillRecord
        .update(
            {
                lastBillCycle: customer.cycle,
                updatedAt:datetime,
                OtherJsonData:customer.data
            }
            ,
            {
                where: [{customer: customer.customer}, {TenantId: customer.tenant}, {CompanyId: customer.company}]
            }
        ).then(function (cmp) {
        callback(undefined, cmp);
    }).error(function (err) {
        callback(err, undefined);
    });
};

module.exports.CustomerCycleById = function (customer, res) {
    var datetime = new Date();
    DbConn.CustomerBillRecord
        .find({
        where: [{customer:  customer.customer}, {TenantId: customer.tenant}, {CompanyId: customer.company}]
    }).then(function (CustomerBillRecord) {
        var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, 0);
        if (CustomerBillRecord) {
            var data = {
                "CompanyId": CustomerBillRecord.CompanyId,
                "Cycle": CustomerBillRecord.Cycle,
                "OtherJsonData" : CustomerBillRecord.OtherJsonData
            };
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, data);
        }
        else {
            jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", false, 0);
        }

        logger.info('CreditBalance -  Billing - [%s] .', jsonString);
        res(null,jsonString);
    }).error(function (err) {
        var jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", false, undefined);
        logger.error('[CreditBalance] - [%s] ', jsonString);
        res(err,jsonString);
    });
};

