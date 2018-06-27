import { Channel, ImplementationFactory, PubSub, StopStatus } from "@dynalon/pubsub-a-interfaces";
import { expect } from "chai";
import { AsyncSubject, concat, range } from "rxjs";
import { getRandomKilobytes, randomValidChannelOrTopicName } from "../test_helper";

/**
 * While tests produce a high load to the server by stressful operations, there are no "real" sockets used
 * as we use the multiplexing feature of socket.io websockets.
 */

export const executeHighLoadTests = (factory: ImplementationFactory) => {

    describe(`[${factory.name}] should run the highload test`, () => {

        let pubsub1: PubSub, pubsub2: PubSub, pubsub3: PubSub;
        let channel1: Channel, channel2: Channel, channel3: Channel;
        let onClient1Disconnected: AsyncSubject<StopStatus>;
        let onClient2Disconnected: AsyncSubject<StopStatus>;
        let topic: string; let channelName: string;

        beforeEach(done => {
            onClient1Disconnected = new AsyncSubject<StopStatus>();
            onClient2Disconnected = new AsyncSubject<StopStatus>();
            [pubsub1, pubsub2, pubsub3] = factory.getLinkedPubSubImplementation(3);

            let channel1_ready = new AsyncSubject();
            let channel2_ready = new AsyncSubject();
            let channel3_ready = new AsyncSubject();

            channelName = randomValidChannelOrTopicName();
            topic = randomValidChannelOrTopicName();

            pubsub1.start().then(pubsub => {
                pubsub.onStop.then(status => {
                    onClient1Disconnected.next(status);
                    onClient1Disconnected.complete();
                });

                pubsub1.channel(channelName).then(chan => {
                    channel1 = chan;
                    channel1_ready.complete();
                });
            });
            pubsub2.start().then(pubsub => {
                pubsub.onStop.then(status => {
                    onClient2Disconnected.next(status);
                    onClient2Disconnected.complete();
                });
                pubsub2.channel(channelName).then((chan) => {
                    channel2 = chan;
                    channel2_ready.complete();
                });
            });

            pubsub3.start().then(pubsub => {
                pubsub3.channel(channelName).then((chan) => {
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
            this.timeout(60_000);
            let subscriptionsRegistered = 10_000;
            let subscriptionsDisposed = 10_000;
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
            this.timeout(60_000);
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

    })
};