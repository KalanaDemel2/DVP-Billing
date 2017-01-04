/**
 * Created by Kalana on 12/19/2016.
 */
var messageFormatter = require('dvp-common/CommonMessageGenerator/ClientMessageJsonFormatter.js');
var libphonenumber = require('libphonenumber');
var DBconn = require('../../Control/DbHandler');

ratingTable = [];
function updateRatings(req, res, next){

    //console.log((req.body.ratings).length);
    //send table to
    if(req.body.ratings){

        var arr = req.body.ratings;
        for(var index in req.body.ratings){
            //console.log(arr[index])
            ratingTable.push( arr[index]);
            DBconn.CreateRatingRecord(ratingTable[index], function(err,obj){
                //console.log(err)
            });
        }

    }
    else{
        //update from database
    }

    var jsonString = messageFormatter.FormatMessage(undefined, "EXCEPTION", true, { "message" : "successfully updated" });
    res.end(jsonString);
}

function getRating(to, from, callback){
    //console.log(ratingTable.length);

    if(ratingTable.length == 0){

        console.log('Rating table is empty, fetching data');
        DBconn.getRatingRecords(function(err,obj){
            //console.log(obj)
            //console.log((JSON.parse(obj).Result).length)
            var object = JSON.parse(obj).Result;

            for(var index in object){

                ratingTable.push(object[index]);
                if(index == object.length-1){
                    console.log('Data fetched')
                    var dnisNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
                    var fromNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(from, null));
                    //console.log(dnisNumberType);
                    if(dnisNumberType === 3){


                        var dnisCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
                        console.log(dnisCountryCode);

                        for(var i = 0; i<ratingTable.length; i++){
                            //console.log(to);
                            //console.log(ratingTable[i].AreaCode)
                            //console.log(to)
                            if(ratingTable[i].Country === dnisCountryCode && fromNumberType ==1){
                                console.log('Mobile Per Miniute rate is: ' +ratingTable[i].MobilePerMin);
                                callback(ratingTable[i].MobilePerMin);
                                break;

                            }
                            else if(ratingTable[i].Country === dnisCountryCode && fromNumberType ==0){

                                console.log('Land Per Miniute rate is: ' +ratingTable[i].LandlinePerMin);
                                callback(ratingTable[i].LandlinePerMin);
                                break;
                            }
                            else if (ratingTable[i].Country === dnisCountryCode && fromNumberType ==0){
                                console.log('Other Per Miniute rate is: ' +ratingTable[i].LandlinePerMin);
                                callback(ratingTable[i].LandlinePerMin);
                                break;
                            }
                            else if(i == ratingTable.length -1){
                                callback(null)
                            }
                        }
                    }
                    else {
                        callback(null)
                    }
                }

            }
        });
    }
    else if(ratingTable.length != 0){

        var dnisNumberType = libphonenumber.phoneUtil.getNumberType(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
        console.log(dnisNumberType);
        if(dnisNumberType === 3){
            var dnisCountryCode = libphonenumber.phoneUtil.getRegionCodeForNumber(libphonenumber.phoneUtil.parseAndKeepRawInput(to, null));
            console.log(dnisCountryCode)

            for(var i = 0; i<ratingTable.length; i++){
                //console.log(to);
                //console.log(ratingTable[i].AreaCode)
                //console.log(to)
                if(ratingTable[i].Country === dnisCountryCode){
                    console.log('Per Miniute rate is: ' +ratingTable[i].MobilePerMin);
                    callback(ratingTable[i].MobilePerMin);
                    break;

                }
                else if(i == ratingTable.length -1){
                    callback(null)
                }
            }
        }
        else {
            callback(null)
        }


    }



}



exports.getRating = getRating;
exports.updateRatings = updateRatings;