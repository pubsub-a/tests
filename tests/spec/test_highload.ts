import { expect } from "chai";
import { Observable, AsyncSubject, concat, range } from "rxjs";

import { ImplementationFactory, PubSub, Channel, StopStatus } from "@dynalon/pubsub-a-interfaces";
import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeHighLoadTests = (factory: ImplementationFactory) => {

    describe(`[${factory.name}] should run the highload test`, () => {

        let pubsub1: PubSub, pubsub2: PubSub, pubsub3: PubSub;
        let channel1: Channel, channel2: Channel, channel3: Channel;
        let onClient1Disconnected: AsyncSubject<StopStatus>;
        let onClient2Disconnected: AsyncSubject<StopStatus>;
        // large random strings are slow as we wait for entropy; for this case we just garbage
        // data to test stuff
        const rs = randomString(1024);
        function getRandomString(kilobytes) {
            let str = "";
            let i = 1;
            while (i <= kilobytes) {
                str += rs;
                i++;
            }
            return str;
        }

        beforeEach(done => {
            onClient1Disconnected = new AsyncSubject<StopStatus>();
            onClient2Disconnected = new AsyncSubject<StopStatus>();
            [pubsub1, pubsub2, pubsub3] = factory.getLinkedPubSubImplementation(3);

            let channel1_ready = new AsyncSubject();
            let channel2_ready = new AsyncSubject();
            let channel3_ready = new AsyncSubject();

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
            channel1.publish('OVERLARGE_MESSAGE', getRandomString(37));
        })

        it.skip("should handle tenthousand subscriptions to different topic simultaneously", function (done) {
            // set timeout to a minute for this test
            this.timeout(60000);
            let subscriptionsRegistered = 10000;
            let subscriptionsDisposed = 10000;
            const payload = randomString(5 * 1024);

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

        // this test is nonsense, as the 9999 subscriptions are not forwarded to the server!
        it.skip("should handle thenthousand subscriptions with a 5k payload", function (done) {
            this.timeout(60000);
            let subscriptionsRegistered = 10000;
            let subscriptionsTriggered = 10000;
            const topic = randomValidChannelOrTopicName();
            const payload = randomString(1024 * 5);

            // TODO test with .dispose()
            const subscriptionsReady = new Promise(resolve => {
                while (subscriptionsRegistered > 0) {
                    subscriptionsRegistered--;
                    channel1.subscribe(topic, p => {
                        expect(p.length).to.equal(1024 * 5);
                        if (--subscriptionsTriggered == 0) {
                            done();
                        }

                    }).then(() => {
                        if (subscriptionsRegistered == 0) {
                            resolve();
                        }
                    });
                }
            });

            subscriptionsReady.then(() => {
                channel2.publish(topic, payload);
            });
        });

        it.skip("should handle a subscription with tenthousand publishes of 5k", function (done) {
            this.timeout(60000);
            const topic = randomValidChannelOrTopicName();
            let numPublishes = 10000;
            let numTriggered = 10000;
            let payloadSize = 5 * 1024;

            channel1.subscribe(topic, (payload) => {
                if (--numTriggered <= 0) {
                    let stop = new Date().getTime();
                    done();
                }
            }).then(() => {
                while (numPublishes-- > 0) {
                    channel2.publish(topic, randomString(payloadSize));
                }
            });
        })

        // requires a server than answers every ping with a pong
        // it("should play ping pong", function(done) {
        //     let receivedPongs = 10000;
        //     let numPings = 10000;
        //     let payload = randomString(5 * 1024);
        //     this.timeout(60000);

        //     pubsub1.channel("pingpong", chan => {
        //         chan.subscribe("pong", p => {
        //             if(--receivedPongs <= 0)
        //                 done();
        //             else
        //                 chan.publish("ping", payload);
        //         }).then(() => {
        //             chan.publish("ping", payload);
        //         });
        //     });
        // })
    });
};
