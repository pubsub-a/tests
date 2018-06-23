import { Channel, ImplementationFactory, PubSub, StopStatus } from "@dynalon/pubsub-a-interfaces";
import { expect } from "chai";
import { AsyncSubject, concat, range } from "rxjs";
import { deferMs, randomString, randomValidChannelOrTopicName } from "../test_helper";

/**
 * README TUNING
 *
 * There are various limits on OS level, process level etc. that might limit the maximum number of sockets.
 *
 * Linux:
 *  * ulimit -n -> Shows number of allowed sockets per process: On Ubuntu 18.04 the default is only 1024
 *    increase with: ulimit -n 99999
 *  * TCP SYN Cookies: If you get the message in syslog:  "TCP: request_sock_TCP: Possible SYN flooding on port 9800. Sending cookies.  Check SNMP counters."
 *    you need to increase syncookies:
 *
 *    or disabled them alltogether: sysctl -w net.ipv4.tcp_syncookies=0
 *
 *    BEWARE: In my tests, even disabling syncookies did not work, kernel syslog reportet SYN cookie drops anyway
 *
 * macOS: ulimit requires -S flag: ulimit -S -n 2048
 *
 * nginx:
 *  * worker_connections setting - on a reverse proxy, this is the SUM of connections, so the limit for websockets
 *    would be half of the value!
 *  * worker_rlimit_nofiles - number of files a server process might use - as sockets are file descriptors, this affects
 *    the sockets too
 *
 *
 */


// large random strings are slow as we wait for entropy; for this case we just garbage
// data to test stuff
const rs = randomString(1024);
function getRandomKilobytes(kilobytes: number) {
    let str = "";
    let i = 1;
    while (i <= kilobytes) {
        str += rs;
        i++;
    }
    return str;
}

