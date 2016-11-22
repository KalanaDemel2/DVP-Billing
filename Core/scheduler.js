/**
 * Created by Kalana on 11/18/2016.
 */

var schedule = require("node-schedule");
var format = require("stringformat");
var config = require('config');
var restify = require('restify');
var validator = require('validator');
var request = require('request');
var async = require('async');
var logger = require('dvp-common/LogHandler/CommonLogHandler.js').logger;
var token = format("Bearer {0}",config.Services.accessToken);
var PublishToQueue = require('../Control/Worker').PublishToQueue;

var recuringTaskQueue = [];

function billing(){

    logger.info('billing is started...');
    /*TODO : 1 .Get clients by batch
     *        2. Get amount due for the client by package service
     *        3. Call wallet service to see if client can pay
     *        4. if paid, Generate Invoice and email.  || else call recurrenceSchedulePayment
     *        5. Save billing history to database
     *
     */

    //var billing = schedule.scheduleJob('1 0 1 1-12 *', function(){
    var billing = schedule.scheduleJob('55 47 16 22 11 *', function(){
        console.log('billing is running...');
        bill(1);
    });

}


function bill(count){
    var company ='103';
    var tenant = '1';


    var usertURL = format("http://{0}/DVP/API/{1}/Organisations/", config.Services.userServiceHost, config.Services.userServiceVersion);
    if (validator.isIP(config.Services.userServiceHost))
        usertURL = format("http://{0}:{1}/DVP/API/{2}/Organisations/", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);


    var batchLength = 0;
    var i;


    if(count!=0){
        i = count;
    }
    else{
        i = 0;
    }

    console.log('Getting '+i+'/'+50);
    request({
        method: "GET",
        url: usertURL+i+'/'+50,
        headers: {
            authorization: token,
            companyinfo: format("{0}:{1}", tenant, company)
        },
        json: {}
    }, function (_error, _response, datax) {



        batchLength= (datax.Result).length;

        console.log('This is batch length :  '+batchLength);

        var dataset = datax.Result;


        if ((datax.Result).length != 0)
        {

            var funArray = [];
            for (var index in datax.Result) {
                //console.log(index)
                funArray.push(billEach(datax.Result[index]).invoke);
            }

            async.parallel(funArray,
                function(err, results) {

                    console.log('COMPLETED BATCH :'+i);
                    if(err!=null){
                        console.log('ERROR')
                    }
                    else if((datax.Result).length!=50){
                        console.log('DONE')
                    }
                    else{
                        bill(i+1);
                    }

                });



        }



    });

}

