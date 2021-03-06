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
    let csv = "trips, tripShortName, leaveTime, departureTime, arrivalTime, descrizione, pattern\n"
    let shift_counter = 0;
    for(const bus in bus_trips){
        console.log(" ")
        console.log("------------------------- " + "SHIFT-" + shift_counter + ", BUS: " + bus + ", " + Object.keys(bus_trips[bus].trips).length + " -------------------------")
        if(Object.keys(bus_trips[bus].trips).length){
            for(const t in bus_trips[bus].trips){
                const min = bus_trips[bus].trips[t].gps_message_time.getMinutes()
                const gps_m = min < 10 ? "0" + min.toString() : min
                const gtfsArrivalTime = new Date(bus_trips[bus].trips[t].gtfsArrivalTime*1000);
                const amin = gtfsArrivalTime.getUTCMinutes()
                const arrivalTime = `${gtfsArrivalTime.getUTCHours()}:${amin < 10 ? "0" + amin.toString() : amin}`
                const bus_output = t + ", " + bus_trips[bus].trips[t].tripShortName + ", " + bus_trips[bus].trips[t].gps_message_time.getHours() + ":" + gps_m + ", " + bus_trips[bus].trips[t].stoptime + ", " + arrivalTime + ", " + bus_trips[bus].trips[t].desc + ", " + bus_trips[bus].trips[t].pattern_id + ", " + bus_trips[bus].trips[t].index + "\n";
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
function checkGPS(gps){
    // EXAMPLE INVALID GPS
    /*
    "latitude": -0.0000016666666624587378,
    "longitude": -0.0000016666666624587378,
    "speed": 6553,
    */
    if(parseInt(gps.latitude) == 0 || Math.abs(gps.latitude) > 90){
        return false
    }
    if(parseInt(gps.longitude) == 0 || Math.abs(gps.longitude) > 180){
        return false
    }
    if(parseInt(gps.speed) > 500){
        return false
    }
    return true;
}

module.exports = {
    clone,
    arraysEqual,
    printResults,
    speedBasedDistance,
    checkGPS
};