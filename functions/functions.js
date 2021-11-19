const { MIN_DISTANCE, POLLING_TIME } = require("../config/params")

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }

    return true;
}

function printResults(bus_trips){
    console.log(" ")
    console.log("*********** RESULT ***********")
    let csv = "trips, tripShortName, positionTime, stoptime, descrizione, pattern\n"
    let shift_counter = 0;
    for(const bus in bus_trips){
        console.log(" ")
        console.log("------------------------- " + "SHIFT-" + shift_counter + ", BUS: " + bus + ", " + Object.keys(bus_trips[bus].trips).length + " -------------------------")
        if(Object.keys(bus_trips[bus].trips).length){
            for(const t in bus_trips[bus].trips){
                const min = bus_trips[bus].trips[t].gps_message_time.getMinutes()
                const gps_m = min < 10 ? "0" + min.toString() : min
                const bus_output = t + ", " + bus_trips[bus].trips[t].tripShortName + ", " + bus_trips[bus].trips[t].gps_message_time.getHours() + ":" + gps_m + ", " + bus_trips[bus].trips[t].stoptime + ", " + bus_trips[bus].trips[t].desc + ", " + bus_trips[bus].trips[t].pattern_id + ", " + bus_trips[bus].trips[t].index + "\n";
                console.log(bus_output)
                csv += bus_output;
            }
        }else{
            console.log("NO TRIP FOUND")
        }
        console.log(" ")

        shift_counter++;
    }
    //SAVE CSV - JSON
}

function saveCSV(csv){
    //console.log(csv)
}

function saveJSON(csv){
    //console.log(csv)
}
function secondsToHours(sec){
    return sec/3600
}
function speedBasedDistance(speed){
    // the higher speed a vehicle is moving the larger the distance from a stop is
    return (MIN_DISTANCE + speed*secondsToHours(POLLING_TIME)).toFixed(3)
}

module.exports = {
    clone,
    arraysEqual,
    printResults,
    speedBasedDistance
};