function billEach(datax){

    var data =datax;

    return {
        invoke : function (callback){

            async.waterfall([
                function (callback) {

                    //Get Company ID
                    //console.log(datax.id);
                    callback(null, datax.id);
                },
                function (userid, callback) {
                    var relCompany = datax.id;
                    var relTenant = datax.tenant;

                    var usertURL = format("http://{0}/DVP/API/{1}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServiceVersion);
                    if (validator.isIP(config.Services.userServiceHost)) {
                        //usertURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
                        usertURL = format("http://192.168.5.175:{1}/DVP/API/{2}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
                    }
                    request({
                        method: "GET",
                        url: usertURL,
                        headers: {
                            Authorization: token,
                            companyinfo: format("{0}:{1}", relTenant, relCompany)
                        },
                        json: {}
                    }, function (_error, _response, datax) {

                        var user_packages = datax.Result;
                        var amount = 0;
                        for (var individualAmount in user_packages) {
                            if (!user_packages[individualAmount].isTrial) {
                                amount = amount + user_packages[individualAmount].unitPrice;
                            }
                            if (individualAmount == user_packages.length - 1) {
                                //console.log(userid+' '+amount);
                                callback(null, userid, amount, datax);
                            }
                        }


                    });


                },
                function (userid, amount, packageDetails, callback) {
                    var relCompany = datax.id;
                    var relTenant = datax.tenant;

                    // call wallet deduction with amount
                    var walletURL = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServiceVersion);


                    if (validator.isIP(config.Services.walletServiceHost)) {
                        //wallerURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/"+userid+"/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);
                        walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", 'localhost', "3333", config.Services.walletServiceVersion);

                    }
                    walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", '192.168.0.39', "3333", config.Services.walletServiceVersion);


                    request({
                        method: "PUT",
                        url: walletURL,
                        headers: {
                            Authorization: token,
                            companyinfo: format("{0}:{1}", relTenant , relCompany)
                        },
                        json: {"Amount": amount, "Reason": "Billing for the month"}
                    }, function (_error, _response, datax) {
                        //console.log(datax);
                        if ((datax).IsSuccess) {


                            var sendObj = {
                                "company": relCompany,
                                "tenant": relTenant
                            };
                            sendObj.to =  "kalana@duosoftware.com";
                            sendObj.from = "no-reply@veery.com";
                            sendObj.template = "By-User Registration Confirmation";
                            sendObj.Parameters = {username: 'Kalana',created_at: new Date()};
                            //sendObj.attachments = [{name:name, url:url}]

                            PublishToQueue("EMAILOUT", sendObj);

                            callback(null, datax);

                        }
                        else {
                            var data= {};
                            data.count = 0;
                            data.company = relCompany;
                            data.tenant = relTenant;
                            data.amount = amount;
                            console.log(data);
                            //recurrenceSchedulePayment(data);
                            callback(null, datax);

                        }


                    });


                }
            ], function (err, result) {
                if(err==null){

                    console.log('Cycle Complete');

                }
                callback(null);

            });
        }
    }


}


function recurrenceSchedulePayment(data){

    var relCompany = data.id;
    var relTenant = data.tenant;

    var rule = new schedule.RecurrenceRule();
    rule.hour = 24;
    var count;
    if(data.hasOwnProperty('count')){
        count = data.count;
    }
    else{
        count = 0;
    }


    var task = schedule.scheduleJob(rule, function(){

        if(count<5){
            //TODO :- Call Wallet to retry



            // call wallet deduction with amount
            var walletURL = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServiceVersion);


            if (validator.isIP(config.Services.walletServiceHost)) {
                //wallerURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/"+userid+"/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);
                walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", 'localhost', "3333", config.Services.walletServiceVersion);

            }
            walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", '192.168.0.39', "3333", config.Services.walletServiceVersion);


            request({
                method: "PUT",
                url: walletURL,
                headers: {
                    Authorization: token,
                    companyinfo: format("{0}:{1}", "1", "103")
                },
                json: {"Amount":amount}
            }, function (_error, _response, datax) {
                console.log(datax);
                if(datax.IsSuccess){
                    callback(null, datax);
                }
                else{
                    data.count=data.count+1;
                    recurrenceSchedulePayment(data);

                }


            });


        }
        else{
            //TODO :- Call User service to disable account
            //Stop Recurrence

            // call wallet deduction with amount
            var walletURL = format("http://{0}/DVP/API/{1}/Organisation/Activate/", config.Services.userServiceHost, config.Services.userServiceVersion);


            if (validator.isIP(config.Services.userServiceHost)) {
                wallerURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/Activate/false", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
                //walletURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/Activate/false", 'localhost', "3333", config.Services.walletServiceVersion);

            }


            request({
                method: "PUT",
                url: walletURL,
                headers: {
                    Authorization: token,
                    companyinfo: format("{0}:{1}", relTenant, relCompany)
                },
                json: {"Amount":amount}
            }, function (_error, _response, datax) {
                console.log(datax);
                if(datax.IsSuccess){
                    callback(null, datax);
                }
                else{
                    data.count=data.count+1;
                    recurrenceSchedulePayment(data);

                }


            });
        }

    });


}

exports.bill = billing;