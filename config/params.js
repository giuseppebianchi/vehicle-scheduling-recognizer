//max distance to find bus stop around a bus position
const MAX_DISTANCE = 0.2; // 0.05

const LEAVE_STOP_DISTANCE = 0.2; // 0.05

//max time, in seconds, between two stops //we use lifetime to avoid date conversion, improving performance
//const MAX_TIME = 10 * 60 // 10 minutes

//field of bus position object which identify the bus, i.e. the GPS device's serial number
const BUS_IDENTIFIER_FIELD = "unitSN"; //unitID

//value to limit the number of chances to find next bus stop of the pattern
//i.e. 100 means that next bus stop in stop list of a pattern must be found by 100 bus positions, otherwise the pattern will be ignored and removed from list because unvalid
const LIFETIME_VALUE = 50; // 60 //between positions there is an interval of 5 seconds, so lifetime in seconds is value*5, that should be the mid time between two bus stops

const MIN_SPEED = 5;

const TIME_OFFSET = 10 // minutes

//local urls
const URL = {
    stops: "./data/stops.json",
    patterns: "./data/patterns.json",
    patterns_details: "./data/patterns_details.json",
    gps_export: "./data/gps_23112020.json",
    //otp: "http://trasporti.opendatalaquila.it/infomobility"
}

//otp urls
const OTP_hostname = "http://localhost:8080";
const OTP = {
    stops: OTP_hostname + "/otp/routers/default/index/stops",
    patterns: OTP_hostname + "/otp/routers/default/index/patterns",
    pattern_details: (pattern_id) => OTP_hostname + "/otp/routers/default/index/patterns/" + pattern_id,
    stoptimes: (trip_id) => OTP_hostname + "/otp/routers/default/index/trips/" + trip_id + "/stoptimes",
    pattern_trips: (pattern_id) => OTP_hostname + "/otp/routers/default/index/patterns/" + pattern_id + "/trips?detail=true"
}



module.exports = {
    MAX_DISTANCE,
    BUS_IDENTIFIER_FIELD,
    LIFETIME_VALUE,
    MIN_SPEED,
    URL,
    OTP,
    TIME_OFFSET
};