if (typeof window === "undefined") {
    var c = require("chai");
    var expect = c.expect;
    var Rx = require('rxjs/Rx');
    var randomValidChannelOrTopicName = require('../test_helper').randomValidChannelOrTopicName;
}

var executeValidationTests = (factory) => {
    let pubsub;

    describe(`[${factory.name} Channel name tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start(() => {
                done();
            });
        });

        it("should make sure a channel name can only be of type string", () => {
            expect(() => pubsub.channel(undefined)).to.throw();
            expect(() => pubsub.channel(null)).to.throw();
            expect(() => pubsub.channel({})).to.throw();
            expect(() => pubsub.channel([])).to.throw();
            expect(() => pubsub.channel(['a'])).to.throw();
        });

        it("should make sure a channel name can consist of valid characters and be between 1 to 63 characters long", (done) => {
            let channel_generation = (length: number) => {
                const channel_name = randomValidChannelOrTopicName(length);
                pubsub.channel(channel_name);
            };

            Rx.Observable.range(1, 63).subscribe(length => {
                expect(() => channel_generation(length)).not.to.throw();
            }, undefined, done);
        });

        it("should make sure a channel name may not be longer than 63 characters", () => {
            let overlong_name = randomValidChannelOrTopicName(64);
            expect(() => pubsub.channel(overlong_name)).to.throw();
        });

        it("should make sure a channel with unallowed characters cannot be created", () => {
            expect(() => pubsub.channel("Foobar#")).to.throw();
            expect(() => pubsub.channel("Foobar1234+")).to.throw();
            expect(() => pubsub.channel("Foobar&")).to.throw();
            expect(() => pubsub.channel("Foobar$")).to.throw();
            expect(() => pubsub.channel("Foobar%")).to.throw();
            expect(() => pubsub.channel("Foobar§")).to.throw();
            expect(() => pubsub.channel("FoobarÖÄÜ")).to.throw();
            expect(() => pubsub.channel("Foobaré")).to.throw();
        });

        it("should make sure a channel with allowed characters can be created", () => {
            expect(() => pubsub.channel("Foobar1234_:/-")).not.to.throw();
        });

        it("should not allow the special sequence _$_ in a channel name", () => {
            expect(() => pubsub.channel("Foobar1234_$_Foobar")).to.throw();
        });

        it("should not allow the special sequence _%_ in a channel name", () => {
            expect(() => pubsub.channel("Foobar1234_$_Foobar")).to.throw();
        });
    });

    describe(`[${factory.name} Topic name tests`, () => {
        let channel;

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            let randomChannelName = randomValidChannelOrTopicName();
            pubsub.start(() => {
                pubsub.channel(randomChannelName, (chan) => {
                    channel = chan;
                    done();
                });
            });
        });

        it("should make sure a topic can only be of type string", () => {
            expect(() => channel.publish(undefined, "foo")).to.throw();
            expect(() => channel.publish(null, "foo")).to.throw();
            expect(() => channel.publish({}, "foo")).to.throw();
            expect(() => channel.publish([], "foo")).to.throw();
            expect(() => channel.publish(['a'], "foo")).to.throw();

            const empty = () => void 0;
            expect(() => channel.subscribe(undefined, empty)).to.throw();
            expect(() => channel.subscribe(null, empty)).to.throw();
            expect(() => channel.subscribe({}, empty)).to.throw();
            expect(() => channel.subscribe([], empty)).to.throw();
            expect(() => channel.subscribe(['a'], empty)).to.throw();
        });

        it("should make sure a channel name can consist of valid characters and be between 1 to 255 characters long", (done) => {
            let topic_generation_publish = (length: number) => {
                const topic_name = randomValidChannelOrTopicName(length);
                channel.publish(topic_name);
            };
            let topic_generation_subscribe = (length: number) => {
                const topic_name = randomValidChannelOrTopicName(length);
                channel.subscribe(topic_name, () => void 0);
            };

            Rx.Observable.range(1, 255).subscribe(length => {
                expect(() => topic_generation_publish(length)).not.to.throw();
                expect(() => topic_generation_subscribe(length)).not.to.throw();
            }, undefined, done);
        });

        it("should make sure a topic with allowed characters can be published to", () => {
            expect(() => channel.publish("Foobar1234_:/-")).not.to.throw();
            expect(() => channel.subscribe("Foobar1234_:/-", () => void 0)).not.to.throw();
        });

        it("should make sure a topic with special sequence can be published to", () => {
            expect(() => channel.publish("Foobar_$_Foobar")).not.to.throw();
            expect(() => channel.publish("Foobar_%_Foobar")).not.to.throw();

            expect(() => channel.subscribe("Foobar_$_Foobar", () => void 0)).not.to.throw();
            expect(() => channel.subscribe("Foobar_%_Foobar", () => void 0)).not.to.throw();
        });

        it("should be ok to publish a plain object", done => {
            let plain_object = { data: "foo" };
            expect(() => {
                channel.publish(randomValidChannelOrTopicName(), plain_object);
            }).not.to.throw();
            done();
        });

        it("should only be allowed to publish a plain object", done => {
            let non_plain_object = new class {
                constructor() {
                }
            }();

            expect(() => {
                channel.publish(randomValidChannelOrTopicName(), non_plain_object);
            }).to.throw();
            done();
        });

    });
};

if (typeof window === "undefined") {
    module.exports = {
        executeValidationTests: executeValidationTests
    };
}
