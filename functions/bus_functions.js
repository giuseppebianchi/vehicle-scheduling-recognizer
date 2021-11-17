const {TIME_OFFSET} = require("../config/params")
const moment = require("moment")
const checkBusStop = (bus, stop, distance) => {
    var ky = 40000 / 360;
    var kx = Math.cos(Math.PI * stop.lat / 180.0) * ky;
    var dx = Math.abs(bus.longitude - stop.lon) * kx;
    var dy = Math.abs(bus.latitude - stop.lat) * ky;
    return Math.sqrt(dx * dx + dy * dy) <= distance;
}

const checkDeparture = (positionDatetime, scheduledDeparture) => {
    const t1 = new Date(positionDatetime.$date)
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

const checkArrival = (positionDatetime, scheduledArrival) => {
    const t1 = new Date(positionDatetime.$date)
    const t2 = new Date(scheduledArrival*1000)
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

module.exports = {
    checkBusStop,
    checkDeparture,
    checkArrival
}