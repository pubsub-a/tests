import { expect } from "chai";
import { Observable, AsyncSubject, Subject, zip, concat, range } from "rxjs";
import { take, skip, toArray } from "rxjs/operators";

import { PubSub, Channel, ImplementationFactory } from "@dynalon/pubsub-a-interfaces";
import { randomValidChannelOrTopicName } from "../test_helper";

export const executeCommonBasicPubSubTests = (factory: ImplementationFactory) => {

    describe(`["${factory.name}] should pass the common PubSub implementation tests `, () => {

        let pubsub: PubSub;
        let channel: Channel;

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => {
                let random = randomValidChannelOrTopicName();
                pubsub.channel(random).then((chan: Channel) => {
                    channel = chan;
                    done();
                });
            });
        });

        it("should accept a subscription and fire it when published", (done) => {
            const topic = "myTopic";
            const subscriptionFunction = (n: number) => {
                expect(n).to.equal(1);
                done();
            };

            channel.subscribe(topic, subscriptionFunction).then(() => {
                channel.publish(topic, 1);
            });
        });

        it("should handle multiple subscriptions in parallel", (done) => {
            let count1 = 0, count2 = 0;
            let promise1 = new AsyncSubject();
            let promise2 = new AsyncSubject();
            let num_additions = 100;

            let p1 = channel.subscribe<number>("topic1", (value) => {
                count1 += value;
                if (count1 >= num_additions)
                    promise1.complete();
            });

            let p2 = channel.subscribe<number>("topic2", (value) => {
                count2 += value;
                if (count2 >= num_additions)
                    promise2.complete();
            });

            Promise.all([p1, p2]).then(() => {
                concat(promise1, promise2).subscribe(undefined, undefined, () => {
                    expect(count1).to.equal(num_additions);
                    expect(count2).to.equal(num_additions);
                    done();
                });

                const rng = range(1, num_additions);
                rng.subscribe(() => channel.publish("topic1", 1));
                rng.subscribe(() => channel.publish("topic2", 1));
            });
        });

        it("should fire multiple subscriptions on a single publish", done => {
            let p1, p2;
            const subscriptionsReady = new Subject<void>();
            const publishReceived = new Subject<void>();
            const topic = "myTopic";

            channel.subscribe(topic, () => publishReceived.next()).then(() => subscriptionsReady.next());
            channel.subscribe(topic, () => publishReceived.next()).then(() => subscriptionsReady.next());

            subscriptionsReady.pipe(take(2), toArray()).subscribe(() => channel.publish(topic, 1));
            publishReceived.pipe(take(2), toArray()).subscribe(() => done());
        });

        it("should fire each subscription only once if multiple subscriptions are available", (done) => {
            let count = 0;

            const publishReceived = new Subject<void>();

            zip(
                channel.subscribe("topic", () => { count += 1; publishReceived.next(); }),
                channel.subscribe("topic", () => { count += 1000; publishReceived.next(); }),
            ).subscribe(() => {
                channel.publish("topic", true);
            })

            publishReceived.pipe(take(2), toArray()).subscribe(() => {
                expect(count).to.equal(1001);
                done();
            })
        });

        it("should execute the subscriptions in the order they were added", (done) => {
            const sequence = new Subject();

            sequence.pipe(take(3), toArray()).subscribe(result => {
                expect(result).to.deep.equal([1, 2, 3]);
                done();
            });

            let p1 = channel.subscribe("myTopic", () => sequence.next(1));
            let p2 = channel.subscribe("myTopic", () => sequence.next(2));
            let p3 = channel.subscribe("myTopic", () => sequence.next(3));

            Promise.all([p1, p2, p3]).then(() => channel.publish("myTopic", 1));
        });

        it("should fire a subscription if it is registered with .once()", (done) => {
            const topic = randomValidChannelOrTopicName();
            const promise = channel.once(topic, (payload) => {
                expect(payload).to.equal("foo");
                done();
            });

            promise.then(subs => {
                channel.publish(topic, "foo");
            });
        });


        it("should fire a subscription only once if it is registered with .once()", (done) => {
            const topic = randomValidChannelOrTopicName();
            let counter = 0;
            const promise = channel.once(topic, (payload) => {
                expect(payload).to.equal("foo");
                expect(counter).to.equal(0);
                counter++
                done();
            });

            promise.then(subs => {
                channel.publish(topic, "foo");
                channel.publish(topic, "foo");
            });
        });

        it("should return the correct subscription counts", () => {
            let fn = () => void 0;
            let promise1 = channel.subscribe("myTopic", fn).then(t1 => {
                expect(t1.count).to.equal(1);
                return t1;
            });
            let promise2 = channel.subscribe("myTopic", fn).then(t2 => {
                expect(t2.count).to.equal(2);
                return t2;
            });
            let promise3 = channel.subscribe("myTopic", fn).then(t3 => {
                expect(t3.count).to.equal(3);
                return t3;
            });

            return Promise.all([promise1, promise2, promise3]).then(tokens => {
                const [token1, token2, token3] = tokens as any;
                return token1.dispose().then(count => {
                    expect(count).to.equal(2);
                    return token2.dispose();
                }).then(count => {
                    expect(count).to.equal(1);
                    return token3.dispose();
                }).then(count => {
                    expect(count).to.equal(0);
                });
            });
        });

        it("should make sure unhandled exceptions in an observer function won't throw an error in the pubsub implementation", done => {
            const topic = randomValidChannelOrTopicName();
            const subscriber = () => {
                throw new Error("Expected error");
            }

            channel.subscribe(topic, subscriber).then(() => {
                try {
                    channel.publish(topic, "payload");
                    expect(true).to.be.ok;
                    done();
                } catch (err) {
                    expect(false).to.be.ok;
                    done("FAILED");
                }
            });
        });

        it("should make sure publish() returns a promise that is triggered when succesfull", done => {
            const topic = randomValidChannelOrTopicName();
            const promise = channel.publish(topic, "foobar");

            expect(promise).to.be.ok;
            expect(promise.then).to.be.ok;

            promise.then(() => {
                expect(true).to.be.ok;
                done();
            });
        });
    });
}