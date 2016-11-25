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
var DBconn = require('../Control/DbHandler');
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');


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
    var billing = schedule.scheduleJob('0 39 14 25 11 *', function(){
        console.log('billing is running...');
        bill(1);
    });

}


function bill(count){
    var company ='0';
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



    return {
        invoke : function (callback){

            async.waterfall([
                function (callback) {

                    //Get Company ID
                    //console.log(datax);
                    callback(null, datax.id);
                },
                function (userid, callback) {
                    var relCompany = datax.id;
                    var relTenant = datax.tenant;
                    var email = datax.ownerId;

                    var usertURL = format("http://{0}/DVP/API/{1}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServiceVersion);
                    if (validator.isIP(config.Services.userServiceHost)) {
                        usertURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
                        //usertURL = format("http://192.168.5.175:{1}/DVP/API/{2}/Organisation/billingInformation", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
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
                        //console.log(datax.IsSuccess);
                        if(datax && (datax.Result).length != 0){
                            var user_packages = datax.Result;

                            var amount = 0;
                            for (var individualAmount in user_packages) {
                                if (!user_packages[individualAmount].isTrial) {
                                    amount = amount + (user_packages[individualAmount].unitPrice * user_packages[individualAmount].units);
                                }
                                if (individualAmount == user_packages.length - 1) {
                                    //console.log(userid+' '+amount);
                                    callback(null, userid, amount, datax.Result, email);
                                }
                            }
                        }
                        else if(datax){
                            callback(null, userid, 0, datax.Result, email);
                            console.log('No Packages available')
                        }
                        else{
                            callback(null, userid, 0, [], email);
                            console.log('Package Service issue')
                        }



                    });


                },
                function (userid, amount, packageDetails, email, callback) {
                    var relCompany = datax.id;
                    var relTenant = datax.tenant;



                    var formattedPackgeDetatils = [];

                    if(packageDetails.length!=0)
                    for(var index in packageDetails){

                        var obj = {};
                        obj.name = packageDetails[index].name;
                        obj.type = packageDetails[index].type;
                        obj.category = packageDetails[index].category;
                        obj.unitPrice = packageDetails[index].unitPrice;
                        obj.units = packageDetails[index].units;
                        obj.price = packageDetails[index].units * packageDetails[index].unitPrice;

                        formattedPackgeDetatils.push(obj);

                    }

                    //console.log(formattedPackgeDetatils);
                    // call wallet deduction with amount
                    var walletURL = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServiceVersion);


                    if (validator.isIP(config.Services.walletServiceHost)) {
                        walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);
                        //walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", 'localhost', "3333", config.Services.walletServiceVersion);

                    }
                    //walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);


                    request({
                        method: "PUT",
                        url: walletURL,
                        headers: {
                            Authorization: token,
                            companyinfo: format("{0}:{1}", relTenant , relCompany)
                        },
                        json: {"Amount": amount, "Reason": "Billing for the month"}
                    }, function (_error, _response, datax) {
                        //console.log(email);
                        if (datax && datax.IsSuccess) {

                            console.log('Billing Successful');

                            /*var date = new Date();
                            var month  = date.getMonth();

                            //Save to Database
                            var customer = {};
                            customer.customer = email;
                            customer.email = email;
                            customer.status = true;
                            customer.subscriptions = formattedPackgeDetatils;
                            customer.tenant = relTenant;
                            customer.company = relCompany;
                            customer.cycle = month;

                            DBconn.CreateCustomerBillRecord(customer, function(err,obj){
                                if(err){
                                    var jsonString = messageFormatter.FormatMessage(err, "EXCEPTION", true, customer);
                                    logger.error('SubscribeCustomerPlan - Subscribe To Plan, but Fail to Save Data - [%s] .', jsonString);
                                    res.end(jsonString);
                                }
                                else{
                                    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, obj);
                                    logger.info('SubscribeCustomerPlan - Subscribe To Plan - [%s] .', jsonString);
                                    res.end(jsonString);
                                }
                            });
*/

                            //Send Invoice
                            var sendObj = {
                                "company": 0,
                                "tenant": 1
                            };

                            var date = new Date();
                            var month = date.getMonth();

                            if(amount!=0){
                                sendObj.to =  email;
                                //sendObj.to =  "kalana@duosoftware.com";
                                sendObj.from = "Billing";
                                sendObj.template = "Billing Information";
                                sendObj.Parameters =
                                {
                                    username:email,
                                    totalbill:amount,
                                    id:relTenant+"."+relCompany+"."+month,
                                    created_at:date,
                                    company : email,
                                    owner : email,
                                    mail : email,
                                    billinginfo:formattedPackgeDetatils
                                };
                                //sendObj.attachments = [{name:name, url:url}]

                                PublishToQueue("EMAILOUT", sendObj);


                            }
                            callback(null, datax);

                        }
                        else {
                            console.log('Billing Unsuccessful, rescheduling billing');
                            var data= {};
                            data.count = 0;
                            data.company = relCompany;
                            data.tenant = relTenant;
                            data.amount = amount;
                            data.email = email;
                            data.formattedPackgeDetatils = formattedPackgeDetatils;
                            //console.log(data);
                            recurrenceSchedulePayment(data);
                            callback(null, datax);



                        }


                    });


                }
            ], function (err, result) {
                if(err==null){

                    //console.log('Cycle Complete');

                }
                callback(null);

            });
        }
    }


}


