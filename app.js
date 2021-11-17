//const express = require("express");
//const app = express();
const { PerformanceObserver, performance } = require('perf_hooks');
const https = require('https')
const { readFileSync, writeFileSync } = require("fs");
const dotenv = require("dotenv");
const { MAX_DISTANCE, LIFETIME_VALUE, BUS_IDENTIFIER_FIELD, URL } = require("./config/params");
const { checkBusStop, checkDeparture, checkArrival } = require("./functions/bus_functions")
const getJSON = require("get-json");
//CONFIG ENV
dotenv.config({path: "./config/config.env"});

//data structure which contains all recognized routes for all buses
bus_trips = {}
// set patterns_details to an empty obj (removing getJSON statement below) to load patterns details dynamically from OTP data
//const patterns_trips = {}

//LOAD GTFS and GPS DATA
const t0 = performance.now()
console.log("Loading Bus Positions and GTFS data from OTP...");

const STOPS = JSON.parse(readFileSync(URL.stops, "utf8"));
console.log("Stops Ready...");
const PATTERNS = JSON.parse(readFileSync(URL.patterns, "utf8"));
console.log("Patterns Ready...");
let patterns_details = JSON.parse(readFileSync(URL.patterns_details, "utf8"));
console.log("Patterns Details Ready...");
let BUS_POSITIONS = JSON.parse(readFileSync(URL.gps_export, "utf8"));
console.log("GPS Positions Ready...");

const t1 = performance.now()
console.log((t1 - t0)/1000 + " seconds.")



