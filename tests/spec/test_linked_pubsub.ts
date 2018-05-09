import { expect } from "chai";
import { Observable, AsyncSubject, concat } from "rxjs";

import { ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeLinkedPubSubTests = (factory: ImplementationFactory) => {

    let pubsub1, pubsub2;
    let channel1, channel2;

    describe(`[${factory.name}] should pass basic linked pubsub tests`, () => {

        beforeEach(done => {
            [pubsub1, pubsub2] = factory.getLinkedPubSubImplementation(2);

            let channel1_ready = new AsyncSubject();
            let channel2_ready = new AsyncSubject();

            let channel_name = "channel";

            pubsub1.start().then(() => {
                pubsub1.channel(channel_name).then(chan => {
                    channel1 = chan;
                    channel1_ready.complete();
                });
            });

            pubsub2.start().then(() => {
                pubsub2.channel(channel_name).then(chan => {
                    channel2 = chan;
                    channel2_ready.complete();
                });
            });

            concat(channel1_ready, channel2_ready).subscribe(undefined, undefined, () => {
                done();
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
            }).then(() => {
                channel1.publish(topic, payload);
            });
        });

        // TODO for optimization in the future this might change so that local subscribers don't get publishes via the network that they
        // published themselves
        it("should fire local subscriptions via the network and not pass the same object reference to local subscribers", function (done) {
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
            }).then(() => {
                channel1.publish(topic, payload);
            });
        });

    });
};