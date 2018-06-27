import { expect } from "chai";
import { Observable, range } from "rxjs";

import { ImplementationFactory, PubSub, Channel } from "@dynalon/pubsub-a-interfaces";
import { randomString, randomValidChannelOrTopicName } from "../test_helper";

export const executeValidationTests = (factory: ImplementationFactory) => {
    let pubsub: PubSub;

    describe(`[${factory.name} Channel name tests`, () => {

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            pubsub.start().then(() => done());
        });

        it("should make sure a channel name can only be of type string", () => {
            // we need to cast so that typescript does not already catch our errors
            let invalidPubSub = pubsub as any;
            expect(() => invalidPubSub.channel(undefined)).to.throw();
            expect(() => invalidPubSub.channel(null)).to.throw();
            expect(() => invalidPubSub.channel({})).to.throw();
            expect(() => invalidPubSub.channel([])).to.throw();
            expect(() => invalidPubSub.channel(['a'])).to.throw();
        });

        it("should make sure a channel name can consist of valid characters and be between 1 to 63 characters long", (done) => {
            let channel_generation = (length: number) => {
                const channel_name = randomValidChannelOrTopicName(length);
                pubsub.channel(channel_name);
            };

            range(1, 63).subscribe(length => {
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
        let channel: Channel;

        beforeEach(done => {
            pubsub = factory.getPubSubImplementation();
            let randomChannelName = randomValidChannelOrTopicName();
            pubsub.start().then(() => {
                pubsub.channel(randomChannelName).then((chan) => {
                    channel = chan;
                    done();
                });
            });
        });

        it("should make sure a topic can only be of type string", () => {
            const invalidChannel: any = channel;
            expect(() => invalidChannel.publish(undefined, "foo")).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.publish(null, "foo")).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.publish({}, "foo")).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.publish([], "foo")).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.publish(['a'], "foo")).to.throw().and.be.an.instanceOf(Error);

            const empty = () => void 0;
            expect(() => invalidChannel.subscribe(undefined, empty)).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.subscribe(null, empty)).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.subscribe({}, empty)).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.subscribe([], empty)).to.throw().and.be.an.instanceOf(Error);
            expect(() => invalidChannel.subscribe(['a'], empty)).to.throw().and.be.an.instanceOf(Error);
        });

        it("should make sure a channel name can consist of valid characters and be between 1 to 255 characters long", (done) => {
            let topic_generation_publish = (length: number) => {
                const topic_name = randomValidChannelOrTopicName(length);
                channel.publish(topic_name, undefined);
            };
            let topic_generation_subscribe = (length: number) => {
                const topic_name = randomValidChannelOrTopicName(length);
                channel.subscribe(topic_name, () => void 0);
            };

            range(1, 255).subscribe(length => {
                expect(() => topic_generation_publish(length)).not.to.throw();
                expect(() => topic_generation_subscribe(length)).not.to.throw();
            }, undefined, done);
        });

        it("should make sure a topic with allowed characters can be published to", () => {
            expect(() => channel.publish("Foobar1234_:/-", undefined)).not.to.throw();
            expect(() => channel.subscribe("Foobar1234_:/-", () => void 0)).not.to.throw();
        });

        it("should make sure a topic with special sequence can not be published to by default", () => {
            expect(() => channel.publish("Foobar_$_Foobar", undefined)).to.throw();
            expect(() => channel.publish("Foobar_%_Foobar", undefined)).to.throw();

            expect(() => channel.subscribe("Foobar_$_Foobar", () => void 0)).to.throw();
            expect(() => channel.subscribe("Foobar_%_Foobar", () => void 0)).to.throw();
        })

        it("should make sure a topic with special sequence can be published to if configured in validation options", function (done) {
            // for PubSubMicro we allow custom validation to include _%_ and _$_
            if (factory.name !== "PubSubMicro") {
                this.skip();
                return;
            }

            const validationOptions = {
                channelNameMaxLength: 63,
                topicNameMaxLength: 255,
                allowSpecialTopicSequences: true,
            }

            const getLinkedPubSubImplementation = factory.getLinkedPubSubImplementation as Function;
            const pubsub = getLinkedPubSubImplementation(2, { validationOptions })[0];
            const channelName = randomValidChannelOrTopicName();
            pubsub.start().then(() => {
                pubsub.channel(channelName).then(channel => {

                    expect(() => channel.publish("Foobar_$_Foobar", undefined)).not.to.throw();
                    expect(() => channel.publish("Foobar_%_Foobar", undefined)).not.to.throw();

                    expect(() => channel.subscribe("Foobar_$_Foobar", () => void 0)).not.to.throw();
                    expect(() => channel.subscribe("Foobar_%_Foobar", () => void 0)).not.to.throw();
                    done();
                }).catch(err => done(err))
            })
        });

        it("should be ok to publish a plain object", done => {
            let plain_object = { data: "foo" };
            expect(() => {
                channel.publish(randomValidChannelOrTopicName(), plain_object);
            }).not.to.throw();
            done();
        });

        it("should only be allowed to publish a plain object", function(done) {
            if (factory.name === "PubSubMicro") {
                this.skip();
                return;
            }
            let non_plain_object = new class {
                constructor() {
                }
            }();

            expect(() => {
                channel.publish(randomValidChannelOrTopicName(), non_plain_object);
            }).to.throw().and.be.an.instanceOf(Error);
            done();
        });
    });
};