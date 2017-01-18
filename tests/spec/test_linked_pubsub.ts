if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
    var randomValidChannelOrTopicName = require('../test_helper').randomValidChannelOrTopicName;
}

const executeLinkedPubSubTests = (factory) => {

    let pubsub1, pubsub2;
    let channel1, channel2;

    describe(`[${factory.name}] should pass basic linked pubsub tests`, () => {

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

            // HACK TODO see trello ticket https://trello.com/c/jhOLCZpy
            // For PubSubMicro we need to reset isStarted
            if (pubsub2.constructor.name == "PubSubMicroValidated") {
                pubsub2.isStarted = false;
            }

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

        it("should receive a simple publish across linked instances using Callback", done => {
            let topic = randomValidChannelOrTopicName();
            let payload = "foobar";

            channel1.subscribe(topic, p => {
                expect(p).to.equal(payload);
                done();
            }, () => {
                channel2.publish(topic, "foobar");
            });
        });

        it("should receive a simple publish across linked instances using Promise", done => {
            let topic = randomValidChannelOrTopicName();
            let payload = "foobar";

            channel1.subscribe(topic, p => {
                expect(p).to.equal(payload);
                done();
            }).then(() => {
                channel2.publish(topic, "foobar");
            });
        });

        it("should fire the local subscription only once if we locally publish", done => {
            let topic = randomValidChannelOrTopicName();
            let payload = "foobar";

            channel2.subscribe(topic, () => void 0);
            channel1.subscribe(topic, p => {
                expect(p).to.equal(payload);
                done();
            }, () => {
                channel1.publish(topic, payload);
            });
        });

        // TODO for optimization in the future this might change so that local subscribers don't get publishes via the network that they
        // published themselves
        it("should fire local subscriptions via the network and not pass the same object reference to local subscribers", function(done) {
            if (factory.name == "PubSubMicro") {
                this.skip();
                return;
            }

            let topic = randomValidChannelOrTopicName();
            let payload = { foo: "bar" };

            channel2.subscribe(topic, () => void 0);
            channel1.subscribe(topic, p => {
                expect(p).not.to.equal(payload);
                done();
            }, () => {
                channel1.publish(topic, payload);
            });
        });

    });
};

if (typeof window === "undefined") {
    module.exports = {
        executeLinkedPubSubTests: executeLinkedPubSubTests
    };
}