export const executeHighLoadTests = (factory: ImplementationFactory) => {

    function getNewSocketChannel(channel: string, deferMax: number): Promise<Channel> {
        const [client] = factory.getLinkedPubSubImplementation(1);
        client.onStop.then((stopStatus) => {
            // console.info(`DISCONNECT ${client.clientId} Reason: ${stopStatus.code} ${stopStatus.reason} - ${stopStatus.additionalInfo}`);
        })
        return deferMs(0, deferMax)
            .then(() => client.start())
            .then(() => client.channel(channel))
    }

    describe(`[${factory.name}] should run the highload test`, () => {

        let pubsub1: PubSub, pubsub2: PubSub, pubsub3: PubSub;
        let channel1: Channel, channel2: Channel, channel3: Channel;
        let onClient1Disconnected: AsyncSubject<StopStatus>;
        let onClient2Disconnected: AsyncSubject<StopStatus>;

        beforeEach(done => {
            onClient1Disconnected = new AsyncSubject<StopStatus>();
            onClient2Disconnected = new AsyncSubject<StopStatus>();
            [pubsub1, pubsub2, pubsub3] = factory.getLinkedPubSubImplementation(3);

            let channel1_ready = new AsyncSubject();
            let channel2_ready = new AsyncSubject();
            let channel3_ready = new AsyncSubject();

            // TODO random name?!?
            let channel_name = "channel";

            pubsub1.start().then(pubsub => {
                pubsub.onStop.then(status => {
                    onClient1Disconnected.next(status);
                    onClient1Disconnected.complete();
                });

                pubsub1.channel(channel_name).then(chan => {
                    channel1 = chan;
                    channel1_ready.complete();
                });
            });
            pubsub2.start().then(pubsub => {
                pubsub.onStop.then(status => {
                    onClient2Disconnected.next(status);
                    onClient2Disconnected.complete();
                });
                pubsub2.channel(channel_name).then((chan) => {
                    channel2 = chan;
                    channel2_ready.complete();
                });
            });

            pubsub3.start().then(pubsub => {
                pubsub3.channel(channel_name).then((chan) => {
                    channel3 = chan;
                    channel3_ready.complete();
                });
            });


            concat(channel1_ready, channel2_ready, channel3_ready).subscribe(undefined, undefined, () => {
                done();
            });
        });

        it.skip("should report the socket bytes written", function (done) {
            if (factory.name === "PubSubMicro") {
                this.skip();
            }

            const rand = randomValidChannelOrTopicName(1024);
            let payload = '';
            let megabytes = 50 * 1024;
            while (megabytes-- >= 0) {
                payload += rand;
            }
            console.info("go")

            channel2.subscribe("A_MESSAGE", (pl) => { console.info("got pl2") })
            channel3.subscribe("A_MESSAGE", (pl) => { console.info("got pl3") })

            range(0, 100).subscribe(n => {
                channel1.publish("A_MESSAGE", payload);
            }, undefined, () => {
                setTimeout(() => {
                    done();
                }, 1000)

            })

        })

        it("should disconnect when sending a message with roughly more than 37 kilobytes", function (done) {
            if (factory.name === "PubSubMicro") {
                this.skip();
            }

            onClient1Disconnected.subscribe((status) => {
                expect(status.reason).to.equal("REMOTE_DISCONNECT");
                expect(status.code).to.equal(220)
                expect(status.additionalInfo).to.contain("MAX_MSG_SIZE")
                done();
            });
            channel1.publish('OVERLARGE_MESSAGE', getRandomKilobytes(37));
        })

        it("should handle tenthousand subscriptions to different topic simultaneously", function (done) {
            // set timeout to a minute for this test
            this.timeout(60000);
            let subscriptionsRegistered = 10000;
            let subscriptionsDisposed = 10000;
            const payload = getRandomKilobytes(1);

            while (subscriptionsRegistered > 0) {
                const topic = randomValidChannelOrTopicName();
                let token;
                let subscriptionTriggered = new Promise(resolve => {
                    channel1.subscribe(topic, p => {
                        expect(p).to.equal(payload);
                        resolve();
                    }).then(t => {
                        token = t;
                        channel2.publish(topic, payload);
                    });
                });

                subscriptionTriggered.then(() => {
                    token.dispose().then(() => {
                        if (--subscriptionsDisposed == 0) {
                            done();
                        }
                    });
                });

                subscriptionsRegistered--;
            };
        });

        it("should handle a single subscription with tenthousand publishes of 1k", function (done) {
            this.timeout(60000);
            const topic = randomValidChannelOrTopicName();
            let numPublishes = 10_000;
            let numTriggered = 10_000;

            channel1.subscribe(topic, (payload) => {
                if (--numTriggered <= 0) {
                    done();
                }
            }).then(() => {
                while (numPublishes-- > 0) {
                    channel2.publish(topic, getRandomKilobytes(1));
                }
            });
        })

        it("should be possible to subscribe to tenthousand client disconnect events and receive all notifications", function (done) {
            if (factory.name === "PubSubMicro") {
                this.skip();
            }
            this.timeout(120_000);
            const numClients = 10_000;
            const channelName = randomValidChannelOrTopicName();

            let clientsAvailable: Promise<PubSub[]> = new Promise(resolve => {
                const clients: Promise<PubSub>[] = [];
                for (let i = 0; i < numClients; i++) {
                    clients.push(getNewSocketChannel(channelName, numClients * 5).then(chan => chan.pubsub))
                }
                Promise.all(clients).then(cl => resolve(cl))
            })

            let numClientsOk = numClients;
            const observerFn = () => { --numClientsOk === 0 && done(); }

            clientsAvailable.then(clients => {
                const client = getNewSocketChannel(channelName, 0).then(chan => {
                    chan.pubsub.channel("__internal").then(ichan => {
                        const subscriptions: Promise<any>[] = [];
                        for (let client of clients) {
                            subscriptions.push(ichan.publish("SUBSCRIBE_DISCONNECT", client.clientId))
                        }
                        const subs_ready = ichan.subscribe("CLIENT_DISCONNECT", observerFn);

                        Promise.all([...subscriptions, subs_ready]).then(() => {
                            console.info("Got all subscribe disconnect subscriptions")
                            clients.forEach(c => c.stop({ reason: "LOCAL_DISCONNECT" }))
                        });
                    })
                })
            })
        })

        it("should handle subscription from tenthousand clients (tcp sockets) at once with a 1kb publish", function (done) {
            this.timeout(120000);
            if (factory.name === "PubSubMicro") {
                this.skip();
            }
            const numClients = 10_000;

            const channelName = randomValidChannelOrTopicName();
            const topic = randomValidChannelOrTopicName()

            let numClientsOk = numClients;
            let start: number;

            const onPublishReceived = function () {
                const pubsub = this;
                if (--numClientsOk === 0) {
                    const delta = new Date().getTime() - start;
                    console.info(`Publishing to all clients took: ${delta}ms`)
                    console.info(`Average publish per socket: ${delta / numClients}ms`)
                    done();
                }
            }

            function subscribeNewClient(channel: string, topic: string, observerFn: any, deferMax: number) {
                return getNewSocketChannel(channel, deferMax)
                    .then(chan => chan.subscribe(topic, observerFn).then(() => chan))
            }

            let clientSubscriptions: Promise<any>[] = [];
            for (let i = 0; i < numClients; i++) {
                clientSubscriptions.push(subscribeNewClient(channelName, topic, onPublishReceived, numClients * 5))
            }

            const allClientsSubscribed = Promise.all(clientSubscriptions);

            allClientsSubscribed.then(() => {
                console.info(`Successfully subscribed ${numClients} clients`);
                factory.getLinkedPubSubImplementation(1)[0].start().then(ps => {
                    ps.channel(channelName).then(chan => {
                        start = new Date().getTime();
                        chan.publish(topic, getRandomKilobytes(1))
                    });
                })
            })
        })


    });
};
