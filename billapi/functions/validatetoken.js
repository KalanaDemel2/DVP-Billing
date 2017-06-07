/**
 * Created by Kalana on 5/17/2017.
 */

var tokenGenerator = require('./../../Core/tokenGenerator');
var redisTokenValidation = require('./../../Control/billingSessionValidator');
var config = require('config');

function validateToken(req,res,next){

    var customer = {};
    customer.company =parseInt(req.user.company);
    customer.tenant = parseInt(req.user.tenant);
    customer.customer = (req.user.company).toString();
    customer.billToken = req.body.billToken;

    var key = "1_BILL_TOKEN";


    tokenGenerator.validateToken(customer, function(found){
        res.send(JSON.parse(found));
        if(JSON.parse(found).IsSuccess){
            redisTokenValidation.save(key,customer.billToken );
        }
        res.end();
    });

}

exports.validateToken = validateToken;
