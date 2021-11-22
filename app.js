//const express = require("express");
//const app = express();
const { PerformanceObserver, performance } = require('perf_hooks');
const https = require('https')
const dotenv = require("dotenv");

const { MAX_DISTANCE, LIFETIME, MIN_SPEED, BUS_IDENTIFIER_FIELD, URL, LEAVE_TERMINAL_DISTANCE } = require("./config/params");
const { checkDistance, checkDeparture, checkArrival,
        getBusPositions, getDepartureStopsAndPatterns
} = require("./functions/bus")
const { getGTFSPatterns, getPatternDetails, getTripStoptimes, getPatternTrips } = require("./functions/api")

const { printResults, speedBasedDistance, checkGPS } = require("./functions/functions")

//CONFIG ENV
dotenv.config({path: "./config/config.env"});

// BUS_TRIPS = struttura dati utilizzata per il riconoscimento delle trip e per memorizzare i risultati per ciascun autobus
let bus_trips = {}

// PATTERN DETAILS = struttura dati per mantenere informazioni dettagliate sui pattern riconosciuti
let patterns_details = {}

//START
startRecognizing()

async function startRecognizing(){
    const t0 = performance.now()
    //LOAD GTFS and GPS DATA
    console.log("Loading Bus Positions and GTFS data from OTP...");

    const { ds_array: DEPARTURE_STOPS, patterns: PATTERNS } = await getDepartureStopsAndPatterns()
    console.log("Stops and Patterns Ready...");

    const BUS_POSITIONS = await getBusPositions()
    console.log("GPS Positions Ready...");

    const t1 = performance.now()
    console.log(((t1 - t0)/1000).toFixed(2) + " seconds.")

    console.log("Start Recognizing...");

    /****************************/

    //FOR EACH STORED BUS POSITION
    for(let i = 0; i < BUS_POSITIONS.length; i++){

        // CHECK LAST POSITION
        // controlla se è l'ultima posizione per mostrare i risultati e terminare l'esecuzione
        if(i == BUS_POSITIONS.length-1){
            //CALCOLO_PERFORMANCE
            const t2 = performance.now()
            console.log("END RECOGNIZING: " + ((t2 - t1)/1000).toFixed(2) + " seconds.")

            //PRINT VEHICLE SCHEDULING
            printResults(bus_trips)

            //END
            return true;
        }

        // GET CURRENT GPS MESSAGE
        // il messaggio gps inviato dall'autobus che verrà esaminato
        const gps_message = BUS_POSITIONS[i];

        // GET BUS
        // l'identificativo del bus corrispondente al messaggio gps
        const current_bus = gps_message[BUS_IDENTIFIER_FIELD]

        // CHECK BUS POSITION AND MESSAGE DATETIME
        /*if(current_bus == "853678" && i > 50000){
            console.log(stops_around_bus, gps_message.latitude +","+ gps_message.longitude, gps_message.datetime.$date, i)
        }*/

        // CHECK IF FOUND NEW BUS
        // controllo se il bus corrente è già presente nella lista dei risultati
        if(bus_trips.hasOwnProperty(current_bus)){
            // CHECK ROLLBACK
            // verifica se è stata effettuata un'operazione di rollback sull'indice delle bus positions
            if(i <= bus_trips[current_bus].current_index){
                // l'indice delle bus position è minore di quello memorizzato per l'autobus corrente
                // quindi è stata effettuata un'operazione di rollback da un altro autobus
                // SKIP MESSAGE perchè già stato esaminato
                continue;
            }else{
                // UPDATE BUS INDEX
                bus_trips[current_bus].current_index = i;
            }
        }else{
            // CREATE BUS OBJECT
            // creo l'istanza del bus corrente nella lista dei risultati
            bus_trips[current_bus] = {
                isTracked: false,
                waitForLeave: false,
                trips: {}
            }
        }

        /******************************/

        // CHECK WAIT-FOR-LEAVE
        // La proprietà "waitForLeave", se TRUE, indica che
        // il bus si trova in un capolinea ma non è ancora partito
        if(bus_trips[current_bus].waitForLeave){
            // CHECK VALID GPS
            // Un valore non valido GPS potrebbe erroneamente rendere TRUE questa condizione
            if(!checkGPS(gps_message)){
                // In attesa di un segnale GPS valido
                continue
            }
            // CHECK DEPARTURE FROM TERMINAL
            // controllo se l'autobus ha lasciato il capolinea
            if(!checkDistance(gps_message, patterns_details[Object.keys(bus_trips[current_bus].patterns)[0]].stops[0], LEAVE_TERMINAL_DISTANCE)){
                // L'autobus ha lasciato il capolinea quindi
                // si inizia a riconoscere il percorso e si memorizza l'orario corrente
                // Si considera l'orario in cui lascia il capolinea e non quello di arrivo perchè
                // l'autobus potrebbe arrivare alla fermata di partenza della trip con largo anticipo.
                // - lasciando il capolinea, si è sicuri che il bus ha iniziato la corsa.
                // questo orario verrà confrontato, considerando un offset opportuno, con i VERI orari delle trips dei pattern riconosciuti)
                bus_trips[current_bus].isTracked = true;
                bus_trips[current_bus].waitForLeave = false;
                bus_trips[current_bus].datetime = gps_message.datetime;
            }
        }

        // CHECK IS-TRACKED
        // La proprietà "isTracked", se TRUE, indica che sono stati trovati alcuni pattern
        // aventi come capolinea di partenza la posizione in cui si trova l'autobus
        // quindi le posizioni successive andrenno confrontate con le fermate di questi pattern
        if (bus_trips[current_bus].isTracked) {
            //FOR EACH FOUND PATTERN
            for(pat in bus_trips[current_bus].patterns){
                //CHECK DISTANCE BETWEEN BUS POSITION AND CURRENT PATTERN'S NEXT STOP

                if(checkDistance(gps_message, patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter], MAX_DISTANCE)){
                    // L'autobus si trova nei pressi della prossima fermata del pattern corrente
                    // CHECK IF ARRIVAL STOP
                    // Verifica se si tratta dell'ultima fermata
                    if(patterns_details[pat].stops[bus_trips[current_bus].patterns[pat].stop_counter].id == bus_trips[current_bus].patterns[pat].busStopEndId){
                        // CHECK STOPS NUMBER (controllo aggiuntivo)
                        // Verifico se tutte le stop sono state riconosciute o qualcuna è stata saltata
                        // il numero delle STOP RICONOSCIUTE deve corrispondere alla lunghezza delle STOP DEL PATTERN
                        if(bus_trips[current_bus].patterns[pat].stop_counter == patterns_details[pat].stops.length-1){
                            // L'autobus si trova nel capolinea di arrivo:
                            // -> PATTERN RECOGNIZED
                            // Prima di aggiungere il pattern riconosciuto ai risultati, si salva come "temporaneo".
                            // Questo perchè potrebbero esserci più pattern con la stessa tratta oppure PATTERN PIÙ LUNGHI

                            // FIRST, REMOVE SHORTER PATTERNS THAN CURRENT
                            // si rimuovono i pattern precedentemente riconosciuti che sono più corti di quello corrente
                            for (const t in bus_trips[current_bus].temp){
                                if(patterns_details[t].stops.length < patterns_details[pat].stops.length){
                                    delete bus_trips[current_bus].temp[t]
                                }
                            }

                            // SAVE PATTERN AS TEMPORARY
                            bus_trips[current_bus].temp[pat] = { ...bus_trips[current_bus].patterns[pat] }

                            bus_trips[current_bus].temp[pat].index = i; // index indica l'indice delle bus position in cui è stato riconosciuto il pattern
                            delete bus_trips[current_bus].patterns[pat] // remove from departure patterns list

                        }else{
                            // SOME STOPS ARE MISSING
                            // Il percorso non è valido
                            // cancel pattern
                            delete bus_trips[current_bus].patterns[pat]

                            /*** ALTERNATIVA SENZA CANCELLARE PATTERN - PERMETTENDO FERMATE MANCANTI ***/
                            // Trattandosi dell'ultima fermata, anche se alcune fermate non sono state riconosciute, è possibile
                            // tenere in considerazione il pattern (con un limite di errore: es. 3 fermate mancanti)
                            // perchè IL RICONOSCIMENTO avviene confrontando gli orari dei messaggi gps con gli orari di partenza e arrivo delle trip
                            // Sfruttando questa opzione è necessario confrontare anche gli orari di arrivo:
                            // - sebbene gli orari di partenzasia uguali, in caso di falsi negativi (fermate mancanti)
                            //   gli orari di arrivo saranno necessariamente diversi tra le varie trip
                        }
                    }else{
                        // È una fermata INTERMEDIA del pattern
                        // bisogna controllare le successive

                        // RESET LIFETIME
                        // La fermata è stata trovata quindi si rinizializza il valore LIFETIME per trovare la successiva
                        bus_trips[current_bus].patterns[pat].lifetime = LIFETIME;

                        // UPDATE STOP COUNTER
                        bus_trips[current_bus].patterns[pat].stop_counter++;
                    }
                }else{
                    // NO PATTERNS NEXT STOP FOUND AROUND BUS
                    // L'autobus non si trova nei pressi di una fermata del pattern, ma
                    // prima di decrementare il valore di LIFETIME si controlla la SPEED
                    // - viene decrementata solo se viaggia a velocità superiori a MIN_SPEED
                    // MIN_SPEED la velocità con cui il veicolo si considera fermo, nel traffico, parcheggi, deposito
                    if(gps_message.speed > MIN_SPEED){
                        bus_trips[current_bus].patterns[pat].lifetime--;
                        // CHECK LIFETIME
                        if(bus_trips[current_bus].patterns[pat].lifetime == 0){
                            // PATTERN NOT VALID ANYMORE
                            // Non si è riusciti a trovare la fermata successiva di questo pattern
                            // quindi si deduce che l'autobus NON STA PERCORRENDO QUESTA LINEA
                            delete bus_trips[current_bus].patterns[pat]
                        }
                    }

                }
            }

            // CHECK IS ALL PATTERNS HAVE BEEN ANALYZED
            // Se non ci sono più pattern da valutare, in quanto scartati o riconosciuti
            // si passa alla valutazione dei riconosciuti (temporary)
            if(!Object.keys(bus_trips[current_bus].patterns).length){
                // START ANALYZING TEMPORARY PATTERNS
                if(Object.keys(bus_trips[current_bus].temp).length){
                    // TEMP dovrebbe contenere i pattern più lunghi con STESSA LUNGHEZZA corrispondenti alla tratta percorsa dall'autobus
                    // find the smallest index inside temp patterns or use the first one

                    let rollback_index = null; // indica l'indice in cui è stata riconosciuta la trip salvata - Read below its porpose
                    // FOR EACH TEMPORARY PATTERN -> GET TRIPS
                    for(const pat in bus_trips[current_bus].temp){
                            // (In OTP si potrebbe modificare l'entità "pattern"  per ottenere anche la lista delle trip senza ulteriore API)
                            const pat_trips = await getPatternTrips(pat);
                            if(pat_trips){
                                // FOR EACH TRIP -> GET STOPTIMES
                                for(const t of pat_trips){
                                    const t_times = await getTripStoptimes(t.id);
                                    if(t_times){
                                        //CHECK DEPARTURE TIMES
                                        // GLi orari di arrivo non sono necessari in quanto, non permettendo fermate mancanti, i pattern riconosciuti sono tutti della stessa lunghezza:
                                        // - in ogni caso, trip con gli stessi orari che percorrono lo stesso percorso, non creerebbero un problema per il realtime: la posizione visualizzata sarebbe la stessa
                                        // Se si permette di riconoscere pattern anche con fermate mancanti allora è necessario anche l'orario di arrivo.
                                        if(checkDeparture(bus_trips[current_bus].datetime, t_times[0].scheduledDeparture) /* checkArrival(gps_message.datetime, t_times[t_times.length-1].scheduledArrival)*/){
                                            // TRIP MATCHED
                                            // Una trip è stata trovata e viene aggiunta ai risultati per l'autobus corrente
                                            const formatted_time = new Date(t_times[0].scheduledDeparture*1000);
                                            const fmin = formatted_time.getUTCMinutes()
                                            bus_trips[current_bus].trips[t.id] = {
                                                id: t.id,
                                                tripShortName: t.tripShortName,
                                                gps_message_time: new Date(bus_trips[current_bus].datetime.$date),
                                                stoptime: `${formatted_time.getUTCHours()}:${fmin < 10 ? "0" + fmin.toString() : fmin}`,
                                                gtfsDepartureTime: t_times[0].scheduledDeparture,
                                                gtfsArrivalTime: t_times[t_times.length-1].scheduledArrival,
                                                busStopStart: bus_trips[current_bus].temp[pat].busStopStart,
                                                busStopEnd: bus_trips[current_bus].temp[pat].busStopEnd,
                                                desc: bus_trips[current_bus].temp[pat].desc,
                                                pattern_id: pat,
                                                index: bus_trips[current_bus].temp[pat].index
                                            }
                                            rollback_index = bus_trips[current_bus].temp[pat].index;  // indica l'indice in cui è stato riconosciuto il pattern della trip salvata - Read below its porpose
                                        }

                                    }
                                }

                            }
                    }

                    // RECOVER INDEX TO THE LATEST RECOGNIZED ARRIVAL STOP
                    // È possibile che la lista pattern sia svuotata in seguito all'analisi di un pattern pi lungo
                    // di quelli già riconosciuti e saltati come "temporanei"
                    // Quindi è corretto RIPRENDERE IL RICONOSCIMENTO della trip successiva
                    // DAL CAPOLINEA DI ARRIVO dell'ultima trip riconosciuta e salvata
                    if(i != rollback_index){
                        i = rollback_index
                    }
                }

                // STOP TRACKING STOPS AND PATTERNS
                // È stato completato il riconosciumento della trip, oppure
                // nessuna trip è stata trovata
                // Si inizia a trovare un nuovo capolinea di partenza
                bus_trips[current_bus].isTracked = false;
            }
        }

        // DETECT DEPARTURE STOP
        if (!bus_trips[current_bus].isTracked && !bus_trips[current_bus].waitForLeave) {
            // Non è ancora attivo il processo di riconoscimento
            // -> RILEVARE UNA FERMATA DI PARTENZA

            // CHECK SPEED
            // Per risparmiare calcoli sul riconoscimento del capolinea di partenza
            // si attende che l'autobus sia ferma ( perchè in un capolinea lo è sicuramente)
            if(gps_message.speed > 0){
                // NEXT POSITION
                // L'autobus non si trova in un capolinea perchè è in movimento
                // (eventuali spostamenti nei terminal non sono importanti
                // -> l'autobus dovrà necessariamente fermarsi prima o poi ad un capolinea
                continue
            }


            // CHECK STOP PROXIMITY
            // La ricerca viene ristretta alle sole fermate che compaiono come capolinea di qualche pattern
            // (Il riconoscimento parte da un capolinea quindi è inutile trovare una fermata intermedia)
            // Si usa "filter" al posto di "find" perchè più fermate possono trovarsi in prossimità della posizione del bus
            // (i.e. when they are in front of each other or terminal station)
            const stops_around_bus = DEPARTURE_STOPS.filter((stop, index_stops) => {
                if(checkDistance(gps_message, stop, speedBasedDistance(gps_message.speed))){
                    // bus is close to stop
                    return stop
                }
            })

            // CHECK STOPS AROUND BUS
            if(stops_around_bus.length == 0) {
                // NO STOP WAS FOUND AROUND BUS, CHECK NEXT POSITION
                continue;
            }

            // FIND DEPARTURE PATTERNS
            // Trovare i pattern aventi come capolinea di partenza la fermata riconosciuta.
            // Si usa "filter" al posto di "find" perchè più pattern possono avere la stessa fermata come capolinea di partenza
            const departure_patterns = PATTERNS.filter((pattern, index_patterns) => {
                const departure_stop = pattern.busStopStartId;
                //check if one of found stops is departure stop of current pattern
                return stops_around_bus.some((s, i) => {
                    return s.id == departure_stop
                })

            })

            // CHECK FOUND PATTERNS
            if (departure_patterns.length) {
                // Si preparano i campi per iniziare il riconoscimento sull'autobus corrente
                bus_trips[current_bus].patterns = {};
                bus_trips[current_bus].isTracked = false;

                //bus_trips[current_bus].datetime = position.datetime; // DATETIME NEEDS TO BE SAVED WHEN THE BUS LEAVES THE STOP
                bus_trips[current_bus].waitForLeave = true;
                // La prorpietà "waitForLeave" a TRUE indica che stiamo aspettando che il bus lasci il capolinea
                // per salvare l'orario di partenza, da memorizzare poi con quello vero del GTFS

                bus_trips[current_bus].temp = {}
                bus_trips[current_bus].current_index = i // indica quando il pattern è stato trovato (ma non ancora riconosciuto)

                // CREATE PATTERNS LIST
                // Si richiedono le informazioni dettagliate sui pattern che si andranno ad analizzare da analizzare
                for(const pat of departure_patterns){
                    pat.stop_counter = 1; // Numero di sequenza della fermata successiva attesa
                    pat.lifetime = LIFETIME; // Numero di tentativi per riconoscere una fermata prima di scartare il pattern

                    // CHECK EXISTING PATTERN DETAILS
                    // Per risparmiare tempo e chiamate API si sfruttando informazioni richieste in precedenti iterazioni
                    if(!patterns_details.hasOwnProperty(pat.id)){
                        // Se non è presente
                        // -> GET PATTERN DETAILS
                        const pat_details = await getPatternDetails(pat.id);
                        if(pat_details){
                            patterns_details[pat.id] = { ...pat_details }
                        }
                    }

                    // Aggiungo l'istanza pattern vuota appena creata alla lista da analizzare
                    bus_trips[current_bus].patterns[pat.id] = { ...pat }
                }


            }
        }

    // END BUS POSITION FOR
    }
}


//const PORT = process.env.PORT;
//app.listen(PORT, () => { console.log(`Server runnig on port ${PORT}`)})