/**
 * Created by Kalana on 11/18/2016.
 *
 * READE ME :
 * PROCESS : 1. User calls endpoint to create new package
 *           2. Service calls package API to get price of selected package
 *           3. Service sends amount to paymentAPI
 *           4. Logic difference from upgrade :- if no credit just deny registration and respond failure,
 *                                               if available add credit to wallet and respond success message
 *           5. Add to billing scheduler array
 *
 */


var format = require("stringformat");
var config = require('config');
var restify = require('restify');
var validator = require('validator');
var request = require('request');


var msg = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var token = format("Bearer {0}",config.Services.accessToken);

function execute(req,res,next){

    var company =req.user.company;
    var tenant = req.user.tenant;

    //console.log(company);
    //console.log(tenant)

    var usertURL = format("http://{0}/DVP/API/{1}/Organisations/1/20", config.Services.userServiceHost, config.Services.userServiceVersion);



    if (validator.isIP(config.Services.userServiceHost))
        usertURL = format("http://{0}:{1}/DVP/API/{2}/Organisations/1/20", config.Services.userServiceHost, config.Services.userServicePort, config.Services.userServiceVersion);

    request({
        method: "GET",
        url: usertURL,
        headers: {
            authorization: token,
            companyinfo: format("{0}:{1}", tenant, company)
        },
        json: {}
    }, function (_error, _response, datax) {

        for (var index in datax.Result){
            console.log(datax.Result[index].id)
        }
        var message = msg.FormatMessage(undefined, "Package bought", true, datax);
        res.write(message);
        res.end();
    });
}

exports.execute = execute;


