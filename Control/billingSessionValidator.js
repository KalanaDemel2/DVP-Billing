/**
 * Created by dinusha on 12/22/2016.
 */
var redis = require("redis");
var Config = require('config');
var crypto = require('crypto');

var redisIp = Config.Redis.ip;
var redisPort = Config.Redis.port;
var redisPassword = Config.Redis.password;
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');

var client = redis.createClient(redisPort, redisIp);

client.auth(redisPassword, function (redisResp) {
    console.log("Redis Auth Response : " + redisResp);
});


function validateToken(response){


    var key = Config.Host.TenantName + "_BILL_TOKEN";
    var key2 = Config.Host.TenantName + "_BILL_HASH_TOKEN";

    get(key, function(err, found1){

        get(key2 , function (err2, found2){

            var jsonString;
            if(found1 == Encrypt(found2,'DuoS123412341234') ){
                console.log('Valid Bill Token');
                jsonString = messageFormatter.FormatMessage(undefined, 'EXCEPTION', true);
                response(jsonString);

            }
            else if (err){
                console.log('Redis Error');
                jsonString = messageFormatter.FormatMessage(undefined, 'EXCEPTION', false);
                response(jsonString);
            }
            else{
                console.log('Invalid Bill Token');
                jsonString = messageFormatter.FormatMessage(undefined, 'EXCEPTION', false);
                response(jsonString);
            }


        });



    });


}



function Encrypt(plainText, workingKey) {

    var key =workingKey;
    var iv = '0123456789@#$%&*';
    var cipher = crypto.createCipheriv('aes-128-ctr', key, iv);
    var encoded = cipher.update(plainText, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
}




function save(key, object, callback){
    client.set(key, object, function(err, reply) {
        //console.log('Redis Response :'+reply);
        callback(err, reply);
    });


}
function del(key){

    client.del(key, function(err, reply) {
        //console.log('Redis Response :'+reply);
        callback(err, reply);
    });


}

function get(key, callback){

    client.get(key, function(err, reply) {
        //console.log('Redis Response :'+reply);
        callback(err, reply);
    });


}


client.on('error', function(msg)
{

});


exports.validateToken = validateToken;
exports.del = del;
exports.save = save;
exports.get = get;