//START RECOGNIZING
startRecognizing()
async function startRecognizing(){
    console.log("Start Recognizing...");
    for(let i = 0; i < BUS_POSITIONS.length; i++){
        //CHECK LAST POSITION
        if(i == BUS_POSITIONS.length-1){
            //CALCOLO_PERFORMANCE
            const t2 = performance.now()
            console.log("END RECOGNIZING: " + (t2 - t1)/1000 + " seconds.")

            //PRINT VECHILE SCHEDULING
            console.log("-------------------------RESULT-------------------------")
            let csv = "trips, tripShortName, positionTime, stoptime, descrizione, pattern\n"
            let shift_counter = 0;
            for(const b in bus_trips){
                console.log("SHIFT-" + shift_counter + ", BUS: " + b)
                shift_counter++;
                for(const t in bus_trips[b].trips){
                    const bus_output = t + ", " + bus_trips[b].trips[t].tripShortName + ", " + bus_trips[b].trips[t].position_time.getHours() + ":" + bus_trips[b].trips[t].position_time.getMinutes() + ", " + bus_trips[b].trips[t].stoptime + ", " + bus_trips[b].trips[t].desc + ", " + bus_trips[b].trips[t].pattern_id + "\n";
                    console.log(bus_output)
                    csv += bus_output;
                }
            console.log("-------------------------")
            }
            //console.log(csv)
            return true;
        }

        const position = BUS_POSITIONS[i];
        //get bus which position refers to
        const current_bus = position[BUS_IDENTIFIER_FIELD]

        //CHECK NEW FOUND BUS
        if(bus_trips.hasOwnProperty(current_bus)){
            //check rollback operations
            if(i <= bus_trips[current_bus].current_index){
                //a roll back operation has been required, so ignore current position
                continue;
            }else{
                //Update bus index
                bus_trips[current_bus].current_index = i;
            }
        }else{
            //NEW BUS HAS BEEN FOUND
            //create bus instance
            bus_trips[current_bus] = {
                isTracked: false,
                waitForLeave: false,
                trips: {}
            }
        }

        /*if(current_bus == "853704"){
            console.log(bus_trips[current_bus].waitForLeave)
        }*/

        //check if a departure stop has been set for a route of a bus, which means some route or pattern has been recognized
        if(bus_trips[current_bus].waitForLeave){
            if(!checkBusStop(position, patterns_details[Object.keys(bus_trips[current_bus].patterns)[0]].stops[0], MAX_DISTANCE)){
                //console.log(position.latitude, position.longitude, position.speed, checkBusStop(position, patterns_details[Object.keys(bus_trips[current_bus].patterns)[0]].stops[0]))
                bus_trips[current_bus].isTracked = true;
                bus_trips[current_bus].waitForLeave = false;
                //DATETIME NEEDS TO BE SAVED WHEN THE BUS LEAVES THE STOP
                bus_trips[current_bus].datetime = position.datetime;
            }
        }

        //if yes, some pattern has already been recognized but next bus positions can refer to the same bus stop (i.e. the bus is not moving)
        if (bus_trips[current_bus].isTracked) {

            //for each departure pattern check if position is near to next bus stop in bus stop list
            for(pat in bus_trips[current_bus].patterns){
                if(checkBusStop(position, patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter], MAX_DISTANCE)){
                    //debugger;
                    //bus_trips[current_bus].patterns[pat].stop_list.push(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter])
                    //console.log(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter])
                    //check if stop is the arrival stop
                    if(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].id == bus_trips[current_bus].patterns[pat].busStopEndId){
                        //length-1 because stop_counter points to the position inside array
                        if(bus_trips[current_bus].patterns[pat].stop_counter == patterns_details[pat].stops.length-1){
                            //It's the arrival stop for the current pattern

                            //add into temporary array before adding them into trips
                            //check if stops list is greater than patterns stops list previously saved
                            //delete pattern with shorter stop list
                            for (const t in bus_trips[current_bus].temp){
                                if(patterns_details[t].stops.length < patterns_details[pat].stops.length){
                                    delete bus_trips[current_bus].temp[t]
                                }
                            }

                            bus_trips[current_bus].temp[pat] = { ...bus_trips[current_bus].patterns[pat] }
                            bus_trips[current_bus].temp[pat].index = i;
                            //before set isTracked to false, first check next patterns of this bus that matches with this stop
                            delete bus_trips[current_bus].patterns[pat]
                        }else{
                            //some stop is missing
                            //route is not valid
                            //cancel pattern
                            delete bus_trips[current_bus].patterns[pat]
                        }
                    }else{
                        //stop is inside stop list for this pattern but not the last one, check next stop
                        //reset lifetime value for this pattern
                        bus_trips[current_bus].patterns[pat].lifetime = LIFETIME_VALUE;
                        //console.log(pat)
                        //console.log(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].lat, patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].lon, position.latitude, position.longitude)
                        //increment stop counter for this pattern to find next bus stop
                        bus_trips[current_bus].patterns[pat].stop_counter++;
                    }
                }else{
                    if(position.speed != 0){
                        bus_trips[current_bus].patterns[pat].lifetime--;
                        if(bus_trips[current_bus].patterns[pat].lifetime == 0){
                            //console.log(pat)
                            //console.log(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].lat, patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].lon, position.latitude, position.longitude)
                            //debugger;
                            delete bus_trips[current_bus].patterns[pat]
                            //check if some pattern is still valid
                        }
                    }

                }
            }

            //if there is no pattern left,  the tracking of current bus gets stopped until a new departure stop will be found.
            if(!Object.keys(bus_trips[current_bus].patterns).length){
                //read temporary pattern
                //now temp should contains only patterns with the longest recognized sequence of stop list
                //check if it's not empty
                if(Object.keys(bus_trips[current_bus].temp).length){
                    //find the smallest index inside temp patterns or use the first one
                    //check rollback index
                    //let rollback_index = null;
                    for(const pat in bus_trips[current_bus].temp){

                            //INVECE DI SALVARE IL PATTERN
                            //OTTENERE LE TRIPS DEL PATTERN CORRENTE
                            //è possibile modificare l'oggetto "pattern" per ottenere anche la lista delle trip
                            const pat_trips = await getJSON(URL.otp + "/otp/routers/default/index/patterns/" + pat + "/trips?detail=true");
                            if(pat_trips){
                                for(const t of pat_trips){
                                    const t_times = await getJSON(URL.otp + "/otp/routers/default/index/trips/" + t.id + "/stoptimes");
                                    if(t_times){
                                        if(checkDeparture(bus_trips[current_bus].datetime, t_times[0].scheduledDeparture) /* checkArrival(position.datetime, t_times[t_times.length-1].scheduledArrival)*/){
                                            /*if(!bus_trips[current_bus].trips.hasOwnProperty(pat)){

                                            }else{
                                                bus_trips[current_bus].trips[pat].counter.push(bus_trips[current_bus].temp[pat].index);
                                            }*/
                                            const ft = new Date(t_times[0].scheduledDeparture*1000);
                                            bus_trips[current_bus].trips[t.id] = {
                                                id: t.id,
                                                tripShortName: t.tripShortName,
                                                position_time: new Date(bus_trips[current_bus].datetime.$date),
                                                stoptime: ft.getUTCHours() + ":" + ft.getUTCMinutes(),
                                                departureTime: t_times[0].scheduledDeparture,
                                                arrivalTime: t_times[t_times.length-1].scheduledArrival,
                                                busStopStart: bus_trips[current_bus].temp[pat].busStopStart,
                                                busStopEnd: bus_trips[current_bus].temp[pat].busStopEnd,
                                                desc: bus_trips[current_bus].temp[pat].desc,
                                                pattern_id: pat,
                                                index: bus_trips[current_bus].temp[pat].index
                                            }

                                        }

                                    }
                                }

                            }

                    }
                    //set FOR's index to last recognized stop for ROLLBACK
                    if(i != bus_trips[current_bus].temp[Object.keys(bus_trips[current_bus].temp)[0]].index){
                        i = bus_trips[current_bus].temp[Object.keys(bus_trips[current_bus].temp)[0]].index
                    }
                }
                //no trip has been recognized, so start over finding a new departure stop
                bus_trips[current_bus].isTracked = false;
            }


        } else {
            //if no, check speed
            if(position.speed != 0){
                //bus is not at departure stop because it is running
                continue
            }
            // a departure stop for a route has not been set yet, so find a departure stop inside pattern list
            //check if position is close to some bus stops
            //"filter" function instead of "find" because more stops can be close to bus position (i.e. when they are in front of each other or terminal station)
            const current_stops = STOPS.filter((stop, index_stops) => {
                if(checkBusStop(position, stop, MAX_DISTANCE, index_stops)){
                    //position is close to stop
                    return stop
                }
            })
            //check if current_stops is not empty
            if(current_stops.length == 0) {
                //NO STOP FOUND AROUND BUS, CHECK NEXT POSITION
                continue;
            }
            //find some pattern with current_stop as departure stop
            //check inside patterns list if current_stop is a departure stop
            //save them in a temp array
            //"filter" function instead of "find" because more stops can be departure stop for different routes
            const departure_patterns = PATTERNS.filter((pattern, index_patterns) => {
                const departure_stop = pattern.busStopStartId;
                //check if one of found current_stops is departure stop of current pattern
                return current_stops.some((s, i) => {
                    return s.id == departure_stop
                })

            })
            //check if patterns_array is not empty
            if (departure_patterns.length) {
                //patterns_array get all patterns with current stop as departure stop
                bus_trips[current_bus].patterns = {};
                bus_trips[current_bus].isTracked = false;

                //DATETIME NEEDS TO BE SAVED WHEN THE BUS LEAVES THE STOP
                //bus_trips[current_bus].datetime = position.datetime;
                bus_trips[current_bus].waitForLeave = true;
                //When waitFOrLeave is true we need to check when the bus leave the stop and get datetime value

                bus_trips[current_bus].temp = {}
                bus_trips[current_bus].current_index = i



                //fill patterns_details data structure with patterns ids
                for(const pat of departure_patterns){
                    //counter to keep track of bus stop sequences number
                    //stop_counter is the sequence number of next expected stop
                    pat.stop_counter = 1;
                    pat.stop_list = [pat.busStopStartId];
                    //lifetime value to limit the number of chances to recognize a bus stop
                    pat.lifetime = LIFETIME_VALUE;
                    //update patterns_details with missing patterns stops list
                    if(!patterns_details.hasOwnProperty(pat.id)){

                        const pat_details = await getJSON(URL.otp + "/otp/routers/default/index/patterns/" + pat.id);
                        if(pat_details){
                            patterns_details[pat.id] = { ...pat_details }
                        }


                    }
                    //debugger;
                    bus_trips[current_bus].patterns[pat.id] = { ...pat }
                }


            }
        }


// END FOR
    }
}





//

/*const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server runnig on port ${PORT}`);
})*/