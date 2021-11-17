const { TIME_OFFSET, URL } = require("../config/params")
const moment = require("moment")
const getJSON = require("get-json");
const { getGTFSStops, getGTFSPatterns } = require("../functions/api");
const { readFileSync, writeFileSync } = require("fs");

const getBusPositions = () => {
    return JSON.parse(readFileSync(URL.gps_export, "utf8"));
}

const checkDistance = (bus, stop, distance) => {
    var ky = 40000 / 360;
    var kx = Math.cos(Math.PI * stop.lat / 180.0) * ky;
    var dx = Math.abs(bus.longitude - stop.lon) * kx;
    var dy = Math.abs(bus.latitude - stop.lat) * ky;
    return Math.sqrt(dx * dx + dy * dy) <= distance;
}

const checkTimes = (gpsDatetime, scheduledDeparture) => {
    const t1 = new Date(gpsDatetime.$date)
    const t2 = new Date(scheduledDeparture*1000)
    const h1 = t1.getHours();
    const h2 = t2.getUTCHours();
    const m1 = t1.getMinutes();
    const m2 = t2.getUTCMinutes();
    if(h1 == h2) {
        return Math.abs(m1 - m2) < TIME_OFFSET
    }else if(h1 > h2){
        return Math.abs((m1+60) - m2) < TIME_OFFSET
    }else{
        return Math.abs(m1 - (m2+60)) < TIME_OFFSET
    }
}

const getDepartureStopsAndPatterns = async () => {
    const stops = await getGTFSStops()
    const patterns = await getGTFSPatterns()
    let ds = {}, ds_array = [];
    for(const p of patterns){
        const found = stops.findIndex(s => {
            return s.id == p.busStopStartId
        })
        if(found){
            ds[stops[found].id] = stops[found]
        }
    }
    for(const s in ds){
        ds_array.push(ds[s])
    }
    return { ds_array, patterns };
}

module.exports = {
    checkDistance,
    checkDeparture: checkTimes,
    checkArrival: checkTimes,
    getBusPositions,
    getDepartureStopsAndPatterns
}