//Make 24 hour recurring requests to pay the bill till a designated time limit and the disable account
function recurrenceSchedulePayment(data){

    console.log('Recheduling Payment...');

    var relCompany = data.company;
    var relTenant = data.tenant;
    var amount = data.amount;

    var rule = new schedule.RecurrenceRule();
    //rule.hour = (config.Host.reschedulefreqency*24)/config.Host.rescheduletries;
    rule.second = 1;
    var count;
    if(data.hasOwnProperty('count')){
        count = data.count;
    }
    else{
        count = 0;
    }


    var task = schedule.scheduleJob(rule, function(){


        //console.log(count);
        if(count<config.Host.rescheduletries){
            //Call Wallet to retry
            // call wallet deduction with amount
            var walletURL = format("http://{0}/DVP/API/{1}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServiceVersion);


            if (validator.isIP(config.Services.walletServiceHost)) {
                walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);
                //walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", 'localhost', "3333", config.Services.walletServiceVersion);

            }
            //walletURL = format("http://{0}:{1}/DVP/API/{2}/PaymentManager/Customer/Wallet/Credit", config.Services.walletServiceHost, config.Services.walletServicePort, config.Services.walletServiceVersion);


            request({
                method: "PUT",
                url: walletURL,
                headers: {
                    Authorization: token,
                    companyinfo: format("{0}:{1}", relTenant, relCompany)
                },
                json: {"Amount":amount}
            }, function (_error, _response, datax) {
                //console.log(datax);
                if(datax.IsSuccess){
                    callback(null, datax);
                }
                else {
                    console.log('Payment failed, rescheduling for ' + relCompany + ':' + relTenant + ' attempt :' + count);
                    //data.count=data.count+1;
                    count++;

                    //send warning

                    //Send Invoice
                    var sendObj = {
                        "company": 0,
                        "tenant": 1
                    };

                    var date = new Date();
                    var month = date.getMonth();

                    if (amount != 0) {
                        sendObj.to = email;
                        //sendObj.to =  "kalana@duosoftware.com";
                        sendObj.from = "Billing";
                        sendObj.template = "Billing Information";
                        sendObj.Parameters =
                        {
                            username: data.email,
                            totalbill: amount,
                            id: relTenant + "." + relCompany + "." + month,
                            created_at: date,
                            company: data.email,
                            owner: data.email,
                            mail: data.email,
                            billinginfo: data.formattedPackgeDetatils
                        };
                        //sendObj.attachments = [{name:name, url:url}]

                        PublishToQueue("EMAILOUT", sendObj);

                    }
                }


            });


        }
        else{
            //Call User service to disable account
            //Stop Recurrence

            // call wallet deduction with amount
            var userURL = format("http://{0}/DVP/API/{1}/Organisation/Activate/false", config.Services.userServiceHost, config.Services.userServiceVersion);


            if (validator.isIP(config.Services.userServiceHost)) {
                userURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/Activate/false", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);
                //walletURL = format("http://{0}:{1}/DVP/API/{2}/Organisation/Activate/false", 'localhost', "3333", config.Services.walletServiceVersion);

            }


            request({
                method: "PUT",
                url: userURL,
                headers: {
                    Authorization: token,
                    companyinfo: format("{0}:{1}", "1", "594")
                },
                json: {"Amount":amount}
            }, function (_error, _response, datax) {
                //console.log(datax);
                if(datax && datax.IsSuccess){

                    console.log('Disabling account...');
                    task.cancel();

                }
                else{
                    //if Request fails, reschedule
                    //data.count=data.count+1;

                }


            });
        }

    });






}

exports.bill = billing;