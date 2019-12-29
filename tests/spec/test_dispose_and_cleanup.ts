import { expect } from "chai";

import { PubSub, Channel, ImplementationFactory } from "@pubsub-a/interfaces";
import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeDisposeAndCleanupTests = (factory: ImplementationFactory) => {
    describe(`['${factory.name}] should pass dispose and cleanup tests`, function() {
        let pubsub: PubSub;
        let channel: Channel;
        let topic: string;

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            topic = randomValidChannelOrTopicName();
            const channel_name = randomValidChannelOrTopicName();
            pubsub.start().then(() => {
                pubsub.channel(channel_name).then(chan => {
                    channel = chan;
                    done();
                });
            });
        });

        it("should make sure the dispose function returns a promise that resolves with a count", () => {
            return channel
                .subscribe(topic, () => void 0)
                .then(token => {
                    const dispose_promise = token.dispose();
                    expect(dispose_promise).to.be.ok;
                    expect(dispose_promise.then).to.be.ok;
                    return dispose_promise.then(subscription_count => {
                        expect(subscription_count).to.equal(0);
                    });
                });
        });

        it("should call the dispose callback with the subscription count when disposing", done => {
            channel
                .subscribe(topic, () => void 0)
                .then(token => {
                    token.dispose().then(count => {
                        expect(count).to.equal(0);
                        done();
                    });
                });
        });

        it("should set the subscription isDisposed to true after it got disposed", done => {
            const topic = "topic";
            let observerFinished;
            let promise;

            observerFinished = new Promise(resolve => {
                promise = channel.once(topic, payload => {
                    expect(payload).to.equal("foo");
                    resolve();
                });
            });

            promise.then(subs => {
                expect(subs.isDisposed).to.be.false;
                channel.publish(topic, "foo");

                observerFinished.then(() => {
                    expect(subs.isDisposed).to.be.true;
                    done();
                });
            });
        });

        it("should not dispose all identical subscriptions if a single one is disposed", done => {
            const channel_name = randomValidChannelOrTopicName();

            pubsub.channel(channel_name).then(chan => {
                const p1 = chan.subscribe("topic", payload => {
                    expect(payload).to.be.ok;
                    done();
                });

                const p2 = chan
                    .subscribe("topic", () => void 0)
                    .then(subscription => {
                        subscription.dispose().then(() => {
                            Promise.all([p1, p2]).then(() => chan.publish("topic", true));
                        });
                    });
            });
        });

        it("should not throw an exception if the subscription is already disposed", () => {
            const channel_name = randomValidChannelOrTopicName();
            return pubsub.channel(channel_name).then(chan => {
                return chan
                    .subscribe("topic", () => void 0)
                    .then(subscription => {
                        expect(subscription.isDisposed).to.be.false;
                        subscription.dispose();
                        expect(subscription.isDisposed).to.be.true;
                        expect(() => subscription.dispose()).not.to.throw();
                    });
            });
        });

        it("should run the callback after disposal", done => {
            const channel_name = randomValidChannelOrTopicName();
            let throw_exception;
            let finalize = () => {
                if (throw_exception) throw throw_exception;
                else done();
            };

            let callback = () => {
                expect(true).to.be.true;
                // it should run after disposal so publishing shouldn't run our
                // subscription function
                channel.publish("topic", 1).then(() => {
                    setTimeout(finalize, 500);
                });
            };

            // fail if this subscription is triggered
            channel
                .subscribe("topic", () => {
                    // this is tricky: by definition, exceptions in the observer func are
                    // swallowed - so any expect() calls that throw will be swallowed causing
                    // this test not to fail so use this sideeffect for it
                    throw_exception = () => new Error("Observer func was called");
                })
                .then(subscription => {
                    subscription.dispose().then(callback);
                });
        });
    });
};
