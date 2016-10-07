if (typeof window === "undefined") {
    let c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
    var randomValidChannelOrTopicName = require('../test_helper').randomValidChannelOrTopicName;
}

const executeHighLoadTests = (factory) => {

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


        it("should handle tenthousand subscriptions simultaneously", function(done) {
            // set timeout to a minute for this test
            this.timeout(60000);
            let numRuns = 10000;
            const payload  = "foobar";
            const check = (p) => { expect(p).to.equal(payload); };

            while(numRuns > 0) {
                const topic = randomValidChannelOrTopicName();
                channel1.subscribe(topic, check, (subscription) => {
                    channel2.publish(topic, payload, () => {
                        subscription.dispose();
                    });
                });
                if (--numRuns == 0) {
                    setTimeout(done, 1000);
                }
            };
        });
    });
};

if (typeof window === "undefined") {
    module.exports = {
        executeHighLoadTests: executeHighLoadTests
    };
}
