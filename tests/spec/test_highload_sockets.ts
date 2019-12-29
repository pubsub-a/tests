// import { Channel, ImplementationFactory } from "@pubsub-a/interfaces";
// import { deferMs, getRandomKilobytes, randomValidChannelOrTopicName } from "../test_helper";
// import { ClientCluster } from "./highload_socket_helper";
// import { once } from "lodash";

// /**
//  * These tests produce a high NETWORK load in addition to generall high load to the server by using real
//  * TCP networking sockets per connection.
//  */

// /**
//  * !!! README !!!!
//  *
//  * There are various limits on OS level, process level etc. that might limit the maximum number of sockets
//  *
//  * Linux:
//  *  * ulimit -n -> Shows number of allowed sockets per process: On Ubuntu 18.04 the default is only 1024
//  *    increase with: ulimit -n 99999
//  *  * TCP SYN Cookies: If you get the message in syslog:  "TCP: request_sock_TCP: Possible SYN flooding on port 9800. Sending cookies.  Check SNMP counters."
//  *    you need to increase syncookies:
//  *
//  *    or disabled them alltogether: sysctl -w net.ipv4.tcp_syncookies=0
//  *
//  *    BEWARE: In my tests, even disabling syncookies did not work, kernel syslog reportet SYN cookie drops anyway
//  *
//  * macOS:
//  *  - ulimit requires -S flag: ulimit -S -n 30000 (30000 seems to be the default limit on high sierra)
//  *  - to increase ulimit -n (max open files) limit, increase these sysctl values:
//  *
//  *    sudo sysctl -w kern.maxfiles=200000
//  *    sudo sysctl -w kern.maxfilesperproc=120000
//  *
//  *  -ephemeral source ports: max 16383 ports available on high sierra; see those sysctl (default) values:
//  *
//  *    net.inet.ip.portrange.lowfirst: 1023
//  *    net.inet.ip.portrange.lowlast: 600
//  *    net.inet.ip.portrange.first: 49152
//  *    net.inet.ip.portrange.last: 65535
//  *    net.inet.ip.portrange.hifirst: 49152
//  *    net.inet.ip.portrange.hilast: 65535
//  *
//  *    Using multiple loopback source addresses on macOS high sierra does NOT work.
//  *    WARNING: Adding more loopback addresses via alias: "ifconfig lo0 alias 127.0.0.2 up" DOES NOT work, src ports
//  *             seem to be limited by device in mac os x :( Try teaking the hifirst value above
//  *
//  * nginx:
//  *  * worker_connections setting - on a reverse proxy, this is the SUM of connections, so the limit for websockets
//  *    would be half of the value!
//  *  * worker_rlimit_nofiles - number of files a server process might use - as sockets are file descriptors, this affects
//  *    the sockets too
//  *
//  * Usefull for debugging: See sockets in TIME_WAIT state for port 9800:
//  *
//  *    netstat -an |grep 9800|grep TIME_WAIT|wc -l
//  *
//  */
// export const executeHighloadSocketTests = (factory: ImplementationFactory) => {

//     process.on('unhandledRejection', (reason, p) => {
//         console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//         // application specific logging, throwing an error, or other logic here
//     });

//     function getNewSocketChannel(channel: string, deferMax: number): Promise<Channel> {
//         const [client] = factory.getLinkedPubSubImplementation(1);
//         client.onStop.then((stopStatus) => {
//             console.info(`DISCONNECT ${client.clientId} Reason: ${stopStatus.code} ${stopStatus.reason} - ${stopStatus.additionalInfo}`);
//         })
//         return deferMs(0, deferMax)
//             .then(() => client.start())
//             .then(() => client.channel(channel))
//     }

//     describe(`[${factory.name}] should run highload test with real and lots of sockets`, () => {
//         if (factory.name === "PubSubMicro") {
//             return;
//         }

//         let channelName: string;
//         let topic: string;

//         beforeEach(() => {
//             channelName = randomValidChannelOrTopicName();
//             topic = randomValidChannelOrTopicName();
//         })

//         afterEach(function(done) {
//             this.timeout(60_000)
//             // closed sockets are still occupying a source port until TIME_WAIT period has passed
//             // so it makes sense to wait after each highload test to ensure we don't run out of source ports
//             setTimeout(done, 30_000)
//         })

//         it("should be possible to subscribe to tenthousand client disconnect events and receive all notifications", function (done) {
//             this.timeout(5 * 60 * 1000);
//             const channelName = randomValidChannelOrTopicName();

//             const cluster = new ClientCluster(factory);
//             let numClientsOk = cluster.options.numClients;
//             const observerFn = () => { --numClientsOk === 0 && done(); }

//             cluster.connectClients()
//                 .catch(err => done("Error connecting all clients: " + err.toString()))
//                 .then(() => {
//                     const ids = cluster.clients.map(client => client.clientId);
//                     const client = getNewSocketChannel(channelName, 0).then(chan => {
//                         chan.pubsub.channel("__internal").then(ichan => {
//                             const subscriptions: Promise<any>[] = [];
//                             for (let id of ids) {
//                                 subscriptions.push(ichan.publish("SUBSCRIBE_DISCONNECT", id));
//                             }
//                             const subs_ready = ichan.subscribe("CLIENT_DISCONNECT", observerFn);

//                             Promise.all([...subscriptions, subs_ready]).then(() => {
//                                 cluster.dispose();
//                             }).catch(err => {
//                                 console.info("Error subscribing all clients: " + err.toString())
//                                 cluster.dispose();
//                             })
//                         })
//                     })
//                 })
//         })

//         it("should handle subscription from tenthousand clients (tcp sockets) at once with a 1kb publish", function (done) {
//             this.timeout(5 * 60 * 1000);

//             const cluster = new ClientCluster(factory);
//             let numPublishesReceived = cluster.options.numClients;
//             let start: number;

//             const onPublishReceived = function () {
//                 if (--numPublishesReceived === 0) {
//                     const delta = new Date().getTime() - start;
//                     console.info(`Publishing to all clients took: ${delta}ms`)
//                     console.info(`Average publish per socket: ${delta / cluster.options.numClients}ms`)
//                     customDone();
//                 }
//             }

//             let finishedOk = false;
//             const customDone = (err?: any) => {
//                 if (finishedOk) {
//                     // expected errors from cleanup, because we disconnect sockets. ignore them
//                     return;
//                 }
//                 if (err && !finishedOk) {
//                     console.error("Error executing unit test");
//                 } else {
//                     finishedOk = true;
//                 }
//                 cluster.dispose().then(() => done(err));
//             }

//             const stopOnClientDisconnect = (status) => customDone(JSON.stringify(status))

//             cluster.connectClients()
//                 .then(clients => clients.map(client => client.onStop.then(status => stopOnClientDisconnect(status))))
//                 .then(() => cluster.subscribeClients(channelName, topic, onPublishReceived))
//                 .then(() => {
//                     console.info(`Successfully subscribed ${cluster.options.numClients} clients`);
//                     start = new Date().getTime();
//                     factory.getLinkedPubSubImplementation(1)[0].start().then(ps => {
//                         ps.channel(channelName).then(chan => {
//                             chan.publish(topic, getRandomKilobytes(1))
//                         });
//                     })
//                 })
//                 .catch(err => {
//                     customDone("Error connecting clients: " + JSON.stringify(err));
//                 })
//         })

//     })
// }
