const { OTP } = require("../config/params")
const getJSON = require("get-json");

//STOPS
const getGTFSStops = () => {
    //FILE
    //return JSON.parse(readFileSync(URL.stops, "utf8"));

    //OTP
    return getJSON(OTP.stops)
}

//PATTERNS
const getGTFSPatterns = () => {
    //FILE
    //return JSON.parse(readFileSync(URL.patterns, "utf8"));

    //OTP
    return getJSON(OTP.patterns)
}

const getPatternDetails = (pattern_id) => {
    return getJSON(OTP.pattern_details(pattern_id))
}

const getTripStoptimes = (trip_id) => {
    return getJSON(OTP.stoptimes(trip_id))
}

const getPatternTrips = (pattern_id) => {
    return getJSON(OTP.pattern_trips(pattern_id))
}

module.exports = {
    getGTFSStops,
    getGTFSPatterns,
    getPatternDetails,
    getTripStoptimes,
    getPatternTrips
};