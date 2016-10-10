if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
    var randomValidChannelOrTopicName = require('../test_helper').randomValidChannelOrTopicName;
}

const executeHighLoadTests = (factory) => {

    let pubsub1, pubsub2;
    let channel1, channel2;

    describe(`[${factory.name}] should run the highload test`, () => {

        beforeEach(done => {
            [ pubsub1, pubsub2 ] = factory.getLinkedPubSubImplementation(2);

            let channel1_ready = new Rx.AsyncSubject();
            let channel2_ready = new Rx.AsyncSubject();

            let channel_name = "channel";

            pubsub1.start(pubsub => {
                pubsub1.channel(channel_name, (chan) => {
                    channel1 = chan;
                    channel1_ready.complete();
                });
            });
            pubsub2.start(pubsub => {
                pubsub2.channel(channel_name, (chan) => {
                    channel2 = chan;
                    channel2_ready.complete();
                });
            });

            Rx.Observable.concat(channel1_ready, channel2_ready).subscribe(undefined, undefined, () => {
                done();
            });
        });


        it("should handle tenthousand subscriptions to different topic simultaneously", function(done) {
            // set timeout to a minute for this test
            this.timeout(60000);
            let subscriptionsRegistered = 10000;
            let subscriptionsDisposed = 10000;
            const payload  = "foobar";

            while(subscriptionsRegistered > 0) {
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
        it("should handle thenthousand subscriptions with a 5k payload", function(done) {
            this.timeout(60000);
            let subscriptionsRegistered = 10000;
            let subscriptionsTriggered = 10000;
            const topic = randomValidChannelOrTopicName();
            const payload = randomString(1024 * 5);

            // TODO test with .dispose()
            const subscriptionsReady = new Promise(resolve => {
                while(subscriptionsRegistered > 0) {
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

        it("should handle a subscription with tenthousand publishes of 5k", function(done) {
            this.timeout(60000);
            const topic = randomValidChannelOrTopicName();
            let numPublishes = 10000;
            let numTriggered = 10000;

            channel1.subscribe(topic, (payload) => {
                expect(payload.length).to.equal(1024 * 5);
                if (--numTriggered == 0)
                    done();
            }).then(() => {
                while (numPublishes-- > 0) {
                    channel2.publish(topic, randomString(1024 * 5));
                }
            });
        })
    });
};

if (typeof window === "undefined") {
    module.exports = {
        executeHighLoadTests: executeHighLoadTests
    };
}
